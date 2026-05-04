const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const DETAIL_ENRICH_MAX_MATCHES = 0;
const DETAIL_LOOKBACK_DAYS = 7;

function parseFixtureDate(dateValue) {
    const raw = String(dateValue || '').trim();
    const m = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return null;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 0, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
}

function shouldEnrichDetail(match) {
    if (!match || !match.score || !match.detailUrl) return false;
    const date = parseFixtureDate(match.date);
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today.getTime() - (DETAIL_LOOKBACK_DAYS - 1) * 24 * 60 * 60 * 1000);
    return date >= start && date <= today;
}

async function scrapeMatchDetailEvents(page, detailUrl) {
    try {
        await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForSelector('body', { timeout: 6000 });
        return await page.evaluate(() => {
            const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
            const nodes = Array.from(
                document.querySelectorAll(
                    '.match-event li, .match-events li, .timeline li, .event-item, .match-detail-event li, .match-stat li, .list-event li, li'
                )
            );

            const rawEvents = [];
            const minutePattern = /\b\d{1,3}(?:\+\d{1,2})?\s*['’`]\b/;
            nodes.forEach((node) => {
                const text = compactText(node.innerText || node.textContent || '');
                if (!text) return;
                if (text.length > 140) return;
                if (!/thẻ|bàn thắng|goal|pen|phản lưới|yellow|red/i.test(text)) return;
                if (!minutePattern.test(text)) return;
                rawEvents.push(text);
            });

            const yellowCards = [];
            const redCards = [];
            const scorers = [];

            rawEvents.forEach((line) => {
                const lower = line.toLowerCase();
                if (/thẻ vàng|yellow/i.test(lower)) yellowCards.push(line);
                else if (/thẻ đỏ|red/i.test(lower)) redCards.push(line);
                else if (/bàn thắng|goal|pen|phản lưới/i.test(lower)) scorers.push(line);
            });

            return {
                scorers,
                yellowCards,
                redCards,
                hasDetailEvents: rawEvents.length > 0,
                rawEvents,
            };
        });
    } catch (error) {
        return {
            scorers: [],
            yellowCards: [],
            redCards: [],
            hasDetailEvents: false,
            rawEvents: [],
        };
    }
}

async function scrapeAllLeagues() {
  const startUrl = 'https://www.24h.com.vn/bong-da/lich-thi-dau-bong-da-hom-nay-moi-nhat-c48a364371.html';
  
  let browser;
  try {
    console.log('🚀 Khởi động Puppeteer Browser...');
    browser = await puppeteer.launch({
      headless: 'new', // Chạy ẩn
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
    });

    const page = await browser.newPage();
    
    // Tối ưu hóa: Không load ảnh, css, font để tăng tốc scrape
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
            req.abort();
        } else {
            req.continue();
        }
    });

    console.log(`\n🔍 Đang truy cập trang chính: ${startUrl}`);
    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 1. Detect all available leagues
    console.log(`\n🕵️ Thu thập danh sách các giải đấu...`);
    const leaguesToScrape = await page.evaluate(() => {
        const links = [];
        
        // Các thẻ a chứa link lịch thi đấu của các giải cụ thể
        const anchorTags = document.querySelectorAll('a[href*="/lich-thi-dau"]');
        
        // Từ khóa các giải đấu ta cần lấy
        const targets = ['Ngoại hạng Anh', 'FA Cup', 'CUP C1', 'Cúp C2', 'Europa', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'V.League'];
        
        const seenUrls = new Set();

        // 2. Tự động lấy từ danh sách điều hướng động trên trang
        anchorTags.forEach(a => {
            const text = a.innerText.trim();
            const href = a.href;
            
            // Lọc ra các giải đấu hợp lệ
            if (href && href.includes('.24h.com.vn') && text && targets.some(t => text.toLowerCase().includes(t.toLowerCase()))) {
                if (!seenUrls.has(href)) {
                    seenUrls.add(href);
                    links.push({ name: text, url: href });
                }
            }
        });

        // Bổ sung thủ công nếu regex bị sót một số tên (do UI 24h đôi khi giấu text trong icon hoặc tab đổi định dạng)
        const additionalDefaults = [
            { name: 'Premier League', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-bong-da-anh-c48a466567.html' },
            { name: 'Champions League', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-cup-c1-champions-league-c48a465411.html' },
            { name: 'La Liga', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-bong-da-tay-ban-nha-c48a468110.html' },
            { name: 'Serie A', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-bong-da-y-c48a394137.html' },
            { name: 'Bundesliga', url: 'https://www.24h.com.vn/bong-da-duc/lich-thi-dau-bong-da-duc-bundesliga-c152a467108.html' },
            { name: 'Ligue 1', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-bong-da-phap-c48a394560.html' },
            { name: 'FA Cup', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-fa-cup-c48a682532.html' },
            { name: 'Europa League', url: 'https://www.24h.com.vn/bong-da/lich-thi-dau-europa-league-c48a467859.html' }
        ];
        
        // Hợp nhất với các URL mặc định để đảm bảo bao phủ 100%
        additionalDefaults.forEach(def => {
           if (!seenUrls.has(def.url)) {
               seenUrls.add(def.url);
               links.push(def);
           }
        });

        return links;
    });

    console.log(`📌 Tìm thấy ${leaguesToScrape.length} giải đấu, duyệt qua từng giải...`);
    leaguesToScrape.forEach(l => console.log(` - ${l.name}`));

    const allMatches = [];

    // 3. For EACH league: Navigate / Wait / Extract
    for (const league of leaguesToScrape) {
        console.log(`\n⏳ Đang scrape giải: ${league.name}`);
        
        try {
            await page.goto(league.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            // Chờ cho bảng lịch thi đấu xuất hiện
            await page.waitForSelector('article.cate-24h-foot-box-sche-table', { timeout: 10000 }).catch(e => {
                console.log(`   (Không tìm thấy bảng lịch đấu chuẩn của 24h, sẽ thử tiếp...)`);
            });

            // Xử lý lấy Data Matches
            const matchesOfLeague = await page.evaluate((leagueName) => {
                const matches = [];
                
                // 24h cấu trúc chung: .cate-24h-foot-box-sche-table-ring (Block vòng) -> article (Block ngày) -> li (Các trận)
                const vongBlocks = document.querySelectorAll('.cate-24h-foot-box-sche-table-ring');

                if (vongBlocks.length === 0) {
                    // Fallback xử lý khi không có thẻ ring chứa vòng (VD: FA Cup)
                    const articles = document.querySelectorAll('article.cate-24h-foot-box-sche-table');
                    
                    articles.forEach(article => {
                         const dateStr = article.querySelector('header span')?.innerText.trim() || '';
                         
                         const listItems = article.querySelectorAll('ul li[class*="mid"]');
                         listItems.forEach(li => {
                             const time = li.querySelector('.cate-24h-foot-home-sche-content__time strong')?.innerText.trim();
                             
                             const homeTeam = li.querySelector('.cate-24h-foot-home-sche-content__match--left span')?.innerText.trim();
                             const awayTeam = li.querySelector('.cate-24h-foot-home-sche-content__match--right span')?.innerText.trim();
                             
                             let homeLogo = li.querySelector('.cate-24h-foot-home-sche-content__match--left img')?.getAttribute('src') || '';
                             let awayLogo = li.querySelector('.cate-24h-foot-home-sche-content__match--right img')?.getAttribute('src') || '';
                            const detailUrl = li.querySelector('a[href*="bong-da"], a[href*="tran-dau"], a[href*="match"]')?.href || '';
                             
                             const scoreA = li.querySelector('.match-fs_a')?.innerText.trim() || '';
                             const scoreB = li.querySelector('.match-fs_b')?.innerText.trim() || '';
                             let score = '';
                             if (scoreA !== '' && scoreB !== '') {
                                 score = `${scoreA} - ${scoreB}`;
                             }
                             
                             if (!time || (!homeTeam && !awayTeam)) return;

                             // Extract Round/date manually if not structured
                             const matchDateMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                             const parsedDate = matchDateMatch ? matchDateMatch[0] : dateStr;

                             matches.push({
                                 league: leagueName,
                                 round: 'N/A', // FA Cup thường không có vòng rõ ràng ở đây
                                 date: parsedDate,
                                 time: time,
                                 score: score,
                                 homeTeam: homeTeam || 'Unknown',
                                 awayTeam: awayTeam || 'Unknown',
                                 homeLogo: homeLogo,
                                 awayLogo: awayLogo,
                                 detailUrl,
                                 scorers: [],
                                 yellowCards: [],
                                 redCards: [],
                                 hasDetailEvents: false
                             });
                         });
                    });
                } else {
                    // Cấu trúc chuẩn theo Vòng (Premier League, La Liga, Serie A...)
                    vongBlocks.forEach(vongBlock => {
                        let roundStr = vongBlock.querySelector('h2.tuht_show')?.innerText.trim() || '';
                        if (!roundStr) {
                             const blockTitle = vongBlock.previousElementSibling;
                             if (blockTitle && blockTitle.tagName === 'H2') roundStr = blockTitle.innerText.trim();
                        }
                        
                        let finalRound = roundStr || 'Vòng đấu';
                        
                        // Parse Round Ex: "Vòng 32 - Ngoại hạng Anh" -> "Vòng 32"
                        if (finalRound.includes('-')) {
                            finalRound = finalRound.split('-')[0].trim();
                        }

                        // Tìm ngày diễn ra
                        const dateArticles = vongBlock.querySelectorAll('article.cate-24h-foot-box-sche-table');
                        dateArticles.forEach(article => {
                            const rawDate = article.querySelector('header.cate-24h-foot-box-sche-table__title span')?.innerText.trim() || '';
                            // Ví dụ: "Thứ Bảy, 11/04/2026"
                            const matchDateMatch = rawDate.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                            const finalDate = matchDateMatch ? matchDateMatch[0] : rawDate;

                            const matchRows = article.querySelectorAll('li[class*="mid"]');
                            matchRows.forEach(li => {
                                const time = li.querySelector('.cate-24h-foot-home-sche-content__time strong')?.innerText.trim();
                                
                                const homeEl = li.querySelector('.cate-24h-foot-home-sche-content__match--left');
                                const awayEl = li.querySelector('.cate-24h-foot-home-sche-content__match--right');
                                
                                const homeTeam = homeEl?.querySelector('span')?.innerText.trim();
                                const awayTeam = awayEl?.querySelector('span')?.innerText.trim();

                                let homeLogo = homeEl?.querySelector('img')?.getAttribute('data-src') || homeEl?.querySelector('img')?.getAttribute('src');
                                let awayLogo = awayEl?.querySelector('img')?.getAttribute('data-src') || awayEl?.querySelector('img')?.getAttribute('src');
                                const detailUrl = li.querySelector('a[href*="bong-da"], a[href*="tran-dau"], a[href*="match"]')?.href || '';

                                const scoreA = li.querySelector('.match-fs_a')?.innerText.trim();
                                const scoreB = li.querySelector('.match-fs_b')?.innerText.trim();
                                let score = '';
                                if (scoreA && scoreB) {
                                    score = `${scoreA} - ${scoreB}`;
                                }

                                if (!time || (!homeTeam && !awayTeam)) return;

                                matches.push({
                                    league: leagueName,
                                    round: finalRound,
                                    date: finalDate,
                                    time: time,
                                    score: score,
                                    homeTeam: homeTeam || 'Unknown',
                                    awayTeam: awayTeam || 'Unknown',
                                    homeLogo: homeLogo || '',
                                    awayLogo: awayLogo || '',
                                    detailUrl,
                                    scorers: [],
                                    yellowCards: [],
                                    redCards: [],
                                    hasDetailEvents: false
                                });
                            });
                        });
                    });
                }
                
                // Dọn lại data (Chuẩn form url logo)
                return matches.map(m => {
                    if (m.homeLogo && m.homeLogo.startsWith('/')) m.homeLogo = 'https://www.24h.com.vn' + m.homeLogo;
                    if (m.awayLogo && m.awayLogo.startsWith('/')) m.awayLogo = 'https://www.24h.com.vn' + m.awayLogo;
                    return m;
                });

            }, league.name);

            console.log(`   ✅ Cào thành công ${matchesOfLeague.length} trận đấu!`);
            allMatches.push(...matchesOfLeague);

        } catch (error) {
            console.error(`   ❌ Lỗi khi scrape ${league.name}:`, error.message);
        }
    }

    const detailCandidates = allMatches.filter(shouldEnrichDetail).slice(0, DETAIL_ENRICH_MAX_MATCHES);
    if (detailCandidates.length) {
        console.log(`\n🧩 Mở rộng dữ liệu sự kiện trận đấu (ghi bàn/thẻ): ${detailCandidates.length} trận`);
        const detailPage = await browser.newPage();
        for (let idx = 0; idx < detailCandidates.length; idx += 1) {
            const match = detailCandidates[idx];
            const events = await scrapeMatchDetailEvents(detailPage, match.detailUrl);
            match.scorers = events.scorers;
            match.yellowCards = events.yellowCards;
            match.redCards = events.redCards;
            match.hasDetailEvents = events.hasDetailEvents;
            if ((idx + 1) % 20 === 0 || idx === detailCandidates.length - 1) {
                console.log(`   ↳ Đã xử lý sự kiện: ${idx + 1}/${detailCandidates.length}`);
            }
        }
        await detailPage.close();
    } else {
        console.log(`\n🧩 Không có trận phù hợp để mở rộng dữ liệu sự kiện.`);
    }

    // Export output in JSON format
    const outputPath = path.join(__dirname, 'all_leagues_fixtures.json');
    fs.writeFileSync(outputPath, JSON.stringify(allMatches, null, 2), 'utf-8');
    
    console.log(`\n🎉 HOÀN TẤT! Đã cạo tổng cộng ${allMatches.length} trận đấu từ ${leaguesToScrape.length} giải.`);
    console.log(`📁 Dữ liệu được lưu tại dạng JSON Array: ${outputPath}`);

  } catch (error) {
    console.error('CRITICAL ERROR:', error);
  } finally {
    if (browser) {
        await browser.close();
        console.log('🔒 Trình duyệt Puppeteer đã được đóng thành công.');
    }
  }
}

scrapeAllLeagues();