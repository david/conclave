import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import "./test-setup.ts";

import React from "react";
import { act } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { useSpeechRecognition } from "./use-speech-recognition.ts";

function renderHook<T>(
  hookFn: () => T
): { result: { current: T }; rerender: () => void } {
  const result = { current: null as T };
  function TestComponent() {
    result.current = hookFn();
    return null;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  flushSync(() => {
    root.render(React.createElement(TestComponent));
  });
  return {
    result,
    rerender: () =>
      flushSync(() => {
        root.render(React.createElement(TestComponent));
      }),
  };
}

const instances: MockSpeechRecognition[] = [];

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  onend: (() => void) | null = null;
  startCallCount = 0;
  stopCallCount = 0;

  constructor() {
    instances.push(this);
  }

  start() {
    this.startCallCount++;
  }

  stop() {
    this.stopCallCount++;
  }
}

// ── UC-8: Feature Detection ────────────────────────────────────────

describe("useSpeechRecognition — feature detection (UC-8)", () => {
  let savedSpeechRecognition: unknown;
  let savedWebkitSpeechRecognition: unknown;

  beforeEach(() => {
    savedSpeechRecognition = (window as any).SpeechRecognition;
    savedWebkitSpeechRecognition = (window as any).webkitSpeechRecognition;
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;
  });

  afterEach(() => {
    if (savedSpeechRecognition !== undefined) {
      (window as any).SpeechRecognition = savedSpeechRecognition;
    } else {
      delete (window as any).SpeechRecognition;
    }
    if (savedWebkitSpeechRecognition !== undefined) {
      (window as any).webkitSpeechRecognition = savedWebkitSpeechRecognition;
    } else {
      delete (window as any).webkitSpeechRecognition;
    }
  });

  test("returns isSupported: false when both SpeechRecognition and webkitSpeechRecognition are undefined", () => {
    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.isSupported).toBe(false);
  });

  test("returns isSupported: true when window.SpeechRecognition is defined", () => {
    (window as any).SpeechRecognition = class MockSpeechRecognition {};
    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.isSupported).toBe(true);
  });

  test("returns isSupported: true when only window.webkitSpeechRecognition is defined", () => {
    (window as any).webkitSpeechRecognition = class MockWebkitSpeechRecognition {};
    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.isSupported).toBe(true);
  });

  test("returns isSupported: false on insecure context even when SpeechRecognition exists", () => {
    (window as any).SpeechRecognition = class MockSpeechRecognition {};
    (window as any).isSecureContext = false;
    try {
      const { result } = renderHook(() => useSpeechRecognition());
      expect(result.current.isSupported).toBe(false);
    } finally {
      (window as any).isSecureContext = true;
    }
  });
});

// ── UC-1, UC-4: Start/Stop ─────────────────────────────────────────

describe("useSpeechRecognition — start/stop (UC-1, UC-4)", () => {
  let savedSpeechRecognition: unknown;

  beforeEach(() => {
    instances.length = 0;
    savedSpeechRecognition = (window as any).SpeechRecognition;
    (window as any).SpeechRecognition = MockSpeechRecognition;
  });

  afterEach(() => {
    if (savedSpeechRecognition !== undefined) {
      (window as any).SpeechRecognition = savedSpeechRecognition;
    } else {
      delete (window as any).SpeechRecognition;
    }
  });

  test("calling start() sets isListening to true and calls recognition.start()", () => {
    const { result, rerender } = renderHook(() => useSpeechRecognition());

    expect(result.current.isListening).toBe(false);

    act(() => {
      result.current.start();
    });
    rerender();

    expect(result.current.isListening).toBe(true);
    expect(instances.length).toBeGreaterThanOrEqual(1);
    const instance = instances[instances.length - 1];
    expect(instance.startCallCount).toBe(1);
  });

  test("calling stop() sets isListening to false and calls recognition.stop()", () => {
    const { result, rerender } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.start();
    });
    rerender();

    expect(result.current.isListening).toBe(true);

    act(() => {
      result.current.stop();
    });
    rerender();

    expect(result.current.isListening).toBe(false);
    const instance = instances[instances.length - 1];
    expect(instance.stopCallCount).toBe(1);
  });

  test("when onend fires without manual stop(), auto-restart keeps isListening true", () => {
    const { result, rerender } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.start();
    });
    rerender();

    expect(result.current.isListening).toBe(true);

    const instance = instances[instances.length - 1];
    act(() => {
      instance.onend?.();
    });
    rerender();

    expect(result.current.isListening).toBe(true);
    expect(instance.startCallCount).toBeGreaterThanOrEqual(2);
    expect(instance.stopCallCount).toBe(0);
  });

  test("SpeechRecognition instance is configured with continuous=true, interimResults=true, lang='en-US'", () => {
    const { result, rerender } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.start();
    });
    rerender();

    expect(instances.length).toBeGreaterThanOrEqual(1);
    const instance = instances[instances.length - 1];
    expect(instance.continuous).toBe(true);
    expect(instance.interimResults).toBe(true);
    expect(instance.lang).toBe("en-US");
  });
});

// ── UC-2, UC-3, UC-6: Streaming Results ────────────────────────────

describe("useSpeechRecognition — streaming results (UC-2, UC-3, UC-6)", () => {
  let savedSpeechRecognition: unknown;

  beforeEach(() => {
    instances.length = 0;
    savedSpeechRecognition = (window as any).SpeechRecognition;
    (window as any).SpeechRecognition = MockSpeechRecognition;
  });

  afterEach(() => {
    if (savedSpeechRecognition !== undefined) {
      (window as any).SpeechRecognition = savedSpeechRecognition;
    } else {
      delete (window as any).SpeechRecognition;
    }
  });

  test("interim result (isFinal: false) updates interimText to the transcript", () => {
    const onFinalResult = mock(() => {});
    const onVoiceSubmit = mock(() => {});
    const { result, rerender } = renderHook(() =>
      useSpeechRecognition({ onFinalResult, onVoiceSubmit })
    );

    act(() => {
      result.current.start();
    });
    rerender();

    const instance = instances[instances.length - 1];
    act(() => {
      instance.onresult?.({
        resultIndex: 0,
        results: {
          0: { 0: { transcript: "hello world" }, isFinal: false, length: 1 },
          length: 1,
        },
      });
    });
    rerender();

    expect(result.current.interimText).toBe("hello world");
    expect(onFinalResult).not.toHaveBeenCalled();
  });

  test("final result (isFinal: true) calls onFinalResult and clears interimText", () => {
    const onFinalResult = mock(() => {});
    const onVoiceSubmit = mock(() => {});
    const { result, rerender } = renderHook(() =>
      useSpeechRecognition({ onFinalResult, onVoiceSubmit })
    );

    act(() => {
      result.current.start();
    });
    rerender();

    const instance = instances[instances.length - 1];
    act(() => {
      instance.onresult?.({
        resultIndex: 0,
        results: {
          0: { 0: { transcript: "hello world" }, isFinal: true, length: 1 },
          length: 1,
        },
      });
    });
    rerender();

    expect(onFinalResult).toHaveBeenCalledTimes(1);
    expect(onFinalResult).toHaveBeenCalledWith("hello world");
    expect(result.current.interimText).toBe("");
  });

  test("multiple interim results update interimText each time (last one wins)", () => {
    const onFinalResult = mock(() => {});
    const onVoiceSubmit = mock(() => {});
    const { result, rerender } = renderHook(() =>
      useSpeechRecognition({ onFinalResult, onVoiceSubmit })
    );

    act(() => {
      result.current.start();
    });
    rerender();

    const instance = instances[instances.length - 1];

    act(() => {
      instance.onresult?.({
        resultIndex: 0,
        results: { 0: { 0: { transcript: "hel" }, isFinal: false, length: 1 }, length: 1 },
      });
    });
    rerender();
    expect(result.current.interimText).toBe("hel");

    act(() => {
      instance.onresult?.({
        resultIndex: 0,
        results: { 0: { 0: { transcript: "hello wo" }, isFinal: false, length: 1 }, length: 1 },
      });
    });
    rerender();
    expect(result.current.interimText).toBe("hello wo");

    act(() => {
      instance.onresult?.({
        resultIndex: 0,
        results: { 0: { 0: { transcript: "hello world" }, isFinal: false, length: 1 }, length: 1 },
      });
    });
    rerender();
    expect(result.current.interimText).toBe("hello world");
  });

  test("after a final result, subsequent interim results for a new phrase work correctly", () => {
    const onFinalResult = mock(() => {});
    const onVoiceSubmit = mock(() => {});
    const { result, rerender } = renderHook(() =>
      useSpeechRecognition({ onFinalResult, onVoiceSubmit })
    );

    act(() => {
      result.current.start();
    });
    rerender();

    const instance = instances[instances.length - 1];

    // First phrase: interim then final
    act(() => {
      instance.onresult?.({
        resultIndex: 0,
        results: { 0: { 0: { transcript: "first phrase" }, isFinal: false, length: 1 }, length: 1 },
      });
    });
    rerender();
    expect(result.current.interimText).toBe("first phrase");

    act(() => {
      instance.onresult?.({
        resultIndex: 0,
        results: { 0: { 0: { transcript: "first phrase" }, isFinal: true, length: 1 }, length: 1 },
      });
    });
    rerender();
    expect(onFinalResult).toHaveBeenCalledTimes(1);
    expect(onFinalResult).toHaveBeenCalledWith("first phrase");
    expect(result.current.interimText).toBe("");

    // Second phrase: new interim results
    act(() => {
      instance.onresult?.({
        resultIndex: 1,
        results: {
          0: { 0: { transcript: "first phrase" }, isFinal: true, length: 1 },
          1: { 0: { transcript: "second" }, isFinal: false, length: 1 },
          length: 2,
        },
      });
    });
    rerender();
    expect(result.current.interimText).toBe("second");

    act(() => {
      instance.onresult?.({
        resultIndex: 1,
        results: {
          0: { 0: { transcript: "first phrase" }, isFinal: true, length: 1 },
          1: { 0: { transcript: "second phrase" }, isFinal: false, length: 1 },
          length: 2,
        },
      });
    });
    rerender();
    expect(result.current.interimText).toBe("second phrase");
  });
});

// ── UC-5: Voice Submit ─────────────────────────────────────────────

const makeFinalEvent = (transcript: string) => ({
  resultIndex: 0,
  results: { 0: { 0: { transcript }, isFinal: true, length: 1 }, length: 1 },
});

describe("useSpeechRecognition — voice submit (UC-5)", () => {
  let savedSpeechRecognition: unknown;

  beforeEach(() => {
    instances.length = 0;
    savedSpeechRecognition = (window as any).SpeechRecognition;
    (window as any).SpeechRecognition = MockSpeechRecognition;
  });

  afterEach(() => {
    if (savedSpeechRecognition !== undefined) {
      (window as any).SpeechRecognition = savedSpeechRecognition;
    } else {
      delete (window as any).SpeechRecognition;
    }
  });

  test("final result ending with ' send' triggers onVoiceSubmit with trimmed transcript, not onFinalResult", () => {
    const mockFinalResult = mock(() => {});
    const mockVoiceSubmit = mock(() => {});
    const { result, rerender } = renderHook(() =>
      useSpeechRecognition({ onFinalResult: mockFinalResult, onVoiceSubmit: mockVoiceSubmit })
    );

    act(() => { result.current.start(); });
    rerender();

    const instance = instances[instances.length - 1];
    act(() => { instance.onresult?.(makeFinalEvent("hello world send")); });
    rerender();

    expect(mockVoiceSubmit).toHaveBeenCalledTimes(1);
    expect(mockVoiceSubmit).toHaveBeenCalledWith("hello world");
    expect(mockFinalResult).not.toHaveBeenCalled();
  });

  test("final result ending with ' Send' (capital S) triggers onVoiceSubmit (case-insensitive)", () => {
    const mockFinalResult = mock(() => {});
    const mockVoiceSubmit = mock(() => {});
    const { result, rerender } = renderHook(() =>
      useSpeechRecognition({ onFinalResult: mockFinalResult, onVoiceSubmit: mockVoiceSubmit })
    );

    act(() => { result.current.start(); });
    rerender();

    const instance = instances[instances.length - 1];
    act(() => { instance.onresult?.(makeFinalEvent("check this out Send")); });
    rerender();

    expect(mockVoiceSubmit).toHaveBeenCalledTimes(1);
    expect(mockVoiceSubmit).toHaveBeenCalledWith("check this out");
    expect(mockFinalResult).not.toHaveBeenCalled();
  });

  test("final result that is just 'send' triggers onVoiceSubmit with empty string", () => {
    const mockFinalResult = mock(() => {});
    const mockVoiceSubmit = mock(() => {});
    const { result, rerender } = renderHook(() =>
      useSpeechRecognition({ onFinalResult: mockFinalResult, onVoiceSubmit: mockVoiceSubmit })
    );

    act(() => { result.current.start(); });
    rerender();

    const instance = instances[instances.length - 1];
    act(() => { instance.onresult?.(makeFinalEvent("send")); });
    rerender();

    expect(mockVoiceSubmit).toHaveBeenCalledTimes(1);
    expect(mockVoiceSubmit).toHaveBeenCalledWith("");
    expect(mockFinalResult).not.toHaveBeenCalled();
  });

  test("final result NOT ending with 'send' triggers onFinalResult, not onVoiceSubmit", () => {
    const mockFinalResult = mock(() => {});
    const mockVoiceSubmit = mock(() => {});
    const { result, rerender } = renderHook(() =>
      useSpeechRecognition({ onFinalResult: mockFinalResult, onVoiceSubmit: mockVoiceSubmit })
    );

    act(() => { result.current.start(); });
    rerender();

    const instance = instances[instances.length - 1];
    act(() => { instance.onresult?.(makeFinalEvent("hello world")); });
    rerender();

    expect(mockFinalResult).toHaveBeenCalledTimes(1);
    expect(mockFinalResult).toHaveBeenCalledWith("hello world");
    expect(mockVoiceSubmit).not.toHaveBeenCalled();
  });

  test("after voice submit trigger, stop() is called and isListening becomes false", () => {
    const mockFinalResult = mock(() => {});
    const mockVoiceSubmit = mock(() => {});
    const { result, rerender } = renderHook(() =>
      useSpeechRecognition({ onFinalResult: mockFinalResult, onVoiceSubmit: mockVoiceSubmit })
    );

    act(() => { result.current.start(); });
    rerender();
    expect(result.current.isListening).toBe(true);

    const instance = instances[instances.length - 1];
    act(() => { instance.onresult?.(makeFinalEvent("do the thing send")); });
    rerender();

    expect(instance.stopCallCount).toBe(1);
    expect(result.current.isListening).toBe(false);
  });
});

// ── UC-7: Permission Denied ────────────────────────────────────────

describe("useSpeechRecognition — permission denied (UC-7)", () => {
  let savedSpeechRecognition: unknown;

  beforeEach(() => {
    instances.length = 0;
    savedSpeechRecognition = (window as any).SpeechRecognition;
    (window as any).SpeechRecognition = MockSpeechRecognition;
  });

  afterEach(() => {
    if (savedSpeechRecognition !== undefined) {
      (window as any).SpeechRecognition = savedSpeechRecognition;
    } else {
      delete (window as any).SpeechRecognition;
    }
  });

  test("onerror with 'not-allowed' sets error to 'permission-denied' and isListening to false", () => {
    const { result, rerender } = renderHook(() => useSpeechRecognition());

    act(() => { result.current.start(); });
    rerender();
    expect(result.current.isListening).toBe(true);

    const instance = instances[instances.length - 1];
    act(() => { instance.onerror?.({ error: "not-allowed" }); });
    rerender();

    expect(result.current.error).toBe("permission-denied");
    expect(result.current.isListening).toBe(false);
  });

  test("after permission error, calling start() clears the error and re-attempts", () => {
    const { result, rerender } = renderHook(() => useSpeechRecognition());

    act(() => { result.current.start(); });
    rerender();

    const instance = instances[instances.length - 1];
    act(() => { instance.onerror?.({ error: "not-allowed" }); });
    rerender();
    expect(result.current.error).toBe("permission-denied");

    act(() => { result.current.start(); });
    rerender();

    expect(result.current.error).toBeNull();
    expect(result.current.isListening).toBe(true);
  });
});

// ── UC-9: Error Recovery ───────────────────────────────────────────

describe("useSpeechRecognition — error recovery (UC-9)", () => {
  let savedSpeechRecognition: unknown;

  beforeEach(() => {
    instances.length = 0;
    savedSpeechRecognition = (window as any).SpeechRecognition;
    (window as any).SpeechRecognition = MockSpeechRecognition;
  });

  afterEach(() => {
    if (savedSpeechRecognition !== undefined) {
      (window as any).SpeechRecognition = savedSpeechRecognition;
    } else {
      delete (window as any).SpeechRecognition;
    }
  });

  test("onerror with 'network' sets error to 'network' and isListening to false", () => {
    const { result, rerender } = renderHook(() => useSpeechRecognition());

    act(() => { result.current.start(); });
    rerender();
    expect(result.current.isListening).toBe(true);

    const instance = instances[instances.length - 1];
    act(() => { instance.onerror?.({ error: "network" }); });
    rerender();

    expect(result.current.error).toBe("network");
    expect(result.current.isListening).toBe(false);
  });

  test("onerror with 'no-speech' sets error to 'no-speech' and isListening to false", () => {
    const { result, rerender } = renderHook(() => useSpeechRecognition());

    act(() => { result.current.start(); });
    rerender();
    expect(result.current.isListening).toBe(true);

    const instance = instances[instances.length - 1];
    act(() => { instance.onerror?.({ error: "no-speech" }); });
    rerender();

    expect(result.current.error).toBe("no-speech");
    expect(result.current.isListening).toBe(false);
  });

  test("calling start() after an error clears the error state", () => {
    const { result, rerender } = renderHook(() => useSpeechRecognition());

    act(() => { result.current.start(); });
    rerender();

    const instance = instances[instances.length - 1];
    act(() => { instance.onerror?.({ error: "network" }); });
    rerender();
    expect(result.current.error).toBe("network");

    act(() => { result.current.start(); });
    rerender();

    expect(result.current.error).toBeNull();
    expect(result.current.isListening).toBe(true);
  });
});

// ── UC-10: Auto-Restart ────────────────────────────────────────────

describe("useSpeechRecognition — auto-restart (UC-10)", () => {
  let savedSpeechRecognition: unknown;

  beforeEach(() => {
    instances.length = 0;
    savedSpeechRecognition = (window as any).SpeechRecognition;
    (window as any).SpeechRecognition = MockSpeechRecognition;
  });

  afterEach(() => {
    if (savedSpeechRecognition !== undefined) {
      (window as any).SpeechRecognition = savedSpeechRecognition;
    } else {
      delete (window as any).SpeechRecognition;
    }
  });

  test("auto-restarts when onend fires without preceding stop() or error", () => {
    const { result, rerender } = renderHook(() => useSpeechRecognition());

    act(() => { result.current.start(); });
    rerender();

    expect(result.current.isListening).toBe(true);
    const instance = instances[instances.length - 1];
    expect(instance.startCallCount).toBe(1);

    act(() => { instance.onend?.(); });
    rerender();

    expect(instance.startCallCount).toBeGreaterThanOrEqual(2);
    expect(result.current.isListening).toBe(true);
  });

  test("does not restart when onend fires after explicit stop()", () => {
    const { result, rerender } = renderHook(() => useSpeechRecognition());

    act(() => { result.current.start(); });
    rerender();

    const instance = instances[instances.length - 1];
    const startCountAfterStart = instance.startCallCount;

    act(() => { result.current.stop(); });
    rerender();
    expect(instance.stopCallCount).toBe(1);

    act(() => { instance.onend?.(); });
    rerender();

    expect(instance.startCallCount).toBe(startCountAfterStart);
    expect(result.current.isListening).toBe(false);
  });

  test("does not restart when onend fires after an error", () => {
    const { result, rerender } = renderHook(() => useSpeechRecognition());

    act(() => { result.current.start(); });
    rerender();

    const instance = instances[instances.length - 1];
    const startCountAfterStart = instance.startCallCount;

    act(() => { instance.onerror?.({ error: "network" }); });
    rerender();

    act(() => { instance.onend?.(); });
    rerender();

    expect(instance.startCallCount).toBe(startCountAfterStart);
  });

  test("guards against rapid restart loops (onend immediately after start)", () => {
    const { result, rerender } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.start();
      const instance = instances[instances.length - 1];
      instance.onend?.();
    });
    rerender();

    const instance = instances[instances.length - 1];
    expect(instance.startCallCount).toBe(1);
  });
});
