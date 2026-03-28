/**
 * Pure utility functions for ClusterEditor operations.
 * Extracted for testability — no React dependencies.
 */
import type { ClusterDefinition } from "./form-structure";

// ─── Batch update ────────────────────────────────────────────────────────────

/** Apply multiple patches to a cluster array in a single pass. */
export function batchUpdateClusters(
  clusters: ClusterDefinition[],
  patches: Map<string, Partial<ClusterDefinition>>
): ClusterDefinition[] {
  return clusters.map((c) => {
    const patch = patches.get(c.id);
    return patch ? { ...c, ...patch } : c;
  });
}

// ─── Nudge ───────────────────────────────────────────────────────────────────

/** Shift selected clusters by (dx, dy) in Excel-px coordinates. */
export function nudgeClusters(
  clusters: ClusterDefinition[],
  selectedIds: Set<string>,
  dx: number,
  dy: number
): ClusterDefinition[] {
  return clusters.map((c) => {
    if (!selectedIds.has(c.id)) return c;
    return {
      ...c,
      region: {
        top: c.region.top + dy,
        bottom: c.region.bottom + dy,
        left: c.region.left + dx,
        right: c.region.right + dx,
      },
    };
  });
}

// ─── Bounding box ────────────────────────────────────────────────────────────

export type Rect = { top: number; left: number; width: number; height: number };

/**
 * Compute the bounding box of selected clusters in screen coordinates.
 * Returns null when fewer than 2 clusters are selected.
 *
 * `toScreenRect` converts a cluster region to screen-space {top, left, right, bottom}.
 */
export function computeGroupBounds(
  clusters: ClusterDefinition[],
  selectedIds: Set<string>,
  toScreenRect: (c: ClusterDefinition) => { top: number; left: number; right: number; bottom: number } | null
): Rect | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let count = 0;
  for (const c of clusters) {
    if (!selectedIds.has(c.id)) continue;
    const r = toScreenRect(c);
    if (!r) continue;
    minX = Math.min(minX, r.left);
    minY = Math.min(minY, r.top);
    maxX = Math.max(maxX, r.right);
    maxY = Math.max(maxY, r.bottom);
    count++;
  }
  if (count < 2) return null;
  return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
}

// ─── Rubber band hit-test ────────────────────────────────────────────────────

export type SelectionRect = { left: number; top: number; right: number; bottom: number };

/**
 * Return the set of cluster IDs whose screen rects overlap with the selection rect.
 */
export function rubberBandHitTest(
  clusters: ClusterDefinition[],
  selRect: SelectionRect,
  toScreenRect: (c: ClusterDefinition) => { top: number; left: number; right: number; bottom: number } | null
): Set<string> {
  const hitIds = new Set<string>();
  for (const c of clusters) {
    const r = toScreenRect(c);
    if (!r) continue;
    if (r.left < selRect.right && r.right > selRect.left && r.top < selRect.bottom && r.bottom > selRect.top) {
      hitIds.add(c.id);
    }
  }
  return hitIds;
}
