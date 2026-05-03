#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/ec2-user/app/BongDaNgoaiHang.Com"
cd "$APP_DIR"

if [[ ! -f image-uri.txt ]]; then
  echo "image-uri.txt not found in deployment bundle"
  exit 1
fi

IMAGE_URI="$(cat image-uri.txt)"
export IMAGE_URI
export AWS_REGION="${AWS_REGION:-ap-southeast-1}"

bash scripts/deploy-ec2.sh
