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

const ctx = { state, elements, DISPLAY_LEAGUES, LEAGUE_ICONS };

function initTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  elements.themeBtn.innerHTML =
    state.theme === "light"
      ? '<i class="fas fa-sun" style="color: #ff9800;"></i>'
      : '<i class="fas fa-moon"></i>';

  elements.themeBtn?.addEventListener("click", () => {
    document.body.classList.add("no-transition");
    state.theme = state.theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", state.theme);
    elements.themeBtn.innerHTML =
      state.theme === "light"
        ? '<i class="fas fa-sun" style="color: #ff9800;"></i>'
        : '<i class="fas fa-moon"></i>';
    saveTheme(state.theme);
    setTimeout(() => document.body.classList.remove("no-transition"), 50);
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
      state.searchQuery = String(value || "")
        .toLowerCase()
        .trim();
      renderHeroCarousel(ctx);
      renderMatchesList(ctx);
    }, APP_CONFIG.searchDebounceMs);
    elements.globalSearch.addEventListener("input", (e) =>
      onSearch(e.target.value),
    );
  }

  if (!elements.mainNavLinks) return;
  const navItems = elements.mainNavLinks.querySelectorAll(".nav-item");
  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");

      const tab = item.getAttribute("data-tab");
      const matchesList = document
        .getElementById("matchesWrapper")
        ?.closest(".matches-list");
      const standingsSection = document.getElementById("standingsSection");

      if (tab === "standings") {
        if (elements.mobileTabs) elements.mobileTabs.style.display = "none";
        if (elements.heroCarousel)
          elements.heroCarousel.closest(".live-section").style.display = "none";
        if (matchesList) matchesList.style.display = "none";
        if (standingsSection) standingsSection.style.display = "block";
        renderFullStandings(ctx);
        return;
      }

      if (elements.mobileTabs) elements.mobileTabs.style.display = "flex";
      if (elements.heroCarousel)
        elements.heroCarousel.closest(".live-section").style.display = "block";
      if (matchesList) matchesList.style.display = "block";
      if (standingsSection) standingsSection.style.display = "none";

      state.searchQuery = "";
      if (elements.globalSearch) elements.globalSearch.value = "";

      if (tab === "live") {
        showToast(elements, "Đang hiển thị các trận Tâm điểm.");
        window.filterData?.("Lịch thi đấu hôm nay");
      } else {
        window.filterData?.("ALL");
      }
    });
  });
}

function initApp() {
  initTheme();
  initNavbar();
  bindUiEvents(ctx);

  // initial load
  loadMatchesAndRender();
  loadStandingsAndRender();

  // periodic refresh for scores/schedule
  setInterval(loadMatchesAndRender, APP_CONFIG.refreshMs);
}

document.addEventListener("DOMContentLoaded", initApp);

// ==========================================
// ĐIỀU KHIỂN SIDEBAR MOBILE (DRAWER MENU)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const menuToggleBtn = document.getElementById("menuToggleBtn");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  if (menuToggleBtn && sidebar && overlay) {
    // Mở Sidebar
    menuToggleBtn.addEventListener("click", () => {
      sidebar.classList.add("show");
      overlay.classList.add("show");
      document.body.style.overflow = "hidden"; // Khóa cuộn trang web bên dưới
    });

    // Đóng Sidebar khi bấm ra ngoài lớp nền tối
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("show");
      overlay.classList.remove("show");
      document.body.style.overflow = ""; // Mở khóa cuộn trang
    });

    // Đóng Sidebar khi người dùng chọn 1 mục/giải đấu bên trong
    const sidebarLinks = sidebar.querySelectorAll("li");
    sidebarLinks.forEach((link) => {
      link.addEventListener("click", () => {
        // Chỉ tự động đóng nếu đang ở màn hình điện thoại/tablet
        if (window.innerWidth <= 900) {
          sidebar.classList.remove("show");
          overlay.classList.remove("show");
          document.body.style.overflow = "";
        }
      });
    });
  }
});
