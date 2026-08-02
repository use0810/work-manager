import { useMemo, useState } from 'react';
import type { CategoryDefinition } from '../types';
import { MAX_CATEGORY_OPTIONS } from '../types';
import {
  addCategoryName,
  addOptionToCategory,
  saveCategoryDefinitions,
} from '../utils/categoryDefsStorage';

interface Props {
  category: string;
  categoryOption: string;
  definitions: CategoryDefinition[];
  onDefinitionsChange: (next: CategoryDefinition[]) => void;
  onChange: (next: { category: string; categoryOption: string }) => void;
  /** datalist / id 衝突回避 */
  idPrefix?: string;
  compact?: boolean;
}

/** 記録時のカテゴリ＋選択肢ピッカー（設定済み定義から選択／その場で追加可） */
export default function CategoryPicker({
  category,
  categoryOption,
  definitions,
  onDefinitionsChange,
  onChange,
  idPrefix = 'cat',
  compact,
}: Props) {
  const [newCat, setNewCat] = useState('');
  const [newOpt, setNewOpt] = useState('');

  const selectedDef = useMemo(
    () => definitions.find(d => d.name === category) ?? null,
    [definitions, category]
  );

  function persist(next: CategoryDefinition[]) {
    saveCategoryDefinitions(next);
    onDefinitionsChange(next);
  }

  function handleCategorySelect(name: string) {
    onChange({ category: name, categoryOption: '' });
  }

  function handleAddCategory() {
    const t = newCat.trim();
    if (!t) return;
    const next = addCategoryName(definitions, t);
    persist(next);
    onChange({ category: t, categoryOption: '' });
    setNewCat('');
  }

  function handleAddOption() {
    if (!selectedDef) return;
    const t = newOpt.trim();
    if (!t) return;
    if (selectedDef.options.length >= MAX_CATEGORY_OPTIONS) return;
    const next = addOptionToCategory(definitions, selectedDef.id, t);
    persist(next);
    onChange({ category: selectedDef.name, categoryOption: t });
    setNewOpt('');
  }

  return (
    <div className={`category-picker ${compact ? 'category-picker--compact' : ''}`}>
      <label className="category-picker__field">
        <span>カテゴリ</span>
        <select
          value={category}
          onChange={e => handleCategorySelect(e.target.value)}
          aria-label="カテゴリ"
        >
          <option value="">未分類</option>
          {definitions.map(d => (
            <option key={d.id} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <label className="category-picker__field">
        <span>選択肢</span>
        <select
          value={categoryOption}
          onChange={e => onChange({ category, categoryOption: e.target.value })}
          disabled={!selectedDef}
          aria-label="カテゴリの選択肢"
        >
          <option value="">{selectedDef ? '（なし）' : 'カテゴリを先に選択'}</option>
          {(selectedDef?.options ?? []).map(o => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>

      <div className="category-picker__quick">
        <div className="category-picker__quick-row">
          <input
            type="text"
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            placeholder="新カテゴリ名"
            maxLength={64}
            aria-label="新しいカテゴリ名"
            id={`${idPrefix}-new-cat`}
          />
          <button type="button" className="btn-nav" onClick={handleAddCategory} disabled={!newCat.trim()}>
            カテゴリ追加
          </button>
        </div>
        {selectedDef ? (
          <div className="category-picker__quick-row">
            <input
              type="text"
              value={newOpt}
              onChange={e => setNewOpt(e.target.value)}
              placeholder={`選択肢を追加（残り ${MAX_CATEGORY_OPTIONS - selectedDef.options.length}）`}
              maxLength={64}
              disabled={selectedDef.options.length >= MAX_CATEGORY_OPTIONS}
              aria-label="新しい選択肢"
              id={`${idPrefix}-new-opt`}
            />
            <button
              type="button"
              className="btn-nav"
              onClick={handleAddOption}
              disabled={!newOpt.trim() || selectedDef.options.length >= MAX_CATEGORY_OPTIONS}
            >
              選択肢追加
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
