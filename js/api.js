import { APP_CONFIG, DATA_SOURCE } from './config.js';
import { normalizeText } from './utils.js';

function withTimeout(signal, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onAbort);
    },
  };
}

export async function fetchJson(url, { timeoutMs = APP_CONFIG.fetchTimeoutMs } = {}) {
  const { signal, cleanup } = withTimeout(undefined, timeoutMs);
  try {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    cleanup();
  }
}

export function genMatchCode(match) {
  return `${match.homeTeam}_${match.awayTeam}`.replace(/\s+/g, '').toLowerCase();
}

export function normalizeMatch(raw) {
  const league = normalizeText(raw?.league || raw?.leagueName || raw?.competition || 'Unknown');
  const round = normalizeText(raw?.round || raw?.stage || raw?.matchday || '');
  const date = normalizeText(raw?.date || raw?.matchDate || '');
  const time = normalizeText(raw?.time || raw?.matchTime || '');
  const score = normalizeText(raw?.score || '');
  const homeTeam = normalizeText(raw?.homeTeam || raw?.home || raw?.home_name || '');
  const awayTeam = normalizeText(raw?.awayTeam || raw?.away || raw?.away_name || '');
  const homeLogo = normalizeText(raw?.homeLogo || raw?.home_logo || raw?.homeTeamLogo || '');
  const awayLogo = normalizeText(raw?.awayLogo || raw?.away_logo || raw?.awayTeamLogo || '');

  return {
    league,
    round,
    date,
    time,
    score,
    homeTeam,
    awayTeam,
    homeLogo,
    awayLogo,
  };
}

function normalizeMatchesPayload(payload) {
  const rawList = Array.isArray(payload) ? payload : Array.isArray(payload?.matches) ? payload.matches : [];
  return rawList.map(normalizeMatch).filter((m) => m.homeTeam && m.awayTeam);
}

export async function fetchMatches() {
  const { matchesApi, matchesMock } = APP_CONFIG.endpoints;
  const mode = APP_CONFIG.dataSource;

  if (mode === DATA_SOURCE.MOCK) {
    return normalizeMatchesPayload(await fetchJson(matchesMock));
  }

  if (mode === DATA_SOURCE.API) {
    return normalizeMatchesPayload(await fetchJson(matchesApi));
  }

  try {
    return normalizeMatchesPayload(await fetchJson(matchesApi));
  } catch {
    return normalizeMatchesPayload(await fetchJson(matchesMock));
  }
}

export async function fetchStandings() {
  const { standingsMock } = APP_CONFIG.endpoints;
  return await fetchJson(standingsMock);
}
