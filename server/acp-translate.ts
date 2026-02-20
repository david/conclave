import type { SessionUpdate } from "@agentclientprotocol/sdk";
import type { EventPayload } from "./types.ts";

/**
 * Strip the mode preamble that gets prepended to prompts before sending to ACP.
 * Format: `[Mode: <label>]\n\n<instruction>\n\n[conclave:user]\n\n<user text>`
 * Returns the original user text if the marker is found, otherwise returns as-is.
 */
export function stripModePreamble(text: string): string {
  const sep = "\n\n[conclave:user]\n\n";
  const idx = text.indexOf(sep);
  if (idx === -1) return text;
  return text.slice(idx + sep.length);
}

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
        return [{ type: "PromptSubmitted", text: stripModePreamble(content.text) }];
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

    case "agent_thought_chunk": {
      const content = update.content;
      if (content.type === "text") {
        return [{ type: "AgentThought", text: content.text }];
      }
      return [];
    }

    case "usage_update":
      return [{
        type: "UsageUpdated",
        size: update.size,
        used: update.used,
        ...(update.cost ? { costAmount: update.cost.amount, costCurrency: update.cost.currency } : {}),
      }];

    case "session_info_update":
      return [{
        type: "SessionInfoUpdated",
        title: update.title,
        updatedAt: update.updatedAt,
      }];

    case "available_commands_update":
    case "config_option_update":
      return [];

    default:
      return [];
  }
}
