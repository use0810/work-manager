import { useState, useMemo, useRef } from 'react';
import type { WorkRecord } from '../types';
import { groupByYearMonth, totalWorkMinutes, formatHoursMinutes } from '../utils/dateUtils';
import {
  addRecord, updateRecord, deleteRecord, saveRecords,
  findArchivesByMonth, archiveAsNew, archiveMergeLatest,
} from '../utils/storage';
import AddRecordForm, { type AddRecordFormHandle } from './AddRecordForm';
import RecordTable from './RecordTable';
import MemoModal from './MemoModal';
import ArchiveConflictModal from './ArchiveConflictModal';

const PAGE_SIZE = 6;

interface Props {
  records: WorkRecord[];
  onRecordsChange: (records: WorkRecord[]) => void;
  onArchived: () => void;
}

interface ArchivePending {
  yearMonth: string;
  records: WorkRecord[];
}

export default function DateTimeList({ records, onRecordsChange, onArchived }: Props) {
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const [memoModalRecord, setMemoModalRecord] = useState<WorkRecord | null>(null);
  const [pages, setPages] = useState<Record<string, number>>({});
  const [archivePending, setArchivePending] = useState<ArchivePending | null>(null);
  const [archivedBanner, setArchivedBanner] = useState<string | null>(null);
  const formRef = useRef<AddRecordFormHandle>(null);

  const grouped = useMemo(() => groupByYearMonth(records), [records]);

  function toggleMonth(key: string) {
    setOpenMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function handleAdd(record: WorkRecord) {
    onRecordsChange(addRecord(record));
    const d = new Date(record.startAt);
    const key = `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月`;
    setOpenMonths(prev => new Set([...prev, key]));
  }

  function handleUpdate(record: WorkRecord) {
    onRecordsChange(updateRecord(record));
  }

  function handleDelete(id: string) {
    onRecordsChange(deleteRecord(id));
  }

  function handleCopy(record: WorkRecord) {
    formRef.current?.loadFrom(record);
  }

  // アーカイブボタンを押したとき
  function handleArchiveClick(yearMonth: string, monthRecords: WorkRecord[]) {
    const existing = findArchivesByMonth(yearMonth);
    if (existing.length > 0) {
      setArchivePending({ yearMonth, records: monthRecords });
    } else {
      doArchive(yearMonth, monthRecords, 'new');
    }
  }

  function doArchive(yearMonth: string, monthRecords: WorkRecord[], mode: 'new' | 'merge') {
    if (mode === 'new') {
      archiveAsNew(yearMonth, monthRecords);
    } else {
      archiveMergeLatest(yearMonth, monthRecords);
    }
    // アーカイブした月のレコードを日時一覧から削除
    const ids = new Set(monthRecords.map(r => r.id));
    const remaining = records.filter(r => !ids.has(r.id));
    saveRecords(remaining);
    onRecordsChange(remaining);

    setArchivePending(null);
    showBanner(yearMonth);
    onArchived();
  }

  function showBanner(yearMonth: string) {
    setArchivedBanner(yearMonth);
    setTimeout(() => setArchivedBanner(null), 3000);
  }

  return (
    <div className="datetime-list">
      <AddRecordForm ref={formRef} onAdd={handleAdd} />

      {archivedBanner && (
        <div className="archive-banner">
          📦 {archivedBanner} をアーカイブしました
        </div>
      )}

      <div className="accordion-list">
        {grouped.length === 0 && (
          <p className="empty-state">記録がありません。上のフォームから追加してください。</p>
        )}
        {grouped.map(([month, recs]) => {
          const isOpen = openMonths.has(month);
          const page = pages[month] ?? 0;
          const totalPages = Math.ceil(recs.length / PAGE_SIZE);
          const pageRecs = recs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

          return (
            <div key={month} className={`accordion ${isOpen ? 'accordion--open' : ''}`}>
              <button className="accordion__header" onClick={() => toggleMonth(month)}>
                <div className="accordion__title-row">
                  <span className="accordion__title">{month}</span>
                  <span className="accordion__month-total">
                    当月合計 {formatHoursMinutes(totalWorkMinutes(recs))}
                  </span>
                </div>
                <span className="accordion__meta">{recs.length}件</span>
                <button
                  className="btn-archive"
                  title={`${month}をまとめてアーカイブ`}
                  onClick={e => { e.stopPropagation(); handleArchiveClick(month, recs); }}
                >
                  📦 アーカイブ
                </button>
                <span className="accordion__chevron">{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div className="accordion__body">
                  <RecordTable
                    records={pageRecs}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    onCopy={handleCopy}
                    onMemoOpen={setMemoModalRecord}
                  />

                  {totalPages > 1 && (
                    <div className="pagination">
                      <button
                        className="pagination__btn"
                        disabled={page === 0}
                        onClick={() => setPages(p => ({ ...p, [month]: page - 1 }))}
                      >‹ 前</button>
                      <span className="pagination__info">{page + 1} / {totalPages}</span>
                      <button
                        className="pagination__btn"
                        disabled={page >= totalPages - 1}
                        onClick={() => setPages(p => ({ ...p, [month]: page + 1 }))}
                      >次 ›</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {memoModalRecord !== null && (
        <MemoModal
          memo={memoModalRecord.memo}
          editable
          onSave={nextMemo => {
            handleUpdate({ ...memoModalRecord, memo: nextMemo });
          }}
          onClose={() => setMemoModalRecord(null)}
        />
      )}

      {archivePending && (
        <ArchiveConflictModal
          yearMonth={archivePending.yearMonth}
          existing={findArchivesByMonth(archivePending.yearMonth)}
          onSeparate={() => doArchive(archivePending.yearMonth, archivePending.records, 'new')}
          onMerge={() => doArchive(archivePending.yearMonth, archivePending.records, 'merge')}
          onCancel={() => setArchivePending(null)}
        />
      )}
    </div>
  );
}
