const { readStandings } = require("../services/standingsService");
const crypto = require("crypto");
const env = require("../config/env");
const { getCache, setCache } = require("../services/cacheService");
const CACHE_KEY = "api:standings:v1";

async function listStandings(req, res) {
  let data = await getCache(CACHE_KEY);
  if (!data) {
    data = readStandings();
    await setCache(CACHE_KEY, data, env.cacheStandingsTtlSec);
  }
  const etag = `"${crypto.createHash("sha1").update(JSON.stringify(data)).digest("hex")}"`;
  if (req.headers["if-none-match"] === etag) {
    return res.status(304).end();
  }
  res.set("ETag", etag);
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
  res.json({ data });
}

module.exports = { listStandings };
