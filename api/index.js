const { createApp } = require("../src/app");
const { bootstrapRuntime } = require("../src/bootstrap");

const app = createApp();
let readyError = null;
const ready = bootstrapRuntime({
  connectDatabase: false,
  runIngestion: false,
  startTimers: false,
}).catch((error) => {
  readyError = error;
  console.error("[BOOT] Fatal serverless startup error:", error);
});

function needsRuntimeData(req) {
  return String(req.url || "").startsWith("/api/matches");
}

module.exports = async function handler(req, res) {
  try {
    if (needsRuntimeData(req)) {
      await ready;
      if (readyError) throw readyError;
    }
    return app(req, res);
  } catch (error) {
    console.error("[BOOT] Fatal serverless startup error:", error);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
};
