import { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import {
  addWeeks, subWeeks, format, isSameDay, isSameMonth, parseISO, isEqual,
  startOfWeek, addDays, differenceInMinutes, addMinutes, startOfDay,
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { formatHoursMinutes, formatRecordCategories, getRecordCategories, applyCategoriesToRecord } from '../utils/dateUtils';
import { updateRecord } from '../utils/storage';
import CategoryPicker from './CategoryPicker';
import type { CategoryAssignment, CategoryDefinition, WorkRecord } from '../types';

const HOUR_END = 24;
const TOTAL_HOURS = HOUR_END;
const HOUR_HEIGHT_PX = 54;
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT_PX;
/** 日列ヘッダー（`.timeline-day-header`）と同じ高さ。左時刻列の縦位置を目盛りと揃える */
const TIMELINE_DAY_HEADER_PX = 52;
const SNAP_MIN = 30;
const MIN_DURATION_MIN = 30;
const DRAG_THRESHOLD_PX = 6;
/** グリッド左右この幅にドロップすると ±1 週間シフト */
const WEEK_DROP_ZONE_PX = 48;
/** ビューポート上端・下端に近いとき、タイムライン内（.timeline-grid）を自動スクロール */
const VIEWPORT_EDGE_AUTO_SCROLL_PX = 56;
const AUTO_SCROLL_STEP_PX = 18;
/** フィルター: そのカテゴリ未設定 */
const FILTER_UNSET = '__unset__';

/** true: 上下ハンドルで時間の伸縮。false にすると移動のみ（検証用） */
const TIMELINE_EDGE_RESIZE = true;

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

type CategoryFilters = Record<string, string>;

function recordMatchesFilters(r: WorkRecord, filters: CategoryFilters): boolean {
  const active = Object.entries(filters).filter(([, v]) => v.trim() !== '');
  if (active.length === 0) return true;
  const cats = getRecordCategories(r);
  for (const [dim, opt] of active) {
    const hit = cats.find(c => c.name === dim);
    if (opt === FILTER_UNSET) {
      if (hit?.option?.trim()) return false;
      continue;
    }
    if (!hit || hit.option !== opt) return false;
  }
  return true;
}

type DragKind = 'move' | 'resize-start' | 'resize-end';

interface DragState {
  kind: DragKind;
  recordId: string;
  pointerId: number;
  fromDayKey: string;
  origStart: Date;
  origEnd: Date;
  grabOffsetY?: number;
  startClientX: number;
  startClientY: number;
  moveThresholdPassed: boolean;
  /** ポインタキャプチャした `.timeline-grid`（release 用） */
  captureBody: HTMLElement | null;
}

interface Props {
  records: WorkRecord[];
  onRecordsChange: (records: WorkRecord[]) => void;
  categoryDefinitions: CategoryDefinition[];
  onCategoryDefinitionsChange: (next: CategoryDefinition[]) => void;
}

function getWeekDays(base: Date): Date[] {
  const start = startOfWeek(base, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function blockStyleWithinStartCalendarDay(startIso: string, endIso: string): { top: number; height: number } {
  const s = parseISO(startIso);
  const e = parseISO(endIso);
  const day0 = startOfDay(s);
  const nextMidnight = addDays(day0, 1);
  const clippedEnd = e.getTime() < nextMidnight.getTime() ? e : nextMidnight;
  const minutesSpan = Math.max(MIN_DURATION_MIN, differenceInMinutes(clippedEnd, s));
  const startMin = Math.max(0, Math.min(24 * 60, differenceInMinutes(s, day0)));
  const top = (startMin / 60) * HOUR_HEIGHT_PX;
  const height = Math.max(22, (minutesSpan / 60) * HOUR_HEIGHT_PX);
  return { top, height };
}

/** 終了が「開始日のカレンダー上の 24:00」（翌 0:00）と一致するか */
function endsAtStartCalendarDayMidnight(s: Date, e: Date): boolean {
  return isEqual(e, addDays(startOfDay(s), 1));
}

/** 日跨ぎ時は日付＋合計時間を含め、ブロック内で状況が分かるようにする（描画の高さは当日でクリップ） */
function timelineBlockLabel(startIso: string, endIso: string): string {
  const s = parseISO(startIso);
  const e = parseISO(endIso);
  const totalMin = Math.max(0, differenceInMinutes(e, s));
  if (endsAtStartCalendarDayMidnight(s, e)) {
    return `${format(s, 'M/d HH:mm', { locale: ja })}–24:00（計${formatHoursMinutes(totalMin)}）`;
  }
  if (isSameDay(s, e)) {
    return `${format(s, 'HH:mm', { locale: ja })}–${format(e, 'HH:mm', { locale: ja })}`;
  }
  return `${format(s, 'M/d HH:mm', { locale: ja })}→${format(e, 'M/d HH:mm', { locale: ja })}（計${formatHoursMinutes(totalMin)}）`;
}

function minutesOverlappingCalendarDay(
  day: Date,
  list: WorkRecord[],
  preview: { id: string; startAt: string; endAt: string } | null
): number {
  const day0 = startOfDay(day);
  const day1 = addDays(day0, 1);
  let sum = 0;
  for (const r of list) {
    const eff = preview?.id === r.id ? preview : r;
    const s = parseISO(eff.startAt);
    const e = parseISO(eff.endAt);
    const segStart = s.getTime() < day0.getTime() ? day0 : s;
    const segEnd = e.getTime() > day1.getTime() ? day1 : e;
    if (segEnd <= segStart) continue;
    sum += differenceInMinutes(segEnd, segStart);
  }
  return sum;
}

function snapMinutes(m: number): number {
  const maxStart = 24 * 60 - MIN_DURATION_MIN;
  const clamped = Math.max(0, Math.min(maxStart, m));
  return Math.round(clamped / SNAP_MIN) * SNAP_MIN;
}

/** 終了リサイズ用。開始用 snap とは別に当日いっぱい（endMin=1440＝翌 0:00）まで許可。clamp はその瞬間まで */
function snapEndMinutes(m: number): number {
  const maxEnd = 24 * 60;
  const clamped = Math.max(0, Math.min(maxEnd, m));
  // 最終刻みの上半分は 24:00 に寄せる（丸めで 23:30 に張り付きやすいのを防ぐ）
  if (clamped > maxEnd - SNAP_MIN / 2) return maxEnd;
  return Math.round(clamped / SNAP_MIN) * SNAP_MIN;
}

function dayKeyToMidnight(dayKey: string): Date {
  const [y, mo, d] = dayKey.split('-').map(Number);
  return new Date(y, mo - 1, d, 0, 0, 0, 0);
}

function clampRangeOnDay(dayKey: string, startMin: number, endMin: number): { startAt: string; endAt: string } {
  const day0 = dayKeyToMidnight(dayKey);
  /** 当日 24:00＝翌日 0:00。30 分刻みで endMin=1440 まで許可 */
  const dayAt24 = addMinutes(day0, 24 * 60);
  let start = addMinutes(day0, startMin);
  let end = addMinutes(day0, endMin);
  if (end > dayAt24) end = dayAt24;
  if (differenceInMinutes(end, start) < MIN_DURATION_MIN) {
    start = addMinutes(end, -MIN_DURATION_MIN);
  }
  if (start < day0) start = day0;
  if (differenceInMinutes(end, start) < MIN_DURATION_MIN) {
    end = addMinutes(start, MIN_DURATION_MIN);
    if (end > dayAt24) end = dayAt24;
  }
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

/** 日列の実測高さで 0〜24:00 に写像（CSS px と論理 TOTAL_HEIGHT のズレで下端が届かない問題の回避） */
function minutesFromBodyY(clientY: number, bodyRect: DOMRect): number {
  const raw = clientY - bodyRect.top;
  const span = Math.max(bodyRect.height, 1e-6);
  const m = (raw / span) * (24 * 60);
  return Math.max(0, Math.min(24 * 60, m));
}

function getDayBodyUnder(clientX: number, clientY: number): { dayKey: string; rect: DOMRect } | null {
  const stack = document.elementsFromPoint(clientX, clientY);
  for (const el of stack) {
    if (!(el instanceof HTMLElement)) continue;
    const body = el.closest('.timeline-day-body');
    if (body instanceof HTMLElement) {
      const key = body.dataset.dayKey;
      if (key) return { dayKey: key, rect: body.getBoundingClientRect() };
    }
  }
  return null;
}

function getBodyRectForDay(dayKey: string): DOMRect | null {
  const el = document.querySelector<HTMLElement>(`.timeline-day-body[data-day-key="${dayKey}"]`);
  return el?.getBoundingClientRect() ?? null;
}

function getWeekDropZone(
  clientX: number,
  clientY: number,
  gridEl: HTMLElement
): 'prev' | 'next' | null {
  const r = gridEl.getBoundingClientRect();
  if (clientY < r.top || clientY > r.bottom) return null;
  if (clientX >= r.left && clientX <= r.left + WEEK_DROP_ZONE_PX) return 'prev';
  if (clientX >= r.right - WEEK_DROP_ZONE_PX && clientX <= r.right) return 'next';
  return null;
}

/** タイムライン枠（overflow 内）の端のみ自動スクロール。ページ全体の scroll は触らない（非全画面で座標とレイアウトがずれるのを防ぐ） */
function autoScrollDuringDrag(gridEl: HTMLElement | null, clientX: number, clientY: number) {
  const edge = VIEWPORT_EDGE_AUTO_SCROLL_PX;
  const step = AUTO_SCROLL_STEP_PX;

  const scrollOnce = () => {
    if (!gridEl) return;
    const r = gridEl.getBoundingClientRect();
    const maxY = gridEl.scrollHeight - gridEl.clientHeight;
    const maxX = gridEl.scrollWidth - gridEl.clientWidth;
    if (clientY < r.top + edge) {
      gridEl.scrollTop = Math.max(0, gridEl.scrollTop - step);
    } else if (clientY > r.bottom - edge) {
      gridEl.scrollTop = Math.min(maxY, gridEl.scrollTop + step);
    }
    if (clientX < r.left + edge) {
      gridEl.scrollLeft = Math.max(0, gridEl.scrollLeft - step);
    } else if (clientX > r.right - edge) {
      gridEl.scrollLeft = Math.min(maxX, gridEl.scrollLeft + step);
    }
  };

  for (let i = 0; i < 4; i++) {
    scrollOnce();
  }
}

export default function WeekTimeline({
  records,
  onRecordsChange,
  categoryDefinitions,
  onCategoryDefinitionsChange,
}: Props) {
  const [baseDate, setBaseDate] = useState(new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ record: WorkRecord; x: number; y: number } | null>(null);
  const [memoEdit, setMemoEdit] = useState<{
    record: WorkRecord;
    memo: string;
    categories: CategoryAssignment[];
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ id: string; startAt: string; endAt: string } | null>(null);
  const [timelineDragging, setTimelineDragging] = useState(false);
  const [weekDropHint, setWeekDropHint] = useState<'prev' | 'next' | null>(null);
  const [filters, setFilters] = useState<CategoryFilters>({});

  const suppressClickRef = useRef(false);
  const previewRef = useRef<{ id: string; startAt: string; endAt: string } | null>(null);
  const recordsRef = useRef(records);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const weekDropHintRef = useRef<'prev' | 'next' | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const activeDragRef = useRef(false);

  /** レンダー中は触れない。previewRef は applyPreview / pointerUp のみで更新 */
  useLayoutEffect(() => {
    recordsRef.current = records;
  }, [records]);

  const weekDays = useMemo(() => getWeekDays(baseDate), [baseDate]);

  const filterDimensions = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const d of categoryDefinitions) {
      const name = d.name.trim();
      if (!name) continue;
      if (!map.has(name)) map.set(name, new Set());
      for (const o of d.options) {
        const t = o.trim();
        if (t) map.get(name)!.add(t);
      }
    }
    for (const r of records) {
      for (const a of getRecordCategories(r)) {
        const name = a.name.trim();
        if (!name) continue;
        if (!map.has(name)) map.set(name, new Set());
        const opt = a.option.trim();
        if (opt) map.get(name)!.add(opt);
      }
    }
    return Array.from(map.entries())
      .map(([name, opts]) => ({
        name,
        options: Array.from(opts).sort((a, b) => a.localeCompare(b, 'ja')),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }, [categoryDefinitions, records]);

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some(v => v.trim() !== ''),
    [filters]
  );

  const filteredRecords = useMemo(
    () => (hasActiveFilters ? records.filter(r => recordMatchesFilters(r, filters)) : records),
    [records, filters, hasActiveFilters]
  );

  useEffect(() => {
    if (selectedId && !filteredRecords.some(r => r.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filteredRecords, selectedId]);

  const recordsByDay = useMemo(() => {
    const map = new Map<string, WorkRecord[]>();
    weekDays.forEach(d => map.set(format(d, 'yyyy-MM-dd'), []));
    filteredRecords.forEach(r => {
      const eff = dragPreview?.id === r.id ? dragPreview : r;
      const key = format(parseISO(eff.startAt), 'yyyy-MM-dd');
      if (map.has(key)) map.get(key)!.push(r);
    });
    return map;
  }, [filteredRecords, weekDays, dragPreview]);

  const totalMinutes = useMemo(
    () =>
      weekDays.reduce((acc, d) => {
        const recs = recordsByDay.get(format(d, 'yyyy-MM-dd')) ?? [];
        return (
          acc +
          recs.reduce((s, r) => {
            const eff = dragPreview?.id === r.id ? dragPreview : r;
            return s + Math.max(0, differenceInMinutes(parseISO(eff.endAt), parseISO(eff.startAt)));
          }, 0)
        );
      }, 0),
    [recordsByDay, weekDays, dragPreview]
  );

  /** 日時一覧と同様、開始日時の属する月で集計（週ナビの基準日の月） */
  const monthTotalMinutes = useMemo(
    () =>
      filteredRecords.reduce((sum, r) => {
        const eff = dragPreview?.id === r.id ? dragPreview : r;
        const s = parseISO(eff.startAt);
        if (!isSameMonth(s, baseDate)) return sum;
        return sum + Math.max(0, differenceInMinutes(parseISO(eff.endAt), parseISO(eff.startAt)));
      }, 0),
    [filteredRecords, baseDate, dragPreview]
  );

  function setFilter(dim: string, value: string) {
    setFilters(prev => {
      const next = { ...prev };
      if (!value) delete next[dim];
      else next[dim] = value;
      return next;
    });
  }

  function clearFilters() {
    setFilters({});
  }

  const shiftRecord = useCallback(
    (id: string, startDelta: number, endDelta: number) => {
      if (dragPreview) return;
      const rec = records.find(r => r.id === id);
      if (!rec) return;
      const updated: WorkRecord = {
        ...rec,
        startAt: addMinutes(parseISO(rec.startAt), startDelta).toISOString(),
        endAt: addMinutes(parseISO(rec.endAt), endDelta).toISOString(),
      };
      onRecordsChange(updateRecord(updated));
    },
    [records, onRecordsChange, dragPreview]
  );

  useEffect(() => {
    if (!selectedId || dragPreview) return;
    function onKey(e: KeyboardEvent) {
      if (!selectedId) return;
      if (memoEdit) return;
      switch (e.key) {
        case 'd':
          e.preventDefault();
          shiftRecord(selectedId, -30, 0);
          break;
        case 'f':
          e.preventDefault();
          shiftRecord(selectedId, 0, +30);
          break;
        case 'j':
          e.preventDefault();
          shiftRecord(selectedId, +30, 0);
          break;
        case 'k':
          e.preventDefault();
          shiftRecord(selectedId, 0, -30);
          break;
        case 'Escape':
          setSelectedId(null);
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, shiftRecord, memoEdit, dragPreview]);

  useEffect(() => {
    function applyPreview(next: { id: string; startAt: string; endAt: string }) {
      previewRef.current = next;
      setDragPreview(next);
    }

    function setWeekHint(next: 'prev' | 'next' | null) {
      if (weekDropHintRef.current === next) return;
      weekDropHintRef.current = next;
      setWeekDropHint(next);
    }

    function onPointerMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;

      const grid = gridRef.current;
      autoScrollDuringDrag(grid, e.clientX, e.clientY);

      if (drag.kind === 'move') {
        const dist = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY);
        if (!drag.moveThresholdPassed) {
          if (dist < DRAG_THRESHOLD_PX) return;
          drag.moveThresholdPassed = true;
          activeDragRef.current = true;
        }

        if (grid) {
          const z = getWeekDropZone(e.clientX, e.clientY, grid);
          setWeekHint(z);
        }

        const under = getDayBodyUnder(e.clientX, e.clientY);
        if (!under) return;

        const pointerRelY = e.clientY - under.rect.top;
        const blockTopPx = pointerRelY - (drag.grabOffsetY ?? 0);
        const daySpan = Math.max(under.rect.height, 1e-6);
        const newStartMin = snapMinutes((blockTopPx / daySpan) * (24 * 60));
        const duration = Math.max(
          MIN_DURATION_MIN,
          differenceInMinutes(drag.origEnd, drag.origStart)
        );
        const newEndMin = newStartMin + duration;
        const clamped = clampRangeOnDay(under.dayKey, newStartMin, newEndMin);
        applyPreview({ id: drag.recordId, ...clamped });
        return;
      }

      if (TIMELINE_EDGE_RESIZE) {
        setWeekHint(null);

        const rect = getBodyRectForDay(drag.fromDayKey);
        if (!rect) return;
        activeDragRef.current = true;

        if (drag.kind === 'resize-start') {
          const m = snapMinutes(minutesFromBodyY(e.clientY, rect));
          const day0 = dayKeyToMidnight(drag.fromDayKey);
          const endMin = Math.round(differenceInMinutes(drag.origEnd, day0));
          const newStart = Math.min(m, endMin - MIN_DURATION_MIN);
          const clamped = clampRangeOnDay(drag.fromDayKey, newStart, endMin);
          applyPreview({ id: drag.recordId, ...clamped });
          return;
        }

        if (drag.kind === 'resize-end') {
          const m = snapEndMinutes(minutesFromBodyY(e.clientY, rect));
          const day0 = dayKeyToMidnight(drag.fromDayKey);
          const startMin = Math.round(differenceInMinutes(drag.origStart, day0));
          const newEnd = Math.max(m, startMin + MIN_DURATION_MIN);
          const clamped = clampRangeOnDay(drag.fromDayKey, startMin, newEnd);
          applyPreview({ id: drag.recordId, ...clamped });
        }
      }
    }

    function onPointerUp(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      const dragKind = drag.kind;
      const moveOk = drag.kind !== 'move' || drag.moveThresholdPassed;
      const cap = drag.captureBody;
      if (cap?.releasePointerCapture) {
        try {
          cap.releasePointerCapture(e.pointerId);
        } catch {
          /* 既に解放済み */
        }
      }
      dragRef.current = null;
      setTimelineDragging(false);
      setWeekHint(null);

      if (drag.kind === 'move' && !drag.moveThresholdPassed) {
        setDragPreview(null);
        previewRef.current = null;
        return;
      }

      if (activeDragRef.current && previewRef.current && moveOk) {
        suppressClickRef.current = true;
        const prev = previewRef.current;
        const rec = recordsRef.current.find(r => r.id === prev.id);
        if (rec) {
          const grid = gridRef.current;
          const zone =
            dragKind === 'move' && grid ? getWeekDropZone(e.clientX, e.clientY, grid) : null;

          let startAt = prev.startAt;
          let endAt = prev.endAt;
          if (zone === 'prev') {
            startAt = addDays(parseISO(prev.startAt), -7).toISOString();
            endAt = addDays(parseISO(prev.endAt), -7).toISOString();
            setBaseDate(d => subWeeks(d, 1));
          } else if (zone === 'next') {
            startAt = addDays(parseISO(prev.startAt), 7).toISOString();
            endAt = addDays(parseISO(prev.endAt), 7).toISOString();
            setBaseDate(d => addWeeks(d, 1));
          }
          onRecordsChange(updateRecord({ ...rec, startAt, endAt }));
        }
      }
      activeDragRef.current = false;
      setDragPreview(null);
      previewRef.current = null;
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [onRecordsChange, setBaseDate]);

  function startDrag(kind: DragKind, rec: WorkRecord, e: React.PointerEvent, dayKey: string, blockTopPx: number) {
    e.stopPropagation();
    e.preventDefault();
    if (!TIMELINE_EDGE_RESIZE && kind !== 'move') return;
    const grid = gridRef.current;
    const body = (e.target as HTMLElement).closest('.timeline-day-body') as HTMLElement | null;
    if (!body || !grid) return;
    const rect = body.getBoundingClientRect();
    const grabOffsetY = e.clientY - rect.top - blockTopPx;

    if (grid.setPointerCapture) {
      try {
        grid.setPointerCapture(e.pointerId);
      } catch {
        /* 非対応・失敗時は window リスナーのみ */
      }
    }

    dragRef.current = {
      kind,
      recordId: rec.id,
      pointerId: e.pointerId,
      fromDayKey: dayKey,
      origStart: parseISO(rec.startAt),
      origEnd: parseISO(rec.endAt),
      grabOffsetY: kind === 'move' ? grabOffsetY : undefined,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moveThresholdPassed: kind !== 'move',
      captureBody: grid,
    };
    if (kind !== 'move') activeDragRef.current = false;
    setTimelineDragging(true);
  }

  function handleMemoSave() {
    if (!memoEdit) return;
    const updated: WorkRecord = applyCategoriesToRecord(
      {
        ...memoEdit.record,
        memo: memoEdit.memo,
      },
      memoEdit.categories
    );
    onRecordsChange(updateRecord(updated));
    setMemoEdit(null);
  }

  function handleGridClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('.timeline-block')) return;
    setSelectedId(null);
  }

  function effectiveRecord(rec: WorkRecord): WorkRecord {
    if (dragPreview?.id === rec.id) {
      return { ...rec, startAt: dragPreview.startAt, endAt: dragPreview.endAt };
    }
    return rec;
  }

  const weekLabel = `${format(weekDays[0], 'yyyy年M月d日', { locale: ja })} 〜 ${format(weekDays[6], 'M月d日', { locale: ja })}`;

  return (
    <div className="week-timeline" tabIndex={-1}>
      <div className="week-nav">
        <button className="btn-nav" onClick={() => setBaseDate(d => subWeeks(d, 1))}>
          ‹ 前週
        </button>
        <span className="week-nav__label">{weekLabel}</span>
        <button className="btn-nav" onClick={() => setBaseDate(new Date())}>
          今週
        </button>
        <button className="btn-nav" onClick={() => setBaseDate(d => addWeeks(d, 1))}>
          次週 ›
        </button>
      </div>

      <div className="week-status-row">
        <p className="week-total">
          週合計{hasActiveFilters ? '（絞り込み）' : ''}:{' '}
          <strong>
            {formatHoursMinutes(totalMinutes)}
          </strong>
        </p>
        <p className="week-total week-total--month">
          当月合計（{format(baseDate, 'yyyy年M月', { locale: ja })}）
          {hasActiveFilters ? '（絞り込み）' : ''}:{' '}
          <strong>{formatHoursMinutes(monthTotalMinutes)}</strong>
        </p>
        <p className="week-memo-hint">ブロックを右クリックでメモを編集</p>
        {selectedId && (
          <p className="week-key-hint">
            <span className="key">d</span>開始−30分 <span className="key">f</span>終了+30分{' '}
            <span className="key">j</span>開始+30分 <span className="key">k</span>終了−30分{' '}
            <span className="key-hint-sep">／</span>
            {TIMELINE_EDGE_RESIZE
              ? `ドラッグで移動（他日・グリッド左右で前後の週）・上下端で伸縮（${SNAP_MIN}分刻み）`
              : `ドラッグで移動のみ（他日・グリッド左右で前後の週）。伸縮は d/f/j/k キー`}
            <span className="key-hint-sep">／</span>
            <span className="key">Esc</span>で選択解除
          </p>
        )}
      </div>

      {filterDimensions.length > 0 ? (
        <div className="week-filters" role="group" aria-label="カテゴリフィルター">
          {filterDimensions.map(dim => (
            <label key={dim.name} className="week-filters__field">
              <span>{dim.name}</span>
              <select
                value={filters[dim.name] ?? ''}
                onChange={e => setFilter(dim.name, e.target.value)}
                aria-label={`${dim.name}で絞り込み`}
              >
                <option value="">すべて</option>
                <option value={FILTER_UNSET}>（未設定）</option>
                {dim.options.map(o => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {hasActiveFilters && (
            <button type="button" className="btn-nav week-filters__clear" onClick={clearFilters}>
              クリア
            </button>
          )}
        </div>
      ) : (
        <p className="week-filters-empty">カテゴリを設定すると、ここで絞り込めます</p>
      )}

      <div
        ref={gridRef}
        className="timeline-grid"
        style={{ minHeight: TIMELINE_DAY_HEADER_PX + TOTAL_HEIGHT }}
        onClick={handleGridClick}
      >
        {timelineDragging && (
          <>
            <div
              className={`timeline-week-drop timeline-week-drop--prev ${weekDropHint === 'prev' ? 'is-active' : ''}`}
              aria-hidden
            >
              <span>前週へ</span>
            </div>
            <div
              className={`timeline-week-drop timeline-week-drop--next ${weekDropHint === 'next' ? 'is-active' : ''}`}
              aria-hidden
            >
              <span>翌週へ</span>
            </div>
          </>
        )}
        <div className="timeline-hours">
          <div
            className="timeline-hours-spacer"
            style={{ height: TIMELINE_DAY_HEADER_PX, flexShrink: 0 }}
            aria-hidden
          />
          <div className="timeline-hours-track" style={{ height: TOTAL_HEIGHT }}>
            {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
              <div
                key={i}
                className="timeline-hour-label"
                style={{ top: i * HOUR_HEIGHT_PX - 8 }}
              >
                {String(i).padStart(2, '0')}:00
              </div>
            ))}
          </div>
        </div>

        {weekDays.map((day, di) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayRecs = recordsByDay.get(key) ?? [];
          const isToday = isSameDay(day, new Date());
          const dayMinutes = minutesOverlappingCalendarDay(day, filteredRecords, dragPreview);

          return (
            <div key={key} className={`timeline-day ${isToday ? 'timeline-day--today' : ''}`}>
              <div className="timeline-day-header">
                <span className={`timeline-day-label ${di >= 5 ? 'weekend' : ''}`}>{DAY_LABELS[di]}</span>
                <span className="timeline-day-date">{format(day, 'M/d')}</span>
                {dayMinutes > 0 && (
                  <span className="timeline-day-total">
                    {Math.floor(dayMinutes / 60)}h{dayMinutes % 60}m
                  </span>
                )}
              </div>

              <div
                className="timeline-day-body"
                data-day-key={key}
                style={{ height: TOTAL_HEIGHT }}
              >
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div
                    key={i}
                    className={`timeline-gridline ${i % 2 === 0 ? 'even' : 'odd'}`}
                    style={{ top: i * HOUR_HEIGHT_PX, height: HOUR_HEIGHT_PX }}
                  />
                ))}

                {dayRecs.map(rec => {
                  const eff = effectiveRecord(rec);
                  const { top, height } = blockStyleWithinStartCalendarDay(eff.startAt, eff.endAt);
                  const isSelected = rec.id === selectedId;
                  const isDragging = dragPreview?.id === rec.id;
                  const overnight = !isSameDay(parseISO(eff.startAt), parseISO(eff.endAt));

                  return (
                    <div
                      key={rec.id}
                      className={`timeline-block ${overnight ? 'timeline-block--overnight' : ''} ${isSelected ? 'timeline-block--selected' : ''} ${isDragging ? 'timeline-block--dragging' : ''} ${!TIMELINE_EDGE_RESIZE ? 'timeline-block--move-only' : ''}`}
                      style={{ top, height }}
                      onClick={e => {
                        e.stopPropagation();
                        if (suppressClickRef.current) {
                          suppressClickRef.current = false;
                          return;
                        }
                        setSelectedId(isSelected ? null : rec.id);
                        setTooltip(null);
                      }}
                      onContextMenu={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        setTooltip(null);
                        setSelectedId(rec.id);
                        setMemoEdit({
                          record: rec,
                          memo: rec.memo,
                          categories: getRecordCategories(rec),
                        });
                      }}
                      onMouseEnter={e => {
                        if (!isSelected && !dragPreview)
                          setTooltip({ record: eff, x: e.clientX, y: e.clientY });
                      }}
                      onMouseMove={e => {
                        if (!isSelected && !dragPreview)
                          setTooltip(t => (t ? { ...t, x: e.clientX, y: e.clientY } : null));
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {TIMELINE_EDGE_RESIZE && (
                        <div
                          className="timeline-block__handle timeline-block__handle--top"
                          onPointerDown={e => startDrag('resize-start', rec, e, key, top)}
                        />
                      )}
                      <div
                        className="timeline-block__main"
                        onPointerDown={e => startDrag('move', rec, e, key, top)}
                      >
                        <span className="timeline-block__text">
                          {timelineBlockLabel(eff.startAt, eff.endAt)}
                        </span>
                      </div>
                      {TIMELINE_EDGE_RESIZE && (
                        <div
                          className="timeline-block__handle timeline-block__handle--bottom"
                          onPointerDown={e => startDrag('resize-end', rec, e, key, top)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {memoEdit && (
        <div className="modal-backdrop" onClick={() => setMemoEdit(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>種別・メモを編集</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                  {isSameDay(parseISO(memoEdit.record.startAt), parseISO(memoEdit.record.endAt)) ? (
                    <>
                      {format(parseISO(memoEdit.record.startAt), 'yyyy年MM月dd日 HH:mm')}
                      {' '}〜{' '}
                      {format(parseISO(memoEdit.record.endAt), 'HH:mm')}
                    </>
                  ) : (
                    <>
                      {format(parseISO(memoEdit.record.startAt), 'yyyy年MM月dd日 HH:mm', { locale: ja })}
                      {' '}〜{' '}
                      {format(parseISO(memoEdit.record.endAt), 'yyyy年MM月dd日 HH:mm', { locale: ja })}
                      {' '}
                      <span style={{ color: 'var(--green)' }}>
                        （計 {formatHoursMinutes(
                          Math.max(0, differenceInMinutes(parseISO(memoEdit.record.endAt), parseISO(memoEdit.record.startAt)))
                        )}）
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button className="modal__close" onClick={() => setMemoEdit(null)}>
                ✕
              </button>
            </div>
            <div className="modal__body">
              <CategoryPicker
                value={memoEdit.categories}
                definitions={categoryDefinitions}
                onDefinitionsChange={onCategoryDefinitionsChange}
                onChange={categories =>
                  setMemoEdit(m => (m ? { ...m, categories } : null))
                }
                idPrefix="timeline"
                compact
              />
              <label className="memo-modal-field">
                <span>メモ</span>
                <textarea
                  className="memo-edit-textarea"
                  value={memoEdit.memo}
                  onChange={e => setMemoEdit(m => (m ? { ...m, memo: e.target.value } : null))}
                  placeholder="メモを入力..."
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Escape') setMemoEdit(null);
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleMemoSave();
                  }}
                />
              </label>
              <p className="memo-edit-hint">Ctrl+Enter で保存 / Esc でキャンセル</p>
            </div>
            <div className="delete-modal__footer">
              <button className="btn-cancel" onClick={() => setMemoEdit(null)}>
                キャンセル
              </button>
              <button className="btn-primary" onClick={handleMemoSave}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {tooltip && !selectedId && !dragPreview && (() => {
        const tr = tooltip.record;
        const s = parseISO(tr.startAt);
        const e = parseISO(tr.endAt);
        const overnight = !isSameDay(s, e);
        const dur = Math.max(0, differenceInMinutes(e, s));
        return (
        <div
          className="timeline-tooltip"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8, position: 'fixed' }}
        >
          {overnight && (
            <div className="tooltip-overnight-badge">日付をまたぐ記録</div>
          )}
          <div>
            <strong>
              {overnight
                ? `${format(s, 'yyyy/M/d HH:mm', { locale: ja })} 〜 ${format(e, 'yyyy/M/d HH:mm', { locale: ja })}`
                : format(s, 'yyyy/MM/dd', { locale: ja })}
            </strong>
          </div>
          {!overnight && (
            <div>
              {format(s, 'HH:mm', { locale: ja })} 〜 {format(e, 'HH:mm', { locale: ja })}
            </div>
          )}
          {getRecordCategories(tooltip.record).length > 0 && (
            <div className="tooltip-category">
              {formatRecordCategories(tooltip.record)}
            </div>
          )}
          {tooltip.record.memo && <div className="tooltip-memo">{tooltip.record.memo}</div>}
          <div className="tooltip-duration">
            合計 {formatHoursMinutes(dur)}
          </div>
        </div>
        );
      })()}
    </div>
  );
}
