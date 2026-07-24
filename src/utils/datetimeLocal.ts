import { format, parseISO } from 'date-fns';

/** 時刻の刻み（分） */
export const TIME_STEP_MINUTES = 30;

export const MINUTE_OPTIONS = Array.from(
  { length: 60 / TIME_STEP_MINUTES },
  (_, i) => String(i * TIME_STEP_MINUTES).padStart(2, '0')
);

export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

export interface DateTimeParts {
  date: string; // yyyy-MM-dd
  hour: string; // HH
  minute: string; // mm（00 or 30）
}

/** 分を 30 分単位に丸める（秒・ミリ秒は 0） */
export function snapDateToStep(d: Date, stepMin: number = TIME_STEP_MINUTES): Date {
  const next = new Date(d);
  const total = next.getHours() * 60 + next.getMinutes();
  const snapped = Math.round(total / stepMin) * stepMin;
  const clamped = Math.min(snapped, 24 * 60 - stepMin);
  next.setHours(Math.floor(clamped / 60), clamped % 60, 0, 0);
  return next;
}

export function isoToParts(iso: string): DateTimeParts {
  const d = snapDateToStep(parseISO(iso));
  return {
    date: format(d, 'yyyy-MM-dd'),
    hour: format(d, 'HH'),
    minute: format(d, 'mm'),
  };
}

export function partsToISO(parts: DateTimeParts): string {
  const d = new Date(`${parts.date}T${parts.hour}:${parts.minute}:00`);
  return snapDateToStep(d).toISOString();
}

/** 内部結合値 yyyy-MM-ddTHH:mm（フォーム state 用） */
export function partsToLocal(parts: DateTimeParts): string {
  const d = snapDateToStep(new Date(`${parts.date}T${parts.hour}:${parts.minute}:00`));
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export function localToParts(value: string): DateTimeParts {
  if (!value) {
    return noonTodayParts();
  }
  const d = snapDateToStep(new Date(value));
  return {
    date: format(d, 'yyyy-MM-dd'),
    hour: format(d, 'HH'),
    minute: format(d, 'mm'),
  };
}

export function isoToDatetimeLocal(iso: string): string {
  return partsToLocal(isoToParts(iso));
}

export function datetimeLocalToISO(value: string): string {
  return partsToISO(localToParts(value));
}

export function formatRecordDateTime(iso: string): string {
  return format(parseISO(iso), 'yyyy/MM/dd HH:mm');
}

export function noonTodayParts(): DateTimeParts {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return {
    date: format(d, 'yyyy-MM-dd'),
    hour: '12',
    minute: '00',
  };
}

export function noonTodayLocal(): string {
  return partsToLocal(noonTodayParts());
}
