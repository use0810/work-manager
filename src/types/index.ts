export interface WorkRecord {
  id: string;
  startAt: string; // ISO8601
  endAt: string;   // ISO8601
  memo: string;
}

export interface ArchivedMonth {
  id: string;
  yearMonth: string; // "2026年05月"
  version: number;   // 1, 2, 3 ...
  records: WorkRecord[];
  archivedAt: string; // ISO8601
}
