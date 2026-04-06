# i-Reporter ネットワーク機能ガイド

外部ツールから ConMas / i-Reporter 用の帳票 XML を生成する人向けの実務メモです。  
この文書は「Designer の内部実装説明」ではなく、「XML をどう作ればよいか」を中心に整理しています。

対象:

- 帳票 XML をコード生成するツールを作る人
- 既存の帳票定義を別システムから組み立てる人
- `inputParameters` とネットワーク設定の関係を外部で再現したい人

## 1. 先に結論

ネットワーク機能を外部生成するときの要点はこれです。

- ネットワーク設定は `<cluster>` ではなく `<top><networks>` に出す
- 1 本の接続につき `<network>` を 1 要素作る
- `prevSheetNo` / `nextSheetNo` は 1 始まり
- `prevClusterId` / `nextClusterId` は対象クラスターの `clusterId`
- `valueLinks` を使う場合、親子クラスターの `inputParameters` 内 `Items` と整合している必要がある
- `selectValues` 内で値そのものにカンマを含む場合は `,,` にエスケープする
- 未設定項目を空文字で出しても読めるが、既定値を意識して出力した方が安全

## 2. どこに何を出すか

帳票全体のトップ設定:

```xml
<top>
  <useNetworkAutoInputStart>1</useNetworkAutoInputStart>
  <networkAnswerbackMode>0</networkAnswerbackMode>
  <networks>
    <network>...</network>
  </networks>
</top>
```

クラスター定義:

```xml
<cluster>
  <sheetNo>1</sheetNo>
  <clusterId>10</clusterId>
  <type>70</type>
  <inputParameters>Items=A,B,C;Labels=選択A,選択B,選択C</inputParameters>
</cluster>
```

ネットワーク 1 本:

```xml
<network>
  <prevSheetNo>1</prevSheetNo>
  <prevClusterId>10</prevClusterId>
  <nextSheetNo>1</nextSheetNo>
  <nextClusterId>11</nextClusterId>
  <nextAutoInputStart>1</nextAutoInputStart>
  <relation></relation>
  <skip>0</skip>
  <requiredValue></requiredValue>
  <customMasterSearchField></customMasterSearchField>
  <checkGroupIdMode></checkGroupIdMode>
  <noNeedToFillOut>0</noNeedToFillOut>
  <terminalType>0</terminalType>
  <nextAutoInput>0</nextAutoInput>
  <nextAutoInputEdit>0</nextAutoInputEdit>
  <valueLinks></valueLinks>
</network>
```

## 3. 最低限必要な項目

ネットワーク機能だけを成立させる最小セットは次です。

### 3.1 `<top>` 側

- `useNetworkAutoInputStart`
- `networkAnswerbackMode`
- `networks`

### 3.2 `<network>` 側

- `prevSheetNo`
- `prevClusterId`
- `nextSheetNo`
- `nextClusterId`

それ以外は空でも読み込めますが、以下は明示推奨です。

- `nextAutoInputStart`
- `skip`
- `noNeedToFillOut`
- `terminalType`
- `nextAutoInput`
- `nextAutoInputEdit`
- `valueLinks`

## 4. 各項目の実務上の意味

### 4.1 接続先指定

- `prevSheetNo`
  - 親クラスターのシート番号
- `prevClusterId`
  - 親クラスターの `clusterId`
- `nextSheetNo`
  - 子クラスターのシート番号
- `nextClusterId`
  - 子クラスターの `clusterId`

注意:

- `sheetNo` は 1 始まり
- 実装上の `br.SheetNo` は 0 始まりだが、XML は 1 始まりで出す

### 4.2 入力遷移・自動入力

- `nextAutoInputStart`
  - 後続へ自動移動するか
  - 値候補は `0` / `1`
- `nextAutoInput`
  - 親入力時に子へ自動入力するか
  - 未設定時は実装上 `0`
- `nextAutoInputEdit`
  - 自動入力後に子を編集可能にするか
  - 未設定時は `0`

### 4.3 条件・表示制御

- `relation`
  - `GreaterEqual`, `Greater`, `Less`, `LessEqual`, `Equal`, `NotEqual`, `""`
- `skip`
  - `0`, `1`, `2`
- `requiredValue`
  - 後続を必須扱いにする条件値
- `noNeedToFillOut`
  - `0`, `1`, `2`
- `terminalType`
  - `0`: iOS
  - `1`: Windows
  - `""`: 未指定

### 4.4 カスタムマスター連携

- `customMasterSearchField`
  - カスタムマスター検索対象フィールド
- `checkGroupIdMode`
  - 同一グループ ID チェック系のモード

この 2 項目を使う場合は、接続先クラスター側の種別や `inputParameters` も合わせて設計しないと XML だけ正しくても挙動が成立しません。

## 5. `inputParameters` との関係

外部ツール視点ではここが重要です。

- ネットワーク設定そのものは `<network>` に出す
- ただし `valueLinks` の正しさはクラスター側の `inputParameters` に依存する

代表例:

```xml
<cluster>
  <clusterId>10</clusterId>
  <type>70</type>
  <inputParameters>Items=A,B,C;Labels=親A,親B,親C</inputParameters>
</cluster>

<cluster>
  <clusterId>11</clusterId>
  <type>70</type>
  <inputParameters>Items=X,Y,Z;Labels=子X,子Y,子Z</inputParameters>
</cluster>
```

このとき、`valueLinks` では:

- `parentValue` は親の `Items` に存在する値
- `selectValues` は子の `Items` に存在する値の列

を使う必要があります。

## 6. `inputParameters` 文字列のルール

形式:

```text
key=value;key=value;key=value
```

ルール:

- 区切りは `;`
- 値中の `;` は `;;`
- `null` 値はキーごと省略
- 読み込み時は `;;` を `;` に戻す

例:

```text
Items=A,B,C;Labels=親A,親B,親C;Default=A
```

この形式自体はネットワーク専用ではなく、すべてのクラスター共通です。

## 7. `valueLinks` の作り方

構造:

```xml
<valueLinks>
  <valueLink>
    <parentValue>A</parentValue>
    <selectValues>X,Y</selectValues>
  </valueLink>
</valueLinks>
```

意味:

- 親の値が `A` のとき
- 子で選べる値を `X`, `Y` に制限する

### 7.1 `selectValues` の区切り

通常はカンマ区切りです。

```xml
<selectValues>X,Y,Z</selectValues>
```

### 7.2 値にカンマを含む場合

値の中にカンマを含む場合は `,,` に二重化します。

```xml
<selectValues>A,,B,C</selectValues>
```

これは次の 2 値を意味します。

- `A,B`
- `C`

### 7.3 外部ツール側で再現すべき分解ルール

`selectValues` を組み立てるときは、単純な CSV ではなく次のルールで処理してください。

- 区切り文字は `,`
- ただし `,,` は文字としてのカンマ 1 個

つまり:

1. 値を join するときは、各値内の `,` を `,,` に置換
2. その後に `,` で連結

## 8. 外部ツールでの生成アルゴリズム

推奨手順:

1. 先に全クラスターを確定する
2. 各クラスターの `sheetNo` と `clusterId` を確定する
3. 選択系クラスターなら `inputParameters` の `Items` を先に確定する
4. その後で `<network>` を生成する
5. `valueLinks` を使う場合は、親子の `Items` に存在する値だけを出す
6. `selectValues` は `,,` エスケープしてから出力する

これを逆順にすると、`valueLinks` が親子定義と不整合になりやすいです。

## 9. 生成サンプル

### 9.1 親と子を単純接続するだけ

```xml
<useNetworkAutoInputStart>1</useNetworkAutoInputStart>
<networkAnswerbackMode>0</networkAnswerbackMode>
<networks>
  <network>
    <prevSheetNo>1</prevSheetNo>
    <prevClusterId>10</prevClusterId>
    <nextSheetNo>1</nextSheetNo>
    <nextClusterId>11</nextClusterId>
    <nextAutoInputStart>1</nextAutoInputStart>
    <relation></relation>
    <skip>0</skip>
    <requiredValue></requiredValue>
    <customMasterSearchField></customMasterSearchField>
    <checkGroupIdMode></checkGroupIdMode>
    <noNeedToFillOut>0</noNeedToFillOut>
    <terminalType>0</terminalType>
    <nextAutoInput>0</nextAutoInput>
    <nextAutoInputEdit>0</nextAutoInputEdit>
    <valueLinks></valueLinks>
  </network>
</networks>
```

### 9.2 単一選択どうしを値連動する

親:

```xml
<inputParameters>Items=A,B;Labels=親A,親B</inputParameters>
```

子:

```xml
<inputParameters>Items=X,Y,Z;Labels=子X,子Y,子Z</inputParameters>
```

ネットワーク:

```xml
<network>
  <prevSheetNo>1</prevSheetNo>
  <prevClusterId>10</prevClusterId>
  <nextSheetNo>1</nextSheetNo>
  <nextClusterId>11</nextClusterId>
  <nextAutoInputStart>1</nextAutoInputStart>
  <relation></relation>
  <skip>0</skip>
  <requiredValue></requiredValue>
  <customMasterSearchField></customMasterSearchField>
  <checkGroupIdMode></checkGroupIdMode>
  <noNeedToFillOut>0</noNeedToFillOut>
  <terminalType>0</terminalType>
  <nextAutoInput>0</nextAutoInput>
  <nextAutoInputEdit>0</nextAutoInputEdit>
  <valueLinks>
    <valueLink>
      <parentValue>A</parentValue>
      <selectValues>X,Y</selectValues>
    </valueLink>
    <valueLink>
      <parentValue>B</parentValue>
      <selectValues>Z</selectValues>
    </valueLink>
  </valueLinks>
</network>
```

## 10. 外部生成でよくあるミス

- `sheetNo` を 0 始まりで出してしまう
- `clusterId` ではなく画面上の別番号を使ってしまう
- `valueLinks.parentValue` が親 `Items` に存在しない
- `valueLinks.selectValues` に子 `Items` に無い値を含める
- `selectValues` のカンマを `,,` でエスケープしない
- ネットワーク設定を `<cluster>` 側に持たせようとする
- `inputParameters` をオブジェクト構造で出してしまう

## 11. 安全な出力方針

外部ツールでは次の方針が安全です。

- 未使用項目もテンプレートに合わせて空要素で出す
- 数値フラグは空文字ではなく `0` / `1` を明示する
- `valueLinks` は親子 `Items` から機械生成する
- 文字列結合前に `;` と `,` のエスケープルールを必ず通す

## 12. 参照すべき実装

- ネットワークのモデル
  - `LibConMas/ImageDb/ClusterNetwork.cs`
- バリューリンクのモデル
  - `LibConMas/ImageDb/ValueLink.cs`
- トップ設定
  - `LibConMas/ImageDb/TopReport.cs`
- `inputParameters` 共通変換
  - `LibConMas/Domain/Helpers/CommonHelperMethods.cs`
  - `LibConMas/ImageDb/ClusterParameter.cs`
- XML テンプレート
  - `ConMasClient/template.xml`
- 読み書き実装
  - `ConMasClient/MainWindow.xaml.cs`

## 13. 関連資料

- `docs/architecture/i-reporter-network-function-summary.md`
- `docs/architecture/spec-network-settings.md`
- `docs/architecture/input-parameters.md`
- `docs/architecture/xml-schema-summary.md`
