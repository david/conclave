import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "path";
import type { EventStore } from "../event-store.ts";
import {
  initialMetaContextRegistryState,
  type MetaContextRegistryState,
  type MetaContextMeta,
} from "../server-state.ts";
import type { MetaContextInfo } from "../types.ts";
import { metaContextRegistryReducer } from "../slices/meta-context-index.ts";

type MetaContextRegistry = {
  getState(): MetaContextRegistryState;
  toMetaContextInfoList(): MetaContextInfo[];
};

type PersistedState = {
  contexts: Array<MetaContextMeta>;
};

function hydrateFromJson(filePath: string): MetaContextRegistryState {
  try {
    const raw = readFileSync(filePath, "utf-8");
    const data: PersistedState = JSON.parse(raw);
    const contexts = new Map<string, MetaContextMeta>();
    const nameIndex = new Map<string, string>();
    for (const ctx of data.contexts) {
      contexts.set(ctx.id, ctx);
      nameIndex.set(ctx.name, ctx.id);
    }
    return { contexts, nameIndex };
  } catch {
    return initialMetaContextRegistryState;
  }
}

function persistToJson(filePath: string, state: MetaContextRegistryState): void {
  const data: PersistedState = {
    contexts: Array.from(state.contexts.values()),
  };
  try {
    const dir = filePath.substring(0, filePath.lastIndexOf("/"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch {
    // Ignore write errors — best-effort persistence
  }
}

export function createMetaContextRegistry(store: EventStore, cwd: string): MetaContextRegistry {
  const filePath = join(cwd, ".conclave", "state", "meta-contexts.json");
  let state = hydrateFromJson(filePath);

  // Replay existing events
  for (const event of store.getAll()) {
    state = metaContextRegistryReducer(state, event);
  }

  // Subscribe to new events
  store.subscribe((event) => {
    if (event.type === "MetaContextCreated" || event.type === "SessionAddedToMetaContext") {
      state = metaContextRegistryReducer(state, event);
      persistToJson(filePath, state);
    }
  });

  return {
    getState() {
      return state;
    },
    toMetaContextInfoList(): MetaContextInfo[] {
      return Array.from(state.contexts.values()).map((ctx) => ({
        id: ctx.id,
        name: ctx.name,
        sessionIds: ctx.sessionIds,
      }));
    },
  };
}
