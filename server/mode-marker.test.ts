import { describe, test, expect } from "bun:test";
import { ModeMarkerDetector } from "./mode-marker.ts";

describe("ModeMarkerDetector", () => {
  test("passes through plain text with no marker", () => {
    const d = new ModeMarkerDetector();
    const result = d.push("Hello, world!");
    expect(result.text).toBe("Hello, world!");
    expect(result.modeIds).toEqual([]);
  });

  test("extracts a complete marker in a single chunk", () => {
    const d = new ModeMarkerDetector();
    const result = d.push("Here we go\n[conclave:mode requirements]\nNow analyzing...");
    expect(result.text).toBe("Here we go\nNow analyzing...");
    expect(result.modeIds).toEqual(["requirements"]);
  });

  test("extracts marker at the start of text", () => {
    const d = new ModeMarkerDetector();
    const result = d.push("[conclave:mode requirements]\nHere are the use cases:");
    expect(result.text).toBe("Here are the use cases:");
    expect(result.modeIds).toEqual(["requirements"]);
  });

  test("extracts marker at the end of text", () => {
    const d = new ModeMarkerDetector();
    const result = d.push("Switching modes now.\n[conclave:mode chat]");
    expect(result.text).toBe("Switching modes now.\n");
    expect(result.modeIds).toEqual(["chat"]);
  });

  test("handles marker split across two chunks", () => {
    const d = new ModeMarkerDetector();

    const r1 = d.push("Switching to requirements [conclave:mo");
    // The partial marker should be buffered, safe text emitted
    expect(r1.modeIds).toEqual([]);
    expect(r1.text).toBe("Switching to requirements ");

    const r2 = d.push("de requirements]\nHere are the results");
    expect(r2.modeIds).toEqual(["requirements"]);
    expect(r2.text).toBe("Here are the results");
  });

  test("handles marker split across three chunks", () => {
    const d = new ModeMarkerDetector();

    const r1 = d.push("Hello [conc");
    expect(r1.text).toBe("Hello ");
    expect(r1.modeIds).toEqual([]);

    const r2 = d.push("lave:mode ");
    expect(r2.text).toBe("");
    expect(r2.modeIds).toEqual([]);

    const r3 = d.push("requirements]\nDone");
    expect(r3.text).toBe("Done");
    expect(r3.modeIds).toEqual(["requirements"]);
  });

  test("extracts multiple markers in one chunk", () => {
    const d = new ModeMarkerDetector();
    const result = d.push("[conclave:mode requirements]\nAnalysis\n[conclave:mode chat]\nBack to chat");
    expect(result.modeIds).toEqual(["requirements", "chat"]);
    expect(result.text).toBe("Analysis\nBack to chat");
  });

  test("flush emits remaining buffer as plain text", () => {
    const d = new ModeMarkerDetector();

    const r1 = d.push("Partial [conc");
    expect(r1.text).toBe("Partial ");

    // If the turn completes, the partial isn't a real marker — flush it
    const r2 = d.flush();
    expect(r2.text).toBe("[conc");
    expect(r2.modeIds).toEqual([]);
  });

  test("handles single [ at end of chunk", () => {
    const d = new ModeMarkerDetector();

    const r1 = d.push("Text ending with [");
    expect(r1.text).toBe("Text ending with ");
    expect(r1.modeIds).toEqual([]);

    // Next chunk is normal text — the [ wasn't a marker
    const r2 = d.push("not a marker]");
    expect(r2.text).toBe("[not a marker]");
    expect(r2.modeIds).toEqual([]);
  });

  test("mode id with hyphens and numbers", () => {
    const d = new ModeMarkerDetector();
    const result = d.push("[conclave:mode my-mode-2]");
    expect(result.modeIds).toEqual(["my-mode-2"]);
    expect(result.text).toBe("");
  });

  test("strips trailing newline after marker", () => {
    const d = new ModeMarkerDetector();
    const result = d.push("[conclave:mode requirements]\nContent after");
    expect(result.text).toBe("Content after");
    expect(result.modeIds).toEqual(["requirements"]);
  });

  test("marker-only chunk produces empty text", () => {
    const d = new ModeMarkerDetector();
    const result = d.push("[conclave:mode requirements]");
    expect(result.text).toBe("");
    expect(result.modeIds).toEqual(["requirements"]);
  });
});
