import { useEffect } from 'react';

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DataResetConfirmModal({ onConfirm, onCancel }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal delete-modal data-reset-modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header delete-modal__header">
          <span>⚠️ ブラウザ内のデータを初期化しますか？</span>
        </div>
        <div className="modal__body delete-modal__body">
          <p className="data-reset-modal__lead">
            次のデータが<strong>すべて削除</strong>され、<strong>元に戻せません</strong>。
          </p>
          <ul className="data-reset-modal__list">
            <li>日時一覧の勤務記録</li>
            <li>アーカイブ</li>
            <li>初回ガイドの同意済みフラグ（次回、ガイドが再表示されます）</li>
          </ul>
          <p className="delete-modal__warn">
            この操作はブラウザ内のデータのみを消去します。書き出し済みの CSV ファイルは削除されません。
          </p>
        </div>
        <div className="delete-modal__footer">
          <button type="button" className="btn-cancel" onClick={onCancel}>
            キャンセル
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm}>
            初期化する
          </button>
        </div>
      </div>
    </div>
  );
}
