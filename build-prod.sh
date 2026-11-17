#!/bin/bash
# 本番用フロントエンドのビルド
# .env.local に本番（prod）の設定が入っている前提。
# out/ に生成された内容がそのまま本番の画面になる。
set -e
cd "$(dirname "$0")/property-system/frontend"
echo "=== 使用する設定（本番かどうかの確認） ==="
grep -E "NEXT_PUBLIC_API_URL|USER_POOL_CLIENT_ID" .env.local | sed -E 's/(=.{8}).*/\1…/'
echo ""
echo "=== ビルド開始 ==="
rm -rf out
STATIC_EXPORT=true npm run build
echo ""
echo "=== 完了。生成されたページ ==="
ls out
