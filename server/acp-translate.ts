import type { SessionUpdate } from "@agentclientprotocol/sdk";
import type { EventPayload } from "./types.ts";

/**
 * Translates an ACP SessionUpdate into zero or more domain event payloads.
 * Pure function — no side effects.
 *
 * @param isReplay — true when replaying a loaded session (user_message_chunk → PromptSubmitted)
 */
export function translateAcpUpdate(update: SessionUpdate, isReplay = false): EventPayload[] {
  switch (update.sessionUpdate) {
    case "agent_message_chunk": {
      const content = update.content;
      if (content.type === "text") {
        return [{ type: "AgentText", text: content.text }];
      }
      return [];
    }

    case "tool_call": {
      return [
        {
          type: "ToolCallStarted",
          toolCallId: update.toolCallId,
          toolName: update.title,
          kind: update.kind,
          input: update.rawInput,
        },
      ];
    }

    case "tool_call_update": {
      if (
        update.status === "completed" ||
        update.status === "failed"
      ) {
        return [
          {
            type: "ToolCallCompleted",
            toolCallId: update.toolCallId,
            status: update.status,
            output: update.rawOutput,
          },
        ];
      }
      return [
        {
          type: "ToolCallUpdated",
          toolCallId: update.toolCallId,
          status: update.status ?? "in_progress",
          content: update.content,
        },
      ];
    }

    case "user_message_chunk": {
      if (!isReplay) return [];
      const content = update.content;
      if (content.type === "text") {
        return [{ type: "PromptSubmitted", text: content.text }];
      }
      if (content.type === "image") {
        return [{ type: "PromptSubmitted", text: "", images: [{ data: content.data, mimeType: content.mimeType }] }];
      }
      return [];
    }

    case "plan":
      return [{
        type: "PlanUpdated",
        entries: update.entries.map(e => ({
          content: e.content,
          status: e.status,
          priority: e.priority,
        })),
      }];

    case "current_mode_update":
      return [{ type: "ModeChanged", modeId: update.currentModeId }];

    case "agent_thought_chunk":
    case "available_commands_update":
    case "config_option_update":
    case "session_info_update":
    case "usage_update":
      return [];

    default:
      return [];
  }
}
