"use client";

/**
 * pdfjs は Webpack に取り込むと二重バンドルで Object.defineProperty 等が壊れる。
 * postinstall で public/pdfjs/pdf.min.mjs に置いた legacy を、バンドル対象外で import する。
 */
type PdfJsModule = typeof import("pdfjs-dist");

let cache: Promise<PdfJsModule> | null = null;

export function loadPdfJs(): Promise<PdfJsModule> {
  if (!cache) {
    // public の ESM をランタイム import（TS は絶対パスモジュールを解決しない）
    // @ts-expect-error — ビルド時は存在しないが postinstall で公開される
    cache = import(/* webpackIgnore: true */ "/pdfjs/pdf.min.mjs").then((mod) => {
      const pdfjs = mod as unknown as PdfJsModule;
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return pdfjs;
    });
  }
  return cache;
}
