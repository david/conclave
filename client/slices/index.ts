import type { ClientEvent, AppState } from "../types.ts";
import { sessionInitiatedSlice } from "./session-initiated.ts";
import { sessionCreatedSlice } from "./session-created.ts";
import { sessionListSlice } from "./session-list.ts";
import { sessionInfoUpdatedSlice } from "./session-info-updated.ts";
import { sessionSwitchedSlice } from "./session-switched.ts";
import { planUpdatedSlice } from "./plan-updated.ts";
import { promptSubmittedSlice } from "./prompt-submitted.ts";
import { agentTextSlice } from "./agent-text.ts";
import { agentThoughtSlice } from "./agent-thought.ts";
import { toolCallStartedSlice } from "./tool-call-started.ts";
import { toolCallUpdatedSlice } from "./tool-call-updated.ts";
import { toolCallCompletedSlice } from "./tool-call-completed.ts";
import { turnCompletedSlice } from "./turn-completed.ts";
import { errorSlice } from "./error.ts";
import { usageUpdatedSlice } from "./usage-updated.ts";
import { specListUpdatedSlice } from "./spec-list-updated.ts";

const slices: Array<(state: AppState, event: ClientEvent) => AppState> = [
  sessionInitiatedSlice,
  sessionCreatedSlice,
  sessionListSlice,
  sessionInfoUpdatedSlice,
  sessionSwitchedSlice,
  planUpdatedSlice,
  promptSubmittedSlice,
  agentTextSlice,
  agentThoughtSlice,
  toolCallStartedSlice,
  toolCallUpdatedSlice,
  toolCallCompletedSlice,
  turnCompletedSlice,
  errorSlice,
  usageUpdatedSlice,
  specListUpdatedSlice,
];

/** Runs all client slices sequentially. */
export function combinedReducer(state: AppState, event: ClientEvent): AppState {
  return slices.reduce((s, slice) => slice(s, event), state);
}
