import { differenceInMinutes, format, parseISO, startOfWeek, addDays } from 'date-fns';
import type { ArchivedMonth, CategoryAssignment, WorkRecord } from '../types';
import { withSyncedCategoryFields } from './recordValidation';

/** 種別未設定の表示名（集計用） */
export const UNCATEGORIZED_LABEL = '未分類';

export function getRecordCategories(r: WorkRecord): CategoryAssignment[] {
  if (Array.isArray(r.categories) && r.categories.length > 0) return r.categories;
  const c = r.category?.trim() ?? '';
  const o = r.categoryOption?.trim() ?? '';
  if (!c && !o) return [];
  return [{ name: c || UNCATEGORIZED_LABEL, option: o }];
}

/** 表示用（複数カテゴリ） */
export function formatRecordCategories(r: WorkRecord): string {
  const list = getRecordCategories(r);
  if (list.length === 0) return UNCATEGORIZED_LABEL;
  return list
    .map(a => (a.option.trim() ? `${a.name}: ${a.option}` : a.name))
    .join(' ｜ ');
}

/** 表示用ラベル（単一・後方互換） */
export function formatCategoryLabel(category: string, categoryOption?: string): string {
  const c = category?.trim() ?? '';
  const o = categoryOption?.trim() ?? '';
  if (!c && !o) return UNCATEGORIZED_LABEL;
  if (c && o) return `${c}: ${o}`;
  return c || o;
}

/** assignments を legacy 付きでレコードに載せる */
export function applyCategoriesToRecord<T extends object>(
  record: T,
  categories: CategoryAssignment[]
): T & Pick<WorkRecord, 'categories' | 'category' | 'categoryOption'> {
  return { ...record, ...withSyncedCategoryFields(categories) };
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

export interface CategorySummaryRow {
  category: string;
  minutes: number;
}

/**
 * 指定カテゴリ次元の選択肢ごとの合計。
 * dimension が空なら「カテゴリ名: 選択肢」のフラット集計（各軸に同一時間を加算）。
 */
export function summarizeByCategoryDimension(
  records: WorkRecord[],
  dimension?: string
): CategorySummaryRow[] {
  const map = new Map<string, number>();
  const dim = dimension?.trim() ?? '';

  for (const r of records) {
    const mins = Math.max(0, differenceInMinutes(parseISO(r.endAt), parseISO(r.startAt)));
    const cats = getRecordCategories(r);

    if (dim) {
      const hit = cats.find(c => c.name === dim);
      const key = hit?.option?.trim()
        ? hit.option.trim()
        : hit
          ? '（選択肢なし）'
          : UNCATEGORIZED_LABEL;
      map.set(key, (map.get(key) ?? 0) + mins);
      continue;
    }

    if (cats.length === 0) {
      map.set(UNCATEGORIZED_LABEL, (map.get(UNCATEGORIZED_LABEL) ?? 0) + mins);
      continue;
    }
    for (const a of cats) {
      const key = a.option.trim() ? `${a.name}: ${a.option}` : a.name;
      map.set(key, (map.get(key) ?? 0) + mins);
    }
  }

  return Array.from(map.entries())
    .map(([category, minutes]) => ({ category, minutes }))
    .sort((a, b) => b.minutes - a.minutes || a.category.localeCompare(b.category, 'ja'));
}

/** カテゴリ名ごとの合計（各軸に同一時間を加算） */
export function summarizeByCategory(records: WorkRecord[]): CategorySummaryRow[] {
  const map = new Map<string, number>();
  for (const r of records) {
    const cats = getRecordCategories(r);
    const mins = Math.max(0, differenceInMinutes(parseISO(r.endAt), parseISO(r.startAt)));
    if (cats.length === 0) {
      map.set(UNCATEGORIZED_LABEL, (map.get(UNCATEGORIZED_LABEL) ?? 0) + mins);
      continue;
    }
    for (const a of cats) {
      map.set(a.name, (map.get(a.name) ?? 0) + mins);
    }
  }
  return Array.from(map.entries())
    .map(([category, minutes]) => ({ category, minutes }))
    .sort((a, b) => b.minutes - a.minutes || a.category.localeCompare(b.category, 'ja'));
}

export function summarizeByCategoryOption(records: WorkRecord[]): CategorySummaryRow[] {
  return summarizeByCategoryDimension(records);
}

function optionForDimension(r: WorkRecord, dimension: string): string {
  const dim = dimension.trim();
  if (!dim) return UNCATEGORIZED_LABEL;
  const hit = getRecordCategories(r).find(c => c.name === dim);
  if (!hit) return UNCATEGORIZED_LABEL;
  const opt = hit.option.trim();
  return opt || '（選択肢なし）';
}

function sortAxisKeys(keys: Iterable<string>): string[] {
  const special = new Set([UNCATEGORIZED_LABEL, '（選択肢なし）']);
  return Array.from(keys).sort((a, b) => {
    const aSpec = special.has(a) ? 1 : 0;
    const bSpec = special.has(b) ? 1 : 0;
    if (aSpec !== bSpec) return aSpec - bSpec;
    return a.localeCompare(b, 'ja');
  });
}

export interface TwoAxisWeekSummary {
  weekStartKey: string;
  weekLabel: string;
  rowKeys: string[];
  colKeys: string[];
  /** `${row}\t${col}` → minutes */
  cells: Record<string, number>;
  rowTotals: Record<string, number>;
  colTotals: Record<string, number>;
  totalMinutes: number;
}

function cellKey(row: string, col: string): string {
  return `${row}\t${col}`;
}

/**
 * 月内レコードを週（月曜始まり）ごとに分け、二軸カテゴリのクロス集計にする。
 * 時間はレコード単位で1回だけ加算（二重計上なし）。
 */
export function summarizeMonthWeeksTwoAxis(
  records: WorkRecord[],
  rowDimension: string,
  colDimension: string
): TwoAxisWeekSummary[] {
  const rowDim = rowDimension.trim();
  const colDim = colDimension.trim();
  if (!rowDim || !colDim || rowDim === colDim) return [];

  type WeekAcc = {
    weekStart: Date;
    cells: Map<string, number>;
    rowKeys: Set<string>;
    colKeys: Set<string>;
    total: number;
  };
  const weeks = new Map<string, WeekAcc>();

  for (const r of records) {
    const mins = Math.max(0, differenceInMinutes(parseISO(r.endAt), parseISO(r.startAt)));
    if (mins <= 0) continue;
    const start = parseISO(r.startAt);
    const weekStart = startOfWeek(start, { weekStartsOn: 1 });
    const weekStartKey = format(weekStart, 'yyyy-MM-dd');
    let acc = weeks.get(weekStartKey);
    if (!acc) {
      acc = {
        weekStart,
        cells: new Map(),
        rowKeys: new Set(),
        colKeys: new Set(),
        total: 0,
      };
      weeks.set(weekStartKey, acc);
    }
    const row = optionForDimension(r, rowDim);
    const col = optionForDimension(r, colDim);
    acc.rowKeys.add(row);
    acc.colKeys.add(col);
    const k = cellKey(row, col);
    acc.cells.set(k, (acc.cells.get(k) ?? 0) + mins);
    acc.total += mins;
  }

  return Array.from(weeks.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, acc]) => {
      const rowKeys = sortAxisKeys(acc.rowKeys);
      const colKeys = sortAxisKeys(acc.colKeys);
      const cells: Record<string, number> = {};
      const rowTotals: Record<string, number> = {};
      const colTotals: Record<string, number> = {};
      for (const [k, v] of acc.cells) {
        cells[k] = v;
        const [row, col] = k.split('\t');
        rowTotals[row] = (rowTotals[row] ?? 0) + v;
        colTotals[col] = (colTotals[col] ?? 0) + v;
      }
      const weekEnd = addDays(acc.weekStart, 6);
      return {
        weekStartKey: format(acc.weekStart, 'yyyy-MM-dd'),
        weekLabel: `${format(acc.weekStart, 'M/d')}〜${format(weekEnd, 'M/d')}`,
        rowKeys,
        colKeys,
        cells,
        rowTotals,
        colTotals,
        totalMinutes: acc.total,
      };
    });
}

export function twoAxisCellMinutes(
  week: TwoAxisWeekSummary,
  row: string,
  col: string
): number {
  return week.cells[cellKey(row, col)] ?? 0;
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
