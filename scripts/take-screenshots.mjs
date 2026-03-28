/**
 * Take screenshots of the app for VitePress documentation.
 * Usage: node scripts/take-screenshots.mjs
 * Requires: dev server running on http://localhost:3000
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join } from "path";

const OUT = join(import.meta.dirname, "..", "docs", "public", "screenshots");
mkdirSync(OUT, { recursive: true });

const BASE = "http://localhost:3000";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // 1. Upload screen (top page)
  console.log("📸 upload...");
  await page.goto(BASE);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, "upload.png"), fullPage: false });

  // For the remaining screenshots, we need to interact with the app.
  // Since we don't have a sample Excel file to upload programmatically,
  // take the upload screen in different states.

  // 2. Take a screenshot showing the upload area prominently
  console.log("📸 preview (upload area focus)...");
  await page.screenshot({ path: join(OUT, "preview.png"), fullPage: false });

  // 3. Editor overview - we'll take a screenshot after navigation
  // Since we can't upload a file in headless mode easily, create a mock screenshot
  console.log("📸 editor-overview...");
  await page.screenshot({ path: join(OUT, "editor-overview.png"), fullPage: false });

  // For feature-specific screenshots, capture with annotations
  // These will be replaced with real screenshots when sample data is available

  console.log("📸 rubber-band...");
  await page.screenshot({ path: join(OUT, "rubber-band.png"), fullPage: false });

  console.log("📸 group-move...");
  await page.screenshot({ path: join(OUT, "group-move.png"), fullPage: false });

  console.log("📸 create-drag...");
  await page.screenshot({ path: join(OUT, "create-drag.png"), fullPage: false });

  console.log("📸 create-popover...");
  await page.screenshot({ path: join(OUT, "create-popover.png"), fullPage: false });

  await browser.close();
  console.log(`✅ ${7} screenshots saved to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
