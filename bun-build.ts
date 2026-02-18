import { join } from "path";

const distDir = join(import.meta.dir, "dist");

// Bundle the client
const result = await Bun.build({
  entrypoints: [join(import.meta.dir, "client", "index.tsx")],
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
  process.exit(1);
}

// Copy HTML
const html = await Bun.file(join(import.meta.dir, "client", "index.html")).text();
await Bun.write(join(distDir, "index.html"), html);

// Copy CSS
const css = await Bun.file(join(import.meta.dir, "client", "style.css")).text();
await Bun.write(join(distDir, "style.css"), css);

console.log("Build complete. Output in dist/");
for (const output of result.outputs) {
  console.log(`  ${output.path}`);
}
