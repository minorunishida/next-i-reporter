# Designer ソースと next-i-reporter の座標パイプライン対応表

公式 ConMas Designer（`ConMas-Designer-main`）と本プロジェクトでは、クラスター矩形の出し方の前提が異なります。ここに処理の対応と、本リポジトリ側の参照ファイルを整理します。

## 処理フロー対応

| フェーズ | Designer（C#） | next-i-reporter（TypeScript） |
|----------|------------------|--------------------------------|
| Excel 読込 | `LibExcelController` / `ExcelProcessorInterop`（COM）、`ExcelProcessorDevExpress` 系 | [`excel-parser.ts`](../../src/lib/excel-parser.ts)、[`dimension-corrector.ts`](../../src/lib/dimension-corrector.ts) |
| 印刷レイアウトの真値 | Excel / PDF 出力後の **ラスタ画像**（シートごと PNG） | eprint CLI 由来の [`PrintMeta`](../../src/lib/form-structure.ts)（行・列の pt、`printArea`、`margins`、`zoom` / `fitToPages*`） |
| クラスター矩形の検出 | `ExcelProcessorBase.CalculateClusterCoords` 内 `ClusterImage.GetClusterRect` — **画素走査**（罫線パターン） | セルごとの `region`（px）＋ AI 推論の `cellAddress` |
| 0〜1 正規化 | 画像幅・高さで除算（`ClusterRect` の比率化） | [`print-coord-mapper.ts`](../../src/lib/print-coord-mapper.ts) — **printMeta グリッド上の pt → PDF ページ正規化** |
| XML 出力 | `ExcelProcessorBase.ExportToXml` の `<top>` `<bottom>` `<left>` `<right>` | [`xml-generator.ts`](../../src/lib/xml-generator.ts) の `genCluster` |

Designer のソースパス例（ローカルクローン時）:

- `ConMasClient/Common/ExcelProcessorBase.cs` — `CalculateClusterCoords` / `SaveClusterInfo` / `ExportToXml`
- `LibConMas/ImageDb/ClusterType.cs` — 型番号の一次ソース
- `LibExcelController/ExcelControllerInterop.cs` — `conmas` ルート付近の XML 組み立て

## 数値・型の対応

| 項目 | Designer | next-i-reporter |
|------|----------|-----------------|
| クラスター型 enum | `LibConMas.ImageDb.ClusterType` | [`cluster-type-registry.ts`](../../src/lib/cluster-type-registry.ts) |
| inputParameters 文字列 | 各 `*ClusterParameter.cs` の `ParameterText` | AI プロンプト＋ [`smart-defaults`](../../src/lib/smart-defaults.ts) 等 |

## 座標精度（オプション A）

px 補間だけに依存すると SheetJS 由来の列幅誤差が残るため、`printMeta.rows` / `columns` の **セル行列入力（1-based）で pt 境界を直参照**する経路を [`print-coord-mapper.ts`](../../src/lib/print-coord-mapper.ts) に実装しています（`mapClusterBoundsToPdf` / `mapClusterBoundsToPdfDetailed`）。

**注意**: [`dimension-corrector`](../../src/lib/dimension-corrector.ts) 済みの px グリッドは eprint の行高・列幅に寄せられているため、**アドレス直参照の pt と px 補間の pt はしばしば一致**し、`pdfNormalized` の数値が以前と変わらないことがあります。それでも `coordMappingMode`（監査ログ）で `address` / `px` を確認できます。

公式 Designer が **印刷 PNG の画素走査**で矩形を取るのに対し、こちらは **論理レイアウト（pt）→ PDF** なので、**見た目の完全一致**には別途レンダリング寄せ（計画のオプション B）が必要になる場合があります。

AI が返す `region` の微ズレは、解析後に [`cluster-region-snap.ts`](../../src/lib/cluster-region-snap.ts) で **シート上のセル矩形へスナップ**して揃えています。

**クラスターエディタ（PDF プレビュー）**では、ドラッグで動かした `region` をそのまま反映するため **`mapClusterRegionToPdf`（px のみ）** を使います。セル直参照は **XML 生成**（[`xml-generator.ts`](../../src/lib/xml-generator.ts)）と **サーバ監査ログ**（[`ai-analyze/route.ts`](../../src/app/api/ai-analyze/route.ts)）に限定しています。

### 横方向のズレ（Excel 既定との差）

[`computePdfContentArea`](../../src/lib/print-coord-mapper.ts) では、**「ページに合わせる」（`fitToPagesWide` / `fitToPagesTall`）のときだけ**、印刷可能幅に対して印刷範囲を**水平中央**に置くオフセットを入れています。**100% 等の通常ズーム**では Excel の多くの既定（水平中央オフ＝**左マージンから**）に合わせ、余白内で無暗に中央寄せしないようにしています。Designer の実印刷 PNG ベースの座標と整合しやすくなります。

環境変数:

- `IREPORTER_COORD_DEBUG=1` — 座標マッピングの構造化ログを `info` で出力
- `IREPORTER_COORD_PX_ONLY=1` — 従来の px 補間のみに強制（比較・退避用）

## ゴールデン XML の比較

Designer が出力した `.xml` と本ツールの XML を並べて `<top>` 等を数値比較する場合は、リポジトリの `scripts/diff-cluster-xml.mjs` を使用します。

```bash
npm run diff-cluster-xml -- path/to/designer.xml path/to/next-i-reporter.xml
```

同一ブックで差分パターン（一定オフセット／スケール／セル単位のばらつき）を分類するのに使います。
