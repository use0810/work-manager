import type { ArchivedMonth, WorkRecord } from '../types';
import { parseISO, differenceInMinutes } from 'date-fns';

interface Props {
  archive: ArchivedMonth;
  conflicting: WorkRecord[]; // 日時一覧側の同月レコード
  onConfirm: () => void;
  onCancel: () => void;
}

function totalTime(records: WorkRecord[]) {
  const mins = records.reduce((s, r) =>
    s + Math.max(0, differenceInMinutes(parseISO(r.endAt), parseISO(r.startAt))), 0);
  return `${Math.floor(mins / 60)}時間${mins % 60}分`;
}

function archiveLabel(a: ArchivedMonth) {
  return a.version === 1 ? a.yearMonth : `${a.yearMonth} v${a.version}`;
}

export default function RestoreConfirmModal({ archive, conflicting, onConfirm, onCancel }: Props) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <span>↩️ アーカイブを復元</span>
          <button className="modal__close" onClick={onCancel}>✕</button>
        </div>

        <div className="modal__body">
          <p className="conflict-desc">
            <strong>{archive.yearMonth}</strong> のレコードが日時一覧にすでに
            <strong> {conflicting.length}件</strong> 存在します。
          </p>

          <div className="restore-compare">
            <div className="restore-compare__col">
              <div className="restore-compare__label restore-compare__label--list">日時一覧（現在）</div>
              <div className="restore-compare__val">{conflicting.length}件{totalTime(conflicting)}</div>
            </div>
            <div className="restore-compare__arrow">＋</div>
            <div className="restore-compare__col">
              <div className="restore-compare__label restore-compare__label--archive">アーカイブ（{archiveLabel(archive)}）</div>
              <div className="restore-compare__val">{archive.records.length}件{totalTime(archive.records)}</div>
            </div>
          </div>

          <p className="restore-note">
            まとめても大丈夫ですか？<br />
            復元すると両方のデータが日時一覧に統合され、アーカイブは削除されます。
          </p>
        </div>

        <div className="delete-modal__footer">
          <button className="btn-cancel" onClick={onCancel}>キャンセル</button>
          <button className="btn-restore" onClick={onConfirm}>まとめて復元する</button>
        </div>
      </div>
    </div>
  );
}
