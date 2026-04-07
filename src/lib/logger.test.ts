import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

// Set USER_DATA_PATH before importing logger
const tempDir = mkdtempSync(path.join(tmpdir(), "logger-test-"));
process.env.USER_DATA_PATH = tempDir;

// Dynamic import to pick up the env var
const { createLogger, listLogDates, readLogEntries } = await import("./logger.ts");

describe("createLogger", () => {
  afterEach(() => {
    // Clean up log files between tests
    const logsDir = path.join(tempDir, "logs");
    if (existsSync(logsDir)) {
      rmSync(logsDir, { recursive: true, force: true });
    }
  });

  it("writes JSONL entries to file", () => {
    const log = createLogger("test-module");
    log.info("hello world", { key: "value" });

    const date = new Date().toISOString().slice(0, 10);
    const logFile = path.join(tempDir, "logs", `analysis-${date}.jsonl`);
    assert.ok(existsSync(logFile), "log file should exist");

    const content = readFileSync(logFile, "utf8").trim();
    const entry = JSON.parse(content);
    assert.equal(entry.level, "info");
    assert.equal(entry.module, "test-module");
    assert.equal(entry.message, "hello world");
    assert.deepEqual(entry.data, { key: "value" });
    assert.ok(entry.timestamp);
  });

  it("omits data field when not provided", () => {
    const log = createLogger("mod");
    log.warn("no data");

    const date = new Date().toISOString().slice(0, 10);
    const logFile = path.join(tempDir, "logs", `analysis-${date}.jsonl`);
    const content = readFileSync(logFile, "utf8").trim();
    const entry = JSON.parse(content);
    assert.equal(entry.level, "warn");
    assert.equal(entry.data, undefined);
  });

  it("writes multiple entries as separate lines", () => {
    const log = createLogger("multi");
    log.info("first");
    log.debug("second");
    log.error("third");

    const date = new Date().toISOString().slice(0, 10);
    const logFile = path.join(tempDir, "logs", `analysis-${date}.jsonl`);
    const lines = readFileSync(logFile, "utf8").trim().split("\n");
    assert.equal(lines.length, 3);
    assert.equal(JSON.parse(lines[0]).level, "info");
    assert.equal(JSON.parse(lines[1]).level, "debug");
    assert.equal(JSON.parse(lines[2]).level, "error");
  });
});

describe("listLogDates", () => {
  afterEach(() => {
    const logsDir = path.join(tempDir, "logs");
    if (existsSync(logsDir)) {
      rmSync(logsDir, { recursive: true, force: true });
    }
  });

  it("returns dates of existing log files descending", () => {
    const log = createLogger("dates-test");
    log.info("entry");

    const dates = listLogDates();
    assert.ok(dates.length >= 1);
    const today = new Date().toISOString().slice(0, 10);
    assert.equal(dates[0], today);
  });
});

describe("readLogEntries", () => {
  afterEach(() => {
    const logsDir = path.join(tempDir, "logs");
    if (existsSync(logsDir)) {
      rmSync(logsDir, { recursive: true, force: true });
    }
  });

  it("reads and filters by level", () => {
    const log = createLogger("filter-test");
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");

    const all = readLogEntries({});
    assert.equal(all.length, 4);

    const warnAndAbove = readLogEntries({ level: "warn" });
    assert.equal(warnAndAbove.length, 2);
    assert.ok(warnAndAbove.every((e) => e.level === "warn" || e.level === "error"));
  });

  it("filters by module", () => {
    const logA = createLogger("mod-a");
    const logB = createLogger("mod-b");
    logA.info("a");
    logB.info("b");

    const filtered = readLogEntries({ module: "mod-a" });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].module, "mod-a");
  });

  it("filters by search text", () => {
    const log = createLogger("search");
    log.info("hello world");
    log.info("goodbye world");

    const filtered = readLogEntries({ search: "hello" });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].message, "hello world");
  });

  it("respects limit", () => {
    const log = createLogger("limit");
    for (let i = 0; i < 10; i++) log.info(`msg ${i}`);

    const limited = readLogEntries({ limit: 3 });
    assert.equal(limited.length, 3);
  });
});

// Cleanup
afterEach(() => {});
// Final cleanup after all tests
process.on("exit", () => {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});
