import { NextRequest } from "next/server";
import { analyzeForm } from "@/lib/ai-analyzer";
import { mapClusterRegionToPdf } from "@/lib/print-coord-mapper";
import { createLogger } from "@/lib/logger";
import type { FormStructure } from "@/lib/form-structure";

const log = createLogger("ai-analyze");

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OPENAI_API_KEY が設定されていません (.env.local を確認)" },
      { status: 500 }
    );
  }

  try {
    const formStructure: FormStructure = await request.json();

    if (!formStructure?.sheets?.length || !Array.isArray(formStructure.sheets)) {
      return Response.json(
        { error: "解析するシートがありません" },
        { status: 400 }
      );
    }

    log.info("AI analysis started", {
      fileName: formStructure.fileName,
      sheetsCount: formStructure.sheets.length,
    });

    const result = await analyzeForm(formStructure);

    log.info("AI analysis complete", {
      totalClusters: result.clusters.length,
      summary: result.summary,
    });

    // 座標監査証跡: printMeta があるシートのクラスターについてPDF座標を計算・ログ
    for (const cluster of result.clusters) {
      const sheet = formStructure.sheets[cluster.sheetNo];
      if (!sheet?.printMeta) continue;

      const pdfRect = mapClusterRegionToPdf(cluster.region, sheet, sheet.printMeta);
      if (!pdfRect) continue;

      const pageW = sheet.printMeta.pdfPageWidthPt;
      const pageH = sheet.printMeta.pdfPageHeightPt;
      const toMm = (norm: number, pagePt: number) => +(norm * pagePt * 25.4 / 72).toFixed(2);

      log.info("Coordinate audit trail", {
        clusterName: cluster.name,
        typeName: cluster.typeName,
        cellAddress: cluster.cellAddress,
        confidence: cluster.confidence,
        regionPx: {
          top: +cluster.region.top.toFixed(1),
          bottom: +cluster.region.bottom.toFixed(1),
          left: +cluster.region.left.toFixed(1),
          right: +cluster.region.right.toFixed(1),
        },
        pdfNormalized: {
          top: +pdfRect.top.toFixed(4),
          bottom: +pdfRect.bottom.toFixed(4),
          left: +pdfRect.left.toFixed(4),
          right: +pdfRect.right.toFixed(4),
        },
        mmOnPaper: {
          top: toMm(pdfRect.top, pageH),
          bottom: toMm(pdfRect.bottom, pageH),
          left: toMm(pdfRect.left, pageW),
          right: toMm(pdfRect.right, pageW),
          width: toMm(pdfRect.right - pdfRect.left, pageW),
          height: toMm(pdfRect.bottom - pdfRect.top, pageH),
        },
        pageDimensions: {
          widthPt: pageW,
          heightPt: pageH,
          widthMm: +(pageW * 25.4 / 72).toFixed(1),
          heightMm: +(pageH * 25.4 / 72).toFixed(1),
        },
      });
    }

    return Response.json(result);
  } catch (e) {
    log.error("AI analysis failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    const message = e instanceof Error ? e.message : "AI 解析中にエラーが発生しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
