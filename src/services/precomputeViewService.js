const fs = require("fs");
const path = require("path");
const env = require("../config/env");
const { buildMatchesFromFixtures, buildRecentScoresFromFixtures, buildStandingsFromFixtures } = require("./fixtureDataService");

const viewsDir = path.join(env.rootDir, "data", "views");

function writeJson(fileName, data) {
  fs.mkdirSync(viewsDir, { recursive: true });
  const filePath = path.join(viewsDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function precomputeViews() {
  writeJson("matches.json", buildMatchesFromFixtures());
  writeJson("scores.json", buildRecentScoresFromFixtures());
  writeJson("standings.json", buildStandingsFromFixtures());
}

module.exports = { precomputeViews };
