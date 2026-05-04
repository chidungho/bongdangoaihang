const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const rootDir = path.resolve(__dirname, "..", "..");

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const normalizeRoutePath = (raw, fallback) => {
  const value = String(raw || "").trim();
  if (!value) return fallback;
  return value.startsWith("/") ? value : `/${value}`;
};

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  rootDir,
  port: toInt(process.env.PORT, 3000),
  jwtSecret: process.env.JWT_SECRET || "change-this-jwt-secret",
  jwtExpiresIn: String(process.env.JWT_EXPIRES_IN || "24h").trim(),
  refreshTokenExpiresIn: String(process.env.REFRESH_TOKEN_EXPIRES_IN || "30d").trim(),
  redisUrl: String(process.env.REDIS_URL || "").trim(),
  cacheMatchesTtlSec: toInt(process.env.CACHE_MATCHES_TTL_SEC, 30),
  cacheScoresTtlSec: toInt(process.env.CACHE_SCORES_TTL_SEC, 30),
  cacheStandingsTtlSec: toInt(process.env.CACHE_STANDINGS_TTL_SEC, 60),
  mongodbUri: process.env.MONGODB_URI || "",
  adminName: process.env.ADMIN_NAME || "System Admin",
  adminEmail: String(process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
  adminPassword: String(process.env.ADMIN_PASSWORD || "").trim(),
  adminPath: normalizeRoutePath(process.env.ADMIN_PATH, "/he-thong/quan-tri"),
  contributorPath: normalizeRoutePath(process.env.CONTRIBUTOR_PATH, "/he-thong/cong-tac-vien"),
  scrapeIntervalMs: toInt(process.env.SCRAPE_INTERVAL_MS, 86400000),
  scrapeOnStartup: String(process.env.SCRAPE_ON_STARTUP || "true").toLowerCase() !== "false",
  matchProvider: String(process.env.MATCH_PROVIDER || "auto").trim().toLowerCase(),
  footballDataApiKey: String(process.env.FOOTBALL_DATA_API_KEY || "").trim(),
  footballDataBaseUrl: String(process.env.FOOTBALL_DATA_BASE_URL || "https://api.football-data.org/v4")
    .trim()
    .replace(/\/+$/, ""),
  footballDataCompetitions: String(process.env.FOOTBALL_DATA_COMPETITIONS || "PL,CL,PD,SA,BL1,FL1,ELC,EL")
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean),
  footballDataCacheTtlMs: toInt(process.env.FOOTBALL_DATA_CACHE_TTL_MS, 60000),
  siteBaseUrl: String(process.env.SITE_BASE_URL || "http://localhost:3000").replace(/\/+$/, ""),
  requestLogEnabled: String(process.env.REQUEST_LOG_ENABLED || "true").toLowerCase() !== "false",
  rateLimitWindowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 900000),
  rateLimitMax: toInt(process.env.RATE_LIMIT_MAX, 200),
  authRateLimitMax: toInt(process.env.AUTH_RATE_LIMIT_MAX, 15),
};
