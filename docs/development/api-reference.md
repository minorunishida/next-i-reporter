# API リファレンス

next-i-reporter のバックエンド API 一覧と仕様です。

---

## 概要

すべての API は Next.js 16 の App Router で実装されています。

| API | メソッド | 役割 |
|-----|---------|------|
| `/api/parse-excel` | POST | Excel ファイルをパースして FormStructure を返す |
| `/api/ai-analyze` | POST | FormStructure を AI で解析してクラスターを検出 |
| `/api/ai-analyze-region` | POST | 特定領域を AI で解析（手動クラスター作成用） |
| `/api/generate-xml` | POST | AnalysisResult から ConMas XML を生成 |
| `/api/import-xml` | POST | ConMas XML をパースして AnalysisResult に変換 |

---

## /api/parse-excel

Excel ファイルをパースし、セル構造情報を抽出します。

### リクエスト

```
POST /api/parse-excel
Content-Type: application/octet-stream

[Binary: Excel file content]
```

**Query Parameters:**

| 名前 | 型 | 必須 | 説明 |
|------|-----|------|------|
| `fileName` | string | ✓ | ファイル名（例: `form.xlsx`） |
| `paperId` | string | | 用紙 ID（A4, A3, B4） デフォルト: A4 |

### レスポンス

```json
{
  "status": "success",
  "data": {
    "sheets": [
      {
        "sheetName": "Sheet1",
        "cells": [
          {
            "address": "A1",
            "value": "請求書",
            "formula": null,
            "format": {
              "numberFormat": "General",
              "fontColor": "#000000",
              "backgroundColor": "#FFFFFF",
              "borders": {
                "top": "thin",
                "bottom": "thin",
                "left": "thin",
                "right": "thin"
              }
            },
            "merged": false,
            "dataValidation": null
          }
        ],
        "mergedAreas": [
          {
            "startRow": 1,
            "endRow": 1,
            "startCol": 1,
            "endCol": 5
          }
        ],
        "rowHeights": [15, 20, 15, ...],
        "colWidths": [64, 80, 100, ...]
      }
    ],
    "pdfBuffer": "base64-encoded PDF",
    "printMeta": [
      {
        "pdfPageWidthPt": 595,
        "pdfPageHeightPt": 842,
        "margins": {
          "top": 28.35,
          "bottom": 28.35,
          "left": 28.35,
          "right": 28.35,
          "header": 0,
          "footer": 0
        },
        "rows": [
          { "row": 1, "top": 0, "height": 15 },
          { "row": 2, "top": 15, "height": 20 }
        ],
        "columns": [
          { "col": 1, "left": 0, "width": 64 },
          { "col": 2, "left": 64, "width": 80 }
        ],
        "zoom": 100,
        "fitToPagesWide": null,
        "fitToPagesTall": null,
        "printArea": {
          "startRow": 1,
          "endRow": 50,
          "startCol": 1,
          "endCol": 10,
          "width": 640,
          "height": 750
        },
        "usedRange": {
          "startRow": 1,
          "endRow": 100,
          "startCol": 1,
          "endCol": 15,
          "width": 960,
          "height": 1500
        }
      }
    ]
  }
}
```

### エラーレスポンス

```json
{
  "status": "error",
  "error": "ファイルサイズが 10MB を超えています"
}
```

### エラーコード

| コード | 説明 |
|--------|------|
| 400 | ファイルサイズ超過（> 10MB） |
| 400 | ファイル形式が Excel ではない |
| 500 | PDF 変換失敗（eprint CLI / Graph API エラー） |
| 500 | Excel パース失敗 |

---

## /api/ai-analyze

FormStructure を OpenAI で解析し、クラスターを検出します。

### リクエスト

```
POST /api/ai-analyze
Content-Type: application/json

{
  "sheets": [
    {
      "sheetName": "Sheet1",
      "cells": [...],
      "mergedAreas": [...],
      "rowHeights": [...],
      "colWidths": [...]
    }
  ],
  "pdfBuffer": "base64...",
  "printMeta": [...]
}
```

**Body:** FormStructure (詳細は型定義参照)

### レスポンス

```json
{
  "status": "success",
  "data": {
    "clusters": [
      {
        "name": "請求日",
        "type": 40,
        "typeLabel": "年月日",
        "confidence": 0.92,
        "cellRange": {
          "startRow": 5,
          "startCol": 2,
          "endRow": 5,
          "endCol": 2
        },
        "pdfRegion": {
          "top": 0.15,
          "bottom": 0.18,
          "left": 0.3,
          "right": 0.45
        },
        "formula": null,
        "inputParameters": "Required=0;DateFormat=yyyy/MM/dd",
        "readOnly": false
      }
    ],
    "summary": {
      "total": 25,
      "highConfidence": 20,
      "mediumConfidence": 4,
      "lowConfidence": 1
    }
  }
}
```

### 信頼度別のクラスター数

```
highConfidence (>= 0.9): 自動検出が確実な項目
mediumConfidence (0.7-0.9): 推測だが妥当
lowConfidence (< 0.7): ユーザー確認推奨
```

### エラーレスポンス

```json
{
  "status": "error",
  "error": "OpenAI API エラー: rate limit exceeded"
}
```

### エラーコード

| コード | 説明 |
|--------|------|
| 400 | リクエストボディが無効 |
| 401 | OpenAI API Key が設定されていない |
| 429 | Rate Limit（OpenAI） |
| 500 | OpenAI API エラー |

---

## /api/ai-analyze-region

ユーザーが描画した領域を AI で解析（新規クラスター作成用）。

### リクエスト

```
POST /api/ai-analyze-region
Content-Type: application/json

{
  "sheetIndex": 0,
  "region": {
    "startRow": 10,
    "startCol": 3,
    "endRow": 10,
    "endCol": 3
  },
  "formStructure": { ... },
  "surroundingContext": {
    "nearbyLabels": ["温度"],
    "nearbyValues": [25, 26, 27]
  }
}
```

### レスポンス

```json
{
  "status": "success",
  "data": {
    "suggestion": {
      "name": "温度",
      "type": 65,
      "typeLabel": "数値",
      "confidence": 0.85,
      "inputParameters": "Required=0;Decimal=1;Suffix=℃"
    }
  }
}
```

### エラーレスポンス

```json
{
  "status": "error",
  "error": "領域が無効です（シートが見つかりません）"
}
```

---

## /api/generate-xml

AnalysisResult から ConMas i-Reporter 互換の XML を生成します。

### リクエスト

```
POST /api/generate-xml
Content-Type: application/json

{
  "clusters": [
    {
      "name": "請求日",
      "type": 40,
      "cellRange": { ... },
      "pdfRegion": { ... },
      "inputParameters": "Required=0;DateFormat=yyyy/MM/dd"
    }
  ],
  "pageSetup": {
    "paperSize": "A4",
    "orientation": "Portrait",
    "margins": { ... }
  },
  "pdfBuffer": "base64..."
}
```

### レスポンス

```
HTTP 200 OK
Content-Type: application/xml
Content-Disposition: attachment; filename="template.xml"

<?xml version="1.0" encoding="utf-8"?>
<Template Version="3.1">
  <Header>
    <TemplateName>請求書</TemplateName>
    ...
  </Header>
  <Sheets>
    <Sheet>
      <SheetName>Sheet1</SheetName>
      <Clusters>
        <Cluster>
          <Name>請求日</Name>
          <Type>40</Type>
          <PdfRegion Top="0.15" Bottom="0.18" Left="0.3" Right="0.45"/>
          <InputParameters>Required=0;DateFormat=yyyy/MM/dd</InputParameters>
        </Cluster>
      </Clusters>
    </Sheet>
  </Sheets>
  <Pdf>
    <!-- base64 encoded PDF -->
  </Pdf>
</Template>
```

### エラーコード

| コード | 説明 |
|--------|------|
| 400 | クラスター定義が無効 |
| 500 | XML 生成エラー |

---

## /api/import-xml

ConMas i-Reporter の XML ファイルをパースして AnalysisResult に変換します。

### リクエスト

```
POST /api/import-xml
Content-Type: application/octet-stream

[Binary: XML file content]
```

**Query Parameters:**

| 名前 | 型 | 説明 |
|------|-----|------|
| `fileName` | string | ファイル名（例: `template.xml`） |

### レスポンス

```json
{
  "status": "success",
  "data": {
    "clusters": [
      {
        "name": "請求日",
        "type": 40,
        "typeLabel": "年月日",
        "confidence": 1.0,
        "cellRange": { ... },
        "pdfRegion": {
          "top": 0.15,
          "bottom": 0.18,
          "left": 0.3,
          "right": 0.45
        },
        "inputParameters": "Required=0;DateFormat=yyyy/MM/dd",
        "readOnly": false
      }
    ],
    "pdfBuffer": "base64...",
    "pageSetup": { ... }
  }
}
```

### エラーコード

| コード | 説明 |
|--------|------|
| 400 | ファイルサイズ超過（> 50MB） |
| 400 | XML 形式が無効 |
| 500 | XML パース失敗 |

---

## 型定義

### FormStructure

```typescript
type FormStructure = {
  sheets: SheetStructure[];
  pdfBuffer: Buffer;
  printMeta: PrintMeta[];
};

type SheetStructure = {
  sheetName: string;
  cells: CellInfo[];
  mergedAreas: MergedArea[];
  rowHeights: number[];
  colWidths: number[];
};

type CellInfo = {
  address: string;         // "A1", "B2"
  value?: any;
  formula?: string;        // "=SUM(A1:A10)"
  format?: {
    numberFormat: string;
    fontColor?: string;
    backgroundColor?: string;
    borders?: BorderInfo;
  };
  merged: boolean;
  dataValidation?: {
    type: "list" | "range";
    formula1?: string;
    operator?: string;
  };
};

type PrintMeta = {
  pdfPageWidthPt: number;
  pdfPageHeightPt: number;
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    header: number;
    footer: number;
  };
  rows: Array<{ row: number; top: number; height: number }>;
  columns: Array<{ col: number; left: number; width: number }>;
  zoom?: number;
  fitToPagesWide?: number;
  fitToPagesTall?: number;
  printArea?: Range;
  usedRange?: Range;
};

type ClusterDefinition = {
  name: string;
  type: number;           // 10, 15, 20, 30, 40, etc
  typeLabel: string;      // "手書きフリーメモ", "年月日"
  confidence: number;     // 0-1
  cellRange: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
  pdfRegion: {
    top: number;          // 0-1
    bottom: number;
    left: number;
    right: number;
  };
  formula?: string;
  inputParameters: string;
  readOnly?: boolean;
};

type AnalysisResult = {
  clusters: ClusterDefinition[];
  summary: {
    total: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
  };
  pdfBuffer?: Buffer;
  pageSetup?: PageSetup;
};
```

---

## 認証

現在、すべての API は認証なしで利用可能です。

本番環境では以下を検討：

```typescript
// API Route での認証チェック
export async function POST(req: Request) {
  const token = req.headers.get("Authorization")?.split(" ")[1];

  if (!token || !verifyToken(token)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 処理続行
}
```

---

## レート制限

OpenAI API 使用時のレート制限：

- **テンプレート解析:** 通常 10〜30 秒
- **API キー:** `OPENAI_API_KEY` で制御
- **月額コスト:** モデル、トークン数による

詳細は [OpenAI Pricing](https://openai.com/pricing) を参照。

---

## キャッシング

大規模な帳票の場合、以下のキャッシングを検討：

```typescript
// Redis キャッシュの例
const cacheKey = `excel-parse:${hash(fileBuffer)}`;
let result = await redis.get(cacheKey);

if (!result) {
  result = await parseExcel(fileBuffer);
  await redis.set(cacheKey, JSON.stringify(result), { EX: 3600 });
}
```

---

## エラーハンドリング

すべての API は以下の共通エラー形式を返します：

```json
{
  "status": "error",
  "error": "ユーザーフレンドリーなエラーメッセージ",
  "code": "ERROR_CODE",
  "details": {
    "originalError": "詳細なエラー内容（開発用）"
  }
}
```

---

## テスト

各 API は Node.js テストランナーでテスト可能：

```bash
npm test  # すべてのテストを実行
```

テストファイル：
- `src/lib/**/*.test.ts` — ユーティリティ関数テスト
- API エンドポイントのテストは計画中
