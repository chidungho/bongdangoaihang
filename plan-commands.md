# Hướng Dẫn Lệnh Triển Khai AWS (Tiếng Việt)

Tài liệu này đi kèm `plan.md`, tập trung vào các lệnh triển khai thực tế theo thứ tự.

## 0) Chuẩn bị máy local

Yêu cầu cài sẵn:
- AWS CLI v2
- Docker Desktop
- Git
- Node.js >= 20

Kiểm tra:

```bash
aws --version
docker --version
node -v
npm -v
```

## 1) Cấu hình AWS CLI

```bash
aws configure
```

Nhập:
- Access Key ID
- Secret Access Key
- Region (ví dụ: `ap-southeast-1`)
- Output: `json`

Kiểm tra account:

```bash
aws sts get-caller-identity
```

## 2) Tạo key pair + security group cho EC2

### 2.1 Tạo key pair
```bash
aws ec2 create-key-pair --key-name bongdangoaihang-key --query 'KeyMaterial' --output text > bongdangoaihang-key.pem
```

### 2.2 Tạo security group
```bash
aws ec2 create-security-group --group-name bongdangoaihang-sg --description "SG for BongDaNgoaiHang"
```

Lưu lại `GroupId`, sau đó mở cổng:

```bash
aws ec2 authorize-security-group-ingress --group-id <SG_ID> --protocol tcp --port 22 --cidr <YOUR_IP>/32
aws ec2 authorize-security-group-ingress --group-id <SG_ID> --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id <SG_ID> --protocol tcp --port 443 --cidr 0.0.0.0/0
```

## 3) Tạo EC2 và deploy app bằng Docker

### 3.1 Run instance (Amazon Linux 2023)
```bash
aws ec2 run-instances \
  --image-id <AMI_ID_AL2023> \
  --instance-type t3.micro \
  --key-name bongdangoaihang-key \
  --security-group-ids <SG_ID> \
  --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":20,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=BongDaNgoaiHang-EC2}]'
```

Lấy public IP:

```bash
aws ec2 describe-instances --filters "Name=tag:Name,Values=BongDaNgoaiHang-EC2" "Name=instance-state-name,Values=running" --query "Reservations[*].Instances[*].PublicIpAddress" --output text
```

### 3.2 SSH vào EC2
```bash
chmod 400 bongdangoaihang-key.pem
ssh -i bongdangoaihang-key.pem ec2-user@<EC2_PUBLIC_IP>
```

### 3.3 Cài Docker + Compose plugin
```bash
sudo dnf update -y
sudo dnf install -y docker git nginx
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ec2-user
newgrp docker
```

### 3.4 Clone project và chạy
```bash
git clone <YOUR_GITHUB_REPO_URL> app
cd app/BongDaNgoaiHang.Com
cp .env.example .env
```

Sửa `.env` production:
- `NODE_ENV=production`
- `PORT=3000`
- `MONGODB_URI=<MongoDB_Atlas_URI>`
- `JWT_SECRET=<secret_manh>`

Run:
```bash
docker compose up -d --build
docker compose ps
```

## 4) Cấu hình Nginx reverse proxy trên EC2

Tạo file:

```bash
sudo tee /etc/nginx/conf.d/bongdangoaihang.conf > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

## 5) Tạo ECR và push image

### 5.1 Tạo repository
```bash
aws ecr create-repository --repository-name bongdangoaihang-app
```

### 5.2 Login ECR
```bash
aws ecr get-login-password --region <REGION> | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com
```

### 5.3 Build/tag/push
```bash
docker build -t bongdangoaihang-app .
docker tag bongdangoaihang-app:latest <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/bongdangoaihang-app:latest
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/bongdangoaihang-app:latest
```

## 6) Tạo S3 bucket cho static/backup

```bash
aws s3 mb s3://<TEN_BUCKET_DUY_NHAT>
aws s3 cp ./public/data/public_api_data.json s3://<TEN_BUCKET_DUY_NHAT>/backups/public_api_data.json
```

## 7) CloudWatch logs cơ bản

Tạo log group:

```bash
aws logs create-log-group --log-group-name /bongdangoaihang/app
aws logs put-retention-policy --log-group-name /bongdangoaihang/app --retention-in-days 7
```

## 8) SNS cảnh báo

### 8.1 Tạo topic
```bash
aws sns create-topic --name bongdangoaihang-alerts
```

### 8.2 Subscribe email
```bash
aws sns subscribe --topic-arn <TOPIC_ARN> --protocol email --notification-endpoint <EMAIL_CUA_BAN>
```

## 9) EventBridge + Lambda (refresh data theo lịch)

### 9.1 Tạo rule chạy mỗi 10 phút
```bash
aws events put-rule --name bongdangoaihang-refresh-10m --schedule-expression "rate(10 minutes)"
```

### 9.2 Lambda
- Tạo Lambda (Node.js 20.x) qua Console hoặc CLI.
- Function gọi endpoint refresh của app, ví dụ:
  - `GET https://<DOMAIN>/api/matches?refresh=true`

Gợi ý code Lambda:

```javascript
export const handler = async () => {
  const res = await fetch("https://<DOMAIN>/api/matches?refresh=true");
  return { statusCode: res.status };
};
```

## 10) CI/CD tối thiểu (CodePipeline)

Khuyến nghị làm nhanh qua AWS Console:
- Source: GitHub
- Build: CodeBuild (`docker build` + `docker push ECR`)
- Deploy: SSM command tới EC2 để pull image mới và restart container

Lệnh deploy trên EC2 (SSM hoặc SSH):

```bash
aws ecr get-login-password --region <REGION> | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com
docker pull <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/bongdangoaihang-app:latest
cd ~/app/BongDaNgoaiHang.Com
docker compose down
docker compose up -d
```

## 11) Kiểm soát chi phí hằng ngày

- Kiểm tra Billing dashboard mỗi ngày.
- Kiểm tra Cost Explorer theo service.
- Nếu vượt ngưỡng: giảm instance xuống `t3.micro`, giảm retention log, tạm dừng dịch vụ không cần thiết.

## 12) Checklist hoàn tất

- [ ] Website chạy ổn qua domain HTTPS
- [ ] Có log và cảnh báo email
- [ ] Có job tự cập nhật dữ liệu
- [ ] Có pipeline CI/CD chạy thành công
- [ ] Chi phí vẫn trong ngưỡng mục tiêu
