import * as XLSX from "xlsx";
import { parseIndianDate, parseDateRange } from "@/lib/dates";
import type { TaskCategory } from "@/lib/actions/sprints";

export type PlanningFileType = "allocation" | "sprint" | "unknown";

/**
 * Thrown when a parser is handed a file whose structure matches the *other*
 * planning file type. The UI catches this to offer a one-click switch.
 */
export class FileTypeMismatchError extends Error {
  detected: PlanningFileType;
  constructor(expected: PlanningFileType, detected: PlanningFileType) {
    super(`Expected a ${expected} file but this looks like a ${detected} file.`);
    this.name = "FileTypeMismatchError";
    this.detected = detected;
  }
}

export interface ParsedResource {
  team: string;
  name: string;
  story_points: number;
  standard_hours: number;
  leave_days: number;
  dependencies?: string;
  remarks?: string;
  warnings: string[];
}

export interface ParsedTask {
  resourceName: string;
  title: string;
  start_date: string | null;
  estimated_days: number | null;
  category: TaskCategory;
  status: "todo";
}

export interface ParsedAllocation {
  type: "allocation";
  name: string;
  start_date: string | null;
  end_date: string | null;
  resources: ParsedResource[];
  tasks: ParsedTask[];
  warnings: string[];
}

export interface ParsedSprintTask {
  owner: string;
  title: string;
  start_date: string | null;
  uat_date: string | null;
  estimated_days: number | null;
  category: TaskCategory;
  remarks?: string;
  warnings: string[];
}

export interface ParsedSprintPlan {
  type: "sprint";
  name: string;
  start_date: string | null;
  end_date: string | null;
  tasks: ParsedSprintTask[];
  warnings: string[];
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function cellStr(row: unknown[], i: number): string {
  return String(row?.[i] ?? "").trim();
}

function rowToLowerCells(row: unknown[]): string[] {
  return (row || []).map((c) => String(c ?? "").toLowerCase());
}

function parseLeaves(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  const str = String(value).trim();
  const match = str.match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

/**
 * Known team names. A name-only row (no SP/hours) that matches one of these is
 * a TEAM HEADER; any other name-only row is treated as a PERSON and imported
 * with zero capacity (never skipped). Maps recognized variants to a canonical
 * team label. Matching is case-insensitive and ignores spaces / slashes.
 */
const _TEAM_CANONICAL: Record<string, string> = {
  backend: "Backend",
  frontend: "Frontend",
  web: "Frontend",
  webfrontend: "Frontend",
  devops: "DevOps",
  qa: "QA",
  integration: "Integrations",
  integrations: "Integrations",
  platform: "Platform",
  core: "CORE",
  paymeapp: "Payme App",
};

/** Canonical team labels for UI dropdowns (deduped, in a sensible order). */
export const KNOWN_TEAMS = [
  "Backend",
  "Frontend",
  "DevOps",
  "QA",
  "Integrations",
  "Platform",
  "CORE",
  "Payme App",
];

function _teamKey(name: string): string {
  return name.toLowerCase().replace(/[\s/_-]+/g, "");
}

/** Return the canonical team label if `name` is a known team, else null. */
function matchKnownTeam(name: string): string | null {
  return _TEAM_CANONICAL[_teamKey(name)] ?? null;
}

/**
 * Derive a sprint name + dates from the uploaded file name as a fallback when
 * the sheet has no usable title row. The file name often carries both, e.g.
 * "Resource Allocation 29th May to 11th June.xlsx".
 */
function nameFromFile(fileName?: string): {
  name: string;
  start_date: string | null;
  end_date: string | null;
} {
  if (!fileName) return { name: "", start_date: null, end_date: null };
  const base = fileName.replace(/\.[^.]+$/, "").trim(); // drop extension
  const parsed = parseDateRange(base);
  return { name: base, start_date: parsed.start_date, end_date: parsed.end_date };
}

function detectCategory(title: string): TaskCategory {
  const lower = title.toLowerCase();
  if (
    lower.includes("integration") ||
    lower.includes("api") ||
    lower.includes("sdk") ||
    lower.includes("webhook")
  ) {
    return "integration";
  }
  return "product";
}

function sheetRows(workbook: XLSX.WorkBook, index: number): unknown[][] {
  const name = workbook.SheetNames[index];
  if (!name) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: "" });
}

/**
 * Cheap structural sniff used before full parsing so each uploader can reject
 * the wrong file type. We scan the first ~10 rows of every sheet for the
 * distinguishing header shapes.
 *
 * - allocation: a header row with "name" + "story points" + ("standard hour"
 *   or "leaves") — the capacity sheet.
 * - sprint: a header row with ("resource"/"owner") + "task" + ("uat" or "start
 *   date") and NO story-point/leaves capacity columns — the task plan.
 */
export function detectFileType(workbook: XLSX.WorkBook): PlanningFileType {
  for (let s = 0; s < workbook.SheetNames.length; s++) {
    const rows = sheetRows(workbook, s);
    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      const cells = rowToLowerCells(rows[i]);
      const joined = cells.join(" | ");

      const hasName = cells.some((c) => c === "name" || c.startsWith("name "));
      const hasStoryPoints = joined.includes("story point");
      const hasCapacity = joined.includes("standard hour") || joined.includes("leaves");
      if (hasName && hasStoryPoints && hasCapacity) {
        return "allocation";
      }

      const hasOwner = cells.some(
        (c) => c.includes("resource") || c.includes("owner") || c === "name"
      );
      const hasTask = cells.some((c) => c.includes("task"));
      const hasSprintDates =
        joined.includes("uat") || joined.includes("start date");
      if (hasOwner && hasTask && hasSprintDates && !hasStoryPoints && !hasCapacity) {
        return "sprint";
      }
    }
  }
  return "unknown";
}

/**
 * Parse a Resource Allocation capacity file (team → resource → SP/hours/leaves).
 * Throws FileTypeMismatchError if the file structurally looks like a sprint plan.
 */
export function parseAllocationFile(
  buffer: ArrayBuffer,
  fileName?: string
): ParsedAllocation {
  const workbook = XLSX.read(buffer, { type: "array" });
  const detected = detectFileType(workbook);
  if (detected === "sprint") {
    throw new FileTypeMismatchError("allocation", detected);
  }

  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    return {
      type: "allocation",
      name: "",
      start_date: null,
      end_date: null,
      resources: [],
      tasks: [],
      warnings: ["No sheets found"],
    };
  }

  const data1 = sheetRows(workbook, 0);

  // Sprint name + dates from the first non-empty cell of row 1 — but ONLY when
  // that cell is a genuine title row, not the column-header row. A file that
  // starts directly with "Name | Story Points | ..." has no title, so we leave
  // the name blank and let the caller auto-suggest "Sprint-<start>-<end>".
  let sprintName = "";
  let startDate: string | null = null;
  let endDate: string | null = null;
  if (data1.length > 0) {
    const firstRow = data1[0];
    const firstNonEmpty = firstRow.find((cell) => cell != null && String(cell).trim() !== "");
    const firstStr = firstNonEmpty != null ? String(firstNonEmpty).trim() : "";
    // Header-label cells ("Name", "Story Points", "Standard Hour", "Leaves")
    // are NOT a title.
    const looksLikeHeader = /^(name|story\s*points?|standard\s*hour|leaves?)/i.test(firstStr);
    if (firstStr && !looksLikeHeader) {
      const parsed = parseDateRange(firstStr);
      sprintName = parsed.name;
      startDate = parsed.start_date;
      endDate = parsed.end_date;
    }
  }

  // Fallback: when the sheet has no usable title, derive name/dates from the
  // uploaded file name (e.g. "Resource Allocation 29th May to 11th June.xlsx").
  if (!sprintName.trim() || (!startDate && !endDate)) {
    const fromFile = nameFromFile(fileName);
    if (!sprintName.trim() && fromFile.name) sprintName = fromFile.name;
    if (!startDate && fromFile.start_date) startDate = fromFile.start_date;
    if (!endDate && fromFile.end_date) endDate = fromFile.end_date;
  }

  const resources: ParsedResource[] = [];
  let currentTeam = "Unassigned";
  const warnings: string[] = [];

  // Detect header row index (row with "Name" header)
  let headerRowIndex = -1;
  for (let i = 1; i < data1.length; i++) {
    const row = data1[i];
    if (row && String(row[0] || "").toLowerCase().includes("name")) {
      headerRowIndex = i;
      break;
    }
  }

  const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 2;

  for (let i = startRow; i < data1.length; i++) {
    const row = data1[i];
    if (!row) continue;
    const name = normalizeName(String(row[0] || ""));
    if (!name) continue; // blank row → just a separator

    // Skip the literal header label only.
    if (name.toLowerCase() === "name") continue;

    const spRaw = row[1];
    const stdHoursRaw = row[2];
    const leaveRaw = row[3];
    const dependencies = String(row[4] || "").trim() || undefined;
    const remarks = String(row[5] || "").trim() || undefined;

    const storyPoints = spRaw === "" || spRaw == null ? null : Number(spRaw);
    const standardHours = stdHoursRaw === "" || stdHoursRaw == null ? null : Number(stdHoursRaw);
    const leaveDays = parseLeaves(leaveRaw as string | number | null | undefined);

    const isNameOnly =
      name &&
      (storyPoints == null || Number.isNaN(storyPoints)) &&
      (standardHours == null || Number.isNaN(standardHours)) &&
      leaveDays === 0 &&
      !dependencies &&
      !remarks;

    // A name-only row is a TEAM HEADER only when it matches the known team list
    // (Backend, Frontend, DevOps, QA, Integrations, Platform, CORE, Payme App).
    // Any other name-only row is a PERSON and is imported with zero capacity —
    // nobody is ever skipped. People inherit the current team.
    if (isNameOnly) {
      const team = matchKnownTeam(name);
      if (team) {
        currentTeam = team;
        continue;
      }
      resources.push({
        team: currentTeam,
        name,
        story_points: 0,
        standard_hours: 0,
        leave_days: 0,
        dependencies,
        remarks,
        warnings: ["no capacity data — imported with zeros"],
      });
      continue;
    }

    const rowWarnings: string[] = [];
    if (storyPoints == null || Number.isNaN(storyPoints)) {
      rowWarnings.push("missing story points");
    }
    if (standardHours == null || Number.isNaN(standardHours)) {
      rowWarnings.push("missing standard hours");
    }

    // Normalize the team to a canonical label if it happens to match a known
    // team alias (e.g. a "Web" header earlier becomes "Frontend").
    const team = matchKnownTeam(currentTeam) ?? currentTeam;

    resources.push({
      team,
      name,
      story_points: storyPoints || 0,
      standard_hours: standardHours || 0,
      leave_days: leaveDays,
      dependencies,
      remarks,
      warnings: rowWarnings,
    });
  }

  const tasks = parseAllocationTasks(workbook, startDate);

  return {
    type: "allocation",
    name: sprintName,
    start_date: startDate,
    end_date: endDate,
    resources,
    tasks,
    warnings,
  };
}

/**
 * Parse the loose task block(s) on Sheet 2 of the allocation file.
 * Kept on the allocation parser because those tasks are informal capacity
 * notes, not the structured sprint task plan.
 */
function parseAllocationTasks(
  workbook: XLSX.WorkBook,
  startDate: string | null
): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  if (workbook.SheetNames.length <= 1) return tasks;

  const data2 = sheetRows(workbook, 1);

  let taskHeaderIndex = -1;
  const headerMap: Record<string, number> = {};
  for (let i = 0; i < data2.length; i++) {
    const row = data2[i];
    if (!row) continue;
    // The structured task header can appear in any column ("Resource Name"
    // sits in column 1 in the reference file), so scan all cells.
    let resourceCol = -1;
    let taskCol = -1;
    let startCol = -1;
    let daysCol = -1;
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || "").toLowerCase();
      if (cell.includes("resource") && cell.includes("name")) resourceCol = c;
      else if (cell.includes("task")) taskCol = c;
      else if (cell.includes("start")) startCol = c;
      else if (cell.includes("day") || cell.includes("effort")) daysCol = c;
    }
    if (resourceCol >= 0 && (taskCol >= 0 || startCol >= 0 || daysCol >= 0)) {
      taskHeaderIndex = i;
      headerMap.resource = resourceCol;
      headerMap.task = taskCol >= 0 ? taskCol : resourceCol + 1;
      if (startCol >= 0) headerMap.start = startCol;
      if (daysCol >= 0) headerMap.days = daysCol;
      break;
    }
  }

  if (taskHeaderIndex >= 0 && headerMap.resource != null) {
    const fallbackYear = startDate ? new Date(startDate).getFullYear() : undefined;
    for (let i = taskHeaderIndex + 1; i < data2.length; i++) {
      const row = data2[i];
      if (!row) continue;
      const resourceName = normalizeName(String(row[headerMap.resource] || ""));
      const title = String(row[headerMap.task] || "").trim();
      if (!resourceName || !title) continue;

      const startStr = headerMap.start != null ? row[headerMap.start] : null;
      const daysStr = headerMap.days != null ? row[headerMap.days] : null;

      const start_date = startStr ? parseIndianDate(startStr as string | number, fallbackYear) : null;
      const estimated_days = daysStr ? Number(daysStr as string | number) || null : null;

      tasks.push({
        resourceName,
        title,
        start_date,
        estimated_days,
        category: detectCategory(title),
        status: "todo",
      });
    }
  }

  // Also parse the informal "in-hand" loose two-column block above the table.
  for (let i = 0; i < (taskHeaderIndex >= 0 ? taskHeaderIndex : data2.length); i++) {
    const row = data2[i];
    if (!row) continue;
    // In the reference file the loose block puts the name in column 1.
    const resourceName = normalizeName(String(row[1] || row[0] || ""));
    const title = String(row[2] || row[1] || "").trim();
    if (!resourceName || !title) continue;
    if (resourceName.toLowerCase().includes("resource")) continue;
    if (title.toLowerCase().includes("task")) continue;

    tasks.push({
      resourceName,
      title,
      start_date: null,
      estimated_days: null,
      category: detectCategory(title),
      status: "todo",
    });
  }

  return tasks;
}

/**
 * Parse a Sprint plan file: a sprint title/date-range header cell plus a task
 * table with Owner/Resource, Task, Start Date, UAT Date, and Remarks columns.
 * Header matching is fuzzy (substring, case-insensitive) so minor naming
 * differences in the PM's export are tolerated. Built to the agreed column
 * shape; aligned to the real export once a sample is provided.
 *
 * Throws FileTypeMismatchError if the file structurally looks like an
 * allocation capacity sheet.
 */
export function parseSprintFile(
  buffer: ArrayBuffer,
  fileName?: string
): ParsedSprintPlan {
  const workbook = XLSX.read(buffer, { type: "array" });
  const detected = detectFileType(workbook);
  if (detected === "allocation") {
    throw new FileTypeMismatchError("sprint", detected);
  }

  const warnings: string[] = [];
  let sprintName = "";
  let startDate: string | null = null;
  let endDate: string | null = null;

  // Sprint name + date range: the first non-empty cell anywhere in the first
  // few rows of the first sheet that contains a date range, else the first
  // non-empty cell.
  const firstSheet = sheetRows(workbook, 0);
  outer: for (let i = 0; i < Math.min(firstSheet.length, 3); i++) {
    for (const cell of firstSheet[i] || []) {
      const str = String(cell ?? "").trim();
      if (!str) continue;
      const parsed = parseDateRange(str);
      if (parsed.start_date || parsed.end_date) {
        sprintName = parsed.name;
        startDate = parsed.start_date;
        endDate = parsed.end_date;
        break outer;
      }
      if (!sprintName) sprintName = str;
    }
  }

  // Fallback to the uploaded file name for name/dates when the sheet lacks them.
  if (!sprintName.trim() || (!startDate && !endDate)) {
    const fromFile = nameFromFile(fileName);
    if (!sprintName.trim() && fromFile.name) sprintName = fromFile.name;
    if (!startDate && fromFile.start_date) startDate = fromFile.start_date;
    if (!endDate && fromFile.end_date) endDate = fromFile.end_date;
  }

  // Locate the task table header across all sheets.
  const tasks: ParsedSprintTask[] = [];
  const fallbackYear = startDate ? new Date(startDate).getFullYear() : undefined;

  for (let s = 0; s < workbook.SheetNames.length; s++) {
    const rows = sheetRows(workbook, s);
    let headerIndex = -1;
    const map: Record<string, number> = {};
    for (let i = 0; i < rows.length; i++) {
      const cells = rowToLowerCells(rows[i]);
      let owner = -1;
      let task = -1;
      let start = -1;
      let uat = -1;
      let days = -1;
      let remarks = -1;
      for (let c = 0; c < cells.length; c++) {
        const cell = cells[c];
        if (owner < 0 && (cell.includes("owner") || cell.includes("resource") || cell === "name"))
          owner = c;
        else if (task < 0 && cell.includes("task")) task = c;
        else if (uat < 0 && cell.includes("uat")) uat = c;
        else if (start < 0 && cell.includes("start")) start = c;
        else if (days < 0 && (cell.includes("day") || cell.includes("effort"))) days = c;
        else if (remarks < 0 && (cell.includes("remark") || cell.includes("depend") || cell.includes("constraint")))
          remarks = c;
      }
      if (owner >= 0 && task >= 0) {
        headerIndex = i;
        map.owner = owner;
        map.task = task;
        if (start >= 0) map.start = start;
        if (uat >= 0) map.uat = uat;
        if (days >= 0) map.days = days;
        if (remarks >= 0) map.remarks = remarks;
        break;
      }
    }
    if (headerIndex < 0) continue;

    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const owner = normalizeName(cellStr(row, map.owner));
      const title = cellStr(row, map.task);
      if (!owner || !title) continue;
      if (owner.toLowerCase().includes("owner") || owner.toLowerCase().includes("resource")) continue;

      const startStr = map.start != null ? row[map.start] : null;
      const uatStr = map.uat != null ? row[map.uat] : null;
      const daysStr = map.days != null ? row[map.days] : null;
      const remarks = map.remarks != null ? cellStr(row, map.remarks) || undefined : undefined;

      const rowWarnings: string[] = [];
      const start_date = startStr ? parseIndianDate(startStr as string | number, fallbackYear) : null;
      const uat_date = uatStr ? parseIndianDate(uatStr as string | number, fallbackYear) : null;
      if (startStr && !start_date) rowWarnings.push("unparseable start date");
      if (uatStr && !uat_date) rowWarnings.push("unparseable UAT date");
      const estimated_days = daysStr ? Number(daysStr as string | number) || null : null;

      tasks.push({
        owner,
        title,
        start_date,
        uat_date,
        estimated_days,
        category: detectCategory(title),
        remarks,
        warnings: rowWarnings,
      });
    }
    break; // first sheet with a recognizable task table wins
  }

  if (tasks.length === 0) {
    warnings.push("No task rows found. Confirm the file has Owner/Task columns.");
  }

  return {
    type: "sprint",
    name: sprintName,
    start_date: startDate,
    end_date: endDate,
    tasks,
    warnings,
  };
}
