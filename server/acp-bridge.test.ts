import { describe, test, expect } from "bun:test";
import { buildPromptBlocks } from "./acp-bridge.ts";

describe("buildPromptBlocks", () => {
  test("text only", () => {
    expect(buildPromptBlocks("hello")).toEqual([
      { type: "text", text: "hello" },
    ]);
  });

  test("images with no text gets a placeholder text block", () => {
    const images = [{ data: "abc", mimeType: "image/png" }];
    const blocks = buildPromptBlocks("", images);
    expect(blocks).toEqual([
      { type: "image", data: "abc", mimeType: "image/png" },
      { type: "text", text: "See image." },
    ]);
  });

  test("images with text uses the provided text", () => {
    const images = [{ data: "abc", mimeType: "image/png" }];
    expect(buildPromptBlocks("describe this", images)).toEqual([
      { type: "image", data: "abc", mimeType: "image/png" },
      { type: "text", text: "describe this" },
    ]);
  });

  test("empty text and no images returns empty array", () => {
    expect(buildPromptBlocks("")).toEqual([]);
    expect(buildPromptBlocks("", [])).toEqual([]);
  });

  test("multiple images without text gets single placeholder", () => {
    const images = [
      { data: "a", mimeType: "image/png" },
      { data: "b", mimeType: "image/jpeg" },
    ];
    const blocks = buildPromptBlocks("", images);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({ type: "image", data: "a", mimeType: "image/png" });
    expect(blocks[1]).toEqual({ type: "image", data: "b", mimeType: "image/jpeg" });
    expect(blocks[2]).toEqual({ type: "text", text: "See image." });
  });
});
