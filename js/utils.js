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

