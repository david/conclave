import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { watchSpecs } from "./spec-watcher.ts";
import type { SpecInfo } from "./types.ts";

describe("watchSpecs", () => {
  let specsDir: string;

  beforeEach(async () => {
    specsDir = await mkdtemp(join(tmpdir(), "specs-watch-"));
  });

  afterEach(async () => {
    await rm(specsDir, { recursive: true, force: true });
  });

  test("fires onChange when a new spec directory is added", async () => {
    const results: SpecInfo[][] = [];
    const stop = watchSpecs(specsDir, (specs) => results.push(specs));

    try {
      // Add a spec directory with an analysis.md
      const specDir = join(specsDir, "new-feature");
      await mkdir(specDir);
      await writeFile(join(specDir, "analysis.md"), "# Analysis");

      // Wait for debounced callback
      await new Promise((r) => setTimeout(r, 500));

      expect(results.length).toBeGreaterThanOrEqual(1);
      const latest = results[results.length - 1];
      expect(latest).toHaveLength(1);
      expect(latest[0].name).toBe("new-feature");
      expect(latest[0].phase).toBe("analysis");
    } finally {
      stop();
    }
  });

  test("debounces rapid changes into a single callback", async () => {
    const results: SpecInfo[][] = [];
    const stop = watchSpecs(specsDir, (specs) => results.push(specs));

    try {
      // Rapid-fire changes
      const specDir = join(specsDir, "rapid-spec");
      await mkdir(specDir);
      await writeFile(join(specDir, "analysis.md"), "# A");
      await writeFile(join(specDir, "spec.json"), '{"description":"test"}');
      await writeFile(join(specDir, "implementation.md"), "# I");

      // Wait for debounce to settle
      await new Promise((r) => setTimeout(r, 500));

      // Should have coalesced into a small number of calls (ideally 1)
      expect(results.length).toBeLessThanOrEqual(2);
      const latest = results[results.length - 1];
      expect(latest).toHaveLength(1);
      expect(latest[0].phase).toBe("implementation");
    } finally {
      stop();
    }
  });

  test("fires onChange when a spec directory is deleted", async () => {
    // Pre-create a spec
    const specDir = join(specsDir, "to-delete");
    await mkdir(specDir);
    await writeFile(join(specDir, "analysis.md"), "# Analysis");

    const results: SpecInfo[][] = [];
    const stop = watchSpecs(specsDir, (specs) => results.push(specs));

    try {
      // Delete the spec directory
      await rm(specDir, { recursive: true, force: true });

      // Wait for debounced callback
      await new Promise((r) => setTimeout(r, 500));

      expect(results.length).toBeGreaterThanOrEqual(1);
      const latest = results[results.length - 1];
      expect(latest).toHaveLength(0);
    } finally {
      stop();
    }
  });
});
