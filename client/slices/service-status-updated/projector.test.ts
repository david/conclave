import { describe, test, expect } from "bun:test";
import { serviceStatusUpdatedSlice } from "./projector.ts";
import { initialState } from "../../types.ts";
import type { ClientEvent, ServiceProcess } from "../../types.ts";

const sampleServices: ServiceProcess[] = [
  { name: "web", status: "Running", uptime: "2h 15m" },
  { name: "worker", status: "Launching", uptime: "0s" },
];

function makeServiceStatusUpdated(
  available: boolean,
  services: ServiceProcess[],
): ClientEvent {
  return {
    type: "ServiceStatusUpdated",
    available,
    services,
    seq: 1,
    timestamp: Date.now(),
  };
}

describe("serviceStatusUpdatedSlice", () => {
  test("available: true replaces services and sets servicesAvailable", () => {
    const state = serviceStatusUpdatedSlice(
      initialState,
      makeServiceStatusUpdated(true, sampleServices),
    );
    expect(state.services).toEqual(sampleServices);
    expect(state.servicesAvailable).toBe(true);
  });

  test("available: false clears services and sets servicesAvailable to false", () => {
    const stateWithServices = {
      ...initialState,
      services: sampleServices,
      servicesAvailable: true,
    };
    const state = serviceStatusUpdatedSlice(
      stateWithServices,
      makeServiceStatusUpdated(false, []),
    );
    expect(state.services).toEqual([]);
    expect(state.servicesAvailable).toBe(false);
  });

  test("ignores unrelated events", () => {
    const event = {
      type: "AgentText",
      text: "hi",
      seq: 1,
      timestamp: Date.now(),
      sessionId: "s1",
    } as ClientEvent;
    const state = serviceStatusUpdatedSlice(initialState, event);
    expect(state).toBe(initialState);
  });
});
