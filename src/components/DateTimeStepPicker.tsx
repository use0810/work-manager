import {
  HOUR_OPTIONS,
  MINUTE_OPTIONS,
  localToParts,
  partsToLocal,
  type DateTimeParts,
} from '../utils/datetimeLocal';

interface Props {
  label: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  /** 一覧セル内などコンパクト表示 */
  compact?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export default function DateTimeStepPicker({
  label,
  value,
  onChange,
  required,
  compact,
  inputRef,
  onKeyDown,
}: Props) {
  const parts = localToParts(value);

  function patch(next: Partial<DateTimeParts>) {
    onChange(partsToLocal({ ...parts, ...next }));
  }

  return (
    <div className={`dt-step ${compact ? 'dt-step--compact' : ''}`}>
      {label ? <span className="dt-step__label">{label}</span> : null}
      <div className="dt-step__fields" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="dt-step__date"
          type="date"
          value={parts.date}
          onChange={e => patch({ date: e.target.value })}
          onKeyDown={onKeyDown}
          required={required}
          aria-label={label ? `${label}の日付` : '日付'}
        />
        <select
          className="dt-step__hour"
          value={parts.hour}
          onChange={e => patch({ hour: e.target.value })}
          aria-label={label ? `${label}の時` : '時'}
        >
          {HOUR_OPTIONS.map(h => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="dt-step__sep" aria-hidden>
          :
        </span>
        <select
          className="dt-step__minute"
          value={parts.minute}
          onChange={e => patch({ minute: e.target.value })}
          aria-label={label ? `${label}の分` : '分'}
        >
          {MINUTE_OPTIONS.map(m => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
