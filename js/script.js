// TRẠNG THÁI (STATE)
const state = {
    matches: [],
    leagues: [],
    standings: {},
    selectedLeague: 'ALL',
    searchQuery: '',
    favorites: JSON.parse(localStorage.getItem('gf_favorites')) || [],
    theme: localStorage.getItem('gf_theme') || 'dark',
    isLoading: true
};

// URL API Local (Có thể trỏ tới data.json mock)
const API_URL = './public_api_data.json';

// CÁC ELEMENT DOM
const elements = {
    heroCarousel: document.getElementById('heroCarousel'),
    matchesWrapper: document.getElementById('matchesWrapper'),
    leagueFilters: document.getElementById('leagueFilters'),
    mobileTabs: document.getElementById('mobileTabs'),
    themeBtn: document.getElementById('themeBtn'),
    globalSearch: document.getElementById('globalSearch'),
    mainNavLinks: document.getElementById('mainNavLinks'),
    toastContainer: document.getElementById('toastContainer'),
    myFavs: document.getElementById('myFavs'),
    standingsBox: document.getElementById('standingsBox')
};

// Map danh sách icon (Sử dụng URL logo thực tế ổn định)
const LEAGUE_ICONS = {
    'Lịch thi đấu hôm nay': 'https://img.icons8.com/color/48/today.png',
    'FA Cup': 'https://media.api-sports.io/football/leagues/45.png',
    'Ngoại hạng Anh': 'https://media.api-sports.io/football/leagues/39.png',
    'CUP C1': 'https://media.api-sports.io/football/leagues/2.png',
    'La Liga': 'https://media.api-sports.io/football/leagues/140.png',
    'V.League 1': 'https://media.api-sports.io/football/leagues/130.png',
    'Serie A': 'https://media.api-sports.io/football/leagues/135.png',
    'UEFA Europa League': 'https://media.api-sports.io/football/leagues/3.png',
    'Bundesliga': 'https://media.api-sports.io/football/leagues/78.png',
    'Ligue 1': 'https://media.api-sports.io/football/leagues/61.png',
    'ALL': 'https://img.icons8.com/color/48/today.png'
};

const DISPLAY_LEAGUES = [
    { name: 'Lịch thi đấu hôm nay', search: 'Lịch thi đấu hôm nay', iconUrl: LEAGUE_ICONS['Lịch thi đấu hôm nay'] },
    { name: 'FA Cup', search: 'FA Cup', iconUrl: LEAGUE_ICONS['FA Cup'] },
    { name: 'Ngoại hạng Anh', search: 'Ngoại hạng Anh', iconUrl: LEAGUE_ICONS['Ngoại hạng Anh'] },
    { name: 'CUP C1', search: 'CUP C1', iconUrl: LEAGUE_ICONS['CUP C1'] },
    { name: 'La Liga', search: 'La Liga', iconUrl: LEAGUE_ICONS['La Liga'] },
    { name: 'V.League 1', search: 'V.League 1', iconUrl: LEAGUE_ICONS['V.League 1'] },
    { name: 'Serie A', search: 'Serie A', iconUrl: LEAGUE_ICONS['Serie A'] },
    { name: 'UEFA Europa League', search: 'Europa', iconUrl: LEAGUE_ICONS['UEFA Europa League'] },
    { name: 'Bundesliga', search: 'Bundesliga', iconUrl: LEAGUE_ICONS['Bundesliga'] },
    { name: 'Ligue 1', search: 'Ligue 1', iconUrl: LEAGUE_ICONS['Ligue 1'] }
];

function getLeagueIcon(leagueName) {
    return LEAGUE_ICONS[leagueName] || LEAGUE_ICONS['ALL'];
}

// -----------------------------------------
// 1. TIỆN ÍCH (UTILS & TOAST)
// -----------------------------------------
function showToast(message) {
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

// Chuyển Theme (Dark/Light)
function initTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    if (state.theme === 'light') {
        elements.themeBtn.innerHTML = '<i class="fas fa-sun" style="color: #ff9800;"></i>';
    } else {
        elements.themeBtn.innerHTML = '<i class="fas fa-moon"></i>';
    }

    elements.themeBtn.addEventListener('click', () => {
        // Tắt toàn bộ transition tạm thời lúc chuyển
        document.body.classList.add('no-transition');
        
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', state.theme);
        elements.themeBtn.innerHTML = state.theme === 'light' ? '<i class="fas fa-sun" style="color: #ff9800;"></i>' : '<i class="fas fa-moon"></i>';
        localStorage.setItem('gf_theme', state.theme);
        
        // Mở lại sau một chút cho chuẩn
        setTimeout(() => document.body.classList.remove('no-transition'), 50);
    });
}

// -----------------------------------------
// 2. LOGIC LỌC VÀ YÊU THÍCH
// -----------------------------------------
window.filterData = function(leagueName) {
    state.selectedLeague = leagueName;
    renderSidebarLeagues();
    renderMobileTabs();
    renderHeroCarousel();
    renderMatchesList();
    renderStandings(); // Update standings when filtering
    renderFullStandings(); // Also update full table
};

window.toggleFavorite = function(matchCode) {
    const index = state.favorites.indexOf(matchCode);
    if (index > -1) {
        state.favorites.splice(index, 1);
    } else {
        state.favorites.push(matchCode);
    }
    localStorage.setItem('gf_favorites', JSON.stringify(state.favorites));
    renderMatchesList(); // Update UI list
    renderFavSidebar();  // Update Sidebar
};

// Tạo mã hash unique cho trận (dùng homeTeam + awayTeam)
function genMatchCode(match) {
    return (match.homeTeam + '_' + match.awayTeam).replace(/\s+/g, '').toLowerCase();
}

// -----------------------------------------
// 3. RENDER UI COMPONENTS
// -----------------------------------------

// Xử lý Render Sidebar Môn Thể Thao (Desktop)
function renderSidebarLeagues() {
    let ht = `
        <li class="${state.selectedLeague === 'Lịch thi đấu hôm nay' || state.selectedLeague === 'ALL' ? 'active' : ''}" onclick="filterData('ALL')">
            <img src="${LEAGUE_ICONS['ALL']}" alt="Lịch thi đấu hôm nay" class="league-sidebar-icon"> <span class="lg-name">Lịch thi đấu hôm nay</span>
        </li>
    `;
    
    DISPLAY_LEAGUES.slice(1).forEach(def => {
        let activeClass = state.selectedLeague === def.search ? 'active' : '';
        ht += `
            <li class="${activeClass}" onclick="filterData('${def.search}')">
                <img src="${def.iconUrl}" alt="${def.name}" class="league-sidebar-icon"> 
                <span class="lg-name">${def.name}</span>
            </li>
        `;
    });
    elements.leagueFilters.innerHTML = ht;
}

// Xử lý Render Tabs ngang (Mobile)
function renderMobileTabs() {
    let ht = `<button class="mobile-tab ${state.selectedLeague === 'ALL' ? 'active' : ''}" onclick="filterData('ALL')">Lịch hôm nay</button>`;
    DISPLAY_LEAGUES.slice(1).forEach(def => {
        ht += `<button class="mobile-tab ${state.selectedLeague === def.search ? 'active' : ''}" onclick="filterData('${def.search}')">${def.name}</button>`;
    });
    elements.mobileTabs.innerHTML = ht;
}

// Render Trận Yêu Thích ở Sidebar
function renderFavSidebar() {
    if (state.favorites.length === 0) {
        elements.myFavs.innerHTML = '<li class="text-sm text-gray">Chưa có trận nào</li>';
        return;
    }
    
    let html = '';
    state.favorites.forEach(favCode => {
        const m = state.matches.find(x => genMatchCode(x) === favCode);
        if(m) {
            html += `
            <li class="mt-2 p-2 glass-card d-flex" style="flex-direction: column; align-items:flex-start; gap:5px; margin-bottom:10px;">
                <div class="text-xs text-primary">${m.time}</div>
                <div class="text-sm font-weight-bold d-flex" style="justify-content:space-between; width:100%;">
                    <span>${m.homeTeam} ${m.score ? `<span style="color:var(--primary-color)">${m.score}</span>` : '⚡'} ${m.awayTeam}</span>
                    <i class="fas fa-star text-warning" style="cursor:pointer; color: #ffd700;" onclick="toggleFavorite('${favCode}')"></i>
                </div>
            </li>
            `;
        }
    });
    elements.myFavs.innerHTML = html;
}

// Render Highlight Hero Section (Sắp diễn ra)
function renderHeroCarousel() {
    let filtered = state.matches;
    
    if (state.searchQuery) {
        filtered = filtered.filter(m => 
            (m.homeTeam && m.homeTeam.toLowerCase().includes(state.searchQuery)) || 
            (m.awayTeam && m.awayTeam.toLowerCase().includes(state.searchQuery))
        );
    } else if (state.selectedLeague !== 'ALL') {
        const keyword = state.selectedLeague.toLowerCase();
        filtered = filtered.filter(m => m.league && m.league.toLowerCase().includes(keyword));
    }
    
    // Cắt 6 trận gần nhất có vẻ "hấp dẫn" hoặc đầu tiên
    const topMatches = filtered.slice(0, 6);
    
    if (topMatches.length === 0) {
        elements.heroCarousel.innerHTML = `<div class="text-gray text-center p-4 w-100" style="background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color);">Không có trận đấu nổi bật.</div>`;
        return;
    }

    let ht = '';
    topMatches.forEach(m => {
        ht += `
        <div class="match-card">
            <div class="mc-league">${m.league} &bull; ${m.round}</div>
            <div class="mc-teams">
                <div class="mc-team">
                    <img src="${m.homeLogo || 'assets/default.png'}" onerror="this.style.display='none'">
                    <span>${m.homeTeam}</span>
                </div>
                <div class="mc-time">
                    <div style="font-size: 0.9em; margin-bottom: 4px;">${m.time}</div>
                    ${m.score ? `<div style="color:var(--primary-color); font-weight:bold; font-size:1.1em">${m.score}</div>` : ''}
                </div>
                <div class="mc-team">
                    <img src="${m.awayLogo || 'assets/default.png'}" onerror="this.style.display='none'">
                    <span>${m.awayTeam}</span>
                </div>
            </div>
            <div class="text-center mt-2 text-xs text-gray"><i class="far fa-calendar-alt"></i> ${m.date}</div>
        </div>
        `;
    });
    elements.heroCarousel.innerHTML = ht;
}

// Render Default MATCH LIST - Gom theo Nhóm (Vòng, Ngày)
function renderMatchesList() {
    let filtered = state.matches;
    
    if (state.searchQuery) {
        filtered = filtered.filter(m => 
            (m.homeTeam && m.homeTeam.toLowerCase().includes(state.searchQuery)) || 
            (m.awayTeam && m.awayTeam.toLowerCase().includes(state.searchQuery))
        );
    } else if (state.selectedLeague !== 'ALL') {
        const keyword = state.selectedLeague.toLowerCase();
        filtered = filtered.filter(m => m.league && m.league.toLowerCase().includes(keyword));
    }

    if (filtered.length === 0) {
        elements.matchesWrapper.innerHTML = `
            <div class="glass-card text-center p-4">
                <i class="fas fa-folder-open mb-2 text-gray" style="font-size:2rem;"></i>
                <p class="text-gray">Không có trận đấu nào.</p>
            </div>
        `;
        return;
    }

    let currentGroup = '';
    let html = '';

    filtered.forEach(m => {
        const groupTitle = `${m.league} &bull; ${m.round} &bull; ${m.date}`;
        
        // Nếu chuyển sang vòng/ngày mới -> in Header
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

        // Row UI
        html += `
            <div class="match-row">
                <div class="mr-time">${m.time}</div>
                <div class="mr-team home">
                    <span>${m.homeTeam}</span>
                    <img src="${m.homeLogo || 'assets/default.png'}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2FhYSIgZD0iTTEyIDBDNi40OCAwIDIgNC40OCAyIDEyczQuNDggMTIgMTAgMTJzMTAtNC40OCAxMC0xMlMyMC41MiAwIDEyIDB6bTAgMjJjLTUuNTIgMC0xMC00LjQ4LTEwLTEwUzYuNDggMiAxMiAyczEwIDQuNDggMTAgMTBzLTQuNDggMTAtMTAgMTB6Ii8+PC9zdmc+'">
                </div>
                <div class="mr-score${m.score ? ' has-score' : ''}">${m.score ? `<span style="color:var(--primary-color)">${m.score}</span>` : 'VS'}</div>
                <div class="mr-team away">
                    <img src="${m.awayLogo || 'assets/default.png'}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2FhYSIgZD0iTTEyIDBDNi40OCAwIDIgNC40OCAyIDEyczQuNDggMTIgMTAgMTJzMTAtNC40OCAxMC0xMlMyMC41MiAwIDEyIDB6bTAgMjJjLTUuNTIgMC0xMC00LjQ4LTEwLTEwUzYuNDggMiAxMiAyczEwIDQuNDggMTAgMTBzLTQuNDggMTAtMTAgMTB6Ii8+PC9zdmc+'">
                    <span>${m.awayTeam}</span>
                </div>
                <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite('${mCode}')" title="Thêm vào yêu thích">
                    <i class="fas fa-star"></i>
                </button>
            </div>
        `;
    });

    elements.matchesWrapper.innerHTML = html;
}

// -----------------------------------------
// 4. FETCH API TỪ BACKEND
// -----------------------------------------
async function fetchData() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Network response was not ok");
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);

        // Lưu state
        state.matches = Array.isArray(data) ? data : (data.matches || []);
        state.leagues = [...new Set(state.matches.map(x => x.league))]; // Lấy danh sách giải Uniques
        state.isLoading = false;

        // Render UI
        renderSidebarLeagues();
        renderMobileTabs();
        renderHeroCarousel();
        renderFavSidebar();
        renderMatchesList();

    } catch (error) {
        console.error("Lỗi lấy dữ liệu:", error);
        showToast("Lỗi: Không thể lấy dữ liệu mới nhất từ Live Server.");
        
        // Render rỗng để xóa Skeleton nếu lỗi
        elements.heroCarousel.innerHTML = `<div class="text-gray text-center p-4 w-100">Không thể load Carousel...</div>`;
        elements.matchesWrapper.innerHTML = `<div class="text-gray text-center glass-card p-4">Server không phản hồi. Xin thử lại sau.</div>`;
    }
}

// -----------------------------------------
// 5. KHỞI TẠO NAVBAR INTERACTION
// -----------------------------------------
function initNavbar() {
    if (elements.globalSearch) {
        elements.globalSearch.addEventListener('input', (e) => {
            state.searchQuery = e.target.value.toLowerCase().trim();
            renderHeroCarousel();
            renderMatchesList();
        });
    }

    if (elements.mainNavLinks) {
        const navItems = elements.mainNavLinks.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                const tab = item.getAttribute('data-tab');
                if (tab === 'standings') {
                    if (elements.mobileTabs) elements.mobileTabs.style.display = 'none';
                    if (elements.heroCarousel) elements.heroCarousel.closest('.live-section').style.display = 'none';
                    if (document.getElementById('matchesWrapper')) document.getElementById('matchesWrapper').closest('.matches-list').style.display = 'none';
                    if (document.getElementById('standingsSection')) {
                        document.getElementById('standingsSection').style.display = 'block';
                        renderFullStandings();
                    }
                } else {
                    if (elements.mobileTabs) elements.mobileTabs.style.display = 'flex';
                    if (elements.heroCarousel) elements.heroCarousel.closest('.live-section').style.display = 'block';
                    if (document.getElementById('matchesWrapper')) document.getElementById('matchesWrapper').closest('.matches-list').style.display = 'block';
                    if (document.getElementById('standingsSection')) document.getElementById('standingsSection').style.display = 'none';
                    
                    if (tab === 'live') {
                        showToast("Đang hiển thị các trận Tâm điểm.");
                        state.searchQuery = '';
                        if (elements.globalSearch) elements.globalSearch.value = '';
                        filterData('Lịch thi đấu hôm nay');
                    } else {
                        state.searchQuery = '';
                        if (elements.globalSearch) elements.globalSearch.value = '';
                        filterData('ALL');
                    }
                }
            });
        });
    }
}

// -----------------------------------------
// 6. KHỞI TẠO APP
// -----------------------------------------
function initApp() {
    initTheme();
    initNavbar();
    // Chờ tí xíu cho mượt Skeleton
    setTimeout(() => {
        fetchData();
        
        // Fetch standings data
        fetch('./public_standings_data.json')
            .then(res => res.json())
            .then(data => {
                state.standings = data;
                renderStandings();
            })
            .catch(err => {
                console.log('Error fetching standings', err);
                if (elements.standingsBox) {
                    elements.standingsBox.innerHTML = '<div class="text-sm text-gray">Không thể tải BXH</div>';
                }
            });

        // Cài đặt Refresh tự động 5 phút
        setInterval(fetchData, 300 * 1000);
    }, 800);
}

// Run
document.addEventListener("DOMContentLoaded", initApp);