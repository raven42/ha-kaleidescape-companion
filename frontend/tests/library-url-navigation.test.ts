import { afterEach, expect, it, vi } from "vitest";
import "../src/ui/panel";
import type { KaleidescapePanel } from "../src/ui/panel";
import type { KaleidescapeReader } from "../src/ui/reader";
import type { KaleidescapeLibrary } from "../src/library/library";
import { FixtureTransport } from "./fixture";

let parent: KaleidescapePanel | KaleidescapeReader;
afterEach(() => parent?.remove());
const link =
  "/kaleidescape-companion?companion_page=library&library_missing_metadata_artwork=1";
function library() {
  const root = parent.shadowRoot!;
  return (root.querySelector("kaleidescape-library") ??
    root
      .querySelector("kaleidescape-reader")
      ?.shadowRoot?.querySelector(
        "kaleidescape-library",
      )) as KaleidescapeLibrary | null;
}
function lastFilters(transport: FixtureTransport) {
  return transport.calls
    .filter((call) => call.type.endsWith("/library/list"))
    .at(-1)?.filters;
}

it.each([
  ["kaleidescape-panel", true],
  ["kaleidescape-panel", false],
  ["kaleidescape-reader", false],
] as const)(
  "opens the notification link in %s (advanced: %s) without saving filters",
  async (tag, advanced) => {
    history.replaceState(null, "", link);
    const transport = new FixtureTransport();
    transport.options.library_enabled = true;
    transport.interfacePreferences.advanced_view = advanced;
    transport.uiPreferences.query = "Old search";
    transport.uiPreferences.genre = ["Old genre"];
    transport.missingMetadataArtwork.add(transport.libraryTitles[0].id);
    parent = document.createElement(tag) as
      KaleidescapePanel | KaleidescapeReader;
    parent.client = transport.client();
    document.body.append(parent);
    await vi.waitFor(() =>
      expect(lastFilters(transport)).toMatchObject({
        query: "",
        genre: [],
        missing_metadata_artwork: true,
        offset: 0,
      }),
    );
    expect(library()).toBeTruthy();
    expect(transport.uiPreferences.query).toBe("Old search");
    expect(transport.uiPreferences.genre).toEqual(["Old genre"]);
    expect(
      transport.calls.filter(
        (call) =>
          call.type.endsWith("/ui/preferences/update") &&
          (!call.area || call.area === "library"),
      ),
    ).toHaveLength(0);
  },
);

it.each(["kaleidescape-panel", "kaleidescape-reader"] as const)(
  "handles a notification link while %s is already open",
  async (tag) => {
    history.replaceState(
      null,
      "",
      "/kaleidescape-companion?companion_page=journal",
    );
    const transport = new FixtureTransport();
    transport.options.library_enabled = true;
    parent = document.createElement(tag) as
      KaleidescapePanel | KaleidescapeReader;
    parent.client = transport.client();
    document.body.append(parent);
    await vi.waitFor(() =>
      expect(parent.shadowRoot!.textContent).toContain("The Lantern Voyage"),
    );
    history.pushState(null, "", link);
    window.dispatchEvent(new Event("location-changed"));
    await vi.waitFor(() =>
      expect(lastFilters(transport)).toMatchObject({
        missing_metadata_artwork: true,
      }),
    );
    const existing = library();
    history.pushState(
      null,
      "",
      "/kaleidescape-companion?companion_page=library&library_status=watched&library_query=Voyage",
    );
    window.dispatchEvent(new Event("location-changed"));
    await vi.waitFor(() =>
      expect(lastFilters(transport)).toMatchObject({
        missing_metadata_artwork: false,
        status: ["watched"],
        query: "Voyage",
      }),
    );
    expect(library()).toBe(existing);
    const requests = transport.calls.filter((call) =>
      call.type.endsWith("/library/list"),
    ).length;
    window.dispatchEvent(new Event("location-changed"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      transport.calls.filter((call) => call.type.endsWith("/library/list")),
    ).toHaveLength(requests);
  },
);
