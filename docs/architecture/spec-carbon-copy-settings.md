# カーボンコピー設定

ConMas Designer / i-Reporter のカーボンコピー機能を、リポジトリ内の実装から整理した仕様メモです。

この文書の対象は次です。

- XML 上でどこに保存されるか
- `inputParameters` とどう関係するか
- `edit` と `Locked` の意味
- 設定可能条件と保存時の挙動
- 帳票コピー時移動 (`reportCopy`) との違い

## 1. 概要

カーボンコピーは、コピー元クラスターの入力値や設定をコピー先クラスターへ連動させる機能です。

実装上の特徴:

- コピー元クラスターの `<carbonCopy>` にコピー先一覧を持つ
- コピー先クラスター側に XML 上の逆参照は持たない
- コピー先の `inputParameters` は、Designer で設定時にコピー元に寄せて更新される
- コピー先は通常 `Locked=1` になり、編集不可になる
- `edit=1` を使うとコピー先を編集可能にできる

## 2. XML 上の配置

カーボンコピーはトップ配下ではなく、各 `<cluster>` の中に保存されます。

```xml
<cluster>
  ...
  <inputParameters>...</inputParameters>
  <carbonCopy>
    <targetCluster>
      <sheetNo>2</sheetNo>
      <clusterId>5</clusterId>
      <edit>0</edit>
    </targetCluster>
  </carbonCopy>
  <reportCopy>
    <clear></clear>
    <displayDefaultValue></displayDefaultValue>
  </reportCopy>
  ...
</cluster>
```

重要:

- `<carbonCopy>` はカーボンコピー
- `<reportCopy>` は帳票コピー時移動

見た目は近いですが、別機能です。

## 3. XML 構造

### 3.1 コピー元クラスター

コピー元は、自分の `<carbonCopy>` の中にコピー先を列挙します。

```xml
<carbonCopy>
  <targetCluster>
    <sheetNo>1</sheetNo>
    <clusterId>11</clusterId>
    <edit>0</edit>
  </targetCluster>
  <targetCluster>
    <sheetNo>2</sheetNo>
    <clusterId>3</clusterId>
    <edit>1</edit>
  </targetCluster>
</carbonCopy>
```

つまり 1 つのコピー元から複数のコピー先を持てます。

### 3.2 `targetCluster` の各要素

| 要素 | 型 | 意味 |
|------|----|------|
| `sheetNo` | int | コピー先シート番号。XML 上は 1 始まり |
| `clusterId` | int | コピー先クラスターの `clusterId` |
| `edit` | int | 後続編集可否。`0` = 不可、`1` = 可能 |

### 3.3 `edit` の既定値

`edit` が未指定の場合、読み込み時は「編集不可」扱いです。

- `edit=1`
  - UI 表示: `可能`
- `edit=0` または要素なし
  - UI 表示: `不可`

## 4. モデル

主要クラス:

- `LibConMas/ImageDb/CarbonCopy.cs`
  - `PcopySheetNo`, `PcopyIndex`, `PcopyName`
  - `ScopySheetNo`, `ScopyIndex`, `ScopyName`
  - `Edit`
- `LibConMas/Domain/Helpers/CommonHelperMethods.cs`
  - `GetCarbonCopiesUsesCluster`
  - `GetCarbonCopiesToUsesCluster`

保存時・読込時とも、内部では「コピー元/コピー先」のペア一覧として扱われています。

## 5. Designer で設定したときの実際の変更

カーボンコピーを設定すると、Designer は単に `<carbonCopy>` を追加するだけではありません。

### 5.1 コピー先の `inputParameters` をコピー元に揃える

コピー元とコピー先で `InputParameter` が異なる場合、コピー先をコピー元に合わせます。

代表的な処理:

- コピー先 `InputParameter = コピー元 InputParameter`
- コピー先 `ExcelFunction = コピー元 ExcelFunction`
- `SelectMaster` の場合は `ActionPost` もコピー
- カスタムマスター関連
  - `CustomMasterID`
  - `CustomMasterKey`
  - `CustomMasterFieldNo`
  - `CustomMasterFieldName`
  もコピー元に揃える

### 5.2 コピー先をロックする

通常はコピー先に `Locked=1` を付与します。

```text
Items=A,B;Labels=AA,BB;Locked=1
```

既に `Locked=0` があれば `Locked=1` に置換します。

### 5.3 計算式クラスターの特例

コピー先が `Calculate` の場合、`inputParameters` に `CarbonCopy=1` を追加します。

```text
Function=...;DisplayFunction=...;Locked=1;CarbonCopy=1
```

これは後続の計算式整合処理で使われる補助フラグです。

## 6. `edit` と `Locked` の関係

`edit` は XML 上のフラグですが、実質的にはコピー先の編集ロック制御に関わります。

### 6.1 `edit=0`

- コピー先は通常編集不可
- `Locked=1` が必要

### 6.2 `edit=1`

- コピー先を編集可能にできる
- 実装上はロック解除側に寄る

ただし、次のようなケースでは `edit=1` にできません。

- コピー先が秒またはミリ秒を含む時刻クラスター

その場合は `mainMessageCopy16` のエラーになります。

## 7. 設定可能条件

### 7.1 基本条件

- コピー元とコピー先は同じクラスター種別である必要がある
- 同一クラスター同士は不可
- 同じ組み合わせの重複登録は不可
- 逆向きの相互設定によるループは不可
- コピー先は 1 つの親しか持てない
- コピー先が別のカーボンコピーのコピー元になっている状態も不可

### 7.2 対象外クラスター種別

少なくとも次は対象外です。

- `Registration`
- `RegistrationDate`
- `LatestUpdate`
- `LatestUpdateDate`
- `Gps`
- `Action`
- `DrawingImage`
- `DrawingPinNo`
- `PinItemTableNo`
- `Scandit`
- `EdgeOCR`

実装上は、UI の対象外定義と、Excel 取込系の補助ロジックで若干の差があります。  
外部生成では上記を対象外として扱うのが安全です。

## 8. `inputParameters` に依存する制約

カーボンコピーは XML 構造だけでは完結せず、親子クラスターの `inputParameters` と整合している必要があります。

### 8.1 選択系クラスター

対象:

- `Select`
- `MultiSelect`
- `MultipleChoiceNumber`

コピー元とコピー先で次が一致している必要があります。

- `Items`
- `Labels`

不一致だと保存時チェックでエラーになります。

### 8.2 マスター選択

`SelectMaster` は次が一致している必要があります。

- `CustomMasterID`
- `CustomMasterFieldNo`
- `inputParameters` 内の
  - `MasterTableId`
  - `MasterFieldNo`

さらに、コピー先は `Group=-1` か未設定でないと設定できません。

### 8.3 時刻クラスター

秒またはミリ秒単位の時刻書式と、自動入力設定の組み合わせには制限があります。  
また、コピー先を編集可能にする (`edit=1`) ことも制限されます。

### 8.4 キーボードテキスト

自動採番表示に使っているキーボードテキストは、カーボンコピー対象外です。

### 8.5 単一選択 + Gateway

`Select` クラスターで `UseSelectGateway=1` の場合は対象外です。

## 9. 併用不可・競合チェック

コピー先として使えない代表例:

- 既に帳票コピー時移動 (`reportCopy`) のコピー先
- 既にカスタムマスターの子クラスター
- 既にデバイスコード分解先
- 既にバーコード分解先
- 既に QR コード生成の出力先画像
- しきい値参照関係にあるクラスター同士
- EdgeOCR の読取表・出力先に絡むクラスター
- SCANDIT の読取表やエビデンス画像に使われるクラスター

## 10. 保存時の XML 生成

保存時は `template.xml` の `variables/carbonCopyTargetCluster/targetCluster` を雛形にして、コピー元クラスターごとに `<carbonCopy>` を組み立てます。

動き:

1. `GridCarbonCopyList` から、現在のクラスターがコピー元の行を集める
2. `<cluster><carbonCopy>` に `<targetCluster>` を追加する
3. `sheetNo`, `clusterId`, `edit` を埋める
4. 1 件も無い場合は `<carbonCopy>` 自体を削除する

つまり、空の `<carbonCopy></carbonCopy>` を常に出すわけではありません。

## 11. 読み込み時の挙動

読み込み時は、各クラスターの `<carbonCopy><targetCluster>` を読み、内部の `GridCarbonCopyList` にフラットな一覧として積み直します。

親情報:

- 現在読んでいるクラスター自身

子情報:

- `targetCluster.sheetNo`
- `targetCluster.clusterId`
- `targetCluster.edit`

また、シート複製や番号更新時には `sheetNo` / `clusterId` の参照先が更新されます。

## 12. 帳票コピー時移動との違い

`reportCopy` は別機能です。

### 12.1 カーボンコピー

場所:

```xml
<cluster>
  <carbonCopy>
    <targetCluster>...</targetCluster>
  </carbonCopy>
</cluster>
```

意味:

- コピー元からコピー先へ値や設定を連動
- コピー先のロック制御あり

### 12.2 帳票コピー時移動

場所:

```xml
<cluster>
  <reportCopy>
    <clear>...</clear>
    <displayDefaultValue>...</displayDefaultValue>
    <targetCluster>...</targetCluster>
  </reportCopy>
</cluster>
```

意味:

- 帳票コピー時の移動先 / クリア / デフォルト表示制御

両者は XML も挙動も別です。

## 13. 外部ツール向けの要点

外部ツールで XML を作る場合の実務上の要点:

- 親クラスター側の `<carbonCopy>` に子一覧を出す
- 子クラスター側に逆参照は出さない
- コピー先の `inputParameters` は、親と整合する内容で出しておく
- `edit=0` ならコピー先 `inputParameters` に `Locked=1` を入れておくのが安全
- `Calculate` のコピー先なら `CarbonCopy=1` も付ける方が実装整合性が高い
- `reportCopy` と混同しない

## 14. 実装参照

- `LibConMas/ImageDb/CarbonCopy.cs`
- `LibConMas/Domain/Helpers/CommonHelperMethods.cs`
- `ConMasClient/MainWindow.xaml.cs`
- `ConMasClient/template.xml`
- `ConMasClient/Common/MessageBoxCarbonCopySetting.xaml.cs`
- `ConMasClient/Classes/CarbonCopyEdit.cs`

## 15. 関連ドキュメント

- `docs/architecture/carbon-copy-external-tools.md`
- `docs/architecture/i-reporter-network-function-summary.md`
- `docs/architecture/i-reporter-network-function-external-tools.md`
- `docs/architecture/input-parameters.md`
- `docs/architecture/xml-schema-summary.md`
