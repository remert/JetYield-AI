// Date helpers that work on YYYY-MM-DD strings in UTC so server and client agree.

const DAY_MS = 86_400_000;

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseISODate(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

export function addDays(s: string, days: number): string {
  return toISODate(new Date(parseISODate(s).getTime() + days * DAY_MS));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / DAY_MS);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function monthKey(s: string): string {
  return s.slice(0, 7);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthLabel(key: string): string {
  return MONTHS[Number(key.slice(5, 7)) - 1];
}

export function formatDate(s: string): string {
  const d = parseISODate(s);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseISODate(s);
  return !Number.isNaN(d.getTime()) && toISODate(d) === s;
}
