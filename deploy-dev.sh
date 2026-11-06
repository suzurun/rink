#!/bin/bash
# 練習用環境（dev）へのデプロイ（バックエンドのみ）
set -e
cd "$(dirname "$0")/property-system/infra"
npx cdk deploy PropertySystemStack-dev \
  --context env=dev \
  --context skipFrontend=true \
  --require-approval never
