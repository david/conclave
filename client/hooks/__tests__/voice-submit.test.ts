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

    act(() => {
      result.current.start();
    });
    rerender();

    const instance = instances[instances.length - 1];
    act(() => {
      instance.onresult?.(makeFinalEvent("hello world send"));
    });
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

    act(() => {
      result.current.start();
    });
    rerender();

    const instance = instances[instances.length - 1];
    act(() => {
      instance.onresult?.(makeFinalEvent("check this out Send"));
    });
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

    act(() => {
      result.current.start();
    });
    rerender();

    const instance = instances[instances.length - 1];
    act(() => {
      instance.onresult?.(makeFinalEvent("send"));
    });
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

    act(() => {
      result.current.start();
    });
    rerender();

    const instance = instances[instances.length - 1];
    act(() => {
      instance.onresult?.(makeFinalEvent("hello world"));
    });
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

    act(() => {
      result.current.start();
    });
    rerender();

    expect(result.current.isListening).toBe(true);

    const instance = instances[instances.length - 1];
    act(() => {
      instance.onresult?.(makeFinalEvent("do the thing send"));
    });
    rerender();

    expect(instance.stopCallCount).toBe(1);
    expect(result.current.isListening).toBe(false);
  });
});
