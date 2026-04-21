import { APP_CONFIG } from "./config.js";
import { fetchMatches, fetchStandings } from "./api.js";
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
  leagues: [],
  standings: {},
  selectedLeague: "ALL",
  searchQuery: "",
  dateFilter: "all",
  favorites: loadFavorites(),
  theme: loadTheme(),
  isLoading: true,
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

function parseAppPath(pathname) {
  const trimmed = String(pathname || "/")
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");

  const segments = trimmed ? trimmed.split("/") : [];
  const first = segments[0] || "live";
  const tab =
    first === "bxh"
      ? "standings"
      : first === "lich-dau"
        ? "schedule"
        : "live";

  const leagueSlug = segments[1] || "lich-hom-nay";
  return {
    tab,
    league: LEAGUE_ROUTE_MAP[leagueSlug] || "ALL",
  };
}

function routeFromLeague(league) {
  return LEAGUE_TO_ROUTE_MAP[league] || LEAGUE_TO_ROUTE_MAP.ALL;
}

function syncStateFromUrl() {
  const routeState = parseAppPath(window.location.pathname);
  state.selectedLeague = routeState.league;
  return routeState.tab;
}

function updateAppUrl(tab, league, mode = "push") {
  const tabSlug =
    tab === "standings" ? "bxh" : tab === "schedule" ? "lich-dau" : "live";
  const slug = routeFromLeague(league);
  const nextPath = `/${tabSlug}/${slug}`;
  if (window.location.pathname === nextPath) return;
  if (mode === "replace") window.history.replaceState({}, "", nextPath);
  else window.history.pushState({}, "", nextPath);
}

function applyTabView(tab) {
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
  if (elements.heroCarousel)
    elements.heroCarousel.closest(".live-section").style.display = "block";
  if (matchesList) matchesList.style.display = "block";
  if (elements.dateFilter) elements.dateFilter.style.display = "";
  if (standingsSection) standingsSection.style.display = "none";

  if (tab === "live") {
    state.searchQuery = "";
    if (elements.globalSearch) elements.globalSearch.value = "";
    if (state.selectedLeague === "ALL") state.selectedLeague = "Lịch thi đấu hôm nay";
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
    state.leagues = [...new Set(matches.map((m) => m.league).filter(Boolean))];
    state.isLoading = false;

    renderSidebarLeagues(ctx);
    renderMobileTabs(ctx);
    renderHeroCarousel(ctx);
    renderFavSidebar(ctx);
    renderMatchesList(ctx);
  } catch (e) {
    console.error(e);
    showToast(elements, "Không thể cập nhật lịch thi đấu/tỉ số.");
  }
}

async function loadStandingsAndRender() {
  try {
    state.standings = (await fetchStandings()) || {};
    renderStandings(ctx);
  } catch (e) {
    console.error(e);
    if (elements.standingsBox) {
      elements.standingsBox.innerHTML =
        '<div class="text-sm text-gray">Không thể tải BXH</div>';
    }
  }
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
      if (tab === "live" && state.selectedLeague === "ALL") {
        state.selectedLeague = "Lịch thi đấu hôm nay";
      }
      applyTabView(tab);
      renderSidebarLeagues(ctx);
      renderMobileTabs(ctx);
      renderHeroCarousel(ctx);
      renderMatchesList(ctx);
      renderStandings(ctx);
      renderFullStandings(ctx);
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

function initApp() {
  const currentTab = syncStateFromUrl();
  updateAppUrl(currentTab, state.selectedLeague, "replace");
  initTheme();
  initNavbar();
  initDateFilter();
  bindUiEvents(ctx);
  applyTabView(currentTab);

  window.addEventListener("popstate", () => {
    const tab = syncStateFromUrl();
    applyTabView(tab);
    renderSidebarLeagues(ctx);
    renderMobileTabs(ctx);
    renderHeroCarousel(ctx);
    renderMatchesList(ctx);
    renderStandings(ctx);
    renderFullStandings(ctx);
  });

  loadMatchesAndRender();
  loadStandingsAndRender();

  setInterval(loadMatchesAndRender, APP_CONFIG.refreshMs);
}

window.updateLeagueUrl = (league, mode = "push") =>
  updateAppUrl(
    elements.mainNavLinks?.querySelector(".nav-item.active")?.getAttribute("data-tab") ||
      "live",
    league,
    mode,
  );

document.addEventListener("DOMContentLoaded", initApp);

document.addEventListener("DOMContentLoaded", () => {
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
});
