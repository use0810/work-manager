import { useMemo, useState } from 'react';
import type { CategoryAssignment, CategoryDefinition } from '../types';
import { MAX_CATEGORY_OPTIONS } from '../types';
import {
  addCategoryName,
  addOptionToCategory,
  saveCategoryDefinitions,
} from '../utils/categoryDefsStorage';
import { withSyncedCategoryFields } from '../utils/recordValidation';

interface Props {
  value: CategoryAssignment[];
  definitions: CategoryDefinition[];
  onDefinitionsChange: (next: CategoryDefinition[]) => void;
  onChange: (next: CategoryAssignment[]) => void;
  idPrefix?: string;
  compact?: boolean;
}

function optionOf(value: CategoryAssignment[], name: string): string {
  return value.find(v => v.name === name)?.option ?? '';
}

function setOption(
  value: CategoryAssignment[],
  name: string,
  option: string
): CategoryAssignment[] {
  const trimmedOpt = option.trim();
  const without = value.filter(v => v.name !== name);
  // 未選択ならそのカテゴリ行自体を外す
  if (!trimmedOpt) return without;
  return [...without, { name, option: trimmedOpt }];
}

/** 定義済みカテゴリを並べ、それぞれ選択肢を選ぶ（複数カテゴリ同時選択） */
export default function CategoryPicker({
  value,
  definitions,
  onDefinitionsChange,
  onChange,
  idPrefix = 'cat',
  compact,
}: Props) {
  const [newCat, setNewCat] = useState('');
  const [newOptByCat, setNewOptByCat] = useState<Record<string, string>>({});
  const [addingFor, setAddingFor] = useState<string | null>(null);

  const selectedMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of value) m.set(a.name, a.option);
    return m;
  }, [value]);

  function persist(next: CategoryDefinition[]) {
    saveCategoryDefinitions(next);
    onDefinitionsChange(next);
  }

  function handleAddCategory() {
    const t = newCat.trim();
    if (!t) return;
    const next = addCategoryName(definitions, t);
    persist(next);
    setNewCat('');
  }

  function handleAddOption(def: CategoryDefinition) {
    const t = (newOptByCat[def.id] ?? '').trim();
    if (!t) return;
    if (def.options.length >= MAX_CATEGORY_OPTIONS) return;
    const next = addOptionToCategory(definitions, def.id, t);
    persist(next);
    onChange(setOption(value, def.name, t));
    setNewOptByCat(prev => ({ ...prev, [def.id]: '' }));
    setAddingFor(null);
  }

  return (
    <div className={`category-picker ${compact ? 'category-picker--compact' : ''}`}>
      <p className="category-picker__hint">
        複数のカテゴリを同時に選べます（例: プロジェクト＋業務内容）
      </p>

      {definitions.length === 0 ? (
        <p className="category-picker__empty">
          まだカテゴリがありません。下で追加するか、設定の「カテゴリ管理」から作成してください。
        </p>
      ) : (
        <div className="category-picker__rows">
          {definitions.map(def => {
            const selected = selectedMap.get(def.name) ?? '';
            const remaining = MAX_CATEGORY_OPTIONS - def.options.length;
            return (
              <div key={def.id} className="category-picker__row">
                <label className="category-picker__field">
                  <span>{def.name}</span>
                  <select
                    value={selected}
                    onChange={e => onChange(setOption(value, def.name, e.target.value))}
                    aria-label={`${def.name}の選択肢`}
                  >
                    <option value="">（未選択）</option>
                    {def.options.map(o => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                {addingFor === def.id ? (
                  <div className="category-picker__quick-row">
                    <input
                      type="text"
                      value={newOptByCat[def.id] ?? ''}
                      onChange={e =>
                        setNewOptByCat(prev => ({ ...prev, [def.id]: e.target.value }))
                      }
                      placeholder={`選択肢を追加（残り ${remaining}）`}
                      maxLength={64}
                      disabled={remaining <= 0}
                      id={`${idPrefix}-opt-${def.id}`}
                    />
                    <button
                      type="button"
                      className="btn-nav"
                      onClick={() => handleAddOption(def)}
                      disabled={!(newOptByCat[def.id] ?? '').trim() || remaining <= 0}
                    >
                      追加
                    </button>
                    <button type="button" className="btn-cancel" onClick={() => setAddingFor(null)}>
                      閉じる
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-nav category-picker__add-opt"
                    onClick={() => setAddingFor(def.id)}
                    disabled={remaining <= 0}
                  >
                    選択肢＋
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="category-picker__quick">
        <div className="category-picker__quick-row">
          <input
            type="text"
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            placeholder="新カテゴリ名（例: プロジェクト）"
            maxLength={64}
            aria-label="新しいカテゴリ名"
            id={`${idPrefix}-new-cat`}
          />
          <button type="button" className="btn-nav" onClick={handleAddCategory} disabled={!newCat.trim()}>
            カテゴリ追加
          </button>
        </div>
      </div>

      {value.length > 0 ? (
        <p className="category-picker__selected">
          選択中:{' '}
          {withSyncedCategoryFields(value).categories
            .map(a => (a.option ? `${a.name}: ${a.option}` : a.name))
            .join(' ｜ ')}
        </p>
      ) : null}
    </div>
  );
}

export { optionOf };
