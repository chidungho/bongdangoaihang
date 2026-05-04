const { getMatches, getMatchMeta, refreshMatchesCache } = require("../services/matchService");
const crypto = require("crypto");
const env = require("../config/env");
const { getCache, setCache, delCache } = require("../services/cacheService");
const CACHE_KEY = "api:matches:v1";

async function listMatches(req, res) {
  const forceRefresh = String(req.query.refresh || "").toLowerCase() === "true";
  if (forceRefresh) {
    await refreshMatchesCache();
    await delCache(CACHE_KEY);
  }
  let data = await getCache(CACHE_KEY);
  if (!data) {
    data = getMatches();
    await setCache(CACHE_KEY, data, env.cacheMatchesTtlSec);
  }
  const etag = `"${crypto.createHash("sha1").update(JSON.stringify(data)).digest("hex")}"`;
  if (req.headers["if-none-match"] === etag) {
    return res.status(304).end();
  }
  res.set("ETag", etag);
  res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
  res.json({
    data,
    matches: data,
    meta: getMatchMeta(),
  });
}

module.exports = { listMatches };
