// Embedded client assets for compiled binary distribution.
// These imports use { type: "file" } so bun --compile embeds them in the binary.
// At runtime, the paths point into Bun's virtual filesystem ($bunfs/).
//
// This module is only imported by the compile entrypoint (server/compile.ts),
// not by the dev entrypoint (server/index.ts), so the dist/ files don't need
// to exist during development.

// @ts-ignore — file imports resolved by bun bundler, not tsc
import indexHtml from "../dist/index.html" with { type: "file" };
// @ts-ignore
import indexJs from "../dist/index.js" with { type: "file" };
// @ts-ignore
import styleCss from "../dist/style.css" with { type: "file" };
// @ts-ignore
import manifestJson from "../dist/manifest.json" with { type: "file" };
// @ts-ignore
import iconSvg from "../dist/icon.svg" with { type: "file" };
// @ts-ignore
import swJs from "../dist/sw.js" with { type: "file" };

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const assets: Record<string, string> = {
  "/index.html": indexHtml,
  "/index.js": indexJs,
  "/style.css": styleCss,
  "/manifest.json": manifestJson,
  "/icon.svg": iconSvg,
  "/sw.js": swJs,
};

export function serveEmbeddedAsset(pathname: string): Response | null {
  const key = pathname === "/" ? "/index.html" : pathname;
  const filePath = assets[key];
  if (!filePath) return null;

  const ext = key.substring(key.lastIndexOf("."));
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";

  return new Response(Bun.file(filePath), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
    },
  });
}
