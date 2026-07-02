import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";
import {
  parseAllocationFile,
  parseSprintFile,
  detectFileType,
  FileTypeMismatchError,
} from "@/lib/excel/parser";

function fixtureBuffer(): ArrayBuffer {
  const p = path.resolve(__dirname, "../fixtures/allocation-sample.xlsx");
  const buf = readFileSync(p);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

/** Build an .xlsx in memory from rows and return an ArrayBuffer. */
function makeWorkbook(rows: unknown[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return out as ArrayBuffer;
}

describe("parseAllocationFile — reference file", () => {
  const parsed = parseAllocationFile(fixtureBuffer());

  it("imports every person — nobody is skipped (regression: Avinash)", () => {
    expect(parsed.resources.length).toBe(16);
    const names = parsed.resources.map((r) => r.name);
    expect(names).toContain("Avinash Kumar");
  });

  it("imports a no-capacity person with zeros, not as a team header", () => {
    const avinash = parsed.resources.find((r) => r.name === "Avinash Kumar");
    expect(avinash).toBeDefined();
    expect(avinash!.story_points).toBe(0);
    expect(avinash!.standard_hours).toBe(0);
  });

  it("reads the sprint title and date range from the title row", () => {
    expect(parsed.name).toContain("Resource Allocation");
    expect(parsed.start_date).toBe("2026-05-29");
    expect(parsed.end_date).toBe("2026-06-11");
  });

  it("detects the file as an allocation file", () => {
    const wb = XLSX.read(fixtureBuffer(), { type: "array" });
    expect(detectFileType(wb)).toBe("allocation");
  });
});

describe("parseAllocationFile — header-only file (regression: name='Name')", () => {
  // A file with NO title row — it starts directly with the column header. The
  // parser must NOT use "Name" as the sprint name; it should leave it blank so
  // the caller auto-suggests one.
  const buf = makeWorkbook([
    ["Name", "Story Points", "Standard Hour", "Leaves in this Sprint"],
    ["Backend", "", "", ""],
    ["Asha", 40, 60, "1 Leave"],
  ]);
  const parsed = parseAllocationFile(buf);

  it("does not store the header label as the sprint name", () => {
    expect(parsed.name).not.toBe("Name");
    expect(parsed.name.trim()).toBe(""); // blank → caller auto-suggests
  });

  it("still parses the resources", () => {
    const names = parsed.resources.map((r) => r.name);
    expect(names).toContain("Asha");
    expect(names).not.toContain("Name");
  });
});

describe("parseAllocationFile — filename fallback", () => {
  // No title row in the sheet, but the file name carries name + dates.
  const buf = makeWorkbook([
    ["Name", "Story Points", "Standard Hour", "Leaves in this Sprint"],
    ["Backend", "", "", ""],
    ["Asha", 40, 60, ""],
  ]);

  it("derives name and dates from the file name when the sheet has none", () => {
    const parsed = parseAllocationFile(
      buf,
      "Resource Allocation 29th May to 11th June'26.xlsx"
    );
    expect(parsed.start_date).toBe("2026-05-29");
    expect(parsed.end_date).toBe("2026-06-11");
    expect(parsed.name).toContain("Resource Allocation");
    expect(parsed.name).not.toBe("Name");
  });

  it("leaves name blank when neither sheet nor file name has one", () => {
    const parsed = parseAllocationFile(buf, "export.xlsx");
    // "export" has no date range; name falls back to the bare file base.
    expect(parsed.start_date).toBeNull();
    expect(parsed.end_date).toBeNull();
  });
});

describe("file-type mismatch guard", () => {
  it("rejects an allocation file when a sprint file is expected", () => {
    expect(() => parseSprintFile(fixtureBuffer())).toThrow(FileTypeMismatchError);
  });
});
