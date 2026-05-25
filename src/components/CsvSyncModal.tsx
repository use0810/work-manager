import { useRef, useState } from 'react';
import type { WorkRecord } from '../types';
import {
  csvFilenameTimestamp,
  csvToRecords,
  downloadTextFile,
  mergeRecordsById,
  recordsToCsv,
  type CsvImportResult,
} from '../utils/csv';

interface Props {
  open: boolean;
  onClose: () => void;
  records: WorkRecord[];
  onRecordsChange: (next: WorkRecord[]) => void;
}

interface Banner {
  kind: 'success' | 'error' | 'info';
  text: string;
}

type Mode = 'menu' | 'preview-import';

export default function CsvSyncModal({ open, onClose, records, onRecordsChange }: Props) {
  const [mode, setMode] = useState<Mode>('menu');
  const [banner, setBanner] = useState<Banner | null>(null);
  const [imported, setImported] = useState<CsvImportResult | null>(null);
  const [importedFileName, setImportedFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  function close() {
    setBanner(null);
    setImported(null);
    setImportedFileName('');
    setMode('menu');
    onClose();
  }

  function handleExport() {
    if (records.length === 0) {
      setBanner({ kind: 'info', text: '書き出す記録がまだありません。' });
      return;
    }
    const csv = recordsToCsv(records);
    const name = `worklog-${csvFilenameTimestamp()}.csv`;
    downloadTextFile(name, csv);
    setBanner({ kind: 'success', text: `${records.length} 件を ${name} に書き出しました。` });
  }

  function openFilePicker() {
    setBanner(null);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const result = csvToRecords(text);
      if (result.totalRows === 0) {
        setBanner({ kind: 'error', text: 'CSV に有効なデータ行がありませんでした。' });
        return;
      }
      if (result.records.length === 0) {
        setBanner({
          kind: 'error',
          text: `${result.totalRows} 行ありましたが、形式が合わずすべて読み取れませんでした。ヘッダ「id,startAt,endAt,memo」を確認してください。`,
        });
        return;
      }
      setImported(result);
      setImportedFileName(file.name);
      setMode('preview-import');
    } catch {
      setBanner({ kind: 'error', text: 'ファイルの読み込みに失敗しました。' });
    }
  }

  function applyMerge() {
    if (!imported) return;
    const next = mergeRecordsById(records, imported.records);
    onRecordsChange(next);
    setBanner({
      kind: 'success',
      text: `${imported.records.length} 件を取り込みました（同じ id は上書き）。合計 ${next.length} 件。`,
    });
    setImported(null);
    setImportedFileName('');
    setMode('menu');
  }

  function applyReplace() {
    if (!imported) return;
    onRecordsChange(imported.records);
    setBanner({
      kind: 'success',
      text: `日時一覧を CSV の ${imported.records.length} 件で置き換えました。`,
    });
    setImported(null);
    setImportedFileName('');
    setMode('menu');
  }

  function cancelImportPreview() {
    setImported(null);
    setImportedFileName('');
    setMode('menu');
  }

  return (
    <div
      className="modal-backdrop"
      onClick={e => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="CSV 入出力">
        <div className="modal__header">
          <span>📁 CSV 入出力</span>
          <button type="button" className="modal__close" onClick={close} aria-label="閉じる">×</button>
        </div>
        <div className="modal__body">
          {banner && (
            <div className={`csv-banner csv-banner--${banner.kind}`}>{banner.text}</div>
          )}

          {mode === 'menu' && (
            <>
              <p className="csv-lead">
                日時一覧の記録を <strong>CSV ファイル</strong> として保存・取り込みできます。
                ファイルは UTF-8（BOM 付き）で、Excel などの表計算ソフトやテキストエディタで開けます。
              </p>

              <section className="csv-section">
                <h3 className="csv-section-title">書き出し（エクスポート）</h3>
                <p className="csv-section-desc">
                  現在の日時一覧（{records.length} 件）を CSV ファイルとしてダウンロードします。
                </p>
                <button type="button" className="btn-primary csv-action-btn" onClick={handleExport}>
                  CSV を書き出す
                </button>
              </section>

              <hr className="csv-divider" />

              <section className="csv-section">
                <h3 className="csv-section-title">取り込み（インポート）</h3>
                <p className="csv-section-desc">
                  以前書き出した CSV、または同じ列構成（id, startAt, endAt, memo）の CSV を読み込めます。
                </p>
                <button type="button" className="btn-nav csv-action-btn" onClick={openFilePicker}>
                  CSV ファイルを選択…
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: 'none' }}
                  onChange={handleFileSelected}
                />
              </section>
            </>
          )}

          {mode === 'preview-import' && imported && (
            <>
              <p className="csv-lead">
                <strong>{importedFileName}</strong> を読み取りました。
              </p>
              <ul className="csv-preview-list">
                <li>有効な記録: <strong>{imported.records.length}</strong> 件</li>
                <li>CSV 内の行数: {imported.totalRows} 行</li>
                {imported.skipped > 0 && (
                  <li className="csv-preview-skipped">
                    形式不正でスキップ: {imported.skipped} 件
                  </li>
                )}
              </ul>

              <p className="csv-section-desc">
                取り込み方法を選んでください。
              </p>
              <div className="csv-import-actions">
                <button type="button" className="btn-primary" onClick={applyMerge}>
                  追加してマージ
                </button>
                <button type="button" className="btn-danger" onClick={applyReplace}>
                  既存をすべて置き換え
                </button>
                <button type="button" className="btn-cancel" onClick={cancelImportPreview}>
                  キャンセル
                </button>
              </div>
              <p className="csv-section-hint">
                「追加してマージ」は同じ id があれば CSV の内容で上書き、新しい id は追加します。
                「置き換え」は現在の日時一覧をすべて破棄して CSV の内容にします（取り消せません）。
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
