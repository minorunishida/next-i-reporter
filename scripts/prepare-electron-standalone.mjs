/**
 * Next.js standalone ビルド後に必須のアセットをコピーする。
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/output
 */
import { cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dotNext = path.join(root, ".next");
const standalone = path.join(dotNext, "standalone");

await cp(
  path.join(dotNext, "static"),
  path.join(standalone, ".next", "static"),
  { recursive: true, force: true },
);
await cp(path.join(root, "public"), path.join(standalone, "public"), {
  recursive: true,
  force: true,
});

console.log("[prepare-electron-standalone] copied .next/static and public into standalone");
