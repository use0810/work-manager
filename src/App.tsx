import { useState, useLayoutEffect, useEffect, useRef } from 'react';
import type { WorkRecord } from './types';
import { loadRecords, saveRecords } from './utils/storage';
import { hasAcceptedGuideAndTerms } from './utils/onboardingStorage';
import { resetAllBrowserStoredAppData } from './utils/resetBrowserAppData';
import {
  applyDocumentTheme,
  APP_THEME_OPTIONS,
  getStoredTheme,
  setStoredTheme,
  type AppTheme,
} from './utils/themeStorage';
import DateTimeList from './components/DateTimeList';
import WeekTimeline from './components/WeekTimeline';
import ArchiveTab from './components/ArchiveTab';
import CsvSyncModal from './components/CsvSyncModal';
import GuideTermsWizard from './components/GuideTermsWizard';
import DataResetConfirmModal from './components/DataResetConfirmModal';
import './App.css';

type Tab = 'list' | 'timeline' | 'archive';

export default function App() {
  const [records, setRecords] = useState<WorkRecord[]>(loadRecords);
  const [archiveRefresh, setArchiveRefresh] = useState(0);
  const [guideOpen, setGuideOpen] = useState(!hasAcceptedGuideAndTerms());
  const [helpOpen, setHelpOpen] = useState(false);
  const [dataResetOpen, setDataResetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('list');
  const [theme, setTheme] = useState<AppTheme>(() => getStoredTheme());
  const settingsWrapRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    applyDocumentTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = settingsWrapRef.current;
      if (el && !el.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [settingsOpen]);

  function chooseTheme(next: AppTheme) {
    setTheme(next);
    setStoredTheme(next);
  }

  function applyRecords(next: WorkRecord[]) {
    saveRecords(next);
    setRecords(next);
  }

  function handleDataResetConfirm() {
    resetAllBrowserStoredAppData();
    setRecords([]);
    setTab('list');
    setCsvOpen(false);
    setHelpOpen(false);
    setSettingsOpen(false);
    setArchiveRefresh(n => n + 1);
    setGuideOpen(true);
    setDataResetOpen(false);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>仕事記録</h1>
        <nav className="tab-nav">
          <button
            className={`tab-btn ${tab === 'list' ? 'tab-btn--active' : ''}`}
            onClick={() => setTab('list')}
          >
            📋 日時一覧
          </button>
          <button
            className={`tab-btn ${tab === 'timeline' ? 'tab-btn--active' : ''}`}
            onClick={() => setTab('timeline')}
          >
            📊 週間タイムライン
          </button>
          <button
            className={`tab-btn ${tab === 'archive' ? 'tab-btn--active' : ''}`}
            onClick={() => setTab('archive')}
          >
            📦 アーカイブ
          </button>
        </nav>
        <div className="app-header-actions">
          <div className="app-header-settings" ref={settingsWrapRef}>
            <button
              type="button"
              className="btn-settings"
              onClick={() => setSettingsOpen(o => !o)}
              aria-expanded={settingsOpen}
              aria-haspopup="true"
              title="カラー・ヘルプ・データ初期化"
            >
              ⚙ 設定
            </button>
            {settingsOpen ? (
              <div className="app-settings-dropdown" role="region" aria-label="設定">
                <div className="app-settings-dropdown__section-title" id="settings-theme-heading">
                  カラー
                </div>
                <div className="app-settings-theme-list" role="radiogroup" aria-labelledby="settings-theme-heading">
                  {APP_THEME_OPTIONS.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={theme === id}
                      className={`app-settings-theme-option${theme === id ? ' app-settings-theme-option--active' : ''}`}
                      onClick={() => chooseTheme(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <hr className="app-settings-divider" />
                <button
                  type="button"
                  className="app-settings-action app-settings-action--danger"
                  onClick={() => {
                    setSettingsOpen(false);
                    setDataResetOpen(true);
                  }}
                >
                  データ初期化
                </button>
                <button
                  type="button"
                  className="app-settings-action"
                  onClick={() => {
                    setSettingsOpen(false);
                    setHelpOpen(true);
                  }}
                >
                  ヘルプ
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="btn-sheets-sync"
            onClick={() => setCsvOpen(true)}
            title="記録を CSV ファイルに書き出し / 取り込み"
          >
            📁 CSV 入出力
          </button>
        </div>
      </header>

      <main className="app-main">
        {tab === 'list' && (
          <DateTimeList
            records={records}
            onRecordsChange={applyRecords}
            onArchived={() => setArchiveRefresh(n => n + 1)}
          />
        )}
        {tab === 'timeline' && (
          <WeekTimeline records={records} onRecordsChange={applyRecords} />
        )}
        {tab === 'archive' && (
          <ArchiveTab
            refreshKey={archiveRefresh}
            records={records}
            onRecordsChange={applyRecords}
          />
        )}
      </main>

      <CsvSyncModal
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        records={records}
        onRecordsChange={applyRecords}
      />

      <GuideTermsWizard
        open={guideOpen}
        variant="onboarding"
        onClose={() => setGuideOpen(false)}
      />
      <GuideTermsWizard
        open={helpOpen}
        variant="help"
        onClose={() => setHelpOpen(false)}
      />

      {dataResetOpen && (
        <DataResetConfirmModal
          onCancel={() => setDataResetOpen(false)}
          onConfirm={handleDataResetConfirm}
        />
      )}
    </div>
  );
}
