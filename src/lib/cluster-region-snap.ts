import type { SheetStructure } from "./form-structure";

export type RegionRect = { top: number; bottom: number; left: number; right: number };

/**
 * cellAddress に一致するセル（結合の origin）があれば、その region に置き換える。
 * AI が返した px 矩形の微ズレを抑え、px フォールバック経路でも Excel 幾何と一致させる。
 */
export function snapClusterRegionToCell(
  sheet: SheetStructure,
  cellAddress: string,
  fallback: RegionRect
): RegionRect {
  const key = cellAddress.replace(/\$/g, "").split(":")[0].trim().toUpperCase();
  if (!key) return fallback;
  const cell = sheet.cells.find((c) => c.address.toUpperCase() === key);
  if (!cell) return fallback;
  return {
    top: cell.region.top,
    bottom: cell.region.bottom,
    left: cell.region.left,
    right: cell.region.right,
  };
}
