const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;
const DISPLAY_DATE_PATTERN = /^(\d{2})-(\d{2})-(\d{4})$/;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function formatDisplayDate(value?: string | Date | null) {
  if (!value) return '';

  const raw = value instanceof Date ? value.toISOString() : String(value);
  const isoMatch = raw.match(ISO_DATE_PREFIX);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}-${month}-${year}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';

  return `${pad(parsed.getUTCDate())}-${pad(parsed.getUTCMonth() + 1)}-${parsed.getUTCFullYear()}`;
}

export function parseDisplayDate(value?: string | null) {
  if (!value) return '';

  const trimmed = value.trim();
  if (!trimmed) return '';

  const isoMatch = trimmed.match(ISO_DATE_PREFIX);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const displayMatch = trimmed.match(DISPLAY_DATE_PATTERN);
  if (!displayMatch) return '';

  const [, day, month, year] = displayMatch;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() !== Number(month) - 1 ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return '';
  }

  return parsed.toISOString().slice(0, 10);
}
