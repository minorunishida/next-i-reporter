# Next i-Reporter

AI 駆動の Excel to ConMas i-Reporter XML 変換ツール。Excel 帳票ファイルをアップロードすると、AI がセル構造を解析してクラスター（入力項目）を自動検出し、i-Reporter Designer 互換の XML 定義ファイルを生成します。

## アーキテクチャ

```
Excel (.xlsx)
    |
    v
[excel-parser] --- FormStructure (中間表現)
    |                    |
    v                    v
[excel-to-pdf]    [ai-analyzer] --- OpenAI GPT
    |                    |
    v                    v
  PDF (背景)      ClusterDefinition[]
    |                    |
    +--------------------+
    |
    v
[xml-generator] --- ConMas XML
```

### 主要モジュール

| モジュール | 役割 |
|---|---|
| `src/lib/excel-parser.ts` | Excel ファイルを解析し FormStructure に変換 |
| `src/lib/excel-to-pdf.ts` | Excel を PDF に変換（eprint CLI / Graph API） |
| `src/lib/ai-analyzer.ts` | AI でセルをクラスターに分類 |
| `src/lib/smart-defaults.ts` | クラスター名・型に基づくパラメータ自動設定 |
| `src/lib/xml-generator.ts` | AnalysisResult から ConMas XML を生成 |
| `src/lib/print-coord-mapper.ts` | Excel px 座標 → PDF 0-1 正規化座標の変換 |
| `src/lib/dimension-corrector.ts` | printMeta による列幅・行高さの補正 |
| `src/lib/overlap-utils.ts` | クラスターの重複検出・除去 |
| `src/lib/xml-validator.ts` | ConMas XML の構造検証 |

## セットアップ

### 前提条件

- Node.js 22+
- OpenAI API キー

### インストール

```bash
npm install
```

### 環境変数

`.env.local` に以下を設定:

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.1    # オプション（デフォルト: gpt-5.1）
```

### 開発サーバー

```bash
npm run dev
```

http://localhost:3000 でアプリにアクセスできます。

## CLI

XML テンプレートの検査・検証・比較ができます。

```bash
# テンプレート構造の確認
npm run cli -- inspect-template fixtures/xml/minimal-valid.xml

# テンプレートの検証
npm run cli -- validate-template fixtures/xml/minimal-valid.xml

# 2つのテンプレートの比較
npm run cli -- diff-template fixtures/xml/minimal-valid.xml fixtures/xml/minimal-variant.xml
```

## テスト

Node.js 組み込みテストランナーを使用しています。

```bash
# 全テスト実行
npm test

# CLI 関連テストのみ
npm run test:cli
```

### テストファイル構成

| テストファイル | 対象 |
|---|---|
| `smart-defaults.test.ts` | スマートデフォルト（キーワードマッチ、パラメータ生成） |
| `conmas-cluster-types.test.ts` | クラスタータイプマッピング |
| `overlap-utils.test.ts` | 矩形重複検出・クラスター重複除去 |
| `xml-generator.test.ts` | XML エスケープ、全角変換、PDF 生成、XML 構造 |
| `print-coord-mapper.test.ts` | 線形補間、座標変換、PDF コンテンツ領域計算 |
| `excel-parser.test.ts` | 累積和、マージマップ、スタイル抽出、ページ設定 |
| `dimension-corrector.test.ts` | printMeta による寸法補正 |
| `template-inspector.test.ts` | XML テンプレート検査 |
| `xml-validator.test.ts` | XML バリデーション |
| `template-diff.test.ts` | テンプレート差分比較 |

## プロジェクト構成

```
src/
  app/
    page.tsx              # メイン UI (アップロード → プレビュー → 解析 → ダウンロード)
    api/
      parse-excel/        # Excel 解析 API
      ai-analyze/         # AI 解析 API
      generate-xml/       # XML 生成 API
  components/
    ExcelUploader.tsx     # ファイルアップロード
    FormPreview.tsx       # セル構造プレビュー
    ClusterEditor.tsx     # クラスター編集
    ClusterList.tsx       # クラスター一覧
    ClusterToolbar.tsx    # ツールバー
  lib/                    # コアビジネスロジック
  cli/                    # CLI ツール
fixtures/
  xml/                    # テスト用 XML フィクスチャ
```
