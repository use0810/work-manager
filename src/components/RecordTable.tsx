import { useState, useRef, useEffect } from 'react';
import type { WorkRecord } from '../types';
import { parseISO } from 'date-fns';
import DeleteConfirmModal from './DeleteConfirmModal';
import DateTimeStepPicker from './DateTimeStepPicker';
import {
  datetimeLocalToISO,
  formatRecordDateTime,
  isoToDatetimeLocal,
} from '../utils/datetimeLocal';
import { formatHoursMinutes, formatRecordCategories, getRecordCategories } from '../utils/dateUtils';

interface Props {
  records: WorkRecord[];
  onUpdate: (record: WorkRecord) => void;
  onDelete: (id: string) => void;
  onCopy: (record: WorkRecord) => void;
  /** メモ列クリックで編集モーダルを開く */
  onMemoOpen: (record: WorkRecord) => void;
}

type Side = 'start' | 'end';
type EditTarget = { id: string; side: Side } | null;

function durationLabel(startAt: string, endAt: string): string {
  const mins = Math.round((parseISO(endAt).getTime() - parseISO(startAt).getTime()) / 60000);
  if (!Number.isFinite(mins) || mins < 0) return '—';
  return formatHoursMinutes(mins);
}

export default function RecordTable({ records, onUpdate, onDelete, onCopy, onMemoOpen }: Props) {
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<WorkRecord | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editTarget) return;
    inputRef.current?.focus();
  }, [editTarget]);

  function commitEdit() {
    if (!editTarget) return;

    const rec = records.find(r => r.id === editTarget.id);
    if (!rec) {
      setEditTarget(null);
      return;
    }

    if (editValue) {
      const isoKey = editTarget.side === 'start' ? 'startAt' : 'endAt';
      const nextIso = datetimeLocalToISO(editValue);
      if (rec[isoKey] !== nextIso) {
        onUpdate({ ...rec, [isoKey]: nextIso });
      }
    }
    setEditTarget(null);
  }

  function startEdit(id: string, side: Side, iso: string) {
    setEditValue(isoToDatetimeLocal(iso));
    setEditTarget({ id, side });
  }

  function handleGlobalClick(e: React.MouseEvent) {
    if (!(e.target as HTMLElement).closest('.dt-step, .edit-cell')) {
      commitEdit();
    }
  }

  function renderDateCell(rec: WorkRecord, side: Side) {
    const iso = side === 'start' ? rec.startAt : rec.endAt;
    const editing = editTarget?.id === rec.id && editTarget.side === side;
    const tone = side === 'start' ? 'col-start col-start-last' : 'col-end col-end-last';

    return (
      <td className={`${tone} ${editing ? 'edit-cell' : 'editable-cell'}`}>
        {editing ? (
          <DateTimeStepPicker
            label=""
            value={editValue}
            onChange={setEditValue}
            compact
            inputRef={inputRef}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitEdit();
              }
              if (e.key === 'Escape') setEditTarget(null);
            }}
          />
        ) : (
          <button
            type="button"
            className="dt-cell-btn"
            onClick={e => {
              e.stopPropagation();
              startEdit(rec.id, side, iso);
            }}
            title="タップして日時を変更（分は30分単位）"
          >
            {formatRecordDateTime(iso)}
          </button>
        )}
      </td>
    );
  }

  return (
    <div onClick={handleGlobalClick}>
      <table className="record-table record-table--compact">
        <thead>
          <tr>
            <th className="group-start">開始</th>
            <th className="group-end">終了</th>
            <th>時間</th>
            <th>カテゴリ</th>
            <th>メモ</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {records.map(rec => (
            <tr key={rec.id}>
              {renderDateCell(rec, 'start')}
              {renderDateCell(rec, 'end')}

              <td className="duration-cell">{durationLabel(rec.startAt, rec.endAt)}</td>

              <td
                className="category-cell editable-cell"
                onClick={e => {
                  e.stopPropagation();
                  commitEdit();
                  onMemoOpen(rec);
                }}
                title="クリックでカテゴリ・メモを編集"
              >
                {getRecordCategories(rec).length > 0 ? (
                  <span className="category-badge">{formatRecordCategories(rec)}</span>
                ) : (
                  <span className="memo-empty">未分類</span>
                )}
              </td>

              <td
                className="memo-cell editable-cell"
                onClick={e => {
                  e.stopPropagation();
                  commitEdit();
                  onMemoOpen(rec);
                }}
                title="クリックでカテゴリ・メモを編集"
              >
                {rec.memo ? <span className="memo-badge">メモ</span> : <span className="memo-empty">なし</span>}
              </td>

              <td className="action-cell">
                <button
                  type="button"
                  className="btn-copy"
                  onClick={e => {
                    e.stopPropagation();
                    commitEdit();
                    onCopy(rec);
                  }}
                  title="コピーして追加フォームに読み込む"
                >
                  コピー
                </button>
                <button
                  type="button"
                  className="btn-delete"
                  onClick={e => {
                    e.stopPropagation();
                    commitEdit();
                    setDeleteTarget(rec);
                  }}
                  title="削除"
                >
                  削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {deleteTarget && (
        <DeleteConfirmModal
          record={deleteTarget}
          onConfirm={() => {
            onDelete(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
