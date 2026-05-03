const { getMatches, getMatchMeta, refreshMatchesCache } = require("../services/matchService");

async function listMatches(req, res) {
  const forceRefresh = String(req.query.refresh || "").toLowerCase() === "true";
  if (forceRefresh) {
    await refreshMatchesCache();
  }
  const data = getMatches();
  res.json({
    data,
    matches: data,
    meta: getMatchMeta(),
  });
}

module.exports = { listMatches };
