const { createApp } = require("../src/app");
const { bootstrapRuntime } = require("../src/bootstrap");

const app = createApp();
const ready = bootstrapRuntime({
  runIngestion: false,
  startTimers: false,
});

module.exports = async function handler(req, res) {
  try {
    await ready;
    return app(req, res);
  } catch (error) {
    console.error("[BOOT] Fatal serverless startup error:", error);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
};
