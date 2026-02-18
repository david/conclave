import {
  ClientSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
  type Client,
  type Agent,
  type SessionId,
  type ReadTextFileRequest,
  type ReadTextFileResponse,
  type WriteTextFileRequest,
  type WriteTextFileResponse,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionNotification,
  type SessionInfo as AcpSessionInfo,
} from "@agentclientprotocol/sdk";
import { join } from "path";
import { translateAcpUpdate } from "./acp-translate.ts";
import type { EventPayload } from "./types.ts";

export type OnEventCallback = (sessionId: string, payload: EventPayload) => void;
export type OnTitleUpdateCallback = (sessionId: string, title: string) => void;

export class AcpBridge {
  private connection: ClientSideConnection | null = null;
  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private cwd: string;
  private onEvent: OnEventCallback;
  private loadingSessions = new Set<string>();
  onTitleUpdate?: OnTitleUpdateCallback;

  constructor(cwd: string, onEvent: OnEventCallback) {
    this.cwd = cwd;
    this.onEvent = onEvent;
  }

  async start(): Promise<void> {
    const acpScript = this.resolveAcpScript();

    this.proc = Bun.spawn(["bun", "run", acpScript], {
      cwd: this.cwd,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "inherit",
    });

    const stdout = this.proc.stdout;
    const stdin = this.proc.stdin;

    if (!stdout || !stdin) {
      throw new Error("Failed to get stdio from claude-code-acp process");
    }

    const stdinWriter = stdin as { write(chunk: Uint8Array): void };
    const stream = ndJsonStream(
      new WritableStream<Uint8Array>({
        write(chunk) {
          stdinWriter.write(chunk);
        },
      }),
      stdout as unknown as ReadableStream<Uint8Array>,
    );

    const onEvent = this.onEvent;
    const bridge = this;

    this.connection = new ClientSideConnection(
      (_agent: Agent): Client => ({
        async sessionUpdate(params: SessionNotification): Promise<void> {
          if (params.update.sessionUpdate === "session_info_update") {
            const title = params.update.title;
            if (title && bridge.onTitleUpdate) {
              bridge.onTitleUpdate(params.sessionId, title);
            }
            return;
          }

          const isLoading = bridge.loadingSessions.has(params.sessionId);
          const events = translateAcpUpdate(params.update, isLoading);
          for (const payload of events) {
            onEvent(params.sessionId, payload);
          }
        },

        async requestPermission(
          params: RequestPermissionRequest,
        ): Promise<RequestPermissionResponse> {
          const allowOption = params.options.find(
            (o) => o.kind === "allow_once" || o.kind === "allow_always",
          );
          return {
            outcome: allowOption
              ? { outcome: "selected", optionId: allowOption.optionId }
              : { outcome: "cancelled" },
          };
        },

        async readTextFile(
          params: ReadTextFileRequest,
        ): Promise<ReadTextFileResponse> {
          const file = Bun.file(params.path);
          const content = await file.text();
          return { content };
        },

        async writeTextFile(
          params: WriteTextFileRequest,
        ): Promise<WriteTextFileResponse> {
          await Bun.write(params.path, params.content);
          return {};
        },
      }),
      stream,
    );

    console.log("Initializing ACP connection...");
    const initResp = await this.connection.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: false,
      },
    });
    console.log(
      "ACP initialized:",
      initResp.agentInfo?.name ?? "unknown agent",
    );

    // Monitor process exit
    this.proc.exited.then((code) => {
      if (code !== 0) {
        // Emit error without a sessionId — server must handle
        onEvent("__system__", {
          type: "Error",
          message: `claude-code-acp exited with code ${code}`,
        });
      }
    });
  }

  async createSession(): Promise<string> {
    if (!this.connection) {
      throw new Error("ACP connection not initialized");
    }

    const sessionResp = await this.connection.newSession({
      cwd: this.cwd,
      mcpServers: [],
    });
    console.log("Session created:", sessionResp.sessionId);
    return sessionResp.sessionId;
  }

  async listSessions(): Promise<AcpSessionInfo[]> {
    if (!this.connection) {
      throw new Error("ACP connection not initialized");
    }

    try {
      const resp = await this.connection.unstable_listSessions({});
      return resp.sessions;
    } catch {
      // Agent may not support listSessions
      return [];
    }
  }

  async loadSession(sessionId: string): Promise<void> {
    if (!this.connection) {
      throw new Error("ACP connection not initialized");
    }

    this.loadingSessions.add(sessionId);
    try {
      await this.connection.loadSession({
        sessionId: sessionId as SessionId,
        cwd: this.cwd,
        mcpServers: [],
      });
    } finally {
      this.loadingSessions.delete(sessionId);
    }
  }

  async submitPrompt(sessionId: string, text: string): Promise<void> {
    if (!this.connection) {
      onEventError(this.onEvent, sessionId, "ACP connection not initialized");
      return;
    }

    this.onEvent(sessionId, { type: "PromptSubmitted", text });

    try {
      const resp = await this.connection.prompt({
        sessionId: sessionId as SessionId,
        prompt: [{ type: "text", text }],
      });

      this.onEvent(sessionId, {
        type: "TurnCompleted",
        stopReason: resp.stopReason,
      });
    } catch (err) {
      onEventError(
        this.onEvent,
        sessionId,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  async cancel(sessionId: string): Promise<void> {
    if (!this.connection) return;

    try {
      await this.connection.cancel({
        sessionId: sessionId as SessionId,
      });
    } catch (err) {
      onEventError(
        this.onEvent,
        sessionId,
        `Cancel failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private resolveAcpScript(): string {
    const localEntry = join(import.meta.dir, "..", "node_modules", "@zed-industries", "claude-code-acp", "dist", "index.js");
    const stat = Bun.spawnSync(["test", "-f", localEntry]);
    if (stat.exitCode === 0) {
      return localEntry;
    }

    throw new Error(
      "claude-code-acp not found. Install it with: bun add @zed-industries/claude-code-acp",
    );
  }
}

function onEventError(onEvent: OnEventCallback, sessionId: string, message: string) {
  onEvent(sessionId, { type: "Error", message });
}
