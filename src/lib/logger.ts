/**
 * Structured logging module.
 *
 * Outputs to:
 *  - console (always)
 *  - JSONL file at {USER_DATA_PATH}/logs/analysis-{YYYY-MM-DD}.jsonl (when USER_DATA_PATH is set)
 *
 * Usage:
 *   import { createLogger } from "@/lib/logger";
 *   const log = createLogger("excel-parser");
 *   log.info("Sheet parsed", { rowCount: 50 });
 */

import { appendFileSync, readFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import path from "node:path";

// ─── Types ──────────────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEntry = {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
};

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG_RETENTION_DAYS = 7;
const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ─── State ──────────────────────────────────────────────────────────────────

let rotationDone = false;

function resolveUserDataPath(): string | null {
  // 1. 明示的に設定された環境変数
  if (process.env.USER_DATA_PATH) return process.env.USER_DATA_PATH;

  // 2. 開発モードフォールバック: OS 標準の AppData パス
  // dev モードでは "next-i-reporter"、パッケージ版では "jp.kondo723.app"
  const appNames = ["next-i-reporter", "jp.kondo723.app"];
  for (const appName of appNames) {
    let dir: string | null = null;
    if (process.platform === "win32" && process.env.APPDATA) {
      dir = path.join(process.env.APPDATA, appName);
    } else if (process.platform === "darwin" && process.env.HOME) {
      dir = path.join(process.env.HOME, "Library", "Application Support", appName);
    } else if (process.env.HOME) {
      dir = path.join(process.env.HOME, ".config", appName);
    }
    if (dir && existsSync(dir)) return dir;
  }

  return null;
}

function getLogsDir(): string | null {
  const userDataPath = resolveUserDataPath();
  if (!userDataPath) return null;

  const dir = path.join(userDataPath, "logs");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    return null;
  }

  return dir;
}

function getLogFilePath(): string | null {
  const dir = getLogsDir();
  if (!dir) return null;
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(dir, `analysis-${date}.jsonl`);
}

// ─── Rotation ───────────────────────────────────────────────────────────────

function rotateOnce(): void {
  if (rotationDone) return;
  rotationDone = true;

  const dir = getLogsDir();
  if (!dir) return;

  try {
    const files = readdirSync(dir).filter((f) => f.startsWith("analysis-") && f.endsWith(".jsonl"));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - LOG_RETENTION_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    for (const file of files) {
      const dateMatch = file.match(/analysis-(\d{4}-\d{2}-\d{2})\.jsonl/);
      if (dateMatch && dateMatch[1] < cutoffStr) {
        try {
          unlinkSync(path.join(dir, file));
        } catch {
          // ignore individual file deletion errors
        }
      }
    }
  } catch {
    // ignore rotation errors — non-critical
  }
}

// ─── Write ──────────────────────────────────────────────────────────────────

function writeToFile(entry: LogEntry): void {
  const filePath = getLogFilePath();
  if (!filePath) return;

  try {
    const line = JSON.stringify(entry) + "\n";
    appendFileSync(filePath, line, "utf8");
  } catch {
    // never let logging crash the app
  }
}

function writeToConsole(entry: LogEntry): void {
  const prefix = `[${entry.module}]`;
  const msg = `${prefix} ${entry.message}`;
  const consoleFn =
    entry.level === "error"
      ? console.error
      : entry.level === "warn"
        ? console.warn
        : entry.level === "debug"
          ? console.debug
          : console.log;

  if (entry.data && Object.keys(entry.data).length > 0) {
    consoleFn(msg, entry.data);
  } else {
    consoleFn(msg);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function createLogger(module: string): Logger {
  rotateOnce();

  function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      ...(data !== undefined ? { data } : {}),
    };

    writeToConsole(entry);
    writeToFile(entry);
  }

  return {
    debug: (message, data) => log("debug", message, data),
    info: (message, data) => log("info", message, data),
    warn: (message, data) => log("warn", message, data),
    error: (message, data) => log("error", message, data),
  };
}

// ─── Utilities for log reader (API route) ───────────────────────────────────

/** List available log dates (YYYY-MM-DD) sorted descending */
export function listLogDates(): string[] {
  const dir = getLogsDir();
  if (!dir) return [];

  try {
    return readdirSync(dir)
      .filter((f) => f.startsWith("analysis-") && f.endsWith(".jsonl"))
      .map((f) => f.replace("analysis-", "").replace(".jsonl", ""))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/** Read log entries for a given date, with optional filters */
export function readLogEntries(options: {
  date?: string;
  level?: LogLevel;
  module?: string;
  search?: string;
  limit?: number;
}): LogEntry[] {
  const dir = getLogsDir();
  if (!dir) return [];

  const date = options.date ?? new Date().toISOString().slice(0, 10);
  const filePath = path.join(dir, `analysis-${date}.jsonl`);

  if (!existsSync(filePath)) return [];

  try {
    const content = readFileSync(filePath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);
    const limit = options.limit ?? 500;

    const entries: LogEntry[] = [];
    // Read from end (most recent first) up to limit
    for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
      try {
        const entry = JSON.parse(lines[i]) as LogEntry;

        if (options.level && LEVEL_ORDER[entry.level] < LEVEL_ORDER[options.level]) continue;
        if (options.module && entry.module !== options.module) continue;
        if (options.search) {
          const searchLower = options.search.toLowerCase();
          const matches =
            entry.message.toLowerCase().includes(searchLower) ||
            entry.module.toLowerCase().includes(searchLower) ||
            (entry.data && JSON.stringify(entry.data).toLowerCase().includes(searchLower));
          if (!matches) continue;
        }

        entries.push(entry);
      } catch {
        // skip malformed lines
      }
    }

    return entries.reverse(); // chronological order
  } catch {
    return [];
  }
}
