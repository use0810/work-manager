import type { ArchivedMonth } from '../types';
import { format, parseISO } from 'date-fns';

interface Props {
  yearMonth: string;
  existing: ArchivedMonth[];
  onSeparate: () => void;
  onMerge: () => void;
  onCancel: () => void;
}

export default function ArchiveConflictModal({ yearMonth, existing, onSeparate, onMerge, onCancel }: Props) {
  const latest = existing.reduce((a, b) => a.version > b.version ? a : b);
  const nextVersion = latest.version + 1;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <span>📦 アーカイブの競合</span>
          <button className="modal__close" onClick={onCancel}>✕</button>
        </div>
        <div className="modal__body">
          <p className="conflict-desc">
            <strong>{yearMonth}</strong> のアーカイブがすでに存在します。
          </p>
          <div className="conflict-versions">
            {existing.map(a => (
              <div key={a.id} className="conflict-version-row">
                <span className="conflict-version-label">
                  {a.version === 1 ? yearMonth : `${yearMonth} v${a.version}`}
                </span>
                <span className="conflict-version-meta">
                  {a.records.length}件　{format(parseISO(a.archivedAt), 'yyyy/MM/dd HH:mm')} 保存
                </span>
              </div>
            ))}
          </div>
          <p className="conflict-question">今回のデータをどうしますか？</p>
        </div>
        <div className="conflict-footer">
          <button className="btn-cancel" onClick={onCancel}>キャンセル</button>
          <button className="btn-merge" onClick={onMerge}>
            最新版にまとめる
            <span className="btn-sub">（既存データに追記）</span>
          </button>
          <button className="btn-separate" onClick={onSeparate}>
            別に保存する
            <span className="btn-sub">（{yearMonth} v{nextVersion} として保存）</span>
          </button>
        </div>
      </div>
    </div>
  );
}
