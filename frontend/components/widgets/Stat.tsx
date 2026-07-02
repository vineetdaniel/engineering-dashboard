import { ArrowDownRight, ArrowUpRight, Minus, LucideIcon, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Widget } from "./Widget";
import { Sparkline } from "./Sparkline";

interface StatProps {
  title: string;
  value: string | number;
  subtext?: string;
  trend?: "up" | "down" | "flat";
  trendLabel?: string;
  trendInverse?: boolean; // when "up" is bad (e.g. bugs, incidents)
  sparklineData?: number[];
  icon?: LucideIcon;
  variant?: "default" | "success" | "warning" | "danger";
  target?: string | number;
  targetLabel?: string;
  className?: string;
}

export function Stat({
  title,
  value,
  subtext,
  trend,
  trendLabel,
  trendInverse = false,
  sparklineData,
  icon: Icon,
  variant = "default",
  target,
  targetLabel,
  className,
}: StatProps) {
  const isPositive = trend === "up";
  const isNegative = trend === "down";
  const isGood = trendInverse ? isNegative : isPositive;

  // Parse target if provided to show alert badge
  const numericValue = typeof value === "string" ? parseFloat(String(value).replace(/[^0-9.\-]/g, "")) : value;
  const targetAlert = computeTargetAlert(numericValue, target, trendInverse);

  const variantColor =
    variant === "danger"
      ? "text-rose-600 dark:text-rose-400"
      : variant === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : variant === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-indigo-600 dark:text-indigo-400";

  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;

  return (
    <Widget padding="sm" className={cn("flex flex-col justify-between", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
            {targetAlert && (
              <Badge variant="outline" className={targetAlert.class}>
                <AlertTriangle size={10} className="mr-1" />
                {targetAlert.label}
              </Badge>
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>
          </div>
          {(trend || subtext || target) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              {trend && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-semibold",
                    isGood ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  <TrendIcon size={14} />
                  {trendLabel}
                </span>
              )}
              {subtext && <span className="font-medium text-muted-foreground">{subtext}</span>}
              {target && (
                <span className="font-medium text-muted-foreground">
                  {targetLabel || "Target"}: {target}
                </span>
              )}
            </div>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
              variantGradient(variant)
            )}
          >
            <Icon size={18} />
          </div>
        )}
      </div>
      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-3">
          <Sparkline
            data={sparklineData}
            width={160}
            height={28}
            className={cn("w-full", variantColor)}
          />
        </div>
      )}
    </Widget>
  );
}

function variantGradient(variant: string) {
  switch (variant) {
    case "success":
      return "from-emerald-500 to-teal-500";
    case "warning":
      return "from-amber-500 to-orange-500";
    case "danger":
      return "from-rose-500 to-red-600";
    default:
      return "from-indigo-500 to-violet-500";
  }
}

function computeTargetAlert(
  value: number | undefined,
  target: string | number | undefined,
  trendInverse: boolean
): { label: string; class: string } | null {
  if (value == null || target == null || Number.isNaN(value)) return null;
  const targetStr = String(target).trim();
  const dir = targetStr[0];
  const num = parseFloat(targetStr.replace(/[^0-9.\-]/g, ""));
  if (Number.isNaN(num)) return null;

  let breached = false;
  if (dir === "<") {
    breached = trendInverse ? value > num : value >= num;
  } else if (dir === ">") {
    breached = trendInverse ? value <= num : value <= num;
  } else {
    // exact target; alert when worse than target
    breached = trendInverse ? value < num : value > num;
  }

  if (!breached) return null;

  return {
    label: "Alert",
    class:
      "border-rose-200 bg-rose-50 text-rose-700 text-[10px] px-1.5 py-0 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
  };
}
