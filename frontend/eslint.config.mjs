import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import ts from "typescript-eslint";

export default defineConfig([
  { ignores: ["dist/**", "node_modules/**"] },
  {
    files: ["**/*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["**/*.{ts,mts}"],
    extends: [js.configs.recommended, ts.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
]);
