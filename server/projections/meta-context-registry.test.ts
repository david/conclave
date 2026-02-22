import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "path";
import { tmpdir } from "os";
import { EventStore } from "../event-store.ts";
import { createMetaContextRegistry } from "./meta-context-registry.ts";

function makeTmpDir(): string {
  const dir = join(tmpdir(), `conclave-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("MetaContextRegistry projection", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test("processes MetaContextCreated events", () => {
    const store = new EventStore();
    const registry = createMetaContextRegistry(store, tmpDir);

    store.append("s1", {
      type: "MetaContextCreated",
      metaContextId: "mc-1",
      name: "Feature Work",
    });

    const state = registry.getState();
    expect(state.contexts.size).toBe(1);
    expect(state.contexts.get("mc-1")!.name).toBe("Feature Work");
    expect(state.contexts.get("mc-1")!.sessionIds).toEqual([]);
  });

  test("processes SessionAddedToMetaContext events", () => {
    const store = new EventStore();
    const registry = createMetaContextRegistry(store, tmpDir);

    store.append("s1", {
      type: "MetaContextCreated",
      metaContextId: "mc-1",
      name: "Feature Work",
    });

    store.append("s2", {
      type: "SessionAddedToMetaContext",
      metaContextId: "mc-1",
    });

    const ctx = registry.getState().contexts.get("mc-1")!;
    expect(ctx.sessionIds).toEqual(["s2"]);
  });

  test("toMetaContextInfoList returns correct array", () => {
    const store = new EventStore();
    const registry = createMetaContextRegistry(store, tmpDir);

    store.append("s1", {
      type: "MetaContextCreated",
      metaContextId: "mc-1",
      name: "Feature Work",
    });

    store.append("s2", {
      type: "SessionAddedToMetaContext",
      metaContextId: "mc-1",
    });

    store.append("s3", {
      type: "MetaContextCreated",
      metaContextId: "mc-2",
      name: "Bug Fixes",
    });

    const list = registry.toMetaContextInfoList();
    expect(list).toHaveLength(2);

    const mc1 = list.find((mc) => mc.id === "mc-1")!;
    expect(mc1.name).toBe("Feature Work");
    expect(mc1.sessionIds).toEqual(["s2"]);

    const mc2 = list.find((mc) => mc.id === "mc-2")!;
    expect(mc2.name).toBe("Bug Fixes");
    expect(mc2.sessionIds).toEqual([]);
  });

  test("hydrates from JSON file on construction", () => {
    const stateDir = join(tmpDir, ".conclave", "state");
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(
      join(stateDir, "meta-contexts.json"),
      JSON.stringify({
        contexts: [
          { id: "mc-1", name: "Persisted Context", sessionIds: ["s1", "s2"] },
        ],
      }),
    );

    const store = new EventStore();
    const registry = createMetaContextRegistry(store, tmpDir);

    const state = registry.getState();
    expect(state.contexts.size).toBe(1);
    expect(state.contexts.get("mc-1")!.name).toBe("Persisted Context");
    expect(state.contexts.get("mc-1")!.sessionIds).toEqual(["s1", "s2"]);
    expect(state.nameIndex.get("Persisted Context")).toBe("mc-1");
  });

  test("writes through to JSON file on event processing", async () => {
    const store = new EventStore();
    const registry = createMetaContextRegistry(store, tmpDir);

    store.append("s1", {
      type: "MetaContextCreated",
      metaContextId: "mc-1",
      name: "New Context",
    });

    // Wait a tick for async write to complete
    await Bun.sleep(50);

    const filePath = join(tmpDir, ".conclave", "state", "meta-contexts.json");
    expect(existsSync(filePath)).toBe(true);

    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    expect(data.contexts).toHaveLength(1);
    expect(data.contexts[0].id).toBe("mc-1");
    expect(data.contexts[0].name).toBe("New Context");
  });

  test("starts empty when no JSON file exists", () => {
    const store = new EventStore();
    const registry = createMetaContextRegistry(store, tmpDir);

    expect(registry.getState().contexts.size).toBe(0);
    expect(registry.toMetaContextInfoList()).toEqual([]);
  });

  test("replays existing events from store on construction", () => {
    const store = new EventStore();

    // Append events before creating registry
    store.append("s1", {
      type: "MetaContextCreated",
      metaContextId: "mc-1",
      name: "Pre-existing",
    });
    store.append("s2", {
      type: "SessionAddedToMetaContext",
      metaContextId: "mc-1",
    });

    const registry = createMetaContextRegistry(store, tmpDir);

    const ctx = registry.getState().contexts.get("mc-1")!;
    expect(ctx.name).toBe("Pre-existing");
    expect(ctx.sessionIds).toEqual(["s2"]);
  });
});
