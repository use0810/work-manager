# escape / 退避フォルダ

配布版（OSS／自家配布）では未使用にした機能を、復活させやすい形で残しておく置き場です。

## いまここにあるもの

- `components/SheetsSyncModal.tsx` … 旧「📊 シート連携」モーダル
- `utils/googleSheets.ts` … Google Sheets / Drive / OAuth クライアントID 管理ユーティリティ

## ビルドからの除外

`tsconfig.app.json` の `exclude` で `src/escape` を対象外にしています。
さらに `App.tsx` 側からは一切 import していないため、Vite の本番ビルドにもバンドルされません。

## 復活させたいとき

1. ファイルを元の場所に戻す
   - `components/SheetsSyncModal.tsx` → `src/components/SheetsSyncModal.tsx`
   - `utils/googleSheets.ts` → `src/utils/googleSheets.ts`
   - 各ファイル先頭の `// @ts-nocheck — 退避フォルダ。...` 2 行コメントを削除
2. `tsconfig.app.json` の `exclude` から `src/escape` を外す（フォルダごと消すならこの行も削除）
3. `App.tsx` で `SheetsSyncModal` を import し直す
4. `@react-oauth/google` の依存が必要（`package.json` に残してあります）
5. `.env.local` の `VITE_GOOGLE_CLIENT_ID` を設定すると、ビルド時から有効化されます

> 凍結中のファイルは `// @ts-nocheck` を付けて IDE 解析からも外しています。`'../types'` 等の相対パスは元の場所前提のままなので、復元時に動作確認すれば問題なく通ります。
