import { describe, test, expect, mock } from "bun:test";
import "../hooks/test-setup.ts";
import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { TabBar } from "./tab-bar.tsx";

function render(element: React.ReactElement) {
  const container = document.createElement("div");
  const root = createRoot(container);
  flushSync(() => {
    root.render(element);
  });
  return container;
}

describe("TabBar", () => {
  test("renders two tab buttons with labels 'Workspace' and 'Chat'", () => {
    const container = render(
      React.createElement(TabBar, { activePane: "chat", onSwitch: () => {} })
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toContain("Workspace");
    expect(buttons[1].textContent).toContain("Chat");
  });

  test("each tab button contains an SVG element (icon)", () => {
    const container = render(
      React.createElement(TabBar, { activePane: "chat", onSwitch: () => {} })
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(2);
    expect(buttons[0].querySelector("svg")).not.toBeNull();
    expect(buttons[1].querySelector("svg")).not.toBeNull();
  });

  test("clicking the Workspace tab calls onSwitch('workspace')", () => {
    const onSwitch = mock(() => {});
    const container = render(
      React.createElement(TabBar, { activePane: "chat", onSwitch })
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(2);
    buttons[0].click();
    expect(onSwitch).toHaveBeenCalledTimes(1);
    expect(onSwitch).toHaveBeenCalledWith("workspace");
  });

  test("clicking the Chat tab calls onSwitch('chat')", () => {
    const onSwitch = mock(() => {});
    const container = render(
      React.createElement(TabBar, { activePane: "workspace", onSwitch })
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(2);
    buttons[1].click();
    expect(onSwitch).toHaveBeenCalledTimes(1);
    expect(onSwitch).toHaveBeenCalledWith("chat");
  });

  test("when activePane is 'chat', the chat tab has the active class", () => {
    const container = render(
      React.createElement(TabBar, { activePane: "chat", onSwitch: () => {} })
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(2);
    expect(buttons[1].classList.contains("tab-bar__tab--active")).toBe(true);
    expect(buttons[0].classList.contains("tab-bar__tab--active")).toBe(false);
  });

  test("when activePane is 'workspace', the workspace tab has the active class", () => {
    const container = render(
      React.createElement(TabBar, { activePane: "workspace", onSwitch: () => {} })
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(2);
    expect(buttons[0].classList.contains("tab-bar__tab--active")).toBe(true);
    expect(buttons[1].classList.contains("tab-bar__tab--active")).toBe(false);
  });

  test("when chatNotification is true, a notification dot element renders on the chat tab", () => {
    const container = render(
      React.createElement(TabBar, {
        activePane: "workspace",
        onSwitch: () => {},
        chatNotification: true,
      })
    );
    const dots = container.querySelectorAll(".tab-bar__dot");
    expect(dots.length).toBe(1);
  });

  test("when chatNotification is false, no notification dot renders", () => {
    const container = render(
      React.createElement(TabBar, {
        activePane: "workspace",
        onSwitch: () => {},
        chatNotification: false,
      })
    );
    const dots = container.querySelectorAll(".tab-bar__dot");
    expect(dots.length).toBe(0);
  });

  test("when chatNotification is omitted, no notification dot renders", () => {
    const container = render(
      React.createElement(TabBar, { activePane: "chat", onSwitch: () => {} })
    );
    const dots = container.querySelectorAll(".tab-bar__dot");
    expect(dots.length).toBe(0);
  });
});
