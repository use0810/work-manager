import type { WorkRecord } from '../types';
import { parseWorkRecordsArray } from './recordValidation';

/**
 * 日時記録の CSV 入出力。
 * - Excel で開けるよう UTF-8 BOM を付与
 * - RFC 4180 風: カンマ・改行・ダブルクオートを含むセルは "..." で囲み、" は "" にエスケープ
 */

const CSV_HEADERS = ['id', 'startAt', 'endAt', 'memo'] as const;
const UTF8_BOM = '\uFEFF';

function escapeCell(value: string): string {
  if (value === '') return '';
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** WorkRecord[] → CSV テキスト（BOM 付き） */
export function recordsToCsv(records: WorkRecord[]): string {
  const lines: string[] = [];
  lines.push(CSV_HEADERS.join(','));
  for (const r of records) {
    lines.push(
      [r.id, r.startAt, r.endAt, r.memo].map(v => escapeCell(String(v ?? ''))).join(',')
    );
  }
  return UTF8_BOM + lines.join('\r\n') + '\r\n';
}

/** CSV テキストを 1 行ずつパース（ダブルクオートと改行内クオートに対応） */
function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      if (src[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export interface CsvImportResult {
  /** 正規化・上限内に収めた WorkRecord 配列 */
  records: WorkRecord[];
  /** ヘッダー以外で読み取った行数 */
  totalRows: number;
  /** 無効でスキップした行数 */
  skipped: number;
}

/**
 * CSV テキストを WorkRecord[] に変換。
 * 列は id,startAt,endAt,memo を想定。順番違いはヘッダから判定する。
 */
export function csvToRecords(text: string): CsvImportResult {
  const rows = parseCsv(text).filter(r => r.length > 0 && r.some(c => c !== ''));
  if (rows.length === 0) {
    return { records: [], totalRows: 0, skipped: 0 };
  }

  const headerCells = rows[0].map(c => c.trim().toLowerCase());
  const expected = CSV_HEADERS.map(h => h.toLowerCase());
  const hasHeader = expected.every(h => headerCells.includes(h));

  let idIdx = 0;
  let startIdx = 1;
  let endIdx = 2;
  let memoIdx = 3;
  let dataRows: string[][];

  if (hasHeader) {
    idIdx = headerCells.indexOf('id');
    startIdx = headerCells.indexOf('startat');
    endIdx = headerCells.indexOf('endat');
    memoIdx = headerCells.indexOf('memo');
    dataRows = rows.slice(1);
  } else {
    dataRows = rows;
  }

  const raw = dataRows.map(cells => ({
    id: cells[idIdx] ?? '',
    startAt: cells[startIdx] ?? '',
    endAt: cells[endIdx] ?? '',
    memo: cells[memoIdx] ?? '',
  }));
  const records = parseWorkRecordsArray(raw);
  return {
    records,
    totalRows: dataRows.length,
    skipped: Math.max(0, dataRows.length - records.length),
  };
}

/** ファイル名用のタイムスタンプ（YYYYMMDD-HHmmss） */
export function csvFilenameTimestamp(date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    '-' +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

/** ブラウザでテキストをファイルとしてダウンロード */
export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * 既存レコードと取り込みレコードを id でマージ（同一 id は取り込み側で上書き）。
 * startAt 昇順でソート済みの配列を返す。
 */
export function mergeRecordsById(existing: WorkRecord[], incoming: WorkRecord[]): WorkRecord[] {
  const byId = new Map<string, WorkRecord>();
  for (const r of existing) byId.set(r.id, r);
  for (const r of incoming) byId.set(r.id, r);
  return Array.from(byId.values()).sort((a, b) => a.startAt.localeCompare(b.startAt));
}
