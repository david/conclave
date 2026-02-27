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
import { existsSync } from "node:fs";
import { join } from "node:path";
import { translateAcpToCommands } from "./acp-translate.ts";
import type { EventStore } from "./event-store.ts";
import type { DispatchFn } from "./dispatch.ts";
import type { ImageAttachment, ServerCommand, EventPayload } from "./types.ts";

export type PromptBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

/** Build the prompt content array. Never produces empty text blocks. */
export function buildPromptBlocks(text: string, images?: ImageAttachment[]): PromptBlock[] {
  const prompt: PromptBlock[] = [];
  if (images?.length) {
    for (const img of images) {
      prompt.push({ type: "image", data: img.data, mimeType: img.mimeType });
    }
  }
  const effectiveText = text || (prompt.length > 0 ? "See image." : "");
  if (effectiveText) {
    prompt.push({ type: "text", text: effectiveText });
  }
  return prompt;
}

export class AcpBridge {
  private connection: ClientSideConnection | null = null;
  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private cwd: string;
  private store: EventStore;
  private dispatch: DispatchFn;
  private loadingSessions = new Set<string>();

  constructor(cwd: string, store: EventStore, dispatch: DispatchFn) {
    this.cwd = cwd;
    this.store = store;
    this.dispatch = dispatch;
  }

  async start(): Promise<void> {
    const acpCmd = this.resolveAcpCommand();

    this.proc = Bun.spawn(acpCmd, {
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

    const bridgeRef = this;

    this.connection = new ClientSideConnection(
      (_agent: Agent): Client => ({
        async sessionUpdate(params: SessionNotification): Promise<void> {
          const isLoading = bridgeRef.loadingSessions.has(params.sessionId);
          const items = translateAcpToCommands(params.update, isLoading);
          for (const item of items) {
            if (isLoading) {
              // During replay: use appendReplay (skip subscribers/processors)
              bridgeRef.store.appendReplay(params.sessionId, item as EventPayload);
            } else {
              // Live: dispatch as a command
              await bridgeRef.dispatch(params.sessionId, item as ServerCommand);
            }
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
        bridgeRef.dispatch("__system__", {
          type: "RecordError",
          message: `claude-code-acp exited with code ${code}`,
        }).catch(() => {});
      }
    });
  }

  async createSession(): Promise<string> {
    if (!this.connection) {
      throw new Error("ACP connection not initialized");
    }

    const _meta: Record<string, unknown> = {
      claudeCode: {
        options: {
          disallowedTools: ["EnterPlanMode", "ExitPlanMode"],
        },
      },
      systemPrompt: {
        append: "Specs live in .conclave/specs/<name>/. Each spec directory contains phase files (analysis.md, implementation.md) and an optional spec.json with description, type, and epic fields.",
      },
    };

    const sessionResp = await this.connection.newSession({
      cwd: this.cwd,
      mcpServers: [],
      _meta,
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

  async submitPrompt(sessionId: string, text: string, images?: ImageAttachment[], skipPromptEvent = false): Promise<void> {
    if (!this.connection) {
      await this.dispatch(sessionId, { type: "RecordError", message: "ACP connection not initialized" });
      return;
    }

    if (!skipPromptEvent) {
      await this.dispatch(sessionId, { type: "SubmitPrompt", text, images });
    }

    try {
      const prompt = buildPromptBlocks(text, images);

      if (prompt.length === 0) {
        await this.dispatch(sessionId, { type: "RecordError", message: "Cannot submit an empty prompt" });
        return;
      }

      const resp = await this.connection.prompt({
        sessionId: sessionId as SessionId,
        prompt,
      });

      await this.dispatch(sessionId, {
        type: "CompleteTurn",
        stopReason: resp.stopReason,
      });
    } catch (err) {
      console.error("Prompt error:", err);
      await this.dispatch(sessionId, {
        type: "RecordError",
        message: formatError(err),
      });
    }
  }

  async stop(): Promise<void> {
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
    this.connection = null;
  }

  async cancel(sessionId: string): Promise<void> {
    if (!this.connection) return;

    try {
      await this.connection.cancel({
        sessionId: sessionId as SessionId,
      });
    } catch (err) {
      await this.dispatch(sessionId, {
        type: "RecordError",
        message: `Cancel failed: ${formatError(err)}`,
      });
    }
  }

  private resolveAcpCommand(): string[] {
    const localEntry = join(import.meta.dir, "..", "node_modules", "@zed-industries", "claude-code-acp", "dist", "index.js");
    if (existsSync(localEntry)) {
      return ["bun", "run", localEntry];
    }

    const bin = Bun.which("claude-code-acp");
    if (bin) {
      return [bin];
    }

    throw new Error(
      "claude-code-acp not found. Install it with: bun add @zed-industries/claude-code-acp",
    );
  }
}

export function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string") {
      const data = obj.data as Record<string, unknown> | undefined;
      if (data && typeof data.details === "string") {
        return `${obj.message}: ${data.details}`;
      }
      return obj.message;
    }
    try { return JSON.stringify(err); } catch { /* fall through */ }
  }
  return String(err);
}
