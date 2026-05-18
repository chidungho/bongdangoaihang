import { APP_CONFIG } from "./config.js";
import { fetchMatches, fetchScores, fetchStandings } from "./api.js";
import { loadFavorites, loadTheme, saveTheme } from "./storage.js";
import { debounce } from "./utils.js";
import {
  showToast,
  renderSidebarLeagues,
  renderMobileTabs,
  renderHeroCarousel,
  renderFavSidebar,
  renderMatchesList,
  renderStandings,
  renderFullStandings,
} from "./ui.js";
import { bindUiEvents } from "./events.js";

const state = {
  matches: [],
  scores: [],
  standings: {},
  currentTab: "live",
  selectedLeague: "ALL",
  searchQuery: "",
  dateFilter: "all",
  favorites: loadFavorites(),
  theme: loadTheme(),
  isLoading: true,
  scoresLoaded: false,
  scoresLoading: null,
};

const elements = {
  heroCarousel: document.getElementById("heroCarousel"),
  matchesWrapper: document.getElementById("matchesWrapper"),
  leagueFilters: document.getElementById("leagueFilters"),
  mobileTabs: document.getElementById("mobileTabs"),
  themeBtn: document.getElementById("themeBtn"),
  globalSearch: document.getElementById("globalSearch"),
  mainNavLinks: document.getElementById("mainNavLinks"),
  toastContainer: document.getElementById("toastContainer"),
  myFavs: document.getElementById("myFavs"),
  standingsBox: document.getElementById("standingsBox"),
  dateFilter: document.getElementById("dateFilter"),
  dateChips: document.getElementById("dateChips"),
  dateInput: document.getElementById("dateInput"),
  dateClearBtn: document.getElementById("dateClearBtn"),
  heroPrevBtn: document.getElementById("heroPrevBtn"),
  heroNextBtn: document.getElementById("heroNextBtn"),
  footerBannerLink: document.getElementById("footerBannerLink"),
  footerBannerImg: document.getElementById("footerBannerImg"),
};

const LEAGUE_ICONS = {
  ALL: "https://img.icons8.com/color/48/today.png",
  "Lịch thi đấu hôm nay": "https://img.icons8.com/color/48/today.png",
  "FA Cup": "https://media.api-sports.io/football/leagues/45.png",
  "Ngoại hạng Anh": "https://media.api-sports.io/football/leagues/39.png",
  "CUP C1": "https://media.api-sports.io/football/leagues/2.png",
  "La Liga": "https://media.api-sports.io/football/leagues/140.png",
  "V.League 1": "https://media.api-sports.io/football/leagues/130.png",
  "Serie A": "https://media.api-sports.io/football/leagues/135.png",
  "UEFA Europa League": "https://media.api-sports.io/football/leagues/3.png",
  Bundesliga: "https://media.api-sports.io/football/leagues/78.png",
  "Ligue 1": "https://media.api-sports.io/football/leagues/61.png",
};

const DISPLAY_LEAGUES = [
  {
    name: "Lịch thi đấu hôm nay",
    search: "Lịch thi đấu hôm nay",
    iconUrl: LEAGUE_ICONS["Lịch thi đấu hôm nay"],
  },
  { name: "FA Cup", search: "FA Cup", iconUrl: LEAGUE_ICONS["FA Cup"] },
  {
    name: "Ngoại hạng Anh",
    search: "Ngoại hạng Anh",
    iconUrl: LEAGUE_ICONS["Ngoại hạng Anh"],
  },
  { name: "CUP C1", search: "CUP C1", iconUrl: LEAGUE_ICONS["CUP C1"] },
  { name: "La Liga", search: "La Liga", iconUrl: LEAGUE_ICONS["La Liga"] },
  {
    name: "V.League 1",
    search: "V.League 1",
    iconUrl: LEAGUE_ICONS["V.League 1"],
  },
  { name: "Serie A", search: "Serie A", iconUrl: LEAGUE_ICONS["Serie A"] },
  {
    name: "UEFA Europa League",
    search: "Europa",
    iconUrl: LEAGUE_ICONS["UEFA Europa League"],
  },
  {
    name: "Bundesliga",
    search: "Bundesliga",
    iconUrl: LEAGUE_ICONS.Bundesliga,
  },
  { name: "Ligue 1", search: "Ligue 1", iconUrl: LEAGUE_ICONS["Ligue 1"] },
];

const LEAGUE_ROUTE_MAP = {
  all: "ALL",
  "lich-hom-nay": "ALL",
  "fa-cup": "FA Cup",
  "ngoai-hang-anh": "Ngoại hạng Anh",
  "cup-c1": "CUP C1",
  "la-liga": "La Liga",
  "v-league-1": "V.League 1",
  "serie-a": "Serie A",
  "europa-league": "Europa",
  bundesliga: "Bundesliga",
  "ligue-1": "Ligue 1",
};

const LEAGUE_TO_ROUTE_MAP = {
  ALL: "lich-hom-nay",
  "Lịch thi đấu hôm nay": "lich-hom-nay",
  "FA Cup": "fa-cup",
  "Ngoại hạng Anh": "ngoai-hang-anh",
  "CUP C1": "cup-c1",
  "La Liga": "la-liga",
  "V.League 1": "v-league-1",
  "Serie A": "serie-a",
  Europa: "europa-league",
  Bundesliga: "bundesliga",
  "Ligue 1": "ligue-1",
};

const ctx = { state, elements, DISPLAY_LEAGUES, LEAGUE_ICONS };

function renderPrimaryViews() {
  renderSidebarLeagues(ctx);
  renderMobileTabs(ctx);
  renderHeroCarousel(ctx);
  renderMatchesList(ctx);
}

function isAppRoute(pathname) {
  return (
    pathname === "/" ||
    pathname.startsWith("/live") ||
    pathname.startsWith("/lich-dau") ||
    pathname.startsWith("/bxh") ||
    pathname.startsWith("/ti-so")
  );
}

function parseAppPath(pathname) {
  const trimmed = String(pathname || "/")
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");

  const segments = trimmed ? trimmed.split("/") : [];
  const first = segments[0] || "live";
  const tab =
    first === "bxh"
      ? "standings"
      : first === "ti-so"
        ? "scores"
      : first === "lich-dau"
        ? "schedule"
        : "live";

  const leagueSlug =
    segments[1] || (tab === "live" ? "ngoai-hang-anh" : tab === "scores" ? "all" : "lich-hom-nay");
  if (tab === "live" && (leagueSlug === "lich-hom-nay" || leagueSlug === "all")) {
    return { tab, league: "Ngoại hạng Anh" };
  }
  return {
    tab,
    league: LEAGUE_ROUTE_MAP[leagueSlug] || "ALL",
  };
}

function routeFromLeague(league, tab = "live") {
  if (
    tab === "live" &&
    (league === "ALL" || league === "Lịch thi đấu hôm nay" || !league)
  ) {
    return "ngoai-hang-anh";
  }
  return LEAGUE_TO_ROUTE_MAP[league] || LEAGUE_TO_ROUTE_MAP.ALL;
}

function syncStateFromUrl() {
  const routeState = parseAppPath(window.location.pathname);
  state.selectedLeague = routeState.league;
  return routeState.tab;
}

function updateAppUrl(tab, league, mode = "push") {
  const tabSlug =
    tab === "standings"
      ? "bxh"
      : tab === "schedule"
        ? "lich-dau"
        : tab === "scores"
          ? "ti-so"
          : "live";
  const slug = routeFromLeague(league, tab);
  const nextPath = `/${tabSlug}/${slug}`;
  if (window.location.pathname === nextPath) return;
  if (mode === "replace") window.history.replaceState({}, "", nextPath);
  else window.history.pushState({}, "", nextPath);
}

function applyTabView(tab) {
  state.currentTab = tab;
  const navItems = elements.mainNavLinks?.querySelectorAll(".nav-item") || [];
  navItems.forEach((nav) => nav.classList.remove("active"));
  const activeItem = elements.mainNavLinks?.querySelector(
    `.nav-item[data-tab="${tab}"]`,
  );
  activeItem?.classList.add("active");

  const matchesList = document
    .getElementById("matchesWrapper")
    ?.closest(".matches-list");
  const standingsSection = document.getElementById("standingsSection");

  if (tab === "standings") {
    if (elements.mobileTabs) elements.mobileTabs.style.display = "none";
    if (elements.heroCarousel)
      elements.heroCarousel.closest(".live-section").style.display = "none";
    if (matchesList) matchesList.style.display = "none";
    if (elements.dateFilter) elements.dateFilter.style.display = "none";
    if (standingsSection) standingsSection.style.display = "block";
    renderFullStandings(ctx);
    return;
  }

  if (elements.mobileTabs) elements.mobileTabs.style.display = "flex";
  if (elements.heroCarousel) {
    const heroSection = elements.heroCarousel.closest(".live-section");
    if (heroSection) heroSection.style.display = tab === "live" || tab === "scores" ? "none" : "block";
  }
  if (matchesList) matchesList.style.display = "block";
  if (elements.dateFilter) {
    elements.dateFilter.style.display = tab === "live" || tab === "scores" ? "none" : "";
  }
  if (standingsSection) standingsSection.style.display = "none";

  if (tab === "live") {
    state.searchQuery = "";
    state.dateFilter = "all";
    if (elements.globalSearch) elements.globalSearch.value = "";
    if (state.selectedLeague === "ALL" || state.selectedLeague === "Lịch thi đấu hôm nay") {
      state.selectedLeague = "Ngoại hạng Anh";
    }
  } else if (state.selectedLeague === "Lịch thi đấu hôm nay") {
    state.selectedLeague = "ALL";
  }
}

function initTheme() {
  let transitionCleanupTimer = null;

  const startThemePerfMode = () => {
    document.documentElement.classList.add("theme-switching");
    document.body.classList.remove("theme-flash");
    requestAnimationFrame(() => {
      document.body.classList.add("theme-flash");
    });
    if (transitionCleanupTimer) clearTimeout(transitionCleanupTimer);
    transitionCleanupTimer = setTimeout(() => {
      document.documentElement.classList.remove("theme-switching");
      document.body.classList.remove("theme-flash");
    }, 260);
  };

  const applyTheme = (theme) => {
    state.theme = theme;
    document.documentElement.setAttribute("data-theme", state.theme);
    elements.themeBtn.innerHTML =
      state.theme === "light"
        ? '<i class="fas fa-sun" style="color: #ff9800;"></i>'
        : '<i class="fas fa-moon"></i>';
    saveTheme(state.theme);
  };

  applyTheme(state.theme);

  elements.themeBtn?.addEventListener("click", () => {
    const nextTheme = state.theme === "dark" ? "light" : "dark";
    startThemePerfMode();
    applyTheme(nextTheme);
  });
}

async function loadMatchesAndRender() {
  try {
    const matches = await fetchMatches();
    state.matches = matches;
    state.isLoading = false;

    renderPrimaryViews();
    renderFavSidebar(ctx);
  } catch (e) {
    console.error(e);
    showToast(elements, "Không thể cập nhật lịch thi đấu/tỉ số.");
  }
}

async function loadScoresAndRender() {
  if (state.scoresLoaded) {
    if (state.currentTab === "scores" || state.currentTab === "schedule") {
      renderMatchesList(ctx);
    }
    return state.scores;
  }
  if (state.scoresLoading) return state.scoresLoading;
  if (state.currentTab === "scores" && elements.matchesWrapper) {
    elements.matchesWrapper.innerHTML = `
      <div class="league-heading-sk sk-loader mt-4 mb-2"></div>
      <div class="match-row-sk sk-loader mb-2"></div>
      <div class="match-row-sk sk-loader mb-2"></div>
    `;
  }

  state.scoresLoading = (async () => {
    try {
      state.scores = await fetchScores();
      state.scoresLoaded = true;
      if (state.currentTab === "scores" || state.currentTab === "schedule") {
        renderMatchesList(ctx);
      }
      return state.scores;
    } catch (e) {
      console.error(e);
      return state.scores;
    } finally {
      state.scoresLoading = null;
    }
  })();

  return state.scoresLoading;
}

async function refreshScoresAndRender() {
  try {
    state.scores = await fetchScores();
    state.scoresLoaded = true;
    if (state.currentTab === "scores" || state.currentTab === "schedule") {
      renderMatchesList(ctx);
    }
  } catch (e) {
    console.error(e);
  }
}

function maybeLoadTabData(tab) {
  if (tab === "scores" || tab === "schedule") {
    loadScoresAndRender();
  }
}

async function loadStandingsAndRender() {
  try {
    state.standings = (await fetchStandings()) || {};
    renderStandings(ctx);
    renderFullStandings(ctx);
  } catch (e) {
    console.error(e);
    if (elements.standingsBox) {
      elements.standingsBox.innerHTML =
        '<div class="text-sm text-gray">Không thể tải BXH</div>';
    }
  }
}

async function loadFooterBanner() {
  const linkEl = elements.footerBannerLink;
  const imgEl = elements.footerBannerImg;
  if (!linkEl || !imgEl) return;
  try {
    const res = await fetch("/api/system/footer-banner", {
      headers: { Accept: "application/json" },
    });
    const payload = await res.json();
    const data = payload?.data || {};
    linkEl.href = data.targetUrl || "#";
    imgEl.src =
      data.imageUrl ||
      "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22640%22 height=%22200%22%3E%3Crect width=%22100%25%22 height=%22100%25%22 fill=%22%23131e33%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%239aa6bd%22 font-family=%22Arial%22 font-size=%2230%22%3EBanner%20Footer%3C/text%3E%3C/svg%3E";
  } catch (error) {
    linkEl.href = "#";
  }
}

function scheduleFooterBannerLoad() {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(loadFooterBanner, { timeout: 3000 });
    return;
  }
  window.setTimeout(loadFooterBanner, 1200);
}

function initNavbar() {
  if (elements.globalSearch) {
    const onSearch = debounce((value) => {
      state.searchQuery = String(value || "").trim();
      renderHeroCarousel(ctx);
      renderMatchesList(ctx);
      renderFullStandings(ctx);
    }, APP_CONFIG.searchDebounceMs);
    elements.globalSearch.addEventListener("input", (e) =>
      onSearch(e.target.value),
    );
    elements.globalSearch.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        elements.globalSearch.value = "";
        state.searchQuery = "";
        renderHeroCarousel(ctx);
        renderMatchesList(ctx);
        renderFullStandings(ctx);
      }
    });
  }

  if (!elements.mainNavLinks) return;
  const navItems = elements.mainNavLinks.querySelectorAll(".nav-item");
  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const tab = item.getAttribute("data-tab");
      if (
        tab === "live" &&
        (state.selectedLeague === "ALL" || state.selectedLeague === "Lịch thi đấu hôm nay")
      ) {
        state.selectedLeague = "Ngoại hạng Anh";
      } else if (tab !== "live" && state.selectedLeague === "Lịch thi đấu hôm nay") {
        state.selectedLeague = "ALL";
      }
      applyTabView(tab);
      renderPrimaryViews();
      renderStandings(ctx);
      renderFullStandings(ctx);
      maybeLoadTabData(tab);
      updateAppUrl(tab, state.selectedLeague, "push");
    });
  });
}

function applyDateFilter(value) {
  state.dateFilter = value || "all";

  if (elements.dateChips) {
    elements.dateChips.querySelectorAll(".date-chip").forEach((btn) => {
      btn.classList.toggle(
        "active",
        btn.dataset.date === state.dateFilter ||
          (state.dateFilter.startsWith("20") && btn.dataset.date === "custom"),
      );
    });
    if (/^\d{4}-\d{2}-\d{2}$/.test(state.dateFilter)) {
      elements.dateChips
        .querySelectorAll(".date-chip")
        .forEach((btn) => btn.classList.remove("active"));
    }
  }

  if (elements.dateClearBtn) {
    elements.dateClearBtn.classList.toggle(
      "visible",
      state.dateFilter !== "all",
    );
  }

  if (elements.dateInput) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(state.dateFilter)) {
      elements.dateInput.value = state.dateFilter;
    } else {
      elements.dateInput.value = "";
    }
  }

  renderHeroCarousel(ctx);
  renderMatchesList(ctx);
}

function initDateFilter() {
  if (!elements.dateFilter) return;

  if (elements.dateChips) {
    elements.dateChips.addEventListener("click", (e) => {
      const btn = e.target.closest(".date-chip");
      if (!btn) return;
      applyDateFilter(btn.dataset.date || "all");
    });
  }

  if (elements.dateInput) {
    elements.dateInput.addEventListener("change", (e) => {
      const value = e.target.value;
      if (value) applyDateFilter(value);
      else applyDateFilter("all");
    });
  }

  if (elements.dateClearBtn) {
    elements.dateClearBtn.addEventListener("click", () => {
      applyDateFilter("all");
    });
  }

  applyDateFilter(state.dateFilter);
}

function initHeroCarouselControls() {
  const { heroCarousel, heroPrevBtn, heroNextBtn } = elements;
  if (!heroCarousel || !heroPrevBtn || !heroNextBtn) return;

  const scrollHero = (direction) => {
    const amount = Math.max(260, Math.round(heroCarousel.clientWidth * 0.8));
    heroCarousel.scrollBy({
      left: direction * amount,
      behavior: "smooth",
    });
  };

  heroPrevBtn.addEventListener("click", () => scrollHero(-1));
  heroNextBtn.addEventListener("click", () => scrollHero(1));
}

function initApp() {
  const applyCurrentRoute = () => {
    const tab = syncStateFromUrl();
    applyTabView(tab);
    renderPrimaryViews();
    renderStandings(ctx);
    renderFullStandings(ctx);
    return tab;
  };

  const currentTab = applyCurrentRoute();
  updateAppUrl(currentTab, state.selectedLeague, "replace");
  initTheme();
  initNavbar();
  initDateFilter();
  initHeroCarouselControls();
  bindUiEvents(ctx);

  window.addEventListener("popstate", () => {
    maybeLoadTabData(applyCurrentRoute());
  });

  document.addEventListener("click", (e) => {
    const anchor = e.target.closest("a[href]");
    if (!anchor) return;
    if (anchor.target && anchor.target !== "_self") return;
    if (anchor.hasAttribute("download")) return;
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#")) return;

    const nextUrl = new URL(anchor.href, window.location.origin);
    if (nextUrl.origin !== window.location.origin) return;
    if (!isAppRoute(nextUrl.pathname)) return;
    if (nextUrl.pathname === window.location.pathname) return;

    e.preventDefault();
    window.history.pushState({}, "", `${nextUrl.pathname}${nextUrl.search}`);
    applyCurrentRoute();
  });

  loadMatchesAndRender();
  loadStandingsAndRender();
  maybeLoadTabData(currentTab);
  scheduleFooterBannerLoad();

  setInterval(loadMatchesAndRender, APP_CONFIG.refreshMs);
  setInterval(() => {
    if (state.scoresLoaded || state.currentTab === "scores" || state.currentTab === "schedule") {
      refreshScoresAndRender();
    }
  }, APP_CONFIG.refreshMs);
  setInterval(() => {
    if (state.currentTab === "live") renderMatchesList(ctx);
  }, 900000);
}

window.updateLeagueUrl = (league, mode = "push") =>
  updateAppUrl(
    elements.mainNavLinks?.querySelector(".nav-item.active")?.getAttribute("data-tab") ||
      "live",
    league,
    mode,
  );

function initSidebarDrawer() {
  const menuToggleBtn = document.getElementById("menuToggleBtn");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  if (menuToggleBtn && sidebar && overlay) {
    menuToggleBtn.addEventListener("click", () => {
      sidebar.classList.add("show");
      overlay.classList.add("show");
      document.body.style.overflow = "hidden";
    });

    overlay.addEventListener("click", () => {
      sidebar.classList.remove("show");
      overlay.classList.remove("show");
      document.body.style.overflow = "";
    });

    const sidebarLinks = sidebar.querySelectorAll("li");
    sidebarLinks.forEach((link) => {
      link.addEventListener("click", () => {
        if (window.innerWidth <= 900) {
          sidebar.classList.remove("show");
          overlay.classList.remove("show");
          document.body.style.overflow = "";
        }
      });
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initApp();
  initSidebarDrawer();
});
