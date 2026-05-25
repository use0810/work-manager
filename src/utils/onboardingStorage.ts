/** 初回ガイド＋利用同意完了フラグ（文言を変えて再表示したいときはキーを version アップ） */
const LS_KEY = 'work_app_guide_terms_accepted_v1';

export function hasAcceptedGuideAndTerms(): boolean {
  try {
    return localStorage.getItem(LS_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAcceptedGuideAndTerms(): void {
  try {
    localStorage.setItem(LS_KEY, '1');
  } catch {
    /* プライベートモード等 */
  }
}

/** 初回ガイドの同意フラグを消す（次回起動でガイドを再表示） */
export function clearAcceptedGuideAndTerms(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}
