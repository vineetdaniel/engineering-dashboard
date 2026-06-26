import { parse, isValid, format } from "date-fns";

export function parseIndianDate(
  value: string | number | null | undefined,
  fallbackYear?: number
): string | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;

  // A trailing "'26" two-digit year (e.g. "11th June'26") becomes a 20YY fallback
  // and is stripped so date-fns can match the day/month portion.
  const twoDigitYear = str.match(/'(\d{2})\b/)?.[1];
  const effectiveFallbackYear = twoDigitYear ? 2000 + Number(twoDigitYear) : fallbackYear;

  // Remove ordinals (1st, 2nd, 3rd, 4th, ...) and any "'YY" suffix
  const clean = str
    .replace(/'(\d{2})\b/g, "")
    .replace(/(\d+)(st|nd|rd|th)\b/gi, "$1")
    .trim();

  const formats = [
    "d MMMM yyyy",
    "d MMM yyyy",
    "d MMMM",
    "d MMM",
    "dd MMMM yyyy",
    "dd MMM yyyy",
    "dd MMMM",
    "dd MMM",
    "yyyy-MM-dd",
    "dd/MM/yyyy",
    "d/M/yyyy",
    "dd-MM-yyyy",
  ];

  for (const fmt of formats) {
    const parsed = parse(clean, fmt, new Date());
    if (isValid(parsed)) {
      let year = parsed.getFullYear();
      if (fmt.includes("yyyy") === false && effectiveFallbackYear) {
        year = effectiveFallbackYear;
      }
      const withYear = new Date(year, parsed.getMonth(), parsed.getDate());
      return format(withYear, "yyyy-MM-dd");
    }
  }

  // Try native fallback
  const native = new Date(str);
  if (isValid(native) && !isNaN(native.getTime())) {
    return format(native, "yyyy-MM-dd");
  }

  return null;
}

export function parseDateRange(value: string): {
  name: string;
  start_date: string | null;
  end_date: string | null;
} {
  const full = value.trim();
  // Extract range like "29th May to 11th June'26" or "29 May to 11 June 2026"
  const rangeMatch = full.match(
    /(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,})\s*(?:to|–|-)\s*(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,}(?:\s*'\d{2}|\s+\d{4})?)/i
  );

  let startDate: string | null = null;
  let endDate: string | null = null;

  if (rangeMatch) {
    const startStr = rangeMatch[1];
    const endStr = rangeMatch[2];
    // Prefer a full 4-digit year; otherwise accept a 2-digit "'26" suffix as 20YY.
    const fourDigit = full.match(/(\d{4})/)?.[1];
    const twoDigit = full.match(/'(\d{2})\b/)?.[1];
    const fallbackYear = fourDigit
      ? Number(fourDigit)
      : twoDigit
      ? 2000 + Number(twoDigit)
      : undefined;

    startDate = parseIndianDate(startStr, fallbackYear);
    endDate = parseIndianDate(endStr, fallbackYear);

    // If end year is missing but start has year, use start year for end
    if (!endDate && startDate) {
      const startYear = new Date(startDate).getFullYear();
      endDate = parseIndianDate(endStr, startYear);
    }
  }

  return { name: full, start_date: startDate, end_date: endDate };
}
