import type { ClientEvent, AppState } from "../types.ts";
import { initialState } from "../types.ts";
import { sessionsReducer } from "./sessions.ts";
import { messagesReducer } from "./messages.ts";
import { planReducer } from "./plan.ts";
import { permissionsReducer } from "./permissions.ts";
import { usageReducer } from "./usage.ts";
import { errorReducer } from "./error.ts";

export function combinedReducer(state: AppState, event: ClientEvent): AppState {
  // SessionSwitched resets everything except the sessions list
  if (event.type === "SessionSwitched") {
    return {
      ...initialState,
      sessions: state.sessions,
      sessionId: event.sessionId,
    };
  }

  return {
    ...sessionsReducer(
      { sessionId: state.sessionId, sessions: state.sessions, creatingSession: state.creatingSession },
      event,
    ),
    ...messagesReducer(
      { messages: state.messages, streamingContent: state.streamingContent, isProcessing: state.isProcessing },
      event,
      state,
    ),
    ...planReducer(
      { currentMode: state.currentMode, planContent: state.planContent, planEntries: state.planEntries },
      event,
    ),
    ...permissionsReducer(
      { pendingPermission: state.pendingPermission },
      event,
    ),
    ...usageReducer(
      { usage: state.usage },
      event,
    ),
    ...errorReducer(
      { error: state.error },
      event,
    ),
  };
}
