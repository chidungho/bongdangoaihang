const { readStandings } = require("../services/standingsService");

function listStandings(req, res) {
  res.json({ data: readStandings() });
}

module.exports = { listStandings };
