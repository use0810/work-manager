import { useState } from 'react';
import type { CategoryDefinition } from '../types';
import { MAX_CATEGORY_OPTIONS } from '../types';
import {
  deleteCategoryDefinition,
  saveCategoryDefinitions,
  upsertCategoryDefinition,
} from '../utils/categoryDefsStorage';

interface Props {
  definitions: CategoryDefinition[];
  onChange: (next: CategoryDefinition[]) => void;
  onClose: () => void;
}

export default function CategoryManagerModal({ definitions, onChange, onClose }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [options, setOptions] = useState<string[]>(['']);
  const [error, setError] = useState('');

  function startCreate() {
    setEditingId(null);
    setName('');
    setOptions(['']);
    setError('');
  }

  function startEdit(def: CategoryDefinition) {
    setEditingId(def.id);
    setName(def.name);
    setOptions(def.options.length ? [...def.options] : ['']);
    setError('');
  }

  function setOptionAt(idx: number, value: string) {
    setOptions(prev => prev.map((o, i) => (i === idx ? value : o)));
  }

  function addOptionRow() {
    setOptions(prev => (prev.length >= MAX_CATEGORY_OPTIONS ? prev : [...prev, '']));
  }

  function removeOptionRow(idx: number) {
    setOptions(prev => (prev.length <= 1 ? [''] : prev.filter((_, i) => i !== idx)));
  }

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('カテゴリ名を入力してください');
      return;
    }
    const cleanedOpts = options.map(o => o.trim()).filter(Boolean);
    const unique: string[] = [];
    for (const o of cleanedOpts) {
      if (!unique.some(u => u.toLowerCase() === o.toLowerCase())) unique.push(o);
    }
    if (unique.length > MAX_CATEGORY_OPTIONS) {
      setError(`選択肢は${MAX_CATEGORY_OPTIONS}個までです`);
      return;
    }
    const next = upsertCategoryDefinition(definitions, {
      id: editingId ?? undefined,
      name: trimmedName,
      options: unique,
    });
    saveCategoryDefinitions(next);
    onChange(next);
    startCreate();
  }

  function handleDelete(id: string) {
    const next = deleteCategoryDefinition(definitions, id);
    saveCategoryDefinitions(next);
    onChange(next);
    if (editingId === id) startCreate();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal category-manager-modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <span>カテゴリ管理</span>
          <button type="button" className="modal__close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal__body category-manager-body">
          <p className="category-manager-lead">
            カテゴリは無制限に作成できます。各カテゴリの選択肢は最大 {MAX_CATEGORY_OPTIONS} 個です。
          </p>

          <div className="category-manager-layout">
            <div className="category-manager-list">
              <div className="category-manager-list__head">
                <strong>登録済み</strong>
                <button type="button" className="btn-nav" onClick={startCreate}>
                  新規作成
                </button>
              </div>
              {definitions.length === 0 ? (
                <p className="empty">まだカテゴリがありません</p>
              ) : (
                <ul className="category-manager-ul">
                  {definitions.map(d => (
                    <li key={d.id} className={editingId === d.id ? 'is-active' : ''}>
                      <button type="button" className="category-manager-item" onClick={() => startEdit(d)}>
                        <span className="category-manager-item__name">{d.name}</span>
                        <span className="category-manager-item__meta">{d.options.length} / {MAX_CATEGORY_OPTIONS}</span>
                      </button>
                      <button
                        type="button"
                        className="btn-delete"
                        title="削除"
                        onClick={() => handleDelete(d.id)}
                      >
                        削除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="category-manager-editor">
              <h3>{editingId ? 'カテゴリを編集' : 'カテゴリを作成'}</h3>
              <label className="memo-modal-field">
                <span>カテゴリ名</span>
                <input
                  className="memo-modal-category"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="例: プロジェクト"
                  maxLength={64}
                />
              </label>
              <div className="category-manager-options">
                <div className="category-manager-options__head">
                  <span>選択肢（最大 {MAX_CATEGORY_OPTIONS}）</span>
                  <button
                    type="button"
                    className="btn-nav"
                    onClick={addOptionRow}
                    disabled={options.length >= MAX_CATEGORY_OPTIONS}
                  >
                    行を追加
                  </button>
                </div>
                {options.map((o, idx) => (
                  <div key={idx} className="category-manager-option-row">
                    <input
                      type="text"
                      value={o}
                      onChange={e => setOptionAt(idx, e.target.value)}
                      placeholder={`選択肢 ${idx + 1}`}
                      maxLength={64}
                    />
                    <button type="button" className="btn-delete" onClick={() => removeOptionRow(idx)}>
                      削除
                    </button>
                  </div>
                ))}
              </div>
              {error ? <p className="category-manager-error">{error}</p> : null}
              <div className="delete-modal__footer" style={{ marginTop: 12 }}>
                <button type="button" className="btn-cancel" onClick={startCreate}>
                  クリア
                </button>
                <button type="button" className="btn-primary" onClick={handleSave}>
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
