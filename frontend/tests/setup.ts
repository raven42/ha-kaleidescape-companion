import { afterEach, beforeEach, expect, vi } from "vitest";

// Tests intentionally use Lit's development build. Silence only its startup
// banner; keep lifecycle, template and compatibility diagnostics enabled.
const lit = globalThis as typeof globalThis & {
  litIssuedWarnings?: Set<string>;
};
(lit.litIssuedWarnings ??= new Set()).add("dev-mode");

const warnings: unknown[][] = [],
  errors: unknown[][] = [];
const warn = console.warn.bind(console),
  error = console.error.bind(console);

// Each simulated page starts at a fresh URL; navigation tests opt into restoration.
beforeEach(() => {
  history.replaceState(null, "", "/");
  warnings.length = errors.length = 0;
  vi.spyOn(console, "warn").mockImplementation((...args) => {
    warnings.push(args);
    warn(...args);
  });
  vi.spyOn(console, "error").mockImplementation((...args) => {
    errors.push(args);
    error(...args);
  });
});
afterEach(() => {
  // Unexpected console output is a failed check, not noise to blanket-filter.
  expect(warnings, "Unexpected console warnings").toEqual([]);
  expect(errors, "Unexpected console errors").toEqual([]);
});
