import { useMemo } from 'react';
import type { CategoryAssignment, CategoryDefinition } from '../types';
import { withSyncedCategoryFields } from '../utils/recordValidation';

interface Props {
  value: CategoryAssignment[];
  definitions: CategoryDefinition[];
  onChange: (next: CategoryAssignment[]) => void;
  /** 互換のため残す（この UI では定義の追加・変更はしない） */
  onDefinitionsChange?: (next: CategoryDefinition[]) => void;
  idPrefix?: string;
  compact?: boolean;
}

function setOption(
  value: CategoryAssignment[],
  name: string,
  option: string
): CategoryAssignment[] {
  const trimmedOpt = option.trim();
  const without = value.filter(v => v.name !== name);
  if (!trimmedOpt) return without;
  return [...without, { name, option: trimmedOpt }];
}

/** 定義済みカテゴリを並べ、それぞれ選択肢を選ぶ（複数同時・追加UIなし） */
export default function CategoryPicker({
  value,
  definitions,
  onChange,
  idPrefix = 'cat',
  compact,
}: Props) {
  const selectedMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of value) m.set(a.name, a.option);
    return m;
  }, [value]);

  return (
    <div className={`category-picker ${compact ? 'category-picker--compact' : ''}`}>
      {definitions.length === 0 ? (
        <p className="category-picker__empty">
          カテゴリがありません。設定の「カテゴリ管理」から作成してください。
        </p>
      ) : (
        <div className="category-picker__rows">
          {definitions.map(def => {
            const selected = selectedMap.get(def.name) ?? '';
            return (
              <label key={def.id} className="category-picker__field" htmlFor={`${idPrefix}-${def.id}`}>
                <span>{def.name}</span>
                <select
                  id={`${idPrefix}-${def.id}`}
                  value={selected}
                  onChange={e => onChange(setOption(value, def.name, e.target.value))}
                  aria-label={`${def.name}の選択肢`}
                  disabled={def.options.length === 0}
                >
                  <option value="">{def.options.length === 0 ? '（選択肢なし）' : '（未選択）'}</option>
                  {def.options.map(o => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      )}

      {value.length > 0 ? (
        <p className="category-picker__selected">
          {withSyncedCategoryFields(value).categories
            .map(a => (a.option ? `${a.name}: ${a.option}` : a.name))
            .join(' ｜ ')}
        </p>
      ) : null}
    </div>
  );
}
