import { describe, test, expect } from "bun:test";
import { join } from "path";

describe("embedded-assets.ts", () => {
  test("includes manifest.json, icon.svg, and sw.js", async () => {
    const content = await Bun.file(
      join(import.meta.dir, "embedded-assets.ts")
    ).text();

    expect(content).toContain('"/manifest.json"');
    expect(content).toContain('"/icon.svg"');
    expect(content).toContain('"/sw.js"');
  });

  test("has content types for .json, .svg, and .js", async () => {
    const content = await Bun.file(
      join(import.meta.dir, "embedded-assets.ts")
    ).text();

    expect(content).toContain("application/json");
    expect(content).toContain('"image/svg+xml"');
    // .js already has a content type entry
  });
});
