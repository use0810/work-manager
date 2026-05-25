import { differenceInMinutes, format, parseISO, startOfWeek, addDays } from 'date-fns';
import type { WorkRecord } from '../types';

/** 各レコードの (終了−開始) を分で合計（負や不正は 0 扱い） */
export function totalWorkMinutes(records: WorkRecord[]): number {
  let sum = 0;
  for (const r of records) {
    sum += Math.max(0, differenceInMinutes(parseISO(r.endAt), parseISO(r.startAt)));
  }
  return sum;
}

export function formatHoursMinutes(totalMinutes: number): string {
  return `${Math.floor(totalMinutes / 60)}時間${totalMinutes % 60}分`;
}

export function todayNoonISO(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

export function groupByYearMonth(records: WorkRecord[]): [string, WorkRecord[]][] {
  const map = new Map<string, WorkRecord[]>();
  for (const r of records) {
    const key = format(parseISO(r.startAt), 'yyyy年MM月');
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

export function getWeekDays(baseDate: Date): Date[] {
  const start = startOfWeek(baseDate, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
