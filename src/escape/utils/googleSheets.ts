import type { WorkRecord } from '../types';
import { clampRecordsForSave, parseWorkRecordsArray } from './recordValidation';

const SHEET_TAB = 'WorkRecords';
const HEADER = ['id', 'startAt', 'endAt', 'memo'] as const;

/** 日付セルが数値（シリアル日）で返るときの変換（Excel / Google 互換の通算日近似） */
function sheetSerialToIsoApprox(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  // 1899-12-30 基準の通算日 → UTC（時刻は 00:00 UTC 付近）
  const epochMs = Date.UTC(1899, 11, 30) + Math.round(serial * 86400000);
  const d = new Date(epochMs);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizeImportedCell(v: unknown, asDate: boolean): string {
  if (v == null || v === '') return '';
  if (typeof v === 'number' && asDate) {
    const iso = sheetSerialToIsoApprox(v);
    if (iso) return iso;
  }
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v).trim();
}

type TabMode = 'pull' | 'push';

/** 記録用タブ名を決める。pull は WorkRecords が無ければ先頭タブにフォールバック。push は WorkRecords 必須。 */
async function resolveRecordsSheetTab(
  accessToken: string,
  spreadsheetId: string,
  mode: TabMode
): Promise<{ title: string; usedFallback: boolean }> {
  const data = await api<{ sheets?: { properties?: { title?: string } }[] }>(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`
  );
  const titles = (data.sheets ?? [])
    .map(s => s.properties?.title?.trim())
    .filter((t): t is string => Boolean(t));
  if (titles.length === 0) {
    throw new Error('スプレッドシート内にタブがありません。');
  }
  if (titles.includes(SHEET_TAB)) {
    return { title: SHEET_TAB, usedFallback: false };
  }
  const ci = titles.find(t => t.toLowerCase() === SHEET_TAB.toLowerCase());
  if (ci) {
    return { title: ci, usedFallback: false };
  }
  if (mode === 'push') {
    throw new Error(
      `タブ「${SHEET_TAB}」がありません。「新規スプレッドシートを作成して保存」で作るか、既存ブックに「${SHEET_TAB}」という名前のタブを追加してください。`
    );
  }
  return { title: titles[0], usedFallback: true };
}

const LS_SPREADSHEET_ID = 'sheets_sync_spreadsheet_id';
const LS_OAUTH_CLIENT_ID = 'sheets_sync_oauth_client_id';
/** タブを閉じるまで有効な Google アクセストークン（モーダルを開閉しても維持） */
const SS_GOOGLE_ACCESS = 'sheets_sync_google_access_v1';

export interface StoredGoogleAccessSession {
  oauthClientId: string;
  accessToken: string;
  /** この時刻を過ぎたら無効（サーバー期限より少し早め） */
  expiresAtMs: number;
  /** userinfo（要メール用スコープ）。無い場合は再ログインで取得されます */
  userEmail?: string;
}

export function saveGoogleAccessSession(
  oauthClientId: string,
  accessToken: string,
  expiresInSec: number,
  userEmail?: string
): void {
  const cid = oauthClientId.trim();
  if (!cid || !accessToken) return;
  try {
    const skewSec = Math.min(120, Math.max(30, Math.floor(expiresInSec / 10)));
    const expiresAtMs = Date.now() + Math.max(60_000, (expiresInSec - skewSec) * 1000);
    let emailToStore = userEmail?.trim();
    if (!emailToStore) {
      try {
        const rawPrev = sessionStorage.getItem(SS_GOOGLE_ACCESS);
        if (rawPrev) {
          const prev = JSON.parse(rawPrev) as StoredGoogleAccessSession;
          if (prev?.oauthClientId === cid && prev?.accessToken === accessToken && prev?.userEmail) {
            emailToStore = prev.userEmail;
          }
        }
      } catch {
        /* ignore */
      }
    }
    const payload: StoredGoogleAccessSession = { oauthClientId: cid, accessToken, expiresAtMs };
    if (emailToStore) payload.userEmail = emailToStore;
    sessionStorage.setItem(SS_GOOGLE_ACCESS, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

/** アクセストークンでログイン中ユーザーのメールを取得（userinfo.email スコープが付いているときのみ） */
export async function fetchGoogleUserEmail(accessToken: string): Promise<string | undefined> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { email?: string };
    const em = data.email?.trim();
    return em || undefined;
  } catch {
    return undefined;
  }
}

export function readGoogleAccessSession(oauthClientId: string): StoredGoogleAccessSession | null {
  const cid = oauthClientId.trim();
  if (!cid) return null;
  try {
    const raw = sessionStorage.getItem(SS_GOOGLE_ACCESS);
    if (!raw) return null;
    const o = JSON.parse(raw) as StoredGoogleAccessSession;
    if (!o?.accessToken || typeof o.expiresAtMs !== 'number') {
      sessionStorage.removeItem(SS_GOOGLE_ACCESS);
      return null;
    }
    if (o.oauthClientId !== cid) return null;
    if (Date.now() >= o.expiresAtMs) {
      sessionStorage.removeItem(SS_GOOGLE_ACCESS);
      return null;
    }
    return o;
  } catch {
    return null;
  }
}

export function clearGoogleAccessSession(): void {
  try {
    sessionStorage.removeItem(SS_GOOGLE_ACCESS);
  } catch {
    /* ignore */
  }
}

/** ビルド時の環境変数があれば最優先（開発用）。なければ各ユーザーのブラウザ localStorage のみ。 */
export function getEffectiveOAuthClientId(): string {
  const env = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '';
  if (env) return env;
  try {
    return localStorage.getItem(LS_OAUTH_CLIENT_ID)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function getStoredOAuthClientId(): string {
  try {
    return localStorage.getItem(LS_OAUTH_CLIENT_ID)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function setStoredOAuthClientId(id: string): void {
  const t = id.trim();
  try {
    if (t) localStorage.setItem(LS_OAUTH_CLIENT_ID, t);
    else localStorage.removeItem(LS_OAUTH_CLIENT_ID);
  } catch {
    /* ignore */
  }
}

export function clearStoredOAuthClientId(): void {
  try {
    localStorage.removeItem(LS_OAUTH_CLIENT_ID);
  } catch {
    /* ignore */
  }
}

export function getStoredSpreadsheetId(): string {
  return localStorage.getItem(LS_SPREADSHEET_ID) ?? '';
}

export function setStoredSpreadsheetId(id: string): void {
  if (id) localStorage.setItem(LS_SPREADSHEET_ID, id);
  else localStorage.removeItem(LS_SPREADSHEET_ID);
}

export function clearStoredSpreadsheetId(): void {
  try {
    localStorage.removeItem(LS_SPREADSHEET_ID);
  } catch {
    /* ignore */
  }
}

/** OAuth ログイン時に要求するスコープ（Sheets + Drive 一覧 + メール表示用 userinfo） */
export const SHEETS_OAUTH_SCOPES =
  'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.metadata.readonly';

export interface DriveSpreadsheetItem {
  id: string;
  name: string;
}

/** Drive API で、ユーザーのスプレッドシート一覧を取得（ピッカー用） */
export async function listUserSpreadsheets(
  accessToken: string,
  pageToken?: string
): Promise<{ files: DriveSpreadsheetItem[]; nextPageToken?: string }> {
  const params = new URLSearchParams({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    fields: 'nextPageToken,files(id,name)',
    pageSize: '50',
    orderBy: 'modifiedTime desc',
  });
  if (pageToken) params.set('pageToken', pageToken);
  const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    files?: { id?: string; name?: string }[];
    nextPageToken?: string;
  };
  const files: DriveSpreadsheetItem[] = [];
  for (const f of data.files ?? []) {
    if (f.id && f.name) files.push({ id: f.id, name: f.name });
  }
  return { files, nextPageToken: data.nextPageToken };
}

/** URL または ID 文字列からスプレッドシート ID を取り出す */
export function extractSpreadsheetId(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const m = t.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]+$/.test(t) && t.length >= 20) return t;
  return null;
}

async function api<T>(accessToken: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text.slice(0, 400)}`);
  }
  return res.json() as Promise<T>;
}

/** 空のブックを作成し、WorkRecords シートを用意する */
export async function createSpreadsheet(accessToken: string, title: string): Promise<string> {
  const data = await api<{ spreadsheetId: string }>(accessToken, 'https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: SHEET_TAB } }],
    }),
  });
  return data.spreadsheetId;
}

export interface WorkRecordRow {
  id: string;
  startAt: string;
  endAt: string;
  memo: string;
}

/** 1行目ヘッダー + データをまとめて書き込み（上書き） */
export async function pushWorkRecords(
  accessToken: string,
  spreadsheetId: string,
  rows: WorkRecordRow[]
): Promise<void> {
  const { title: tabTitle } = await resolveRecordsSheetTab(accessToken, spreadsheetId, 'push');
  const safe = clampRecordsForSave(rows.map(r => ({ ...r, memo: r.memo ?? '' })));
  const values: string[][] = [Array.from(HEADER), ...safe.map(r => [r.id, r.startAt, r.endAt, r.memo])];
  const quotedTab = `'${tabTitle.replace(/'/g, "''")}'`;
  const range = `${quotedTab}!A1:D${values.length}`;
  const enc = encodeURIComponent(range);
  await api(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${enc}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
    }
  );
}

export interface PullWorkRecordsResult {
  records: WorkRecord[];
  /** 実際に読んだタブ名 */
  sheetTab: string;
  /** WorkRecords ではなく先頭タブにフォールバックしたか */
  usedFallbackTab: boolean;
}

/** 2行目以降を読み込み（1行目はヘッダ想定）。日付セルが数値でも取り込みを試みます。 */
export async function pullWorkRecords(
  accessToken: string,
  spreadsheetId: string
): Promise<PullWorkRecordsResult> {
  const { title: tabTitle, usedFallback } = await resolveRecordsSheetTab(accessToken, spreadsheetId, 'pull');
  const quotedTab = `'${tabTitle.replace(/'/g, "''")}'`;
  const range = `${quotedTab}!A2:D50000`;
  const enc = encodeURIComponent(range);
  const data = await api<{ values?: unknown[][] }>(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${enc}`
  );
  const values = data.values ?? [];
  const rawObjects: unknown[] = [];
  for (const row of values) {
    if (!Array.isArray(row) || row.length < 3) continue;
    // API は末尾の空セルを省略するため、4列未満でも id / startAt / endAt が揃えば取り込む
    const id = normalizeImportedCell(row[0], false);
    const startAt = normalizeImportedCell(row[1], true);
    const endAt = normalizeImportedCell(row[2], true);
    const memo = normalizeImportedCell(row[3], false);
    if (!id || !startAt || !endAt) continue;
    rawObjects.push({ id, startAt, endAt, memo });
  }
  const records = parseWorkRecordsArray(rawObjects);
  return { records, sheetTab: tabTitle, usedFallbackTab: usedFallback };
}
