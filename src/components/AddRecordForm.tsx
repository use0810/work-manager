import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { CategoryDefinition, WorkRecord } from '../types';
import {
  datetimeLocalToISO,
  isoToDatetimeLocal,
  noonTodayLocal,
} from '../utils/datetimeLocal';
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
    const [category, setCategory] = useState('');
    const [categoryOption, setCategoryOption] = useState('');
    const [memo, setMemo] = useState('');
    const [copied, setCopied] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);

    useImperativeHandle(ref, () => ({
      loadFrom(record: WorkRecord) {
        setStart(isoToDatetimeLocal(record.startAt));
        setEnd(isoToDatetimeLocal(record.endAt));
        setCategory(record.category ?? '');
        setCategoryOption(record.categoryOption ?? '');
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

    /** 開始を変えたら終了も一旦同じ値に揃える */
    function handleStartChange(next: string) {
      setStart(next);
      setEnd(next);
    }

    function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      if (!start || !end) return;
      onAdd({
        id: crypto.randomUUID(),
        startAt: datetimeLocalToISO(start),
        endAt: datetimeLocalToISO(end),
        category: category.trim(),
        categoryOption: categoryOption.trim(),
        memo,
      });
      setMemo('');
      setCopied(false);
    }

    function handleReset() {
      const next = noonTodayLocal();
      setStart(next);
      setEnd(next);
      setCategory('');
      setCategoryOption('');
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
          category={category}
          categoryOption={categoryOption}
          definitions={categoryDefinitions}
          onDefinitionsChange={onCategoryDefinitionsChange}
          onChange={({ category: c, categoryOption: o }) => {
            setCategory(c);
            setCategoryOption(o);
          }}
          idPrefix="add-form"
        />
      </form>
    );
  }
);

AddRecordForm.displayName = 'AddRecordForm';
export default AddRecordForm;
