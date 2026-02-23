import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { scanSpecs } from "./spec-scanner.ts";

describe("scanSpecs", () => {
  let specsDir: string;

  beforeEach(async () => {
    specsDir = await mkdtemp(join(tmpdir(), "specs-"));
  });

  afterEach(async () => {
    await rm(specsDir, { recursive: true, force: true });
  });

  test("empty specs directory returns []", async () => {
    const specs = await scanSpecs(specsDir);
    expect(specs).toEqual([]);
  });

  test("spec with only analysis.md has phase 'analysis'", async () => {
    const specDir = join(specsDir, "my-feature");
    await mkdir(specDir);
    await writeFile(join(specDir, "analysis.md"), "# Analysis");

    const specs = await scanSpecs(specsDir);
    expect(specs).toHaveLength(1);
    expect(specs[0].name).toBe("my-feature");
    expect(specs[0].phase).toBe("analysis");
  });

  test("spec with both breakdown.md and implementation.json has phase 'implementation'", async () => {
    const specDir = join(specsDir, "my-feature");
    await mkdir(specDir);
    await writeFile(join(specDir, "breakdown.md"), "# Breakdown");
    await writeFile(
      join(specDir, "implementation.json"),
      JSON.stringify({ tasks: [] }),
    );

    const specs = await scanSpecs(specsDir);
    expect(specs).toHaveLength(1);
    expect(specs[0].phase).toBe("implementation");
  });

  test("spec with only breakdown.md has phase 'breakdown'", async () => {
    const specDir = join(specsDir, "my-feature");
    await mkdir(specDir);
    await writeFile(join(specDir, "breakdown.md"), "# Breakdown");

    const specs = await scanSpecs(specsDir);
    expect(specs).toHaveLength(1);
    expect(specs[0].phase).toBe("breakdown");
  });

  test("spec with both breakdown.md and analysis.md has phase 'breakdown'", async () => {
    const specDir = join(specsDir, "my-feature");
    await mkdir(specDir);
    await writeFile(join(specDir, "analysis.md"), "# Analysis");
    await writeFile(join(specDir, "breakdown.md"), "# Breakdown");

    const specs = await scanSpecs(specsDir);
    expect(specs).toHaveLength(1);
    expect(specs[0].phase).toBe("breakdown");
  });

  test("spec with implementation.json and breakdown.md has phase 'implementation'", async () => {
    const specDir = join(specsDir, "my-feature");
    await mkdir(specDir);
    await writeFile(join(specDir, "breakdown.md"), "# Breakdown");
    await writeFile(
      join(specDir, "implementation.json"),
      JSON.stringify({ tasks: [] }),
    );

    const specs = await scanSpecs(specsDir);
    expect(specs).toHaveLength(1);
    expect(specs[0].phase).toBe("implementation");
  });

  test("spec with only implementation.json has phase 'implementation'", async () => {
    const specDir = join(specsDir, "my-feature");
    await mkdir(specDir);
    await writeFile(
      join(specDir, "implementation.json"),
      JSON.stringify({ tasks: [] }),
    );

    const specs = await scanSpecs(specsDir);
    expect(specs).toHaveLength(1);
    expect(specs[0].phase).toBe("implementation");
  });

  test("spec with only spec.json (no phase files) has phase null", async () => {
    const specDir = join(specsDir, "my-feature");
    await mkdir(specDir);
    await writeFile(
      join(specDir, "spec.json"),
      JSON.stringify({ description: "A feature" }),
    );

    const specs = await scanSpecs(specsDir);
    expect(specs).toHaveLength(1);
    expect(specs[0].phase).toBeNull();
    expect(specs[0].description).toBe("A feature");
  });

  test("spec.json with type 'epic' sets type to 'epic'", async () => {
    const specDir = join(specsDir, "my-epic");
    await mkdir(specDir);
    await writeFile(
      join(specDir, "spec.json"),
      JSON.stringify({ type: "epic", description: "An epic" }),
    );

    const specs = await scanSpecs(specsDir);
    expect(specs).toHaveLength(1);
    expect(specs[0].type).toBe("epic");
  });

  test("spec.json with epic field sets parent epic", async () => {
    const specDir = join(specsDir, "child-spec");
    await mkdir(specDir);
    await writeFile(
      join(specDir, "spec.json"),
      JSON.stringify({ epic: "my-epic", description: "A child" }),
    );

    const specs = await scanSpecs(specsDir);
    expect(specs).toHaveLength(1);
    expect(specs[0].epic).toBe("my-epic");
  });

  test("spec without spec.json has default values", async () => {
    const specDir = join(specsDir, "bare-spec");
    await mkdir(specDir);
    await writeFile(join(specDir, "analysis.md"), "# Analysis");

    const specs = await scanSpecs(specsDir);
    expect(specs).toHaveLength(1);
    expect(specs[0].name).toBe("bare-spec");
    expect(specs[0].description).toBeNull();
    expect(specs[0].type).toBe("spec");
    expect(specs[0].epic).toBeNull();
  });

  test("non-directory entries are ignored", async () => {
    // Create a plain file in the specs dir (not a subdirectory)
    await writeFile(join(specsDir, "stray-file.md"), "# Not a spec");
    const specDir = join(specsDir, "real-spec");
    await mkdir(specDir);
    await writeFile(join(specDir, "analysis.md"), "# Analysis");

    const specs = await scanSpecs(specsDir);
    expect(specs).toHaveLength(1);
    expect(specs[0].name).toBe("real-spec");
  });

  test("nonexistent directory returns []", async () => {
    const specs = await scanSpecs(join(specsDir, "does-not-exist"));
    expect(specs).toEqual([]);
  });
});
