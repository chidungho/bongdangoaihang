const env = require("../config/env");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { buildMatchesFromFixtures } = require("./fixtureDataService");
const execFileAsync = promisify(execFile);
let matchesCache = [];
let lastUpdatedAt = null;
let lastScrapeTime = null;
let isRefreshing = false;
let refreshTimer = null;

async function runScheduledIngestion() {
  if (process.env.NODE_ENV === "test") return;
  const scriptPath = path.join(env.rootDir, "data", "ingestion", "scraper-multiple-leagues.js");
  await execFileAsync(process.execPath, [scriptPath], {
    cwd: env.rootDir,
    timeout: 15 * 60 * 1000,
  });
}

async function refreshMatchesCache({ runIngestion = false } = {}) {
  if (isRefreshing) return matchesCache;
  isRefreshing = true;
  try {
    if (runIngestion) {
      try {
        await runScheduledIngestion();
      } catch (error) {
        console.warn("[MATCH] scrape job failed:", error.message);
      }
    }
    matchesCache = buildMatchesFromFixtures();
    lastUpdatedAt = new Date().toISOString();
    lastScrapeTime = Date.now();
    return matchesCache;
  } finally {
    isRefreshing = false;
  }
}

function getMatches() {
  return matchesCache;
}

function getMatchMeta() {
  return { updatedAt: lastUpdatedAt, total: matchesCache.length };
}

function getLastScrapeTime() {
  return lastScrapeTime;
}

async function initializeMatchCache() {
  matchesCache = buildMatchesFromFixtures();
  if (env.scrapeOnStartup && env.nodeEnv !== "development") {
    await refreshMatchesCache({ runIngestion: true });
  }
  if (!refreshTimer && process.env.NODE_ENV !== "test") {
    refreshTimer = setInterval(() => {
      refreshMatchesCache({ runIngestion: true }).catch(() => null);
    }, env.scrapeIntervalMs);
    if (typeof refreshTimer.unref === "function") {
      refreshTimer.unref();
    }
  }
}

module.exports = {
  initializeMatchCache,
  refreshMatchesCache,
  getMatches,
  getMatchMeta,
  getLastScrapeTime,
};
