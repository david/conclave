import type { ClientEvent } from "../types.ts";

export type ErrorState = {
  error: string | null;
};

export const initialErrorState: ErrorState = {
  error: null,
};

export function errorReducer(state: ErrorState, event: ClientEvent): ErrorState {
  switch (event.type) {
    case "PromptSubmitted":
      return { error: null };

    case "Error":
      return { error: event.message };

    default:
      return state;
  }
}
