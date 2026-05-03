# Kế Hoạch Triển Khai AWS (Ngân sách <= 100 USD / 15 ngày)

## 1) Mục tiêu

- Triển khai `BongDaNgoaiHang.Com` lên AWS phục vụ môn Điện toán đám mây.
- Sử dụng nhiều dịch vụ AWS để tăng điểm phần kiến trúc và vận hành.
- Giữ tổng chi phí dưới 100 USD trong 15 ngày.
- Đảm bảo website ổn định, có giám sát và sẵn sàng demo.

## 2) Chiến lược ngân sách

- Mục tiêu chi: 60-70 USD.
- Dự phòng rủi ro: 30-40 USD.
- Tránh dịch vụ đắt trong giai đoạn này (NAT Gateway, ALB, DocumentDB).
- Ưu tiên lựa chọn rẻ/free khi có thể (MongoDB Atlas free tier, EC2 nhỏ).

## 3) Kiến trúc đề xuất (tối ưu chi phí)

- Route 53: DNS cho domain.
- CloudFront: CDN cho nội dung tĩnh.
- S3: lưu static hoặc backup/export dữ liệu.
- EC2 (1 instance): chạy app Node.js + Nginx reverse proxy (Docker).
- ECR: registry lưu Docker image.
- MongoDB Atlas (ngoài AWS): giảm chi phí database.
- CloudWatch + SNS: log, metrics, cảnh báo.
- EventBridge + Lambda: job cập nhật dữ liệu theo lịch.
- CodePipeline + CodeBuild + CodeDeploy: CI/CD tự động.

## 4) Kế hoạch triển khai theo giai đoạn

## Giai đoạn A - Nền tảng (Ngày 1-2)

- [ ] Tạo cảnh báo ngân sách AWS Billing (50%, 80%, 100%).
- [ ] Tạo IAM user/role theo nguyên tắc quyền tối thiểu.
- [ ] Chuẩn bị domain và hosted zone trong Route 53.
- [ ] Tạo EC2 (t3.micro hoặc t3.small), cấu hình Security Group:
  - 22 (giới hạn IP), 80, 443
- [ ] Cài Docker, Docker Compose, Nginx trên EC2.
- [ ] Deploy ứng dụng với file `.env` dùng cho production.

Tiêu chí hoàn thành:
- App truy cập được bằng public IP của EC2 và chạy ổn định 24 giờ.

## Giai đoạn B - Phân phối và HTTPS (Ngày 3)

- [ ] Tạo S3 bucket cho static/backup.
- [ ] Cấu hình CloudFront distribution:
  - origin: EC2 (hoặc tách origin EC2 + S3 static)
  - cache cho `/assets/*`, `/css/*`, `/js/*`
- [ ] Cấp SSL bằng ACM.
- [ ] Trỏ domain về CloudFront bằng bản ghi Route 53 A/AAAA (alias).

Tiêu chí hoàn thành:
- Website truy cập HTTPS bằng domain, chứng chỉ hợp lệ.

## Giai đoạn C - Quan sát hệ thống (Ngày 4)

- [ ] Cài CloudWatch agent trên EC2.
- [ ] Đẩy log app và log Nginx lên CloudWatch Logs.
- [ ] Tạo CloudWatch alarms:
  - CPU EC2 cao
  - Lỗi status check
  - Tăng đột biến 5xx (nếu có custom metric)
- [ ] Gửi cảnh báo qua SNS email.

Tiêu chí hoàn thành:
- Nhận được email cảnh báo trong kịch bản test alarm.

## Giai đoạn D - Cập nhật dữ liệu theo sự kiện/lịch (Ngày 5)

- [ ] Tạo Lambda function để trigger refresh dữ liệu.
- [ ] Tạo lịch EventBridge (mỗi 5-15 phút).
- [ ] Lambda gọi endpoint refresh của app hoặc cập nhật object cache trong S3.
- [ ] Ghi log kết quả/lỗi vào CloudWatch.

Tiêu chí hoàn thành:
- Job chạy tự động theo lịch, dữ liệu cập nhật không cần thao tác tay.

## Giai đoạn E - CI/CD (Ngày 6-7)

- [ ] Đưa source lên GitHub repository.
- [ ] Tạo ECR repository.
- [ ] Cấu hình CodeBuild build Docker image và push lên ECR.
- [ ] Cấu hình bước deploy EC2 bằng CodeDeploy/SSM.
- [ ] Cấu hình pipeline CodePipeline:
  - Source -> Build -> Deploy
- [ ] Thêm bước rollback (tag image trước đó) trong script deploy.

Tiêu chí hoàn thành:
- Mỗi commit lên nhánh chính tự động kích hoạt deploy.

## 5) Checklist tăng độ an toàn vận hành

- [ ] Lưu `JWT_SECRET` và API keys an toàn bằng SSM/Secrets Manager.
- [ ] Bật CORS whitelist chặt cho domain production.
- [ ] Giữ rate limiting ở trạng thái bật.
- [ ] Kiểm tra redirect HTTPS và security headers.
- [ ] Tắt các cổng inbound không dùng trong Security Group.
- [ ] Cấu hình thời gian lưu log 3-7 ngày để kiểm soát chi phí.

## 6) Quy tắc kiểm soát chi phí

- [ ] Không dùng NAT Gateway.
- [ ] Không dùng ALB trong phase ngân sách này.
- [ ] Không dùng DocumentDB/RDS multi-AZ managed.
- [ ] Chỉ chạy 1 EC2.
- [ ] Kiểm tra chi phí hằng ngày trong Billing dashboard.

## 7) Kịch bản demo nộp môn

- [ ] Trình bày sơ đồ kiến trúc và vai trò từng dịch vụ.
- [ ] Demo web chạy HTTPS bằng custom domain.
- [ ] Tạo một commit nhỏ và demo CI/CD tự deploy.
- [ ] Demo CloudWatch logs và 1 cảnh báo mẫu.
- [ ] Demo lịch EventBridge và lịch sử invoke Lambda.
- [ ] Giải thích cách kiểm soát chi phí để trụ trong 100 USD/15 ngày.

## 8) Hồ sơ bàn giao

- [ ] URL website live.
- [ ] Sơ đồ kiến trúc (PNG/PDF).
- [ ] Bảng dự toán chi phí + snapshot chi phí thực tế.
- [ ] Ảnh chụp CI/CD pipeline.
- [ ] Ảnh chụp monitoring/cảnh báo.
- [ ] Runbook vận hành ngắn (deploy/rollback/check health).

## 9) Nâng cấp tùy chọn (khi ngân sách còn an toàn)

- [ ] Bổ sung WAF rule cơ bản trước CloudFront.
- [ ] Thêm canary health checks.
- [ ] Thêm SQS giữa scheduler và worker để demo kiến trúc queue.
