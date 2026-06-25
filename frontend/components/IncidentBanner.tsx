"use client";

import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface IncidentBannerProps {
  count: number;
}

export function IncidentBanner({ count }: IncidentBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (count === 0 || dismissed) return null;

  return (
    <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
          <strong>
            {count} active P0/P1 incident{count > 1 ? "s" : ""}
          </strong>
          <span className="hidden sm:inline">· Navigate to Operations for war-room details.</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-1 h-7 w-7 shrink-0 text-rose-700 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-900"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss incident banner"
        >
          <X size={16} />
        </Button>
      </div>
      <p className="mt-1 text-xs sm:hidden">Navigate to Operations for war-room details.</p>
    </div>
  );
}
