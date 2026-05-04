const { buildRecentScoresFromFixtures } = require("./fixtureDataService");

function getRecentScores() {
  return buildRecentScoresFromFixtures();
}

module.exports = { getRecentScores };
