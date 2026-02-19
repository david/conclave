import { join } from "path";
import { watch } from "fs";

const distDir = join(import.meta.dir, "dist");
const clientDir = join(import.meta.dir, "client");
const watchMode = process.argv.includes("--watch");

async function build() {
  const result = await Bun.build({
    entrypoints: [join(clientDir, "index.tsx")],
    outdir: distDir,
    target: "browser",
    format: "esm",
    minify: false,
    sourcemap: "external",
  });

  if (!result.success) {
    console.error("Build failed:");
    for (const log of result.logs) {
      console.error(log);
    }
    if (!watchMode) process.exit(1);
    return;
  }

  // Copy HTML
  const html = await Bun.file(join(clientDir, "index.html")).text();
  await Bun.write(join(distDir, "index.html"), html);

  // Copy CSS
  const css = await Bun.file(join(clientDir, "style.css")).text();
  await Bun.write(join(distDir, "style.css"), css);

  // Signal build completion for live reload
  await Bun.write(join(distDir, ".build-stamp"), String(Date.now()));

  console.log("Build complete. Output in dist/");
  for (const output of result.outputs) {
    console.log(`  ${output.path}`);
  }
}

await build();

if (watchMode) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  console.log(`Watching ${clientDir} for changes...`);
  watch(clientDir, { recursive: true }, (_event, filename) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(async () => {
      console.log(`\nChange detected: ${filename}`);
      await build();
    }, 100);
  });
}
