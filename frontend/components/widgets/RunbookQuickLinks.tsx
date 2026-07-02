"use client";

import { BookOpen, Phone, ShieldAlert, Zap, Activity, CreditCard, Lock, Server, FileCheck } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { cn } from "@/lib/utils";

interface RunbookQuickLinksProps {
  activeIncidentCount?: number;
  className?: string;
}

const RUNBOOKS = [
  {
    id: "p0-payments",
    label: "P0 Payment Outage",
    icon: CreditCard,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/50",
    border: "border-rose-200 dark:border-rose-900",
    scenario: "Payments success rate drops below 99%",
  },
  {
    id: "p0-security",
    label: "P0 Security Incident",
    icon: Lock,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/50",
    border: "border-rose-200 dark:border-rose-900",
    scenario: "Suspected breach or active exploit",
  },
  {
    id: "p1-ledger",
    label: "Ledger Imbalance",
    icon: Server,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/50",
    border: "border-amber-200 dark:border-amber-900",
    scenario: "Reconciliation drift or settlement failure",
  },
  {
    id: "p1-vendor",
    label: "Vendor Degradation",
    icon: Activity,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/50",
    border: "border-amber-200 dark:border-amber-900",
    scenario: "Stripe / Plaid / Auth0 latency or errors",
  },
  {
    id: "p2-dr",
    label: "DR Failover",
    icon: ShieldAlert,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/50",
    border: "border-blue-200 dark:border-blue-900",
    scenario: "Region failure requiring failover",
  },
  {
    id: "compliance",
    label: "Compliance Breach",
    icon: FileCheck,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/50",
    border: "border-indigo-200 dark:border-indigo-900",
    scenario: "Audit finding or regulatory inquiry",
  },
];

export function RunbookQuickLinks({ activeIncidentCount = 0, className }: RunbookQuickLinksProps) {
  return (
    <Widget className={className}>
      <WidgetHeader
        title="Incident Runbooks"
        subtitle="One-click response playbooks for common fintech scenarios"
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {RUNBOOKS.map((runbook) => {
          const Icon = runbook.icon;
          return (
            <button
              key={runbook.id}
              className={cn(
                "group relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition hover:shadow-sm",
                runbook.bg,
                runbook.border
              )}
            >
              <div className="flex w-full items-center justify-between">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-white/60 dark:bg-black/20", runbook.color)}>
                  <Icon size={16} />
                </div>
                {activeIncidentCount > 0 && (runbook.id === "p0-payments" || runbook.id === "p0-security") && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                  </span>
                )}
              </div>
              <div>
                <p className={cn("text-sm font-semibold", runbook.color)}>{runbook.label}</p>
                <p className="text-xs text-muted-foreground">{runbook.scenario}</p>
              </div>
            </button>
          );
        })}
      </div>
    </Widget>
  );
}
