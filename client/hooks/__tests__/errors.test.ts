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

    // Start listening
    act(() => {
      result.current.start();
    });
    rerender();

    expect(result.current.isListening).toBe(true);

    // Simulate permission denied error
    const instance = instances[instances.length - 1];
    act(() => {
      instance.onerror?.({ error: "not-allowed" });
    });
    rerender();

    expect(result.current.error).toBe("permission-denied");
    expect(result.current.isListening).toBe(false);
  });

  test("after permission error, calling start() clears the error and re-attempts", () => {
    const { result, rerender } = renderHook(() => useSpeechRecognition());

    // Start listening
    act(() => {
      result.current.start();
    });
    rerender();

    // Simulate permission denied error
    const instance = instances[instances.length - 1];
    act(() => {
      instance.onerror?.({ error: "not-allowed" });
    });
    rerender();

    expect(result.current.error).toBe("permission-denied");

    // Call start() again — should clear the error
    act(() => {
      result.current.start();
    });
    rerender();

    expect(result.current.error).toBeNull();
    expect(result.current.isListening).toBe(true);
  });
});

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

    // Start listening
    act(() => {
      result.current.start();
    });
    rerender();

    expect(result.current.isListening).toBe(true);

    // Simulate network error
    const instance = instances[instances.length - 1];
    act(() => {
      instance.onerror?.({ error: "network" });
    });
    rerender();

    expect(result.current.error).toBe("network");
    expect(result.current.isListening).toBe(false);
  });

  test("onerror with 'no-speech' sets error to 'no-speech' and isListening to false", () => {
    const { result, rerender } = renderHook(() => useSpeechRecognition());

    // Start listening
    act(() => {
      result.current.start();
    });
    rerender();

    expect(result.current.isListening).toBe(true);

    // Simulate no-speech error
    const instance = instances[instances.length - 1];
    act(() => {
      instance.onerror?.({ error: "no-speech" });
    });
    rerender();

    expect(result.current.error).toBe("no-speech");
    expect(result.current.isListening).toBe(false);
  });

  test("calling start() after an error clears the error state", () => {
    const { result, rerender } = renderHook(() => useSpeechRecognition());

    // Start listening
    act(() => {
      result.current.start();
    });
    rerender();

    // Simulate network error
    const instance = instances[instances.length - 1];
    act(() => {
      instance.onerror?.({ error: "network" });
    });
    rerender();

    expect(result.current.error).toBe("network");

    // Call start() again — should clear the error
    act(() => {
      result.current.start();
    });
    rerender();

    expect(result.current.error).toBeNull();
    expect(result.current.isListening).toBe(true);
  });
});
