@AGENTS.md

# next-i-reporter プロジェクトルール

## 技術スタック
- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS (スタイリング)
- OpenAI API (AI分析)
- Node.js 22+ (テストランナー内蔵)

## テスト
- `npm test` で全テスト実行
- テストファイル: `src/lib/**/*.test.ts`
- Node.js 組み込みテストランナー (`node:test` + `node:assert`)
- UIコンポーネントのロジックは `src/lib/` に純粋関数として抽出してテスト

## コーディング規約
- UIテキストは日本語
- コンポーネントは `src/components/` に配置
- ビジネスロジックは `src/lib/` に配置
- APIルートは `src/app/api/` に配置
- 型定義は `src/lib/form-structure.ts` に集約

## ドキュメント
- 利用者向けドキュメント: `docs/` (VitePress)
- 機能追加・変更時は対応するドキュメントページも更新すること
- `npm run docs:dev` でプレビュー、`npm run docs:build` でビルド
- スクリーンショットは Playwright MCP で自動取得し `docs/public/screenshots/` に配置
