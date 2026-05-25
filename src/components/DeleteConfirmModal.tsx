import { useEffect } from 'react';
import type { WorkRecord } from '../types';
import { format, parseISO } from 'date-fns';

interface Props {
  record: WorkRecord;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({ record, onConfirm, onCancel }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onConfirm, onCancel]);

  const start = format(parseISO(record.startAt), 'yyyy年MM月dd日 HH:mm');
  const end   = format(parseISO(record.endAt),   'yyyy年MM月dd日 HH:mm');

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal delete-modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header delete-modal__header">
          <span>🗑️ この記録を削除しますか？</span>
        </div>
        <div className="modal__body delete-modal__body">
          <div className="delete-modal__info">
            <div className="delete-modal__row">
              <span className="delete-modal__label">開始</span>
              <span className="delete-modal__value">{start}</span>
            </div>
            <div className="delete-modal__row">
              <span className="delete-modal__label">終了</span>
              <span className="delete-modal__value">{end}</span>
            </div>
            {record.memo && (
              <div className="delete-modal__row">
                <span className="delete-modal__label">メモ</span>
                <span className="delete-modal__value delete-modal__memo">{record.memo}</span>
              </div>
            )}
          </div>
          <p className="delete-modal__warn">この操作は元に戻せません。</p>
        </div>
        <div className="delete-modal__footer">
          <button className="btn-cancel" onClick={onCancel}>キャンセル</button>
          <button className="btn-danger" onClick={onConfirm}>削除する</button>
        </div>
      </div>
    </div>
  );
}
