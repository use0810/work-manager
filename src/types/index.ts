export interface CategoryAssignment {
  /** カテゴリ名（例: プロジェクト） */
  name: string;
  /** 選択肢（例: A案件）。空可 */
  option: string;
}

export interface WorkRecord {
  id: string;
  startAt: string; // ISO8601
  endAt: string;   // ISO8601
  /**
   * 後方互換用。categories[0] と同期して保存する。
   * 新規コードは categories を参照すること。
   */
  category: string;
  categoryOption: string;
  /** 複数カテゴリの選択（プロジェクト＋業務内容など） */
  categories: CategoryAssignment[];
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
export const MAX_CATEGORY_ASSIGNMENTS = 50;
