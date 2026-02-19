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
import { readFileSync } from "fs";
import { translateAcpUpdate } from "./acp-translate.ts";
import type { EventPayload } from "./types.ts";

export type OnEventCallback = (sessionId: string, payload: EventPayload) => void;
export type OnTitleUpdateCallback = (sessionId: string, title: string) => void;

type PendingPermission = {
  resolve: (response: RequestPermissionResponse) => void;
  options: RequestPermissionRequest["options"];
};

export class AcpBridge {
  private connection: ClientSideConnection | null = null;
  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private cwd: string;
  private onEvent: OnEventCallback;
  private loadingSessions = new Set<string>();
  private pendingPermissions = new Map<string, PendingPermission>();
  private sessionPlanFilePaths = new Map<string, string>();
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

          // Track plan file paths from tool_call events (per session)
          if (params.update.sessionUpdate === "tool_call") {
            const rawInput = params.update.rawInput as Record<string, unknown> | undefined;
            const filePath = rawInput?.file_path;
            if (typeof filePath === "string" && filePath.includes(".claude/plans/")) {
              bridge.sessionPlanFilePaths.set(params.sessionId, filePath);
            }
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
          const toolName = params.toolCall?.title ?? undefined;

          // Only defer requests that should be shown to the user
          // (ExitPlanMode has a "plan" reject_once option)
          const isPlanApproval = params.options.some(
            (o) => o.optionId === "plan" && o.kind === "reject_once",
          );

          if (!isPlanApproval) {
            // Auto-approve regular tool permissions
            const allowOption = params.options.find(
              (o) => o.kind === "allow_once" || o.kind === "allow_always",
            );
            return {
              outcome: allowOption
                ? { outcome: "selected", optionId: allowOption.optionId }
                : { outcome: "cancelled" },
            };
          }

          // Read plan file content for the approval UI
          let planContent: string | undefined;
          const planPath = bridge.sessionPlanFilePaths.get(params.sessionId);
          if (planPath) {
            try {
              planContent = readFileSync(planPath, "utf8");
            } catch {
              // Plan file may have been deleted
            }
          }

          // Defer — wait for user to approve/reject via the UI
          return new Promise<RequestPermissionResponse>((resolve) => {
            bridge.pendingPermissions.set(params.sessionId, {
              resolve,
              options: params.options,
            });

            onEvent(params.sessionId, {
              type: "PermissionRequested",
              options: params.options.map((o) => ({
                optionId: o.optionId,
                name: o.name ?? o.optionId,
                kind: o.kind,
              })),
              toolName,
              planContent,
            });
          });
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
        formatError(err),
      );
    }
  }

  /**
   * Resolve a pending permission request by selecting an option.
   */
  respondPermission(sessionId: string, optionId: string): boolean {
    const pending = this.pendingPermissions.get(sessionId);
    if (!pending) return false;

    pending.resolve({
      outcome: { outcome: "selected", optionId },
    });
    this.pendingPermissions.delete(sessionId);
    return true;
  }

  hasPendingPermission(sessionId: string): boolean {
    return this.pendingPermissions.has(sessionId);
  }

  async setMode(sessionId: string, modeId: string): Promise<void> {
    if (!this.connection) {
      onEventError(this.onEvent, sessionId, "ACP connection not initialized");
      return;
    }

    try {
      await this.connection.setSessionMode({
        sessionId: sessionId as SessionId,
        modeId,
      });
    } catch (err) {
      onEventError(
        this.onEvent,
        sessionId,
        `Set mode failed: ${formatError(err)}`,
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
        `Cancel failed: ${formatError(err)}`,
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

export function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  // JSON-RPC errors from ACP SDK are plain objects
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    try { return JSON.stringify(err); } catch { /* fall through */ }
  }
  return String(err);
}

