import type { ContentBlock, ToolCallInfo } from "../types.ts";

/** Append text to the last streaming block if it matches `blockType`, otherwise push a new block. */
export function appendStreamingText(
  streamingContent: ContentBlock[],
  blockType: "text" | "thought",
  text: string,
): ContentBlock[] {
  const content = [...streamingContent];
  const last = content[content.length - 1];
  if (last && last.type === blockType && "text" in last) {
    content[content.length - 1] = { type: blockType, text: last.text + text };
  } else {
    content.push({ type: blockType, text });
  }
  return content;
}

/** Find a tool call by ID in streaming content and patch it. */
export function patchToolCallInStream(
  streamingContent: ContentBlock[],
  toolCallId: string,
  patch: Partial<ToolCallInfo>,
): ContentBlock[] {
  return streamingContent.map((block) => {
    if (block.type === "tool_call" && block.toolCall.toolCallId === toolCallId) {
      return { type: "tool_call" as const, toolCall: { ...block.toolCall, ...patch } };
    }
    return block;
  });
}
