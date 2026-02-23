import { describe, test, expect } from "bun:test";
import "./setup.ts";

import React, { useState } from "react";
import { createRoot } from "react-dom/client";

function renderHook<T>(hookFn: () => T): { result: { current: T } } {
  const result = { current: null as T };
  function TestComponent() {
    result.current = hookFn();
    return null;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  root.render(React.createElement(TestComponent));
  return { result };
}

describe("renderHook", () => {
  test("captures hook return value", () => {
    const { result } = renderHook(() => useState(42));
    expect(result.current[0]).toBe(42);
  });
});
