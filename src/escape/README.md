# escape / 退避フォルダ

配布版（OSS／自家配布）では未使用にした機能を、復活させやすい形で残しておく置き場です。

## いまここにあるもの

- `components/SheetsSyncModal.tsx` … 旧「📊 シート連携」モーダル
- `utils/googleSheets.ts` … Google Sheets / Drive / OAuth クライアントID 管理ユーティリティ

## ビルドからの除外

`tsconfig.app.json` の `exclude` で `src/escape` を対象外にしています。
さらに `App.tsx` 側からは一切 import していないため、Vite の本番ビルドにもバンドルされません。

## 復活させたいとき

1. `tsconfig.app.json` の `exclude` から `src/escape` を外す
2. `App.tsx` で `src/escape/components/SheetsSyncModal` を import し直す
3. `@react-oauth/google` の依存が必要（`package.json` に残してあります）
4. `.env.local` の `VITE_GOOGLE_CLIENT_ID` を設定すると、ビルド時から有効化されます

> 移設の際に相対 import が壊れている場合は、`../types` / `../../utils/storage` などへの相対パスを修正してください。
