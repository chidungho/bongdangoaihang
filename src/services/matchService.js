const env = require("../config/env");
const { buildMatchesFromFixtures } = require("./fixtureDataService");
const { runCrawlerJob, getCrawlerStatus } = require("./crawlerJobService");
const { delCache } = require("./cacheService");
const { precomputeViews } = require("./precomputeViewService");
let matchesCache = [];
let lastUpdatedAt = null;
let lastScrapeTime = null;
let isRefreshing = false;
let refreshTimer = null;
let autoScoreCrawlTimer = null;
const AUTO_CRAWL_CHECK_MS = 5 * 60 * 1000;
const MATCH_END_WITH_BUFFER_MINUTES = 165;

async function refreshMatchesCache({ runIngestion = false } = {}) {
  if (isRefreshing) return matchesCache;
  isRefreshing = true;
  try {
    if (runIngestion) {
      try {
        const result = await runCrawlerJob();
        if (result?.ok) lastScrapeTime = Date.now();
      } catch (error) {
        console.warn("[MATCH] scrape job failed:", error.message);
      }
    }
    matchesCache = buildMatchesFromFixtures();
    try {
      precomputeViews();
    } catch (error) {
      console.warn("[MATCH] precompute view failed:", error.message);
    }
    await Promise.allSettled([
      delCache("api:matches:v1"),
      delCache("api:scores:v1"),
      delCache("api:standings:v1"),
    ]);
    lastUpdatedAt = new Date().toISOString();
    lastScrapeTime = Date.now();
    return matchesCache;
  } finally {
    isRefreshing = false;
  }
}

function parseKickoff(dateValue, timeValue) {
  const rawDate = String(dateValue || "").trim();
  const dateMatch = rawDate.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!dateMatch) return null;
  const day = Number.parseInt(dateMatch[1], 10);
  const month = Number.parseInt(dateMatch[2], 10) - 1;
  let year = dateMatch[3] ? Number.parseInt(dateMatch[3], 10) : new Date().getFullYear();
  if (year < 100) year += 2000;
  const rawTime = String(timeValue || "").trim();
  const timeMatch = rawTime.match(/(\d{1,2}):(\d{2})/);
  const hour = timeMatch ? Number.parseInt(timeMatch[1], 10) : 0;
  const minute = timeMatch ? Number.parseInt(timeMatch[2], 10) : 0;
  const kickoff = new Date(year, month, day, hour, minute, 0, 0);
  return Number.isNaN(kickoff.getTime()) ? null : kickoff;
}

function hasFinishedScore(match) {
  return /\d+\s*-\s*\d+/.test(String(match?.score || ""));
}

function maybeTriggerPostMatchIngestion() {
  if (isRefreshing || !matchesCache.length) return;
  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const shouldTrigger = matchesCache.some((match) => {
    if (hasFinishedScore(match)) return false;
    const kickoff = parseKickoff(match?.date, match?.time);
    if (!kickoff) return false;
    if (kickoff < today || kickoff >= tomorrow) return false;
    const scrapeAt = kickoff.getTime() + MATCH_END_WITH_BUFFER_MINUTES * 60 * 1000;
    return now >= scrapeAt;
  });

  if (!shouldTrigger) return;
  if (lastScrapeTime && now - lastScrapeTime < 10 * 60 * 1000) return;
  refreshMatchesCache({ runIngestion: true }).catch(() => null);
}

function getMatches() {
  return matchesCache;
}

function getMatchMeta() {
  return {
    updatedAt: lastUpdatedAt,
    total: matchesCache.length,
    crawler: getCrawlerStatus(),
  };
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
  if (!autoScoreCrawlTimer && process.env.NODE_ENV !== "test" && env.nodeEnv !== "development") {
    autoScoreCrawlTimer = setInterval(maybeTriggerPostMatchIngestion, AUTO_CRAWL_CHECK_MS);
    if (typeof autoScoreCrawlTimer.unref === "function") {
      autoScoreCrawlTimer.unref();
    }
  }
}

module.exports = {
  initializeMatchCache,
  refreshMatchesCache,
  getMatches,
  getMatchMeta,
  getLastScrapeTime,
  getCrawlerStatus,
};
