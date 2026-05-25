import type { ArchivedMonth, WorkRecord } from '../types';

/** メモ・シートセルの上限（DoS / localStorage 肥大化の緩和） */
export const MAX_MEMO_CHARS = 8_000;
/** 1 レコードあたりの id 上限 */
export const MAX_ID_CHARS = 128;
/** ブラウザ保存・シート取り込みの最大件数 */
export const MAX_WORK_RECORDS = 25_000;
/** アーカイブの最大件数 */
export const MAX_ARCHIVES = 500;
/** ISO 風日時文字列の最大長 */
const MAX_ISO_LEN = 80;

const ISO_MS_MIN = Date.UTC(1970, 0, 1);
const ISO_MS_MAX = Date.UTC(2100, 0, 1);

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function hasAsciiControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return true;
  }
  return false;
}

/** 制御文字を含まない短い id（シート由来の文字列も許容しつつ異常値を弾く） */
function isSafeId(s: string): boolean {
  const t = s.trim();
  if (t.length === 0 || t.length > MAX_ID_CHARS) return false;
  return !hasAsciiControlChars(t);
}

function isReasonableIsoDateString(s: string): boolean {
  if (typeof s !== 'string' || s.length > MAX_ISO_LEN) return false;
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) return false;
  return ms >= ISO_MS_MIN && ms <= ISO_MS_MAX;
}

export function truncateMemo(memo: string): string {
  if (memo.length <= MAX_MEMO_CHARS) return memo;
  return memo.slice(0, MAX_MEMO_CHARS);
}

/** 1 件を検証。不正なら null（破棄）。memo は長すぎる場合のみ切り詰め */
export function parseWorkRecord(raw: unknown): WorkRecord | null {
  if (raw === null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = o.id;
  const startAt = o.startAt;
  const endAt = o.endAt;
  if (!isNonEmptyString(id) || !isSafeId(id)) return null;
  if (!isNonEmptyString(startAt) || !isReasonableIsoDateString(startAt)) return null;
  if (!isNonEmptyString(endAt) || !isReasonableIsoDateString(endAt)) return null;
  const memoRaw = o.memo;
  const memo =
    typeof memoRaw === 'string' ? truncateMemo(memoRaw) : memoRaw == null ? '' : truncateMemo(String(memoRaw));
  return { id: id.trim(), startAt: startAt.trim(), endAt: endAt.trim(), memo };
}

/** localStorage / シート取り込みなど、配列全体を検証して正規化 */
export function parseWorkRecordsArray(raw: unknown): WorkRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkRecord[] = [];
  for (const item of raw) {
    if (out.length >= MAX_WORK_RECORDS) break;
    const rec = parseWorkRecord(item);
    if (rec) out.push(rec);
  }
  out.sort((a, b) => a.startAt.localeCompare(b.startAt));
  return out;
}

function parseArchivedMonth(raw: unknown): ArchivedMonth | null {
  if (raw === null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!isNonEmptyString(o.id) || !isSafeId(o.id)) return null;
  if (!isNonEmptyString(o.yearMonth) || o.yearMonth.length > 64) return null;
  const version = o.version;
  if (typeof version !== 'number' || !Number.isFinite(version) || version < 1 || version > 1_000_000) return null;
  if (!isNonEmptyString(o.archivedAt) || !isReasonableIsoDateString(o.archivedAt)) return null;
  const records = parseWorkRecordsArray(o.records);
  return {
    id: o.id.trim(),
    yearMonth: o.yearMonth.trim(),
    version: Math.floor(version),
    records,
    archivedAt: o.archivedAt.trim(),
  };
}

export function parseArchivesArray(raw: unknown): ArchivedMonth[] {
  if (!Array.isArray(raw)) return [];
  const out: ArchivedMonth[] = [];
  for (const item of raw) {
    if (out.length >= MAX_ARCHIVES) break;
    const a = parseArchivedMonth(item);
    if (a) out.push(a);
  }
  return out;
}

/** アプリ内で保存直前に呼び、件数・メモ長を常に枠内に収める */
export function clampRecordsForSave(records: WorkRecord[]): WorkRecord[] {
  const seen = new Set<string>();
  const out: WorkRecord[] = [];
  for (const r of records) {
    if (out.length >= MAX_WORK_RECORDS) break;
    const rec = parseWorkRecord(r);
    if (!rec) continue;
    if (seen.has(rec.id)) continue;
    seen.add(rec.id);
    out.push(rec);
  }
  out.sort((a, b) => a.startAt.localeCompare(b.startAt));
  return out;
}
