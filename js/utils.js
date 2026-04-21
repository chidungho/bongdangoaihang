export function debounce(fn, waitMs = 250) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), waitMs);
  };
}

export function normalizeText(value) {
  return String(value ?? '').trim();
}

export function normalizeSearch(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesSearch(query, ...fields) {
  if (!query) return true;
  const q = normalizeSearch(query);
  if (!q) return true;
  return fields.some((f) => normalizeSearch(f).includes(q));
}

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function parseMatchDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  const slash = str.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slash) {
    const day = parseInt(slash[1], 10);
    const month = parseInt(slash[2], 10) - 1;
    let year = slash[3] ? parseInt(slash[3], 10) : new Date().getFullYear();
    if (year < 100) year += 2000;
    return startOfDay(new Date(year, month, day));
  }
  const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return startOfDay(new Date(+iso[1], +iso[2] - 1, +iso[3]));
  }
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : startOfDay(d);
}

export function toIsoDate(d) {
  const x = startOfDay(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildDateFilter(filter) {
  if (!filter || filter === 'all') return () => true;

  const today = startOfDay(new Date());
  const day = 24 * 60 * 60 * 1000;

  const isBetween = (d, from, to) => {
    if (!d) return false;
    return d.getTime() >= from.getTime() && d.getTime() <= to.getTime();
  };

  if (filter === 'today') {
    return (m) => {
      const d = parseMatchDate(m.date);
      return d && d.getTime() === today.getTime();
    };
  }
  if (filter === 'yesterday') {
    const y = new Date(today.getTime() - day);
    return (m) => {
      const d = parseMatchDate(m.date);
      return d && d.getTime() === y.getTime();
    };
  }
  if (filter === 'tomorrow') {
    const t = new Date(today.getTime() + day);
    return (m) => {
      const d = parseMatchDate(m.date);
      return d && d.getTime() === t.getTime();
    };
  }
  if (filter === 'weekend') {
    const dow = today.getDay();
    let satOffset;
    if (dow === 6) satOffset = 0;
    else if (dow === 0) satOffset = -1;
    else satOffset = 6 - dow;
    const sat = new Date(today.getTime() + satOffset * day);
    const sun = new Date(sat.getTime() + day);
    return (m) => {
      const d = parseMatchDate(m.date);
      return isBetween(d, sat, sun);
    };
  }
  if (filter === 'week') {
    const dow = today.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(today.getTime() + mondayOffset * day);
    const sunday = new Date(monday.getTime() + 6 * day);
    return (m) => {
      const d = parseMatchDate(m.date);
      return isBetween(d, monday, sunday);
    };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(filter)) {
    const exact = parseMatchDate(filter);
    return (m) => {
      const d = parseMatchDate(m.date);
      return d && exact && d.getTime() === exact.getTime();
    };
  }
  return () => true;
}

export function describeDateFilter(filter) {
  if (!filter || filter === 'all') return '';
  const labels = {
    today: 'Hôm nay',
    yesterday: 'Hôm qua',
    tomorrow: 'Ngày mai',
    weekend: 'Cuối tuần',
    week: 'Tuần này',
  };
  if (labels[filter]) return labels[filter];
  if (/^\d{4}-\d{2}-\d{2}$/.test(filter)) {
    const d = parseMatchDate(filter);
    if (!d) return '';
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
  return '';
}
