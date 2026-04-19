export const DATA_SOURCE = {
  AUTO: 'auto', // try API first, fallback to mock
  API: 'api',
  MOCK: 'mock',
};

// Default behavior: try live backend, fallback to bundled mock JSON.
export const APP_CONFIG = {
  dataSource: DATA_SOURCE.AUTO,
  endpoints: {
    matchesApi: '/api/matches',
    // Use absolute paths so modules under /js don't resolve to /js/...
    matchesMock: '/public_api_data.json',
    standingsMock: '/public_standings_data.json',
  },
  refreshMs: 300_000,
  fetchTimeoutMs: 15_000,
  searchDebounceMs: 250,
};

