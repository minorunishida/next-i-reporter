/**
 * Excel → PDF 変換
 *
 * 優先順位:
 * 1. EXCEL_TO_PDF_API_URL (自前 API) — 最優先
 * 2. Graph API (Azure AD) — フォールバック
 * 3. null を返す (ブランク PDF にフォールバック)
 */
export async function convertExcelToPdf(
  excelBuffer: Buffer,
  fileName: string
): Promise<Buffer | null> {
  // 1. 自前 API
  const customApiUrl = process.env.EXCEL_TO_PDF_API_URL;
  if (customApiUrl) {
    return convertViaCustomApi(customApiUrl, excelBuffer, fileName);
  }

  // 2. Graph API
  if (isGraphAvailable()) {
    return convertViaGraphApi(excelBuffer, fileName);
  }

  console.warn("[excel-to-pdf] 変換 API 未設定 — ブランク PDF にフォールバック");
  return null;
}

// --- 自前 API ---

async function convertViaCustomApi(
  apiUrl: string,
  excelBuffer: Buffer,
  fileName: string
): Promise<Buffer | null> {
  try {
    console.log(`[excel-to-pdf] Custom API: ${apiUrl}`);

    const formData = new FormData();
    const blob = new Blob([excelBuffer as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    formData.append("file", blob, fileName);

    const res = await fetch(apiUrl, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);
    console.log(`[excel-to-pdf] PDF generated: ${pdfBuffer.length} bytes`);
    return pdfBuffer;
  } catch (e) {
    console.error("[excel-to-pdf] Custom API error:", e);
    return null;
  }
}

// --- Graph API (フォールバック) ---

function isGraphAvailable(): boolean {
  return !!(
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET
  );
}

async function convertViaGraphApi(
  excelBuffer: Buffer,
  fileName: string
): Promise<Buffer | null> {
  try {
    const { getGraphClient } = await import("./graph-client");
    const client = getGraphClient();
    const tempPath = `next-i-reporter-temp/${Date.now()}_${fileName}`;

    console.log(`[excel-to-pdf] Graph API: uploading to ${tempPath}`);
    const uploadRes = await client
      .api(`/drive/root:/${tempPath}:/content`)
      .putStream(excelBuffer);
    const itemId = uploadRes.id;

    if (!itemId) throw new Error("item ID が取得できません");

    const pdfResponse = await client
      .api(`/drive/items/${itemId}/content?format=pdf`)
      .responseType("arraybuffer" as any)
      .get();

    // 一時ファイル削除
    client.api(`/drive/items/${itemId}`).delete().catch(() => {});

    const pdfBuffer = Buffer.from(pdfResponse);
    console.log(`[excel-to-pdf] PDF generated: ${pdfBuffer.length} bytes`);
    return pdfBuffer;
  } catch (e) {
    console.error("[excel-to-pdf] Graph API error:", e);
    return null;
  }
}
