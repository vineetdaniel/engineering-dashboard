import { describe, it, expect } from "vitest";
import { parseIndianDate, parseDateRange, suggestSprintName } from "@/lib/dates";

describe("parseIndianDate", () => {
  it("parses ordinal day + month + year", () => {
    expect(parseIndianDate("28th May 2026")).toBe("2026-05-28");
    expect(parseIndianDate("3rd June 2026")).toBe("2026-06-03");
  });

  it("uses the fallback year when none is present", () => {
    expect(parseIndianDate("29th May", 2026)).toBe("2026-05-29");
  });

  it("handles a trailing 'YY suffix glued to the month (regression)", () => {
    // This was the bug: "11th June'26" parsed to the wrong year / null.
    expect(parseIndianDate("11th June'26")).toBe("2026-06-11");
  });

  it("returns null for unparseable input", () => {
    expect(parseIndianDate("not a date")).toBeNull();
    expect(parseIndianDate("")).toBeNull();
    expect(parseIndianDate(null)).toBeNull();
  });
});

describe("parseDateRange", () => {
  it("parses a full ordinal range with a 'YY suffix (regression)", () => {
    const r = parseDateRange("Resource Allocation- 29th May to 11th June'26");
    expect(r.start_date).toBe("2026-05-29");
    expect(r.end_date).toBe("2026-06-11");
    expect(r.name).toContain("Resource Allocation");
  });

  it("leaves dates null when no range is present", () => {
    const r = parseDateRange("Some sprint with no dates");
    expect(r.start_date).toBeNull();
    expect(r.end_date).toBeNull();
  });
});

describe("suggestSprintName", () => {
  it("keeps a provided name", () => {
    expect(suggestSprintName("Sprint 25", "2026-05-29", "2026-06-11")).toBe("Sprint 25");
  });

  it("builds Sprint-<start>-<end> when name is blank", () => {
    expect(suggestSprintName("", "2026-05-29", "2026-06-11")).toBe(
      "Sprint-2026-05-29-2026-06-11"
    );
    expect(suggestSprintName(null, "2026-05-29", "2026-06-11")).toBe(
      "Sprint-2026-05-29-2026-06-11"
    );
  });

  it("handles a single date", () => {
    expect(suggestSprintName("", "2026-05-29", "")).toBe("Sprint-2026-05-29");
    expect(suggestSprintName("", "", "2026-06-11")).toBe("Sprint-2026-06-11");
  });

  it("falls back to 'Sprint' when nothing is provided (never blank)", () => {
    expect(suggestSprintName("", "", "")).toBe("Sprint");
    expect(suggestSprintName(null, null, null)).toBe("Sprint");
  });

  it("trims whitespace-only names so they count as blank", () => {
    expect(suggestSprintName("   ", "2026-05-29", "2026-06-11")).toBe(
      "Sprint-2026-05-29-2026-06-11"
    );
  });
});
