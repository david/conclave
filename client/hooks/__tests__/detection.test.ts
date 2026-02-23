import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { useSpeechRecognition } from "../use-speech-recognition.ts";

function renderHook<T>(hookFn: () => T): { result: { current: T } } {
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
  return { result };
}

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
    // Both are deleted in beforeEach, so neither is available
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
});
