# AI プロンプト詳解 — OpenAI GPT-5.1 の設計

next-i-reporter の AI 解析エンジンの核となるシステムプロンプトを解説します。

---

## プロンプトの役割

```typescript
// ai-analyzer.ts
const SYSTEM_PROMPT = `あなたは ConMas i-Reporter の帳票設計エキスパートです...`;

openai.chat.completions.create({
  model: "gpt-5.1",
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(formStructure) },
  ],
});
```

AI には以下のタスク を与えます:

1. **38 種類のクラスタータイプから該当するものを推測**
2. **各クラスターの信頼度スコアを算出**
3. **入力パラメータ（key=value;形式）を生成**

---

## プロンプト構成

### Part 1: ロール定義

```
あなたは ConMas i-Reporter の帳票設計エキスパートです。
```

AI に「帳票設計の専門家」というペルソナを与え、回答品質を高めます。

### Part 2: 型判定規則（主要 9 カテゴリ × 38 タイプ）

#### テキスト系（4 型）

```
- KeyboardText (30): テキストを入力する空白セル
  → 名前、住所、担当者名など一般的なテキスト入力

- FixedText (20): 手書きノート形式
  → 線の上に手書きする入力エリア

- FreeText (10): 手書きフリーメモ
  → 自由に書ける広い領域

- Handwriting (119): 手書き署名
  → 「署名」「印」ラベルの近く、署名・印鑑用
```

**判定ポイント:**
- 空白セル + ラベル → KeyboardText
- 複数行テキスト → Lines パラメータで調整
- 「備考」「メモ」→ 複数行設定

#### 数値・計算系（5 型）

```
- InputNumeric (65): テンキーで数値を入力
  判定: 「温度」「数量」「金額」の隣、numberFormat が数値
  → Decimal（小数桁数）、Comma（桁区切り）を推測

- Numeric (60): 数値選択（ドラムロール）
  判定: 上下限・ステップが明確な数値

- Calculate (67): ★ 最重要 ★ 数式を含むセル
  判定: formula フィールドに値がある（=SUM, =IF など）
  → 数式をそのまま formula に保持
  → confidence = 0.95（最高）

- NumberHours (110): 時間数入力
  判定: 「作業時間」「残業」ラベル

- TimeCalculate (55): 時刻の差分計算
  判定: 「終了 - 開始」のような計算式
  → formula に差分計算式を含める
```

**重要:** Calculate セルは **最も確実な検出対象** です。

```typescript
// AI が見る入力例
{
  "address": "D5",
  "value": 15,           // 表示値
  "formula": "=SUM(C1:C4)", // ★ これが存在すれば Calculate
  "format": { "numberFormat": "0.00" }
}

// → AI の判定ロジック
if (cell.formula) {
  type = Calculate;
  confidence = 0.95;
  inputParameters = `Function=${escapeFormula(cell.formula)}`;
}
```

#### 日付・時刻系（4 型）

```
- Date (40): ドラムロール式の日付入力
  判定: numberFormat が "yyyy/mm/dd" など日付形式

- CalendarDate (111): カレンダー UI から日付を選ぶ
  判定: Date と同等だが UI が異なる

- Time (50): 時刻入力（HH:mm）
  判定: numberFormat が時刻形式

- TimeCalculate (55): 時刻の差分計算
  判定: 2つの時刻の差分を計算する数式
```

**参考：Excel の numberFormat パターン**
```
"yyyy/mm/dd"     → Date
"mm/dd"          → Date (短縮形)
"hh:mm"          → Time
"hh:mm:ss"       → Time (秒付き)
"mm:ss"          → TimeCalculate の候補
```

#### 選択・チェック系（6 型）

```
- Select (70): ドロップダウンで1つを選ぶ
  判定: dataValidation.type === "list"
       OR dataValidation.formula1 が範囲指定

- MultiSelect (80): 複数選択可能
  判定: セルにリスト入力規則があり、
        形式が複数入力対応（,区切りなど）

- Check (90): チェックボックス
  判定: 「合否」「確認」ラベルの隣
       OR 値が ○, ✓, × など記号

- MultipleChoiceNumber (123): トグル選択（複数択一）
  判定: 色付きボタンで複数択一される項目

- MCNCalculate (124): トグル集計
  判定: MultipleChoiceNumber の集計値

- SelectMaster (125): マスターデータから選択
  判定: 大規模な選択肢テーブルがある
```

**dataValidation の形式:**
```typescript
{
  "dataValidation": {
    "type": "list",
    "formula1": "\"優,良,可,不可\"",  // CSV 形式
    // または
    "formula1": "Sheet1!$A$1:$A$10"    // 範囲参照
  }
}

// → AI の判定
if (cell.dataValidation?.type === "list") {
  type = Select;  // または MultiSelect
  // formula1 から Items, Labels を抽出
}
```

#### メディア・画像系（6 型）

```
- Image (100): 写真・画像を配置
  判定: 大きな結合セル（3×3 以上）
       + 空白 + 「写真」「画像」ラベル

- Handwriting (119): 手書き署名
  判定: 「署名」「印鑑」「捺印」ラベル

- FreeDraw (15): フリードロー（自由描画）
  判定: 「スケッチ」「図面」ラベル

- DrawingImage (128): ピン打ち画像
  判定: 「指摘箇所」「不具合位置」ラベル

- DrawingPinNo (129): ピン番号配置
  判定: 図面上のピン番号参照

- AudioRecording (131): 音声録音
  判定: 「音声」「メモ」ラベル
```

**判定条件：merged セル + サイズ**
```typescript
if (merged && width >= 3 && height >= 3) {
  // 候補: Image, Handwriting, FreeDraw
  const label = nearbyLabel();

  if (label.includes("写真") || label.includes("画像")) {
    type = Image;
  } else if (label.includes("署名") || label.includes("印")) {
    type = Handwriting;
  } else if (label.includes("スケッチ") || label.includes("描画")) {
    type = FreeDraw;
  }
}
```

#### ワークフロー系（7 型）

```
- Create (116): 帳票作成者スタンプ
  判定: 「作成」「発行者」ラベル

- Inspect (117): 査閲者スタンプ
  判定: 「査閲」「確認」ラベル

- Approve (118): 承認者スタンプ
  判定: 「承認」「承認者」ラベル

- Registration (112): 帳票登録者
  判定: 「登録者」ラベル（自動表示、readOnly=true）

- RegistrationDate (113): 帳票登録日時
  判定: 「登録日」「登録時刻」ラベル（readOnly=true）

- LatestUpdate (114): 帳票更新者
  判定: 「更新者」ラベル（readOnly=true）

- LatestUpdateDate (115): 帳票更新年月日
  判定: 「更新日」「更新時刻」ラベル（readOnly=true）
```

**ワークフロー型の特徴:**
```typescript
// これらは readOnly=true がデフォルト
if (label.includes("登録者") || label.includes("更新者")) {
  inputParameters = "DisplayUserName=1;Font=MS Gothic";
  readOnly = true;  // ★ ユーザーが編集不可
}
```

#### 読取系（5 型）

```
- QRCode (121): QR コード・バーコード読取
  判定: 「QR」「バーコード」「コード」ラベル

- CodeReader (122): コードリーダー入力
  判定: スキャナーで読み取る項目

- Gps (120): GPS 位置情報
  判定: 「位置」「座標」「GPS」ラベル

- LoginUser (127): ログインユーザー名
  判定: 「記入者」「担当者」ラベル（自動入力）

- Scandit (132): Scandit バーコード
  判定: Scandit SDK 対応

- EdgeOCR (133): Edge OCR 文字認識
  判定: OCR で文字を自動認識
```

#### その他（1 型）

```
- Action (126): アクション（ボタン）
  判定: 帳票内でアクション実行

- LoginUser (127): ログインユーザー
  判定: 「記入者」「担当者」で自動入力
```

---

### Part 3: 判断のポイント（10 ルール）

```
1. 空白セルで、近くにラベルがあれば入力クラスター
   → KeyboardText, InputNumeric, Date など

2. 値が入っているだけのセル（ラベル・見出し・タイトル）はスキップ
   → クラスターにしない

3. 数式セルは Calculate (67)
   → formula フィールドをそのまま保持

4. セルの書式（numberFormat）がヒント
   → 日付書式 → Date
   → 通貨/数値 → InputNumeric

5. 大きな結合セル + 空白 → Image, Handwriting, KeyboardText
   → 文脈から推測

6. 空白セルでも意味のない装飾はスキップ
   → 罫線だけのセル

7. 「作成」「確認」「承認」ラベル隣
   → Create/Inspect/Approve

8. 「登録者」「更新者」「登録日」「更新日」
   → Registration/LatestUpdate 系（readOnly=true）

9. 「記入者」「担当者」で自動入力予定
   → LoginUser

10. 2つの時刻の差分計算
    → TimeCalculate
```

---

### Part 4: Confidence スコアの基準

AI が信頼度スコア (0〜1) を算出します:

```
0.95: 明らかに判定できる
      → 数式セル (Calculate with formula)
      → セルの書式から確実
      例: numberFormat="yyyy/mm/dd" → Date (0.95)

0.85-0.95: 書式や隣接ラベルから高確度で推測
           例: dataValidation.type="list" → Select (0.90)
           例: "温度"ラベル隣+数値書式 → InputNumeric (0.88)

0.70-0.85: 推測に基づくが妥当
           例: 空白セル+ラベル推測 → KeyboardText (0.75)
           例: 合計行の計算 → Calculate (0.72)

0.50-0.70: 不確実。ユーザー確認推奨
           例: 用途が曖昧 → 0.60
           例: ラベルなし空白セル → 0.55
```

**コード実装例:**
```typescript
// AI が出力する confidence の決定ロジック
const cluster = {
  name: "開始時刻",
  type: 50,  // Time
  confidence: 0.92,  // 「時刻」ラベル+書式から推測
  cellRange: { startRow: 5, startCol: 3, endRow: 5, endCol: 3 },
};
```

---

### Part 5: inputParameters の生成テンプレート

AI が各タイプの **初期パラメータ** を生成します：

```
KeyboardText: "Required=0;Align=Left;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0"

InputNumeric: "Required=0;Decimal=0;Align=Right;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0"
  → 「金額」なら Comma=1 を追加（smart-defaults.ts で上書き）

Date: "Required=0;DateFormat=yyyy/MM/dd;AutoInput=0;Align=Left;Font=MS Gothic;FontSize=11"

Time: "Required=0;TimeFormat=HH:mm;AutoInput=0;Align=Left;Font=MS Gothic;FontSize=11"

Calculate: "Decimal=0;Comma=0;Align=Right;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0"
  → Function=<数式> はこのステップでは含まない（AI output で追加）

Select: "Required=0;Display=Dropdown;Font=MS Gothic;FontSize=11"
  → Items, Labels は dataValidation から抽出

Check: "Required=0;Marker=Check"

Create/Inspect/Approve: "Required=0;SignType=0"

Handwriting: "Required=0;Lines=1;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0"

Image: "Required=0"

QRCode: "Required=0;IsNumeric=0;Lines=1;Font=MS Gothic;FontSize=11"
```

---

## AI への入力（FormStructure）

```typescript
{
  "sheets": [
    {
      "sheetName": "Sheet1",
      "cells": [
        {
          "address": "A1",
          "value": "請求書",
          // → ラベルなのでスキップ
        },
        {
          "address": "B5",
          "value": null,          // 空白
          "format": {
            "numberFormat": "yyyy/mm/dd"
          },
          // → Date の強い候補
        },
        {
          "address": "C10",
          "value": 1500,
          "formula": "=B10*C9",    // ★ 数式あり
          "format": {
            "numberFormat": "¥#,##0"
          }
          // → Calculate (confidence=0.95)
        },
        {
          "address": "D20",
          "value": null,
          "dataValidation": {
            "type": "list",
            "formula1": "\"優,良,可,不可\""
          }
          // → Select (confidence=0.90)
        }
      ],
      "mergedAreas": [
        { "startRow": 1, "endRow": 1, "startCol": 1, "endCol": 5 }
      ],
      "rowHeights": [15, 20, 15, ...],
      "colWidths": [64, 80, 100, ...]
    }
  ]
}
```

---

## AI の出力形式

```json
{
  "clusters": [
    {
      "name": "請求日",
      "type": 40,
      "confidence": 0.92,
      "cellRange": {
        "startRow": 5,
        "startCol": 2,
        "endRow": 5,
        "endCol": 2
      },
      "inputParameters": "Required=0;DateFormat=yyyy/MM/dd;AutoInput=0;Align=Left"
    },
    {
      "name": "小計",
      "type": 67,
      "confidence": 0.95,
      "formula": "=SUM(C10:C19)",
      "cellRange": {
        "startRow": 20,
        "startCol": 3,
        "endRow": 20,
        "endCol": 3
      },
      "inputParameters": "Decimal=0;Comma=1;Align=Right"
    },
    {
      "name": "支払状況",
      "type": 70,
      "confidence": 0.88,
      "cellRange": {
        "startRow": 25,
        "startCol": 2,
        "endRow": 25,
        "endCol": 2
      },
      "inputParameters": "Required=0;Display=Dropdown;Items=1,2,3;Labels=未払,一部払,完済"
    }
  ]
}
```

---

## Smart Defaults との連携

AI 出力後、`smart-defaults.ts` が **名前ベース** の推測で inputParameters を上書き：

```typescript
// "金額"が含まれている → Comma=1, Suffix="円"
if (keywords.includes("金") || keywords.includes("料金")) {
  params.Comma = "1";
  params.Suffix = "円";
}

// "温度" → Suffix="℃", Decimal=1
if (keywords.includes("温")) {
  params.Suffix = "℃";
  params.Decimal = "1";
}

// "生年月日" → DateFormat="yyyy年MM月dd日"
if (keywords.includes("生年月")) {
  params.DateFormat = "yyyy年MM月dd日";
}
```

**プロセス:**
```
OpenAI 出力 (初期パラメータ)
    ↓
SmartDefaults で上書き
    ↓
最終的な inputParameters
```

---

## 最適化のコツ

### 1. より正確なラベル抽出

```typescript
// 隣接セルから自動的にラベルを取得
function getNearbyLabel(cellAddress: string): string {
  // 左隣、上隣、左上など複数の候補から取得
  // AI のジャッジメントに供給
}
```

### 2. データバリデーション情報の活用

```typescript
// Excel の入力規則リストを AI に提供
if (cell.dataValidation?.type === "list") {
  // Items と Labels を抽出して JSON に含める
  // AI が Select/MultiSelect の判定に活用
}
```

### 3. 結合セルの扱い

```typescript
// 大きな結合セル（3×3以上）は Image/Handwriting の候補
// Size 情報を JSON に含めて AI に提供
{
  "merged": true,
  "mergeSize": { "width": 4, "height": 5 }
}
```

---

## 注意点

### ❌ AI が誤検出しやすいケース

1. **ラベルがない空白セル**
   → スキップするか、confidence を 0.5 以下に

2. **非常に大きなテーブル**
   → AI の token 制限に注意
   → 重要なセルのみを絞り込み

3. **複雑な条件付き書式**
   → 書式情報を正確に JSON に含める

4. **古い Excel （97-2003）**
   → メタ情報が不完全な可能性
   → フォールバック処理が必要

### ✅ 信頼度を上げるには

1. **ラベルテキストを明確に**
   - 「金額」「温度」など、すぐわかる名前

2. **書式を正しく設定**
   - 日付なら dayformat をセット
   - 通貨なら ¥ 形式をセット

3. **データバリデーションを活用**
   - ドロップダウンリストを設定すると Select が高確度

4. **数式を含める**
   - Calculate は confidence=0.95（最高）

---

## トラブルシューティング

### Q: 検出されないクラスターがある

**A:** 以下を確認：
1. セルは空白か？（値が入っていないか）
2. ラベルセルの近くか？
3. セルの書式が適切か？
4. データバリデーションは設定されているか？

### Q: 信頼度スコアが低い

**A:** AI の判定を上げるには：
1. ラベルを明確にする
2. セル書式を正しく設定
3. データバリデーション / 数式を活用

### Q: 型が誤検出される

**A:** inputParameters を手動で修正してください：
1. クラスターエディタで選択
2. 右パネルで「タイプ」を変更
3. パラメータを調整

---

## 参考：OpenAI API の呼び出し

```typescript
const response = await openai.chat.completions.create({
  model: "gpt-5.1",
  temperature: 0.1,        // 低めに設定（決定論的）
  max_tokens: 4000,
  messages: [
    {
      role: "system",
      content: SYSTEM_PROMPT  // 上記の包括的なプロンプト
    },
    {
      role: "user",
      content: JSON.stringify(formStructure)  // Excel データ
    }
  ]
});

const clusters = JSON.parse(response.choices[0].message.content);
```

---

## さらに知りたい人へ

- [AI プロンプトの全文](https://github.com/yourusername/next-i-reporter/blob/main/src/lib/ai-analyzer.ts#L14)
- [Smart Defaults の実装詳細](/development/smart-defaults-deep-dive)
- [信頼度スコア計算ロジック](/development/confidence-scoring)
