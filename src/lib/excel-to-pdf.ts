/**
 * Excel → PDF 変換 + 印刷メタ情報取得
 *
 * 優先順位:
 * 1. eprint CLI (ローカル COM Interop) — 最優先、メタ情報も返す
 * 2. Graph API (Azure AD) — フォールバック (メタ情報なし)
 * 3. null を返す (ブランク PDF にフォールバック)
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile, readFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import type { PrintMeta } from "./form-structure";
import { createLogger } from "./logger";

const log = createLogger("excel-to-pdf");

/** バンドル版 eprint.exe のパスを探す (electron:dev / packaged 両対応) */
function resolveBundledEprint(): string | null {
  // プロジェクトルートの resources/eprint/ (開発モード)
  const devPath = path.join(process.cwd(), "resources", "eprint", "eprint.exe");
  if (existsSync(devPath)) return devPath;
  // パッケージ版 (process.resourcesPath は Electron が設定)
  const resourcesPath = (process as any).resourcesPath as string | undefined;
  if (resourcesPath) {
    const pkgPath = path.join(resourcesPath, "eprint", "eprint.exe");
    if (existsSync(pkgPath)) return pkgPath;
  }
  return null;
}

export type PdfConversionResult = {
  pdfBuffer: Buffer;
  printMeta?: PrintMeta[];
};

export async function convertExcelToPdf(
  excelBuffer: Buffer,
  fileName: string
): Promise<PdfConversionResult | null> {
  // 1. eprint CLI (環境変数 or バンドル版フォールバック)
  const eprintPath = process.env.EPRINT_CLI_PATH || resolveBundledEprint();
  if (eprintPath) {
    return convertViaEprintCli(eprintPath, excelBuffer, fileName);
  }

  // 2. Graph API
  if (isGraphAvailable()) {
    const buf = await convertViaGraphApi(excelBuffer, fileName);
    return buf ? { pdfBuffer: buf } : null;
  }

  log.warn("変換手段なし — ブランク PDF にフォールバック");
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

    const args = [inputPath, outputPath, "--meta"];
    log.info("eprint CLI invocation", { eprintPath, args });

    const startTime = performance.now();
    const stdout = await execFileAsync(eprintPath, args);
    const elapsedMs = Math.round(performance.now() - startTime);

    const meta = JSON.parse(stdout) as {
      pdfPath: string;
      sheets: PrintMeta[];
    };

    const pdfBuffer = await readFile(outputPath);
    log.info("eprint conversion complete", {
      elapsedMs,
      pdfSizeBytes: pdfBuffer.length,
      sheetsCount: meta.sheets.length,
    });

    // シート別 printMeta サマリ
    for (const sheet of meta.sheets) {
      log.info("printMeta summary", {
        sheetName: sheet.name,
        rows: sheet.rows?.length ?? 0,
        cols: sheet.columns?.length ?? 0,
        marginsPt: sheet.margins,
        pageDimensionsPt: {
          width: sheet.pdfPageWidthPt,
          height: sheet.pdfPageHeightPt,
        },
        zoom: sheet.zoom,
        fitToPage: {
          wide: sheet.fitToPagesWide,
          tall: sheet.fitToPagesTall,
        },
        printArea: sheet.printArea,
        usedRange: sheet.usedRange,
      });
    }

    return { pdfBuffer, printMeta: meta.sheets };
  } catch (e) {
    log.error("eprint CLI error", {
      error: e instanceof Error ? e.message : String(e),
    });
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
  const tenantId = process.env.AZURE_TENANT_ID!;
  const clientId = process.env.AZURE_CLIENT_ID!;
  const clientSecret = process.env.AZURE_CLIENT_SECRET!;

  try {
    // 1. Get access token
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
          scope: "https://graph.microsoft.com/.default",
        }),
      }
    );
    const tokenData = (await tokenRes.json()) as { access_token: string };
    const token = tokenData.access_token;
    const headers = { Authorization: `Bearer ${token}` };

    // 2. Upload to OneDrive temp location
    const tempPath = `_temp_convert/${Date.now()}_${fileName}`;
    log.info("Graph API: uploading", { tempPath });
    const uploadRes = await fetch(
      `https://graph.microsoft.com/v1.0/drive/root:/${tempPath}:/content`,
      { method: "PUT", headers: { ...headers, "Content-Type": "application/octet-stream" }, body: new Uint8Array(excelBuffer) }
    );
    const uploadData = (await uploadRes.json()) as { id: string };
    const itemId = uploadData.id;

    // 3. Download as PDF
    const pdfRes = await fetch(
      `https://graph.microsoft.com/v1.0/drive/items/${itemId}/content?format=pdf`,
      { headers }
    );
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    log.info("Graph API: PDF generated", { pdfSizeBytes: pdfBuffer.length });

    // 4. Cleanup temp file
    await fetch(`https://graph.microsoft.com/v1.0/drive/items/${itemId}`, {
      method: "DELETE",
      headers,
    }).catch(() => {});

    return pdfBuffer;
  } catch (e) {
    log.error("Graph API error", {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}
