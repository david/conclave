import { createSlice } from "./create-slice.ts";

/** ServiceStatusUpdated → replaces services list and availability flag. */
export const serviceStatusUpdatedSlice = createSlice("ServiceStatusUpdated", (state, event) => {
  return { ...state, services: event.services, servicesAvailable: event.available };
});
