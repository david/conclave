import { describe, test, expect } from "bun:test";
import manifest from "./manifest.json";

const icons = manifest.icons as Array<{
  src: string;
  sizes: string;
  type: string;
}>;

describe("manifest.json icons", () => {
  test("contains a 192x192 icon entry", () => {
    const match = icons.filter((i) => i.sizes === "192x192");
    expect(match).toHaveLength(1);
    expect(match[0].src).toBe("/icon.svg");
    expect(match[0].type).toBe("image/svg+xml");
  });

  test("contains a 512x512 icon entry", () => {
    const match = icons.filter((i) => i.sizes === "512x512");
    expect(match).toHaveLength(1);
    expect(match[0].src).toBe("/icon.svg");
    expect(match[0].type).toBe("image/svg+xml");
  });
});
