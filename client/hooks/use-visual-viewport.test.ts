import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import "./test-setup.ts";

import React from "react";
import { act } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { useVisualViewport } from "./use-visual-viewport.ts";

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

// ── Mock visualViewport ────────────────────────────────────────────

class MockVisualViewport extends EventTarget {
  private _height: number;

  constructor(height: number) {
    super();
    this._height = height;
  }

  get height() {
    return this._height;
  }

  set height(value: number) {
    this._height = value;
  }
}

describe("useVisualViewport", () => {
  let savedVisualViewport: unknown;
  let mockViewport: MockVisualViewport;

  beforeEach(() => {
    savedVisualViewport = (window as any).visualViewport;
    // Set up a mock visualViewport with height matching window.innerHeight
    mockViewport = new MockVisualViewport(window.innerHeight);
    (window as any).visualViewport = mockViewport;
  });

  afterEach(() => {
    if (savedVisualViewport !== undefined) {
      (window as any).visualViewport = savedVisualViewport;
    } else {
      delete (window as any).visualViewport;
    }
  });

  // ── Test 1: Initial viewportHeight matches visualViewport.height ──

  test("returns initial viewportHeight matching window.visualViewport.height", () => {
    mockViewport.height = 800;
    const { result } = renderHook(() => useVisualViewport());
    // The stub returns window.innerHeight, which may or may not equal 800.
    // A correct implementation should read from visualViewport.height.
    expect(result.current.viewportHeight).toBe(800);
  });

  // ── Test 2: keyboardOpen is false when viewport height equals innerHeight ──

  test("returns keyboardOpen: false when viewport height equals innerHeight", () => {
    mockViewport.height = window.innerHeight;
    const { result } = renderHook(() => useVisualViewport());
    expect(result.current.keyboardOpen).toBe(false);
  });

  // ── Test 3: keyboardOpen flips to true when viewport height < 75% of innerHeight ──

  test("keyboardOpen becomes true when resize event fires with height < 75% of innerHeight", () => {
    const { result, rerender } = renderHook(() => useVisualViewport());

    // Initially keyboard is not open
    expect(result.current.keyboardOpen).toBe(false);

    // Simulate the virtual keyboard opening: viewport shrinks to 50% of innerHeight
    const reducedHeight = Math.floor(window.innerHeight * 0.5);
    mockViewport.height = reducedHeight;

    act(() => {
      mockViewport.dispatchEvent(new Event("resize"));
    });
    rerender();

    expect(result.current.keyboardOpen).toBe(true);
  });

  // ── Test 4: keyboardOpen returns to false when viewport height recovers ──

  test("keyboardOpen returns to false when viewport height recovers to >= 75% of innerHeight", () => {
    const { result, rerender } = renderHook(() => useVisualViewport());

    // First, simulate keyboard opening
    const reducedHeight = Math.floor(window.innerHeight * 0.5);
    mockViewport.height = reducedHeight;

    act(() => {
      mockViewport.dispatchEvent(new Event("resize"));
    });
    rerender();

    expect(result.current.keyboardOpen).toBe(true);

    // Now simulate keyboard closing: viewport returns to full height
    mockViewport.height = window.innerHeight;

    act(() => {
      mockViewport.dispatchEvent(new Event("resize"));
    });
    rerender();

    expect(result.current.keyboardOpen).toBe(false);
  });

  // ── Test 5: viewportHeight updates after resize events ──

  test("returns updated viewportHeight after resize events", () => {
    const { result, rerender } = renderHook(() => useVisualViewport());

    const newHeight = 400;
    mockViewport.height = newHeight;

    act(() => {
      mockViewport.dispatchEvent(new Event("resize"));
    });
    rerender();

    expect(result.current.viewportHeight).toBe(400);
  });

  // ── Fallback: uses window.innerHeight when visualViewport is not available ──

  test("falls back to window.innerHeight when visualViewport is not available", () => {
    delete (window as any).visualViewport;
    const { result } = renderHook(() => useVisualViewport());
    expect(result.current.viewportHeight).toBe(window.innerHeight);
    expect(result.current.keyboardOpen).toBe(false);
  });
});
