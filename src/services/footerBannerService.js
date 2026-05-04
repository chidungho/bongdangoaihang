const fs = require("fs");
const path = require("path");
const env = require("../config/env");
const { sanitizeHttpUrl } = require("../utils/sanitize");

const bannerFilePath = path.join(env.rootDir, "data", "footer-banner.json");

const DEFAULT_BANNER = {
  imageUrl:
    "https://images.unsplash.com/photo-1511886929837-354d827aae26?auto=format&fit=crop&w=1200&q=80",
  targetUrl: "https://bongdangoaihang.com/tin-tuc",
};

function ensureFile() {
  const dir = path.dirname(bannerFilePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(bannerFilePath)) {
    fs.writeFileSync(bannerFilePath, JSON.stringify(DEFAULT_BANNER, null, 2), "utf-8");
  }
}

function readFooterBanner() {
  ensureFile();
  try {
    const raw = fs.readFileSync(bannerFilePath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      imageUrl: sanitizeHttpUrl(parsed?.imageUrl || DEFAULT_BANNER.imageUrl, DEFAULT_BANNER.imageUrl),
      targetUrl: sanitizeHttpUrl(parsed?.targetUrl || DEFAULT_BANNER.targetUrl, DEFAULT_BANNER.targetUrl),
    };
  } catch (error) {
    return { ...DEFAULT_BANNER };
  }
}

function saveFooterBanner(input) {
  ensureFile();
  const normalized = {
    imageUrl: sanitizeHttpUrl(input?.imageUrl || "", ""),
    targetUrl: sanitizeHttpUrl(input?.targetUrl || "#", "#"),
  };
  fs.writeFileSync(bannerFilePath, JSON.stringify(normalized, null, 2), "utf-8");
  return normalized;
}

module.exports = {
  readFooterBanner,
  saveFooterBanner,
};
