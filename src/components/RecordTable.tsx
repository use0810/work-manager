import { useState, useRef, useEffect, useCallback } from 'react';
import type { WorkRecord } from '../types';
import { format, parseISO } from 'date-fns';
import DeleteConfirmModal from './DeleteConfirmModal';

interface Props {
  records: WorkRecord[];
  onUpdate: (record: WorkRecord) => void;
  onDelete: (id: string) => void;
  onCopy: (record: WorkRecord) => void;
  /** メモ列クリックで編集モーダルを開く */
  onMemoOpen: (record: WorkRecord) => void;
}

type DateField = 'year' | 'month' | 'day' | 'hour' | 'minute';
type Side = 'start' | 'end';
type EditTarget = { id: string; side: Side; field: DateField } | null;

interface FieldMeta {
  field: DateField;
  fmt: string;
  min: number;
  max: number;
  label: string;
}

const FIELDS: FieldMeta[] = [
  { field: 'year',   fmt: 'yyyy', min: 2000, max: 2099, label: '年' },
  { field: 'month',  fmt: 'MM',   min: 1,    max: 12,   label: '月' },
  { field: 'day',    fmt: 'dd',   min: 1,    max: 31,   label: '日' },
  { field: 'hour',   fmt: 'HH',   min: 0,    max: 23,   label: '時' },
  { field: 'minute', fmt: 'mm',   min: 0,    max: 59,   label: '分' },
];

function sideClass(side: Side, idx: number) {
  const isLast = idx === FIELDS.length - 1;
  if (side === 'start') return isLast ? 'col-start col-start-last' : 'col-start';
  return isLast ? 'col-end col-end-last' : 'col-end';
}

function cellClass(side: Side, idx: number, field: DateField): string {
  const base = sideClass(side, idx);
  return field === 'year' ? `${base} col-year` : base;
}

function applyField(iso: string, field: DateField, value: number): string {
  const d = new Date(iso);
  switch (field) {
    case 'year':   d.setFullYear(value); break;
    case 'month':  d.setMonth(value - 1); break;
    case 'day':    d.setDate(value); break;
    case 'hour':   d.setHours(value); break;
    case 'minute': d.setMinutes(value); break;
  }
  return d.toISOString();
}

export default function RecordTable({ records, onUpdate, onDelete, onCopy, onMemoOpen }: Props) {
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<WorkRecord | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commitEdit = useCallback(() => {
    if (!editTarget) return;
    const rec = records.find(r => r.id === editTarget.id);
    if (!rec) { setEditTarget(null); return; }

    const isoKey = editTarget.side === 'start' ? 'startAt' : 'endAt';
    const num = parseInt(editValue, 10);
    if (!isNaN(num)) {
      onUpdate({ ...rec, [isoKey]: applyField(rec[isoKey], editTarget.field, num) });
    }
    setEditTarget(null);
  }, [editTarget, editValue, records, onUpdate]);

  useEffect(() => {
    if (editTarget) inputRef.current?.focus();
  }, [editTarget]);

  function startFieldEdit(id: string, side: Side, field: DateField, iso: string) {
    const d = parseISO(iso);
    const meta = FIELDS.find(f => f.field === field)!;
    setEditValue(format(d, meta.fmt));
    setEditTarget({ id, side, field });
  }

  function handleGlobalClick(e: React.MouseEvent) {
    if (!(e.target as HTMLElement).closest('.edit-input')) commitEdit();
  }

  return (
    <div onClick={handleGlobalClick}>
      <table className="record-table">
        <thead>
          <tr>
            <th colSpan={5} className="group-start">開始</th>
            <th colSpan={5} className="group-end">終了</th>
            <th>メモ</th>
            <th></th>
          </tr>
          <tr className="record-table__sub-header">
            {FIELDS.map((f, i) => (
              <th key={'s-' + f.field} className={cellClass('start', i, f.field)}>{f.label}</th>
            ))}
            {FIELDS.map((f, i) => (
              <th key={'e-' + f.field} className={cellClass('end', i, f.field)}>{f.label}</th>
            ))}
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {records.map(rec => (
            <tr key={rec.id}>
              {(['start', 'end'] as const).map(side => {
                const iso = side === 'start' ? rec.startAt : rec.endAt;
                return FIELDS.map(({ field, fmt, min, max }, i) => {
                  const isEditing =
                    editTarget?.id === rec.id &&
                    editTarget.side === side &&
                    editTarget.field === field;
                  const cls = cellClass(side, i, field);

                  return isEditing ? (
                    <td key={side + field} className={`edit-cell ${cls}`}>
                      <input
                        ref={inputRef}
                        className="edit-input edit-input--number"
                        type="number"
                        min={min}
                        max={max}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitEdit();
                          if (e.key === 'Escape') setEditTarget(null);
                        }}
                        onClick={e => e.stopPropagation()}
                      />
                    </td>
                  ) : (
                    <td
                      key={side + field}
                      className={`editable-cell ${cls}`}
                      onDoubleClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        startFieldEdit(rec.id, side, field, iso);
                      }}
                      title="ダブルクリックで編集"
                    >
                      {format(parseISO(iso), fmt)}
                    </td>
                  );
                });
              })}

              <td
                className="memo-cell editable-cell"
                onClick={e => {
                  e.stopPropagation();
                  commitEdit();
                  onMemoOpen(rec);
                }}
                title="クリックでメモを編集"
              >
                {rec.memo ? <span className="memo-badge">📝</span> : <span className="memo-empty">—</span>}
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
                >⎘</button>
                <button
                  type="button"
                  className="btn-delete"
                  onClick={e => {
                    e.stopPropagation();
                    commitEdit();
                    setDeleteTarget(rec);
                  }}
                  title="削除"
                >✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {deleteTarget && (
        <DeleteConfirmModal
          record={deleteTarget}
          onConfirm={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
