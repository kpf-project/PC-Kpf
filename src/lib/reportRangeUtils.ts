const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export type NormalizedRange = {
  startIso: string;
  endIso: string;
  label: string;
  startDate: Date;
  endDate: Date;
};

type IsoParts = {
  year: number;
  month: number;
  day: number;
};

function parseIsoDate(value: string): IsoParts | null {
  const match = ISO_DATE_REGEX.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number.parseInt(match[1]!, 10);
  const month = Number.parseInt(match[2]!, 10);
  const day = Number.parseInt(match[3]!, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  return { year, month, day };
}

function toIsoString(parts: IsoParts): string {
  const { year, month, day } = parts;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

function toUtcDate(parts: IsoParts): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

export function formatRangeLabel(startDate: Date, endDate: Date, timeZone: string): string {
  const sameDay = startDate.getTime() === endDate.getTime();
  const sameYear =
    startDate.getUTCFullYear() === endDate.getUTCFullYear();
  const sameMonth =
    sameYear && startDate.getUTCMonth() === endDate.getUTCMonth();

  const fullFormatter = new Intl.DateTimeFormat("th-TH", {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (sameDay) {
    return fullFormatter.format(startDate);
  }

  if (sameMonth) {
    const startFormatter = new Intl.DateTimeFormat("th-TH", {
      timeZone,
      day: "numeric",
    });
    const endFormatter = new Intl.DateTimeFormat("th-TH", {
      timeZone,
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return `${startFormatter.format(startDate)} – ${endFormatter.format(endDate)}`;
  }

  if (sameYear) {
    const startFormatter = new Intl.DateTimeFormat("th-TH", {
      timeZone,
      day: "numeric",
      month: "short",
    });
    const endFormatter = new Intl.DateTimeFormat("th-TH", {
      timeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return `${startFormatter.format(startDate)} – ${endFormatter.format(endDate)}`;
  }

  const formatter = new Intl.DateTimeFormat("th-TH", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${formatter.format(startDate)} – ${formatter.format(endDate)}`;
}

export function normalizeRangesFromParams(
  values: string[],
  timeZone: string,
): NormalizedRange[] {
  const ranges: NormalizedRange[] = [];

  for (const value of values) {
    if (!value) continue;
    const [rawStart, rawEnd] = value.split(":");
    const startParts = parseIsoDate(rawStart ?? "");
    if (!startParts) continue;
    const endParts = parseIsoDate(rawEnd ?? rawStart ?? "");
    if (!endParts) continue;

    const startDate = toUtcDate(startParts);
    const endDate = toUtcDate(endParts);
    const [normalizedStart, normalizedEnd] =
      startDate.getTime() <= endDate.getTime()
        ? [startParts, endParts]
        : [endParts, startParts];

    const start = toUtcDate(normalizedStart);
    const end = toUtcDate(normalizedEnd);
    const startIso = toIsoString(normalizedStart);
    const endIso = toIsoString(normalizedEnd);
    const label = formatRangeLabel(start, end, timeZone);

    ranges.push({
      startIso,
      endIso,
      label,
      startDate: start,
      endDate: end,
    });
  }

  ranges.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return ranges;
}

export function expandRangesToIsoDates(ranges: NormalizedRange[]): string[] {
  const isoSet = new Set<string>();
  for (const range of ranges) {
    const current = new Date(range.startDate.getTime());
    const end = range.endDate.getTime();
    while (current.getTime() <= end) {
      isoSet.add(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }
  return Array.from(isoSet).sort();
}

export function formatRangeSummary(ranges: NormalizedRange[]): string {
  return ranges.map((range) => range.label).join(", ");
}

export function shiftIsoDate(iso: string, days: number): string | null {
  const parts = parseIsoDate(iso);
  if (!parts) return null;
  const date = toUtcDate(parts);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function parseIsoDateOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const parts = parseIsoDate(value);
  if (!parts) return null;
  return toIsoString(parts);
}
