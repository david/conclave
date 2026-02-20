import { createSlice } from "./create-slice.ts";

export const specListUpdatedSlice = createSlice("SpecListUpdated", (state, event) => {
  return { ...state, specs: event.specs };
});
