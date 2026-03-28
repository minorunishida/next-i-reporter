# パラメータリファレンス

各クラスタータイプには固有の **inputParameters** があり、入力欄の振る舞いを細かく制御できます。クラスターエディタのプロパティパネルで視覚的に編集できます。

---

## パラメータの形式

内部的には `key=value;key=value` のセミコロン区切り文字列で保持されます。

```
Required=1;Align=Left;FontSize=11;Lines=2
```

エディタではフォーム UI で編集できるため、通常この形式を意識する必要はありません。

---

## キーボードテキスト (KeyboardText)

一般的なテキスト入力欄のパラメータです。

| パラメータ | 型 | 初期値 | 説明 |
|------------|------|--------|------|
| Required | boolean | OFF | 必須入力にする |
| MaxLength | number | 0 | 最大文字数（0 = 無制限） |
| InputRestriction | enum | (なし) | 入力制限: Number, Email, Url |
| Lines | number | 1 | 行数（2以上で複数行テキスト） |
| Align | enum | Left | 水平配置: Left, Center, Right |
| VerticalAlignment | enum | Top | 垂直配置: Top, Center, Bottom |
| Font | string | MS Gothic | 書体 |
| FontSize | number | 11 | 文字サイズ (pt) |
| DefaultFontSize | number | 11 | デフォルトの文字サイズ |
| Weight | enum | Normal | 太さ: Normal, Bold |
| Color | string | 0,0,0 | 文字色 (R,G,B) |
| FontPriority | boolean | OFF | フォント設定を優先 |
| EnableAutoFontSize | boolean | OFF | 文字数に応じて自動縮小 |
| DefaultText | string | (空) | デフォルトテキスト |
| Locked | boolean | OFF | ロック（編集不可） |

::: tip よく使う設定
- **氏名欄**: Required=ON, Lines=1
- **住所欄**: Lines=2
- **備考欄**: Lines=3〜5, EnableAutoFontSize=ON
:::

---

## 数値 (InputNumeric)

数値入力欄のパラメータです。

| パラメータ | 型 | 初期値 | 説明 |
|------------|------|--------|------|
| Required | boolean | OFF | 必須入力 |
| Minimum | string | (空) | 最小値 |
| Maximum | string | (空) | 最大値 |
| Decimal | number | 0 | 小数点以下の桁数 |
| Comma | boolean | OFF | 桁区切りカンマ表示 |
| Prefix | string | (空) | 接頭文字（例: ¥） |
| Suffix | string | (空) | 接尾文字（例: 円, kg, ℃） |
| Align | enum | Right | 水平配置 |
| VerticalAlignment | enum | Center | 垂直配置 |
| Font | string | MS Gothic | 書体 |
| FontSize | number | 11 | 文字サイズ |
| Weight | enum | Normal | 太さ |
| Color | string | 0,0,0 | 文字色 |
| EnableAutoFontSize | boolean | OFF | 自動フォントサイズ |
| Locked | boolean | OFF | ロック |

::: tip よく使う設定
- **金額**: Comma=ON, Suffix=円
- **温度**: Decimal=1, Suffix=℃
- **パーセント**: Decimal=1, Suffix=%
:::

---

## 年月日 (Date)

日付入力のパラメータです。

| パラメータ | 型 | 初期値 | 説明 |
|------------|------|--------|------|
| Required | boolean | OFF | 必須入力 |
| AutoInput | boolean | OFF | 帳票作成時に自動入力 |
| DateFormat | enum | yyyy/MM/dd | 日付書式 |
| FirstOnly | boolean | OFF | 初回入力のみ（変更不可） |
| Editable | boolean | ON | 編集可能 |
| ConfirmDialog | boolean | OFF | 入力時に確認ダイアログ |
| UseTime | boolean | OFF | 時刻も併せて入力 |
| TimeFormat | enum | HH:mm | 時刻書式: HH:mm, HH:mm:ss |
| Font | string | MS Gothic | 書体 |
| FontSize | number | 11 | 文字サイズ |
| Weight | enum | Normal | 太さ |
| Color | string | 0,0,0 | 文字色 |
| Align | enum | Left | 配置 |
| Locked | boolean | OFF | ロック |

**日付書式の選択肢:**
- `yyyy/MM/dd` → 2026/03/28
- `yyyy-MM-dd` → 2026-03-28
- `MM/dd` → 03/28
- `yyyy年MM月dd日` → 2026年03月28日

---

## 時刻 (Time)

時刻入力のパラメータです。

| パラメータ | 型 | 初期値 | 説明 |
|------------|------|--------|------|
| Required | boolean | OFF | 必須入力 |
| AutoInput | boolean | OFF | 自動入力 |
| TimeFormat | enum | HH:mm | 時刻書式: HH:mm, HH:mm:ss, H:mm |
| FirstOnly | boolean | OFF | 初回のみ |
| Editable | boolean | ON | 編集可能 |
| Font | string | MS Gothic | 書体 |
| FontSize | number | 11 | 文字サイズ |
| Weight | enum | Normal | 太さ |
| Color | string | 0,0,0 | 文字色 |
| Align | enum | Left | 配置 |
| Locked | boolean | OFF | ロック |

---

## 計算式 (Calculate)

自動計算フィールドのパラメータです。

| パラメータ | 型 | 初期値 | 説明 |
|------------|------|--------|------|
| Function | string | (空) | 計算式（ConMas 式構文） |
| FunctionVersion | number | 1 | 計算式バージョン |
| Decimal | number | 0 | 小数点以下の桁数 |
| Comma | boolean | OFF | 桁区切り |
| Minimum | string | (空) | 最小値 |
| Maximum | string | (空) | 最大値 |
| DataType | enum | Numeric | データ型: Numeric, DateTime, String |
| Visible | boolean | ON | 表示/非表示 |
| Align | enum | Right | 配置 |
| Font | string | MS Gothic | 書体 |
| FontSize | number | 11 | 文字サイズ |
| Weight | enum | Normal | 太さ |
| Color | string | 0,0,0 | 文字色 |
| Locked | boolean | OFF | ロック |

---

## 単一選択 (Select)

ドロップダウン等で1つを選ぶパラメータです。

| パラメータ | 型 | 初期値 | 説明 |
|------------|------|--------|------|
| Required | boolean | OFF | 必須入力 |
| Items | string | (空) | 選択肢 ID（カンマ区切り） |
| Labels | string | (空) | 選択肢ラベル（カンマ区切り） |
| Default | string | (空) | 初期選択値 |
| Display | enum | Dropdown | 表示形式: Dropdown, Radio, Button |
| ToggleInput | boolean | OFF | トグル入力 |
| Font | string | MS Gothic | 書体 |
| FontSize | number | 11 | 文字サイズ |
| Weight | enum | Normal | 太さ |
| Color | string | 0,0,0 | 文字色 |
| Align | enum | Left | 配置 |

::: tip 選択肢の設定例
```
Items=1,2,3
Labels=良,可,不可
```
Items と Labels は同じ数にしてください。
:::

---

## 複数選択 (MultiSelect)

複数の選択肢を選べるパラメータです。

| パラメータ | 型 | 初期値 | 説明 |
|------------|------|--------|------|
| Items | string | (空) | 選択肢 ID（カンマ区切り） |
| Labels | string | (空) | 選択肢ラベル（カンマ区切り） |
| Selected | string | (空) | 選択済み |
| Punctuation | string | , | 区切り文字 |
| Default | string | (空) | 初期値 |
| Display | enum | Dropdown | 表示形式: Dropdown, Radio, Button |
| Font | string | MS Gothic | 書体 |
| FontSize | number | 11 | 文字サイズ |
| Weight | enum | Normal | 太さ |
| Color | string | 0,0,0 | 文字色 |
| Align | enum | Left | 配置 |

---

## チェック (Check)

チェックボックスのパラメータです。

| パラメータ | 型 | 初期値 | 説明 |
|------------|------|--------|------|
| Required | boolean | OFF | 必須入力 |
| Marker | enum | Check | マーカー種類: Check, Circle, Cross, Fill |
| LineColor | string | 0,0,0 | 線色 (R,G,B) |
| LineWidth | number | 2 | 線幅 |
| BrushColor | string | 255,0,0 | 塗り色 (R,G,B) |
| Group | string | (空) | グループ名（排他チェック用） |

::: tip グループの使い方
同じ Group 名を持つチェックボックスは排他選択（ラジオボタン風）になります。例えば「合格」「不合格」の2つに同じグループ名を設定すると、片方をチェックするともう片方が外れます。
:::

---

## 画像 (Image)

写真・画像添付のパラメータです。

| パラメータ | 型 | 初期値 | 説明 |
|------------|------|--------|------|
| Required | boolean | OFF | 必須入力 |
| IsOriginal | boolean | OFF | 原寸表示 |
| ImageSize | number | 0 | 画像サイズ |
| EnableShortcut | boolean | OFF | ショートカット有効 |
| PhotoDate | boolean | OFF | 撮影日時を記録 |

---

## 手書きデジタル (Handwriting)

手書き入力のパラメータです。

| パラメータ | 型 | 初期値 | 説明 |
|------------|------|--------|------|
| Required | boolean | OFF | 必須入力 |
| Lines | number | 1 | 行数 |
| FontPriority | boolean | OFF | フォント優先 |
| Align | enum | Left | 水平配置 |
| VerticalAlignment | enum | Top | 垂直配置 |
| Font | string | MS Gothic | 書体 |
| FontSize | number | 11 | 文字サイズ |
| Weight | enum | Normal | 太さ |
| Color | string | 0,0,0 | 文字色 |
| EnableAutoFontSize | boolean | OFF | 自動フォントサイズ |
| Locked | boolean | OFF | ロック |

---

## 手書きノート形式 (FixedText)

| パラメータ | 型 | 初期値 | 説明 |
|------------|------|--------|------|
| Required | boolean | OFF | 必須入力 |
| Lines | number | 1 | 行数 |
| Width | number | 3 | 線幅 |
| Color | string | 0,0,0 | 線色 |

---

## カレンダー年月日 (CalendarDate)

| パラメータ | 型 | 初期値 | 説明 |
|------------|------|--------|------|
| Required | boolean | OFF | 必須入力 |
| AutoInput | boolean | OFF | 自動入力 |
| DateFormat | enum | yyyy/MM/dd | 日付書式 |
| FirstOnly | boolean | OFF | 初回のみ |
| Editable | boolean | ON | 編集可能 |
| ConfirmDialog | boolean | OFF | 確認ダイアログ |
| Day | string | (空) | 基準日オフセット |
| UseTime | boolean | OFF | 時刻併用 |
| TimeFormat | enum | HH:mm | 時刻書式 |
| Font | string | MS Gothic | 書体 |
| FontSize | number | 11 | 文字サイズ |
| Weight | enum | Normal | 太さ |
| Color | string | 0,0,0 | 文字色 |
| Align | enum | Left | 配置 |
| Locked | boolean | OFF | ロック |

---

## 共通パラメータ

多くのタイプに共通して使われるパラメータです。

| パラメータ | 説明 | 補足 |
|------------|------|------|
| Required | 必須入力フラグ | 0 = 任意, 1 = 必須 |
| Font | 書体名 | 例: MS Gothic, MS Mincho |
| FontSize | 文字サイズ (pt) | 一般的に 9〜14 |
| Weight | 文字の太さ | Normal または Bold |
| Color | 文字色 | R,G,B 形式（例: 0,0,0 = 黒） |
| Align | 水平配置 | Left, Center, Right |
| Locked | ロック | 1 にすると入力不可 |
