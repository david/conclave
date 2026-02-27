import type { DomainEvent } from "../types.ts";
import type { SessionRegistryState } from "../server-state.ts";
import { createSessionSlice } from "./create-session/reducer.ts";
import { discoverSessionSlice } from "./discover-session/reducer.ts";
import { loadSessionSlice } from "./load-session/reducer.ts";
import { trackFirstPromptSlice } from "./submit-prompt/reducer.ts";
import { updateTitleSlice } from "./record-session-info-updated/reducer.ts";

type Slice = (state: SessionRegistryState, event: DomainEvent) => SessionRegistryState;

const slices: Slice[] = [
  createSessionSlice,
  discoverSessionSlice,
  loadSessionSlice,
  trackFirstPromptSlice,
  updateTitleSlice,
];

/** Runs all session registry slices sequentially. */
export function sessionRegistryReducer(state: SessionRegistryState, event: DomainEvent): SessionRegistryState {
  return slices.reduce((s, slice) => slice(s, event), state);
}
