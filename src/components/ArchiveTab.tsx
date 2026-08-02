import { useState, useMemo } from 'react';
import type { ArchivedMonth, WorkRecord } from '../types';
import { loadArchives, deleteArchive, restoreArchive } from '../utils/storage';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { formatRecordCategories, getRecordCategories } from '../utils/dateUtils';
import MemoModal from './MemoModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import RestoreConfirmModal from './RestoreConfirmModal';

interface Props {
  refreshKey: number;
  records: WorkRecord[];                          // 日時一覧の現在のレコード
  onRecordsChange: (r: WorkRecord[]) => void;     // 日時一覧を更新
}

function totalTime(records: WorkRecord[]) {
  const mins = records.reduce((s, r) =>
    s + Math.max(0, differenceInMinutes(parseISO(r.endAt), parseISO(r.startAt))), 0);
  return `${Math.floor(mins / 60)}時間${mins % 60}分`;
}

function archiveLabel(a: ArchivedMonth) {
  return a.version === 1 ? a.yearMonth : `${a.yearMonth} v${a.version}`;
}

export default function ArchiveTab({ refreshKey, records, onRecordsChange }: Props) {
  const [archives, setArchives] = useState<ArchivedMonth[]>(() => loadArchives());
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [memoModal, setMemoModal] = useState<WorkRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArchivedMonth | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<ArchivedMonth | null>(null);
  const [restoredBanner, setRestoredBanner] = useState<string | null>(null);

  useMemo(() => { setArchives(loadArchives()); }, [refreshKey]);

  const grouped = useMemo(() => {
    const map = new Map<string, ArchivedMonth[]>();
    archives.forEach(a => {
      if (!map.has(a.yearMonth)) map.set(a.yearMonth, []);
      map.get(a.yearMonth)!.push(a);
    });
    map.forEach(v => v.sort((a, b) => a.version - b.version));
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [archives]);

  function toggleOpen(id: string) {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // 同じ年月が日時一覧にあるか調べる
  function conflictingRecords(archive: ArchivedMonth): WorkRecord[] {
    return records.filter(r => {
      const d = parseISO(r.startAt);
      const ym = `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月`;
      return ym === archive.yearMonth;
    });
  }

  function handleRestoreClick(archive: ArchivedMonth) {
    const conflicts = conflictingRecords(archive);
    if (conflicts.length > 0) {
      setRestoreTarget(archive);
    } else {
      doRestore(archive);
    }
  }

  function doRestore(archive: ArchivedMonth) {
    const { records: newRecords, archives: newArchives } = restoreArchive(archive.id);
    onRecordsChange(newRecords);
    setArchives(newArchives);
    setRestoreTarget(null);
    showRestoredBanner(archiveLabel(archive));
  }

  function showRestoredBanner(label: string) {
    setRestoredBanner(label);
    setTimeout(() => setRestoredBanner(null), 3000);
  }

  function handleDelete(archive: ArchivedMonth) {
    const updated = deleteArchive(archive.id);
    setArchives(updated);
    setDeleteTarget(null);
  }

  function archiveToFakeRecord(a: ArchivedMonth): WorkRecord {
    return {
      id: a.id,
      startAt: a.archivedAt,
      endAt: a.archivedAt,
      category: '',
      categoryOption: '',
      categories: [],
      memo: `${archiveLabel(a)}（${a.records.length}件 / ${totalTime(a.records)}）`,
    };
  }

  if (grouped.length === 0) {
    return (
      <div className="archive-tab">
        <p className="empty-state">
          アーカイブはまだありません。<br />
          日時一覧の月別セクションから「アーカイブ」ボタンで保存できます。
        </p>
      </div>
    );
  }

  return (
    <div className="archive-tab">
      {restoredBanner && (
        <div className="archive-banner restore-banner">
          ↩️ {restoredBanner} を日時一覧に復元しました
        </div>
      )}

      {grouped.map(([yearMonth, versions]) => (
        <div key={yearMonth} className="archive-group">
          <div className="archive-group__title">{yearMonth}</div>

          {versions.map(archive => {
            const isOpen = openIds.has(archive.id);
            const label = archiveLabel(archive);
            return (
              <div key={archive.id} className={`accordion archive-accordion ${isOpen ? 'accordion--open' : ''}`}>
                <button className="accordion__header" onClick={() => toggleOpen(archive.id)}>
                  <span className="accordion__title">{label}</span>
                  <span className="accordion__meta">{archive.records.length}件　{totalTime(archive.records)}</span>
                  <span className="archive-saved-at">
                    保存: {format(parseISO(archive.archivedAt), 'yyyy/MM/dd HH:mm')}
                  </span>
                  <button
                    className="btn-restore-sm"
                    title="日時一覧に復元"
                    onClick={e => { e.stopPropagation(); handleRestoreClick(archive); }}
                  >
                    復元
                  </button>
                  <button
                    className="btn-delete"
                    title="このアーカイブを削除"
                    onClick={e => { e.stopPropagation(); setDeleteTarget(archive); }}
                  >
                    削除
                  </button>
                  <span className="accordion__chevron">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="accordion__body">
                    <table className="record-table record-table--compact">
                      <thead>
                        <tr>
                          <th className="group-start">開始</th>
                          <th className="group-end">終了</th>
                          <th>カテゴリ</th>
                          <th>メモ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {archive.records.map(rec => (
                          <tr key={rec.id}>
                            <td className="col-start col-start-last">
                              {format(parseISO(rec.startAt), 'yyyy/MM/dd HH:mm')}
                            </td>
                            <td className="col-end col-end-last">
                              {format(parseISO(rec.endAt), 'yyyy/MM/dd HH:mm')}
                            </td>
                            <td>
                              {getRecordCategories(rec).length > 0 ? (
                                <span className="category-badge">{formatRecordCategories(rec)}</span>
                              ) : (
                                <span className="memo-empty">未分類</span>
                              )}
                            </td>
                            <td
                              className="memo-cell"
                              style={{
                                cursor:
                                  rec.memo || getRecordCategories(rec).length > 0
                                    ? 'pointer'
                                    : 'default',
                              }}
                              onClick={() =>
                                (rec.memo || getRecordCategories(rec).length > 0) &&
                                setMemoModal(rec)
                              }
                              title={
                                rec.memo || getRecordCategories(rec).length > 0
                                  ? 'クリックで詳細'
                                  : ''
                              }
                            >
                              {rec.memo
                                ? <span className="memo-badge">メモ</span>
                                : <span className="memo-empty">なし</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {memoModal !== null && (
        <MemoModal
          memo={memoModal.memo}
          categories={memoModal.categories}
          category={memoModal.category}
          categoryOption={memoModal.categoryOption}
          categoryDefinitions={[]}
          onCategoryDefinitionsChange={() => {}}
          onClose={() => setMemoModal(null)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          record={archiveToFakeRecord(deleteTarget)}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {restoreTarget && (
        <RestoreConfirmModal
          archive={restoreTarget}
          conflicting={conflictingRecords(restoreTarget)}
          onConfirm={() => doRestore(restoreTarget)}
          onCancel={() => setRestoreTarget(null)}
        />
      )}
    </div>
  );
}
