const LS_THEME = 'worklog_color_theme';

export type AppTheme = 'dark' | 'light' | 'cream' | 'babyblue' | 'palepink';

export const APP_THEME_OPTIONS: { id: AppTheme; label: string }[] = [
  { id: 'dark', label: 'ダークモード' },
  { id: 'light', label: 'ライトモード' },
  { id: 'cream', label: 'クリーム' },
  { id: 'babyblue', label: 'ベビーブルー' },
  { id: 'palepink', label: 'ペールピンク' },
];

export function getStoredTheme(): AppTheme {
  try {
    const v = localStorage.getItem(LS_THEME)?.trim();
    if (v === 'light' || v === 'cream' || v === 'babyblue' || v === 'palepink' || v === 'dark') {
      return v;
    }
  } catch {
    /* ignore */
  }
  return 'dark';
}

export function setStoredTheme(theme: AppTheme): void {
  try {
    localStorage.setItem(LS_THEME, theme);
  } catch {
    /* ignore */
  }
}

/** `<html data-theme="…">`。ダークは属性なしで :root の既定を使う */
export function applyDocumentTheme(theme: AppTheme): void {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}
