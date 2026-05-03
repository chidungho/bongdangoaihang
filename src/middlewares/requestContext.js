const crypto = require("crypto");
const env = require("../config/env");

function requestContext(req, res, next) {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  const startedAt = Date.now();
  res.on("finish", () => {
    if (!env.requestLogEnabled) return;
    const elapsed = Date.now() - startedAt;
    console.info(`[${requestId}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${elapsed}ms)`);
  });
  next();
}

module.exports = { requestContext };
