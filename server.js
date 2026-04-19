const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

const app = express();
app.use(cors());

// URL nguồn (tách theo giải để lấy được cả tỉ số các trận đã diễn ra)
const LEAGUE_SCHEDULES = [
    { name: 'Ngoại hạng Anh', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-bong-da-anh-c48a466567.html' },
    { name: 'CUP C1', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-cup-c1-champions-league-c48a465411.html' },
    { name: 'La Liga', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-bong-da-tay-ban-nha-c48a468110.html' },
    { name: 'Serie A', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-bong-da-y-c48a394137.html' },
    { name: 'Bundesliga', url: 'https://www.24h.com.vn/bong-da-duc/lich-thi-dau-bong-da-duc-bundesliga-c152a467108.html' },
    { name: 'Ligue 1', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-bong-da-phap-c48a394560.html' },
    { name: 'FA Cup', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-fa-cup-c48a682532.html' },
    { name: 'UEFA Europa League', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-europa-league-c48a467859.html' },
];

// Khởi tạo cache storage
let globalMatchesCache = null;
let lastFetchTime = null;
const CACHE_TTL = Number.parseInt(process.env.CACHE_TTL_MS || '60000', 10); // default 60s

const PUBLIC_DIR = __dirname;
const MOCK_MATCHES_PATH = path.join(PUBLIC_DIR, 'public_api_data.json');

function readMockMatches() {
    try {
        const raw = fs.readFileSync(MOCK_MATCHES_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.matches) ? parsed.matches : []);
    } catch (e) {
        console.warn('Không đọc được public_api_data.json:', e.message);
        return [];
    }
}

// Serve Frontend tĩnh (index.html, css, js, assets, json)
app.use(express.static(PUBLIC_DIR));
app.get('/', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

async function scrapeFromUrl({ url, leagueNameFallback }) {
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        timeout: 15000
    });

    const $ = cheerio.load(data);
    const resultMatches = [];

    // Tìm từng section chứa vòng đấu 
    $('.cate-24h-foot-box-sche-table-ring').each((i, section) => {
        let titleRaw = $(section).find('h2.tuht_show').text().trim(); // VD: "Lịch thi đấu Vòng 32"
        let leagueName = leagueNameFallback || 'Unknown';
        let roundName = titleRaw.replace(/lịch thi đấu\s*/i, '').trim() || 'Không rõ vòng';

        // Phân tách nếu chuỗi có dấu '-' (VD: "Vòng 3 - FA Cup")
        if (titleRaw.includes('-')) {
            const parts = titleRaw.split('-');
            roundName = parts[0].replace(/lịch thi đấu\s*/i, '').trim();
            leagueName = parts[1].trim(); 
        } else if (!titleRaw.toLowerCase().includes('vòng')) {
            leagueName = titleRaw;
            roundName = 'Vòng loại';
        }

        // Lặp qua từng block ngày thi đấu
        $(section).find('article.cate-24h-foot-box-sche-table').each((j, article) => {
            const domDate = $(article).find('header.cate-24h-foot-box-sche-table__title span').text().trim(); // "Thứ Bảy, 11/04/2026"
            let matchDate = domDate;
            
            // Format ngày "dd/mm/yyyy"
            const regexDate = domDate.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (regexDate) {
               matchDate = `${regexDate[1]}/${regexDate[2]}/${regexDate[3]}`;
            }

            // Lặp từng trận
            $(article).find('li[class*="mid"]').each((k, li) => {
                const timeRaw = $(li).find('.cate-24h-foot-home-sche-content__time strong').text().trim();
                const matchTime = timeRaw.split(' ')[0] || timeRaw; // Cắt "02:00" từ "02:00 11/04"

                const homeTeamName = $(li).find('.cate-24h-foot-home-sche-content__match--left figcaption span').text().trim();
                const awayTeamName = $(li).find('.cate-24h-foot-home-sche-content__match--right figcaption span').text().trim();
                const homeLogoUrl = $(li).find('.cate-24h-foot-home-sche-content__match--left img').attr('src') || '';
                const awayLogoUrl = $(li).find('.cate-24h-foot-home-sche-content__match--right img').attr('src') || '';
                
                const scoreA = $(li).find('.match-fs_a').text().trim();
                const scoreB = $(li).find('.match-fs_b').text().trim();
                let scoreStr = '';
                if (scoreA !== '' && scoreB !== '') {
                    scoreStr = `${scoreA} - ${scoreB}`;
                }
                
                // Đẩy vào array
                if (homeTeamName && awayTeamName) {
                    resultMatches.push({
                        league: leagueName,
                        round: roundName,
                        date: matchDate,
                        time: matchTime,
                        score: scoreStr,
                        homeTeam: homeTeamName,
                        awayTeam: awayTeamName,
                        homeLogo: homeLogoUrl,
                        awayLogo: awayLogoUrl
                    });
                }
            });
        });
    });

    return resultMatches;
}

// Script scraping (multi league)
async function scrape24hSchedule() {
    console.log("-> Bắt đầu scraping 24h.com.vn (multi-league)...");

    const buckets = await Promise.allSettled(
        LEAGUE_SCHEDULES.map((l) => scrapeFromUrl({ url: l.url, leagueNameFallback: l.name }))
    );

    const matches = buckets
        .filter((b) => b.status === 'fulfilled')
        .flatMap((b) => b.value);

    console.log(`-> Đã cào được ${matches.length} trận đấu!`);

    // Fallback: khi 24h đổi DOM/chặn => trả về mock để FE vẫn hoạt động
    if (matches.length === 0) {
        const mock = readMockMatches();
        if (mock.length) {
            console.log(`-> Fallback: dùng mock ${mock.length} trận từ public_api_data.json`);
            return mock;
        }
    }

    return matches;
}

// Route API cung cấp chuỗi JSON format như yêu cầu
app.get('/api/matches', async (req, res) => {
    try {
        const timeNow = Date.now();
        // Caching: Kiểm tra cache và return ngay lập tức
        if (globalMatchesCache && lastFetchTime && (timeNow - lastFetchTime) < CACHE_TTL) {
            console.log('API Trả về kết quả từ Cache mem.');
            return res.json(globalMatchesCache); 
        }

        // Fetch web scraping
        const freshMatches = await scrape24hSchedule();
        
        // Cập nhật Cache
        globalMatchesCache = freshMatches;
        lastFetchTime = timeNow;

        return res.json(globalMatchesCache); 
    } catch (err) {
        console.error("Scrape Error Details:", err.message);
        // Trả HTTP Error Status code + message JSON
        return res.status(500).json({ error: "Không lấy được dữ liệu từ 24h lúc này" });
    }
});

// Standings currently served from bundled JSON (mock/source-of-truth for FE)
app.get('/api/standings', (req, res) => {
    try {
        const standingsPath = path.join(PUBLIC_DIR, 'public_standings_data.json');
        const raw = fs.readFileSync(standingsPath, 'utf-8');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.send(raw);
    } catch (err) {
        console.error('Standings read error:', err.message);
        return res.status(500).json({ error: 'Không thể tải BXH' });
    }
});

// Chạy Express API Server (Cổng 3000)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`=====================================`);
    console.log(`[API START] Backend Express.js Server`);
    console.log(`Lắng nghe tại http://localhost:${PORT}`);
    console.log(`Test endpoint JSON: http://localhost:${PORT}/api/matches`);
    console.log(`=====================================`);
});
