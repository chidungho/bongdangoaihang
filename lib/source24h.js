const axios = require('axios');

const SOURCE_ORIGIN = 'https://www.24h.com.vn';
const SCHEDULE_URL = `${SOURCE_ORIGIN}/bong-da/lich-thi-dau-bong-da-anh-c48a466567.html`;
const STANDINGS_URL = `${SOURCE_ORIGIN}/bong-da/bang-xep-hang-bong-da-anh-c48a466585.html`;
const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';
const FETCH_TIMEOUT_MS = 15000;

const LEAGUE = {
  id: 2021,
  code: 'PL',
  name: 'Premier League',
  country: 'England',
  logo: 'https://icdn.24h.com.vn/upload/livescore/2-2024/giangbt/2024-06-21/135011134_logo.png',
};

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: SOURCE_ORIGIN,
};

const vietnamDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: VIETNAM_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function decodeHtmlEntities(value) {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return String(value || '')
    .replace(/&#(\d+);/g, (_, num) => {
      const code = Number.parseInt(num, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([a-f0-9]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] || entity);
}

function normalizeText(value) {
  return decodeHtmlEntities(String(value || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function toAbsoluteUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return new URL(raw, SOURCE_ORIGIN).toString();
}

function sliceBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  if (start === -1) return source;

  const end = source.indexOf(endToken, start + startToken.length);
  if (end === -1) return source.slice(start + startToken.length);

  return source.slice(start + startToken.length, end);
}

function collectBlocks(source, startToken, endToken) {
  const blocks = [];
  let cursor = 0;

  while (cursor < source.length) {
    const start = source.indexOf(startToken, cursor);
    if (start === -1) break;

    const end = source.indexOf(endToken, start);
    if (end === -1) break;

    blocks.push(source.slice(start, end + endToken.length));
    cursor = end + endToken.length;
  }

  return blocks;
}

function firstCapture(source, pattern, group = 1) {
  const match = String(source || '').match(pattern);
  return match ? match[group] : '';
}

function parseIsoDate(dateLabel) {
  const match = normalizeText(dateLabel).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function parseTimestamp(dateLabel, timeLabel) {
  const isoDate = parseIsoDate(dateLabel);
  const timeMatch = normalizeText(timeLabel).match(/(\d{2}):(\d{2})/);
  if (!isoDate || !timeMatch) return Date.now();

  return new Date(`${isoDate}T${timeMatch[1]}:${timeMatch[2]}:00+07:00`).getTime();
}

function parseScore(value) {
  const text = normalizeText(value);
  return /^\d+$/.test(text) ? Number(text) : null;
}

function parseInteger(value) {
  const text = normalizeText(value);
  const match = text.match(/-?\d+/);
  return match ? Number(match[0]) : 0;
}

function formatVietnamDate(ts) {
  const parts = vietnamDateFormatter.formatToParts(new Date(ts));
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function mapMatchStatus(rawStatus, homeScore, awayScore) {
  const key = String(rawStatus || '').trim().toLowerCase();

  if (key === 'postponed') return 'POSTPONED';
  if (key === 'played' || (homeScore != null && awayScore != null)) return 'FINISHED';
  return 'SCHEDULED';
}

function buildMatchFromBlock(matchHtml, dateLabel, round, leagueLogo) {
  const classAttr = firstCapture(matchHtml, /<li class="([^"]+)"/i);
  const matchId = (classAttr.match(/\b(mid[^\s"]+)/i) || [])[1] || '';
  const rawStatus = (classAttr.match(/match-status-([a-z]+)/i) || [])[1] || '';

  const timeText = firstCapture(
    matchHtml,
    /<time class="cate-24h-foot-home-sche-content__time[^"]*">\s*<strong[^>]*>([\s\S]*?)<\/strong>/i
  );

  const channel = normalizeText(
    firstCapture(
      matchHtml,
      /<span class="cate-24h-foot-home-sche-content__chanel[^"]*">([\s\S]*?)<\/span>/i
    )
  );

  const homeName = normalizeText(
    firstCapture(
      matchHtml,
      /<div class="cate-24h-foot-home-sche-content__match--left[\s\S]*?<figcaption[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/i
    )
  );

  const awayName = normalizeText(
    firstCapture(
      matchHtml,
      /<div class="cate-24h-foot-home-sche-content__match--right[\s\S]*?<figcaption[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/i
    )
  );

  const homeLogo = toAbsoluteUrl(
    firstCapture(
      matchHtml,
      /<div class="cate-24h-foot-home-sche-content__match--left[\s\S]*?<img src="([^"]+)"/i
    )
  );

  const awayLogo = toAbsoluteUrl(
    firstCapture(
      matchHtml,
      /<div class="cate-24h-foot-home-sche-content__match--right[\s\S]*?<img src="([^"]+)"/i
    )
  );

  let sourceUrl = '';
  let titleText = '';

  const linkMatch =
    matchHtml.match(/<a href="([^"]+)"[^>]*class="link-ls-table"[^>]*>([\s\S]*?)<\/a>/i) ||
    matchHtml.match(/<a [^>]*class="link-ls-table"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);

  if (linkMatch) {
    sourceUrl = toAbsoluteUrl(linkMatch[1]);
    titleText = normalizeText(linkMatch[2]);
  }

  const homeScore = parseScore(
    firstCapture(
      matchHtml,
      /class="d-flex align-items-center justify-content-center match-fs_a"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i
    )
  );

  const awayScore = parseScore(
    firstCapture(
      matchHtml,
      /class="d-flex align-items-center justify-content-center match-fs_b"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i
    )
  );

  return {
    id: matchId || titleText || `${homeName}-${awayName}-${dateLabel}-${timeText}`,
    ts: parseTimestamp(dateLabel, timeText),
    status: mapMatchStatus(rawStatus, homeScore, awayScore),
    elapsed: null,
    channel,
    sourceUrl,
    sourceStatus: rawStatus,
    score: {
      home: homeScore,
      away: awayScore,
    },
    home: {
      id: null,
      name: homeName || 'Home',
      logo: homeLogo,
    },
    away: {
      id: null,
      name: awayName || 'Away',
      logo: awayLogo,
    },
    league: {
      id: LEAGUE.id,
      name: LEAGUE.name,
      logo: leagueLogo || LEAGUE.logo,
      country: LEAGUE.country,
      round,
    },
  };
}

function parseScheduleSnapshot(html) {
  const updatedAt =
    firstCapture(html, /<meta name="pubdate"[^>]*content="([^"]+)"/i) ||
    firstCapture(html, /itemprop="dateModified"[^>]*content="([^"]+)"/i) ||
    null;

  const leagueLogo =
    toAbsoluteUrl(
      firstCapture(
        html,
        /<figure class="icon-tournam[^"]*">\s*<img src="([^"]+)"/i
      )
    ) || LEAGUE.logo;

  const body = sliceBetween(html, '<!-- start_main_body -->', '<!-- end_main_body -->');
  const sectionBlocks = collectBlocks(
    body,
    '<section class="cate-24h-foot-box-sche-table-ring',
    '</section>'
  );

  const matches = [];

  sectionBlocks.forEach((sectionHtml) => {
    const title = normalizeText(firstCapture(sectionHtml, /<h2 class="tuht_show">([\s\S]*?)<\/h2>/i));
    if (!title) return;

    const round = title.replace(/^(Lịch thi đấu|Kết quả)\s+/i, '').trim() || LEAGUE.name;
    const articleBlocks = collectBlocks(
      sectionHtml,
      '<article class="cate-24h-foot-box-sche-table',
      '</article>'
    );

    articleBlocks.forEach((articleHtml) => {
      const dateLabel = normalizeText(
        firstCapture(
          articleHtml,
          /<header class="cate-24h-foot-box-sche-table__title[^"]*">\s*<span>([\s\S]*?)<\/span>/i
        )
      );

      const matchBlocks = collectBlocks(articleHtml, '<li class="mid', '</li>');
      matchBlocks.forEach((matchHtml) => {
        matches.push(buildMatchFromBlock(matchHtml, dateLabel, round, leagueLogo));
      });
    });
  });

  matches.sort((left, right) => left.ts - right.ts);

  return {
    league: {
      ...LEAGUE,
      logo: leagueLogo,
    },
    matches,
    meta: {
      updatedAt,
      fetchedAt: new Date().toISOString(),
      sourceUrl: SCHEDULE_URL,
    },
  };
}

function parseStandingsSnapshot(html) {
  const updatedAt =
    firstCapture(html, /<meta name="pubdate"[^>]*content="([^"]+)"/i) ||
    firstCapture(html, /itemprop="dateModified"[^>]*content="([^"]+)"/i) ||
    null;
  const season =
    firstCapture(html, /<meta property="og:title"[^>]*content="[^"]*?(\d{4}\/\d{4})[^"]*"/i) ||
    firstCapture(html, /<title[^>]*>[\s\S]*?(\d{4}\/\d{4})[\s\S]*?<\/title>/i) ||
    '';

  const leagueLogo =
    toAbsoluteUrl(
      firstCapture(
        html,
        /<figure class="icon-tournam[^"]*">\s*<img src="([^"]+)"/i
      )
    ) || LEAGUE.logo;

  const body = sliceBetween(html, '<!-- start_main_body -->', '<!-- end_main_body -->');
  const tbodyHtml = sliceBetween(body, '<tbody>', '</tbody>');
  const rowBlocks = collectBlocks(tbodyHtml, '<tr class="tid', '</tr>');

  const rows = rowBlocks
    .map((rowHtml) => {
      const cells = collectBlocks(rowHtml, '<td', '</td>');
      if (cells.length < 11) return null;

      const rank = parseInteger(cells[0]);
      const teamLogo = toAbsoluteUrl(firstCapture(cells[1], /<img src="([^"]+)"/i));
      const teamName = normalizeText(cells[1].replace(/<img[\s\S]*?>/gi, ' '));

      return {
        rank,
        points: parseInteger(cells[10]),
        played: parseInteger(cells[3]),
        win: parseInteger(cells[4]),
        draw: parseInteger(cells[5]),
        lose: parseInteger(cells[6]),
        goalDiff: parseInteger(cells[9]),
        form: '',
        team: {
          id: null,
          name: teamName || 'Team',
          logo: teamLogo,
        },
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.rank - right.rank);

  return {
    league: {
      ...LEAGUE,
      logo: leagueLogo,
      season,
    },
    rows,
    meta: {
      updatedAt,
      fetchedAt: new Date().toISOString(),
      sourceUrl: STANDINGS_URL,
    },
  };
}

async function fetchHtml(url) {
  const response = await axios.get(url, {
    headers: BROWSER_HEADERS,
    responseType: 'text',
    timeout: FETCH_TIMEOUT_MS,
  });

  return typeof response.data === 'string' ? response.data : String(response.data || '');
}

async function fetchScheduleSnapshot() {
  const html = await fetchHtml(SCHEDULE_URL);
  return parseScheduleSnapshot(html);
}

async function fetchStandingsSnapshot() {
  const html = await fetchHtml(STANDINGS_URL);
  return parseStandingsSnapshot(html);
}

function buildFeaturedMatches(matches) {
  const now = Date.now();

  const upcoming = matches
    .filter((match) => match.status === 'SCHEDULED' || match.status === 'POSTPONED')
    .filter((match) => match.ts >= now - 6 * 60 * 60 * 1000)
    .sort((left, right) => left.ts - right.ts);

  if (upcoming.length) return upcoming.slice(0, 12);

  const nextFixtures = matches
    .filter((match) => match.status === 'SCHEDULED' || match.status === 'POSTPONED')
    .sort((left, right) => left.ts - right.ts);

  if (nextFixtures.length) return nextFixtures.slice(0, 12);

  return matches
    .filter((match) => match.status === 'FINISHED')
    .sort((left, right) => right.ts - left.ts)
    .slice(0, 12);
}

function filterMatches(matches, { date, live, league } = {}) {
  const leagueText = String(league || 'all');
  if (leagueText !== 'all' && leagueText !== String(LEAGUE.id)) {
    return [];
  }

  if (live === '1' || live === 'true') {
    return buildFeaturedMatches(matches);
  }

  if (!date) return matches;
  return matches.filter((match) => formatVietnamDate(match.ts) === String(date));
}

module.exports = {
  LEAGUE,
  SCHEDULE_URL,
  STANDINGS_URL,
  fetchScheduleSnapshot,
  fetchStandingsSnapshot,
  filterMatches,
  parseScheduleSnapshot,
  parseStandingsSnapshot,
};
