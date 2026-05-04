function sanitizeHttpUrl(value, fallback = "#") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}

module.exports = {
  sanitizeHttpUrl,
};
