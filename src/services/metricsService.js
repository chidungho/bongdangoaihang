const metrics = {
  startedAt: Date.now(),
  requestsTotal: 0,
  requestsByStatus: {},
  apiLatencyMsTotal: 0,
  apiLatencySamples: 0,
  crawler: {
    runs: 0,
    failures: 0,
    lastDurationMs: null,
    lastRows: null,
    lastSuccess: null,
    lastError: null,
  },
};

function recordRequest(path, statusCode, durationMs) {
  metrics.requestsTotal += 1;
  const statusKey = String(statusCode || "unknown");
  metrics.requestsByStatus[statusKey] = (metrics.requestsByStatus[statusKey] || 0) + 1;
  if (String(path || "").startsWith("/api/")) {
    metrics.apiLatencyMsTotal += Number(durationMs || 0);
    metrics.apiLatencySamples += 1;
  }
}

function recordCrawlerRun({ ok, durationMs, rows, error }) {
  metrics.crawler.runs += 1;
  if (ok) {
    metrics.crawler.lastDurationMs = durationMs;
    metrics.crawler.lastRows = rows;
    metrics.crawler.lastSuccess = new Date().toISOString();
    metrics.crawler.lastError = null;
    return;
  }
  metrics.crawler.failures += 1;
  metrics.crawler.lastError = String(error || "Unknown crawler error");
}

function getMetricsSummary() {
  return {
    uptimeSec: Math.round((Date.now() - metrics.startedAt) / 1000),
    requestsTotal: metrics.requestsTotal,
    requestsByStatus: metrics.requestsByStatus,
    apiLatencyAvgMs:
      metrics.apiLatencySamples > 0
        ? Math.round(metrics.apiLatencyMsTotal / metrics.apiLatencySamples)
        : 0,
    crawler: { ...metrics.crawler },
  };
}

module.exports = {
  recordRequest,
  recordCrawlerRun,
  getMetricsSummary,
};
