import { useEffect, useState } from 'react';

interface Props {
  memo: string;
  onClose: () => void;
  /** 編集可能にする（日時一覧など） */
  editable?: boolean;
  onSave?: (nextMemo: string) => void;
}

export default function MemoModal({ memo, onClose, editable = false, onSave }: Props) {
  const [draft, setDraft] = useState(memo);

  useEffect(() => {
    setDraft(memo);
  }, [memo]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (editable && onSave && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSave(draft);
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editable, onSave, draft]);

  function handleSave() {
    if (editable && onSave) {
      onSave(draft);
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <span>{editable ? 'メモを編集' : 'メモ詳細'}</span>
          <button type="button" className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          {editable && onSave ? (
            <>
              <textarea
                className="memo-edit-textarea memo-modal-textarea"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="メモを入力…"
                autoFocus
                rows={8}
              />
              <p className="memo-edit-hint">Ctrl+Enter で保存　/ Esc で閉じる（未保存の変更は失われます）</p>
            </>
          ) : memo ? (
            <p>{memo}</p>
          ) : (
            <p className="empty">メモなし</p>
          )}
        </div>
        {editable && onSave && (
          <div className="delete-modal__footer">
            <button type="button" className="btn-cancel" onClick={onClose}>キャンセル</button>
            <button type="button" className="btn-primary" onClick={handleSave}>保存</button>
          </div>
        )}
      </div>
    </div>
  );
}
