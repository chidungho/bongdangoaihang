const { readFooterBanner, saveFooterBanner } = require("../services/footerBannerService");

function setPublicBannerCache(res) {
  res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
}

function getFooterBanner(req, res) {
  setPublicBannerCache(res);
  res.json({ data: readFooterBanner() });
}

function updateFooterBanner(req, res) {
  const saved = saveFooterBanner(req.body || {});
  res.json({ data: saved });
}

module.exports = {
  getFooterBanner,
  updateFooterBanner,
};
