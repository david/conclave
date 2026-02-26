import { describe, test, expect } from "bun:test";
import { join } from "path";

const clientDir = join(import.meta.dir);

describe("service worker", () => {
  test("sw.js exists and contains a fetch event listener", async () => {
    const content = await Bun.file(join(clientDir, "sw.js")).text();
    expect(content).toContain("fetch");
    expect(content).toMatch(/addEventListener\s*\(\s*['"]fetch['"]/);
  });

  test("index.html registers the service worker", async () => {
    const content = await Bun.file(join(clientDir, "index.html")).text();
    expect(content).toContain("serviceWorker");
    expect(content).toMatch(/navigator\.serviceWorker\.register\s*\(\s*['"]\/sw\.js['"]/);
  });
});
