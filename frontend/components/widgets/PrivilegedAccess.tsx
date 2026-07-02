"use client";

import { useMemo } from "react";
import { ShieldCheck, Key, Users, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { Stat } from "./Stat";
import { ProgressList } from "./ProgressList";
import { DataTable } from "@/components/widgets/DataTable";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DataTableRow } from "@/components/widgets/DataTable";

interface PrivilegedAccessProps {
  events: any[];
}

export function PrivilegedAccess({ events }: PrivilegedAccessProps) {
  const iamEvents = events.filter((e) =>
    ["compliance_control_status", "audit_log"].includes(e.event_type)
  );

  const accessReviews = useMemo(() => {
    const reviews = iamEvents.filter((e) =>
      e.title.toLowerCase().includes("access review") ||
      e.title.toLowerCase().includes("privileged access")
    );
    const open = reviews.filter((e) => e.status !== "resolved").length;
    const overdue = reviews.filter((e) => {
      if (e.status === "resolved") return false;
      const due = e.meta?.due ? new Date(e.meta.due).getTime() : Infinity;
      return due < Date.now();
    }).length;
    return { total: reviews.length, open, overdue };
  }, [iamEvents]);

  const mfaCoverage = useMemo(() => {
    // Synthetic: derive from audit_log events mentioning MFA
    const mfaEvents = iamEvents.filter((e) => e.title.toLowerCase().includes("mfa"));
    const enforced = mfaEvents.filter((e) => e.status === "completed" || e.title.toLowerCase().includes("enforcement")).length;
    return mfaEvents.length > 0 ? Math.round((enforced / mfaEvents.length) * 100) : 96;
  }, [iamEvents]);

  const jmlItems = [
    { id: 1, label: "Joiner access provisioning", value: 98, meta: "automated", color: "#10b981" },
    { id: 2, label: "Mover role transitions", value: 85, meta: "5 pending", color: "#f59e0b" },
    { id: 3, label: "Leaver access revocation", value: 100, meta: "<24h", color: "#10b981" },
  ];

  const privilegedAccounts = [
    { id: "prod-db-admin", name: "Production DB Admin", owner: "platform", lastReviewed: "2026-05-12", mfa: true },
    { id: "payments-signer", name: "Payments signer key", owner: "payments", lastReviewed: "2026-04-20", mfa: true },
    { id: "aws-root", name: "AWS root-like roles", owner: "security", lastReviewed: "2026-06-10", mfa: false },
    { id: "vault-unseal", name: "Vault unseal operators", owner: "security", lastReviewed: "2026-03-15", mfa: true },
  ];

  const staleReviews = privilegedAccounts.filter((a) => {
    const daysSince = (Date.now() - new Date(a.lastReviewed).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 90;
  });

  const accountRows: DataTableRow[] = privilegedAccounts.map((a) => {
    const daysSince = Math.round(
      (Date.now() - new Date(a.lastReviewed).getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      id: a.id,
      label: a.name,
      meta: `${a.owner} · ${daysSince}d since review`,
      status: a.mfa ? "MFA" : "No MFA",
      severity: daysSince > 90 ? "high" : a.mfa ? "low" : "medium",
    };
  });

  return (
    <Widget className="space-y-4">
      <WidgetHeader
        title="IAM & Privileged Access"
        subtitle="MFA coverage, access reviews, and JML lifecycle"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          title="MFA Coverage"
          value={`${mfaCoverage}%`}
          icon={Key}
          variant={mfaCoverage < 95 ? "warning" : "success"}
          target="100%"
        />
        <Stat
          title="Open Access Reviews"
          value={accessReviews.open}
          icon={Users}
          variant={accessReviews.open > 0 ? "warning" : "success"}
          trendInverse
        />
        <Stat
          title="Overdue Reviews"
          value={accessReviews.overdue}
          icon={Clock}
          variant={accessReviews.overdue > 0 ? "warning" : "success"}
          trendInverse
          target="0"
        />
        <Stat
          title="Stale Privileged Reviews"
          value={staleReviews.length}
          icon={AlertTriangle}
          variant={staleReviews.length > 0 ? "warning" : "success"}
          trendInverse
          target="0"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ProgressList
          title="Joiner-Mover-Leaver Health"
          subtitle="Automation and review coverage"
          items={jmlItems}
        />
        <DataTable
          title="Privileged Accounts"
          subtitle="High-impact access and review status"
          rows={accountRows}
          maxRows={6}
          emptyText="No privileged account data"
        />
      </div>

      {accessReviews.overdue > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle size={16} />
          {accessReviews.overdue} access review{accessReviews.overdue > 1 ? "s are" : " is"} overdue — privileged access may be stale.
        </div>
      )}
      {accessReviews.overdue === 0 && staleReviews.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle size={16} />
          Access reviews current and privileged accounts reviewed within 90 days.
        </div>
      )}
    </Widget>
  );
}
