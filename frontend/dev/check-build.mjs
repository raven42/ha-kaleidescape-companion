/** Rebuild in temporary storage and compare without changing accepted assets. */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import config from "../vite.config.mjs";

const output = await mkdtemp(join(tmpdir(), "companion-build-check-"));
try {
  await build({
    ...config,
    configFile: false,
    build: { ...config.build, outDir: output },
  });
  const [generated, packaged] = await Promise.all([
    readFile(join(output, "panel.js")),
    readFile(
      new URL(
        "../../custom_components/kaleidescape_companion/ui/assets/panel.js",
        import.meta.url,
      ),
    ),
  ]);
  if (!generated.equals(packaged)) {
    console.error(
      "Packaged panel.js differs from source. Run scripts/build and review the generated change.",
    );
    process.exitCode = 1;
  } else {
    console.log("Packaged panel.js matches source.");
  }
} finally {
  await rm(output, { recursive: true, force: true });
}
