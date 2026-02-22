import { describe, test, expect } from "bun:test";
import { runStartHook } from "./start-hook.ts";
import { join } from "path";
import { mkdtemp, rm, mkdir, writeFile, chmod } from "fs/promises";
import { tmpdir } from "os";

describe("runStartHook", () => {
  test("does not throw when hook file does not exist", () => {
    const fakePath = join(tmpdir(), "nonexistent-conclave-" + Date.now());
    expect(() => runStartHook(fakePath)).not.toThrow();
  });

  test("spawns the hook script when it exists", async () => {
    // Create a temp directory with .conclave/hooks/start
    const tempDir = await mkdtemp(join(tmpdir(), "conclave-hook-test-"));
    const hooksDir = join(tempDir, ".conclave", "hooks");
    await mkdir(hooksDir, { recursive: true });

    // The hook script writes a marker file so we can verify it ran
    const markerFile = join(tempDir, "hook-ran.marker");
    const hookPath = join(hooksDir, "start");
    await writeFile(hookPath, `#!/bin/sh\necho "hook executed" > "${markerFile}"\n`);
    await chmod(hookPath, 0o755);

    // Run the hook
    runStartHook(tempDir);

    // Wait a bit for the fire-and-forget process to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify the marker file was created
    const markerExists = await Bun.file(markerFile).exists();
    expect(markerExists).toBe(true);

    // Cleanup
    await rm(tempDir, { recursive: true, force: true });
  });
});
