const { buildStandingsFromFixtures } = require("./fixtureDataService");

function readStandings() {
  return buildStandingsFromFixtures();
}

module.exports = { readStandings };
