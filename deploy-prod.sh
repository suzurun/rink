#!/bin/bash
# 本番環境へのデプロイ（バックエンド + フロントエンド）
set -e
cd "$(dirname "$0")/property-system/frontend"
if [ ! -d out ]; then
  echo "エラー: out/ がありません。先に build-prod.sh を実行してください。"
  exit 1
fi
cd ../infra
npx cdk deploy PropertySystemStack-prod \
  --context env=prod \
  --require-approval never
