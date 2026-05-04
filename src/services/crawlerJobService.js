const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const env = require("../config/env");
const logger = require("../utils/logger");
const { recordCrawlerRun } = require("./metricsService");

const execFileAsync = promisify(execFile);

const lockPath = path.join(env.rootDir, "data", "ingestion", ".crawler.lock");
const statusPath = path.join(env.rootDir, "data", "ingestion", "crawler-status.json");
const fixturesPath = path.join(env.rootDir, "data", "ingestion", "all_leagues_fixtures.json");
const snapshotsDir = path.join(env.rootDir, "data", "snapshots");

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 5_000;
const ALERT_FAILURE_THRESHOLD = 3;

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readStatus() {
  if (!fs.existsSync(statusPath)) {
    return {
      running: false,
      consecutiveFailures: 0,
      lastSuccess: null,
      lastError: null,
      lastDurationMs: null,
      lastRows: null,
    };
  }
  try {
    return JSON.parse(fs.readFileSync(statusPath, "utf-8"));
  } catch {
    return {
      running: false,
      consecutiveFailures: 0,
      lastSuccess: null,
      lastError: null,
      lastDurationMs: null,
      lastRows: null,
    };
  }
}

function writeStatus(status) {
  ensureDir(statusPath);
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2), "utf-8");
}

function acquireLock() {
  ensureDir(lockPath);
  try {
    const fd = fs.openSync(lockPath, "wx");
    fs.closeSync(fd);
    return true;
  } catch {
    return false;
  }
}

function releaseLock() {
  try {
    if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
  } catch {
    return;
  }
}

function readRowsCount() {
  try {
    const parsed = JSON.parse(fs.readFileSync(fixturesPath, "utf-8"));
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function saveSnapshot() {
  if (!fs.existsSync(fixturesPath)) return null;
  fs.mkdirSync(snapshotsDir, { recursive: true });
  const dateKey = new Date().toISOString().slice(0, 10);
  const snapshotPath = path.join(snapshotsDir, `fixtures-${dateKey}.json`);
  fs.copyFileSync(fixturesPath, snapshotPath);
  return snapshotPath;
}

async function executeCrawlerOnce(timeoutMs) {
  const scriptPath = path.join(env.rootDir, "data", "ingestion", "scraper-multiple-leagues.js");
  await execFileAsync(process.execPath, [scriptPath], {
    cwd: env.rootDir,
    timeout: timeoutMs,
  });
}

async function runCrawlerJob({ timeoutMs = 15 * 60 * 1000 } = {}) {
  if (process.env.NODE_ENV === "test") return { ok: true, skipped: true };
  if (!acquireLock()) {
    return { ok: false, skipped: true, reason: "locked" };
  }

  const startedAt = Date.now();
  let status = readStatus();
  status = { ...status, running: true };
  writeStatus(status);

  try {
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        await executeCrawlerOnce(timeoutMs);
        const durationMs = Date.now() - startedAt;
        const rows = readRowsCount();
        if (rows <= 0) {
          throw new Error(`Crawler output is empty at ${fixturesPath}`);
        }
        const snapshotPath = saveSnapshot();
        if (!snapshotPath) {
          throw new Error(`Snapshot save failed for ${fixturesPath}`);
        }
        status = {
          ...status,
          running: false,
          consecutiveFailures: 0,
          lastSuccess: new Date().toISOString(),
          lastError: null,
          lastDurationMs: durationMs,
          lastRows: rows,
          lastSnapshot: snapshotPath,
        };
        writeStatus(status);
        recordCrawlerRun({ ok: true, durationMs, rows });
        logger.info("crawler_success", {
          durationMs,
          rows,
          attempt,
          snapshotPath,
          fixturesPath,
        });
        return { ok: true, durationMs, rows, attempt };
      } catch (error) {
        lastError = error;
        logger.warn("crawler_attempt_failed", {
          attempt,
          error: error.message,
          fixturesPath,
        });
        if (attempt < MAX_RETRIES) {
          const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
          await sleep(backoff);
        }
      }
    }

    const durationMs = Date.now() - startedAt;
    const message = String(lastError?.message || "Crawler failed");
    status = {
      ...status,
      running: false,
      consecutiveFailures: (status.consecutiveFailures || 0) + 1,
      lastError: message,
      lastDurationMs: durationMs,
    };
    writeStatus(status);
    recordCrawlerRun({ ok: false, durationMs, error: message });
    logger.error("crawler_failed", {
      durationMs,
      consecutiveFailures: status.consecutiveFailures,
      error: message,
    });
    if (status.consecutiveFailures >= ALERT_FAILURE_THRESHOLD) {
      logger.error("crawler_alert_threshold_reached", {
        consecutiveFailures: status.consecutiveFailures,
        threshold: ALERT_FAILURE_THRESHOLD,
      });
    }
    return { ok: false, error: message, durationMs };
  } finally {
    releaseLock();
  }
}

function getCrawlerStatus() {
  return readStatus();
}

module.exports = {
  runCrawlerJob,
  getCrawlerStatus,
};
