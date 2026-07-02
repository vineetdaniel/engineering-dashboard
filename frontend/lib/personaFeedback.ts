import type { DeveloperSignal } from "@/lib/api";
import type { DeveloperPersona } from "@/lib/persona";

function hoursToReadable(h: number | null | undefined): string {
  if (h === null || h === undefined || Number.isNaN(h)) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${Math.round(h)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export function projectManagerFeedback(signal: DeveloperSignal): string {
  const lines: string[] = [];

  const deliveryRate = signal.delivery_rate_pct ?? 0;
  const volatility = signal.sp_volatility ?? 0;
  const stuck = signal.stuck_prs;
  const open = signal.open_prs;
  const afterHours = signal.after_hours_pct;
  const weekend = signal.weekend_pct;
  const mergeHours = signal.avg_merge_hours ?? 0;
  const tickets = signal.total_tickets_done;

  if (deliveryRate >= 90 && volatility <= 20) {
    lines.push(`Predictable delivery machine. ${deliveryRate}% sprint completion with low volatility (σ ${volatility}%) means I can commit dates to stakeholders without caveats.`);
  } else if (deliveryRate >= 75) {
    lines.push(`Mostly dependable. ${deliveryRate}% delivery rate is above the industry median, but σ ${volatility}% volatility means some sprints still slip without warning.`);
  } else if (deliveryRate > 0) {
    lines.push(`Unreliable committer. ${deliveryRate}% delivery rate is below the 75% bar where engineering becomes a planning risk; σ ${volatility}% volatility makes forecasting a coin flip.`);
  } else {
    lines.push(`No delivery signal. Without Jira sprint data, I cannot forecast anything. This developer is a black box for release planning.`);
  }

  if (open >= 4 || stuck >= 2) {
    lines.push(`WIP is out of control: ${open} open PRs, ${stuck} stuck >7 days. Work is piling up in review queues, which guarantees downstream delays.`);
  } else if (open >= 2) {
    lines.push(`${open} open PRs is acceptable, but any stuck item is a blocker waiting to happen.`);
  } else {
    lines.push(`Clean WIP load. Fewer open PRs means faster feedback loops and less context switching.`);
  }

  if (mergeHours > 72) {
    lines.push(`PR cycle time of ${hoursToReadable(mergeHours)} is glacial. In high-performing teams the median is under 4 hours; this is a process or review bandwidth problem.`);
  } else if (mergeHours > 24) {
    lines.push(`PR cycle time of ${hoursToReadable(mergeHours)} is workable but above the elite-team threshold.`);
  }

  if (afterHours > 25 || weekend > 10) {
    lines.push(`Burnout signal: ${afterHours}% after-hours and ${weekend}% weekend work. Sustainable teams do not heroic their way through sprints.`);
  }

  if (tickets >= 10) {
    lines.push(`${tickets} tickets closed shows throughput, but ticket count without delivery rate is just busywork.`);
  }

  return lines.join("\n\n") || "Insufficient delivery data to form a project-management opinion.";
}

export function productManagerFeedback(signal: DeveloperSignal): string {
  const lines: string[] = [];

  const totalPRs = signal.prs_authored || 0;
  const feature = signal.feature_prs || 0;
  const fix = signal.fix_prs || 0;
  const refactor = signal.refactor_prs || 0;
  const featureShare = totalPRs ? Math.round((feature / totalPRs) * 100) : 0;
  const fixShare = totalPRs ? Math.round((fix / totalPRs) * 100) : 0;
  const concern = signal.concern_ratio_pct ?? 0;
  const deliveryRate = signal.delivery_rate_pct ?? 0;
  const commits = signal.commits;

  if (featureShare >= 60 && fixShare <= 25) {
    lines.push(`Feature-heavy profile (${featureShare}% feature PRs) — exactly what a product roadmap needs. Output is aligned with customer value.`);
  } else if (fixShare >= 40) {
    lines.push(`Alarmingly high fix ratio (${fixShare}% fix PRs). Either the codebase is on fire or this developer is stuck doing incident cleanup instead of building product.`);
  } else if (featureShare >= 40 && fixShare >= 20) {
    lines.push(`Balanced mix (${featureShare}% features, ${fixShare}% fixes). Reasonable for a product engineer, but the fix share is on the high side.`);
  } else if (totalPRs === 0 && commits > 0) {
    lines.push(`Commits without PRs is a red flag for product discipline. No review trail means quality risk and opaque progress.`);
  } else {
    lines.push(`No meaningful feature/fix signal. Cannot tell whether this developer is shipping product value or just moving code around.`);
  }

  if (refactor >= 5 && refactor >= feature * 0.3) {
    lines.push(`Heavy refactoring (${refactor} refactor PRs) without enough new features looks like internal churn, not product momentum.`);
  }

  if (concern >= 25) {
    lines.push(`Quality problem: ${concern}% of reviewed PRs raised concerns. That rework load delays every downstream feature.`);
  } else if (concern >= 10) {
    lines.push(`${concern}% concern rate is acceptable but not elite. Some PRs need a second pass before they reach customers.`);
  } else if (totalPRs > 0) {
    lines.push(`Low concern rate (${concern}%). First-pass quality is high, which protects sprint predictability.`);
  }

  if (deliveryRate < 60 && totalPRs > 0) {
    lines.push(`Low delivery rate (${deliveryRate}%) undermines roadmap confidence. PMs cannot promise dates when engineering completion is inconsistent.`);
  }

  return lines.join("\n\n") || "No product signal yet. Need more PRs / delivery data to judge customer-value output.";
}

export function ctoFeedback(signal: DeveloperSignal, persona: DeveloperPersona): string {
  const lines: string[] = [];

  const hygiene = signal.hygiene_score;
  const debt = signal.debt_markers;
  const conventional = signal.conventional_commits_pct;
  const sole = signal.sole_repos;
  const dominant = signal.dominant_repos;
  const busScore = signal.bus_factor_score;
  const cfr = signal.change_failure_rate;
  const mttr = signal.mttr_minutes;
  const flaky = signal.flaky_tests;
  const deployFreq = signal.deployment_frequency;
  const rigor = signal.reviewer_changes_ratio_pct ?? 0;
  const avgMerge = signal.avg_merge_hours ?? 0;
  const weekend = signal.weekend_pct;
  const afterHours = signal.after_hours_pct;

  if (busScore >= 50 || sole >= 2) {
    lines.push(`Bus factor risk. ${sole} sole-contributor repos and ${dominant} dominant repos mean knowledge is concentrated. If this person leaves, feature velocity in those areas stalls.`);
  } else if (dominant >= 1) {
    lines.push(`Mild silo signal: ${dominant} repos with >50% contribution share. Cross-pairing would reduce key-person risk.`);
  } else if (signal.repos_touched >= 3) {
    lines.push(`Good knowledge spread across ${signal.repos_touched} repos. Low single-point-of-failure risk.`);
  }

  if (hygiene < 40) {
    lines.push(`Commit hygiene is poor (${hygiene}/100). Only ${conventional}% conventional commits and ${debt} debt markers suggest a team that values speed over maintainability.`);
  } else if (hygiene < 70) {
    lines.push(`Commit hygiene is mediocre (${hygiene}/100). ${conventional}% conventional commits and ${debt} debt markers — enforce a commit-message convention.`);
  } else {
    lines.push(`Strong commit hygiene (${hygiene}/100). ${conventional}% conventional commits and minimal debt markers make bisects and changelogs easier.`);
  }

  if (cfr > 15) {
    lines.push(`Pipeline is bleeding. ${cfr}% change failure rate is above the industry "elite" threshold of 5% and risks production instability.`);
  } else if (cfr > 5) {
    lines.push(`Change failure rate of ${cfr}% is acceptable but not elite. Invest in pre-merge checks.`);
  } else if (cfr > 0) {
    lines.push(`Low change failure rate (${cfr}%). Solid engineering quality at the pipeline level.`);
  }

  if (deployFreq < 1 && signal.commits > 0) {
    lines.push(`Deployment frequency of ${deployFreq}/day is too low for modern CI/CD. Batches are probably large, which amplifies rollback risk.`);
  } else if (deployFreq >= 3) {
    lines.push(`Healthy deployment cadence (${deployFreq}/day). Small, frequent releases reduce blast radius.`);
  }

  if (mttr > 60) {
    lines.push(`MTTR of ${hoursToReadable(mttr)} is slow. Incidents linger, which compounds customer impact and pager load.`);
  } else if (mttr > 0) {
    lines.push(`MTTR of ${hoursToReadable(mttr)} is within recoverable range.`);
  }

  if (flaky >= 3) {
    lines.push(`${flaky} flaky-test patterns erode trust in CI. Teams start ignoring red builds, and real regressions slip through.`);
  }

  if (rigor >= 40) {
    lines.push(`Reviewer rigor is high (${rigor}% changes requested). This person improves team quality but may be a bottleneck if reviews sit idle.`);
  } else if (rigor <= 10 && signal.prs_reviewed >= 5) {
    lines.push(`Rubber-stamp reviewer (${rigor}% changes requested). Approvals without scrutiny destroy code-quality gates.`);
  }

  if (avgMerge > 72) {
    lines.push(`Long merge times (${hoursToReadable(avgMerge)}) indicate weak review bandwidth or oversized diffs. Both hurt cycle time and quality.`);
  }

  if (afterHours > 25 || weekend > 10) {
    lines.push(`Sustainability warning: ${afterHours}% after-hours / ${weekend}% weekend activity. Hero culture produces short-term throughput and long-term attrition.`);
  }

  if (persona.scores.quality < 50 && signal.commits > 0) {
    lines.push(`Quality score (${persona.scores.quality}/100) does not match activity volume. High commit count with low quality is the definition of tech debt acceleration.`);
  }

  return lines.join("\n\n") || "Insufficient engineering-quality data for a CTO-level opinion.";
}
