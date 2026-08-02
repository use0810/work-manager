export interface WorkRecord {
  id: string;
  startAt: string; // ISO8601
  endAt: string;   // ISO8601
  /** カテゴリ名（グループ。空文字可・既存互換） */
  category: string;
  /** カテゴリ内の選択肢（空文字可） */
  categoryOption: string;
  memo: string;
}

export interface ArchivedMonth {
  id: string;
  yearMonth: string; // "2026年05月"
  version: number;   // 1, 2, 3 ...
  records: WorkRecord[];
  archivedAt: string; // ISO8601
}

/** 設定で作成するカテゴリ定義（選択肢は最大 10） */
export interface CategoryDefinition {
  id: string;
  name: string;
  options: string[];
}

export const MAX_CATEGORY_OPTIONS = 10;
