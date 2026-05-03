const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const env = require("./config/env");
const apiRoutes = require("./routes/apiRoutes");
const pageRoutes = require("./routes/pageRoutes");
const { requestContext } = require("./middlewares/requestContext");
const { getHealth } = require("./controllers/healthController");

function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));
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

  app.use("/assets", express.static(path.join(env.rootDir, "public", "assets")));
  app.use("/css", express.static(path.join(env.rootDir, "public", "css")));
  app.use("/js", express.static(path.join(env.rootDir, "public", "js")));
  app.use("/tools", express.static(path.join(env.rootDir, "tools")));
  app.use("/manifest.json", express.static(path.join(env.rootDir, "public", "manifest.json")));
  app.use("/sw.js", express.static(path.join(env.rootDir, "public", "sw.js")));
  app.use("/public_api_data.json", express.static(path.join(env.rootDir, "public", "data", "public_api_data.json")));
  app.use(
    "/public_standings_data.json",
    express.static(path.join(env.rootDir, "public", "data", "public_standings_data.json")),
  );

  app.use(pageRoutes);
  app.use((req, res) => res.status(404).json({ error: "Not found" }));
  app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

module.exports = { createApp };
