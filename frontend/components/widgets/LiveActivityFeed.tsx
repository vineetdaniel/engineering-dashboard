"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Radio, RadioOff, RefreshCw } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { Timeline, type TimelineEvent } from "./Timeline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApiFilters } from "@/lib/api";

interface LiveActivityFeedProps {
  filters?: ApiFilters;
  maxEvents?: number;
  className?: string;
}

interface StreamEvent {
  id: number;
  event_type: string;
  title: string;
  severity?: "low" | "medium" | "high" | "critical";
  status?: string;
  entity?: string;
  happened_at: string;
  meta?: Record<string, any>;
}

function buildStreamUrl(filters?: ApiFilters): string {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const params = new URLSearchParams();
  if (filters?.dateRange) params.set("dateRange", filters.dateRange);
  if (filters?.squad && filters.squad !== "all") params.set("squad", filters.squad);
  if (filters?.environment && filters.environment !== "all") params.set("environment", filters.environment);
  return `${base}/events/stream?${params.toString()}`;
}

export function LiveActivityFeed({ filters, maxEvents = 12, className }: LiveActivityFeedProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const esRef = useRef<EventSource | null>(null);
  const seenIds = useRef<Set<number>>(new Set());

  const close = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;
    close();
    setError(null);
    const url = buildStreamUrl(filters);
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setRetryCount(0);
    };

    es.onmessage = (msg) => {
      if (!msg.data) return;
      try {
        const parsed = JSON.parse(msg.data);
        const incoming: StreamEvent[] = Array.isArray(parsed.events) ? parsed.events : [];
        if (!incoming.length) return;

        const mapped: TimelineEvent[] = incoming
          .filter((e) => !seenIds.current.has(e.id))
          .map((e) => {
            seenIds.current.add(e.id);
            return {
              id: e.id,
              title: e.title,
              timestamp: e.happened_at,
              severity: e.severity,
              status: e.status,
              description: [e.event_type, e.entity].filter(Boolean).join(" · "),
              owner: e.meta?.squad,
            };
          });

        setEvents((prev) => {
          const next = [...mapped, ...prev];
          return next.slice(0, maxEvents);
        });
      } catch (err) {
        console.error("Failed to parse SSE message", err);
      }
    };

    es.onerror = () => {
      setConnected(false);
      setError("Live feed disconnected");
      es.close();
      esRef.current = null;
      setRetryCount((c) => c + 1);
    };
  }, [filters, maxEvents, close]);

  useEffect(() => {
    connect();
    return () => close();
  }, [connect, close]);

  // Exponential reconnect backoff capped at 30s.
  useEffect(() => {
    if (retryCount === 0) return;
    const delay = Math.min(30000, 1000 * Math.pow(2, retryCount - 1));
    const t = setTimeout(connect, delay);
    return () => clearTimeout(t);
  }, [retryCount, connect]);

  return (
    <Widget className={cn("flex flex-col", className)}>
      <WidgetHeader
        title="Live Activity Feed"
        subtitle="Real-time incidents, alerts, and cost signals"
        action={
          <div className="flex items-center gap-2">
            {connected ? (
              <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <Radio size={10} /> Live
              </span>
            ) : error ? (
              <span className="flex items-center gap-1 text-[10px] font-medium text-rose-600 dark:text-rose-400">
                <RadioOff size={10} /> Offline
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={connect}
              aria-label="Reconnect live feed"
            >
              <RefreshCw size={14} />
            </Button>
          </div>
        }
      />
      {error && !connected && (
        <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}. Reconnecting…
        </div>
      )}
      <Timeline
        events={events}
        emptyText={connected ? "Listening for activity…" : "Connect to see live activity"}
        className="flex-1"
      />
    </Widget>
  );
}
