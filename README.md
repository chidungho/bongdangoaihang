# BongDaNgoaiHang.Com

Nền tảng tỷ số và tin tức bóng đá, được tổ chức theo kiến trúc MVC để dễ mở rộng, dễ bảo trì và phù hợp triển khai production.

## Kiến trúc dự án

- `src/models`: Định nghĩa schema/model Mongoose
- `src/controllers`: Xử lý request/response cho API và page
- `src/services`: Nghiệp vụ chính (match provider, standings, mongo, cache)
- `src/routes`: Khai báo route API và route giao diện
- `src/middlewares`: Middleware dùng chung (auth, logging context)
- `public`: Toàn bộ tài nguyên frontend (pages, css, js, assets, data public)
- `data/ingestion`: Công cụ scrape/ingest dữ liệu đầu vào
- `tests`: Automation tests (API + page routes)
- `tools`: Script hỗ trợ vận hành/migration

## Yêu cầu môi trường

- Node.js `>= 20`
- npm `>= 10`
- MongoDB (local hoặc container)
- Docker Desktop (khuyến nghị cho môi trường đồng nhất)

## Cài đặt và chạy local

1. Cài dependencies:
   - `npm install`
2. Tạo file môi trường:
   - copy `.env.example` thành `.env`
3. Nếu chạy MongoDB local, chỉnh:
   - `MONGODB_URI=mongodb://127.0.0.1:27017/bongdangoaihang`
4. Chạy dev server:
   - `npm run dev`
5. Chạy production mode:
   - `npm start`

## Chạy bằng Docker

1. Tạo `.env` từ `.env.example`
2. Build và khởi động:
   - `docker compose up -d --build`
3. Theo dõi log:
   - `docker compose logs -f`
4. Dừng dịch vụ:
   - `docker compose down`

### Chạy production image

- Dùng file `docker-compose.prod.yml`:
  - `IMAGE_URI=<ecr-image-uri> docker compose -f docker-compose.prod.yml up -d`

## Test tự động

- Chạy toàn bộ test:
  - `npm test`

Test hiện tại bao phủ các luồng cốt lõi:
- Healthcheck API
- Standings API
- Auth fallback khi blog DB chưa sẵn sàng
- Render trang chủ
- Render route SPA (`/lich-dau/lich-hom-nay`)

## Ingestion dữ liệu

- Chạy scraper fixtures:
  - `npm run ingestion:scrape-fixtures`
- File output:
  - `data/ingestion/all_leagues_fixtures.json`

## Biến môi trường chính

- `PORT`: Cổng chạy ứng dụng
- `MONGODB_URI`: Chuỗi kết nối MongoDB
- `JWT_SECRET`: Khóa ký JWT
- `MATCH_PROVIDER`: `auto` hoặc `football-data`
- `FOOTBALL_DATA_API_KEY`: API key Football-Data.org
- `FOOTBALL_DATA_COMPETITIONS`: Danh sách giải đấu cần lấy dữ liệu
- `SCRAPE_INTERVAL_MS`: Chu kỳ refresh dữ liệu trận đấu

## Vận hành và bảo trì

- Checklist migration: `tools/migration-checklist.md`
- Khi thay đổi cấu trúc hoặc provider, luôn chạy lại:
  - `npm test`
- Với môi trường production, ưu tiên chạy qua Docker để đồng nhất runtime.

## Bộ file triển khai AWS

- `buildspec.yml`: cấu hình CodeBuild build + push image lên ECR
- `appspec.yml`: cấu hình CodeDeploy cho EC2
- `scripts/deploy-ec2.sh`: deploy image mới lên EC2 bằng Docker Compose
- `scripts/rollback-ec2.sh`: rollback image trước đó
- `scripts/codedeploy-start.sh`: hook start cho CodeDeploy
- `docker-compose.prod.yml`: compose production dùng image từ ECR
- `nginx/aws-site.conf`: cấu hình Nginx reverse proxy mẫu

