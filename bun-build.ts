import { join } from "path";
import { watch } from "fs";

const distDir = join(import.meta.dir, "dist");
const clientDir = join(import.meta.dir, "client");
const watchMode = process.argv.includes("--watch");

async function copyAssets() {
  const html = await Bun.file(join(clientDir, "index.html")).text();
  await Bun.write(join(distDir, "index.html"), html);

  const css = await Bun.file(join(clientDir, "style.css")).text();
  await Bun.write(join(distDir, "style.css"), css);
}

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
    return false;
  }

  await copyAssets();

  console.log("Build complete. Output in dist/");
  for (const output of result.outputs) {
    console.log(`  ${output.path}`);
  }
  return true;
}

const ok = await build();

if (!watchMode) {
  if (!ok) process.exit(1);
} else {
  console.log("Watching client/ for changes...");
  let timer: ReturnType<typeof setTimeout> | null = null;

  watch(clientDir, { recursive: true }, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => build(), 200);
  });
}
