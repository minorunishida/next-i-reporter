import { buildMergedCommentCatalog } from "./cell-comment-build";
import type { AnalysisResult } from "./form-structure";
import { mergeCellCommentsIntoExcelBase64 } from "./excel-comment-writer";

/**
 * ConMas の definitionFile 用と同一の、クラスタ連携コメントをマージした Excel Base64。
 */
export async function buildMergedDefinitionExcelBase64(
  result: AnalysisResult,
): Promise<string> {
  const { formStructure, clusters } = result;
  const commentCatalog = buildMergedCommentCatalog(formStructure, clusters);
  const nameForExcel =
    formStructure.embeddedExcelFileName?.trim() || formStructure.fileName;
  return mergeCellCommentsIntoExcelBase64(
    formStructure.excelBase64 ?? "",
    nameForExcel,
    commentCatalog,
  );
}
