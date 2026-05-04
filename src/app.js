const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const env = require("./config/env");
const apiRoutes = require("./routes/apiRoutes");
const pageRoutes = require("./routes/pageRoutes");
const { requestContext } = require("./middlewares/requestContext");
const { getHealth, getLiveness, getReadiness } = require("./controllers/healthController");
const logger = require("./utils/logger");

function createApp() {
  const app = express();
  const staticOpts = { etag: true, maxAge: "1h" };

  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "script-src": ["'self'", "https://cdnjs.cloudflare.com", "https://cdn.quilljs.com"],
          "style-src": [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
            "https://cdnjs.cloudflare.com",
            "https://cdn.quilljs.com",
          ],
          "font-src": ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
          "img-src": ["'self'", "data:", "https:"],
          "connect-src": ["'self'"],
        },
      },
    }),
  );
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestContext);

  const apiLimiter = rateLimit({
    windowMs: env.rateLimitWindowMs,
    max: env.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api", apiLimiter, apiRoutes);
  app.get("/health", getHealth);
  app.get("/health/live", getLiveness);
  app.get("/health/ready", getReadiness);

  app.use("/assets", express.static(path.join(env.rootDir, "public", "assets"), staticOpts));
  app.use("/css", express.static(path.join(env.rootDir, "public", "css"), staticOpts));
  app.use("/js", express.static(path.join(env.rootDir, "public", "js"), staticOpts));
  app.use("/tools", express.static(path.join(env.rootDir, "tools"), staticOpts));
  app.use("/manifest.json", express.static(path.join(env.rootDir, "public", "manifest.json"), staticOpts));
  app.use("/sw.js", express.static(path.join(env.rootDir, "public", "sw.js"), staticOpts));
  app.use(
    "/public_api_data.json",
    express.static(path.join(env.rootDir, "public", "data", "public_api_data.json"), staticOpts),
  );
  app.use(
    "/public_standings_data.json",
    express.static(path.join(env.rootDir, "public", "data", "public_standings_data.json"), staticOpts),
  );

  app.use(pageRoutes);
  app.use((req, res) => res.status(404).json({ error: "Not found" }));
  app.use((err, req, res, next) => {
    logger.error("unhandled_error", {
      requestId: req.requestId,
      message: err?.message,
      stack: err?.stack,
    });
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

module.exports = { createApp };
