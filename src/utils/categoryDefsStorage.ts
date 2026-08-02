import type { CategoryDefinition } from '../types';
import { MAX_CATEGORY_OPTIONS } from '../types';
import { truncateCategory } from './recordValidation';

const LS_CATEGORY_DEFS = 'worklog_category_defs_v1';
const MAX_DEFS = 500;

function sanitizeOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (out.length >= MAX_CATEGORY_OPTIONS) break;
    const t = truncateCategory(typeof item === 'string' ? item : String(item ?? ''));
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function parseDef(raw: unknown): CategoryDefinition | null {
  if (raw === null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  const name = truncateCategory(typeof o.name === 'string' ? o.name : '');
  if (!id || !name) return null;
  return { id, name, options: sanitizeOptions(o.options) };
}

export function loadCategoryDefinitions(): CategoryDefinition[] {
  try {
    const raw = localStorage.getItem(LS_CATEGORY_DEFS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: CategoryDefinition[] = [];
    const seenNames = new Set<string>();
    for (const item of parsed) {
      if (out.length >= MAX_DEFS) break;
      const def = parseDef(item);
      if (!def) continue;
      const key = def.name.toLowerCase();
      if (seenNames.has(key)) continue;
      seenNames.add(key);
      out.push(def);
    }
    return out;
  } catch {
    return [];
  }
}

export function saveCategoryDefinitions(defs: CategoryDefinition[]): void {
  const cleaned: CategoryDefinition[] = [];
  const seenNames = new Set<string>();
  for (const d of defs) {
    if (cleaned.length >= MAX_DEFS) break;
    const name = truncateCategory(d.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    cleaned.push({
      id: d.id?.trim() || crypto.randomUUID(),
      name,
      options: sanitizeOptions(d.options),
    });
  }
  try {
    localStorage.setItem(LS_CATEGORY_DEFS, JSON.stringify(cleaned));
  } catch {
    /* ignore */
  }
}

export function upsertCategoryDefinition(
  defs: CategoryDefinition[],
  next: { id?: string; name: string; options: string[] }
): CategoryDefinition[] {
  const name = truncateCategory(next.name);
  if (!name) return defs;
  const options = sanitizeOptions(next.options);
  const id = next.id?.trim() || crypto.randomUUID();
  const idx = defs.findIndex(d => d.id === id);
  const row: CategoryDefinition = { id, name, options };
  if (idx >= 0) {
    const copy = defs.slice();
    copy[idx] = row;
    return copy;
  }
  // 同名があれば上書き
  const byName = defs.findIndex(d => d.name.toLowerCase() === name.toLowerCase());
  if (byName >= 0) {
    const copy = defs.slice();
    copy[byName] = { ...row, id: defs[byName].id };
    return copy;
  }
  return [...defs, row];
}

export function deleteCategoryDefinition(defs: CategoryDefinition[], id: string): CategoryDefinition[] {
  return defs.filter(d => d.id !== id);
}

/** 記録フォームからカテゴリを新規追加（選択肢は空） */
export function addCategoryName(defs: CategoryDefinition[], name: string): CategoryDefinition[] {
  const t = truncateCategory(name);
  if (!t) return defs;
  if (defs.some(d => d.name.toLowerCase() === t.toLowerCase())) return defs;
  return [...defs, { id: crypto.randomUUID(), name: t, options: [] }];
}

/** 既存カテゴリに選択肢を追加（上限 10） */
export function addOptionToCategory(
  defs: CategoryDefinition[],
  categoryId: string,
  option: string
): CategoryDefinition[] {
  const t = truncateCategory(option);
  if (!t) return defs;
  return defs.map(d => {
    if (d.id !== categoryId) return d;
    if (d.options.some(o => o.toLowerCase() === t.toLowerCase())) return d;
    if (d.options.length >= MAX_CATEGORY_OPTIONS) return d;
    return { ...d, options: [...d.options, t] };
  });
}
