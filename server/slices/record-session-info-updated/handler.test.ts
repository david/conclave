import { describe, test, expect } from "bun:test";
import { setup } from "../test-helpers.ts";

describe("RecordSessionInfoUpdated handler", () => {
  test("emits SessionInfoUpdated event", async () => {
    const { store, dispatch } = setup();
    await dispatch("s1", {
      type: "RecordSessionInfoUpdated",
      title: "My Chat",
    });

    expect(store.getAll()[0].type).toBe("SessionInfoUpdated");
  });
});
