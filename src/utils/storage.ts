import type { WorkRecord, ArchivedMonth } from '../types';
import { clampRecordsForSave, parseArchivesArray, parseWorkRecordsArray } from './recordValidation';

const KEY         = 'work_records';
const ARCHIVE_KEY = 'work_archives';

// ===== WorkRecord =====

export function loadRecords(): WorkRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return parseWorkRecordsArray(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveRecords(records: WorkRecord[]): void {
  localStorage.setItem(KEY, JSON.stringify(clampRecordsForSave(records)));
}

/** 日時一覧・アーカイブの保存データをブラウザから削除する */
export function clearWorkRecordsAndArchivesStorage(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(ARCHIVE_KEY);
  } catch {
    /* ignore */
  }
}

export function addRecord(record: WorkRecord): WorkRecord[] {
  const records = loadRecords();
  records.push(record);
  records.sort((a, b) => a.startAt.localeCompare(b.startAt));
  saveRecords(records);
  return records;
}

export function updateRecord(updated: WorkRecord): WorkRecord[] {
  const records = loadRecords().map(r => r.id === updated.id ? updated : r);
  records.sort((a, b) => a.startAt.localeCompare(b.startAt));
  saveRecords(records);
  return records;
}

export function deleteRecord(id: string): WorkRecord[] {
  const records = loadRecords().filter(r => r.id !== id);
  saveRecords(records);
  return records;
}

// ===== Archive =====

export function loadArchives(): ArchivedMonth[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    return parseArchivesArray(JSON.parse(raw));
  } catch {
    return [];
  }
}

function saveArchives(archives: ArchivedMonth[]): void {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(parseArchivesArray(archives)));
}

/** その年月の既存アーカイブを返す（バージョン昇順） */
export function findArchivesByMonth(yearMonth: string): ArchivedMonth[] {
  return loadArchives()
    .filter(a => a.yearMonth === yearMonth)
    .sort((a, b) => a.version - b.version);
}

/** 新規バージョンとして追加保存 */
export function archiveAsNew(yearMonth: string, records: WorkRecord[]): ArchivedMonth[] {
  const archives = loadArchives();
  const existing = archives.filter(a => a.yearMonth === yearMonth);
  const nextVersion = existing.length === 0 ? 1 : Math.max(...existing.map(a => a.version)) + 1;
  archives.push({
    id: crypto.randomUUID(),
    yearMonth,
    version: nextVersion,
    records,
    archivedAt: new Date().toISOString(),
  });
  saveArchives(archives);
  return archives;
}

/** 最新バージョンにまとめる（records を追記してソート） */
export function archiveMergeLatest(yearMonth: string, records: WorkRecord[]): ArchivedMonth[] {
  const archives = loadArchives();
  const existing = archives.filter(a => a.yearMonth === yearMonth);
  if (existing.length === 0) return archiveAsNew(yearMonth, records);

  const latest = existing.reduce((a, b) => a.version > b.version ? a : b);
  const merged = [...latest.records, ...records];
  merged.sort((a, b) => a.startAt.localeCompare(b.startAt));

  const updated = archives.map(a =>
    a.id === latest.id ? { ...a, records: merged, archivedAt: new Date().toISOString() } : a
  );
  saveArchives(updated);
  return updated;
}

export function deleteArchive(id: string): ArchivedMonth[] {
  const archives = loadArchives().filter(a => a.id !== id);
  saveArchives(archives);
  return archives;
}

/**
 * アーカイブを日時一覧に復元する。
 * - アーカイブのレコードを現在のレコードに追記・ソート
 * - アーカイブ自体は削除する
 * @returns { records, archives }
 */
export function restoreArchive(archiveId: string): { records: WorkRecord[]; archives: ArchivedMonth[] } {
  const archive = loadArchives().find(a => a.id === archiveId);
  if (!archive) return { records: loadRecords(), archives: loadArchives() };

  // 重複IDを除外して追記（まとめる場合など同一IDが入っている可能性を排除）
  const current = loadRecords();
  const existingIds = new Set(current.map(r => r.id));
  const toAdd = archive.records.filter(r => !existingIds.has(r.id));
  const merged = [...current, ...toAdd].sort((a, b) => a.startAt.localeCompare(b.startAt));
  saveRecords(merged);

  const archives = deleteArchive(archiveId);
  return { records: merged, archives };
}
