const { getLastScrapeTime, getCrawlerStatus } = require("../services/matchService");
const { isBlogReady } = require("../services/mongoService");
const { getMetricsSummary } = require("../services/metricsService");

function getHealth(req, res) {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    blogReady: isBlogReady(),
    lastScrapeTime: getLastScrapeTime(),
    now: new Date().toISOString(),
  });
}

function getLiveness(req, res) {
  res.json({
    status: "alive",
    now: new Date().toISOString(),
  });
}

function getReadiness(req, res) {
  const crawler = getCrawlerStatus();
  const blogReady = isBlogReady();
  const scraperReady = Boolean(crawler?.lastSuccess) || Boolean(getLastScrapeTime());
  const ready = blogReady && scraperReady;
  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "degraded",
    blogReady,
    scraperReady,
    crawler,
    metrics: getMetricsSummary(),
    now: new Date().toISOString(),
  });
}

module.exports = { getHealth, getLiveness, getReadiness };
