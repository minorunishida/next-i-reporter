# i-Reporter ネットワーク機能まとめ

ConMas Designer / i-Reporter の「ネットワーク機能」は、クラスター間を 1 本のエッジとして結び、入力順、後続クラスターへの移動、自動入力、値連動、必須連携、端末別制御などを定義する仕組みです。

このメモは、リポジトリ内の実装とテンプレート XML をもとに、特に次の観点をまとめたものです。

- ネットワーク機能の役割
- XML の配置と生成方法
- `inputParameters` との関係
- `valueLinks` / `requiredValue` / `customMasterSearchField` などの意味

## 1. 何をする機能か

ネットワーク機能は、先行クラスターと後続クラスターを結び、主に以下を制御します。

- 入力後に後続へ移動するか
- 先行値で後続値を自動入力するか
- 大小関係や一致条件を使うか
- 選択肢を連動させるか (`valueLinks`)
- 後続を必須扱いにするか (`requiredValue`)
- 記入不要表示にするか (`noNeedToFillOut`)
- iOS / Windows で動作を制限するか (`terminalType`)

保存先はクラスター個別ではなく、帳票トップ配下の `<top><networks>` です。

## 2. XML 上の配置

トップ設定:

```xml
<conmas>
  <top>
    <useNetworkAutoInputStart>1</useNetworkAutoInputStart>
    <networkAnswerbackMode>0</networkAnswerbackMode>
    <networks>
      <network>...</network>
    </networks>
  </top>
</conmas>
```

ネットワーク 1 本分:

```xml
<network>
  <prevSheetNo>1</prevSheetNo>
  <prevClusterId>10</prevClusterId>
  <nextSheetNo>1</nextSheetNo>
  <nextClusterId>11</nextClusterId>
  <nextAutoInputStart>1</nextAutoInputStart>
  <relation>Equal</relation>
  <skip>0</skip>
  <requiredValue>1</requiredValue>
  <customMasterSearchField></customMasterSearchField>
  <checkGroupIdMode>0</checkGroupIdMode>
  <noNeedToFillOut>0</noNeedToFillOut>
  <terminalType>0</terminalType>
  <nextAutoInput>0</nextAutoInput>
  <nextAutoInputEdit>0</nextAutoInputEdit>
  <valueLinks>
    <valueLink>
      <parentValue>A</parentValue>
      <selectValues>X,Y</selectValues>
    </valueLink>
  </valueLinks>
</network>
```

## 3. XML 生成の流れ

Designer は保存時に `template.xml` を読み込み、その雛形の `<network>` / `<valueLink>` ノードを複製して値を埋めます。処理の流れは概ね次の通りです。

1. `template.xml` を `XDocument.Load(...)` で読み込む
2. `<top>` の帳票フラグを埋める
3. 各クラスターの `<inputParameters>` を出力する
4. ネットワークリストを集約して `<top><networks>` に追加する
5. 必要なら `<valueLinks>` 配下に `<valueLink>` を追加する

実装上の主要ポイント:

- 帳票全体フラグ
  - `networkAnswerbackMode`
  - `useNetworkAutoInputStart`
- ネットワーク 1 本ごとの出力
  - `prevSheetNo`, `prevClusterId`, `nextSheetNo`, `nextClusterId`
  - `nextAutoInputStart`, `nextAutoInput`, `nextAutoInputEdit`
  - `relation`, `skip`, `requiredValue`
  - `terminalType`, `checkGroupIdMode`, `customMasterSearchField`
  - `noNeedToFillOut`

## 4. 読み込み時のデフォルト

XML 読み込み時、いくつかの項目は未設定でも補完されます。

- `nextAutoInputStart`
  - 未設定または空なら `"1"`
- `nextAutoInput`
  - 未設定または空なら `"0"`
- `nextAutoInputEdit`
  - 未設定または空なら `0`
- `terminalType`
  - 未設定または空なら `""`
- `skip`
  - 未設定または空なら `"0"`
- `noNeedToFillOut`
  - 未設定なら `0`

このため、古い XML でもある程度は後方互換で読めます。

## 5. `inputParameters` との関係

重要なのは、ネットワーク設定そのものは `<network>` に保存され、`inputParameters` には保存されないことです。

`inputParameters` はクラスターごとの詳細設定を持つ別の領域です。

```xml
<cluster>
  <type>70</type>
  <inputParameters>Items=A,B,C;Labels=選択A,選択B,選択C;Default=A</inputParameters>
</cluster>
```

ただし、ネットワーク機能は `inputParameters` の内容を参照します。特に `valueLinks` 保存時は、先行・後続クラスターの `Items` を見て妥当な値だけを書き出します。

つまり関係は次の通りです。

- ネットワーク設定の本体
  - `<top><networks><network>`
- クラスター側の候補値や入力制御
  - `<cluster><inputParameters>`
- `valueLinks` は両者をまたいで成立する
  - 親の `parentValue` が先行クラスター `Items` に存在するか
  - 子の `selectValues` が後続クラスター `Items` に存在するか

## 6. `inputParameters` の形式

`inputParameters` は `key=value` を `;` で連結した 1 本の文字列です。

```text
Required=1;Items=A,B,C;Labels=選択A,選択B,選択C;Default=A
```

基本ルール:

- 区切りは `;`
- 値に `;` を含める場合は `;;`
- `null` の項目は出力しない
- 読み込み時は `;;` を `;` に戻す

実装上は `CommonHelperMethods.AsParametersDictionary(...)` と `ToInputParametersString(...)` が共通処理です。

## 7. `valueLinks` の実装上の注意

`valueLinks` は単なる文字列保存ではなく、保存時に値の妥当性チェックが入ります。

### 7.1 保存条件

以下を満たしたときだけ `<valueLink>` が出力されます。

- `parentValue` が先行クラスターの `Items` に存在する
- `selectValues` の各値が後続クラスターの `Items` に存在する

不正な値は出力から落ちます。

### 7.2 カンマの扱い

`selectValues` は複数値をカンマ区切りで持ちますが、値そのものにカンマが含まれる場合は `,,` に二重化して保存します。

例:

```xml
<selectValues>A,,B,C</selectValues>
```

これは次の意味です。

- 1つ目の値: `A,B`
- 2つ目の値: `C`

この仕様は `inputParameters` の `Items` を分解する処理と揃えてあります。

## 8. 主要項目の意味

### 8.1 `relation`

使用可能な値:

- `""`
- `GreaterEqual`
- `Greater`
- `Less`
- `LessEqual`
- `Equal`
- `NotEqual`

### 8.2 `skip`

使用可能な値:

- `0`
- `1`
- `2`

### 8.3 `nextAutoInputStart`

使用可能な値:

- `0`
- `1`

### 8.4 `noNeedToFillOut`

- `0`: 行わない
- `1`: 先行入力時に後続を記入不要表示
- `2`: 先行/後続のどちらか入力時に残りを記入不要表示

### 8.5 `terminalType`

- `0`: iOS
- `1`: Windows
- `""`: 未指定

## 9. 生成時の補正ロジック

保存時には、単純な書き戻し以外に補正も入ります。

- `customMasterSearchField` があり、同じ先行クラスターから複数ネットワークが出る場合:
  - `terminalType == "0"` なら `nextAutoInputStart` を強制的に `0`
  - `terminalType == ""` なら状況に応じて `terminalType` を `0` または `1` に補正

このため、画面上の設定値がそのまま XML に保存されるとは限りません。

## 10. 実装上の見取り図

- ネットワーク 1 本のモデル
  - `LibConMas/ImageDb/ClusterNetwork.cs`
- バリューリンク 1 行
  - `LibConMas/ImageDb/ValueLink.cs`
- 帳票トップのネットワーク関連フラグ
  - `LibConMas/ImageDb/TopReport.cs`
- ネットワーク値の候補
  - `ConMasClient/Classes/NetworkRelations.cs`
  - `ConMasClient/Classes/NetworkSkips.cs`
  - `ConMasClient/Classes/NetworkNextAutoInputStarts.cs`
- クラスター `inputParameters` の共通シリアライズ
  - `LibConMas/Domain/Helpers/CommonHelperMethods.cs`
  - `LibConMas/ImageDb/ClusterParameter.cs`
- XML テンプレート
  - `ConMasClient/template.xml`
- 読み書きの中心
  - `ConMasClient/MainWindow.xaml.cs`

## 11. 要点

- ネットワーク機能はクラスター間の依存関係を `<top><networks>` に持つ
- `inputParameters` はクラスター個別設定であり、ネットワーク本体ではない
- ただし `valueLinks` は `inputParameters` の `Items` に依存して生成される
- `selectValues` のカンマは `,,` でエスケープされる
- 保存時には `customMasterSearchField` と `terminalType` に応じた補正が入る

## 12. 関連ドキュメント

- `docs/architecture/i-reporter-network-function-external-tools.md`
- `docs/architecture/spec-network-settings.md`
- `docs/architecture/input-parameters.md`
- `docs/architecture/input-parameters-ui-labels.md`
- `docs/architecture/xml-schema-summary.md`
