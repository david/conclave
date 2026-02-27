import type { EventStore } from "./event-store.ts";
import type { Projection } from "./projection.ts";
import type { SessionRegistryState, MetaContextRegistryState } from "./server-state.ts";
import type { ServerCommand, DomainEvent, SessionEvent, EventPayload } from "./types.ts";

export type DispatchFn = (sessionId: string, command: ServerCommand) => Promise<void>;

type Processor = {
  watches: DomainEvent["type"];
  handler: (event: DomainEvent, dispatch: DispatchFn) => void | Promise<void>;
};

type MetaContextSource = {
  getState(): MetaContextRegistryState;
};

type BridgeLike = {
  createSession(): Promise<string>;
  loadSession(sessionId: string): Promise<void>;
  submitPrompt(sessionId: string, text: string, images?: any, skipPromptEvent?: boolean): Promise<void>;
  cancel(sessionId: string): Promise<void>;
};

// Unique identifier for this server process lifetime.
const SERVER_EPOCH = crypto.randomUUID();

/** Returns the server epoch for use by WS layer. */
export function getServerEpoch(): string {
  return SERVER_EPOCH;
}

/**
 * Pipeline context for tracking next-block-click processor chains.
 * Keyed by the new session ID created during the pipeline.
 */
const pipelineContexts = new Map<string, {
  metaContextId: string;
  commandText: string;
  originSessionId: string;
}>();

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
  const processors: Processor[] = [];

  function registerProcessor(watches: DomainEvent["type"], handler: Processor["handler"]) {
    processors.push({ watches, handler });
  }

  async function runProcessors(event: DomainEvent) {
    for (const proc of processors) {
      if (proc.watches === event.type) {
        await proc.handler(event, dispatch);
      }
    }
  }

  function emitAndProcess(sessionId: string, payload: EventPayload): Promise<DomainEvent> {
    const event = store.append(sessionId, payload);
    return runProcessors(event).then(() => event);
  }

  // --- Processors ---

  // AutoSwitchAfterCreate: on SessionCreated, issue SwitchSession
  registerProcessor("SessionCreated", async (event, dispatch) => {
    if (!("sessionId" in event)) return;
    await dispatch(event.sessionId, { type: "SwitchSession" });
  });

  // LoadIfUnloaded: on SessionSwitched, load if not yet loaded
  registerProcessor("SessionSwitched", async (event, dispatch) => {
    if (event.type !== "SessionSwitched" || !("sessionId" in event)) return;
    const meta = registry.getState().sessions.get(event.sessionId);
    if (meta && !meta.loaded) {
      await dispatch(event.sessionId, { type: "LoadSession" });
    }
  });

  // EnsureMetaContext: on NextBlockInitiated, issue EnsureMetaContext command
  registerProcessor("NextBlockInitiated", async (event, dispatch) => {
    if (event.type !== "NextBlockInitiated" || !("sessionId" in event)) return;
    await dispatch(event.sessionId, {
      type: "EnsureMetaContext",
      originSessionId: event.currentSessionId,
      metaContextName: event.metaContext,
      commandText: event.commandText,
    });
  });

  // CreateSessionForMetaContext: on MetaContextEnsured, create a new session
  registerProcessor("MetaContextEnsured", async (event, dispatch) => {
    if (event.type !== "MetaContextEnsured" || !("sessionId" in event)) return;
    // Store pipeline context so AssociateWithMetaContext knows to fire
    // The key will be set after CreateSession returns (keyed by new session ID)
    // Store it temporarily keyed by metaContextId + originSessionId
    const pipelineKey = `pending:${event.metaContextId}:${event.originSessionId}`;
    pipelineContexts.set(pipelineKey, {
      metaContextId: event.metaContextId,
      commandText: event.commandText,
      originSessionId: event.originSessionId,
    });
    await dispatch("_", { type: "CreateSession" });
  });

  // AssociateWithMetaContext: on SessionCreated, check if pipeline context exists
  registerProcessor("SessionCreated", async (event, dispatch) => {
    if (!("sessionId" in event)) return;
    // Find any pending pipeline context
    for (const [key, ctx] of pipelineContexts) {
      if (key.startsWith("pending:")) {
        pipelineContexts.delete(key);
        // Transfer to the new session ID
        pipelineContexts.set(event.sessionId, ctx);
        await dispatch(event.sessionId, {
          type: "AddSessionToMetaContext",
          sessionId: event.sessionId,
          metaContextId: ctx.metaContextId,
          commandText: ctx.commandText,
        });
        return;
      }
    }
  });

  // SubmitPromptForNextBlock: on SessionAddedToMetaContext, submit the prompt
  registerProcessor("SessionAddedToMetaContext", async (event, dispatch) => {
    if (event.type !== "SessionAddedToMetaContext" || !("sessionId" in event)) return;
    const ctx = pipelineContexts.get(event.sessionId);
    if (ctx) {
      pipelineContexts.delete(event.sessionId);
      await dispatch(event.sessionId, {
        type: "SubmitPrompt",
        text: event.commandText,
      });
    }
  });

  // --- Command handlers ---

  async function dispatch(sessionId: string, command: ServerCommand): Promise<void> {
    switch (command.type) {
      // --- Pass-through commands ---
      case "RecordAgentText":
        await emitAndProcess(sessionId, { type: "AgentText", text: command.text });
        break;

      case "RecordAgentThought":
        await emitAndProcess(sessionId, { type: "AgentThought", text: command.text });
        break;

      case "RecordToolCallStarted":
        await emitAndProcess(sessionId, {
          type: "ToolCallStarted",
          toolCallId: command.toolCallId,
          toolName: command.toolName,
          kind: command.kind,
          input: command.input,
        });
        break;

      case "RecordToolCallUpdated":
        await emitAndProcess(sessionId, {
          type: "ToolCallUpdated",
          toolCallId: command.toolCallId,
          status: command.status,
          content: command.content,
        });
        break;

      case "RecordToolCallCompleted":
        await emitAndProcess(sessionId, {
          type: "ToolCallCompleted",
          toolCallId: command.toolCallId,
          status: command.status,
          output: command.output,
        });
        break;

      case "RecordPlanUpdated":
        await emitAndProcess(sessionId, { type: "PlanUpdated", entries: command.entries });
        break;

      case "RecordUsageUpdated":
        await emitAndProcess(sessionId, {
          type: "UsageUpdated",
          size: command.size,
          used: command.used,
          ...(command.costAmount !== undefined ? { costAmount: command.costAmount, costCurrency: command.costCurrency } : {}),
        });
        break;

      case "RecordSessionInfoUpdated":
        await emitAndProcess(sessionId, {
          type: "SessionInfoUpdated",
          title: command.title,
          updatedAt: command.updatedAt,
        });
        break;

      case "CompleteTurn":
        await emitAndProcess(sessionId, { type: "TurnCompleted", stopReason: command.stopReason });
        break;

      case "RecordError":
        await emitAndProcess(sessionId, { type: "ErrorOccurred", message: command.message });
        break;

      // --- Session lifecycle ---

      case "CreateSession": {
        const newSessionId = await getBridge().createSession();
        await emitAndProcess(newSessionId, { type: "SessionCreated" });
        break;
      }

      case "DiscoverSession":
        await emitAndProcess(sessionId, {
          type: "SessionDiscovered",
          name: command.name,
          title: command.title,
          createdAt: command.createdAt,
        });
        break;

      case "SwitchSession": {
        const meta = registry.getState().sessions.get(sessionId);
        if (!meta) {
          await emitAndProcess(sessionId, {
            type: "ErrorOccurred",
            message: `Session not found: ${sessionId}`,
          });
          return;
        }
        await emitAndProcess(sessionId, {
          type: "SessionSwitched",
          epoch: SERVER_EPOCH,
        });
        break;
      }

      case "LoadSession": {
        const meta = registry.getState().sessions.get(sessionId);
        if (!meta) {
          await emitAndProcess(sessionId, {
            type: "ErrorOccurred",
            message: `Session not found: ${sessionId}`,
          });
          return;
        }
        if (meta.loaded) return; // Already loaded, no-op
        await getBridge().loadSession(sessionId);
        await emitAndProcess(sessionId, { type: "SessionLoaded" });
        break;
      }

      case "SubmitPrompt": {
        const meta = registry.getState().sessions.get(sessionId);
        if (!meta || !meta.loaded) {
          await emitAndProcess(sessionId, {
            type: "ErrorOccurred",
            message: meta ? "Session not loaded" : `Session not found: ${sessionId}`,
          });
          return;
        }
        await emitAndProcess(sessionId, {
          type: "PromptSubmitted",
          text: command.text,
          images: command.images,
        });
        getBridge().submitPrompt(sessionId, command.text, command.images, true);
        break;
      }

      case "CancelPrompt": {
        await emitAndProcess(sessionId, { type: "CancellationRequested" });
        getBridge().cancel(sessionId);
        break;
      }

      // --- Next-block-click pipeline ---

      case "NextBlockClick":
        await emitAndProcess(sessionId, {
          type: "NextBlockInitiated",
          currentSessionId: command.currentSessionId,
          label: command.label,
          commandText: command.commandText,
          metaContext: command.metaContext,
        });
        break;

      case "EnsureMetaContext": {
        const mcState = metaContextRegistry.getState();
        const existingId = mcState.nameIndex.get(command.metaContextName);
        if (existingId) {
          await emitAndProcess(sessionId, {
            type: "MetaContextEnsured",
            metaContextId: existingId,
            metaContextName: command.metaContextName,
            originSessionId: command.originSessionId,
            commandText: command.commandText,
            created: false,
          });
        } else {
          const newId = crypto.randomUUID();
          await emitAndProcess(sessionId, {
            type: "MetaContextEnsured",
            metaContextId: newId,
            metaContextName: command.metaContextName,
            originSessionId: command.originSessionId,
            commandText: command.commandText,
            created: true,
          });
        }
        break;
      }

      case "AddSessionToMetaContext":
        await emitAndProcess(command.sessionId, {
          type: "SessionAddedToMetaContext",
          metaContextId: command.metaContextId,
          commandText: command.commandText,
        });
        break;
    }
  }

  const dispatchWithSetBridge = dispatch as DispatchFn & { setBridge(b: BridgeLike): void };
  dispatchWithSetBridge.setBridge = (b: BridgeLike) => { _bridge = b; };
  return dispatchWithSetBridge;
}
