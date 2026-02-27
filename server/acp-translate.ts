import type { SessionUpdate } from "@agentclientprotocol/sdk";
import type { ServerCommand, EventPayload } from "./types.ts";

/**
 * Translates an ACP SessionUpdate into zero or more server commands.
 * Pure function — no side effects.
 *
 * During replay (isReplay=true), user_message_chunk returns an EventPayload
 * instead of a command — the bridge uses appendReplay for these.
 *
 * @param isReplay — true when replaying a loaded session
 */
export function translateAcpToCommands(update: SessionUpdate, isReplay = false): (ServerCommand | EventPayload)[] {
  switch (update.sessionUpdate) {
    case "agent_message_chunk": {
      const content = update.content;
      if (content.type === "text") {
        return [{ type: "RecordAgentText", text: content.text }];
      }
      return [];
    }

    case "tool_call": {
      return [
        {
          type: "RecordToolCallStarted",
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
            type: "RecordToolCallCompleted",
            toolCallId: update.toolCallId,
            status: update.status,
            output: update.rawOutput,
          },
        ];
      }
      return [
        {
          type: "RecordToolCallUpdated",
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
        type: "RecordPlanUpdated",
        entries: update.entries.map(e => ({
          content: e.content,
          status: e.status,
          priority: e.priority,
        })),
      }];

    case "agent_thought_chunk": {
      const content = update.content;
      if (content.type === "text") {
        return [{ type: "RecordAgentThought", text: content.text }];
      }
      return [];
    }

    case "usage_update":
      return [{
        type: "RecordUsageUpdated",
        size: update.size,
        used: update.used,
        ...(update.cost ? { costAmount: update.cost.amount, costCurrency: update.cost.currency } : {}),
      }];

    case "session_info_update":
      return [{
        type: "RecordSessionInfoUpdated",
        title: update.title,
        updatedAt: update.updatedAt,
      }];

    case "current_mode_update":
    case "available_commands_update":
    case "config_option_update":
      return [];

    default:
      return [];
  }
}
