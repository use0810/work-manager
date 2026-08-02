import { differenceInMinutes, format, parseISO, startOfWeek, addDays } from 'date-fns';
import type { ArchivedMonth, WorkRecord } from '../types';

/** 種別未設定の表示名（集計用） */
export const UNCATEGORIZED_LABEL = '未分類';

/** 表示用ラベル（カテゴリ / 選択肢） */
export function formatCategoryLabel(category: string, categoryOption?: string): string {
  const c = category?.trim() ?? '';
  const o = categoryOption?.trim() ?? '';
  if (!c && !o) return UNCATEGORIZED_LABEL;
  if (c && o) return `${c} / ${o}`;
  return c || o;
}

/** 集計キー（カテゴリ名優先。無ければ選択肢・未分類） */
export function categoryGroupKey(category: string, categoryOption?: string): string {
  const c = category?.trim() ?? '';
  if (c) return c;
  const o = categoryOption?.trim() ?? '';
  return o || UNCATEGORIZED_LABEL;
}

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

export function yearMonthFromIso(iso: string): string {
  return format(parseISO(iso), 'yyyy年MM月');
}

export function groupByYearMonth(records: WorkRecord[]): [string, WorkRecord[]][] {
  const map = new Map<string, WorkRecord[]>();
  for (const r of records) {
    const key = yearMonthFromIso(r.startAt);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

export function getWeekDays(baseDate: Date): Date[] {
  const start = startOfWeek(baseDate, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 入力候補用：使われたカテゴリ名を昇順で返す */
export function collectCategorySuggestions(...recordLists: WorkRecord[][]): string[] {
  const set = new Set<string>();
  for (const list of recordLists) {
    for (const r of list) {
      const c = r.category?.trim();
      if (c) set.add(c);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'ja'));
}

export interface CategorySummaryRow {
  category: string;
  minutes: number;
}

/** カテゴリごとの合計時間（分）。未設定は「未分類」 */
export function summarizeByCategory(records: WorkRecord[]): CategorySummaryRow[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const key = categoryGroupKey(r.category, r.categoryOption);
    const mins = Math.max(0, differenceInMinutes(parseISO(r.endAt), parseISO(r.startAt)));
    map.set(key, (map.get(key) ?? 0) + mins);
  }
  return Array.from(map.entries())
    .map(([category, minutes]) => ({ category, minutes }))
    .sort((a, b) => b.minutes - a.minutes || a.category.localeCompare(b.category, 'ja'));
}

/** 選択肢ごとの合計（同カテゴリ内の内訳） */
export function summarizeByCategoryOption(records: WorkRecord[]): CategorySummaryRow[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const key = formatCategoryLabel(r.category, r.categoryOption);
    const mins = Math.max(0, differenceInMinutes(parseISO(r.endAt), parseISO(r.startAt)));
    map.set(key, (map.get(key) ?? 0) + mins);
  }
  return Array.from(map.entries())
    .map(([category, minutes]) => ({ category, minutes }))
    .sort((a, b) => b.minutes - a.minutes || a.category.localeCompare(b.category, 'ja'));
}

export interface MonthSummaryRow {
  yearMonth: string;
  minutes: number;
}

/** 月ごとの合計（新しい順の months 配列に沿う） */
export function summarizeByMonths(
  months: string[],
  records: WorkRecord[],
  archives: ArchivedMonth[]
): MonthSummaryRow[] {
  return months.map(yearMonth => {
    const { records: monthRecords } = recordsForYearMonth(yearMonth, records, archives);
    return { yearMonth, minutes: totalWorkMinutes(monthRecords) };
  });
}

/** 一覧・アーカイブに存在する年月（新しい順） */
export function listAvailableYearMonths(records: WorkRecord[], archives: ArchivedMonth[]): string[] {
  const set = new Set<string>();
  for (const r of records) set.add(yearMonthFromIso(r.startAt));
  for (const a of archives) set.add(a.yearMonth);
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

export type MonthRecordSource = 'list' | 'archive' | 'empty';

/**
 * その月の集計対象レコード。
 * 日時一覧に残っていればそれを優先。なければ最新版アーカイブ。
 */
export function recordsForYearMonth(
  yearMonth: string,
  records: WorkRecord[],
  archives: ArchivedMonth[]
): { records: WorkRecord[]; source: MonthRecordSource } {
  const fromList = records.filter(r => yearMonthFromIso(r.startAt) === yearMonth);
  if (fromList.length > 0) return { records: fromList, source: 'list' };

  const versions = archives.filter(a => a.yearMonth === yearMonth);
  if (versions.length === 0) return { records: [], source: 'empty' };
  const latest = versions.reduce((a, b) => (a.version >= b.version ? a : b));
  return { records: latest.records, source: 'archive' };
}
