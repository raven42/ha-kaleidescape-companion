/** Simulated pointer activation; real-browser hover geometry is operator-reviewed. */
import { expect, it, vi } from "vitest";
import { render } from "lit";
import { iconAction, iconActionStyles } from "../src/ui/action-icons";

it("dismisses the action balloon on activation until a fresh hover", () => {
  const host = document.createElement("div");
  const activate = vi.fn();
  render(iconAction("Edit details", "edit", false, activate), host);
  const wrapper = host.querySelector<HTMLElement>(".icon-action-wrap")!;
  const button = host.querySelector("button")!;
  button.click();
  expect(activate).toHaveBeenCalledOnce();
  expect(wrapper.hasAttribute("data-tooltip-dismissed")).toBe(true);
  // Returning focus to the button must not use focus-within to force a balloon.
  expect(iconActionStyles.cssText).not.toContain(":focus-within");
  expect(iconActionStyles.cssText).toContain(":focus-visible");
  wrapper.dispatchEvent(new Event("pointerenter"));
  expect(wrapper.hasAttribute("data-tooltip-dismissed")).toBe(false);
  expect(button.getAttribute("aria-label")).toBe("Edit details");
});
