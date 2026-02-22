import type { ServiceProcess } from "./types.ts";

export function parseProcesses(data: unknown): ServiceProcess[] {
  if (!data || typeof data !== "object") return [];
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.data)) return [];

  return obj.data.map((entry: any) => ({
    name: String(entry.name ?? ""),
    status: String(entry.status ?? ""),
    uptime: String(entry.uptime ?? ""),
  }));
}

type ServiceStatusPollerOptions = {
  apiUrl: string;
  intervalMs: number;
  onUpdate: (available: boolean, services: ServiceProcess[]) => void;
};

export function startServiceStatusPoller(options: ServiceStatusPollerOptions): { stop: () => void } {
  const tick = async () => {
    try {
      const res = await fetch(options.apiUrl);
      if (!res.ok) {
        options.onUpdate(false, []);
        return;
      }
      const json = await res.json();
      const services = parseProcesses(json);
      options.onUpdate(true, services);
    } catch {
      options.onUpdate(false, []);
    }
  };

  // Run immediately, then on interval
  tick();
  const timer = setInterval(tick, options.intervalMs);

  return {
    stop: () => clearInterval(timer),
  };
}
