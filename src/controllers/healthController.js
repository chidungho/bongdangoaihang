const { getLastScrapeTime } = require("../services/matchService");
const { isBlogReady } = require("../services/mongoService");

function getHealth(req, res) {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    blogReady: isBlogReady(),
    lastScrapeTime: getLastScrapeTime(),
    now: new Date().toISOString(),
  });
}

module.exports = { getHealth };
