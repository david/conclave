import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
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

    // Start listening
    act(() => {
      result.current.start();
    });
    rerender();

    const instance = instances[instances.length - 1];

    // Fire an interim result
    const interimEvent = {
      resultIndex: 0,
      results: {
        0: { 0: { transcript: "hello world" }, isFinal: false, length: 1 },
        length: 1,
      },
    };
    act(() => {
      instance.onresult?.(interimEvent);
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

    // Start listening
    act(() => {
      result.current.start();
    });
    rerender();

    const instance = instances[instances.length - 1];

    // Fire a final result
    const finalEvent = {
      resultIndex: 0,
      results: {
        0: { 0: { transcript: "hello world" }, isFinal: true, length: 1 },
        length: 1,
      },
    };
    act(() => {
      instance.onresult?.(finalEvent);
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

    // Start listening
    act(() => {
      result.current.start();
    });
    rerender();

    const instance = instances[instances.length - 1];

    // Fire first interim result
    act(() => {
      instance.onresult?.({
        resultIndex: 0,
        results: {
          0: { 0: { transcript: "hel" }, isFinal: false, length: 1 },
          length: 1,
        },
      });
    });
    rerender();

    expect(result.current.interimText).toBe("hel");

    // Fire second interim result
    act(() => {
      instance.onresult?.({
        resultIndex: 0,
        results: {
          0: { 0: { transcript: "hello wo" }, isFinal: false, length: 1 },
          length: 1,
        },
      });
    });
    rerender();

    expect(result.current.interimText).toBe("hello wo");

    // Fire third interim result
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
  });

  test("after a final result, subsequent interim results for a new phrase work correctly", () => {
    const onFinalResult = mock(() => {});
    const onVoiceSubmit = mock(() => {});
    const { result, rerender } = renderHook(() =>
      useSpeechRecognition({ onFinalResult, onVoiceSubmit })
    );

    // Start listening
    act(() => {
      result.current.start();
    });
    rerender();

    const instance = instances[instances.length - 1];

    // First phrase: interim then final
    act(() => {
      instance.onresult?.({
        resultIndex: 0,
        results: {
          0: { 0: { transcript: "first phrase" }, isFinal: false, length: 1 },
          length: 1,
        },
      });
    });
    rerender();

    expect(result.current.interimText).toBe("first phrase");

    act(() => {
      instance.onresult?.({
        resultIndex: 0,
        results: {
          0: { 0: { transcript: "first phrase" }, isFinal: true, length: 1 },
          length: 1,
        },
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
          1: {
            0: { transcript: "second phrase" },
            isFinal: false,
            length: 1,
          },
          length: 2,
        },
      });
    });
    rerender();

    expect(result.current.interimText).toBe("second phrase");
  });
});
