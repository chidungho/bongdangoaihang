<div align="center">
  <img src="assets/favicon.svg" alt="GoalFlash Logo" width="120" />
  <h1>GoalFlash Football App</h1>
  <p>
    <img src="https://img.shields.io/badge/node_js-%3E%3D18.0-brightgreen.svg?style=flat-square" alt="Node version" />
    <img src="https://img.shields.io/badge/puppeteer-Web_Scraping-blue.svg?style=flat-square" alt="Puppeteer Scraper" />
    <img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square" alt="License" />
  </p>
</div>

## Giới thiệu dự án
GoalFlash là một ứng dụng web gọn nhẹ giúp theo dõi lịch thi đấu, kết quả và bảng xếp hạng bóng đá từ nhiều giải đấu hàng đầu thế giới (Ngoại Hạng Anh, C1, La Liga, Serie A, V.League,...). Dữ liệu được cào tự động từ nguồn 24h qua backend Node.js. Ứng dụng hỗ trợ giao diện tối ưu đa nền tảng và PWA.

## Cấu trúc thư mục
- /css: Style CSS cho giao diện
- /js: Logic Frontend
- /assets: Chứa logo, icon, hình ảnh
- /lib & /tools: Chứa mã nguồn cào dữ liệu (Puppeteer)
- \server.js\: Web server xử lý API & giao diện
- \scraper-multiple-leagues.js\: Script fetch dữ liệu
- \index.html\: Cấu trúc giao diện chính

## Tech Stack
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla), PWA (Progressive Web App).
- **Backend:** Node.js, Puppeteer.

## Quick Start
Yêu cầu hệ thống: **Node.js 18+**

`ash
# Cài đặt các thư viện cần thiết
npm install

# Khởi chạy server API và Bot cào kết quả
npm start
`
Mở trình duyệt và truy cập: \http://localhost:5500\ hoặc cổng được log trên console.

## Deployment & Hosting
Ứng dụng có thể deploy dễ dàng lên các nền tảng hỗ trợ Node.js như VPS, Render, Railway.
- **Lưu ý:** Ứng dụng sử dụng Puppeteer/Headless Browser để cào kết quả bóng đá, do đó máy chủ cần hỗ trợ môi trường chạy Chromium.
