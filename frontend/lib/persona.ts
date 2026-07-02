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
  activity: number;    // 0-100: commits + PRs normalised (diminishing returns)
  quality: number;     // 0-100: low concern ratio, high approval rate
  collaboration: number; // 0-100: reviews given + gating
  breadth: number;     // 0-100: repos touched, feature ratio
  consistency: number; // 0-100: sprints participated, delivery variance
  commitSize: number;  // 0-100: penalise bulk commits, reward moderate sizes
  reviewRigor: number; // 0-100: reviewer who raises meaningful concerns
  wipLoad: number;    // 0-100: inverse of open/stuck PR load
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
  darkText: boolean;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function clamp(v: number, max = 100): number {
  return Math.min(Math.max(Math.round(v), 0), max);
}

function diminishing(maxScore: number, v: number, norm: number): number {
  // Logarithmic curve: reaches ~75% of max at norm, 90% at 2x norm, capped at max.
  if (norm <= 0) return 0;
  const ratio = v / norm;
  return maxScore * (1 - Math.exp(-2 * ratio)) / (1 - Math.exp(-2));
}

function score(s: DeveloperSignal): PersonaScore {
  // Delivery: SP delivered rate (or ticket done rate if no SP)
  const deliveryRaw = s.delivery_rate_pct ?? (
    s.total_tickets_done > 0 && s.sprints_participated > 0
      ? Math.min((s.total_tickets_done / (s.sprints_participated * 8)) * 100, 100)
      : 0
  );

  // Activity: commits + PRs with diminishing returns so volume alone can't dominate.
  // Norm: ~150 commits and ~100 PRs over 90 days.
  const commitActivity = diminishing(50, s.commits, 150);
  const prActivity = diminishing(50, s.prs_authored, 100);
  const activityRaw = commitActivity + prActivity;

  // Commit size: penalise bulk commits (>400 lines avg) and reward moderate sizes.
  const linesPerCommit = s.commits > 0 ? (s.lines_added + s.lines_deleted) / s.commits : 0;
  const commitSizeRaw = linesPerCommit === 0
    ? 50
    : linesPerCommit > 800
    ? Math.max(20, 100 - (linesPerCommit - 800) / 20)
    : linesPerCommit > 400
    ? 60 + (400 - linesPerCommit) / 10
    : 80 + Math.min(20, linesPerCommit / 20);

  // Quality: low concern ratio = high quality; merged ratio fallback
  const qualityRaw = s.prs_with_reviews > 5
    ? Math.max(0, 100 - s.concern_ratio_pct * 2)
    : s.prs_merged > 0
    ? (s.prs_merged / Math.max(s.prs_authored, 1)) * 100
    : 60; // unknown = neutral

  // Collaboration: reviews given (norm ~50) + gating (norm ~100)
  const collabRaw = (s.prs_reviewed / 50) * 50 + (s.prs_gated / 100) * 50;

  // Breadth: repos touched (norm ~5) + feature ratio of PRs + meaningful commit mix
  const totalPrs = s.prs_authored || 1;
  const featureRatio = (s.feature_prs / totalPrs) * 100;
  const totalCommits = s.commits || 1;
  const meaningfulCommits = s.feature_commits + s.fix_commits + s.refactor_commits;
  const commitFocusRatio = (meaningfulCommits / totalCommits) * 100;
  const breadthRaw = (s.repos_touched / 5) * 35 + (featureRatio / 100) * 35 + (commitFocusRatio / 100) * 30;

  // Consistency: sprints participated (norm ~8) + delivery rate stability + low volatility bonus
  const sprintsScore = (Math.min(s.sprints_participated, 8) / 8) * 60;
  const deliveryStability = (deliveryRaw / 100) * 25;
  const volatilityPenalty = s.sp_volatility !== null && s.measured_sprints >= 3
    ? Math.min(15, s.sp_volatility / 5)
    : 0;
  const consistencyRaw = sprintsScore + deliveryStability + (15 - volatilityPenalty);

  // Review rigor: how often this reviewer raises changes-requested vs approves.
  const reviewDecisions = s.approvals_given + s.changes_requested_given;
  const reviewRigorRaw = reviewDecisions > 5
    ? (s.changes_requested_given / reviewDecisions) * 100
    : 0;

  // WIP load: penalise open/draft/stuck PRs.
  const wipScore = Math.max(0, 100 - (s.open_prs * 8) - (s.draft_prs * 4) - (s.stuck_prs * 15));

  return {
    delivery: clamp(deliveryRaw),
    activity: clamp(activityRaw),
    quality: clamp(qualityRaw),
    collaboration: clamp(collabRaw),
    breadth: clamp(breadthRaw),
    consistency: clamp(consistencyRaw),
    commitSize: clamp(commitSizeRaw),
    reviewRigor: clamp(reviewRigorRaw),
    wipLoad: clamp(wipScore),
  };
}

function classify(s: DeveloperSignal, sc: PersonaScore): PersonaType {
  const hasData = s.commits > 5 || s.prs_authored > 5 || s.sprints_participated > 1;
  if (!hasData) return "Emerging";

  // Overloaded: too many open issues / WIP relative to delivery
  if ((s.open_issues > 60 && (s.delivery_rate_pct ?? 100) < 50) || (s.open_prs >= 4 && sc.wipLoad < 40)) return "Overloaded";

  // Reviewer / Gatekeeper: reviews >> authored, and raises quality concerns when reviewing
  if (s.prs_reviewed > 30 && s.prs_reviewed > s.prs_authored * 1.5 && sc.reviewRigor >= 20) return "Reviewer";

  // Anchor: high delivery + high quality + meaningful collaboration
  if (sc.delivery >= 75 && sc.quality >= 60 && sc.collaboration >= 50) return "Anchor";

  // Fixer: high bug ratio or high concern ratio
  if ((s.bug_ratio_pct ?? 0) > 30 || s.concern_ratio_pct > 20) return "Fixer";

  // Deep Worker: low PR count but high lines and strong delivery
  const linesPerCommit = s.commits > 0 ? (s.lines_added + s.lines_deleted) / s.commits : 0;
  if (s.prs_authored < 20 && linesPerCommit > 200 && s.commits > 10 && sc.delivery >= 50) return "Deep Worker";

  // Consistent: good delivery across many sprints with low volatility
  if (sc.consistency >= 70 && sc.delivery >= 65 && (s.sp_volatility === null || s.sp_volatility <= 25)) return "Consistent";

  // Builder: feature-driven with reasonable breadth and quality
  if (sc.breadth >= 55 && sc.activity >= 40 && sc.quality >= 50) return "Builder";

  return "Emerging";
}

const PERSONA_META: Record<PersonaType, { tagline: string; color: string; icon: string; darkText?: boolean }> = {
  Anchor:        { tagline: "High delivery, trusted gatekeeper",    color: "from-indigo-600 to-violet-700",   icon: "⚓" },
  Builder:       { tagline: "Feature-driven, high output",          color: "from-blue-600 to-cyan-600",       icon: "🏗️" },
  Fixer:         { tagline: "Bug hunter, rework champion",          color: "from-amber-600 to-orange-600",    icon: "🔧" },
  Reviewer:      { tagline: "Code quality guardian",                color: "from-emerald-600 to-teal-600",    icon: "👁️" },
  Overloaded:    { tagline: "High backlog, needs unblocking",       color: "from-red-600 to-rose-700",        icon: "⚠️" },
  "Deep Worker": { tagline: "Large impactful changes, low noise",   color: "from-violet-600 to-purple-700",   icon: "🔬" },
  Consistent:    { tagline: "Reliable, predictable delivery",       color: "from-green-600 to-emerald-700",   icon: "📈" },
  Emerging:      { tagline: "Building momentum",                    color: "from-slate-500 to-slate-700",     icon: "🌱" },
};

function strengths(s: DeveloperSignal, sc: PersonaScore, type: PersonaType): string[] {
  const out: string[] = [];
  if (s.delivery_rate_pct !== null && s.delivery_rate_pct >= 80) out.push(`${s.delivery_rate_pct}% sprint delivery rate`);
  if (sc.consistency >= 75 && s.sp_volatility !== null && s.sp_volatility <= 20) out.push("Predictable sprint delivery");
  if (sc.quality >= 85 && s.prs_with_reviews > 5) out.push("High-quality PRs — rarely sent back");
  if (s.prs_reviewed >= 30) out.push(`Reviewed ${s.prs_reviewed} PRs`);
  if (sc.reviewRigor >= 30 && s.prs_reviewed >= 10) out.push("Rigorous reviewer — catches issues");
  if (s.prs_gated >= 50) out.push(`Gatekeeper for ${s.prs_gated} merges`);
  if (s.repos_touched >= 4) out.push(`Works across ${s.repos_touched} repos`);
  if (s.total_tickets_done >= 20) out.push(`${s.total_tickets_done} Jira tickets done`);
  if (sc.commitSize >= 80 && s.commits > 10) out.push("Well-sized commits");
  if (s.after_hours_pct < 10 && s.weekend_pct < 5) out.push("Healthy working hours");
  return out.slice(0, 3);
}

function risks(s: DeveloperSignal, sc: PersonaScore, type: PersonaType): string[] {
  const out: string[] = [];
  if (s.open_issues > 40) out.push(`${s.open_issues} open Jira tickets — backlog risk`);
  if (s.open_prs >= 4 || s.stuck_prs >= 2) out.push(`${s.open_prs} open PRs${s.stuck_prs > 0 ? ` (${s.stuck_prs} stuck >7d)` : ""} — WIP overload`);
  if (s.delivery_rate_pct !== null && s.delivery_rate_pct < 50 && s.sprints_participated > 2) out.push(`Only ${s.delivery_rate_pct}% SP delivered vs committed`);
  if (s.sp_volatility !== null && s.measured_sprints >= 3 && s.sp_volatility > 35) out.push(`Sprint delivery volatile (σ ${s.sp_volatility}%)`);
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
      strengths: strengths(s, sc, type),
      risks: risks(s, sc, type),
      scores: sc,
      color: meta.color,
      icon: meta.icon,
      darkText: meta.darkText ?? false,
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
