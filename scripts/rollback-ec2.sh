#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/ec2-user/app/BongDaNgoaiHang.Com"
cd "$APP_DIR"

PREVIOUS_IMAGE_URI_FILE=".previous-image-uri"
if [[ ! -f "$PREVIOUS_IMAGE_URI_FILE" ]]; then
  echo "No rollback metadata found."
  exit 1
fi

IMAGE_URI="$(cat "$PREVIOUS_IMAGE_URI_FILE")"
export IMAGE_URI

docker compose -f docker-compose.prod.yml up -d app
