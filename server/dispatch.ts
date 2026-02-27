import type { EventStore } from "./event-store.ts";
import type { Projection } from "./projection.ts";
import type { SessionRegistryState, MetaContextRegistryState } from "./server-state.ts";
import type { ServerCommand, DomainEvent, EventPayload } from "./types.ts";
import type { BridgeLike, Processor } from "./slices/slice-types.ts";

// --- Handlers (via slice barrel exports) ---
import { handleCreateSession } from "./slices/create-session/index.ts";
import { handleDiscoverSession } from "./slices/discover-session/index.ts";
import { handleSwitchSession } from "./slices/switch-session/index.ts";
import { handleLoadSession } from "./slices/load-session/index.ts";
import { handleSubmitPrompt } from "./slices/submit-prompt/index.ts";
import { handleCancelPrompt } from "./slices/cancel-prompt/index.ts";
import { handleNextBlockClick } from "./slices/next-block-click/index.ts";
import { handleEnsureMetaContext } from "./slices/ensure-meta-context/index.ts";
import { handleAddSessionToMetaContext } from "./slices/add-session-to-meta-context/index.ts";
import { handleRecordAgentText } from "./slices/record-agent-text/index.ts";
import { handleRecordAgentThought } from "./slices/record-agent-thought/index.ts";
import { handleRecordToolCallStarted } from "./slices/record-tool-call-started/index.ts";
import { handleRecordToolCallUpdated } from "./slices/record-tool-call-updated/index.ts";
import { handleRecordToolCallCompleted } from "./slices/record-tool-call-completed/index.ts";
import { handleRecordPlanUpdated } from "./slices/record-plan-updated/index.ts";
import { handleRecordUsageUpdated } from "./slices/record-usage-updated/index.ts";
import { handleRecordSessionInfoUpdated } from "./slices/record-session-info-updated/index.ts";
import { handleCompleteTurn } from "./slices/complete-turn/index.ts";
import { handleRecordError } from "./slices/record-error/index.ts";

// --- Processors (direct imports — not part of slice public API) ---
import { autoSwitchAfterCreate, associateWithMetaContext } from "./slices/create-session/processor.ts";
import { createLoadIfUnloaded } from "./slices/switch-session/processor.ts";
import { ensureMetaContext } from "./slices/next-block-click/processor.ts";
import { createSessionForMetaContext } from "./slices/ensure-meta-context/processor.ts";
import { submitPromptForNextBlock } from "./slices/add-session-to-meta-context/processor.ts";

export type DispatchFn = (sessionId: string, command: ServerCommand) => Promise<void>;

// Re-export for WS layer
export { getServerEpoch } from "./slices/switch-session/index.ts";

type MetaContextSource = {
  getState(): MetaContextRegistryState;
};

/**
 * Creates the dispatch function. The bridge is injected lazily to break the
 * circular dependency (dispatch needs bridge, bridge needs dispatch).
 * Call `setBridge()` on the returned object before dispatching any commands
 * that need the bridge (CreateSession, LoadSession, SubmitPrompt, CancelPrompt).
 */
export function createDispatch(
  store: EventStore,
  registry: Projection<SessionRegistryState>,
  metaContextRegistry: MetaContextSource,
  bridge?: BridgeLike,
): DispatchFn & { setBridge(b: BridgeLike): void } {
  let _bridge: BridgeLike | undefined = bridge;

  function getBridge(): BridgeLike {
    if (!_bridge) throw new Error("Bridge not set — call setBridge() before dispatching bridge commands");
    return _bridge;
  }

  // --- Processor infrastructure ---

  const processors: Processor[] = [
    autoSwitchAfterCreate,
    associateWithMetaContext,
    createLoadIfUnloaded(registry),
    ensureMetaContext,
    createSessionForMetaContext,
    submitPromptForNextBlock,
  ];

  async function runProcessors(event: DomainEvent) {
    for (const proc of processors) {
      if (proc.watches === event.type) {
        await proc.handler(event, dispatch);
      }
    }
  }

  async function emit(sessionId: string, payload: EventPayload): Promise<DomainEvent> {
    const event = store.append(sessionId, payload);
    await runProcessors(event);
    return event;
  }

  // --- Command routing ---

  async function dispatch(sessionId: string, command: ServerCommand): Promise<void> {
    switch (command.type) {
      case "RecordAgentText":
        return handleRecordAgentText(sessionId, command, emit);
      case "RecordAgentThought":
        return handleRecordAgentThought(sessionId, command, emit);
      case "RecordToolCallStarted":
        return handleRecordToolCallStarted(sessionId, command, emit);
      case "RecordToolCallUpdated":
        return handleRecordToolCallUpdated(sessionId, command, emit);
      case "RecordToolCallCompleted":
        return handleRecordToolCallCompleted(sessionId, command, emit);
      case "RecordPlanUpdated":
        return handleRecordPlanUpdated(sessionId, command, emit);
      case "RecordUsageUpdated":
        return handleRecordUsageUpdated(sessionId, command, emit);
      case "RecordSessionInfoUpdated":
        return handleRecordSessionInfoUpdated(sessionId, command, emit);
      case "CompleteTurn":
        return handleCompleteTurn(sessionId, command, emit);
      case "RecordError":
        return handleRecordError(sessionId, command, emit);
      case "CreateSession":
        return handleCreateSession(sessionId, command, emit, getBridge());
      case "DiscoverSession":
        return handleDiscoverSession(sessionId, command, emit);
      case "SwitchSession":
        return handleSwitchSession(sessionId, command, emit, registry);
      case "LoadSession":
        return handleLoadSession(sessionId, command, emit, registry, getBridge());
      case "SubmitPrompt":
        return handleSubmitPrompt(sessionId, command, emit, registry, getBridge());
      case "CancelPrompt":
        return handleCancelPrompt(sessionId, command, emit, getBridge());
      case "NextBlockClick":
        return handleNextBlockClick(sessionId, command, emit);
      case "EnsureMetaContext":
        return handleEnsureMetaContext(sessionId, command, emit, metaContextRegistry);
      case "AddSessionToMetaContext":
        return handleAddSessionToMetaContext(sessionId, command, emit);
    }
  }

  const dispatchWithSetBridge = dispatch as DispatchFn & { setBridge(b: BridgeLike): void };
  dispatchWithSetBridge.setBridge = (b: BridgeLike) => { _bridge = b; };
  return dispatchWithSetBridge;
}
