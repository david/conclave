const SESSION_PREFIX = "/session/";

export function getSessionIdFromUrl(): string | null {
  const { pathname } = window.location;
  if (pathname.startsWith(SESSION_PREFIX)) {
    const id = pathname.slice(SESSION_PREFIX.length);
    return id || null;
  }
  return null;
}

export function pushSessionUrl(sessionId: string): void {
  const target = SESSION_PREFIX + sessionId;
  if (window.location.pathname !== target) {
    history.pushState({ sessionId }, "", target);
  }
}

export function replaceSessionUrl(sessionId: string): void {
  const target = SESSION_PREFIX + sessionId;
  if (window.location.pathname !== target) {
    history.replaceState({ sessionId }, "", target);
  }
}

export function onPopState(callback: (sessionId: string | null) => void): () => void {
  const handler = () => callback(getSessionIdFromUrl());
  window.addEventListener("popstate", handler);
  return () => window.removeEventListener("popstate", handler);
}
