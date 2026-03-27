/**
 * Excel → PDF 変換 + 印刷メタ情報取得
 *
 * 優先順位:
 * 1. eprint CLI (ローカル COM Interop) — 最優先、メタ情報も返す
 * 2. Graph API (Azure AD) — フォールバック (メタ情報なし)
 * 3. null を返す (ブランク PDF にフォールバック)
 */

import { execFile } from "node:child_process";
import { writeFile, readFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { PrintMeta } from "./form-structure";

export type PdfConversionResult = {
  pdfBuffer: Buffer;
  printMeta?: PrintMeta[];
};

export async function convertExcelToPdf(
  excelBuffer: Buffer,
  fileName: string
): Promise<PdfConversionResult | null> {
  // 1. eprint CLI
  const eprintPath = process.env.EPRINT_CLI_PATH;
  if (eprintPath) {
    return convertViaEprintCli(eprintPath, excelBuffer, fileName);
  }

  // 2. Graph API
  if (isGraphAvailable()) {
    const buf = await convertViaGraphApi(excelBuffer, fileName);
    return buf ? { pdfBuffer: buf } : null;
  }

  console.warn("[excel-to-pdf] 変換手段なし — ブランク PDF にフォールバック");
  return null;
}

// --- eprint CLI ---

async function convertViaEprintCli(
  eprintPath: string,
  excelBuffer: Buffer,
  fileName: string
): Promise<PdfConversionResult | null> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "eprint-"));
  const inputPath = path.join(tempDir, fileName);
  const outputPath = path.join(tempDir, fileName.replace(/\.xlsx?$/i, ".pdf"));

  try {
    await writeFile(inputPath, excelBuffer);

    console.log(`[excel-to-pdf] eprint CLI: ${eprintPath}`);
    const stdout = await execFileAsync(eprintPath, [
      inputPath,
      outputPath,
      "--meta",
    ]);

    const meta = JSON.parse(stdout) as {
      pdfPath: string;
      sheets: PrintMeta[];
    };

    const pdfBuffer = await readFile(outputPath);
    console.log(
      `[excel-to-pdf] PDF generated: ${pdfBuffer.length} bytes, ${meta.sheets.length} sheets`
    );

    return { pdfBuffer, printMeta: meta.sheets };
  } catch (e) {
    console.error("[excel-to-pdf] eprint CLI error:", e);
    return null;
  } finally {
    // 一時ファイル削除
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await unlink(tempDir).catch(() => {}); // rmdir
  }
}

function execFileAsync(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 120_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${error.message}\nstderr: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
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
