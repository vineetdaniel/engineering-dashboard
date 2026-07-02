"use client";

import { useMemo } from "react";
import { UserCheck, Building2, Fingerprint, ArrowRight, TrendingUp } from "lucide-react";
import { Widget } from "./Widget";
import { WidgetHeader } from "./WidgetHeader";
import { Stat } from "./Stat";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface OnboardingFunnelProps {
  metrics: any[];
}

interface FunnelStep {
  label: string;
  value: number;
  color: string;
}

export function OnboardingFunnel({ metrics }: OnboardingFunnelProps) {
  const kycPass = metrics.find((m) => m.metric_type === "kyc_pass_rate")?.value ?? 0;
  const kybPass = metrics.find((m) => m.metric_type === "kyb_pass_rate")?.value ?? 0;

  const kycTrend = useMemo(() => {
    return metrics
      .filter((m) => m.metric_type === "kyc_pass_rate")
      .slice(0, 8)
      .map((m, i) => ({ label: `D${i + 1}`, value: m.value ?? 0 }))
      .reverse();
  }, [metrics]);

  // Synthetic funnel derived from pass rates
  const funnel: FunnelStep[] = [
    { label: "Started", value: 100, color: "[&>div]:bg-slate-500" },
    { label: "Document upload", value: 92, color: "[&>div]:bg-indigo-500" },
    { label: "Liveness / ID check", value: Math.round(kycPass * 0.95), color: "[&>div]:bg-violet-500" },
    { label: "Risk screening", value: Math.round(kycPass * 0.9), color: "[&>div]:bg-fuchsia-500" },
    { label: "Approved", value: Math.round(kycPass), color: "[&>div]:bg-emerald-500" },
  ];

  return (
    <Widget className="space-y-4">
      <WidgetHeader
        title="KYC / KYB Onboarding Funnel"
        subtitle="Identity verification pass rates and drop-off"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          title="KYC Pass Rate"
          value={`${kycPass.toFixed(1)}%`}
          icon={Fingerprint}
          variant={kycPass < 90 ? "warning" : "success"}
          target=">92%"
        />
        <Stat
          title="KYB Pass Rate"
          value={`${kybPass.toFixed(1)}%`}
          icon={Building2}
          variant={kybPass < 85 ? "warning" : "success"}
          target=">85%"
        />
        <Stat
          title="KYC Drop-off"
          value={`${(100 - kycPass).toFixed(1)}%`}
          icon={ArrowRight}
          variant={100 - kycPass > 10 ? "warning" : "default"}
          trendInverse
        />
        <Stat
          title="KYB Drop-off"
          value={`${(100 - kybPass).toFixed(1)}%`}
          icon={TrendingUp}
          variant={100 - kybPass > 15 ? "warning" : "default"}
          trendInverse
        />
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
        <p className="text-sm font-medium text-foreground">Synthetic onboarding funnel</p>
        {funnel.map((step, index) => {
          const prev = funnel[index - 1]?.value ?? step.value;
          const drop = index > 0 ? prev - step.value : 0;
          return (
            <div key={step.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  {index === funnel.length - 1 ? (
                    <UserCheck size={12} />
                  ) : (
                    <ArrowRight size={12} />
                  )}
                  {step.label}
                </span>
                <span className="font-medium text-foreground">
                  {step.value}%
                  {drop > 0 && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground">
                      (-{drop}%)
                    </span>
                  )}
                </span>
              </div>
              <Progress value={step.value} className={cn("h-2", step.color)} />
            </div>
          );
        })}
      </div>

      {kycTrend.length > 1 && (
        <div className="grid grid-cols-1 gap-5">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">KYC Pass Rate Trend</p>
            <div className="mt-3 flex items-end gap-1 h-24">
              {kycTrend.map((d, i) => {
                const height = `${Math.max(10, d.value)}%`;
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div
                      className={cn(
                        "w-full rounded-t-sm",
                        d.value >= 92 ? "bg-emerald-500" : d.value >= 85 ? "bg-amber-500" : "bg-rose-500"
                      )}
                      style={{ height }}
                    />
                    <span className="text-[9px] text-muted-foreground">{d.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Widget>
  );
}
