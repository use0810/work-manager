import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { WorkRecord } from '../types';
import {
  datetimeLocalToISO,
  isoToDatetimeLocal,
  noonTodayLocal,
} from '../utils/datetimeLocal';
import DateTimeStepPicker from './DateTimeStepPicker';

interface Props {
  onAdd: (record: WorkRecord) => void;
}

export interface AddRecordFormHandle {
  loadFrom: (record: WorkRecord) => void;
}

const AddRecordForm = forwardRef<AddRecordFormHandle, Props>(({ onAdd }, ref) => {
  const init = noonTodayLocal();
  const [start, setStart] = useState(init);
  const [end, setEnd] = useState(init);
  const [memo, setMemo] = useState('');
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useImperativeHandle(ref, () => ({
    loadFrom(record: WorkRecord) {
      setStart(isoToDatetimeLocal(record.startAt));
      setEnd(isoToDatetimeLocal(record.endAt));
      setMemo(record.memo);
      setCopied(true);
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  }));

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!start || !end) return;
    onAdd({
      id: crypto.randomUUID(),
      startAt: datetimeLocalToISO(start),
      endAt: datetimeLocalToISO(end),
      memo,
    });
    setMemo('');
    setCopied(false);
  }

  function handleReset() {
    const next = noonTodayLocal();
    setStart(next);
    setEnd(next);
    setMemo('');
    setCopied(false);
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={`add-form ${copied ? 'add-form--copied' : ''}`}
    >
      {copied && (
        <div className="add-form__copy-banner">
          コピーしました。内容を確認・修正して追加してください。
          <button type="button" className="add-form__copy-clear" onClick={handleReset}>
            クリア
          </button>
        </div>
      )}
      <div className="add-form__row">
        <DateTimeStepPicker label="開始" value={start} onChange={setStart} required />
        <DateTimeStepPicker label="終了" value={end} onChange={setEnd} required />
        <label className="add-form__memo">
          <span>メモ</span>
          <input
            type="text"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="作業内容など"
          />
        </label>
        <button type="submit" className="btn-primary">
          追加
        </button>
      </div>
    </form>
  );
});

AddRecordForm.displayName = 'AddRecordForm';
export default AddRecordForm;
