import { googleLogout, useGoogleLogin } from '@react-oauth/google';
import { useEffect, useState } from 'react';
import type { WorkRecord } from '../types';
import {
  clearGoogleAccessSession,
  createSpreadsheet,
  extractSpreadsheetId,
  fetchGoogleUserEmail,
  getStoredSpreadsheetId,
  listUserSpreadsheets,
  pullWorkRecords,
  pushWorkRecords,
  readGoogleAccessSession,
  saveGoogleAccessSession,
  setStoredSpreadsheetId,
  SHEETS_OAUTH_SCOPES,
  type DriveSpreadsheetItem,
} from '../utils/googleSheets';
import { saveRecords } from '../utils/storage';

interface Props {
  open: boolean;
  onClose: () => void;
  records: WorkRecord[];
  onRecordsChange: (r: WorkRecord[]) => void;
  /** 実際に GoogleOAuthProvider に渡しているクライアント ID（空なら未設定） */
  oauthClientId: string;
  /** ビルド時の VITE_GOOGLE_CLIENT_ID 由来なら true（ブラウザ保存の削除は無効） */
  oauthFromEnv: boolean;
  onOAuthClientIdSaved: (id: string) => void;
  onOAuthClientIdCleared: () => void;
}

export default function SheetsSyncModal({
  open,
  onClose,
  records,
  onRecordsChange,
  oauthClientId,
  oauthFromEnv,
  onOAuthClientIdSaved,
  onOAuthClientIdCleared,
}: Props) {
  if (!open) return null;
  if (!oauthClientId) {
    return (
      <SheetsSyncClientSetup
        onClose={onClose}
        onOAuthClientIdSaved={onOAuthClientIdSaved}
      />
    );
  }
  return (
    <SheetsSyncWithOAuth
      oauthClientId={oauthClientId}
      onClose={onClose}
      records={records}
      onRecordsChange={onRecordsChange}
      oauthFromEnv={oauthFromEnv}
      onOAuthClientIdCleared={onOAuthClientIdCleared}
    />
  );
}

function SheetsSyncClientSetup({
  onClose,
  onOAuthClientIdSaved,
}: {
  onClose: () => void;
  onOAuthClientIdSaved: (id: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const origin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'http://localhost:5173';

  function handleSave() {
    const t = draft.trim();
    if (!t || !t.includes('.apps.googleusercontent.com')) {
      setErr('OAuth 2.0 クライアント ID（…apps.googleusercontent.com）を貼り付けてください。');
      return;
    }
    setErr(null);
    onOAuthClientIdSaved(t);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal sheets-sync-modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <span>スプレッドシート連携の準備</span>
          <button type="button" className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          <p className="sheets-sync-lead">
            本アプリは、入力されたデータを外部サーバーへ送信しない「安心設計」です。
            データや認証情報はすべてお使いのブラウザ内（localStorage）のみに保存されます。
          </p>
          <p className="sheets-sync-note">
            連携機能を利用するには、ご自身専用の「Google クライアントID」が必要です。
          </p>

          <details className="sheets-sync-details">
            <summary className="sheets-sync-details__summary">手順を詳しく見る</summary>
            <div className="sheets-sync-details__inner">
              <ol className="sheets-sync-steps sheets-sync-steps--in-details">
                <li>
                  <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Google Cloud Console</a>
                  にアクセスし、プロジェクトを 1 つ作成します。プロジェクト名は任意で、組織は「なし」のままで構いません。
                </li>
                <li>
                  画面最上部の検索バーに「<strong>Google Sheets API</strong>」と入力して検索し、表示された API を「<strong>有効化</strong>」します。
                </li>
                <li>
                  同様に「<strong>Google Drive API</strong>」を検索し「<strong>有効化</strong>」します（連携画面で Drive からスプレッドシートを選ぶために必要です）。
                </li>
                <li>
                  左メニューの「<strong>認証情報</strong>」を開き、画面上部の黄色い枠の［<strong>同意画面を構成</strong>］を押し、案内に従い「<strong>開始</strong>」を押します。
                  <p className="sheets-sync-details__lead">OAuth 同意画面のウィザードの目安です（画面は変わることがあります）。</p>
                  <ol className="sheets-sync-substeps">
                    <li>
                      <strong>① ユーザーの種類</strong>：「<strong>外部</strong>」→「<strong>作成</strong>」。
                    </li>
                    <li>
                      <strong>② アプリ情報</strong>：アプリ名は任意。ユーザーサポートとデベロッパー連絡先に Gmail →「<strong>保存して次へ</strong>」。
                    </li>
                    <li>
                      <strong>③ スコープ</strong>：追加せず「<strong>保存して次へ</strong>」。
                      <p className="sheets-sync-note muted sheets-sync-substep-note">
                        Sheets / Drive / メール表示などは、「Google でログイン」時にまとめて同意されます。
                      </p>
                    </li>
                    <li>
                      <strong>④ テストユーザー</strong>：自身の Gmail を追加 →「<strong>保存して次へ</strong>」（テスト公開のとき）。
                    </li>
                    <li>
                      <strong>⑤ 概要</strong>：確認し、ポリシー同意があればチェック →「<strong>作成</strong>」または「<strong>ダッシュボードに戻る</strong>」。
                    </li>
                  </ol>
                </li>
                <li>
                  再度「<strong>認証情報</strong>」から「<strong>OAuth クライアント ID</strong>」を作成します（種類は
                  <strong>ウェブアプリケーション</strong>）。
                </li>
                <li>
                  「<strong>承認済みの JavaScript 生成元</strong>」に、このページの URL{' '}
                  <code className="sheets-sync-origin-code">{origin}</code>
                  を登録します。
                </li>
                <li>
                  発行された「<strong>クライアント ID</strong>」をコピーし、下の欄に貼り付けて「<strong>保存して続ける</strong>」を押します。
                </li>
              </ol>
            </div>
          </details>
          <label className="sheets-sync-label">
            OAuth 2.0 クライアント ID
            <input
              className="sheets-sync-input"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="123456789-xxxx.apps.googleusercontent.com"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {err && <p className="sheets-sync-error">{err}</p>}
        </div>
        <div className="delete-modal__footer">
          <button type="button" className="btn-cancel" onClick={onClose}>閉じる</button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            保存して続ける
          </button>
        </div>
      </div>
    </div>
  );
}

function shortenSpreadsheetId(id: string): string {
  if (!id) return '';
  if (id.length <= 24) return id;
  return `${id.slice(0, 12)}…${id.slice(-8)}`;
}

function defaultNewSpreadsheetTitle(): string {
  return `仕事記録_${new Date().toISOString().slice(0, 10)}`;
}

function SheetsSyncWithOAuth({
  oauthClientId,
  onClose,
  records,
  onRecordsChange,
  oauthFromEnv,
  onOAuthClientIdCleared,
}: Omit<Props, 'open' | 'onOAuthClientIdSaved'> & {
  oauthFromEnv: boolean;
  onOAuthClientIdCleared: () => void;
}) {
  const [sheetInput, setSheetInput] = useState(() => getStoredSpreadsheetId());
  const [sheetNameHint, setSheetNameHint] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(() => readGoogleAccessSession(oauthClientId)?.accessToken ?? null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(
    () => readGoogleAccessSession(oauthClientId)?.expiresAtMs ?? null
  );
  const [userEmail, setUserEmail] = useState<string | null>(() => readGoogleAccessSession(oauthClientId)?.userEmail ?? null);
  const [busy, setBusy] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveSpreadsheetItem[]>([]);
  const [driveNext, setDriveNext] = useState<string | undefined>(undefined);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveErr, setDriveErr] = useState<string | null>(null);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [createSheetTitle, setCreateSheetTitle] = useState('');
  const [createSheetErr, setCreateSheetErr] = useState<string | null>(null);

  function forceGoogleRelogin(message: string) {
    googleLogout();
    clearGoogleAccessSession();
    setToken(null);
    setTokenExpiresAt(null);
    setUserEmail(null);
    setDriveOpen(false);
    setDriveFiles([]);
    setDriveNext(undefined);
    setDriveErr(null);
    setCreateSheetOpen(false);
    setCreateSheetErr(null);
    setErr(message);
  }

  function formatSheetsError(e: unknown): string {
    const msg = e instanceof Error ? e.message : String(e);
    if (/^401\b/.test(msg)) {
      return '__401__';
    }
    if (/^403\b/.test(msg)) {
      return 'アクセスが拒否されました。スプレッドシートの共有（自分に閲覧または編集権限）を確認してください。';
    }
    if (/Unable to parse range|not found|NOT_FOUND|Requested entity was not found/i.test(msg)) {
      return 'シートまたは範囲が見つかりません。ブック ID とタブ名（取り込み時は「WorkRecords」が無いと先頭タブを読みます）を確認してください。';
    }
    return msg.length > 280 ? `${msg.slice(0, 280)}…` : msg;
  }

  useEffect(() => {
    if (!token || userEmail) return;
    let cancelled = false;
    void (async () => {
      const email = await fetchGoogleUserEmail(token);
      if (cancelled || !email) return;
      setUserEmail(email);
      const ses = readGoogleAccessSession(oauthClientId);
      if (ses?.accessToken === token) {
        const secLeft = Math.max(120, Math.floor((ses.expiresAtMs - Date.now()) / 1000));
        saveGoogleAccessSession(oauthClientId, token, secLeft, email);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, userEmail, oauthClientId]);

  const login = useGoogleLogin({
    scope: SHEETS_OAUTH_SCOPES,
    onSuccess: res => {
      setToken(res.access_token);
      const expMs = Date.now() + (res.expires_in ?? 3600) * 1000;
      setTokenExpiresAt(expMs);
      setErr(null);
      setStatus('Google にログインしました。');
      void (async () => {
        const email = await fetchGoogleUserEmail(res.access_token);
        saveGoogleAccessSession(oauthClientId, res.access_token, res.expires_in ?? 3600, email);
        setUserEmail(email ?? null);
      })();
    },
    onError: () => setErr('ログインに失敗しました。もう一度お試しください。'),
    onNonOAuthError: e => {
      if (e.type === 'popup_closed') {
        setErr('ログイン画面を閉じました。もう一度「Google でログイン」を押してください。');
      } else if (e.type === 'popup_failed_to_open') {
        setErr('ポップアップを開けませんでした。ブラウザでこのサイトのポップアップを許可してから、もう一度お試しください。');
      } else {
        setErr('ログインを開始できませんでした。別タブでブロックされていないか確認してください。');
      }
    },
  });

  async function fetchDrivePage(accessToken: string, replace: boolean, pageToken?: string) {
    setDriveLoading(true);
    setDriveErr(null);
    try {
      const { files, nextPageToken } = await listUserSpreadsheets(accessToken, pageToken);
      setDriveFiles(prev => (replace ? files : [...prev, ...files]));
      setDriveNext(nextPageToken);
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      if (/^401\b/.test(raw)) {
        forceGoogleRelogin('ログインの有効期限が切れました。もう一度「Google でログイン」してください。');
      } else if (/^403\b/.test(raw)) {
        setDriveErr(
          '一覧を取得できませんでした。Google Cloud で Google Drive API を有効にし、一度ログアウトしてから再度ログインし、追加の権限に同意してください。',
        );
      } else {
        setDriveErr(raw.length > 400 ? `${raw.slice(0, 400)}…` : raw);
      }
    } finally {
      setDriveLoading(false);
    }
  }

  function closeDrivePicker() {
    setDriveOpen(false);
  }

  async function openDrivePicker() {
    if (!token) return;
    setDriveOpen(true);
    setDriveErr(null);
    setDriveFiles([]);
    setDriveNext(undefined);
    await fetchDrivePage(token, true);
  }

  async function pullRecordsFromChosenDriveFile(file: DriveSpreadsheetItem) {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      const { records: next, sheetTab, usedFallbackTab } = await pullWorkRecords(token, file.id);
      setStoredSpreadsheetId(file.id);
      setSheetInput(file.id);
      setSheetNameHint(file.name);
      if (next.length === 0) {
        const emptyDetail = usedFallbackTab
          ? `タブ「${sheetTab}」を読みましたが、取り込めた記録は 0 件です（「WorkRecords」が無いため先頭のタブを使いました）。このブラウザの記録は変更していません。1行目が id / startAt / endAt / memo か、日時が解釈できる形式か確認してください。`
          : `タブ「${sheetTab}」を読みましたが、取り込めた記録は 0 件です。このブラウザの記録は変更していません。2行目以降にデータがあり、日時が ISO 形式（例: 2024-05-01T09:00:00.000Z）か確認してください。`;
        setStatus(`${emptyDetail} 保存先は「${file.name}」に設定しました。`);
        return;
      }
      saveRecords(next);
      onRecordsChange(next);
      const hint = usedFallbackTab ? '（「WorkRecords」が無いため先頭タブを読みました）' : '';
      setStatus(
        `「${file.name}」を保存先に設定し、タブ「${sheetTab}」から ${next.length} 件をこのブラウザに取り込みました。${hint}`
      );
    } catch (e) {
      const f = formatSheetsError(e);
      if (f === '__401__') {
        forceGoogleRelogin('ログインの有効期限が切れました。もう一度「Google でログイン」してください。');
      } else {
        setErr(f);
      }
    } finally {
      setBusy(false);
    }
  }

  async function pickDriveSheet(file: DriveSpreadsheetItem) {
    if (!token || busy) return;
    closeDrivePicker();
    await pullRecordsFromChosenDriveFile(file);
  }

  function openCreateSheetModal() {
    if (!token) {
      setErr('先に「Google でログイン」を押してください');
      return;
    }
    setCreateSheetTitle(defaultNewSpreadsheetTitle());
    setCreateSheetErr(null);
    setCreateSheetOpen(true);
  }

  function closeCreateSheetModal() {
    if (busy) return;
    setCreateSheetOpen(false);
    setCreateSheetErr(null);
  }

  async function submitCreateSpreadsheet() {
    if (!token) return;
    setBusy(true);
    setCreateSheetErr(null);
    try {
      const raw = createSheetTitle.trim();
      const title = raw.slice(0, 200) || defaultNewSpreadsheetTitle();
      const id = await createSpreadsheet(token, title);
      setStoredSpreadsheetId(id);
      setSheetInput(id);
      setSheetNameHint(title);
      await pushWorkRecords(
        token,
        id,
        records.map(r => ({ id: r.id, startAt: r.startAt, endAt: r.endAt, memo: r.memo }))
      );
      setCreateSheetOpen(false);
      setStatus('新しいスプレッドシートを作成し、現在の記録をシートに保存しました。');
    } catch (e) {
      const f = formatSheetsError(e);
      if (f === '__401__') {
        forceGoogleRelogin('ログインの有効期限が切れました。もう一度「Google でログイン」してください。');
      } else {
        setCreateSheetErr(f);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handlePush() {
    if (!token) {
      setErr('先にログインしてください');
      return;
    }
    const id = extractSpreadsheetId(sheetInput) ?? getStoredSpreadsheetId();
    if (!id) {
      setErr('「📁 Drive から選ぶ」でシートを選ぶか、「➕ 新規作成して保存」を使ってください');
      return;
    }
    setStoredSpreadsheetId(id);
    setBusy(true);
    setErr(null);
    try {
      await pushWorkRecords(token, id, records.map(r => ({ id: r.id, startAt: r.startAt, endAt: r.endAt, memo: r.memo })));
      setStatus(`スプレッドシートに ${records.length} 件を保存しました（WorkRecords タブの同じ範囲を上書き）。`);
    } catch (e) {
      const f = formatSheetsError(e);
      if (f === '__401__') {
        forceGoogleRelogin('ログインの有効期限が切れました。もう一度「Google でログイン」してください。');
      } else {
        setErr(f);
      }
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    googleLogout();
    clearGoogleAccessSession();
    setToken(null);
    setTokenExpiresAt(null);
    setUserEmail(null);
    setDriveOpen(false);
    setDriveFiles([]);
    setDriveNext(undefined);
    setDriveErr(null);
    setCreateSheetOpen(false);
    setCreateSheetErr(null);
    setStatus('ログアウトしました');
  }

  return (
    <>
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal sheets-sync-modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <span>📊 スプレッドシート連携</span>
          <button type="button" className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          <section className="sheets-sync-auth" aria-label="ログイン状態">
            <div className="sheets-sync-auth__line">
              ログイン状態:{' '}
              {!token ? (
                <span className="sheets-sync-auth__value">未ログイン</span>
              ) : userEmail ? (
                <span className="sheets-sync-auth__value">{userEmail}</span>
              ) : (
                <span className="sheets-sync-auth__value sheets-sync-auth__value--muted">ログイン済み</span>
              )}
            </div>
            <div className={`sheets-sync-auth__row${!token ? ' sheets-sync-auth__row--guest' : ''}`}>
              {token && tokenExpiresAt ? (
                <span className="sheets-sync-auth__expiry">
                  有効期限:{' '}
                  {new Date(tokenExpiresAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  まで
                </span>
              ) : null}
              {!token ? (
                <button type="button" className="btn-primary" onClick={() => login()} disabled={busy}>
                  Google でログイン
                </button>
              ) : (
                <button type="button" className="btn-cancel" onClick={handleLogout} disabled={busy}>
                  ログアウト
                </button>
              )}
            </div>
          </section>

          <hr className="sheets-sync-divider" />

          <section className="sheets-sync-section" aria-labelledby="sheets-sync-pick-heading">
            <h3 id="sheets-sync-pick-heading" className="sheets-sync-section-title">
              【スプレッドシートを選ぶ】
            </h3>

            <div className="sheets-sync-current-sheet">
              <span className="sheets-sync-current-sheet__label">選択中:</span>
              <div className="sheets-sync-current-sheet__value">
                {sheetNameHint ? (
                  <>
                    <strong>{sheetNameHint}</strong>
                    <span className="sheets-sync-current-sheet__id">{shortenSpreadsheetId(sheetInput)}</span>
                  </>
                ) : sheetInput ? (
                  <code className="sheets-sync-origin-code">{sheetInput}</code>
                ) : (
                  <span className="sheets-sync-current-sheet__empty">まだありません</span>
                )}
              </div>
            </div>

            <div className="sheets-sync-row sheets-sync-row--stack sheets-sync-row--actions">
              <button
                type="button"
                className="btn-primary sheets-sync-btn-block sheets-sync-btn--drive"
                onClick={() => void openDrivePicker()}
                disabled={busy || !token || driveLoading}
              >
                📁 Drive から選ぶ
              </button>
              <button
                type="button"
                className="btn-nav sheets-sync-btn-block sheets-sync-btn--create"
                onClick={openCreateSheetModal}
                disabled={busy || !token}
              >
                ➕ 新規作成して保存
              </button>
            </div>

            {driveOpen && (
              <div className="sheets-sync-drive-panel" role="dialog" aria-label="スプレッドシート一覧">
                <div className="sheets-sync-drive-panel__head">
                  <span className="sheets-sync-drive-panel__title">保存先を選ぶ（タップで取り込み）</span>
                  <button
                    type="button"
                    className="modal__close"
                    aria-label="閉じる"
                    disabled={driveLoading}
                    onClick={closeDrivePicker}
                  >
                    ✕
                  </button>
                </div>
                {driveErr && <p className="sheets-sync-error">{driveErr}</p>}
                {driveLoading && driveFiles.length === 0 && !driveErr && (
                  <p className="sheets-sync-note muted">一覧を読み込み中…</p>
                )}
                {!driveLoading && driveFiles.length === 0 && !driveErr && (
                  <p className="sheets-sync-note muted">スプレッドシートが見つかりませんでした。</p>
                )}
                <ul className="sheets-sync-drive-list">
                  {driveFiles.map(f => (
                    <li key={f.id}>
                      <button
                        type="button"
                        className="sheets-sync-drive-item"
                        onClick={() => void pickDriveSheet(f)}
                        disabled={busy || driveLoading}
                      >
                        <span className="sheets-sync-drive-item__name">{f.name}</span>
                        <span className="sheets-sync-drive-item__id">{shortenSpreadsheetId(f.id)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {driveNext ? (
                  <div className="sheets-sync-row">
                    <button
                      type="button"
                      className="btn-nav"
                      disabled={driveLoading || !token}
                      onClick={() => token && void fetchDrivePage(token, false, driveNext)}
                    >
                      さらに読み込む
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            <div className="sheets-sync-push-save">
              <div className="sheets-sync-row sheets-sync-row--stack sheets-sync-row--actions">
                <button
                  type="button"
                  className="btn-primary sheets-sync-btn-block sheets-sync-btn--push"
                  onClick={handlePush}
                  disabled={busy || !token}
                >
                  💾 上書き保存
                </button>
              </div>
            </div>

          </section>

          {status && <p className="sheets-sync-status">{status}</p>}
          {err && <p className="sheets-sync-error">{err}</p>}

          <div className="sheets-sync-help-foot" aria-label="補足説明">
            {!oauthFromEnv && (
              <p className="sheets-sync-note muted">
                クライアント ID はこのブラウザの localStorage に保存されています。この静的サイト側には送信されません。
              </p>
            )}

            <p className="sheets-sync-note muted">※ アーカイブは今のところブラウザ内のみです（シートには出しません）。</p>
          </div>

          {!oauthFromEnv && (
            <div className="sheets-sync-row sheets-sync-row--footer">
              <button
                type="button"
                className="btn-cancel btn-cancel--subtle"
                disabled={busy}
                onClick={() => {
                  if (confirm('ブラウザに保存したクライアント ID を削除しますか？シート連携の設定画面に戻ります。')) {
                    onOAuthClientIdCleared();
                    onClose();
                  }
                }}
              >
                クライアント ID をこのブラウザから削除
              </button>
            </div>
          )}
        </div>
        <div className="delete-modal__footer">
          <button type="button" className="btn-cancel" onClick={onClose} disabled={busy}>閉じる</button>
        </div>
      </div>
    </div>

    {createSheetOpen ? (
      <div
        className="modal-backdrop sheets-sync-create-backdrop"
        onClick={closeCreateSheetModal}
        role="presentation"
      >
        <div
          className="modal sheets-sync-create-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sheets-sync-create-heading"
          onClick={e => e.stopPropagation()}
        >
          <div className="modal__header">
            <span id="sheets-sync-create-heading">新しいスプレッドシート</span>
            <button type="button" className="modal__close" onClick={closeCreateSheetModal} disabled={busy} aria-label="閉じる">
              ✕
            </button>
          </div>
          <div className="modal__body">
            <label className="sheets-sync-label">
              新規ブックの名前（作成時のファイル名）
              <input
                className="sheets-sync-input"
                value={createSheetTitle}
                onChange={e => setCreateSheetTitle(e.target.value)}
                placeholder="例: 仕事記録_営業日報"
                disabled={busy}
                maxLength={200}
                spellCheck={false}
                autoFocus
              />
            </label>
            <p className="sheets-sync-note muted sheets-sync-note--tight">
              空欄のまま作成すると、その時点の日付で「仕事記録_YYYY-MM-DD」になります。
            </p>
            {createSheetErr ? <p className="sheets-sync-error">{createSheetErr}</p> : null}
          </div>
          <div className="delete-modal__footer">
            <button type="button" className="btn-cancel" onClick={closeCreateSheetModal} disabled={busy}>
              キャンセル
            </button>
            <button type="button" className="btn-primary" onClick={() => void submitCreateSpreadsheet()} disabled={busy}>
              作成して保存
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
