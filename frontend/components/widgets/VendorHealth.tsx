"use client";

import { Cloud, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { Widget } from "@/components/widgets/Widget";
import { WidgetHeader } from "@/components/widgets/WidgetHeader";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface VendorHealthProps {
  metrics: any[];
  events: any[];
  className?: string;
}

const vendorIcons: Record<string, string> = {
  stripe: "Payments",
  plaid: "Bank linking",
  auth0: "Identity",
  sendgrid: "Email",
  "aws-us-east-1": "Cloud",
};

function vendorStatus(score: number, activeIncident: boolean) {
  if (activeIncident || score < 90) return { label: "Degraded", class: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300" };
  if (score < 95) return { label: "At risk", class: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300" };
  return { label: "Healthy", class: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" };
}

export function VendorHealth({ metrics, events, className }: VendorHealthProps) {
  const vendorScores = metrics
    .filter((m) => m.metric_type === "vendor_health_score")
    .reduce((acc: Record<string, number>, m) => {
      const name = m.meta?.vendor || m.entity;
      acc[name] = m.value ?? 0;
      return acc;
    }, {});

  const activeVendorIncidents = events.filter(
    (e) => e.event_type === "vendor_incident" && e.status !== "resolved"
  );

  const vendors = Object.entries(vendorScores).map(([name, score]) => {
    const hasIncident = activeVendorIncidents.some((e) => e.entity === name || e.meta?.vendor === name);
    return { name, score, hasIncident };
  });

  return (
    <Widget className={className}>
      <WidgetHeader
        title="Vendor & Dependency Health"
        subtitle="Third-party APIs critical to payments and identity"
        action={
          activeVendorIncidents.length > 0 && (
            <Badge variant="outline" className="border-amber-200 text-amber-700 dark:border-amber-900 dark:text-amber-300">
              {activeVendorIncidents.length} active
            </Badge>
          )
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {vendors.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No vendor health metrics available.
          </div>
        )}
        {vendors.map((vendor) => {
          const status = vendorStatus(vendor.score, vendor.hasIncident);
          return (
            <div
              key={vendor.name}
              className="rounded-xl border border-border bg-card p-4 transition hover:bg-muted/40"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                    <Cloud size={14} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium capitalize">{vendor.name.replace(/-/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">{vendorIcons[vendor.name] || "Integration"}</p>
                  </div>
                </div>
                <Badge variant="outline" className={status.class}>
                  {vendor.hasIncident ? <AlertTriangle size={12} className="mr-1" /> : <CheckCircle2 size={12} className="mr-1" />}
                  {status.label}
                </Badge>
              </div>

              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Health score</span>
                  <span className="font-medium">{vendor.score.toFixed(1)}%</span>
                </div>
                <Progress value={vendor.score} className="h-2" />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">SLA target: 99.9%</span>
                <ExternalLink size={12} className="text-muted-foreground" />
              </div>
            </div>
          );
        })}
      </div>
    </Widget>
  );
}
