import type { ClientEvent, AppState } from "../types.ts";
import { sessionInitiatedSlice } from "./session-initiated/index.ts";
import { sessionCreatedSlice } from "./session-created/index.ts";
import { sessionListSlice } from "./session-list/index.ts";
import { sessionInfoUpdatedSlice } from "./session-info-updated/index.ts";
import { sessionSwitchedSlice } from "./session-switched/index.ts";
import { planUpdatedSlice } from "./plan-updated/index.ts";
import { promptSubmittedSlice } from "./prompt-submitted/index.ts";
import { agentTextSlice } from "./agent-text/index.ts";
import { agentThoughtSlice } from "./agent-thought/index.ts";
import { toolCallStartedSlice } from "./tool-call-started/index.ts";
import { toolCallUpdatedSlice } from "./tool-call-updated/index.ts";
import { toolCallCompletedSlice } from "./tool-call-completed/index.ts";
import { turnCompletedSlice } from "./turn-completed/index.ts";
import { errorSlice } from "./error/index.ts";
import { usageUpdatedSlice } from "./usage-updated/index.ts";
import { specListUpdatedSlice } from "./spec-list-updated/index.ts";
import { gitStatusUpdatedSlice } from "./git-status-updated/index.ts";
import { serviceStatusUpdatedSlice } from "./service-status-updated/index.ts";

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
  gitStatusUpdatedSlice,
  serviceStatusUpdatedSlice,
];

/** Runs all client slices sequentially. */
export function combinedReducer(state: AppState, event: ClientEvent): AppState {
  return slices.reduce((s, slice) => slice(s, event), state);
}
