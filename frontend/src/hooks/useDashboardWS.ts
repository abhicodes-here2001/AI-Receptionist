"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getWsBaseUrl } from "./wsUrl";

interface CallLog {
  call_id: number;
  phone_number: string;
  caller_name: string | null;
  message: string;
  conversation_history: { role: string; text: string; timestamp: number }[];
  type: string;
  priority: "high" | "medium" | "low";
  language_states: string[];
  timestamp: number;
  action_taken: string;
  owner_verified_type: string | null;
}

const PRIORITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function sortByPriority(calls: CallLog[]): CallLog[] {
  return [...calls].sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3) ||
      b.timestamp - a.timestamp
  );
}

export type { CallLog };

export function useDashboardWS() {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    const ws = new WebSocket(`${getWsBaseUrl()}/ws/dashboard`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "full_sync") {
        setCalls(sortByPriority(msg.calls || []));
      } else if (msg.type === "new_call") {
        setCalls((prev) => sortByPriority([msg.call, ...prev]));
      } else if (msg.type === "call_updated") {
        setCalls((prev) =>
          sortByPriority(
            prev.map((c) => (c.call_id === msg.call.call_id ? msg.call : c))
          )
        );
      }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendAction = useCallback(
    (action: Record<string, unknown>) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(action));
      }
    },
    []
  );

  return { calls, connected, sendAction };
}
