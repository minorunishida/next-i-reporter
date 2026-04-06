# inputParameters キーと画面上の名称（日本語）対応表

外部開発者向け。**ストレージ上のキー名**（`Required=...` の `Required`）と、ConMas Designer（Windows）の **入力パラメータ設定**タブでユーザーに見える文言の対応を示す。

**全 38 型を網羅する作業手順・チェックリスト・正確性ルール**は **[input-parameters-ui-labels-coverage-plan.md](input-parameters-ui-labels-coverage-plan.md)** を参照（本書は随時追記していく）。

- 文言のソース: 主に [`ConMasClient/iReporter.Language.xml`](../../ConMasClient/iReporter.Language.xml)（`lbl*` / `txt*` / `cbx*` / `rbtn*` 等）。一部は [`MainWindow.xaml`](../../ConMasClient/MainWindow.xaml) の固定文字列（言語切替で置換される場合あり）。
- キー名のソース: 各 `*ClusterParameter` の `Item*` 定数（[`input-parameters.md`](input-parameters.md) 参照）。

**注意**

- 種別ごとに表示される行が異なる。ここでは **例として画像（Image）と録音（AudioRecording）** を詳述し、**共通ラベル**と **Action / 全 Item 定数** を列挙する。
- iPhone / Android クライアントの文言は別リソースの可能性がある。

---

## 1. 複数クラスタ型で共通のラベル（言語 XML）

| キー（XML 要素名の一例） | 日本語（`iReporter.Language.xml`） | 典型な対応するパラメータキー |
|--------------------------|--------------------------------------|------------------------------|
| `lblClusterName` | 名前 | （クラスタ名自体は `inputParameters` 外） |
| `lblClusterType` | 種別 | `<type>` 数値 |
| `lblRequired` | 制約 | 見出し |
| `txtRequired` | 必須入力 | `Required` |
| `lblLines` | 行数 | `Lines` |
| `lblAlign` | 配置指定 | `Align` |
| `lblFont` | 書体指定 | `Font` |
| `lblFontSize` | 文字サイズ | `FontSize` |
| `lblWeight` | 太さ | `Weight` |
| `lblColor` | 文字色 | `Color` |
| `lblDateFormat` | 日付書式 | `DateFormat` |
| `lblTimeFormat` | 時間書式 | `TimeFormat` |
| `lblMin` / `lblMax` | 最小値 / 最大値 | `Minimum` / `Maximum` |
| `lblDecimal` | 小数点以下ケタ数 | `Decimal` |
| `lblPrefix` / `lblSuffix` | 接頭文字 / 接尾文字 | `Prefix` / `Suffix` |
| `gbExternal` | 外部システム連携 | 見出し |
| `lblExternal` | 連携可否 | 見出し |
| `txtExternal` | 連携する | 外部連携フラグ系（種別によりキー名は異なる） |

---

## 2. 画像クラスター（ClusterType.Image = 100）の例

[`ImageClusterParameter`](../../LibConMas/ImageDb/ImageClusterParameter.cs) の `Item*` と、日本語 UI の対応（Designer スクリーンショット・`iReporter.Language.xml` より）。

| パラメータキー | 日本語ラベル（代表） | 補足 |
|----------------|----------------------|------|
| `Required` | 制約 / 必須入力 | `lblRequired` + チェック「必須入力」(`txtRequired`) |
| `EnableShortcut` | タブレットのカメラ起動 | `lblShortcutCamera` — ショットでは「クラスタータップ時に自動でカメラを起動する」系チェックと対応 |
| `PhotoDate` | 撮影日時表示 | `lblPhotoDate`、詳細は `cbxPhotoDate`（撮影日時） / `cbxPhotoDate2`（日のみ） |
| `IsOriginal` | 画像の解像度 | `lblImageSize` — ラジオ `rbtnImageSizeMode0` クラスターサイズ / `rbtnImageSizeMode1` オリジナル / `rbtnImageSizeMode2` ピクセル指定 |
| `ImageSize` | （ピクセル指定時のサイズ等） | `lblImageSize` 配下のサイズ選択 |

**出典**: `lblImageSize`, `lblShortcutCamera`, `lblPhotoDate`, `rbtnImageSizeMode0` 等 — [`iReporter.Language.xml`](../../ConMasClient/iReporter.Language.xml) 行 655–767 付近。画像ブロックのレイアウト — [`MainWindow.xaml`](../../ConMasClient/MainWindow.xaml) 付近（`lblRequiredImage`, `lblImageSize` 等）。

---

## 3. 録音クラスター（ClusterType.AudioRecording = 131）

[`AudioRecordingClusterParameter`](../../LibConMas/ImageDb/AudioRecordingClusterParameter.cs) の `Item*` と日本語ラベル（言語 XML）。

| パラメータキー | 日本語ラベル（代表） |
|----------------|----------------------|
| `Required` | 制約 / 必須入力（共通） |
| `RecordingTime` | 最大録音時間 (`lblRecordingTime`) |
| `DisplayMode` | クラスターの表示 (`lblDisplayModeRecording`) — アイコン表示/文字表示 (`rbtnIconMode` / `rbtnTextMode`) |
| `Message` 系（録音前 UI） | 録音前メッセージ設定 (`lblRecordingBefore`)、録音前メッセージ (`lblRecordingMessage`) |
| `BackgroundColor`, `FontPriority`, `Lines`, `Align`, … | 録音前メッセージの見た目（各 `lbl*` と共通） |
| `RecordedMessage`, `RecordedBackgroundColor`, `RecordedFontPriority`, `RecordedLines`, `RecordedAlign`, `RecordedVerticalAlignment`, `RecordedFont`, `RecordedFontSize`, `DefaultRecordedFontSize`, `RecordedWeight`, `RecordedColor` | 録音後メッセージ設定 (`lblRecorded`)、録音後メッセージ (`lblRecordedMessage`) および録音後ブロックの書式 |
| `EnableAutoFontSize` | （録音前 / 録音後 共通）(`lblAudioRecordingEnableAutoFontSize`) |
| `Locked` | 種別により「ロック」表現 |

**出典**: [`iReporter.Language.xml`](../../ConMasClient/iReporter.Language.xml) 行 926–934 付近。

---

## 4. アクションクラスター（ClusterType.Action = 126）— 全 `Item*` キー一覧

画面上のラベルは **ActionType** ごとに大きく切り替わる。スキーマ生成に必要なのは **キー名（ストレージ）** の完全集合。以下は [`ActionClusterParameter.cs`](../../LibConMas/ImageDb/ActionClusterParameter.cs) 先頭の定数と 1:1。

| # | キー文字列（`inputParameters` 内） |
|---|-------------------------------------|
| 1 | `Required` |
| 2 | `ButtonFontPriority` |
| 3 | `ButtonLines` |
| 4 | `ButtonFontAlign` |
| 5 | `ButtonFontVerticalAlignment` |
| 6 | `ButtonFont` |
| 7 | `ButtonFontSize` |
| 8 | `DefaultButtonFontSize` |
| 9 | `ButtonFontColor` |
| 10 | `ButtonWeight` |
| 11 | `EnableAutoFontSize` |
| 12 | `OutputVisible` |
| 13 | `ButtonMode` |
| 14 | `LineVisible` |
| 15 | `DisplayString` |
| 16 | `ButtonAlign` |
| 17 | `BackgroundColor` |
| 18 | `ActionType` |
| 19 | `DocumentId` |
| 20 | `FinishMessage` |
| 21 | `JumpSheetNo` |
| 22 | `Menu` |
| 23 | `NoNeedToFillOutCluster` |
| 24 | `URLToOpen` |
| 25 | `TokenText` |
| 26 | `ScheduledTime` |
| 27 | `GatewayMethod` |
| 28 | `CopyCount` |
| 29 | `CopyValue` |
| 30 | `UseReportCopySetting` |
| 31 | `Command` |
| 32 | `ReturnValue` |
| 33 | `ReturnErrorMessage` |
| 34 | `OutputFileName` |
| 35 | `OutputTextMode` |
| 36 | `FilePath` |
| 37 | `Editable` |
| 38 | `DeleteFile` |
| 39 | `MultipleExecution` |
| 40 | `QRCodeFrom` |
| 41 | `QRCodeTo` |
| 42 | `QRCodeMessage` |
| 43 | `ConfirmDialog` |
| 44 | `ClearConfirmMode` |
| 45 | `FontPriority` |
| 46 | `Lines` |
| 47 | `Align` |
| 48 | `VerticalAlignment` |
| 49 | `Font` |
| 50 | `FontSize` |
| 51 | `DefaultFontSize` |
| 52 | `FontColor` |
| 53 | `Weight` |
| 54 | `BmSetLoginUserId` |
| 55 | `BmSuccessMessage` |
| 56 | `WindowsMode` |

**日本語 UI**: 各キーは `ActionType` に応じた専用パネルにバインド。文言は `iReporter.Language.xml` 内の `itemDocumentAction`, `itemShettJumpAction`, `lblAction*` 等に分散。**キー→1行ラベル**の機械的対応表はメンテコストが高いため、スキーマ用途は **上表のキー名** を正とする。

---

## 5. その他の型

- **キー一覧のみ**で足りる場合: [input-parameters.md §4](input-parameters.md) の型別節。
- **表示名（種別名）**: [cluster-types-external-reference.md](cluster-types-external-reference.md)。

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-03-28 | 初版 — 共通ラベル、Image / AudioRecording 例、Action 全 Item*、外部開発者リクエスト対応 |
