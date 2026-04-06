# カーボンコピー XML 生成ガイド

外部ツールから ConMas / i-Reporter 帳票 XML を生成する人向けに、カーボンコピー設定の生成ルールを実務寄りにまとめたガイドです。

この文書は「XML をどう出すべきか」に集中しています。

## 1. 先に結論

カーボンコピーを外部生成するときの要点は次です。

- カーボンコピーは `<top>` ではなく、コピー元クラスターの `<carbonCopy>` に出す
- `<targetCluster>` を 1 件ずつ列挙する
- `sheetNo` は 1 始まり
- `clusterId` はコピー先クラスターの `clusterId`
- `edit`
  - `0`: コピー先編集不可
  - `1`: コピー先編集可
- コピー先の `inputParameters` は親と整合した内容で出す
- `edit=0` のときはコピー先に `Locked=1` を入れておくのが安全
- `reportCopy` とは別機能

## 2. どこに何を出すか

コピー元クラスター:

```xml
<cluster>
  <sheetNo>1</sheetNo>
  <clusterId>10</clusterId>
  <type>70</type>
  <inputParameters>Items=A,B;Labels=AA,BB</inputParameters>
  <carbonCopy>
    <targetCluster>
      <sheetNo>1</sheetNo>
      <clusterId>11</clusterId>
      <edit>0</edit>
    </targetCluster>
  </carbonCopy>
</cluster>
```

コピー先クラスター:

```xml
<cluster>
  <sheetNo>1</sheetNo>
  <clusterId>11</clusterId>
  <type>70</type>
  <inputParameters>Items=A,B;Labels=AA,BB;Locked=1</inputParameters>
</cluster>
```

重要:

- コピー元にだけ `<carbonCopy>` を持たせる
- コピー先には `<carbonCopy>` を持たせない
- コピー先のロックや設定整合は `inputParameters` 側で表現する

## 3. 最小 XML 例

```xml
<cluster>
  <sheetNo>1</sheetNo>
  <clusterId>10</clusterId>
  <name>親</name>
  <type>30</type>
  <inputParameters>Required=0</inputParameters>
  <carbonCopy>
    <targetCluster>
      <sheetNo>1</sheetNo>
      <clusterId>11</clusterId>
      <edit>0</edit>
    </targetCluster>
  </carbonCopy>
</cluster>

<cluster>
  <sheetNo>1</sheetNo>
  <clusterId>11</clusterId>
  <name>子</name>
  <type>30</type>
  <inputParameters>Required=0;Locked=1</inputParameters>
</cluster>
```

## 4. 生成ルール

### 4.1 コピー元の決め方

1 つのコピー元クラスターに対して、複数のコピー先を持たせることができます。

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

ただし、コピー先は一意であるべきです。

- 同じコピー先を複数の親に持たせない
- コピー先が別のカーボンコピーのコピー元になる構成も避ける
- 逆向きの相互参照は避ける

## 5. `edit` の扱い

### 5.1 `edit=0`

意味:

- コピー先は編集不可

推奨:

- コピー先 `inputParameters` に `Locked=1` を入れる

### 5.2 `edit=1`

意味:

- コピー先は編集可能

推奨:

- `Locked=1` を付けない
- 既に `Locked=0` を使っているデータ設計ならそれでもよい

注意:

- 秒またはミリ秒付き時刻クラスターでは `edit=1` は避ける

## 6. コピー先 `inputParameters` をどう作るか

Designer でカーボンコピーを作ると、コピー先の `inputParameters` はコピー元に寄せられます。  
外部ツールでも、同じ最終状態を出しておくのが安全です。

基本方針:

- コピー先 `inputParameters` はコピー元と同じ内容にする
- そのうえで `edit=0` なら `Locked=1` を付与する

### 6.1 単純例

親:

```text
Required=1;Lines=1;Font=Meiryo;FontSize=12
```

子:

```text
Required=1;Lines=1;Font=Meiryo;FontSize=12;Locked=1
```

## 7. 選択系クラスターの注意

対象:

- `Select`
- `MultiSelect`
- `MultipleChoiceNumber`

これらは、親子で少なくとも次を一致させてください。

- `Items`
- `Labels`

例:

```text
Items=A,B,C;Labels=選択A,選択B,選択C
```

親子で不一致だと、Designer の保存時チェックや運用で問題になります。

## 8. `SelectMaster` の注意

`SelectMaster` は単純コピーより少し厳格です。

外部生成時の推奨:

- 親子で同じ `MasterTableId`
- 親子で同じ `MasterFieldNo`
- 親子で同じ `CustomMasterID`
- 親子で同じ `CustomMasterFieldNo`
- コピー先は `Group=-1` または未設定
- コピー先は `GroupIndex` を持たせない

つまり、子の `inputParameters` は次のような形が安全です。

```text
MasterTableId=100;MasterFieldNo=2;Group=-1
```

## 9. 計算式クラスターの注意

計算式クラスターにカーボンコピーを使う場合、Designer はコピー先に `CarbonCopy=1` を追加します。

推奨:

- コピー先 `inputParameters` に `CarbonCopy=1` を入れる
- `Function` / `DisplayFunction` も親に揃える
- `ExcelFunction` も親に揃える

例:

```text
Function==A+B;DisplayFunction==A+B;Locked=1;CarbonCopy=1
```

## 10. 外部生成アルゴリズム

推奨手順:

1. 全クラスターの `sheetNo` と `clusterId` を確定する
2. 親子関係を決める
3. 親子が同じクラスター種別であることを確認する
4. コピー先が他のカーボンコピーのコピー先になっていないことを確認する
5. コピー元 `inputParameters` を基準に、コピー先 `inputParameters` を揃える
6. `edit=0` ならコピー先に `Locked=1` を入れる
7. 親クラスターの `<carbonCopy>` に `<targetCluster>` を列挙する

## 11. 安全なバリデーション項目

外部ツールで事前チェックしておくと安全な項目:

- 親子が同じ `type`
- 親子が同一クラスターではない
- コピー先が複数親を持っていない
- コピー先が他のカーボンコピーのコピー元になっていない
- コピー先が `reportCopy` の移動先になっていない
- コピー先がカスタムマスター子クラスターではない
- 選択系なら `Items` / `Labels` 一致
- `SelectMaster` ならマスター情報一致
- 時刻クラスターで `edit=1` を無理に使わない

## 12. 生成しない方がよいケース

少なくとも次は対象外にした方が安全です。

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

## 13. `reportCopy` と混同しない

カーボンコピー:

```xml
<carbonCopy>
  <targetCluster>
    <sheetNo>1</sheetNo>
    <clusterId>11</clusterId>
    <edit>0</edit>
  </targetCluster>
</carbonCopy>
```

帳票コピー時移動:

```xml
<reportCopy>
  <clear>1</clear>
  <displayDefaultValue>0</displayDefaultValue>
  <targetCluster>
    <sheetNo>1</sheetNo>
    <clusterId>11</clusterId>
  </targetCluster>
</reportCopy>
```

用途も意味も別です。

## 14. よくあるミス

- コピー先クラスター側にも `<carbonCopy>` を持たせてしまう
- `sheetNo` を 0 始まりで出す
- `clusterId` ではなく別の表示番号を使う
- コピー先に `Locked=1` を入れない
- 親子で `Items` や `Labels` がズレている
- `SelectMaster` の `Group` をそのままコピーしてしまう
- `reportCopy` をカーボンコピーと混同する

## 15. 実装参照

- `LibConMas/ImageDb/CarbonCopy.cs`
- `ConMasClient/MainWindow.xaml.cs`
- `ConMasClient/template.xml`
- `LibConMas/Domain/Helpers/CommonHelperMethods.cs`

## 16. 関連資料

- `docs/architecture/spec-carbon-copy-settings.md`
- `docs/architecture/input-parameters.md`
- `docs/architecture/xml-schema-summary.md`
