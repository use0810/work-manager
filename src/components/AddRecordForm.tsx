import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { CategoryAssignment, CategoryDefinition, WorkRecord } from '../types';
import {
  datetimeLocalToISO,
  isoToDatetimeLocal,
  noonTodayLocal,
} from '../utils/datetimeLocal';
import { applyCategoriesToRecord, getRecordCategories } from '../utils/dateUtils';
import DateTimeStepPicker from './DateTimeStepPicker';
import CategoryPicker from './CategoryPicker';

interface Props {
  onAdd: (record: WorkRecord) => void;
  categoryDefinitions: CategoryDefinition[];
  onCategoryDefinitionsChange: (next: CategoryDefinition[]) => void;
}

export interface AddRecordFormHandle {
  loadFrom: (record: WorkRecord) => void;
}

const AddRecordForm = forwardRef<AddRecordFormHandle, Props>(
  ({ onAdd, categoryDefinitions, onCategoryDefinitionsChange }, ref) => {
    const init = noonTodayLocal();
    const [start, setStart] = useState(init);
    const [end, setEnd] = useState(init);
    const [categories, setCategories] = useState<CategoryAssignment[]>([]);
    const [memo, setMemo] = useState('');
    const [copied, setCopied] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);

    useImperativeHandle(ref, () => ({
      loadFrom(record: WorkRecord) {
        setStart(isoToDatetimeLocal(record.startAt));
        setEnd(isoToDatetimeLocal(record.endAt));
        setCategories(getRecordCategories(record));
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

    function handleStartChange(next: string) {
      setStart(next);
      setEnd(next);
    }

    function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      if (!start || !end) return;
      onAdd(
        applyCategoriesToRecord(
          {
            id: crypto.randomUUID(),
            startAt: datetimeLocalToISO(start),
            endAt: datetimeLocalToISO(end),
            memo,
          },
          categories
        )
      );
      setMemo('');
      setCopied(false);
    }

    function handleReset() {
      const next = noonTodayLocal();
      setStart(next);
      setEnd(next);
      setCategories([]);
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
          <DateTimeStepPicker label="開始" value={start} onChange={handleStartChange} required />
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
        <CategoryPicker
          value={categories}
          definitions={categoryDefinitions}
          onDefinitionsChange={onCategoryDefinitionsChange}
          onChange={setCategories}
          idPrefix="add-form"
        />
      </form>
    );
  }
);

AddRecordForm.displayName = 'AddRecordForm';
export default AddRecordForm;
