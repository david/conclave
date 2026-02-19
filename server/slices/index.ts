import type { DomainEvent } from "../types.ts";
import type { SessionRegistryState } from "../server-state.ts";
import { createSessionSlice } from "./create-session.ts";
import { discoverSessionSlice } from "./discover-session.ts";
import { loadSessionSlice } from "./load-session.ts";
import { trackFirstPromptSlice } from "./track-first-prompt.ts";
import { updateTitleSlice } from "./update-title.ts";

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
