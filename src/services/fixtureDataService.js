const fs = require("fs");
const path = require("path");
const env = require("../config/env");

const fixturesPath = path.join(env.rootDir, "data", "ingestion", "all_leagues_fixtures.json");
const TEAM_ALIASES = {
  "man utd": "Manchester United",
  "man united": "Manchester United",
  "man city": "Manchester City",
  spurs: "Tottenham Hotspur",
  "tottenham": "Tottenham Hotspur",
  "newcastle utd": "Newcastle United",
  wolves: "Wolverhampton Wanderers",
  brighton: "Brighton & Hove Albion",
};

function normalizeLeagueName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const normalized = raw.toLowerCase();

  if (normalized.includes("ngoại hạng anh") || normalized.includes("premier league")) {
    return "Ngoại hạng Anh";
  }
  if (normalized.includes("la liga")) return "La Liga";
  if (normalized.includes("serie a")) return "Serie A";
  if (normalized.includes("bundesliga")) return "Bundesliga";
  if (normalized.includes("ligue 1")) return "Ligue 1";
  if (normalized.includes("v.league") || normalized.includes("v league")) return "V.League 1";
  if (
    normalized.includes("cúp c1") ||
    normalized.includes("cup c1") ||
    normalized.includes("champions league")
  ) {
    return "CUP C1";
  }
  if (normalized.includes("europa")) return "Europa";
  if (normalized.includes("fa cup")) return "FA Cup";
  return raw.replace(/^lịch thi đấu\s*/i, "").trim();
}

function readFixtureRows() {
  if (!fs.existsSync(fixturesPath)) return [];
  try {
    const raw = fs.readFileSync(fixturesPath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function normalizeTeamName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Unknown";
  const key = raw.toLowerCase();
  return TEAM_ALIASES[key] || raw;
}

function dedupeFixtureRows(rows) {
  const seen = new Map();
  for (const row of rows) {
    const key = [
      normalizeLeagueName(row?.league || ""),
      String(row?.date || "").trim(),
      normalizeTeamName(row?.homeTeam || ""),
      normalizeTeamName(row?.awayTeam || ""),
    ]
      .join("|")
      .toLowerCase();
    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, row);
      continue;
    }
    const prevHasScore = Boolean(parseScore(prev?.score));
    const currHasScore = Boolean(parseScore(row?.score));
    if (currHasScore && !prevHasScore) {
      seen.set(key, row);
    }
  }
  return Array.from(seen.values());
}

function parseScore(score) {
  const value = String(score || "").trim();
  const match = value.match(/(\d+)\s*-\s*(\d+)/);
  if (!match) return null;
  return {
    home: Number.parseInt(match[1], 10),
    away: Number.parseInt(match[2], 10),
  };
}

function parseFixtureDate(dateValue) {
  const raw = String(dateValue || "").trim();
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!slash) return null;
  const day = Number.parseInt(slash[1], 10);
  const month = Number.parseInt(slash[2], 10) - 1;
  let year = slash[3] ? Number.parseInt(slash[3], 10) : new Date().getFullYear();
  if (year < 100) year += 2000;
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function inUpcomingWindow(rowDate) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 8 * 24 * 60 * 60 * 1000);
  return rowDate >= start && rowDate < end;
}

function inRecentScoreWindow(rowDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
  const end = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  return rowDate >= start && rowDate < end;
}

function normalizeFixtureMatch(row, idx) {
  const parsedScore = parseScore(row?.score);
  const hasScore = parsedScore && Number.isInteger(parsedScore.home) && Number.isInteger(parsedScore.away);

  return {
    id: String(idx + 1),
    league: normalizeLeagueName(row?.league || "Bóng đá"),
    round: String(row?.round || "N/A"),
    date: String(row?.date || ""),
    time: String(row?.time || ""),
    matchTime: String(row?.time || ""),
    status: hasScore ? "finished" : "upcoming",
    score: hasScore ? `${parsedScore.home} - ${parsedScore.away}` : "",
    homeTeam: normalizeTeamName(row?.homeTeam || "Unknown"),
    awayTeam: normalizeTeamName(row?.awayTeam || "Unknown"),
    homeLogo: String(row?.homeLogo || ""),
    awayLogo: String(row?.awayLogo || ""),
    scorers: Array.isArray(row?.scorers) ? row.scorers : [],
    yellowCards: Array.isArray(row?.yellowCards) ? row.yellowCards : [],
    redCards: Array.isArray(row?.redCards) ? row.redCards : [],
    hasDetailEvents: Boolean(row?.hasDetailEvents),
    venue: "",
  };
}

function buildMatchesFromFixtures() {
  return dedupeFixtureRows(readFixtureRows())
    .filter((row) => {
      const d = parseFixtureDate(row?.date);
      return d && inUpcomingWindow(d);
    })
    .map(normalizeFixtureMatch)
    .filter((m) => m.homeTeam && m.awayTeam);
}

function buildStandingsFromFixtures() {
  const rows = dedupeFixtureRows(readFixtureRows());
  const byLeague = new Map();

  for (const row of rows) {
    const league = normalizeLeagueName(row?.league || "");
    if (!league) continue;
    if (!byLeague.has(league)) byLeague.set(league, new Map());
    const table = byLeague.get(league);

    const teams = [
      { name: String(row?.homeTeam || "").trim(), isHome: true },
      { name: String(row?.awayTeam || "").trim(), isHome: false },
    ].filter((x) => x.name);

    for (const team of teams) {
      if (!table.has(team.name)) {
        table.set(team.name, {
          team: team.name,
          logo: team.isHome ? String(row?.homeLogo || "") : String(row?.awayLogo || ""),
          points: 0,
          played: 0,
          win: 0,
          draw: 0,
          loss: 0,
          gf: 0,
          ga: 0,
          gd: "0",
          latestResult: "",
          form: [],
        });
      }
    }

    const score = parseScore(row?.score);
    if (!score) continue;

    const home = table.get(String(row?.homeTeam || "").trim());
    const away = table.get(String(row?.awayTeam || "").trim());
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.gf += score.home;
    home.ga += score.away;
    away.gf += score.away;
    away.ga += score.home;

    if (score.home > score.away) {
      home.win += 1;
      home.points += 3;
      away.loss += 1;
      home.form.unshift("W");
      away.form.unshift("L");
    } else if (score.home < score.away) {
      away.win += 1;
      away.points += 3;
      home.loss += 1;
      home.form.unshift("L");
      away.form.unshift("W");
    } else {
      home.draw += 1;
      away.draw += 1;
      home.points += 1;
      away.points += 1;
      home.form.unshift("D");
      away.form.unshift("D");
    }

    home.latestResult = `${score.home}-${score.away}`;
    away.latestResult = `${score.away}-${score.home}`;
    home.form = home.form.slice(0, 5);
    away.form = away.form.slice(0, 5);
  }

  const result = {};
  for (const [league, table] of byLeague.entries()) {
    const sorted = Array.from(table.values()).sort((a, b) => {
      const gdA = a.gf - a.ga;
      const gdB = b.gf - b.ga;
      if (b.points !== a.points) return b.points - a.points;
      if (gdB !== gdA) return gdB - gdA;
      return b.gf - a.gf;
    });

    result[league] = sorted.map((row, index) => ({
      rank: index + 1,
      ...row,
      gd: `${row.gf - row.ga >= 0 ? "+" : ""}${row.gf - row.ga}`,
    }));
  }
  return result;
}

function buildRecentScoresFromFixtures() {
  return dedupeFixtureRows(readFixtureRows())
    .filter((row) => {
      const d = parseFixtureDate(row?.date);
      if (!d || !inRecentScoreWindow(d)) return false;
      return Boolean(parseScore(row?.score));
    })
    .map(normalizeFixtureMatch)
    .map((match) => ({ ...match, status: "finished" }))
    .filter((m) => m.homeTeam && m.awayTeam);
}

module.exports = {
  buildMatchesFromFixtures,
  buildStandingsFromFixtures,
  buildRecentScoresFromFixtures,
};
