import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!(globalThis as any).__happyDomRegistered) {
  GlobalRegistrator.register();
  (globalThis as any).__happyDomRegistered = true;
}
