import { NextRequest } from "next/server";
import { parseExcel } from "@/lib/excel-parser";
import { convertExcelToPdf } from "@/lib/excel-to-pdf";
import type { SheetStructure, PrintMeta } from "@/lib/form-structure";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * printMeta の正確な pt データを使って、SheetJS の不正確な colWidths/rowHeights を補正する。
 * pt 値をそのまま px として使用（1pt ≈ 1.333px だが、座標マッパーが px→pt 補間するため
 * px 値の相対的な比率が正確であれば問題ない）。
 *
 * 実質的に: colWidths[i] = printMeta.columns[i].width (pt) を px 単位として扱う。
 * これにより補間マッパーの px 側と pt 側が同じ比率になり、補間が恒等変換に近づく。
 */
function correctDimensionsFromPrintMeta(sheet: SheetStructure, meta: PrintMeta) {
  // 行高さの補正
  if (meta.rows.length > 0) {
    const maxRow = meta.rows[meta.rows.length - 1].row; // 1-based
    const newRowHeights: number[] = new Array(maxRow).fill(15); // default pt
    for (let i = 0; i < sheet.rowHeights.length && i < maxRow; i++) {
      newRowHeights[i] = sheet.rowHeights[i];
    }
    for (const r of meta.rows) {
      const idx = r.row - 1;
      if (idx >= 0 && idx < maxRow) {
        newRowHeights[idx] = r.height;
      }
    }
    sheet.rowHeights = newRowHeights;
    sheet.rowCount = Math.max(sheet.rowCount, maxRow);
  }

  // 列幅の補正
  if (meta.columns.length > 0) {
    const maxCol = meta.columns[meta.columns.length - 1].col; // 1-based
    // maxCol 分の配列を確保
    const newColWidths: number[] = new Array(maxCol).fill(12); // default pt
    // 既存の SheetJS 値をコピー（後で上書きされる）
    for (let i = 0; i < sheet.colWidths.length && i < maxCol; i++) {
      newColWidths[i] = sheet.colWidths[i];
    }
    // printMeta の正確な値で上書き
    for (const c of meta.columns) {
      const idx = c.col - 1;
      if (idx >= 0 && idx < maxCol) {
        newColWidths[idx] = c.width;
      }
    }
    sheet.colWidths = newColWidths;
    sheet.colCount = Math.max(sheet.colCount, maxCol);
  }

  // totalWidth/totalHeight を再計算
  sheet.totalWidth = sheet.colWidths.reduce((a, b) => a + b, 0);
  sheet.totalHeight = sheet.rowHeights.reduce((a, b) => a + b, 0);

  // セルの region 座標を再計算
  const rowTops = [0];
  for (let i = 0; i < sheet.rowHeights.length; i++) {
    rowTops.push(rowTops[i] + sheet.rowHeights[i]);
  }
  const colLefts = [0];
  for (let i = 0; i < sheet.colWidths.length; i++) {
    colLefts.push(colLefts[i] + sheet.colWidths[i]);
  }

  for (const cell of sheet.cells) {
    const endRow = cell.mergeRange ? cell.mergeRange.endRow : cell.row;
    const endCol = cell.mergeRange ? cell.mergeRange.endCol : cell.col;
    cell.region = {
      top: rowTops[cell.row] ?? 0,
      bottom: rowTops[endRow + 1] ?? rowTops[endRow] ?? 0,
      left: colLefts[cell.col] ?? 0,
      right: colLefts[endCol + 1] ?? colLefts[endCol] ?? 0,
    };
  }

  console.log(`[parse-excel] Dimensions corrected: ${sheet.colWidths.length} cols, ${sheet.rowHeights.length} rows, totalW=${sheet.totalWidth.toFixed(1)}, totalH=${sheet.totalHeight.toFixed(1)}`);
  const m = meta.margins;
  const pa = meta.printArea ?? meta.usedRange;
  console.log(`[parse-excel] margins: T=${m.top.toFixed(1)} B=${m.bottom.toFixed(1)} L=${m.left.toFixed(1)} R=${m.right.toFixed(1)} header=${m.header.toFixed(1)} footer=${m.footer.toFixed(1)}`);
  console.log(`[parse-excel] printArea: ${pa.width}x${pa.height}pt, page: ${meta.pdfPageWidthPt}x${meta.pdfPageHeightPt}pt`);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "ファイルが選択されていません" }, { status: 400 });
    }

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      return Response.json(
        { error: "Excel ファイル (.xlsx, .xls) のみ対応しています" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "ファイルサイズは 10MB 以下にしてください" },
        { status: 413 }
      );
    }

    const buffer = await file.arrayBuffer();

    // Excel 解析 + PDF 変換を並列実行
    const [formStructure, conversionResult] = await Promise.all([
      Promise.resolve(parseExcel(buffer, file.name)),
      convertExcelToPdf(Buffer.from(buffer), file.name),
    ]);

    if (conversionResult) {
      // PDF を Base64 化して FormStructure に含める
      formStructure.pdfBase64 = conversionResult.pdfBuffer.toString("base64");
      console.log(`[parse-excel] PDF generated: ${conversionResult.pdfBuffer.length} bytes`);

      // 印刷メタ情報をシートに紐づけ + 列幅/行高さを補正
      if (conversionResult.printMeta) {
        for (const meta of conversionResult.printMeta) {
          const sheet = formStructure.sheets.find((s) => s.name === meta.name);
          if (sheet) {
            sheet.printMeta = meta;
            // printMeta の正確な pt データで colWidths/rowHeights を補正
            // SheetJS が DEFAULT (64px) を返す場合に特に重要
            correctDimensionsFromPrintMeta(sheet, meta);
          }
        }
        console.log(`[parse-excel] Print meta attached: ${conversionResult.printMeta.length} sheets`);
      }
    } else {
      console.log("[parse-excel] PDF conversion skipped");
    }

    return Response.json(formStructure);
  } catch (e) {
    console.error("[parse-excel]", e);
    const message = e instanceof Error ? e.message : "Excel 解析中にエラーが発生しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
