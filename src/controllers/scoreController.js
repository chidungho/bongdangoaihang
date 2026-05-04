const { getRecentScores } = require("../services/scoreService");
const crypto = require("crypto");
const env = require("../config/env");
const { getCache, setCache } = require("../services/cacheService");
const CACHE_KEY = "api:scores:v1";

async function listRecentScores(req, res) {
  let data = await getCache(CACHE_KEY);
  if (!data) {
    data = getRecentScores();
    await setCache(CACHE_KEY, data, env.cacheScoresTtlSec);
  }
  const etag = `"${crypto.createHash("sha1").update(JSON.stringify(data)).digest("hex")}"`;
  if (req.headers["if-none-match"] === etag) {
    return res.status(304).end();
  }
  res.set("ETag", etag);
  res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
  res.json({
    data,
    meta: {
      total: data.length,
      rangeDays: 7,
      generatedAt: new Date().toISOString(),
    },
  });
}

module.exports = { listRecentScores };
