import { afterEach, expect, it, vi } from "vitest";
import { connectDevelopment } from "../src/dev-connection";
import "../src/dev";
import type { KaleidescapeDevelopment } from "../src/dev";
import { FixtureTransport } from "./fixture";

vi.mock("../src/dev-connection", () => ({
  connectDevelopment: vi.fn(),
  DEVELOPMENT_HA: "http://127.0.0.1:8123",
}));
afterEach(() => document.body.replaceChildren());
it("clears the token input after submission and closes the session on leaving", async () => {
  const close = vi.fn();
  vi.mocked(connectDevelopment).mockResolvedValue({
    client: new FixtureTransport().client(),
    name: "Development User",
    close,
  });
  const app = document.createElement(
    "kaleidescape-dev",
  ) as KaleidescapeDevelopment;
  document.body.append(app);
  await app.updateComplete;
  const input = app.shadowRoot!.querySelector<HTMLInputElement>("#token")!;
  input.value = "fictional-token";
  app
    .shadowRoot!.querySelector("form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  expect(input.value).toBe("");
  await vi.waitFor(() =>
    expect(app.shadowRoot!.textContent).toContain("Development User"),
  );
  expect(app.shadowRoot!.textContent).not.toContain("fictional-token");
  window.dispatchEvent(new Event("pagehide"));
  await app.updateComplete;
  expect(close).toHaveBeenCalledOnce();
  expect(app.shadowRoot!.querySelector("kaleidescape-panel")).toBeNull();
  expect(app.shadowRoot!.querySelector<HTMLInputElement>("#token")!.value).toBe(
    "",
  );
});
