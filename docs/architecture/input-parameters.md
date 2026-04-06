# inputParameters 仕様リファレンス

帳票定義 XML の `<inputParameters>` 要素（本文）と、ロード時に `BlankCluster.InputParameter`（C# では単数形のプロパティ名）に格納される文字列の仕様を、実装（`LibConMas`）からリバースエンジニアリングしたメモです。

**クラスタ種別の表示名（日英）と本仕様の対応関係**は **[cluster-types-external-reference.md](cluster-types-external-reference.md)** に統合してあります（外部開発者向け）。

**パラメータキーと Designer 画面上の日本語ラベル**は **[input-parameters-ui-labels.md](input-parameters-ui-labels.md)** を参照。

- XML 上の位置づけ: [xml-schema-summary.md](xml-schema-summary.md) の `<cluster>` 配下
- クラスタ種別一覧（MVP 等）: [cluster-types-reference.md](cluster-types-reference.md)

## 1. 概要

| 項目 | 名前 |
|------|------|
| XML 要素名 | `inputParameters` |
| C# (`BlankCluster` 等) | `InputParameter` |
| 意味 | クラスタ種別ごとの **UI・検証・表示** の細かい設定を、`key=value` を `;` で連結した1本の文字列として保持する |

**真実のソース**: 種別ごとに [`ClusterParameter.ToClusterParameter`](../../LibConMas/ImageDb/ClusterParameter.cs) が具象クラスを生成し、`ParameterText` の setter でパースされる。

## 2. 共通形式（エンコーディング）

実装: [`CommonHelperMethods.AsParametersDictionary`](../../LibConMas/Domain/Helpers/CommonHelperMethods.cs), [`ToInputParametersString`](../../LibConMas/Domain/Helpers/CommonHelperMethods.cs), [`GetTextValueFromParamText`](../../LibConMas/Domain/Helpers/CommonHelperMethods.cs)

| 規則 | 内容 |
|------|------|
| 区切り | トークンは `key=value`（キーは `(\w+)` — 英数字とアンダースコア） |
| 連結 | 複数トークンは `;` で連結 |
| 値に `;` を含める | `;;` にエスケープ。読み取り時に `;;` → `;` に戻す |
| `null` 値 | シリアライズ時はキーごと省略（`ToInputParametersString`） |
| 部分取得 | `GetTextValueFromParamText` は `;` と `;;` を区別して右辺を取り出す |

**補足**: `KeyboardTextClusterParameter` 系では、文字列内の改行を `\n` に置換して格納する処理がある（[`ParameterMapper`](../../LibConMas/Domain/Helpers/ParameterMapper.cs)）。

## 3. ClusterType → 実装クラス索引

`ClusterParameter.ClusterTypeCount` は **38**。`DefaultClusterSetting` の配列インデックス `stDefaults[0..37]` が **同じ順序**で各型のデフォルト文字列に対応する。

| stDefaults | ClusterType | 実装クラス | パース方式 |
|------------|-------------|------------|------------|
| [0] | KeyboardText (30) | [`KeyboardTextClusterParameter`](../../LibConMas/Domain/Entities/KeyboardTextClusterParameter.cs) | **ParameterMapper**（キーはプロパティ名） |
| [1] | Handwriting (119) | [`HandwritingClusterParameter`](../../LibConMas/ImageDb/HandwritingClusterParameter.cs) | 手動 `Item*` 定数 |
| [2] | FixedText (20) | [`FixedTextClusterParameter`](../../LibConMas/ImageDb/FixedTextClusterParameter.cs) | 手動（`TextClusterParameter` 継承） |
| [3] | FreeText (10) | [`FreeTextClusterParameter`](../../LibConMas/ImageDb/FreeTextClusterParameter.cs) | 手動 |
| [4] | Numeric (60) | [`NumericClusterParameter`](../../LibConMas/ImageDb/NumericClusterParameter.cs) | 手動 |
| [5] | InputNumeric (65) | [`InputNumericClusterParameter`](../../LibConMas/ImageDb/InputNumericClusterParameter.cs) | 手動 |
| [6] | NumberHours (110) | [`NumberHoursClusterParameter`](../../LibConMas/ImageDb/NumberHoursClusterParameter.cs) | 手動 |
| [7] | Calculate (67) | [`CalculateClusterParameter`](../../LibConMas/ImageDb/CalculateClusterParameter.cs) | 手動 |
| [8] | Date (40) | [`DateClusterParameter`](../../LibConMas/ImageDb/DateClusterParameter.cs) | 手動 |
| [9] | CalendarDate (111) | [`CalendarDateClusterParameter`](../../LibConMas/ImageDb/CalendarDateClusterParameter.cs) | 手動 |
| [10] | Time (50) | [`TimeClusterParameter`](../../LibConMas/ImageDb/TimeClusterParameter.cs) | 手動 |
| [11] | Check (90) | [`CheckClusterParameter`](../../LibConMas/ImageDb/CheckClusterParameter.cs) | 手動 |
| [12] | MultipleChoiceNumber (123) | [`MultipleChoiceNumberParameter`](../../LibConMas/ImageDb/MultipleChoiceNumberParameter.cs) | 手動 |
| [13] | MCNCalculate (124) | [`MCNCalculateParameter`](../../LibConMas/ImageDb/MCNCalculateParameter.cs) | 手動 |
| [14] | Select (70) | [`SelectClusterParameter`](../../LibConMas/ImageDb/SelectClusterParameter.cs) | 手動 |
| [15] | MultiSelect (80) | [`MultiSelectClusterParameter`](../../LibConMas/ImageDb/MultiSelectClusterParameter.cs) | 手動 |
| [16] | Image (100) | [`ImageClusterParameter`](../../LibConMas/ImageDb/ImageClusterParameter.cs) | 手動 |
| [17] | Create (116) | [`CreateClusterParameter`](../../LibConMas/ImageDb/CreateClusterParameter.cs) | 手動 |
| [18] | Inspect (117) | [`InspectClusterParameter`](../../LibConMas/ImageDb/InspectClusterParameter.cs) | 手動 |
| [19] | Approve (118) | [`ApproveClusterParameter`](../../LibConMas/ImageDb/ApproveClusterParameter.cs) | 手動 |
| [20] | Registration (112) | [`RegistrationClusterParameter`](../../LibConMas/ImageDb/RegistrationClusterParameter.cs) | 手動 |
| [21] | RegistrationDate (113) | [`RegistrationDateClusterParameter`](../../LibConMas/ImageDb/RegistrationDateClusterParameter.cs) | 手動 |
| [22] | LatestUpdate (114) | [`LatestUpdateClusterParameter`](../../LibConMas/ImageDb/LatestUpdateClusterParameter.cs) | 手動 |
| [23] | LatestUpdateDate (115) | [`LatestUpdateDateClusterParameter`](../../LibConMas/ImageDb/LatestUpdateDateClusterParameter.cs) | 手動 |
| [24] | QRCode (121) | [`QRCodeClusterParameter`](../../LibConMas/ImageDb/QRCodeClusterParameter.cs) | 手動 |
| [25] | CodeReader (122) | [`CodeReaderClusterParameter`](../../LibConMas/ImageDb/CodeReaderClusterParameter.cs) | 手動 |
| [26] | Gps (120) | [`GpsClusterParameter`](../../LibConMas/ImageDb/GpsClusterParameter.cs) | 手動 |
| [27] | FreeDraw (15) | [`FreeDrawClusterParameter`](../../LibConMas/ImageDb/FreeDrawClusterParameter.cs) | 手動 |
| [28] | TimeCalculate (55) | [`TimeCalculateClusterParameter`](../../LibConMas/ImageDb/TimeCalculateClusterParameter.cs) | 手動 |
| [29] | SelectMaster (125) | [`SelectMasterClusterParameter`](../../LibConMas/ImageDb/SelectMasterClusterParameter.cs) | 手動 |
| [30] | Action (126) | [`ActionClusterParameter`](../../LibConMas/ImageDb/ActionClusterParameter.cs) | 手動（キー数が多い） |
| [31] | LoginUser (127) | [`LoginUserClusterParameter`](../../LibConMas/ImageDb/LoginUserClusterParameter.cs) | 手動 |
| [32] | DrawingImage (128) | [`DrawingImageClusterParameter`](../../LibConMas/ImageDb/DrawingImageClusterParameter.cs) | 手動 |
| [33] | DrawingPinNo (129) | [`DrawingPinNoClusterParameter`](../../LibConMas/ImageDb/DrawingPinNoClusterParameter.cs) | 手動 |
| [34] | PinItemTableNo (130) | [`PinItemTableNoClusterParameter`](../../LibConMas/ImageDb/PinItemTableNoClusterParameter.cs) | 手動 |
| [35] | AudioRecording (131) | [`AudioRecordingClusterParameter`](../../LibConMas/ImageDb/AudioRecordingClusterParameter.cs) | 手動 |
| [36] | Scandit (132) | [`ScanditClusterParameter`](../../LibConMas/ImageDb/ScanditClusterParameter.cs) | 手動 |
| [37] | EdgeOCR (133) | [`EdgeOCRClusterParameter`](../../LibConMas/ImageDb/EdgeOCRClusterParameter.cs) | 手動 |

`ClusterType` に対応する具象が無い場合は `switch` の `default` により `null` となる（例: Table, Omr 系などは別経路）。

## 4. 型別キー一覧

**手動パース型**: 各ファイル先頭付近の `public static readonly string ItemXxx = "KeyName";` が **正式なキー名**（リバースエンジニアリングの最短ルート）。

### 4.1 KeyboardText (ParameterMapper)

ソース: [`KeyboardTextClusterParameter`](../../LibConMas/Domain/Entities/KeyboardTextClusterParameter.cs)

- キー名は **public プロパティ名**（`[Ignore]` 付きはシリアライズ対象外）。
- 主なキー: `AutoNumber`, `Required`, `CanUseCustomKeypad`, `CanUseCustomNumpad`, `InputRestriction`, `ProhibitedCharacters`, `MaxLength`, `PaddingDirection`, `PaddingCharacter`, `FontPriority`, `Lines`, `Align`, `VerticalAlignment`, `Font`, `FontSize`, `DefaultFontSize`, `Weight`, `Color`（RGB 文字列）, `EnableAutoFontSize`, `DefaultText`, `Locked`
- シリアライズ時は `AutoNumber` / `MaxLength` に応じて出力キーが絞られる（`keysWhenAutonumberMode`, `keysWhenMaxLength0` 参照）。

### 4.2 テキスト系（FixedText / FreeText）

- **FixedText** [`FixedTextClusterParameter`](../../LibConMas/ImageDb/FixedTextClusterParameter.cs): `Required`, `Lines`（基底 [`TextClusterParameter`](../../LibConMas/ImageDb/TextClusterParameter.cs)）, `Width`, `Color`
- **FreeText** [`FreeTextClusterParameter`](../../LibConMas/ImageDb/FreeTextClusterParameter.cs): `Width`, `Color`, `EnableShortcut`, `PhotoDate`

### 4.3 数値・計算

- **Numeric** [`NumericClusterParameter`](../../LibConMas/ImageDb/NumericClusterParameter.cs): `Required`, `Minimum`, `MinCluster`, `Maximum`, `MaxCluster`, `Stepping`, `Decimal`, `TruncateZeroMode`, `ShowPercent`, `Default`, `Selected`, `Align`, `VerticalAlignment`, `Comma`, `Prefix`, `Suffix`, `Font`, `FontSize`, `DefaultFontSize`, `Weight`, `Color`, `EnableAutoFontSize`, `CounterMode`, `AllowMin*` / `AllowMax*` 系, `Locked`
- **InputNumeric** [`InputNumericClusterParameter`](../../LibConMas/ImageDb/InputNumericClusterParameter.cs): 上記に近いが入力用。`KeypadMode`, `TerminationCode`, `TerminationMode`, `Locked` 等（ファイル内 `Item` 一覧が全キー）
- **NumberHours** [`NumberHoursClusterParameter`](../../LibConMas/ImageDb/NumberHoursClusterParameter.cs): `Required`, `InputType`, `Maximum`, `MaxCluster`, `Decimal`, `TruncateZeroMode`, `TimeFormat`, `TimeUnit`, `Suffix`, フォント系, `AllowMin*` / `AllowMax*`, `Locked`
- **Calculate** [`CalculateClusterParameter`](../../LibConMas/ImageDb/CalculateClusterParameter.cs): `Function`（計算式）, `Validation`, `Minimum`, `Maximum`, `Decimal`, `Comma`, `FunctionVersion`, `DataType`, `ErrorType`, `DateFormat`, `AcrossDayMode`, `Day`, `nz`, `Visible`, フォント系, `AllowMin*` / `AllowMax*`, `Locked` 等
- **MCNCalculate** [`MCNCalculateParameter`](../../LibConMas/ImageDb/MCNCalculateParameter.cs): `Group`, `TotalLabels`, `DenominatorLabel`, `OutsideLabels` を含む MCN 固有キー + 数値・フォント系
- **TimeCalculate** [`TimeCalculateClusterParameter`](../../LibConMas/ImageDb/TimeCalculateClusterParameter.cs): `Function`, `InputType`, `TimeCalculateType`, `TimeFormat`, `DateFormat`, `TimeUnit`, `IntermissionStart`, `IntermissionEnd`, フォント系, `AllowMin*` / `AllowMax*`, `Locked`

### 4.4 日付・時刻

- **Date** / **CalendarDate**: [`DateClusterParameter`](../../LibConMas/ImageDb/DateClusterParameter.cs), [`CalendarDateClusterParameter`](../../LibConMas/ImageDb/CalendarDateClusterParameter.cs) — `Required`, `AutoInput`, `DateFormat`, `FirstOnly`, `Editable`, `ConfirmDialog`, `Day`, `UseTime`, `TimeFormat`, フォント系, `Locked`
- **Time** [`TimeClusterParameter`](../../LibConMas/ImageDb/TimeClusterParameter.cs): 上記に近い。`DateFormat` は時刻クラスタでは主にフォーマット文字列として利用

### 4.5 選択・チェック

- **Select** [`SelectClusterParameter`](../../LibConMas/ImageDb/SelectClusterParameter.cs): `Items`, `Labels`, `PinColors`, `Selected`, `Default`, `Display`, `ToggleInput`, `ColorManageCluster`, `UseSelectGateway`, `LineSelectItemMode` 等 + フォント + キーボード補助 (`UseKeyboard`, `InputRestriction`, …)
- **MultiSelect** [`MultiSelectClusterParameter`](../../LibConMas/ImageDb/MultiSelectClusterParameter.cs): `Items`, `Labels`, `Selected`, `Punctuation`, `Default`, `Display`, フォント系, キーボード補助
- **MultipleChoiceNumber** [`MultipleChoiceNumberParameter`](../../LibConMas/ImageDb/MultipleChoiceNumberParameter.cs): `Items`, `Labels`, `Colors`, `Markers`, `BrushColors`, `LineWidths`, `LineColors`, `BrushOpacitys`, `ClearOption`, `Group`, キーボード補助
- **Check** [`CheckClusterParameter`](../../LibConMas/ImageDb/CheckClusterParameter.cs): `Required`, `Marker`, `LineColor`, `LineWidth`, `BrushColor`, `Group`, `UseKeyboard`, `InputRestriction`, …

### 4.6 メディア・読取

- **Image** [`ImageClusterParameter`](../../LibConMas/ImageDb/ImageClusterParameter.cs): `Required`, `IsOriginal`（表示モード値としても使用）, `ImageSize`, `EnableShortcut`, `PhotoDate`
- **FreeDraw** [`FreeDrawClusterParameter`](../../LibConMas/ImageDb/FreeDrawClusterParameter.cs): `Width`, `Color`, `IsOriginal`, `ImageSize`, `EnableShortcut`, `PhotoDate`, `AutoStartCamera`, `PickView`, `IsOriginalWhole`, `WholeImageSize`, `InternalImageFormat`, `MinimumEditSize`, `MinimumEditTop`, `URLToOpen`
- **Handwriting** [`HandwritingClusterParameter`](../../LibConMas/ImageDb/HandwritingClusterParameter.cs): `Required`, `Lines`, `FontPriority`, `Align`, `VerticalAlignment`, フォント系, `EnableAutoFontSize`, `Locked`
- **QRCode** [`QRCodeClusterParameter`](../../LibConMas/ImageDb/QRCodeClusterParameter.cs): `Required`, `IsNumeric`, `UseExternalDevice`, `Lines`, フォント系, `DefaultCamera`, `Locked`
- **CodeReader** [`CodeReaderClusterParameter`](../../LibConMas/ImageDb/CodeReaderClusterParameter.cs): `Required`, `Lines`, フォント系, `Locked`
- **Scandit** [`ScanditClusterParameter`](../../LibConMas/ImageDb/ScanditClusterParameter.cs): `ScanditMode`, `DisplayString`, `BackgroundColor`, `FontPriority`, `IsNumeric`, `DefaultCamera`, フォント系, `Locked`
- **EdgeOCR** [`EdgeOCRClusterParameter`](../../LibConMas/ImageDb/EdgeOCRClusterParameter.cs): `DisplayString`, `BackgroundColor`, `FontPriority`, `IsNumeric`, `DefaultCamera`, フォント系, `Locked`（`Required` は `Item` 定数に無い — 実装を参照）

### 4.7 ワークフロー・登録情報

- **Create** / **Inspect**: [`CreateClusterParameter`](../../LibConMas/ImageDb/CreateClusterParameter.cs), [`InspectClusterParameter`](../../LibConMas/ImageDb/InspectClusterParameter.cs) — `Required`, `SignType`, `SignShortcut`
- **Approve** [`ApproveClusterParameter`](../../LibConMas/ImageDb/ApproveClusterParameter.cs): `Required`, `SignType`, `QuickSave`, `RequiredCheck`
- **Registration** [`RegistrationClusterParameter`](../../LibConMas/ImageDb/RegistrationClusterParameter.cs): フォント系 + `DisplayUserName`
- **RegistrationDate** / **LatestUpdateDate** [`RegistrationDateClusterParameter`](../../LibConMas/ImageDb/RegistrationDateClusterParameter.cs), [`LatestUpdateDateClusterParameter`](../../LibConMas/ImageDb/LatestUpdateDateClusterParameter.cs): `DateFormat`, `Day`, フォント系
- **LatestUpdate** [`LatestUpdateClusterParameter`](../../LibConMas/ImageDb/LatestUpdateClusterParameter.cs): フォント系 + `DisplayUserName`

### 4.8 その他

- **Gps** [`GpsClusterParameter`](../../LibConMas/ImageDb/GpsClusterParameter.cs): フォント系のみ（`Required` なし）
- **LoginUser** [`LoginUserClusterParameter`](../../LibConMas/ImageDb/LoginUserClusterParameter.cs): `Required`, `AutoInput`, `FirstOnly`, `ConfirmDialog`, `Day`, `DisplayUserName`, フォント系, `Locked`
- **SelectMaster** [`SelectMasterClusterParameter`](../../LibConMas/ImageDb/SelectMasterClusterParameter.cs): `MasterTableId`, `MasterTableName`, `MasterFieldNo`, `MasterFieldName`, `Group`, `GroupIndex`, ゲートウェイ系 (`GatewayMode`, `URLToOpen`, `TokenText`, …), フォント系, キーボード補助
- **DrawingImage** [`DrawingImageClusterParameter`](../../LibConMas/ImageDb/DrawingImageClusterParameter.cs): `PinDefaultColor`, `PinDetailViewHorizontalPosition`, `PinDetailViewVerticalPosition`, `EnableShortcut`, `Locked`
- **DrawingPinNo** [`DrawingPinNoClusterParameter`](../../LibConMas/ImageDb/DrawingPinNoClusterParameter.cs): `PinNoType`, フォント系, `Locked`
- **PinItemTableNo** [`PinItemTableNoClusterParameter`](../../LibConMas/ImageDb/PinItemTableNoClusterParameter.cs): フォント系, `Locked`
- **AudioRecording** [`AudioRecordingClusterParameter`](../../LibConMas/ImageDb/AudioRecordingClusterParameter.cs): `Required`, `RecordingTime`, `DisplayMode`, `Message`, 録音前後の見た目（`Recorded*` キー群）— ファイル内 `Item` 定数が全キー

### 4.9 Action（アクション）

ソース: [`ActionClusterParameter`](../../LibConMas/ImageDb/ActionClusterParameter.cs)

ボタン見た目（`ButtonFontPriority`, `ButtonLines`, `ButtonFont`, …）、`ActionType`, `DocumentId`, `JumpSheetNo`, `Menu`, `URLToOpen`, `TokenText`, レポートコピー (`CopyCount`, `CopyValue`, …), 外部連携 (`Command`, `ReturnValue`, …), QR 関連, `BmSetLoginUserId` など **多数の `Item*` 定数** が並ぶ。詳細はソース先頭の定数一覧とコンストラクタ以降の `item.Key ==` 分岐を参照。

## 5. 既知の落とし穴・メンテナンス

- **Designer 全体の XML**: [conmas-xml-pitfalls.md](../modernization/conmas-xml-pitfalls.md)
- **キー名の揺れ**: 実データでは過去バージョン由来のキーや、テスト用 XML だけに現れる組み合わせがある。疑わしい場合は `UnitTests` 付属 XML や Designer が出力した実ファイルと突き合わせる。
- **完全なデフォルト**: `stDefaults[i]` と [`BlankCluster`](../../ConMasClient/Data/BlankCluster.cs) / テンプレート XML の両方を見ると安全。

## 6. 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-03-28 | 初版 — `ClusterParameter` 索引と `Item*` 定数ベースのキー整理 |
