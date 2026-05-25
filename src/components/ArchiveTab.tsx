import { useState, useMemo } from 'react';
import type { ArchivedMonth, WorkRecord } from '../types';
import { loadArchives, deleteArchive, restoreArchive } from '../utils/storage';
import { format, parseISO, differenceInMinutes } from 'date-fns';
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
  const [memoModal, setMemoModal] = useState<string | null>(null);
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
                    ↩️ 復元
                  </button>
                  <button
                    className="btn-delete"
                    title="このアーカイブを削除"
                    onClick={e => { e.stopPropagation(); setDeleteTarget(archive); }}
                  >✕</button>
                  <span className="accordion__chevron">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="accordion__body">
                    <table className="record-table">
                      <thead>
                        <tr>
                          <th colSpan={5} className="group-start">開始</th>
                          <th colSpan={5} className="group-end">終了</th>
                          <th>メモ</th>
                        </tr>
                        <tr className="record-table__sub-header">
                          {['年','月','日','時','分'].map((l, i) => (
                            <th key={'s'+l} className={`col-start${i === 0 ? ' col-year' : ''}`}>{l}</th>
                          ))}
                          {['年','月','日','時','分'].map((l, i) => (
                            <th
                              key={'e'+l}
                              className={`${i === 4 ? 'col-end col-end-last' : 'col-end'}${i === 0 ? ' col-year' : ''}`}
                            >
                              {l}
                            </th>
                          ))}
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {archive.records.map(rec => (
                          <tr key={rec.id}>
                            {(['yyyy','MM','dd','HH','mm'] as const).map((fmt, i) => (
                              <td
                                key={'s'+fmt}
                                className={`${i === 4 ? 'col-start col-start-last' : 'col-start'}${i === 0 ? ' col-year' : ''}`}
                              >
                                {format(parseISO(rec.startAt), fmt)}
                              </td>
                            ))}
                            {(['yyyy','MM','dd','HH','mm'] as const).map((fmt, i) => (
                              <td
                                key={'e'+fmt}
                                className={`${i === 4 ? 'col-end col-end-last' : 'col-end'}${i === 0 ? ' col-year' : ''}`}
                              >
                                {format(parseISO(rec.endAt), fmt)}
                              </td>
                            ))}
                            <td
                              className="memo-cell"
                              style={{ cursor: rec.memo ? 'pointer' : 'default' }}
                              onClick={() => rec.memo && setMemoModal(rec.memo)}
                              title={rec.memo ? 'クリックで詳細' : ''}
                            >
                              {rec.memo
                                ? <span className="memo-badge">📝</span>
                                : <span className="memo-empty">—</span>}
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
        <MemoModal memo={memoModal} onClose={() => setMemoModal(null)} />
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
