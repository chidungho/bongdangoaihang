import { genMatchCode } from './api.js';
import {
  matchesSearch,
  normalizeSearch,
  buildDateFilter,
  describeDateFilter,
  parseMatchDateTime,
  resolveLiveState,
} from './utils.js';

function getStandingsLeagueKey(selectedLeague) {
  return selectedLeague === 'ALL' || selectedLeague === 'Lịch thi đấu hôm nay'
    ? 'Ngoại hạng Anh'
    : selectedLeague;
}

function getStandingsLeagueLabel(leagueKey) {
  if (leagueKey === 'Europa') return 'UEFA Europa League';
  return leagueKey;
}

export function showToast(elements, message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="fas fa-exclamation-circle"></i> <span>${message}</span>`;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

export function renderSidebarLeagues({ state, elements, DISPLAY_LEAGUES, LEAGUE_ICONS }) {
  const showTodayShortcut = state.currentTab !== 'standings';
  let ht = '';

  if (showTodayShortcut) {
    ht += `
      <li class="${state.selectedLeague === 'Lịch thi đấu hôm nay' || state.selectedLeague === 'ALL' ? 'active' : ''}" data-action="filter" data-league="ALL" role="button" tabindex="0">
        <img src="${LEAGUE_ICONS.ALL}" alt="Lịch thi đấu hôm nay" class="league-sidebar-icon">
        <span class="lg-name">Lịch thi đấu hôm nay</span>
      </li>
    `;
  }

  DISPLAY_LEAGUES.slice(1).forEach((def) => {
    const activeClass = state.selectedLeague === def.search ? 'active' : '';
    ht += `
      <li class="${activeClass}" data-action="filter" data-league="${def.search}" role="button" tabindex="0">
        <img src="${def.iconUrl}" alt="${def.name}" class="league-sidebar-icon">
        <span class="lg-name">${def.name}</span>
      </li>
    `;
  });

  elements.leagueFilters.innerHTML = ht;
}

export function renderMobileTabs({ state, elements, DISPLAY_LEAGUES }) {
  let ht = `<button class="mobile-tab ${state.selectedLeague === 'ALL' ? 'active' : ''}" data-action="filter" data-league="ALL">Lịch hôm nay</button>`;
  DISPLAY_LEAGUES.slice(1).forEach((def) => {
    ht += `<button class="mobile-tab ${state.selectedLeague === def.search ? 'active' : ''}" data-action="filter" data-league="${def.search}">${def.name}</button>`;
  });
  elements.mobileTabs.innerHTML = ht;
}

export function renderFavSidebar({ state, elements }) {
  if (state.favorites.length === 0) {
    elements.myFavs.innerHTML = '<li class="text-sm text-gray">Chưa có trận nào</li>';
    return;
  }

  let html = '';
  state.favorites.forEach((favCode) => {
    const m = state.matches.find((x) => genMatchCode(x) === favCode);
    if (!m) return;
    html += `
      <li class="mt-2 p-2 glass-card d-flex" style="flex-direction: column; align-items:flex-start; gap:5px; margin-bottom:10px;">
        <div class="text-xs text-primary">${m.time}</div>
        <div class="text-sm font-weight-bold d-flex" style="justify-content:space-between; width:100%;">
          <span>${m.homeTeam} ${m.score ? `<span class="score-inline">${m.score}</span>` : '⚡'} ${m.awayTeam}</span>
          <button class="icon-toggle" data-action="toggle-favorite" data-match="${favCode}" aria-label="Bỏ/Thêm yêu thích" style="padding:0; width:auto; height:auto;">
            <i class="fas fa-star text-warning" style="cursor:pointer; color: #ffd700;"></i>
          </button>
        </div>
      </li>
    `;
  });
  elements.myFavs.innerHTML = html;
}

export function renderHeroCarousel({ state, elements }) {
  let filtered = state.matches;

  const datePred = buildDateFilter(state.dateFilter);
  filtered = filtered.filter(datePred);

  if (state.searchQuery) {
    filtered = filtered.filter((m) =>
      matchesSearch(state.searchQuery, m.homeTeam, m.awayTeam, m.league)
    );
  } else if (
    state.selectedLeague !== 'ALL' &&
    !(state.currentTab === 'live' && state.selectedLeague === 'Lịch thi đấu hôm nay')
  ) {
    const keyword = state.selectedLeague.toLowerCase();
    filtered = filtered.filter((m) => m.league && m.league.toLowerCase().includes(keyword));
  }

  filtered = filtered.filter((m) => (m.status || 'upcoming') === 'upcoming');

  const topMatches = filtered
    .slice()
    .sort((a, b) => (b.score ? 1 : 0) - (a.score ? 1 : 0))
    .slice(0, 6);

  if (topMatches.length === 0) {
    elements.heroCarousel.innerHTML =
      `<div class="text-gray text-center p-4 w-100">Không có trận đấu nổi bật.</div>`;
    return;
  }

  let ht = '';

  topMatches.forEach((m) => {
    const code = genMatchCode(m);
    const isFav = state.favorites.includes(code);

    ht += `
      <div class="match-card">

        <!-- ⭐ NÚT SAO -->
        <button class="fav-btn ${isFav ? 'active' : ''}"
          data-action="toggle-favorite"
          data-match="${code}"
          title="Thêm vào yêu thích">
          <i class="fas fa-star"></i>
        </button>

        <div class="mc-league">${m.league} • ${m.round}</div>

        <div class="mc-teams">
          <div class="mc-team">
            <img src="${m.homeLogo || 'assets/default.png'}" onerror="this.style.display='none'">
            <span>${m.homeTeam}</span>
          </div>

          <div class="mc-time">
            <div class="mc-time-label">${m.time}</div>
            ${m.score ? `<div class="mc-score">${m.score}</div>` : ''}
          </div>

          <div class="mc-team">
            <img src="${m.awayLogo || 'assets/default.png'}" onerror="this.style.display='none'">
            <span>${m.awayTeam}</span>
          </div>
        </div>

        <div class="text-center mt-2 text-xs text-gray">
          <i class="far fa-calendar-alt"></i> ${m.date}
        </div>

      </div>
    `;
  });

  elements.heroCarousel.innerHTML = ht;
}

export function renderMatchesList({ state, elements }) {
  let filtered = state.matches;

  if (state.currentTab !== 'live') {
    const datePred = buildDateFilter(state.dateFilter);
    filtered = filtered.filter(datePred);
  }

  if (state.searchQuery) {
    filtered = filtered.filter((m) =>
      matchesSearch(state.searchQuery, m.homeTeam, m.awayTeam, m.league)
    );
  } else if (state.selectedLeague !== 'ALL') {
    const keyword = state.selectedLeague.toLowerCase();
    filtered = filtered.filter((m) => m.league && m.league.toLowerCase().includes(keyword));
  }

  if (state.currentTab === 'live') {
    let upcoming = [];
    let live = [];
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const windowStart = new Date(now);
    windowStart.setHours(0, 0, 0, 0);
    const windowEnd = new Date(windowStart.getTime() + 2 * dayMs);

    filtered.forEach((m) => {
      const kickoff = parseMatchDateTime(m.date, m.time);
      if (!kickoff) return;
      if (kickoff < windowStart || kickoff >= windowEnd) return;
      const liveState = resolveLiveState(m, now, 120);
      const item = { ...m, status: liveState };
      if (liveState === 'live') live.push(item);
      else if (liveState === 'upcoming') upcoming.push(item);
    });

    if (!upcoming.length && !live.length) {
      const fallbackUpcoming = [];
      const fallbackLive = [];
      filtered.forEach((m) => {
        const liveState = resolveLiveState(m, now, 120);
        const item = { ...m, status: liveState };
        if (liveState === 'live') fallbackLive.push(item);
        else if (liveState === 'upcoming') fallbackUpcoming.push(item);
      });
      upcoming = fallbackUpcoming;
      live = fallbackLive;
    }

    const byKickoff = (a, b) => {
      const ad = parseMatchDateTime(a.date, a.time);
      const bd = parseMatchDateTime(b.date, b.time);
      if (!ad && !bd) return 0;
      if (!ad) return 1;
      if (!bd) return -1;
      return ad.getTime() - bd.getTime();
    };
    live.sort(byKickoff);
    upcoming.sort(byKickoff);

    const buildRows = (list) => {
      if (!list.length) {
        return '<div class="glass-card text-center p-4"><p class="text-gray">Không có trận đấu phù hợp.</p></div>';
      }
      return list
        .map((m) => {
          const mCode = genMatchCode(m);
          const isFav = state.favorites.includes(mCode);
          return `
            <div class="match-row match-row-live">
              <div class="mr-time">
                <span class="mr-time-text">${m.time}</span>
                ${m.status === 'live' ? '<span class="match-status-live"><span class="live-red-dot"></span><span>Đang diễn ra</span></span>' : ''}
              </div>
              <div class="mr-team home">
                <span>${m.homeTeam}</span>
                <img src="${m.homeLogo || 'assets/default.png'}" alt="${m.homeTeam}" onerror="this.style.display='none'">
              </div>
              <div class="mr-score${m.score ? ' has-score' : ''}">${m.score ? `<span class="mr-score-value">${m.score}</span>` : '<span class="mr-score-vs">VS</span>'}</div>
              <div class="mr-team away">
                <img src="${m.awayLogo || 'assets/default.png'}" alt="${m.awayTeam}" onerror="this.style.display='none'">
                <span>${m.awayTeam}</span>
              </div>
              <button class="fav-btn ${isFav ? 'active' : ''}" data-action="toggle-favorite" data-match="${mCode}" aria-label="${isFav ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}" title="Thêm vào yêu thích">
                <i class="fas fa-star"></i>
              </button>
            </div>
          `;
        })
        .join('');
    };

    elements.matchesWrapper.innerHTML = `
      <div class="live-split">
        <div class="live-split-group">
          <div class="league-header"><i class="fas fa-clock text-primary"></i> Sắp diễn ra (${upcoming.length})</div>
          ${buildRows(upcoming)}
        </div>
        <div class="live-split-group">
          <div class="league-header"><i class="fas fa-broadcast-tower text-primary"></i> Đang diễn ra (${live.length})</div>
          ${buildRows(live)}
        </div>
      </div>
    `;
    return;
  }

  if (filtered.length === 0) {
    const dateLabel = describeDateFilter(state.dateFilter);
    const hint = dateLabel
      ? `Không có trận đấu nào trong khoảng <strong>${dateLabel}</strong>.`
      : 'Không có trận đấu nào.';
    elements.matchesWrapper.innerHTML = `
      <div class="glass-card text-center p-4">
        <i class="fas fa-folder-open mb-2 text-gray" style="font-size:2rem;"></i>
        <p class="text-gray">${hint}</p>
      </div>
    `;
    return;
  }

  let currentGroup = '';
  let html = '';

  filtered.forEach((m) => {
    const groupTitle = `${m.league} &bull; ${m.round} &bull; ${m.date}`;
    if (groupTitle !== currentGroup) {
      html += `
        <div class="league-header">
          <i class="fas fa-trophy text-primary"></i> ${groupTitle}
        </div>
      `;
      currentGroup = groupTitle;
    }

    const mCode = genMatchCode(m);
    const isFav = state.favorites.includes(mCode);

    html += `
      <div class="match-row">
        <div class="mr-time">
          ${m.time}
          ${(m.status || '') === 'live' ? '<span class="match-status-live">Đang phát</span>' : ''}
        </div>
        <div class="mr-team home">
          <span>${m.homeTeam}</span>
          <img src="${m.homeLogo || 'assets/default.png'}" alt="${m.homeTeam}" onerror="this.style.display='none'">
        </div>
        <div class="mr-score${m.score ? ' has-score' : ' is-vs'}">${m.score ? `<span class="mr-score-value">${m.score}</span>` : '<span class="mr-score-vs">VS</span>'}</div>
        <div class="mr-team away">
          <img src="${m.awayLogo || 'assets/default.png'}" alt="${m.awayTeam}" onerror="this.style.display='none'">
          <span>${m.awayTeam}</span>
        </div>
        <button class="fav-btn ${isFav ? 'active' : ''}" data-action="toggle-favorite" data-match="${mCode}" aria-label="${isFav ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}" title="Thêm vào yêu thích">
          <i class="fas fa-star"></i>
        </button>
      </div>
    `;
  });

  elements.matchesWrapper.innerHTML = html;
}

export function renderStandings({ state, elements }) {
  if (!elements.standingsBox) return;

  const leagueKey = getStandingsLeagueKey(state.selectedLeague);
  const leagueLabel = getStandingsLeagueLabel(leagueKey);

  const table = state.standings?.[leagueKey];
  if (!Array.isArray(table) || table.length === 0) {
    const available = Object.keys(state.standings || {}).filter((k) => Array.isArray(state.standings[k]));
    elements.standingsBox.innerHTML = `
      <div class="text-sm text-gray">
        BXH cho <b>${leagueLabel}</b> hiện chưa có dữ liệu.
        ${available.length ? `<div class="mt-2">Đang có: ${available.join(', ')}</div>` : ''}
      </div>
    `;
    return;
  }

  const top = table.slice(0, 6);
  let html = `<div class="mini-standings"><div class="text-xs text-gray mb-2">BXH: <b>${leagueLabel}</b></div>`;
  top.forEach((row) => {
    html += `
      <div class="mini-row">
        <div class="mini-rank">${row.rank}</div>
        <div class="mini-team">
          <img src="${row.logo}" alt="${row.team}" onerror="this.style.display='none'">
          <span>${row.team}</span>
        </div>
        <div class="mini-pts">${row.points}</div>
      </div>
    `;
  });
  html += `</div>`;
  elements.standingsBox.innerHTML = html;
}

export function renderFullStandings({ state }) {
  const tbody = document.getElementById('fullStandingsBody');
  const standingsLeagueName = document.getElementById('standingsLeagueName');
  if (!tbody) return;

  const leagueKey = getStandingsLeagueKey(state.selectedLeague);
  const leagueLabel = getStandingsLeagueLabel(leagueKey);

  if (standingsLeagueName) standingsLeagueName.textContent = leagueLabel;

  const table = state.standings?.[leagueKey];
  if (!Array.isArray(table) || table.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="text-center text-gray">Chưa có dữ liệu BXH cho ${leagueLabel}</td></tr>`;
    return;
  }

  const q = normalizeSearch(state.searchQuery);
  const rows = q ? table.filter((row) => matchesSearch(q, row.team)) : table;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="text-center text-gray">Không tìm thấy đội phù hợp với từ khoá "${state.searchQuery}"</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map((row) => {
      const form = Array.isArray(row.form)
        ? row.form
            .slice(0, 5)
            .map((x) => `<span class="form-pill form-${String(x).toLowerCase()}">${x}</span>`)
            .join("")
        : '<span class="text-gray">-</span>';
      return `
        <tr>
          <td>${row.rank}</td>
          <td class="text-left">
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="${row.logo}" alt="${row.team}" style="width:22px; height:22px;" onerror="this.style.display='none'">
              <span>${row.team}</span>
            </div>
          </td>
          <td>${row.latestResult || ''}</td>
          <td>${row.played}</td>
          <td>${row.win}</td>
          <td>${row.draw}</td>
          <td>${row.loss}</td>
          <td class="hide-mobile">${row.gf}</td>
          <td class="hide-mobile">${row.ga}</td>
          <td>${row.gd}</td>
          <td style="font-weight:700;">${row.points}</td>
          <td class="hide-mobile"><div class="form-pills">${form}</div></td>
        </tr>
      `;
    })
    .join('');
}