/** Simulated interaction/geometry checks; visual browser review is manual. */
import { afterEach, expect, it, vi } from "vitest";
import { SettingsHint } from "../src/ui/settings-hint";

const elements: SettingsHint[] = [];
afterEach(() => {
  elements.forEach((element) => element.remove());
  elements.length = 0;
  vi.restoreAllMocks();
});
async function mount() {
  const element = new SettingsHint();
  element.label = "Resume window";
  element.hint = "Combine partial viewings. <b>Plain text only.</b>";
  elements.push(element);
  document.body.append(element);
  await element.updateComplete;
  return {
    element,
    button: element.shadowRoot!.querySelector("button")!,
    balloon:
      element.shadowRoot!.querySelector<HTMLElement>('[role="tooltip"]')!,
    wrapper: element.shadowRoot!.querySelector("span")!,
  };
}
it("offers hover and keyboard help, dismisses on Escape and renders text safely", async () => {
  const { element, button, balloon, wrapper } = await mount();
  expect(balloon.hidden).toBe(true);
  wrapper.dispatchEvent(
    new PointerEvent("pointerenter", { pointerType: "mouse" }),
  );
  await element.updateComplete;
  expect(balloon.hidden).toBe(false);
  expect(balloon.querySelector("b")).toBeNull();
  expect(balloon.textContent).toContain("<b>Plain text only.</b>");
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  await element.updateComplete;
  expect(balloon.hidden).toBe(true);
  button.focus();
  await element.updateComplete;
  expect(balloon.hidden).toBe(false);
  expect(button.getAttribute("aria-label")).toBe("Help for Resume window");
  expect(button.getAttribute("aria-describedby")).toBe(balloon.id);
});
it("pins on tap, closes on a second tap/outside interaction and keeps one hint open", async () => {
  const first = await mount();
  first.button.click();
  await first.element.updateComplete;
  expect(first.balloon.hidden).toBe(false);
  first.button.click();
  await first.element.updateComplete;
  expect(first.balloon.hidden).toBe(true);
  first.button.click();
  await first.element.updateComplete;
  const second = await mount();
  second.button.click();
  await second.element.updateComplete;
  await first.element.updateComplete;
  expect(first.balloon.hidden).toBe(true);
  expect(second.balloon.hidden).toBe(false);
  document.body.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true }),
  );
  await second.element.updateComplete;
  expect(second.balloon.hidden).toBe(true);
});
it("places help inside a narrow viewport and above a low trigger", async () => {
  const { element, button, balloon } = await mount();
  vi.spyOn(window, "innerWidth", "get").mockReturnValue(360);
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(640);
  vi.spyOn(button, "getBoundingClientRect").mockReturnValue(
    new DOMRect(320, 580, 28, 28),
  );
  vi.spyOn(balloon, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 320, 100),
  );
  button.click();
  await element.updateComplete;
  expect(Number.parseFloat(balloon.style.left)).toBeGreaterThanOrEqual(12);
  expect(
    Number.parseFloat(balloon.style.left) +
      Number.parseFloat(balloon.style.width),
  ).toBeLessThanOrEqual(348);
  expect(Number.parseFloat(balloon.style.top)).toBeLessThan(580);
  expect(balloon.hasAttribute("data-above")).toBe(true);
});
