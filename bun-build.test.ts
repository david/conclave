import { describe, test, expect } from "bun:test";
import { join } from "path";

describe("bun-build.ts", () => {
  test("copyAssets copies sw.js to dist", async () => {
    const content = await Bun.file(join(import.meta.dir, "bun-build.ts")).text();
    expect(content).toContain("sw.js");
  });
});
