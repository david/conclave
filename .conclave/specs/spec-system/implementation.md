# Spec System — Implementation

Add a filesystem-backed spec discovery system to the server and a Specs section to the workspace sidebar. The server scans `.conclave/specs/` on startup and watches for changes, emitting spec-related events into the EventStore. A new projection maintains the spec list. The client receives `SpecList` events and renders specs grouped by epic in a new accordion section.

## New Types

### Server: `server/types.ts`

Introduce a distinction between session events (which carry `sessionId`) and global events (which don't). Both share `seq` and `timestamp` from the EventStore.

```ts
// Shared fields stamped by EventStore.append()
export type BaseFields = {
  seq: number;
  timestamp: number;
};

// Session events — existing pattern, unchanged
export type BaseEvent = BaseFields & {
  sessionId: string;
};

// Global event base — no sessionId
export type BaseGlobalEvent = BaseFields;

// Spec metadata derived from filesystem scan
export type SpecPhase = "analysis" | "implementation";

export type SpecInfo = {
  name: string;            // directory name
  description: string | null; // from spec.json
  phase: SpecPhase | null; // latest phase file found, null if none
  type: "epic" | "spec";   // from spec.json, default "spec"
  epic: string | null;      // parent epic name from spec.json
};

// Global event — no sessionId
export type SpecListUpdated = BaseGlobalEvent & {
  type: "SpecListUpdated";
  specs: SpecInfo[];
};
```

Add `SpecListUpdated` as a global event type. Widen `DomainEvent` to include both session and global events:

```ts
export type SessionEvent = SessionCreated | PromptSubmitted | AgentText | ...;
export type GlobalEvent = SpecListUpdated;
export type DomainEvent = SessionEvent | GlobalEvent;
```

Update `EventStore` to support both:
- Add an `appendGlobal(payload)` method (no `sessionId` parameter) alongside the existing `append(sessionId, payload)`.
- `getBySessionId()` naturally skips global events since they lack `sessionId`.
- `getAll()` and `subscribe()` work unchanged — they handle all events.

### Client: `client/types.ts`

```ts
export type SpecInfo = {
  name: string;
  description: string | null;
  phase: "analysis" | "implementation" | null;
  type: "epic" | "spec";
  epic: string | null;
};
```

Add `specs: SpecInfo[]` to `AppState` (initial: `[]`).

## UC-1 + UC-2: Scan specs directory on startup and determine phase

**Files:**
- `server/spec-scanner.ts` — **create**: pure module for scanning `.conclave/specs/`
- `server/types.ts` — **modify**: add `SpecInfo`, `SpecListUpdated` to domain event union
- `server/index.ts` — **modify**: call scanner on startup, append `SpecListUpdated` event

**Steps:**
1. Create `server/spec-scanner.ts` exporting `scanSpecs(baseDir: string): Promise<SpecInfo[]>`.
2. The function reads subdirectories of `baseDir` using `readdir`.
3. For each subdirectory: check for `spec.json` (parse `description`, `type`, `epic`), check for `implementation.md` then `analysis.md` to determine phase (later file wins per UC-2).
4. Return the array of `SpecInfo` objects.
5. In `server/types.ts`, add `BaseFields`, `BaseGlobalEvent`, `SpecInfo`, `SpecListUpdated`, `SessionEvent`, `GlobalEvent`, and widen the `DomainEvent` union. Add `appendGlobal()` to EventStore.
6. In `server/index.ts`, after `bridge.start()` resolves and sessions are discovered, call `scanSpecs(join(CWD, ".conclave", "specs"))` and `store.appendGlobal({ type: "SpecListUpdated", specs })`.

**Tests:** (`server/spec-scanner.test.ts`)
- Scan a temp directory with one spec containing only `analysis.md` → phase is `"analysis"`
- Scan a spec with both `analysis.md` and `implementation.md` → phase is `"implementation"`
- Scan a spec with only `spec.json` (no phase files) → phase is `null`
- Scan a spec with `spec.json` containing `type: "epic"` → `type` is `"epic"`
- Scan an empty `.conclave/specs/` → returns `[]`

## UC-3: Send spec list to client on WebSocket connect

**Files:**
- `server/index.ts` — **modify**: replay `SpecListUpdated` event on WS connect

**Steps:**
1. In the `websocket.open` handler, after sending `SessionList`, find the latest `SpecListUpdated` event from the store and send it to the connecting client.
2. Since `SpecListUpdated` is a global event (no `sessionId`), it won't appear in session-scoped replays. Send it explicitly: `const latestSpec = store.getAll().findLast(e => e.type === "SpecListUpdated"); if (latestSpec) sendWs(ws, latestSpec);`
3. Alternatively, maintain a `latestSpecList` variable in `index.ts` (updated by a store subscription) to avoid scanning the full log each connect.

**Tests:**
- Verify that a `SpecListUpdated` event appended before WS connect is sent to the client on open (integration-level; may be covered by manual testing).

## UC-9: Inject specs convention into ACP system prompt

**Files:**
- `server/acp-bridge.ts` — **modify**: add `systemPrompt` append to `_meta` in `createSession()`

**Steps:**
1. In `AcpBridge.createSession()`, add a `systemPrompt` field to `_meta`:
   ```ts
   _meta: {
     claudeCode: { options: { disallowedTools: [...] } },
     systemPrompt: {
       append: "Specs live in .conclave/specs/<name>/. Each spec directory contains phase files (analysis.md, implementation.md) and an optional spec.json with description, type, and epic fields."
     }
   }
   ```
2. Keep the existing `disallowedTools` intact.

**Tests:**
- Unit test: verify `createSession` passes `_meta.systemPrompt.append` containing `.conclave/specs` (requires mocking the ACP connection — may defer to integration testing).

## UC-4: Display specs section in workspace sidebar

**Files:**
- `client/types.ts` — **modify**: add `SpecInfo` type, add `specs` to `AppState`
- `client/slices/spec-list-updated.ts` — **create**: client slice for `SpecListUpdated`
- `client/slices/index.ts` — **modify**: register new slice
- `client/slices/session-switched.ts` — **modify**: preserve `specs` across session switches (specs are global, not per-session)
- `client/components/workspace.tsx` — **modify**: add Specs accordion section
- `client/index.tsx` — **modify**: pass `specs` to `Workspace`
- `client/style.css` — **modify**: add styles for spec entries

**Steps:**
1. Add `SpecInfo` type and `specs: SpecInfo[]` to `AppState` in `client/types.ts`. Set initial value to `[]`.
2. Create `client/slices/spec-list-updated.ts`: `createSlice("SpecListUpdated", (state, event) => ({ ...state, specs: event.specs }))`.
3. Register the new slice in `client/slices/index.ts`.
4. In `session-switched.ts`, ensure `specs` is preserved (the existing reset logic clears per-session state; specs should survive switches).
5. In `workspace.tsx`:
   - Add a third `SectionId`: `"specs"`.
   - Accept `specs: SpecInfo[]` prop.
   - Render a "Specs" section as the **first** accordion section (above Tasks and Files).
   - Collapsed by default. Summary shows count: `"3 specs"`.
   - When expanded, list each standalone spec (no epic or orphaned epic ref) as a row: spec name + phase badge.
6. In `client/index.tsx`, pass `state.specs` to `<Workspace>`. Update `workspaceVisible` condition to include `state.specs.length > 0`.
7. Add CSS for `.workspace__spec-entry`, phase badge (`.spec-entry__phase`).

**Tests:**
- `spec-list-updated.ts` slice test: `SpecListUpdated` event replaces `state.specs`
- `session-switched.ts` test: specs are preserved after `SessionSwitched`

## UC-5: Group child specs under epics in sidebar

**Files:**
- `client/components/workspace.tsx` — **modify**: group specs by epic

**Steps:**
1. In the Specs section render logic, partition `specs` into:
   - `epics`: specs where `type === "epic"`
   - `children`: specs where `epic !== null` (keyed by epic name)
   - `standalone`: specs where `type === "spec"` and `epic === null`
2. Render standalone specs at top level.
3. For each epic, render a parent row showing epic name + child progress summary (e.g., `"2 of 4 in implementation"`). Indent child specs beneath it.
4. If a spec references an epic that doesn't exist in the list, treat it as standalone.

**Tests:**
- Component test (or manual): 2 epics with children + 1 standalone renders correct grouping.
- Orphaned epic reference renders as standalone.

## UC-6: Watch for spec directory changes

**Files:**
- `server/spec-watcher.ts` — **create**: filesystem watcher for `.conclave/specs/`
- `server/index.ts` — **modify**: start watcher after initial scan

**Steps:**
1. Create `server/spec-watcher.ts` exporting `watchSpecs(specsDir: string, onChange: (specs: SpecInfo[]) => void): () => void`.
2. Use `fs.watch(specsDir, { recursive: true })` to watch for changes.
3. Debounce change events (200ms) to avoid rapid-fire rescans.
4. On change, call `scanSpecs(specsDir)` and invoke the `onChange` callback with the result.
5. Return an unsubscribe function that closes the watcher.
6. In `server/index.ts`, after the initial `scanSpecs`, call `watchSpecs(specsDir, (specs) => store.appendGlobal({ type: "SpecListUpdated", specs }))`.
7. Add a broadcast trigger: subscribe to the store and when `SpecListUpdated` lands, broadcast to all connected clients (similar to how `SessionList` works). Add this in `index.ts` alongside the existing session list broadcast setup.

**Tests:** (`server/spec-watcher.test.ts`)
- Create a temp specs dir, start watcher, add a new spec directory → `onChange` fires with updated list.
- Debounce: rapid file changes produce only one `onChange` call.

## UC-7: Remove completed spec

**Files:**
- No new files — covered by UC-6's watcher.

**Steps:**
1. When a spec directory is deleted, `fs.watch` fires, `scanSpecs` runs, the deleted spec is absent from results.
2. `SpecListUpdated` is emitted with the spec removed → client sidebar updates.
3. Epic child counts update automatically since the grouping logic in UC-5 derives from the current spec list.

**Tests:**
- Delete a spec directory while watcher is running → `onChange` fires with spec removed from list.

## UC-8: Requirements-analyst creates spec directory during analysis

**Files:**
- No code changes needed — this is a skill convention, not application code.

**Steps:**
1. The `req` skill already writes to `.conclave/specs/<name>/analysis.md` and `spec.json`.
2. UC-6's watcher detects the new files and triggers a `SpecListUpdated` event.
3. The new spec appears in the sidebar with the appropriate phase.
4. No application code changes required — the skill and the watcher handle this end-to-end.
