const { readFooterBanner, saveFooterBanner } = require("../services/footerBannerService");

function getFooterBanner(req, res) {
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
