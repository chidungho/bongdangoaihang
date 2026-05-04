const fs = require("fs");
const path = require("path");
const env = require("../config/env");
const { sanitizeHttpUrl } = require("../utils/sanitize");

const bannerFilePath = path.join(env.rootDir, "data", "news-banners.json");

const DEFAULT_BANNERS = [
  {
    id: "banner1",
    title: "Banner 1",
    imageUrl: "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=600&q=80",
    targetUrl: "https://bongdangoaihang.com",
  },
  {
    id: "banner2",
    title: "Banner 2",
    imageUrl: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=600&q=80",
    targetUrl: "https://bongdangoaihang.com/tin-tuc",
  },
];

function ensureBannerFile() {
  const dir = path.dirname(bannerFilePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(bannerFilePath)) {
    fs.writeFileSync(bannerFilePath, JSON.stringify(DEFAULT_BANNERS, null, 2), "utf-8");
  }
}

function readBanners() {
  ensureBannerFile();
  try {
    const raw = fs.readFileSync(bannerFilePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_BANNERS;
    return parsed.slice(0, 2).map((item, idx) => ({
      id: item?.id || `banner${idx + 1}`,
      title: String(item?.title || `Banner ${idx + 1}`),
      imageUrl: sanitizeHttpUrl(item?.imageUrl || "", ""),
      targetUrl: sanitizeHttpUrl(item?.targetUrl || "#", "#"),
    }));
  } catch (error) {
    return DEFAULT_BANNERS;
  }
}

function saveBanners(items) {
  ensureBannerFile();
  const clean = (Array.isArray(items) ? items : []).slice(0, 2).map((item, idx) => ({
    id: `banner${idx + 1}`,
    title: String(item?.title || `Banner ${idx + 1}`),
    imageUrl: sanitizeHttpUrl(item?.imageUrl || "", ""),
    targetUrl: sanitizeHttpUrl(item?.targetUrl || "#", "#"),
  }));
  while (clean.length < 2) {
    clean.push({
      id: `banner${clean.length + 1}`,
      title: `Banner ${clean.length + 1}`,
      imageUrl: "",
      targetUrl: "#",
    });
  }
  fs.writeFileSync(bannerFilePath, JSON.stringify(clean, null, 2), "utf-8");
  return clean;
}

module.exports = {
  readBanners,
  saveBanners,
};
