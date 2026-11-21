/** Shared, source-scoped hover timing and movie preview presentation. */
import { css, html } from "lit";
import type { CalendarMovie } from "../core/api";

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

export class HoverGate<T> {
  private generation = 0;
  private loadTimer?: ReturnType<typeof setTimeout>;
  private showTimer?: ReturnType<typeof setTimeout>;
  cancel() {
    this.generation++;
    clearTimeout(this.loadTimer);
    clearTimeout(this.showTimer);
  }
  start(
    load: () => Promise<T>,
    show: (value: T) => void,
    fail: (error: unknown) => void,
    hover = true,
  ) {
    this.cancel();
    const generation = this.generation;
    let elapsed = !hover;
    let result: { value: T } | { error: unknown } | undefined;
    const finish = () => {
      if (generation !== this.generation || !elapsed || !result) return;
      if ("value" in result) show(result.value);
      else fail(result.error);
    };
    const fetch = () => {
      void Promise.resolve()
        .then(load)
        .then(
          (value) => {
            result = { value };
            finish();
          },
          (error: unknown) => {
            result = { error };
            finish();
          },
        );
    };
    if (hover) {
      this.loadTimer = setTimeout(fetch, 400);
      this.showTimer = setTimeout(() => {
        elapsed = true;
        finish();
      }, 500);
    } else fetch();
  }
}
export function previewContent(
  title: string,
  movie: Pick<
    CalendarMovie,
    "rating" | "duration_seconds" | "genres" | "actors" | "synopsis"
  > | null,
  error = "",
  fallbackRuntime: number | null = null,
) {
  const runtime = movie?.duration_seconds ?? fallbackRuntime;
  return html`<strong>${title}</strong> ${
      error
        ? html`<p>${error}</p>`
        : html`<p>
              <strong>Rating:</strong> ${movie?.rating || "—"} ·
              <strong>Runtime:</strong>
              ${runtime == null ? "—" : `${Math.round(runtime / 60)} min`}
            </p>
            <p><strong>Genre:</strong> ${movie?.genres?.join(", ") || "—"}</p>
            <p>
              <strong>Cast:</strong>
              ${movie?.actors?.slice(0, 5).join(", ") || "—"}
            </p>
            <p><strong>Synopsis:</strong> ${movie?.synopsis || "—"}</p>`
    }`;
}
export function placePreview(popup: HTMLElement, anchor: HTMLElement) {
  const viewport = window.visualViewport;
  popup.style.maxWidth = "";
  popup.style.maxHeight = "";
  const position = previewPosition(
    anchor.getBoundingClientRect(),
    popup.getBoundingClientRect(),
    {
      left: viewport?.offsetLeft ?? 0,
      top: viewport?.offsetTop ?? 0,
      width: viewport?.width ?? window.innerWidth,
      height: viewport?.height ?? window.innerHeight,
    },
  );
  popup.style.visibility = position ? "" : "hidden";
  if (!position) return;
  popup.style.maxWidth = `${position.maxWidth}px`;
  popup.style.maxHeight = `${position.maxHeight}px`;
  const fitted = popup.getBoundingClientRect();
  popup.style.left = `${position.side === "left" ? position.right - fitted.width : Math.min(position.left, position.right - fitted.width)}px`;
  popup.style.top = `${position.side === "above" ? position.bottom - fitted.height : Math.min(position.top, position.bottom - fitted.height)}px`;
}
export const moviePreviewStyles = css`
  .movie-preview {
    position: fixed;
    z-index: 1200;
    width: min(320px, calc(100vw - 24px));
    max-height: min(360px, calc(100dvh - 24px));
    overflow: auto;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
    color: var(--primary-text-color, #20302c);
    box-shadow: 0 6px 24px #0005;
    font-size: 13px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  .movie-preview p {
    margin: 6px 0 0;
  }
`;
