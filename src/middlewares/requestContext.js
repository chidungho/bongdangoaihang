const crypto = require("crypto");
const env = require("../config/env");
const logger = require("../utils/logger");
const { recordRequest } = require("../services/metricsService");

function requestContext(req, res, next) {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  const startedAt = Date.now();
  res.on("finish", () => {
    const elapsed = Date.now() - startedAt;
    recordRequest(req.originalUrl, res.statusCode, elapsed);
    if (!env.requestLogEnabled) return;
    logger.info("request_complete", {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      elapsedMs: elapsed,
    });
  });
  next();
}

module.exports = { requestContext };
