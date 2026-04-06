# ConMas 帳票定義 XML スキーマ概要

## ファイル

- `ConMasClient/template.xml` — 標準帳票テンプレート (745行)
- `ConMasClient/templateXls.xml` — Excelベース帳票テンプレート (648行)

## XML 構造 (トップレベル)

```xml
<conmas>
  <header>        <!-- API通信ヘッダー -->
  <top>           <!-- 帳票全体の設定 -->
    ├── 基本情報 (defTopId, defTopName, version...)
    ├── 出力設定 (finishOutputFiles, editOutputFiles, excelOutput)
    ├── 備考 (remarksName1~10, remarksValue1~10)
    ├── 保存メニュー (displaySaveMenu)
    ├── バーコード分割 (dividedDeviceCode)
    ├── 自動採番 (autoNumbering)
    ├── ラベル・ネットワーク
    ├── バーコードスキャン設定 (matrixScanSetting)
    ├── EdgeOCR設定 (edgeOcrSetting)
    ├── ページクラスタ (pageClusters)
    └── sheets
  </top>
  <variables>     <!-- テンプレート変数定義 -->
    ├── sheet         (シート定義: 背景画像、サイズ、備考、クラスタ群)
    ├── cluster       (クラスタ定義: 位置、型、値、関数、出力設定)
    ├── network       (入力フロー定義)
    ├── table         (テーブル定義)
    ├── label         (ラベル)
    ├── approve/inspect/create (承認フロー)
    └── pinDetail     (ピン詳細)
  </variables>
  <tableVariables>  <!-- テーブル列・行定義 -->
  <grammar>         <!-- 音声入力文法 -->
  <scanditVariables> <!-- バーコードスキャン変数 -->
</conmas>
```

## Cluster 定義 (核心)

`<type>` の数値と UI 表示名、`inputParameters` の解釈の対応: [cluster-types-external-reference.md](cluster-types-external-reference.md)

```xml
<cluster>
  <sheetNo/>           <!-- 所属シート番号 -->
  <clusterId/>         <!-- クラスタID -->
  <name/>              <!-- クラスタ名 -->
  <type/>              <!-- クラスタ種別 (テキスト/数値/日付/選択/画像/バーコード等) -->
  <top/><bottom/><right/><left/>  <!-- 座標 (位置情報) -->
  <value/>             <!-- 初期値 -->
  <displayValue/>      <!-- 表示値 -->
  <readOnly/>          <!-- 読取専用フラグ -->
  <function/>          <!-- 計算式 -->
  <actionPost/>        <!-- 入力後アクション -->
  <excelOutputValue/>  <!-- Excel出力値 -->
  <inputParameters/>   <!-- 入力パラメータ -->
  <carbonCopy/>        <!-- カーボンコピー先 -->
  <cellAddress/>       <!-- Excelセルアドレス -->
  <management/>        <!-- 管理情報 -->
  <remarksValue1~10/>  <!-- 備考 -->
  <!-- + マスタ連携、レポートコピー、バーコード分割、ピン設定 -->
</cluster>
```

`<inputParameters>` の本文形式・キー一覧: [input-parameters.md](input-parameters.md)

クラスター間の **ネットワーク設定**（`top/networks`・バリューリンク含む）: [spec-network-settings.md](spec-network-settings.md)

クラスター間の **カーボンコピー設定**（`cluster/carbonCopy`・`edit`・`Locked` 含む）: [spec-carbon-copy-settings.md](spec-carbon-copy-settings.md)

**Excel 定義ファイル**（`definitionFile`）の取込・EXCEL 定義出力（COM）の挙動: [spec-excel-definition-io-designer.md](spec-excel-definition-io-designer.md)

## 出力設定

```xml
<finishOutputFiles>   <!-- 完了時自動出力 -->
  <csv/><csvImageAudio/><csvZip/>
  <dataOutputCsv/><dataOutputCsvImageAudio/>
  <xml/><pdf/><pdfLayer/><docuworks/><excel/>
</finishOutputFiles>
```

## OutputTargets (コード側)

`LibConMas/ConMasService/OutputTargets.cs`:
- IsOutputText, IsOutputCsv, IsOutputXml, IsOutputPdfWithText

## シリアライゼーション

`LibConMas/Domain/Helpers/XElementMapper.cs` (530行):
- `ToXElement<T>()` / `ToObject<T>()` でオブジェクト⇔XML双方向変換
- プリミティブ型、Enum(→int)、コレクション、Base64バイト配列に対応
