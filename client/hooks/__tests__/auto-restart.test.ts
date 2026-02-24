import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import "./setup.ts";

import React from "react";
import { act } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { useSpeechRecognition } from "../use-speech-recognition.ts";

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

    // Start listening
    act(() => {
      result.current.start();
    });
    rerender();

    expect(result.current.isListening).toBe(true);
    const instance = instances[instances.length - 1];
    expect(instance.startCallCount).toBe(1);

    // Simulate browser-initiated onend (no user stop, no error)
    act(() => {
      instance.onend?.();
    });
    rerender();

    // Should have auto-restarted: start() called again, still listening
    expect(instance.startCallCount).toBeGreaterThanOrEqual(2);
    expect(result.current.isListening).toBe(true);
  });

  test("does not restart when onend fires after explicit stop()", () => {
    const { result, rerender } = renderHook(() => useSpeechRecognition());

    // Start listening
    act(() => {
      result.current.start();
    });
    rerender();

    const instance = instances[instances.length - 1];
    const startCountAfterStart = instance.startCallCount;

    // User explicitly stops
    act(() => {
      result.current.stop();
    });
    rerender();

    expect(instance.stopCallCount).toBe(1);

    // Browser fires onend after stop
    act(() => {
      instance.onend?.();
    });
    rerender();

    // Should NOT have restarted
    expect(instance.startCallCount).toBe(startCountAfterStart);
    expect(result.current.isListening).toBe(false);
  });

  test("does not restart when onend fires after an error", () => {
    const { result, rerender } = renderHook(() => useSpeechRecognition());

    // Start listening
    act(() => {
      result.current.start();
    });
    rerender();

    const instance = instances[instances.length - 1];
    const startCountAfterStart = instance.startCallCount;

    // Simulate an error occurring
    act(() => {
      instance.onerror?.({ error: "network" });
    });
    rerender();

    // Browser fires onend after error
    act(() => {
      instance.onend?.();
    });
    rerender();

    // Should NOT have restarted after error
    expect(instance.startCallCount).toBe(startCountAfterStart);
  });

  test("guards against rapid restart loops (onend immediately after start)", () => {
    const { result, rerender } = renderHook(() => useSpeechRecognition());

    // Start and immediately trigger onend in the same act block — simulates
    // the browser rejecting the start synchronously (no time elapses)
    act(() => {
      result.current.start();
      const instance = instances[instances.length - 1];
      instance.onend?.();
    });
    rerender();

    const instance = instances[instances.length - 1];
    // Should NOT restart to prevent infinite loop — startCallCount stays at 1
    expect(instance.startCallCount).toBe(1);
  });
});
