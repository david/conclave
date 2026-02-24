import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!(globalThis as any).__happyDomRegistered) {
  GlobalRegistrator.register();
  (globalThis as any).__happyDomRegistered = true;
}

// happy-dom doesn't set isSecureContext; default to true for tests
if (typeof window !== "undefined" && window.isSecureContext === undefined) {
  Object.defineProperty(window, "isSecureContext", { value: true, writable: true, configurable: true });
}
