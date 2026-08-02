import { useEffect, useState } from 'react';
import type { CategoryDefinition } from '../types';
import CategoryPicker from './CategoryPicker';
import { formatCategoryLabel } from '../utils/dateUtils';

interface Props {
  memo: string;
  category?: string;
  categoryOption?: string;
  categoryDefinitions: CategoryDefinition[];
  onCategoryDefinitionsChange: (next: CategoryDefinition[]) => void;
  onClose: () => void;
  editable?: boolean;
  onSave?: (next: { memo: string; category: string; categoryOption: string }) => void;
}

export default function MemoModal({
  memo,
  category = '',
  categoryOption = '',
  categoryDefinitions,
  onCategoryDefinitionsChange,
  onClose,
  editable = false,
  onSave,
}: Props) {
  const [draftMemo, setDraftMemo] = useState(memo);
  const [draftCategory, setDraftCategory] = useState(category);
  const [draftOption, setDraftOption] = useState(categoryOption);

  useEffect(() => {
    setDraftMemo(memo);
    setDraftCategory(category);
    setDraftOption(categoryOption);
  }, [memo, category, categoryOption]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (editable && onSave && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSave({
          memo: draftMemo,
          category: draftCategory.trim(),
          categoryOption: draftOption.trim(),
        });
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editable, onSave, draftMemo, draftCategory, draftOption]);

  function handleSave() {
    if (editable && onSave) {
      onSave({
        memo: draftMemo,
        category: draftCategory.trim(),
        categoryOption: draftOption.trim(),
      });
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <span>{editable ? 'メモ・カテゴリを編集' : 'メモ詳細'}</span>
          <button type="button" className="modal__close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal__body">
          {editable && onSave ? (
            <>
              <CategoryPicker
                category={draftCategory}
                categoryOption={draftOption}
                definitions={categoryDefinitions}
                onDefinitionsChange={onCategoryDefinitionsChange}
                onChange={({ category: c, categoryOption: o }) => {
                  setDraftCategory(c);
                  setDraftOption(o);
                }}
                idPrefix="memo-modal"
                compact
              />
              <label className="memo-modal-field">
                <span>メモ</span>
                <textarea
                  className="memo-edit-textarea memo-modal-textarea"
                  value={draftMemo}
                  onChange={e => setDraftMemo(e.target.value)}
                  placeholder="メモを入力…"
                  autoFocus
                  rows={8}
                />
              </label>
              <p className="memo-edit-hint">Ctrl+Enter で保存　/ Esc で閉じる（未保存の変更は失われます）</p>
            </>
          ) : (
            <>
              <p className="memo-modal-readonly-category">
                <span className="memo-modal-readonly-label">カテゴリ</span>
                {formatCategoryLabel(category, categoryOption)}
              </p>
              {memo ? <p>{memo}</p> : <p className="empty">メモなし</p>}
            </>
          )}
        </div>
        {editable && onSave && (
          <div className="delete-modal__footer">
            <button type="button" className="btn-cancel" onClick={onClose}>
              キャンセル
            </button>
            <button type="button" className="btn-primary" onClick={handleSave}>
              保存
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
