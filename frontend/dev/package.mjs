/** Copy the built panel into the integration's runtime package. */
import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
const source = new URL("frontend/dist/panel.js", root);
const destination = new URL(
  "custom_components/kaleidescape_companion/ui/assets/",
  root,
);
await mkdir(destination, { recursive: true });
await copyFile(source, new URL("panel.js", destination));
console.log(`Packaged ${fileURLToPath(new URL("panel.js", destination))}`);
