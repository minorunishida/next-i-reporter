import { readFile } from "node:fs/promises";
import { inspectConmasTemplate } from "../lib/template-inspector";
import { diffConmasTemplates } from "../lib/template-diff";
import { validateConmasTemplate } from "../lib/xml-validator";

type CommandHandler = (args: string[]) => Promise<number>;

const commandHandlers: Record<string, CommandHandler> = {
  "diff-template": diffTemplateCommand,
  "inspect-template": inspectTemplateCommand,
  "validate-template": validateTemplateCommand,
};

async function main(): Promise<void> {
  const [, , commandName, ...args] = process.argv;

  if (!commandName || commandName === "--help" || commandName === "-h" || commandName === "help") {
    printUsage();
    process.exitCode = 0;
    return;
  }

  const command = commandHandlers[commandName];
  if (!command) {
    console.error(`Unknown command: ${commandName}`);
    printUsage();
    process.exitCode = 2;
    return;
  }

  try {
    process.exitCode = await command(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown CLI error";
    console.error(message);
    process.exitCode = 1;
  }
}

async function inspectTemplateCommand(args: string[]): Promise<number> {
  const parsed = parseCommonArgs(args);
  const xml = await readXmlFile(parsed.filePath);
  const inspection = inspectConmasTemplate(xml);

  if (parsed.json) {
    console.log(JSON.stringify(inspection, null, 2));
    return inspection.warnings.length === 0 ? 0 : 1;
  }

  console.log(`Template: ${inspection.defTopName || "(empty)"}`);
  console.log(`Sheets: declared=${inspection.declaredSheetCount ?? "(empty)"} actual=${inspection.actualSheetCount}`);
  console.log(`Clusters: ${inspection.clusterCount}`);
  console.log(`Background PDF: ${inspection.hasBackgroundImage ? "present" : "missing"}`);
  console.log("");
  console.log("Cluster types:");

  if (Object.keys(inspection.clusterTypeCounts).length === 0) {
    console.log("- none");
  } else {
    for (const [type, count] of sortCounts(inspection.clusterTypeCounts)) {
      console.log(`- ${type}: ${count}`);
    }
  }

  console.log("");
  console.log("Sheets:");

  if (inspection.sheets.length === 0) {
    console.log("- none");
  } else {
    for (const sheet of inspection.sheets) {
      const label = `#${sheet.sheetNo ?? "?"} ${sheet.defSheetName || "(unnamed)"}`;
      const size = `${formatNumber(sheet.width)} x ${formatNumber(sheet.height)}`;
      const typeSummary = summarizeCounts(sheet.clusterTypeCounts);
      console.log(`- ${label} | size=${size} | clusters=${sheet.clusterCount}${typeSummary ? ` | ${typeSummary}` : ""}`);
    }
  }

  if (inspection.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of inspection.warnings) {
      console.log(`- ${warning}`);
    }
    return 1;
  }

  return 0;
}

async function validateTemplateCommand(args: string[]): Promise<number> {
  const parsed = parseCommonArgs(args);
  const xml = await readXmlFile(parsed.filePath);
  const result = validateConmasTemplate(xml);

  if (parsed.json) {
    console.log(JSON.stringify(result, null, 2));
    return result.ok ? 0 : 1;
  }

  console.log(result.ok ? "Validation: OK" : "Validation: FAILED");
  console.log(
    `Sheets=${result.inspection.actualSheetCount} Clusters=${result.inspection.clusterCount} Errors=${result.errors.length} Warnings=${result.warnings.length}`
  );

  if (result.errors.length > 0) {
    console.log("");
    console.log("Errors:");
    for (const error of result.errors) {
      console.log(`- ${error.path}: ${error.message}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log("");
    console.log("Warnings:");
    for (const warning of result.warnings) {
      console.log(`- ${warning.path}: ${warning.message}`);
    }
  }

  return result.ok ? 0 : 1;
}

async function diffTemplateCommand(args: string[]): Promise<number> {
  const parsed = parseDiffArgs(args);
  const [leftXml, rightXml] = await Promise.all([
    readXmlFile(parsed.leftPath),
    readXmlFile(parsed.rightPath),
  ]);
  const diff = diffConmasTemplates(leftXml, rightXml);

  if (parsed.json) {
    console.log(JSON.stringify(diff, null, 2));
    return diff.identical ? 0 : 1;
  }

  console.log(diff.identical ? "Diff: IDENTICAL" : "Diff: DIFFERENT");
  console.log(
    `Left sheets=${diff.summary.leftSheetCount} clusters=${diff.summary.leftClusterCount} | Right sheets=${diff.summary.rightSheetCount} clusters=${diff.summary.rightClusterCount}`
  );
  console.log(
    `Left name="${diff.summary.leftTemplateName || "(empty)"}" | Right name="${diff.summary.rightTemplateName || "(empty)"}"`
  );

  if (diff.differences.length > 0) {
    console.log("");
    console.log("Differences:");
    for (const difference of diff.differences) {
      console.log(`- ${difference}`);
    }
  }

  return diff.identical ? 0 : 1;
}

function parseCommonArgs(args: string[]): { filePath: string; json: boolean } {
  const json = args.includes("--json");
  const positionalArgs = args.filter((arg) => arg !== "--json");
  const filePath = positionalArgs[0];

  if (!filePath) {
    throw new Error("XML file path is required");
  }

  return { filePath, json };
}

function parseDiffArgs(args: string[]): { leftPath: string; rightPath: string; json: boolean } {
  const json = args.includes("--json");
  const positionalArgs = args.filter((arg) => arg !== "--json");
  const [leftPath, rightPath] = positionalArgs;

  if (!leftPath || !rightPath) {
    throw new Error("Two XML file paths are required");
  }

  return { leftPath, rightPath, json };
}

async function readXmlFile(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

function sortCounts(counts: Record<string, number>): Array<[string, number]> {
  return Object.entries(counts).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  });
}

function summarizeCounts(counts: Record<string, number>): string {
  return sortCounts(counts)
    .slice(0, 3)
    .map(([type, count]) => `${type}:${count}`)
    .join(", ");
}

function formatNumber(value: number | null): string {
  return value === null ? "(empty)" : value.toFixed(2);
}

function printUsage(): void {
  console.log("Usage:");
  console.log("  node --experimental-strip-types src/cli/index.ts inspect-template <xml-path> [--json]");
  console.log("  node --experimental-strip-types src/cli/index.ts validate-template <xml-path> [--json]");
  console.log("  node --experimental-strip-types src/cli/index.ts diff-template <left-xml> <right-xml> [--json]");
}

await main();
