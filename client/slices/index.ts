import type { ClientEvent, AppState } from "../types.ts";
import { sessionInitiatedSlice } from "./session-initiated.ts";
import { sessionCreatedSlice } from "./session-created.ts";
import { sessionListSlice } from "./session-list.ts";
import { sessionInfoUpdatedSlice } from "./session-info-updated.ts";
import { sessionSwitchedSlice } from "./session-switched.ts";
import { modeChangedSlice } from "./mode-changed.ts";
import { planUpdatedSlice } from "./plan-updated.ts";
import { permissionRequestedSlice } from "./permission-requested.ts";
import { promptSubmittedSlice } from "./prompt-submitted.ts";
import { agentTextSlice } from "./agent-text.ts";
import { agentThoughtSlice } from "./agent-thought.ts";
import { toolCallStartedSlice } from "./tool-call-started.ts";
import { toolCallUpdatedSlice } from "./tool-call-updated.ts";
import { toolCallCompletedSlice } from "./tool-call-completed.ts";
import { turnCompletedSlice } from "./turn-completed.ts";
import { errorSlice } from "./error.ts";
import { usageUpdatedSlice } from "./usage-updated.ts";

const slices: Array<(state: AppState, event: ClientEvent) => AppState> = [
  sessionInitiatedSlice,
  sessionCreatedSlice,
  sessionListSlice,
  sessionInfoUpdatedSlice,
  sessionSwitchedSlice,
  modeChangedSlice,          // must run before toolCallStartedSlice
  planUpdatedSlice,
  permissionRequestedSlice,
  promptSubmittedSlice,
  agentTextSlice,
  agentThoughtSlice,
  toolCallStartedSlice,      // reads state.currentMode (set by modeChangedSlice)
  toolCallUpdatedSlice,
  toolCallCompletedSlice,
  turnCompletedSlice,
  errorSlice,
  usageUpdatedSlice,
];

/** Runs all client slices sequentially. */
export function combinedReducer(state: AppState, event: ClientEvent): AppState {
  return slices.reduce((s, slice) => slice(s, event), state);
}
