# ネットワーク設定 — 実装からのリバースエンジニアリング仕様

ConMas Designer / 帳票定義 XML における **ネットワーク設定**（クラスター間の入力順・表示制御・値連動）を、リポジトリ内の C# 実装と XML テンプレートから抽出した仕様メモです。  
公式の用語説明は [ConMas i-Reporter 用語集（ネットワーク設定）](https://manuals.i-reporter.jp/glossary) も参照してください。

## 1. 概要

- **目的**: 先行クラスター（親）と後続クラスター（子）の1対1の関係を定義し、大小関係（`relation`）、スキップ、自動入力、**バリューリンク**（選択肢の対応）、必須連携、記入不要表示、端末種別などを制御する。
- **XML 上の場所**: ルート直下の `<conmas><top>` 配下に、帳票全体のフラグと `<networks>` 内の複数 `<network>` 要素として格納される。
- **ランタイムモデル**: `LibConMas.ImageDb.ClusterNetwork` / `ValueLink`。Designer 上の矢印座標（`ArrowStartX` 等）は **XML には保存されない**（画面描画用）。

## 2. 帳票トップレベル（`<top>` 内）

| 要素 | 型 | 実装（プロパティ） | 説明（コードコメントより） |
|------|-----|-------------------|---------------------------|
| `<networkAnswerbackMode>` | int | `TopReport.NetworkAnswerbackMode` | ネットワークの後続移動後にアンサーバックを行うか |
| `<useNetworkAutoInputStart>` | int | `TopReport.UseNetworkAutoInputStart` | 後続クラスターへジャンプするか |

テンプレート: `ConMasClient/template.xml`（`networkAnswerbackMode` / `useNetworkAutoInputStart`）。

## 3. `<networks>` ブロック

```xml
<networks>
  <network>
    <!-- 子要素は下表 -->
  </network>
</networks>
```

- 1つの `<network>` は **1本のエッジ**（先行 → 後続）に対応する。
- 読み込み時、各シート `BlankReport` には、`prevSheetNo` または `nextSheetNo` がそのシートに関係するエッジだけが `Network` コレクションに載る（`MainWindow.xaml.cs` 付近の XML 読込ロジック）。

## 4. `<network>` 子要素一覧

| 要素名 | 型 | 既定・備考 | 実装 |
|--------|-----|-----------|------|
| `prevSheetNo` | 整数（文字列） | **1始まり**のシート番号 | `ClusterNetwork.PsheetNo` |
| `prevClusterId` | 整数（文字列） | 当該シート内のクラスター index（clusterId） | `Pindex` |
| `nextSheetNo` | 整数（文字列） | **1始まり** | `SsheetNo` |
| `nextClusterId` | 整数（文字列） | 同上 | `Sindex` |
| `relation` | 文字列 | 大小関係の種別（下表） | `Relation` |
| `nextAutoInputStart` | 文字列 | 省略時は `"1"`（読込側） | `NextAutoInputStart` |
| `nextAutoInput` | 文字列 | 省略時は `"0"` | `NextAutoInput` 先行の入力で後続を自動入力 |
| `nextAutoInputEdit` | 整数 | 省略時 `0` | `NextAutoInputEdit` 自動入力後の後続編集可否 |
| `skip` | 文字列 | 省略時 `"0"` | `Skip` |
| `terminalType` | 文字列 | 空可。`"0"`: iOS / `"1"`: Windows（コメント） | `TerminalType` |
| `checkGroupIdMode` | 整数 | 同一グループIDのチェッククラスター用 | `CheckGroupIdMode` |
| `customMasterSearchField` | 文字列 | カスタムマスター検索フィールド番号 | `CustomMasterSearchField` |
| `noNeedToFillOut` | 整数 | 記入不要（下表） | `NoNeedToFillOut` |
| `requiredValue` | 文字列 | 必須連携（後続必須）条件 | `RequiredValue` / `ExistRequiredValue` |
| `valueLinks` | コンテナ | 子に `valueLink` を複数 | `ValueLinks` / `ExistValueLink` |

テンプレート例: `ConMasClient/template.xml` の `<network>` 断片。

### 4.1 `relation`（大小関係）

`ConMasClient/Classes/NetworkRelations.cs` の定義どおり、XML 値は次の文字列（先頭は空文字の選択肢あり）。

| XML 値 | 意味（英語名から推定） |
|--------|------------------------|
| `""` | 未設定 |
| `GreaterEqual` | ≥ |
| `Greater` | > |
| `Less` | < |
| `LessEqual` | ≤ |
| `Equal` | = |
| `NotEqual` | ≠ |

数値クラスター同士の比較などに用いる想定（UI ラベルは `iReporter.Language` 系）。

### 4.2 `nextAutoInputStart`

`NetworkNextAutoInputStarts`: `"0"` / `"1"` のみ。

### 4.3 `skip`

`NetworkSkips`: `"0"` / `"1"` / `"2"` のみ。詳細な業務意味は UI 文言（`CheckNetworkSkipOk` / `Ng` 等）に依存。

### 4.4 `noNeedToFillOut`

`ClusterNetwork` コメントより:

- `0`: 行わない  
- `1`: 先行クラスター入力時に、後続を記入不要表示する  
- `2`: 先行/後続のどちらか入力時に、残りを記入不要表示する  

### 4.5 `terminalType`

`ClusterNetwork` コメントより「使用端末（現在は制限するための目的のみ）」:

- `0`: iOS 版  
- `1`: Windows 版  

空文字も許容。

## 5. バリューリンク（`<valueLinks>` / `<valueLink>`）

公式用語: [バリューリンク設定](https://manuals.i-reporter.jp/glossary)（値連動）。

構造:

```xml
<valueLinks>
  <valueLink>
    <parentValue>先行側の値</parentValue>
    <selectValues>後続で有効にする選択肢の列（カンマ区切り）</selectValues>
  </valueLink>
</valueLinks>
```

| 要素 | モデル | 説明 |
|------|--------|------|
| `parentValue` | `ValueLink.ParentValue` | 先行クラスター側の値 |
| `selectValues` | `ValueLink.SelectValue` | 後続クラスター側で許可する値（**複数はカンマ区切り**） |

**エスケープ**: 値にカンマを含める場合、Designer 側の編集処理では `,` を `,,` に置換して連結する（`MainWindow.xaml.cs` 付近のバリューリンク保存処理）。読み取りは **選択肢分解** と同様のパラメータ解析（`SetGrammarWindow.ParseParameterText` 等が参照される）と整合。

## 6. 削除・無効化のパターン

XML 編集時に `prevSheetNo` を `-1` にする処理があり（コピー・削除系）、当該エッジを無効扱いにする用途がある（`MainWindow.xaml.cs` 内の `CopyNetworkbef` 等）。

## 7. 実装参照（ソース）

| ファイル | 内容 |
|----------|------|
| `LibConMas/ImageDb/ClusterNetwork.cs` | ネットワーク1本のプロパティ |
| `LibConMas/ImageDb/ValueLink.cs` | バリューリンク1行 |
| `LibConMas/ImageDb/TopReport.cs` | `NetworkAnswerbackMode`, `UseNetworkAutoInputStart` |
| `ConMasClient/Classes/NetworkRelations.cs` | `relation` の列挙値 |
| `ConMasClient/Classes/NetworkSkips.cs` | `skip` の値 |
| `ConMasClient/Classes/NetworkNextAutoInputStarts.cs` | `nextAutoInputStart` の値 |
| `ConMasClient/template.xml` | XML 要素名のテンプレート |
| `ConMasClient/MainWindow.xaml.cs` | XML 読込・書込・バリューリンク編集の主処理 |
| `LibConMas/Domain/Helpers/CommonHelperMethods.cs` | `GetNetworksUsesCluster` / `IsConnected` 等 |

## 8. ウェブ生成ツールとの関係

`next-i-reporter/src/lib/xml-generator.ts` では現状 `<networks></networks>` を空で出力し、`networkAnswerbackMode`/`useNetworkAutoInputStart` をプレースホルダで埋める程度。本仕様に沿った **ネットワーク・バリューリンクの完全生成** は未実装。

## 9. 補足（カーボンコピーとの区別）

| 機能 | XML | 主な用途 |
|------|-----|----------|
| ネットワーク | `<top><networks>` | 入力順・制御・バリューリンク |
| カーボンコピー | クラスタの `<carbonCopy>` 等 | 値のコピー（別系統） |

---

*このドキュメントはリポジトリの実装に基づく。サーバー側の検証・モバイルアプリの挙動は製品版の仕様書を優先すること。*
