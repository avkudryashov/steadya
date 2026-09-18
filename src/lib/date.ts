import { WEEKDAYS, type Weekday } from '@/content/schemas';

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function todayIso(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalDate(iso: string): Date {
  const m = ISO.exec(iso);
  if (!m) throw new Error(`date must be YYYY-MM-DD, got "${iso}"`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function weekdayOf(iso: string): Weekday {
  const jsDay = toLocalDate(iso).getDay();
  return WEEKDAYS[(jsDay + 6) % 7]!;
}

export function addDays(iso: string, n: number): string {
  const d = toLocalDate(iso);
  d.setDate(d.getDate() + n);
  return todayIso(d);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = toLocalDate(toIso).getTime() - toLocalDate(fromIso).getTime();
  return Math.round(ms / 86_400_000);
}
