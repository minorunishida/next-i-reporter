/**
 * pdfjs legacy を public に同期（メイン + ワーカー）。
 * ランタイムは public の ESM を webpackIgnore で読み、二重バンドルを避ける。
 */
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const legacy = path.join(root, "node_modules/pdfjs-dist/legacy/build");

const pdfjsDir = path.join(root, "public/pdfjs");
await mkdir(pdfjsDir, { recursive: true });

await cp(path.join(legacy, "pdf.min.mjs"), path.join(pdfjsDir, "pdf.min.mjs"));
await cp(path.join(legacy, "pdf.worker.min.mjs"), path.join(root, "public/pdf.worker.min.mjs"));

console.log("[sync-pdf-worker] public/pdfjs/pdf.min.mjs + public/pdf.worker.min.mjs (legacy)");
