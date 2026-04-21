# 仕組み解説 — 革新的な技術スタック

next-i-reporter の核となる技術的な工夫を解説します。

---

## 全体アーキテクチャ

```
Excel 入力
    ↓
eprint CLI (COM Interop)
    ↓
PDF + PrintMeta (正確な印刷座標)
    ↓
FormStructure (セル構造データ)
    ↓
OpenAI GPT-5.1
    ↓
ClusterDefinitions (型判定 + 座標)
    ↓
PdfCoordinateMapper
    ↓
VisualEditor (Canvas)
    ↓
XML (ConMas i-Reporter)
```

---

## 1. 正確な印刷座標再現（eprint CLI × COM Interop）

### 課題

一般的な Excel 解析ツール（SheetJS など）では、**セルの正確な物理座標（印刷座標）が取得できません**。

- SheetJS の `colWidths`/`rowHeights` は **近似値**（デフォルト 64px が多い）
- 列幅の細かい調整が失われる
- PDF レイアウトとのズレが発生
- クラスターの座標が PDF 上で正確に配置されない

### 解決策

**Windows COM Interop を使った Excel 自動化**

`eprint` という CLI ツール（内部で COM を使用）が Excel の正確な印刷メタ情報を抽出します。

```typescript
// excel-to-pdf.ts
const stdout = await execFileAsync(eprintPath, [
  inputPath,
  outputPath,
  "--meta",  // ★ メタ情報の抽出
]);

// JSON で返される
const meta = JSON.parse(stdout) as {
  pdfPath: string;
  sheets: PrintMeta[];
};
```

### 取得される PrintMeta の内容

```typescript
// form-structure.ts より
type PrintMeta = {
  // ページサイズ
  pdfPageWidthPt: number;    // ポイント単位（1/72 インチ）
  pdfPageHeightPt: number;

  // マージン
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    header: number;
    footer: number;
  };

  // 各行の正確な物理座標
  rows: Array<{
    row: number;      // 1-indexed 行番号
    top: number;      // ポイント単位の y 座標
    height: number;   // 高さ（ポイント）
  }>;

  // 各列の正確な物理座標
  columns: Array<{
    col: number;      // 1-indexed 列番号
    left: number;     // ポイント単位の x 座標
    width: number;    // 幅（ポイント）
  }>;

  // ズーム・フィッティング設定
  zoom?: number;      // パーセント（例: 100, 150）
  fitToPagesWide?: number;
  fitToPagesTall?: number;

  // 印刷範囲
  printArea?: { startRow, endRow, startCol, endCol, width, height };
  usedRange?: { startRow, endRow, startCol, endCol, width, height };
};
```

### 利点

| 従来 (SheetJS) | eprint CLI |
|---|---|
| 近似値のみ | **正確な物理座標** |
| メタ情報なし | メタ情報あり |
| 列幅の調整が失われる | **すべての列幅を保持** |
| PDF 配置がズレる | **正確に配置可能** |

### フォールバック戦略

1. **eprint CLI** — Windows で利用可能（社内システム）
2. **Graph API** — Azure/Microsoft 365 環境での PDF 変換
3. **ブランク PDF** — メタ情報なしで以降処理を続行

---

## 2. 座標マッピング — 複雑な計算の解法

### 課題

```
Excel セルの px 座標
    ↓
「SheetJS の px 座標は不正確」「PrintMeta の pt 座標は正確」
    ↓
    →  どうやって正確に変換するか？
```

- SheetJS `colWidths/rowHeights` は **近似値**
- PrintMeta は行列単位でのみ座標がある（セル単位ではない）
- ズーム、fit-to-page、マージンなどで複雑に変わる

### 解決策：行列番号ベースの補間

```typescript
// print-coord-mapper.ts
// SheetJS の px 累積和が不正確でも、行/列「番号」でマッピング

// 1. (行番号, 正確な pt 座標) のペアを構築
const rowPairs: PxPtPair[] = [];
for (const r of printMeta.rows) {
  const idx0 = r.row - 1;
  const px = rowTopsPx[idx0];  // 行番号から px を逆算
  rowPairs.push({ px, pt: r.top });
}

// 2. 任意の px 値を線形補間で pt に変換
const ptTop = interpolate(rowPairs, region.top);
const ptBottom = interpolate(rowPairs, region.bottom);
```

### ステップバイステップ

#### Step 1: 正確な pt 座標を取得
```
PrintMeta.rows = [
  { row: 1, top: 0, height: 15 },
  { row: 2, top: 15, height: 20 },
  { row: 3, top: 35, height: 15 },
  ...
]
```

#### Step 2: SheetJS の px 累積和と対応付け
```
SheetJS rowHeights = [15, 20, 15, ...]
rowTopsPx = [0, 15, 35, 50, ...]

Pair:
  px=0, pt=0      (行1)
  px=15, pt=15    (行2)
  px=35, pt=35    (行3)
  ...
```

#### Step 3: 線形補間で任意の px を pt に変換

クラスターが px 座標（20, 40）にあれば：

```
pt = interpolate(rowPairs, px)

px=20:
  → 行1と行2の間（px: 15-35）
  → 線形補間: 15 + (20-15)/(35-15) * (35-15) = 20pt

px=40:
  → 行3と行4の間
  → 線形補間で計算...
```

#### Step 4: ページスケーリングを適用

```
content = computePdfContentArea(printMeta)
  → zoom, fitToPage, マージンを考慮

finalCoord = {
  left: (content.left + relLeft * content.width) / pageWidth,
  right: (content.left + relRight * content.width) / pageWidth,
  top: (content.top + relTop * content.height) / pageHeight,
  bottom: (content.top + relBottom * content.height) / pageHeight,
}
```

**結果**: **0〜1 の正規化座標**（PDF ビューアで直接描画可能）

実装では **`mapClusterBoundsToPdf(region, cellAddress, sheet, printMeta)`** を主に使います。`cellAddress` がシート上で解決でき、`printMeta.rows` / `columns` に該当行・列がある場合は、**px 補間を経ずに pt 境界を直参照**してから上記の相対化・PDF 正規化に進みます（Designer との差分を抑えるため）。`cellAddress` が空のときや直参照に失敗したときは従来どおり px 補間にフォールバックします。環境変数 `IREPORTER_COORD_DEBUG=1` でマッピング経路をログに出せます。`mapClusterRegionToPdf` は第2引数なしの後方互換 API です。

### コード実装例

```typescript
// 推奨: cellAddress があると printMeta グリッド直参照で精度が上がる
export function mapClusterBoundsToPdf(
  region: PdfRect,
  cellAddress: string | undefined,
  sheet: SheetStructure,
  printMeta: PrintMeta
): PdfRect | null { /* ... */ }

// 後方互換（px のみ）
export function mapClusterRegionToPdf(
  region: PdfRect,
  sheet: SheetStructure,
  printMeta: PrintMeta
): PdfRect | null {
  return mapClusterBoundsToPdf(region, undefined, sheet, printMeta);
}
```

### 利点

- ✅ SheetJS の近似値を補正
- ✅ ズーム・fit-to-page・マージンに対応
- ✅ 複数ページの正確なマッピング
- ✅ 線形補間で滑らかな座標変換

---

## 3. AI 解析 — 包括的なプロンプト設計

### 入力情報

Excel から以下の **FormStructure** を構築し、JSON で AI に送信：

```typescript
// 各シートのセル構造
type SheetStructure = {
  sheetName: string;
  cells: Array<{
    address: string;      // "A1", "B2" etc
    value?: any;          // セルの値
    formula?: string;     // Excel 数式 → "=SUM(A1:A10)"
    format?: {
      numberFormat: string;  // "yyyy/mm/dd", "¥#,##0", etc
      fontColor?: string;
      backgroundColor?: string;
      borders?: { ... };
    };
    merged: boolean;
    dataValidation?: {     // ドロップダウンリスト
      type: "list" | "range";
      formula1?: string;
      operator?: string;
    };
  }>;
  mergedAreas: Array<{ startRow, endRow, startCol, endCol }>;
  rowHeights: number[];
  colWidths: number[];
};
```

### AI に指示する内容（システムプロンプト）

```
「ConMas i-Reporter の帳票設計エキスパート」として、
以下の判断基準に従ってクラスター型を推測：

1. テキスト系：キーボード、手書き、固定行、フリーメモ
2. 数値系：入力、選択、時間数、計算式
3. 日付・時刻：ドラムロール、カレンダー、時刻、計算
4. 選択系：単一選択、複数選択、トグル、マスター
5. メディア：画像、フリードロー、手書き
6. ワークフロー：作成、査閲、承認、登録者、登録日
7. 読取：QR、バーコード、GPS、ユーザー

## 判断のポイント
- セルの書式（numberFormat）がヒント
- 近くのラベルテキストから推測
- 数式セルは Calculate
- データバリデーション → Select/MultiSelect
- 大きな結合セル → Image/Handwriting/KeyboardText
- 「作成」「承認」→ ワークフロー型
```

AI の判定ロジック：

```
信頼度スコア (confidence)
- 0.95: 数式 or 書式から確実 (Calculate with formula)
- 0.85-0.95: 書式やラベルから高確度推測
- 0.70-0.85: 推測だが妥当
- 0.50-0.70: 不確実、ユーザー確認推奨
```

### 出力情報

```typescript
type ClusterDefinition = {
  name: string;              // "金額", "開始時刻" etc
  type: number;              // 65 (InputNumeric), 40 (Date), etc
  confidence: number;        // 0-1
  cellRange: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
  formula?: string;          // Calculate の場合のみ
  inputParameters: string;   // "Required=1;Decimal=2;Comma=1;Suffix=円"
  readOnly?: boolean;        // ワークフロー型の場合
};
```

### スマートデフォルト（入力パラメータ自動推測）

AI が出力した後、名前ベースの推測エンジンが起動：

```typescript
// smart-defaults.ts
// "金額" → Comma=1 (桁区切り), Suffix="円"
// "温度" → Suffix="℃", Decimal=1
// "時間" → TimeFormat="HH:mm"
// "生年月日" → DateFormat="yyyy年MM月dd日"

function applySmartDefaults(clusters: ClusterDefinition[]): ClusterDefinition[] {
  for (const cluster of clusters) {
    const keywords = extractKeywords(cluster.name);

    if (keywords.includes("金") || keywords.includes("料金")) {
      cluster.inputParameters += ";Comma=1;Suffix=円";
    }
    if (keywords.includes("温度")) {
      cluster.inputParameters += ";Suffix=℃;Decimal=1";
    }
    // ... その他多数
  }
}
```

### 利点

- ✅ 複雑な入力パラメータを自動生成
- ✅ 38 タイプを自動分類
- ✅ 信頼度スコアでユーザー確認の優先順位を指示
- ✅ プロンプトで常に最新のルールを使用可能

---

## 4. ビジュアルエディタ — イラストレーター風操作

### アーキテクチャ

```typescript
// Canvas ベース
<canvas
  ref={canvasRef}
  width={pdfWidth}
  height={pdfHeight}
  onMouseDown={handleSelect}
  onMouseMove={handleDrag}
  onMouseUp={handleDragEnd}
/>
```

### 主要な機能

#### 選択モード (SELECT)

```typescript
// 単一クリック → 選択
// Ctrl/Shift + クリック → 複数選択
// ドラッグ → ラバーバンド選択

function handleMouseDown(e: MouseEvent) {
  if (e.ctrlKey || e.shiftKey) {
    // 複数選択
    toggleCluster(hitCluster);
  } else {
    // 単一選択
    selectedClusters = [hitCluster];
  }
}
```

#### 移動・リサイズ

```typescript
// ドラッグして移動
onMouseMove → updatePosition(cluster, deltaX, deltaY)

// コーナーハンドルをドラッグしてリサイズ
onMouseMove → updateSize(cluster, newWidth, newHeight)

// キーボード（矢印キー）で微調整
→ nudge(cluster, direction, 1px)  // または Shift+矢印で 10px
```

#### 複数選択の一括移動

```typescript
// 複数クラスターが選択されている場合、
// バウンディングボックスをドラッグ → すべてが同じ距離だけ移動

const boundingBox = calculateBoundingBox(selectedClusters);
onDrag → applyDeltaToAll(selectedClusters, deltaX, deltaY);
```

### Canvas 描画ループ

```typescript
function renderCanvas() {
  clearCanvas();

  // 1. PDF を背景描画
  ctx.drawImage(pdfImage, 0, 0);

  // 2. 各クラスターを描画
  for (const cluster of clusters) {
    const isSelected = selectedClusters.includes(cluster);
    drawCluster(ctx, cluster, isSelected);
  }

  // 3. 選択中クラスターに操作ハンドルを表示
  for (const cluster of selectedClusters) {
    drawResizeHandles(ctx, cluster);
    drawContextMenu(ctx, cluster);
  }

  // 4. フィルター中のクラスターを半透明
  if (filterActive) {
    drawDimOverlay(ctx, filteredOutClusters);
  }

  requestAnimationFrame(renderCanvas);
}
```

### ズーム機能

```typescript
// 50-300% の任意のズームレベルで表示
zoomLevel: number; // 0.5 = 50%, 1.0 = 100%, 3.0 = 300%

// クリック位置を基準にズーム
const canvasX = e.clientX - canvas.getBoundingClientRect().left;
const worldX = canvasX / zoomLevel;
zoomLevel *= 1.1;  // 10% ズームイン
// 描画時に transform を適用
ctx.scale(zoomLevel, zoomLevel);
```

### 作成モード (CREATE)

クラスターを手動で描画：

```typescript
// N キーで作成モード有効化
mode = CREATE;

// 矩形ドラッグで新しいクラスターの領域を指定
onMouseDown → startRegion = { x, y };
onMouseMove → drawPreviewRectangle(startRegion, currentPos);
onMouseUp → createClusterFromRegion(startRegion, currentPos);
  → regionAnalyzer.analyzeRegion(...)  // AI で型推測
  → showCreateDialog(suggestedType, suggestedName);
```

### 利点

- ✅ Illustrator ライクな直感的操作
- ✅ 複数選択・一括操作で効率的
- ✅ リアルタイム描画フィードバック
- ✅ 高速なズーム（Canvas はビットマップ描画）

---

## 5. 統合フロー

### エンドツーエンド

```
1. ユーザーが Excel をアップロード
   ↓
2. eprint CLI で PDF + PrintMeta 抽出
   ↓
3. SheetJS で FormStructure 抽出
   ↓
4. OpenAI で ClusterDefinitions 推測
   → 38 タイプに自動分類 + 信頼度スコア
   ↓
5. SmartDefaults で入力パラメータ自動設定
   ↓
6. OverlapDetector で重複クラスター排除
   ↓
7. PdfCoordinateMapper で 0-1 座標に変換
   ↓
8. ClusterEditor にロード
   → Canvas に PDF + クラスターをレンダリング
   ↓
9. ユーザーが手作業で修正・追加
   ↓
10. XmlGenerator で ConMas XML 生成
    ↓
11. ユーザーがダウンロード → i-Reporter にインポート
```

### 主要な値の流れ

```
Excel Buffer
  ↓ (eprint CLI)
{ pdfBuffer, PrintMeta[] }
  ↓ (SheetJS)
FormStructure
  ↓ (OpenAI)
ClusterDefinition[] (with px 座標)
  ↓ (SmartDefaults)
ClusterDefinition[] (inputParameters 拡張)
  ↓ (OverlapRemover)
ClusterDefinition[] (クリーン)
  ↓ (PdfCoordinateMapper)
ClusterDefinition[] (with 0-1 座標)
  ↓ (Canvas Renderer)
[ビジュアルエディタ]
  ↓ (ユーザー編集)
AnalysisResult
  ↓ (XmlGenerator)
XML File
```

---

## 6. 革新性のまとめ

| 技術 | 従来 | next-i-reporter | 効果 |
|---|---|---|---|
| **座標取得** | SheetJS（近似値） | eprint CLI + COM（正確値） | ✅ ズレなし |
| **座標マッピング** | ピクセル換算 | 行列番号ベース補間 | ✅ 複雑な設定に対応 |
| **型分類** | 手作業 | OpenAI GPT + 包括的プロンプト | ✅ 38 タイプ自動判定 |
| **パラメータ設定** | 手作業 | スマートデフォルト | ✅ 70% 以上自動化 |
| **エディタ | 手作業のみ | Canvas + AI 支援 | ✅ 高速編集 |
| **出力** | 手作業で XML 生成 | ワンクリック XML | ✅ 時間削減 |

---

## 技術スタック詳細

| 領域 | 技術 | 役割 |
|------|------|------|
| フロントエンド | React 19 + TypeScript | Canvas UI, Form Editor |
| バックエンド | Next.js 16 (App Router) | API Routes |
| PDF 変換 | eprint CLI (COM) / Graph API | 正確な座標メタ情報 |
| Excel 解析 | SheetJS + custom parser | セル構造抽出 |
| AI | OpenAI GPT-5.1 | 型分類 + パラメータ推測 |
| スタイリング | Tailwind CSS 4 | UI/UX |
| テスト | Node.js 組み込みテストランナー | ロジック検証 |

---

## さらに深く知るには

- [座標マッピングの詳細実装](/development/coordinate-deep-dive)
- [AI プロンプトの全文](/development/ai-prompt-analysis)
- [API リファレンス](/development/api-reference)
- [パフォーマンス最適化](/development/performance-tuning)
