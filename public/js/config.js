export const DATA_SOURCE = {
  AUTO: 'auto',
  API: 'api',
  MOCK: 'mock',
};

export const APP_CONFIG = {
  dataSource: DATA_SOURCE.AUTO,
  endpoints: {
    matchesApi: '/api/matches',
    matchesMock: '/public_api_data.json',
    standingsApi: '/api/standings',
    standingsMock: '/public_standings_data.json',
  },
  refreshMs: 900_000,
  fetchTimeoutMs: 15_000,
  searchDebounceMs: 140,
};
