import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { WorkRecord } from '../types';
import { parseISO } from 'date-fns';

interface Props {
  onAdd: (record: WorkRecord) => void;
}

export interface AddRecordFormHandle {
  loadFrom: (record: WorkRecord) => void;
}

interface DT {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
}

function nowNoon(): DT {
  const d = new Date();
  return {
    year:   String(d.getFullYear()),
    month:  String(d.getMonth() + 1).padStart(2, '0'),
    day:    String(d.getDate()).padStart(2, '0'),
    hour:   '12',
    minute: '00',
  };
}

function isoToDT(iso: string): DT {
  const d = parseISO(iso);
  return {
    year:   String(d.getFullYear()),
    month:  String(d.getMonth() + 1).padStart(2, '0'),
    day:    String(d.getDate()).padStart(2, '0'),
    hour:   String(d.getHours()).padStart(2, '0'),
    minute: String(d.getMinutes()).padStart(2, '0'),
  };
}

function dtToISO(dt: DT): string {
  return new Date(
    `${dt.year}-${dt.month.padStart(2,'0')}-${dt.day.padStart(2,'0')}T${dt.hour.padStart(2,'0')}:${dt.minute.padStart(2,'0')}:00`
  ).toISOString();
}

function DTInputs({ label, value, onChange }: { label: string; value: DT; onChange: (v: DT) => void }) {
  function set(key: keyof DT, v: string) { onChange({ ...value, [key]: v }); }

  return (
    <div className="dt-inputs">
      <span className="dt-inputs__label">{label}</span>
      <div className="dt-inputs__fields">
        <input className="dt-field dt-field--year"   type="number" min="2000" max="2099" value={value.year}   onChange={e => set('year',   e.target.value)} placeholder="年" required />
        <span className="dt-sep">年</span>
        <input className="dt-field dt-field--month"  type="number" min="1"    max="12"   value={value.month}  onChange={e => set('month',  e.target.value)} placeholder="月" required />
        <span className="dt-sep">月</span>
        <input className="dt-field dt-field--day"    type="number" min="1"    max="31"   value={value.day}    onChange={e => set('day',    e.target.value)} placeholder="日" required />
        <span className="dt-sep">日</span>
        <input className="dt-field dt-field--hour"   type="number" min="0"    max="23"   value={value.hour}   onChange={e => set('hour',   e.target.value)} placeholder="時" required />
        <span className="dt-sep">時</span>
        <input className="dt-field dt-field--minute" type="number" min="0"    max="59"   value={value.minute} onChange={e => set('minute', e.target.value)} placeholder="分" required />
        <span className="dt-sep">分</span>
      </div>
    </div>
  );
}

const AddRecordForm = forwardRef<AddRecordFormHandle, Props>(({ onAdd }, ref) => {
  const init = nowNoon();
  const [start, setStart] = useState<DT>(init);
  const [end,   setEnd]   = useState<DT>(init);
  const [memo,  setMemo]  = useState('');
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useImperativeHandle(ref, () => ({
    loadFrom(record: WorkRecord) {
      setStart(isoToDT(record.startAt));
      setEnd(isoToDT(record.endAt));
      setMemo(record.memo);
      setCopied(true);
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  }));

  useEffect(() => {
    if (copied) {
      const t = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(t);
    }
  }, [copied]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onAdd({
      id: crypto.randomUUID(),
      startAt: dtToISO(start),
      endAt:   dtToISO(end),
      memo,
    });
    setMemo('');
    setCopied(false);
  }

  function handleReset() {
    const init = nowNoon();
    setStart(init);
    setEnd(init);
    setMemo('');
    setCopied(false);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className={`add-form ${copied ? 'add-form--copied' : ''}`}>
      {copied && (
        <div className="add-form__copy-banner">
          📋 コピーしました。内容を確認・修正して追加してください。
          <button type="button" className="add-form__copy-clear" onClick={handleReset}>クリア</button>
        </div>
      )}
      <div className="add-form__row">
        <DTInputs label="開始" value={start} onChange={setStart} />
        <DTInputs label="終了" value={end}   onChange={setEnd} />
        <label className="add-form__memo">
          <span>メモ</span>
          <input
            type="text"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="作業内容など"
          />
        </label>
        <button type="submit" className="btn-primary">追加</button>
      </div>
    </form>
  );
});

AddRecordForm.displayName = 'AddRecordForm';
export default AddRecordForm;
