/**
 * Get the WebSocket base URL for connecting to the backend.
 *
 * In production (static export served by FastAPI), the backend is the same host.
 * In development, Next.js rewrites don't support WebSocket upgrades,
 * so we connect directly to the backend on port 8000.
 */
export function getWsBaseUrl(): string {
  if (typeof window === "undefined") return "";

  const isDev = window.location.port === "3000";
  if (isDev) {
    return "ws://localhost:8000";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}
