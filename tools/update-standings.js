/* eslint-disable no-console */
/**
 * Update `public_standings_data.json` by scraping standings pages from 24h.com.vn.
 *
 * Strategy:
 * - For each league, fetch its schedule page and discover the first link containing "bang-xep-hang".
 * - Fetch the standings page HTML and extract table rows from <tbody>.
 * - Write output in the FE schema:
 *   { rank, team, logo, points, played, win, draw, loss, gf, ga, gd, latestResult, form }
 *
 * Run:
 *   node tools/update-standings.js
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const SOURCE_ORIGIN = 'https://www.24h.com.vn';
const OUTPUT_PATH = path.join(__dirname, '..', 'public_standings_data.json');

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: SOURCE_ORIGIN,
};

// Must match FE filter keys
const LEAGUES = [
  {
    key: 'Ngoại hạng Anh',
    scheduleUrl: `${SOURCE_ORIGIN}/bong-da/lich-thi-dau-bong-da-anh-c48a466567.html`,
  },
  {
    key: 'CUP C1',
    scheduleUrl: `${SOURCE_ORIGIN}/bong-da/lich-thi-dau-cup-c1-champions-league-c48a465411.html`,
  },
  {
    key: 'La Liga',
    scheduleUrl: `${SOURCE_ORIGIN}/bong-da/lich-thi-dau-bong-da-tay-ban-nha-c48a468110.html`,
  },
  {
    key: 'Serie A',
    scheduleUrl: `${SOURCE_ORIGIN}/bong-da/lich-thi-dau-bong-da-y-c48a394137.html`,
  },
  {
    key: 'Bundesliga',
    scheduleUrl: `${SOURCE_ORIGIN}/bong-da-duc/lich-thi-dau-bong-da-duc-bundesliga-c152a467108.html`,
  },
  {
    key: 'Ligue 1',
    scheduleUrl: `${SOURCE_ORIGIN}/bong-da/lich-thi-dau-bong-da-phap-c48a394560.html`,
  },
  {
    key: 'FA Cup',
    scheduleUrl: `${SOURCE_ORIGIN}/bong-da/lich-thi-dau-fa-cup-c48a682532.html`,
  },
  {
    key: 'UEFA Europa League',
    scheduleUrl: `${SOURCE_ORIGIN}/bong-da/lich-thi-dau-europa-league-c48a467859.html`,
  },
  {
    key: 'V.League 1',
    // V.League schedule URLs on 24h vary; best-effort discovery from the "today schedule" hub.
    scheduleUrl: `${SOURCE_ORIGIN}/bong-da/lich-thi-dau-bong-da-hom-nay-moi-nhat-c48a364371.html`,
  },
];

function normalizeText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toAbsoluteUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  try {
    return new URL(raw, SOURCE_ORIGIN).toString();
  } catch {
    return '';
  }
}

function parseInteger(value) {
  const text = normalizeText(value);
  const match = text.match(/-?\d+/);
  return match ? Number(match[0]) : 0;
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

function sliceBetween(source, startToken, endToken) {
  const start = source.indexOf(startToken);
  if (start === -1) return source;
  const end = source.indexOf(endToken, start + startToken.length);
  if (end === -1) return source.slice(start + startToken.length);
  return source.slice(start + startToken.length, end);
}

function firstCapture(source, pattern, group = 1) {
  const match = pattern.exec(source);
  return match ? match[group] : '';
}

async function fetchHtml(url) {
  const res = await axios.get(url, {
    headers: BROWSER_HEADERS,
    responseType: 'text',
    timeout: 20_000,
  });
  return typeof res.data === 'string' ? res.data : String(res.data || '');
}

function discoverStandingsUrlFromScheduleHtml(html) {
  // Collect all candidate hrefs
  const hrefs = [];
  const re = /<a[^>]+href="([^"]+)"[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = String(m[1] || '');
    if (!/bang-xep-hang/i.test(href) && !/bangxephang/i.test(href)) continue;
    hrefs.push(href);
  }

  // Prefer league-specific standings pages, not the generic hub (c295).
  const candidates = hrefs
    .map(toAbsoluteUrl)
    .filter(Boolean)
    .filter((u) => !/c295\.html/i.test(u))
    .filter((u) => /\/bong-da\/bang-xep-hang/i.test(u) || /bang-xep-hang-bong-da/i.test(u))
    .sort((a, b) => b.length - a.length);

  return candidates[0] || '';
}

function parseStandingsTable(html) {
  const body = sliceBetween(html, '<!-- start_main_body -->', '<!-- end_main_body -->');
  const tbodyInner =
    firstCapture(body, /<tbody[^>]*>([\s\S]*?)<\/tbody>/i) ||
    firstCapture(html, /<tbody[^>]*>([\s\S]*?)<\/tbody>/i) ||
    '';

  // Rows may vary by league; be permissive
  const rowBlocks = collectBlocks(tbodyInner, '<tr', '</tr>');

  const rows = rowBlocks
    .map((rowHtml) => {
      const cells = collectBlocks(rowHtml, '<td', '</td>');
      if (cells.length < 8) return null;

      const rank = parseInteger(cells[0]);
      const teamLogo = toAbsoluteUrl(firstCapture(cells[1], /<img[^>]+src="([^"]+)"/i));
      const teamName = normalizeText(cells[1]);

      // Heuristic mapping: many 24h tables follow: [rank, team, .., played, win, draw, loss, gf, ga, gd, points]
      // If not enough columns, keep best-effort.
      const played = cells[3] ? parseInteger(cells[3]) : 0;
      const win = cells[4] ? parseInteger(cells[4]) : 0;
      const draw = cells[5] ? parseInteger(cells[5]) : 0;
      const loss = cells[6] ? parseInteger(cells[6]) : 0;
      const gf = cells[7] ? parseInteger(cells[7]) : 0;
      const ga = cells[8] ? parseInteger(cells[8]) : 0;

      // gd and points are usually at the end
      const gd = cells[9] ? normalizeText(cells[9]) : '';
      const points = cells[10]
        ? parseInteger(cells[10])
        : cells[cells.length - 1]
          ? parseInteger(cells[cells.length - 1])
          : 0;

      return {
        rank,
        team: teamName.replace(/^\d+\s+/, '').trim() || 'Team',
        logo: teamLogo,
        points,
        played,
        win,
        draw,
        loss,
        gf,
        ga,
        gd,
        latestResult: '',
        form: [],
      };
    })
    .filter((x) => x && x.rank > 0)
    .sort((a, b) => a.rank - b.rank);

  return rows;
}

function readExistingJson() {
  try {
    const raw = fs.readFileSync(OUTPUT_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function main() {
  const existing = readExistingJson();
  const out = { ...existing };

  for (const league of LEAGUES) {
    console.log(`\n==> ${league.key}`);
    try {
      const scheduleHtml = await fetchHtml(league.scheduleUrl);
      const standingsUrl = discoverStandingsUrlFromScheduleHtml(scheduleHtml);
      if (!standingsUrl) {
        console.log('   Không tìm thấy link BXH trong trang lịch thi đấu. Giữ dữ liệu cũ.');
        if (!Array.isArray(out[league.key])) out[league.key] = [];
        continue;
      }

      console.log(`   BXH URL: ${standingsUrl}`);
      const standingsHtml = await fetchHtml(standingsUrl);
      const rows = parseStandingsTable(standingsHtml);

      if (!rows.length) {
        console.log('   Parse BXH ra 0 dòng. Giữ dữ liệu cũ.');
        if (!Array.isArray(out[league.key])) out[league.key] = [];
        continue;
      }

      out[league.key] = rows;
      console.log(`   OK: ${rows.length} đội`);
    } catch (e) {
      console.log(`   Lỗi: ${e.message}. Giữ dữ liệu cũ.`);
      if (!Array.isArray(out[league.key])) out[league.key] = [];
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2), 'utf-8');
  console.log(`\nDone. Wrote: ${OUTPUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

