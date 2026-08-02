import { useEffect, useState } from 'react';
import type { CategoryAssignment, CategoryDefinition } from '../types';
import CategoryPicker from './CategoryPicker';
import { formatRecordCategories, getRecordCategories } from '../utils/dateUtils';

interface Props {
  memo: string;
  /** 編集時の初期カテゴリ（legacy 単体も可） */
  category?: string;
  categoryOption?: string;
  categories?: CategoryAssignment[];
  categoryDefinitions: CategoryDefinition[];
  onCategoryDefinitionsChange: (next: CategoryDefinition[]) => void;
  onClose: () => void;
  editable?: boolean;
  onSave?: (next: { memo: string; categories: CategoryAssignment[] }) => void;
}

export default function MemoModal({
  memo,
  category = '',
  categoryOption = '',
  categories,
  categoryDefinitions,
  onCategoryDefinitionsChange,
  onClose,
  editable = false,
  onSave,
}: Props) {
  const initialCats =
    categories ??
    getRecordCategories({
      id: '',
      startAt: new Date().toISOString(),
      endAt: new Date().toISOString(),
      category,
      categoryOption,
      categories: categories ?? [],
      memo: '',
    });

  const [draftMemo, setDraftMemo] = useState(memo);
  const [draftCategories, setDraftCategories] = useState<CategoryAssignment[]>(initialCats);

  useEffect(() => {
    setDraftMemo(memo);
    setDraftCategories(
      categories ??
        getRecordCategories({
          id: '',
          startAt: new Date().toISOString(),
          endAt: new Date().toISOString(),
          category,
          categoryOption,
          categories: [],
          memo: '',
        })
    );
  }, [memo, category, categoryOption, categories]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (editable && onSave && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onSave({ memo: draftMemo, categories: draftCategories });
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editable, onSave, draftMemo, draftCategories]);

  function handleSave() {
    if (editable && onSave) {
      onSave({ memo: draftMemo, categories: draftCategories });
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
                value={draftCategories}
                definitions={categoryDefinitions}
                onDefinitionsChange={onCategoryDefinitionsChange}
                onChange={setDraftCategories}
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
                {formatRecordCategories({
                  id: '',
                  startAt: '',
                  endAt: '',
                  category,
                  categoryOption,
                  categories: categories ?? [],
                  memo: '',
                })}
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
