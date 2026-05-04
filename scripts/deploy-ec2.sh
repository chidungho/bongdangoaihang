#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/ec2-user/app/BongDaNgoaiHang.Com"
cd "$APP_DIR"

if [[ -z "${IMAGE_URI:-}" ]]; then
  echo "IMAGE_URI is required"
  exit 1
fi

export IMAGE_URI

CURRENT_IMAGE_URI="$(docker inspect --format='{{index .Config.Image}}' bongdangoaihang-app 2>/dev/null || true)"
if [[ -n "$CURRENT_IMAGE_URI" ]]; then
  echo "$CURRENT_IMAGE_URI" > .previous-image-uri
fi

if command -v aws >/dev/null 2>&1; then
  REGION="${AWS_REGION:-ap-southeast-1}"
  ACCOUNT_IMAGE_HOST="$(echo "$IMAGE_URI" | cut -d/ -f1)"
  aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ACCOUNT_IMAGE_HOST"
fi

docker compose -f docker-compose.prod.yml pull app
docker compose -f docker-compose.prod.yml up -d app
docker image prune -af --filter "until=168h" || true
