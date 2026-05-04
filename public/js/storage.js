const KEYS = {
  favorites: 'gf_favorites',
  theme: 'gf_theme',
};

export function loadFavorites() {
  try {
    const raw = localStorage.getItem(KEYS.favorites);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFavorites(favorites) {
  localStorage.setItem(KEYS.favorites, JSON.stringify(Array.isArray(favorites) ? favorites : []));
}

export function loadTheme() {
  return localStorage.getItem(KEYS.theme) || 'dark';
}

export function saveTheme(theme) {
  localStorage.setItem(KEYS.theme, theme || 'dark');
}

