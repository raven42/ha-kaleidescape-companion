/** Local month browsing and compact viewing/movie details; no calendar provider writes. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues } from "lit";
import { repeat } from "lit/directives/repeat.js";
import type {
  JournalClient,
  JournalInfo,
  CalendarViewing,
  CalendarMovie,
  ViewingSummary,
} from "../core/api";
import { errorCode, errorMessage } from "../core/api";
import { CoverQueue } from "../library/cover";
import { renderFormatBadges, renderRatingBadge } from "../library/badges";
import { libraryStyles } from "../library/styles";
import type { LibraryCriterion } from "../library/criteria";
import { styles } from "./styles";
import type { CalendarStatus } from "./journal-view";
import { calendarStyles } from "./journal-calendar.styles";
import { closeButton, dismissBackdrop } from "./dialog";
import "../library/library";
import { unifiedMovieDialog, watchMovieDialogMode } from "./movie-dialog-mode";

export function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function calendarMonth(
  search = location.search,
  now = new Date(),
): Date {
  const value = new URLSearchParams(search).get("companion_month") ?? "";
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    if (year >= 100 && year <= 9998) return new Date(year, month - 1, 1);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function monthBounds(month: Date) {
  return [
    new Date(month.getFullYear(), month.getMonth(), 1).toISOString(),
    new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString(),
  ];
}

/** Place previews beside the cover when possible, without covering it. */
export function previewPosition(
  anchor: Pick<DOMRect, "left" | "right" | "top" | "bottom">,
  box: Pick<DOMRect, "width" | "height">,
  viewport: { left: number; top: number; width: number; height: number },
) {
  const margin = 12,
    gap = 8;
  const left = viewport.left + margin,
    right = viewport.left + viewport.width - margin;
  const top = viewport.top + margin,
    bottom = viewport.top + viewport.height - margin;
  const regions = [
    {
      side: "right",
      left: Math.max(left, anchor.right + gap),
      right,
      top,
      bottom,
    },
    {
      side: "left",
      left,
      right: Math.min(right, anchor.left - gap),
      top,
      bottom,
    },
    {
      side: "below",
      left,
      right,
      top: Math.max(top, anchor.bottom + gap),
      bottom,
    },
    {
      side: "above",
      left,
      right,
      top,
      bottom: Math.min(bottom, anchor.top - gap),
    },
  ].filter(
    (region) => region.right > region.left && region.bottom > region.top,
  );
  const chosen =
    regions.find(
      (region) =>
        region.right - region.left >= box.width &&
        region.bottom - region.top >= box.height,
    ) ??
    regions.sort(
      (a, b) =>
        (b.right - b.left) * (b.bottom - b.top) -
        (a.right - a.left) * (a.bottom - a.top),
    )[0];
  if (!chosen) return null;
  const width = Math.min(box.width, chosen.right - chosen.left);
  const height = Math.min(box.height, chosen.bottom - chosen.top);
  const clamp = (value: number, low: number, high: number) =>
    Math.max(low, Math.min(value, high));
  return {
    left:
      chosen.side === "right"
        ? chosen.left
        : chosen.side === "left"
          ? chosen.right - width
          : clamp(anchor.left, chosen.left, chosen.right - width),
    top:
      chosen.side === "below"
        ? chosen.top
        : chosen.side === "above"
          ? chosen.bottom - height
          : clamp(anchor.top, chosen.top, chosen.bottom - height),
    maxWidth: chosen.right - chosen.left,
    maxHeight: chosen.bottom - chosen.top,
    side: chosen.side,
    right: chosen.right,
    bottom: chosen.bottom,
  };
}

/** Endpoint markers use local dates, including viewings crossing month boundaries. */
export function calendarDays(
  row: Pick<
    CalendarViewing,
    "started_at" | "ended_at" | "completed_at" | "status"
  >,
) {
  const start = dayKey(new Date(row.started_at));
  const endpoint = row.ended_at ?? row.completed_at;
  const end = endpoint ? dayKey(new Date(endpoint)) : start;
  return row.status === "completed" &&
    end !== start &&
    endpoint &&
    new Date(endpoint) > new Date(row.started_at)
    ? [
        { day: start, phase: "start" },
        { day: end, phase: "completion" },
      ]
    : [{ day: start, phase: "single" }];
}

export class JournalCalendar extends LitElement {
  static properties = {
    client: { attribute: false },
    scope: { attribute: false },
    query: { type: String },
    status: { type: String },
    fuzzy: { type: Boolean },
    libraryTitleId: { attribute: false },
    daySize: { type: Number },
    fitScreen: { type: Boolean },
    hoverPreview: { type: Boolean },
    disabled: { type: Boolean },
    editable: { type: Boolean },
    rememberUrl: { type: Boolean },
    detailsOnly: { type: Boolean },
  };
  static styles = [styles, libraryStyles, calendarStyles];
  client?: JournalClient;
  scope?: JournalInfo;
  query = "";
  status = "";
  fuzzy = true;
  libraryTitleId?: string;
  daySize = 180;
  fitScreen = false;
  hoverPreview = false;
  disabled = false;
  // Only the administrator host connects the shared Journal editor.
  editable = false;
  rememberUrl = true;
  detailsOnly = false;
  private linkedTitleId?: string;
  private unwatchMovieDialog?: () => void;
  private preserveDetailOnClose = false;
  private libraryRequest = 0;
  private fittedSize = 180;
  private resizeObserver?: ResizeObserver;
  private layoutFrame?: number;
  private month = calendarMonth();
  private items: CalendarViewing[] = [];
  private totals?: { viewing_count: number; watched_seconds: number };
  private loading = false;
  private error = "";
  private generation = 0;
  private signature = "";
  private privacy = "";
  private boundClient?: JournalClient;
  private queue = new CoverQueue();
  private selected?: ViewingSummary & { completed_at?: string | null };
  private selectedArtwork: string | null = null;
  private movie: CalendarMovie | null = null;
  private detailRequest = 0;
  private detailLoading = false;
  private detailError = "";
  private previewRow?: CalendarViewing;
  private previewMovie?: CalendarMovie | null;
  private previewError = "";
  private previewAnchor?: HTMLElement;
  private previewRequest = 0;
  private previewTimer?: ReturnType<typeof setTimeout>;
  private previewCloseTimer?: ReturnType<typeof setTimeout>;
  private previewHovered = false;
  private previewFocused = false;
  private previewPopupHovered = false;
  private previewBlocked = false;
  private previewPointerAnchor?: HTMLElement;
  private previewCache = new Map<string, CalendarMovie | null>();
  private dayPicker?: { date: Date; rows: CalendarViewing[] };
  private activeTouches = new Set<number>();
  private swipeStart?: { id: number; x: number; y: number };
  private swipeDragging = false;
  private swipeAnimating = false;
  private swipeMotion = 0;
  private swipeAnimationTimer?: ReturnType<typeof setTimeout>;
  private monthLoad?: Promise<void>;
  private suppressSwipeClick = false;
  private swipeClickTimer?: ReturnType<typeof setTimeout>;
  private previewKeydown = (event: KeyboardEvent) => {
    if (event.key === "Tab" && !this.previewBlocked)
      this.previewPointerAnchor = undefined;
    if (event.key === "Escape" && this.previewRow) {
      event.stopPropagation();
      this.closePreview();
    }
  };
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this.previewKeydown);
    window.addEventListener("scroll", this.positionPreview, true);
    window.addEventListener("resize", this.positionPreview);
    window.visualViewport?.addEventListener("scroll", this.positionPreview);
    window.visualViewport?.addEventListener("resize", this.positionPreview);
    this.unwatchMovieDialog = watchMovieDialogMode(() => {
      this.requestUpdate();
      if (this.detailsOnly || !this.selected) return;
      if (
        unifiedMovieDialog() &&
        this.renderRoot.querySelector<HTMLDialogElement>(".calendar-dialog")
          ?.open
      )
        void this.openLibraryTitle(true);
      else if (!unifiedMovieDialog() && this.linkedTitleId) {
        const row = this.selected;
        this.linkedTitleId = undefined;
        void this.openViewing(row);
      }
    });
    if (this.detailsOnly) return;
    window.addEventListener("resize", this.scheduleLayout);
    window.visualViewport?.addEventListener("resize", this.scheduleLayout);
    this.rememberMonth();
    this.requestUpdate();
  }
  protected updated() {
    if (!this.isConnected || this.detailsOnly) return;
    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver(this.scheduleLayout);
      this.resizeObserver.observe(this);
      // The surrounding sticky search/header and footer consume viewport space.
      if (this.previousElementSibling)
        this.resizeObserver.observe(this.previousElementSibling);
      if (this.nextElementSibling)
        this.resizeObserver.observe(this.nextElementSibling);
    }
    this.scheduleLayout();
  }
  private scheduleLayout = () => {
    if (!this.fitScreen || !this.isConnected || this.layoutFrame !== undefined)
      return;
    this.layoutFrame = requestAnimationFrame(() => {
      this.layoutFrame = undefined;
      if (!this.fitScreen || !this.isConnected) return;
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      const top = Math.max(
        0,
        this.getBoundingClientRect().top,
        this.previousElementSibling?.getBoundingClientRect().bottom ?? 0,
      );
      const main = this.closest("main");
      const reserve =
        [".month-bar", ".weekday"].reduce(
          (height, selector) =>
            height +
            (this.renderRoot.querySelector(selector)?.getBoundingClientRect()
              .height ?? 0),
          0,
        ) +
        (this.nextElementSibling?.getBoundingClientRect().height ?? 0) +
        (main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0) +
        16;
      const first = new Date(
        this.month.getFullYear(),
        this.month.getMonth(),
        1,
      );
      const days = new Date(
        this.month.getFullYear(),
        this.month.getMonth() + 1,
        0,
      ).getDate();
      const weeks = Math.ceil((first.getDay() + days) / 7);
      const size = Math.max(48, Math.floor((viewport - top - reserve) / weeks));
      if (size !== this.fittedSize) {
        this.fittedSize = size;
        this.requestUpdate();
      }
    });
  };
  protected willUpdate(changed: PropertyValues) {
    if (!this.isConnected) return;
    if (changed.has("hoverPreview") && !this.hoverPreview) this.closePreview();
    const privacy = `${this.scope?.entry_id}:${this.scope?.dataset_id}:${this.scope?.library_enabled}:${this.scope?.permissions.edit}`;
    if (privacy !== this.privacy || this.client !== this.boundClient) {
      this.clear();
      this.privacy = privacy;
      this.boundClient = this.client;
    }
    if (this.detailsOnly) return;
    const signature = JSON.stringify([
      privacy,
      this.scope?.revision,
      this.query,
      this.status,
      this.fuzzy,
      this.libraryTitleId,
      this.month.getTime(),
    ]);
    if (signature === this.signature) return;
    this.signature = signature;
    this.monthLoad = this.load();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.previewKeydown);
    window.removeEventListener("scroll", this.positionPreview, true);
    window.removeEventListener("resize", this.positionPreview);
    window.visualViewport?.removeEventListener("scroll", this.positionPreview);
    window.visualViewport?.removeEventListener("resize", this.positionPreview);
    this.unwatchMovieDialog?.();
    this.unwatchMovieDialog = undefined;
    window.removeEventListener("resize", this.scheduleLayout);
    window.visualViewport?.removeEventListener("resize", this.scheduleLayout);
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (this.layoutFrame !== undefined) cancelAnimationFrame(this.layoutFrame);
    this.layoutFrame = undefined;
    this.clear();
    this.activeTouches.clear();
    this.swipeStart = undefined;
    clearTimeout(this.swipeClickTimer);
    this.suppressSwipeClick = false;
    this.signature = this.privacy = "";
    this.boundClient = undefined;
  }
  private clear() {
    this.generation++;
    this.cancelSwipeAnimation();
    this.closeDayPicker();
    this.activeTouches.clear();
    this.swipeStart = undefined;
    this.closePreview();
    this.previewCache.clear();
    this.closeDetails();
    this.items = [];
    this.error = "";
    this.loading = false;
    this.queue.cache.dispose();
    this.queue = new CoverQueue();
  }
  private fail(error: unknown) {
    if (errorCode(error) === "unauthorized") {
      this.clear();
      this.dispatchEvent(
        new CustomEvent("access-denied", { bubbles: true, composed: true }),
      );
    }
    this.error = errorMessage(error);
    this.requestUpdate();
  }
  private async load() {
    if (!this.client || !this.scope) return;
    const generation = ++this.generation;
    this.closeDayPicker();
    this.closePreview();
    this.previewCache.clear();
    this.closeDetails();
    this.items = [];
    this.totals = undefined;
    this.loading = true;
    this.error = "";
    this.notifyStatus();
    this.requestUpdate();
    try {
      const [start, end] = monthBounds(this.month);
      const result = await this.client.calendarMonth(
        this.scope,
        start,
        end,
        this.query,
        this.status,
        this.fuzzy,
        this.libraryTitleId,
      );
      if (generation === this.generation) {
        this.items = result.items;
        this.totals = result.summary;
      }
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) {
        this.loading = false;
        this.notifyStatus();
        this.requestUpdate();
      }
    }
  }
  /** Footer status is owned by the enclosing Journal, not a second calendar bar. */
  private notifyStatus() {
    if (!this.isConnected) return;
    const detail: CalendarStatus = {
      month: this.month.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
      monthName: this.month.toLocaleDateString(undefined, { month: "long" }),
      count: this.totals?.viewing_count,
      watchedSeconds: this.totals?.watched_seconds,
      loading: this.loading,
      error: this.error,
      empty: !this.items.length,
    };
    this.dispatchEvent(
      new CustomEvent("calendar-status", {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }
  refresh() {
    return this.load();
  }
  private canMove(delta: number) {
    const year = this.month.getFullYear(),
      month = this.month.getMonth();
    return !(
      this.disabled ||
      this.previewBlocked ||
      (delta < 0 && year <= 100 && month === 0) ||
      (delta > 0 && year >= 9998 && month === 11)
    );
  }
  private move(delta: number, fromSwipe = false) {
    if (!this.canMove(delta) || (this.swipeAnimating && !fromSwipe)) return;
    this.month = new Date(
      this.month.getFullYear(),
      this.month.getMonth() + delta,
      1,
    );
    this.rememberMonth();
    this.requestUpdate();
  }
  private swipeGrid() {
    return this.renderRoot.querySelector<HTMLElement>(".month-grid");
  }
  private cancelSwipeAnimation() {
    this.swipeMotion++;
    clearTimeout(this.swipeAnimationTimer);
    this.swipeAnimating = this.swipeDragging = false;
    const grid = this.swipeGrid();
    if (grid) {
      grid.style.transition = "";
      grid.style.transform = "";
    }
  }
  private resetSwipePosition() {
    const grid = this.swipeGrid();
    if (grid && this.swipeDragging) {
      grid.style.transition = "transform 180ms ease-out";
      grid.style.transform = "";
    }
    this.swipeDragging = false;
  }
  private swipeDown(event: PointerEvent) {
    if (event.pointerType !== "touch") {
      clearTimeout(this.swipeClickTimer);
      this.suppressSwipeClick = false;
      return;
    }
    this.activeTouches.add(event.pointerId);
    if (
      this.activeTouches.size !== 1 ||
      this.disabled ||
      this.previewBlocked ||
      this.swipeAnimating
    ) {
      this.resetSwipePosition();
      this.swipeStart = undefined;
      return;
    }
    clearTimeout(this.swipeClickTimer);
    this.suppressSwipeClick = false;
    this.swipeStart = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }
  private swipeMove(event: PointerEvent) {
    const start = this.swipeStart;
    if (
      event.pointerType !== "touch" ||
      !start ||
      start.id !== event.pointerId ||
      this.activeTouches.size !== 1 ||
      this.swipeAnimating
    )
      return;
    const x = event.clientX - start.x,
      y = event.clientY - start.y;
    if (
      !this.swipeDragging &&
      (Math.abs(x) < 12 || Math.abs(x) < Math.abs(y) * 1.5)
    )
      return;
    if (!this.canMove(x < 0 ? 1 : -1)) return;
    const grid = this.swipeGrid();
    if (!grid) return;
    this.swipeDragging = true;
    grid.style.transition = "none";
    grid.style.transform = `translateX(${x}px)`;
  }
  private async animateSwipe(delta: number) {
    const grid = this.swipeGrid();
    if (
      !grid ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      this.cancelSwipeAnimation();
      this.move(delta);
      return;
    }
    this.swipeDragging = false;
    this.swipeAnimating = true;
    const motion = ++this.swipeMotion;
    const distance = Math.max(grid.getBoundingClientRect().width, 1);
    grid.style.transition = "transform 180ms ease-out";
    grid.style.transform = `translateX(${-delta * distance}px)`;
    this.swipeAnimationTimer = setTimeout(async () => {
      if (motion !== this.swipeMotion || !this.isConnected) return;
      this.move(delta, true);
      await this.updateComplete;
      if (motion !== this.swipeMotion || !this.isConnected) return;
      grid.style.transition = "none";
      grid.style.transform = `translateX(${delta * distance}px)`;
      await this.monthLoad;
      if (motion !== this.swipeMotion || !this.isConnected) return;
      // Commit the offscreen starting position before starting the transition.
      grid.getBoundingClientRect();
      requestAnimationFrame(() => {
        if (motion !== this.swipeMotion || !this.isConnected) return;
        grid.style.transition = "transform 180ms ease-out";
        grid.style.transform = "";
        this.swipeAnimationTimer = setTimeout(() => {
          if (motion === this.swipeMotion) this.cancelSwipeAnimation();
        }, 180);
      });
    }, 180);
  }
  private swipeEnd(event: PointerEvent, cancelled = false) {
    if (event.pointerType !== "touch") return;
    this.activeTouches.delete(event.pointerId);
    const start = this.swipeStart;
    if (!start || start.id !== event.pointerId) return;
    this.swipeStart = undefined;
    if (
      cancelled ||
      this.activeTouches.size ||
      this.disabled ||
      this.previewBlocked
    ) {
      this.resetSwipePosition();
      return;
    }
    const x = event.clientX - start.x,
      y = event.clientY - start.y;
    const delta = x < 0 ? 1 : -1;
    if (
      Math.abs(x) < 60 ||
      Math.abs(x) < Math.abs(y) * 1.5 ||
      !this.canMove(delta)
    ) {
      this.resetSwipePosition();
      return;
    }
    this.suppressSwipeClick = true;
    clearTimeout(this.swipeClickTimer);
    this.swipeClickTimer = setTimeout(() => {
      this.suppressSwipeClick = false;
    }, 450);
    void this.animateSwipe(delta);
  }
  private today() {
    if (this.swipeAnimating) return;
    const now = new Date();
    this.month = new Date(now.getFullYear(), now.getMonth(), 1);
    this.rememberMonth();
    this.requestUpdate();
  }
  private rememberMonth() {
    if (!this.rememberUrl) return;
    const url = new URL(location.href);
    url.searchParams.set(
      "companion_month",
      `${String(this.month.getFullYear()).padStart(4, "0")}-${String(this.month.getMonth() + 1).padStart(2, "0")}`,
    );
    history.replaceState(history.state, "", url);
  }
  private closeDetails() {
    this.previewBlocked = false;
    this.libraryRequest++;
    this.linkedTitleId = undefined;
    this.detailRequest++;
    this.selected = undefined;
    this.movie = null;
    this.selectedArtwork = null;
    this.detailLoading = false;
    this.detailError = "";
    this.renderRoot
      .querySelector<HTMLDialogElement>(".calendar-dialog")
      ?.close();
  }
  private closeDayPicker() {
    this.dayPicker = undefined;
    this.renderRoot.querySelector<HTMLDialogElement>(".day-picker")?.close();
    this.requestUpdate();
  }
  private mobileDayPicker() {
    return (
      window.matchMedia?.(
        "(max-width: 700px), (hover: none) and (pointer: coarse)",
      ).matches ?? window.innerWidth <= 700
    );
  }
  private async openDayPicker(date: Date, rows: CalendarViewing[]) {
    if (this.disabled || this.previewBlocked || rows.length < 2) return;
    this.closePreview();
    const picker = { date, rows };
    this.dayPicker = picker;
    this.requestUpdate();
    await this.updateComplete;
    if (this.isConnected && this.dayPicker === picker)
      this.renderRoot
        .querySelector<HTMLDialogElement>(".day-picker")
        ?.showModal();
  }
  private renderDayPicker() {
    const picker = this.dayPicker;
    if (!picker) return nothing;
    return html`<dialog
      class="day-picker"
      aria-label=${`Choose a viewing for ${picker.date.toLocaleDateString()}`}
      @click=${() => this.closeDayPicker()}
      @close=${() => {
        if (this.dayPicker === picker) this.closeDayPicker();
      }}
    >
      <div class="day-picker-grid">
        ${picker.rows.map(
          (row) =>
            html`<button
              type="button"
              class="day-picker-movie"
              aria-label=${`${row.title}, ${new Date(row.started_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
              ?disabled=${this.disabled}
              @click=${(event: MouseEvent) => {
                event.stopPropagation();
                this.closeDayPicker();
                void this.openViewing(row, row.artwork_key);
              }}
            >
              <span class="day-picker-art"
                ><kaleidescape-library-cover
                  .client=${this.client}
                  .scope=${this.scope}
                  .queue=${this.queue}
                  .artworkKey=${row.artwork_key}
                  .title=${row.title}
                  @access-denied=${() => this.fail({ code: "unauthorized" })}
                ></kaleidescape-library-cover
              ></span>
            </button>`,
        )}
      </div>
    </dialog>`;
  }
  private closePreview() {
    clearTimeout(this.previewTimer);
    clearTimeout(this.previewCloseTimer);
    this.previewRequest++;
    this.previewRow = undefined;
    this.previewMovie = undefined;
    this.previewError = "";
    this.previewAnchor = undefined;
    this.previewHovered =
      this.previewFocused =
      this.previewPopupHovered =
        false;
    this.requestUpdate();
  }
  private closePreviewWhenIdle() {
    clearTimeout(this.previewCloseTimer);
    if (
      !this.previewHovered &&
      !this.previewFocused &&
      !this.previewPopupHovered
    )
      this.previewCloseTimer = setTimeout(() => this.closePreview(), 150);
  }
  private async showPreview(row: CalendarViewing, anchor: HTMLElement) {
    if (
      !this.hoverPreview ||
      !this.client ||
      !this.scope ||
      this.disabled ||
      this.previewBlocked ||
      this.dayPicker
    )
      return;
    clearTimeout(this.previewCloseTimer);
    if (this.previewRow?.id === row.id && this.previewAnchor === anchor) return;
    clearTimeout(this.previewTimer);
    const generation = this.generation,
      request = ++this.previewRequest;
    this.previewRow = row;
    this.previewAnchor = anchor;
    this.previewMovie = undefined;
    this.previewError = "";
    this.requestUpdate();
    await this.updateComplete;
    if (
      generation !== this.generation ||
      request !== this.previewRequest ||
      !this.isConnected ||
      !this.hoverPreview
    )
      return;
    this.positionPreview();
    if (this.previewCache.has(row.id)) {
      this.previewMovie = this.previewCache.get(row.id);
      this.requestUpdate();
      await this.updateComplete;
      this.positionPreview();
      return;
    }
    this.previewTimer = setTimeout(async () => {
      try {
        const result = await this.client!.calendarDetails(this.scope!, row.id);
        if (
          generation !== this.generation ||
          request !== this.previewRequest ||
          !this.isConnected
        )
          return;
        this.previewMovie = result.movie;
        this.previewCache.set(row.id, result.movie);
      } catch (error) {
        if (
          generation !== this.generation ||
          request !== this.previewRequest ||
          !this.isConnected
        )
          return;
        if (errorCode(error) === "unauthorized") {
          this.fail(error);
          return;
        }
        this.previewError = "Movie details are unavailable.";
      }
      this.requestUpdate();
      await this.updateComplete;
      this.positionPreview();
    }, 180);
  }
  private positionPreview = () => {
    const popup = this.renderRoot.querySelector<HTMLElement>(".movie-preview");
    if (!popup || !this.previewAnchor || !this.previewRow) return;
    const viewport = window.visualViewport;
    const leftEdge = viewport?.offsetLeft ?? 0,
      topEdge = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? window.innerWidth,
      height = viewport?.height ?? window.innerHeight;
    const anchor = this.previewAnchor.getBoundingClientRect();
    popup.style.maxWidth = "";
    popup.style.maxHeight = "";
    const box = popup.getBoundingClientRect();
    const position = previewPosition(anchor, box, {
      left: leftEdge,
      top: topEdge,
      width,
      height,
    });
    popup.style.visibility = position ? "" : "hidden";
    if (!position) return;
    popup.style.maxWidth = `${position.maxWidth}px`;
    popup.style.maxHeight = `${position.maxHeight}px`;
    const fitted = popup.getBoundingClientRect();
    popup.style.left = `${position.side === "left" ? position.right - fitted.width : Math.min(position.left, position.right - fitted.width)}px`;
    popup.style.top = `${position.side === "above" ? position.bottom - fitted.height : Math.min(position.top, position.bottom - fitted.height)}px`;
  };
  private renderPreview() {
    const row = this.previewRow;
    if (!row || !this.hoverPreview) return nothing;
    const movie = this.previewMovie;
    const runtime = movie?.duration_seconds ?? row.duration_seconds;
    return html`<div
      id="calendar-movie-preview"
      class="movie-preview"
      role="tooltip"
      @pointerenter=${() => {
        this.previewPopupHovered = true;
        clearTimeout(this.previewCloseTimer);
      }}
      @pointerleave=${() => {
        this.previewPopupHovered = false;
        this.closePreviewWhenIdle();
      }}
    >
      <strong>${row.title}</strong>
      ${this.previewMovie === undefined && !this.previewError ? html`<p>Loading movie details…</p>` : nothing}
      ${this.previewError ? html`<p>${this.previewError}</p>` : nothing}
      ${
        this.previewMovie !== undefined
          ? html`
              <p>
                <strong>Rating:</strong> ${movie?.rating || "—"} ·
                <strong>Runtime:</strong>
                ${runtime == null ? "—" : `${Math.round(runtime / 60)} min`}
              </p>
              <p><strong>Genre:</strong> ${movie?.genres?.join(", ") || "—"}</p>
              <p>
                <strong>Cast:</strong>
                ${movie?.actors?.slice(0, 5).join(", ") || "—"}
              </p>
              <p><strong>Synopsis:</strong> ${movie?.synopsis || "—"}</p>
            `
          : nothing
      }
    </div>`;
  }
  async openViewing(row: ViewingSummary, artwork: string | null = null) {
    if (!this.client || !this.scope) return;
    this.previewBlocked = true;
    this.closeDayPicker();
    this.closePreview();
    const generation = this.generation,
      request = ++this.detailRequest;
    this.selected = row;
    this.selectedArtwork = artwork;
    this.movie = null;
    this.detailLoading = true;
    this.detailError = "";
    this.requestUpdate();
    await this.updateComplete;
    if (
      generation !== this.generation ||
      request !== this.detailRequest ||
      !this.isConnected
    )
      return;
    if (
      unifiedMovieDialog() &&
      !this.detailsOnly &&
      this.scope.library_enabled
    ) {
      try {
        const result = await this.client.viewingLibrary(this.scope, row.id);
        if (
          generation !== this.generation ||
          request !== this.detailRequest ||
          !this.isConnected
        )
          return;
        if (result.library && unifiedMovieDialog()) {
          this.linkedTitleId = result.library.title_id;
          this.detailLoading = false;
          this.requestUpdate();
          return;
        }
      } catch (error) {
        if (generation !== this.generation || request !== this.detailRequest)
          return;
        if (errorCode(error) === "unauthorized") {
          this.fail(error);
          return;
        }
        this.detailError = errorMessage(error);
      }
    }
    this.renderRoot
      .querySelector<HTMLDialogElement>(".calendar-dialog")
      ?.showModal();
    try {
      const result = await this.client.calendarDetails(this.scope, row.id);
      if (generation === this.generation && request === this.detailRequest) {
        this.selected = result.viewing;
        this.movie = result.movie;
        this.selectedArtwork = result.movie?.artwork_key ?? artwork;
      }
    } catch (error) {
      if (generation === this.generation && request === this.detailRequest) {
        if (errorCode(error) === "unauthorized") this.fail(error);
        else this.detailError = errorMessage(error);
      }
    } finally {
      if (generation === this.generation && request === this.detailRequest) {
        this.detailLoading = false;
        this.requestUpdate();
      }
    }
  }
  private async openLibraryTitle(replaceCompact = false) {
    if (
      !this.client ||
      !this.scope?.library_enabled ||
      !this.selected ||
      this.detailsOnly
    )
      return;
    const generation = this.generation,
      request = ++this.libraryRequest;
    try {
      const result = await this.client.viewingLibrary(
        this.scope,
        this.selected.id,
      );
      if (
        generation !== this.generation ||
        request !== this.libraryRequest ||
        !this.isConnected ||
        (replaceCompact && !unifiedMovieDialog())
      )
        return;
      if (result.library) {
        if (replaceCompact) {
          const dialog =
            this.renderRoot.querySelector<HTMLDialogElement>(
              ".calendar-dialog",
            );
          if (dialog?.open) {
            this.preserveDetailOnClose = true;
            dialog.close();
          }
        }
        this.linkedTitleId = result.library.title_id;
        this.requestUpdate();
      } else {
        this.detailError = "No linked Library entry is available.";
        this.requestUpdate();
      }
    } catch (error) {
      if (generation !== this.generation || request !== this.libraryRequest)
        return;
      if (errorCode(error) === "unauthorized") this.fail(error);
      else {
        this.detailError = errorMessage(error);
        this.requestUpdate();
      }
    }
  }
  private browse(key: LibraryCriterion["key"], value: string) {
    if (!this.scope?.library_enabled || !this.movie) return;
    this.closeDetails();
    this.dispatchEvent(
      new CustomEvent<LibraryCriterion>("browse-library", {
        detail: { key, value },
        bubbles: true,
        composed: true,
      }),
    );
    this.requestUpdate();
  }
  private editViewing() {
    if (
      !this.selected ||
      !this.editable ||
      !this.scope?.permissions.edit ||
      this.disabled ||
      this.detailLoading
    )
      return;
    const id = this.selected.id;
    this.closeDetails();
    this.dispatchEvent(
      new CustomEvent<string>("edit-viewing", {
        detail: id,
        bubbles: true,
        composed: true,
      }),
    );
    this.requestUpdate();
  }
  private detailLink(key: LibraryCriterion["key"], value: string) {
    if (this.detailsOnly) return value;
    return html`<button
      type="button"
      class="link detail-link"
      @click=${() => this.browse(key, key === "query" ? JSON.stringify(value) : value)}
    >
      ${value}
    </button>`;
  }
  private renderDetails() {
    const viewing = this.selected,
      movie = this.movie;
    const start = viewing ? new Date(viewing.started_at) : null;
    const endpoint = viewing?.ended_at ?? viewing?.completed_at;
    const end = endpoint ? new Date(endpoint) : null;
    const different = start && end && dayKey(start) !== dayKey(end);
    const runtime = movie?.duration_seconds ?? viewing?.duration_seconds;
    return html`<dialog
        class="database-dialog calendar-dialog"
        aria-labelledby="calendar-movie-title"
        @click=${dismissBackdrop}
        @close=${(event: Event) => {
          if (!(event.target as HTMLDialogElement).open) {
            if (this.preserveDetailOnClose) {
              this.preserveDetailOnClose = false;
              return;
            }
            this.closeDetails();
            this.requestUpdate();
          }
        }}
      >
        <div class="card-head">
          <h2 id="calendar-movie-title">
            ${viewing && movie && !this.detailsOnly ? html`<button type="button" class="link detail-link" @click=${() => void this.openLibraryTitle()}>${viewing.title}</button>` : (viewing?.title ?? "Viewing details")}
          </h2>
          ${closeButton(() => {
            this.closeDetails();
            this.requestUpdate();
          })}
        </div>
        ${
          viewing
            ? html`<div class="movie-detail">
                <kaleidescape-library-cover
                  .client=${this.client}
                  .scope=${this.scope}
                  .queue=${this.queue}
                  .artworkKey=${this.selectedArtwork}
                  .title=${viewing.title}
                  @access-denied=${() => this.fail({ code: "unauthorized" })}
                ></kaleidescape-library-cover>
                <div>
                  ${this.detailLoading ? html`<p role="status">Loading movie details…</p>` : nothing}
                  ${this.detailError ? html`<p class="error" role="alert">${this.detailError} <button @click=${() => this.openViewing(viewing, this.selectedArtwork)}>Retry details</button></p>` : nothing}
                  ${
                    movie
                      ? html`<div class="detail-badges">
                            ${renderFormatBadges(movie, false, this.detailsOnly ? undefined : (value) => this.browse("format", value))}${renderRatingBadge(movie.rating ?? "", this.detailsOnly ? undefined : (value) => this.browse("rating", value))}
                          </div>
                          ${movie.year ? html`<p><strong>Year:</strong> ${this.detailLink("year", String(movie.year))}</p>` : nothing}
                          ${[
                            ["Cast", movie.actors],
                            ["Directors", movie.directors],
                            ["Genres", movie.genres],
                          ].map(([label, names]) =>
                            (names as string[] | null)?.length
                              ? html`<p>
                                  <strong>${label}:</strong>
                                  ${(names as string[]).map((name, index) => html`${index ? ", " : ""}${this.detailLink(label === "Genres" ? "genre" : "query", name)}`)}
                                </p>`
                              : nothing,
                          )}`
                      : !this.detailLoading && !this.detailError
                        ? html`<p class="muted">
                            No linked Library metadata is available.
                          </p>`
                        : nothing
                  }
                  ${runtime != null ? html`<p><strong>Runtime:</strong> ${(runtime / 60).toFixed(2)} min</p>` : nothing}
                  <p>
                    <strong
                      >${different ? "Viewing dates" : "Viewing date"}:</strong
                    >
                    ${start?.toLocaleDateString()}${different ? ` – ${end!.toLocaleDateString()}` : ""}
                  </p>
                  <p>
                    <strong>Watched:</strong>
                    ${(viewing.watched_seconds / 60).toFixed(2)} min ·
                    ${viewing.status === "completed" ? "Completed" : "Partial"}
                  </p>
                </div>
              </div>`
            : nothing
        }
        ${
          viewing && this.editable && this.scope?.permissions.edit
            ? html`<div class="dialog-footer">
                <button
                  class="primary"
                  ?disabled=${this.disabled || this.detailLoading}
                  @click=${this.editViewing}
                >
                  Edit viewing
                </button>
              </div>`
            : nothing
        }
      </dialog>
      ${
        this.linkedTitleId && !this.detailsOnly
          ? html`<kaleidescape-library
              .client=${this.client}
              .scope=${this.scope}
              .dialogOnly=${true}
              .advanced=${this.editable}
              .openTitleId=${this.linkedTitleId}
              @title-dialog-closed=${() => {
                if (this.linkedTitleId === undefined) return;
                this.previewBlocked = false;
                this.closePreview();
                this.linkedTitleId = undefined;
                this.requestUpdate();
              }}
              @title-dialog-error=${(event: CustomEvent<string>) => {
                this.previewBlocked = false;
                this.closePreview();
                this.linkedTitleId = undefined;
                this.detailError = event.detail;
                this.requestUpdate();
              }}
            ></kaleidescape-library>`
          : nothing
      }`;
  }
  protected render() {
    if (this.detailsOnly) return this.renderDetails();
    const year = this.month.getFullYear(),
      month = this.month.getMonth();
    const first = new Date(year, month, 1),
      days = new Date(year, month + 1, 0).getDate();
    const count = Math.ceil((first.getDay() + days) / 7) * 7;
    const cells = Array.from(
      { length: count },
      (_, index) => new Date(year, month, index - first.getDay() + 1),
    );
    const byDay = new Map<string, { row: CalendarViewing; phase: string }[]>();
    for (const row of this.items) {
      for (const { day, phase } of calendarDays(row))
        byDay.set(day, [...(byDay.get(day) ?? []), { row, phase }]);
    }
    return html`<div class="month-bar">
        <button
          aria-label="Previous month"
          ?disabled=${this.disabled || (year <= 100 && month === 0)}
          @click=${() => this.move(-1)}
        >
          ←
        </button>
        <slot name="mobile-add"></slot>
        <h2 aria-live="polite">
          <span class="month-full"
            >${this.month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span
          >
          <span class="month-compact"
            >${Array.from(
              this.month.toLocaleDateString(undefined, { month: "short" }),
            )
              .slice(0, 3)
              .join("")}
            ${year}</span
          >
        </h2>
        <button
          type="button"
          aria-label="Go to current month"
          ?disabled=${this.disabled}
          @click=${this.today}
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path
              d="M7 3v4M17 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01M16 17h.01"
            />
          </svg>
        </button>
        <slot name="mobile-options"></slot>
        <button
          aria-label="Next month"
          ?disabled=${this.disabled || (year >= 9998 && month === 11)}
          @click=${() => this.move(1)}
        >
          →
        </button>
      </div>
      <div class="calendar-scroll">
        <div
          class="month-grid"
          @pointerdown=${this.swipeDown}
          @pointermove=${this.swipeMove}
          @pointerup=${(event: PointerEvent) => this.swipeEnd(event)}
          @pointercancel=${(event: PointerEvent) => this.swipeEnd(event, true)}
          style=${`--calendar-day-size:${this.fitScreen ? this.fittedSize : this.daySize}px`}
          aria-label="Viewing calendar"
          aria-busy=${this.loading}
        >
          ${Array.from({ length: 7 }, (_, i) => html`<div class="weekday">${new Date(2023, 0, 1 + i).toLocaleDateString(undefined, { weekday: "short" })}</div>`)}
          ${cells.map((date) => {
            const key = dayKey(date),
              rows = byDay.get(key) ?? [];
            return html`<section
              class=${`day${date.getMonth() !== month ? " other-month" : ""}${key === dayKey(new Date()) ? " today" : ""}`}
              aria-label=${date.toLocaleDateString()}
              @click=${(event: MouseEvent) => {
                if (this.suppressSwipeClick && event.detail !== 0) {
                  event.preventDefault();
                  return;
                }
                if (rows.length > 1 && this.mobileDayPicker())
                  void this.openDayPicker(
                    date,
                    rows.map(({ row }) => row),
                  );
              }}
            >
              <time
                datetime=${key}
                aria-current=${key === dayKey(new Date()) ? "date" : nothing}
                >${date.getDate()}</time
              >
              ${
                rows.length
                  ? html`<div
                      class="cover-stack"
                      style=${`--spread:${1 + (rows.length - 1) * 0.15}`}
                    >
                      ${repeat(
                        rows,
                        ({ row }) => row.id,
                        ({ row, phase }, index) =>
                          html`<button
                            class=${`poster poster-${phase}`}
                            style=${`--index:${index};--layer:${index + 1}`}
                            aria-label=${`${row.title} · ${phase === "start" ? "Started; completed on another day" : phase === "completion" ? "Completed; started on another day" : row.status === "completed" ? "Completed" : "Partial"}`}
                            title=${this.hoverPreview ? nothing : row.title}
                            aria-describedby=${this.previewRow?.id === row.id && this.previewAnchor ? "calendar-movie-preview" : nothing}
                            ?disabled=${this.disabled}
                            @pointerenter=${(event: PointerEvent) => {
                              if (
                                event.pointerType === "touch" ||
                                this.previewBlocked ||
                                !this.hoverPreview
                              )
                                return;
                              const anchor = event.currentTarget as HTMLElement;
                              if (this.previewAnchor !== anchor)
                                this.previewFocused = false;
                              this.previewHovered = true;
                              void this.showPreview(row, anchor);
                            }}
                            @pointerleave=${(event: PointerEvent) => {
                              if (this.previewAnchor !== event.currentTarget)
                                return;
                              this.previewHovered = false;
                              if (
                                this.previewPointerAnchor ===
                                event.currentTarget
                              )
                                this.previewFocused = false;
                              this.closePreviewWhenIdle();
                            }}
                            @pointerdown=${(event: PointerEvent) => {
                              this.previewPointerAnchor =
                                event.currentTarget as HTMLElement;
                            }}
                            @focus=${(event: FocusEvent) => {
                              if (
                                this.previewBlocked ||
                                !this.hoverPreview ||
                                this.previewPointerAnchor ===
                                  event.currentTarget
                              )
                                return;
                              this.previewFocused = true;
                              void this.showPreview(
                                row,
                                event.currentTarget as HTMLElement,
                              );
                            }}
                            @blur=${(event: FocusEvent) => {
                              if (this.previewAnchor !== event.currentTarget)
                                return;
                              this.previewFocused = false;
                              this.closePreviewWhenIdle();
                            }}
                            @click=${(event: MouseEvent) => {
                              event.stopPropagation();
                              if (
                                this.suppressSwipeClick &&
                                event.detail !== 0
                              ) {
                                event.preventDefault();
                                return;
                              }
                              if (rows.length > 1 && this.mobileDayPicker()) {
                                void this.openDayPicker(
                                  date,
                                  rows.map(({ row }) => row),
                                );
                                return;
                              }
                              this.closePreview();
                              void this.openViewing(row, row.artwork_key);
                            }}
                          >
                            <span class="poster-art"
                              ><kaleidescape-library-cover
                                .client=${this.client}
                                .scope=${this.scope}
                                .queue=${this.queue}
                                .artworkKey=${row.artwork_key}
                                .title=${row.title}
                                @access-denied=${() => this.fail({ code: "unauthorized" })}
                              ></kaleidescape-library-cover>
                              ${!row.artwork_key ? html`<span class="poster-title">${row.title}</span>` : nothing}</span
                            >
                          </button>`,
                      )}
                    </div>`
                  : nothing
              }
            </section>`;
          })}
        </div>
      </div>
      ${this.renderPreview()} ${this.renderDetails()} ${this.renderDayPicker()}`;
  }
}
if (!customElements.get("kaleidescape-journal-calendar"))
  customElements.define("kaleidescape-journal-calendar", JournalCalendar);
