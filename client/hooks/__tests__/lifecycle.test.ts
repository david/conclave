import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

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

    // First start listening
    act(() => {
      result.current.start();
    });
    rerender();

    expect(result.current.isListening).toBe(true);

    // Now stop
    act(() => {
      result.current.stop();
    });
    rerender();

    expect(result.current.isListening).toBe(false);
    const instance = instances[instances.length - 1];
    expect(instance.stopCallCount).toBe(1);
  });

  test("when onend fires without manual stop(), isListening is set to false", () => {
    const { result, rerender } = renderHook(() => useSpeechRecognition());

    // Start listening
    act(() => {
      result.current.start();
    });
    rerender();

    expect(result.current.isListening).toBe(true);

    // Simulate the browser firing onend (e.g. speech timeout, not user-initiated stop)
    const instance = instances[instances.length - 1];
    act(() => {
      if (instance.onend) {
        instance.onend();
      }
    });
    rerender();

    expect(result.current.isListening).toBe(false);
    // stop() was NOT called by the user, so stopCallCount should be 0
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
