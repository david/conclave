import { watch, mkdirSync } from "fs";
import { scanSpecs } from "./spec-scanner.ts";
import type { SpecInfo } from "./types.ts";

export function watchSpecs(
  specsDir: string,
  onChange: (specs: SpecInfo[]) => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  mkdirSync(specsDir, { recursive: true });

  const watcher = watch(specsDir, { recursive: true }, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      const specs = await scanSpecs(specsDir);
      onChange(specs);
    }, 200);
  });

  watcher.on("error", () => {
    // Ignored — transient errors from deleted subdirectories
  });

  return () => {
    if (timer) clearTimeout(timer);
    watcher.close();
  };
}
