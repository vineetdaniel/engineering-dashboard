import type { DeveloperSignal } from "./api";

export type PersonaType =
  | "Anchor"        // High delivery, high commits, mentor
  | "Builder"       // Feature-heavy, high volume, fast merge
  | "Fixer"         // Bug-heavy, high concern ratio
  | "Reviewer"      // Low authored, high reviewed/gated
  | "Overloaded"    // High open issues, low delivery
  | "Deep Worker"   // Low commits but high lines, few PRs
  | "Consistent"    // Steady delivery across sprints
  | "Emerging";     // Low data, newer member

export interface PersonaScore {
  delivery: number;    // 0-100: SP delivered / committed
  activity: number;    // 0-100: commits + PRs normalised
  quality: number;     // 0-100: low concern ratio, high approval rate
  collaboration: number; // 0-100: reviews given + gating
  breadth: number;     // 0-100: repos touched, feature ratio
  consistency: number; // 0-100: sprints participated, delivery variance
}

export interface DeveloperPersona {
  signal: DeveloperSignal;
  type: PersonaType;
  tagline: string;
  strengths: string[];
  risks: string[];
  scores: PersonaScore;
  color: string;
  icon: string;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function clamp(v: number, max = 100): number {
  return Math.min(Math.max(Math.round(v), 0), max);
}

function score(s: DeveloperSignal): PersonaScore {
  // Delivery: SP delivered rate (or ticket done rate if no SP)
  const deliveryRaw = s.delivery_rate_pct ?? (
    s.total_tickets_done > 0 && s.sprints_participated > 0
      ? Math.min((s.total_tickets_done / (s.sprints_participated * 8)) * 100, 100)
      : 0
  );

  // Activity: commits (norm ~150) + prs (norm ~100) weighted
  const activityRaw = (s.commits / 150) * 50 + (s.prs_authored / 100) * 50;

  // Quality: low concern ratio = high quality; merged ratio
  const qualityRaw = s.prs_with_reviews > 5
    ? Math.max(0, 100 - s.concern_ratio_pct * 2)
    : s.prs_merged > 0
    ? (s.prs_merged / Math.max(s.prs_authored, 1)) * 100
    : 60; // unknown = neutral

  // Collaboration: reviews given (norm ~50) + gating (norm ~100)
  const collabRaw = (s.prs_reviewed / 50) * 50 + (s.prs_gated / 100) * 50;

  // Breadth: repos touched (norm ~5) + feature ratio
  const totalPrs = s.prs_authored || 1;
  const featureRatio = (s.feature_prs / totalPrs) * 100;
  const breadthRaw = (s.repos_touched / 5) * 50 + (featureRatio / 100) * 50;

  // Consistency: sprints participated (norm ~8) + delivery rate stability
  const consistencyRaw = (Math.min(s.sprints_participated, 8) / 8) * 60 +
    (deliveryRaw / 100) * 40;

  return {
    delivery: clamp(deliveryRaw),
    activity: clamp(activityRaw),
    quality: clamp(qualityRaw),
    collaboration: clamp(collabRaw),
    breadth: clamp(breadthRaw),
    consistency: clamp(consistencyRaw),
  };
}

function classify(s: DeveloperSignal, sc: PersonaScore): PersonaType {
  const hasData = s.commits > 5 || s.prs_authored > 5 || s.sprints_participated > 1;
  if (!hasData) return "Emerging";

  // Overloaded: too many open issues relative to delivery
  if (s.open_issues > 60 && (s.delivery_rate_pct ?? 100) < 50) return "Overloaded";

  // Reviewer / Gatekeeper: reviews >> authored
  if (s.prs_gated > s.prs_authored * 2 && s.prs_reviewed > 30) return "Reviewer";

  // Anchor: high delivery + high activity + high collab
  if (sc.delivery >= 80 && sc.activity >= 60 && sc.collaboration >= 50) return "Anchor";

  // Fixer: high bug ratio or high concern ratio
  if ((s.bug_ratio_pct ?? 0) > 30 || s.concern_ratio_pct > 20) return "Fixer";

  // Deep Worker: low PR count but high lines
  const linesPerCommit = s.commits > 0 ? (s.lines_added + s.lines_deleted) / s.commits : 0;
  if (s.prs_authored < 20 && linesPerCommit > 200 && s.commits > 10) return "Deep Worker";

  // Consistent: good delivery across many sprints
  if (sc.consistency >= 70 && sc.delivery >= 65) return "Consistent";

  // Builder: high feature PR ratio + activity
  if (sc.breadth >= 60 && sc.activity >= 50) return "Builder";

  return "Emerging";
}

const PERSONA_META: Record<PersonaType, { tagline: string; color: string; icon: string }> = {
  Anchor:      { tagline: "High delivery, trusted gatekeeper",      color: "from-indigo-500 to-violet-600",   icon: "⚓" },
  Builder:     { tagline: "Feature-driven, high output",            color: "from-blue-500 to-cyan-500",       icon: "🏗️" },
  Fixer:       { tagline: "Bug hunter, rework champion",            color: "from-amber-500 to-orange-500",    icon: "🔧" },
  Reviewer:    { tagline: "Code quality guardian",                  color: "from-emerald-500 to-teal-500",    icon: "👁️" },
  Overloaded:  { tagline: "High backlog, needs unblocking",         color: "from-red-500 to-rose-500",        icon: "⚠️" },
  "Deep Worker": { tagline: "Large impactful changes, low noise",   color: "from-violet-500 to-purple-600",   icon: "🔬" },
  Consistent:  { tagline: "Reliable, predictable delivery",         color: "from-green-500 to-emerald-500",   icon: "📈" },
  Emerging:    { tagline: "Building momentum",                      color: "from-gray-400 to-slate-500",      icon: "🌱" },
};

function strengths(s: DeveloperSignal, type: PersonaType): string[] {
  const out: string[] = [];
  if (s.delivery_rate_pct !== null && s.delivery_rate_pct >= 80) out.push(`${s.delivery_rate_pct}% sprint delivery rate`);
  if (s.commits >= 100) out.push(`${s.commits} commits in 90 days`);
  if (s.prs_reviewed >= 30) out.push(`Reviewed ${s.prs_reviewed} PRs`);
  if (s.prs_gated >= 50) out.push(`Gatekeeper for ${s.prs_gated} merges`);
  if (s.repos_touched >= 4) out.push(`Works across ${s.repos_touched} repos`);
  if (s.concern_ratio_pct < 5 && s.prs_with_reviews > 5) out.push("Clean PRs — rarely sent back");
  if (s.total_tickets_done >= 20) out.push(`${s.total_tickets_done} Jira tickets done`);
  if (s.after_hours_pct < 10 && s.weekend_pct < 5) out.push("Healthy working hours");
  return out.slice(0, 3);
}

function risks(s: DeveloperSignal, type: PersonaType): string[] {
  const out: string[] = [];
  if (s.open_issues > 40) out.push(`${s.open_issues} open Jira tickets — backlog risk`);
  if (s.delivery_rate_pct !== null && s.delivery_rate_pct < 50 && s.sprints_participated > 2) out.push(`Only ${s.delivery_rate_pct}% SP delivered vs committed`);
  if (s.concern_ratio_pct > 15) out.push(`${s.concern_ratio_pct}% PRs had review concerns`);
  if (s.after_hours_pct > 25) out.push(`${s.after_hours_pct}% commits outside work hours`);
  if (s.weekend_pct > 10) out.push(`${s.weekend_pct}% commits on weekends`);
  if (s.prs_reviewed < 5 && s.commits > 30) out.push("Low peer-review contribution");
  if (s.avg_merge_hours !== null && s.avg_merge_hours > 48) out.push(`Avg ${Math.round(s.avg_merge_hours)}h to merge — slow cycle`);
  return out.slice(0, 3);
}

export function buildPersonas(signals: DeveloperSignal[]): DeveloperPersona[] {
  return signals.map((s) => {
    const sc = score(s);
    const type = classify(s, sc);
    const meta = PERSONA_META[type];
    return {
      signal: s,
      type,
      tagline: meta.tagline,
      strengths: strengths(s, type),
      risks: risks(s, type),
      scores: sc,
      color: meta.color,
      icon: meta.icon,
    };
  });
}

export function peakHourLabel(h: number | null): string {
  if (h === null) return "—";
  const ampm = h < 12 ? "am" : "pm";
  const hr = h % 12 || 12;
  return `${hr}${ampm}`;
}

export function peakDowLabel(d: number | null): string {
  if (d === null) return "—";
  return DOW[d] ?? "—";
}
