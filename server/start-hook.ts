import { join } from "path";

export function runStartHook(cwd: string): void {
  const hookPath = join(cwd, ".conclave/hooks/start");
  const file = Bun.file(hookPath);

  file.exists().then((exists) => {
    if (!exists) return;

    console.log(`Running start hook: ${hookPath}`);
    const proc = Bun.spawn([hookPath], { cwd });

    // Log stderr errors but don't throw
    new Response(proc.stderr).text().then((text) => {
      if (text.trim()) {
        console.error(`Start hook stderr: ${text.trim()}`);
      }
    });
  });
}
