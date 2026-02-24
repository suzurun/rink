#!/bin/bash
set -e

# ===========================================
# Property System デプロイスクリプト
# ===========================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_NAME="${1:-dev}"

echo "=============================================="
echo "Property System Deploy - Environment: $ENV_NAME"
echo "=============================================="

# 色付き出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_step() {
  echo -e "\n${GREEN}▶ $1${NC}"
}

print_warn() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

# ===========================================
# 1. 前提条件チェック
# ===========================================
print_step "前提条件チェック..."

# Node.js
if ! command -v node &> /dev/null; then
  print_error "Node.js がインストールされていません"
  exit 1
fi
echo "  Node.js: $(node -v)"

# AWS CLI
if ! command -v aws &> /dev/null; then
  print_error "AWS CLI がインストールされていません"
  exit 1
fi
echo "  AWS CLI: $(aws --version | cut -d' ' -f1)"

# AWS 認証チェック
if ! aws sts get-caller-identity &> /dev/null; then
  print_error "AWS 認証情報が設定されていません"
  echo "  aws configure を実行してください"
  exit 1
fi
echo "  AWS Account: $(aws sts get-caller-identity --query Account --output text)"

# ===========================================
# 2. インフラ依存パッケージインストール
# ===========================================
print_step "インフラ依存パッケージインストール..."
cd "$SCRIPT_DIR/infra"
npm install

# ===========================================
# 3. CDK Bootstrap（初回のみ）
# ===========================================
print_step "CDK Bootstrap チェック..."
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-ap-northeast-1}

if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region $REGION &> /dev/null; then
  print_warn "CDK Bootstrap が必要です。実行中..."
  npx cdk bootstrap aws://$ACCOUNT/$REGION
fi

# ===========================================
# 4. フロントエンド依存パッケージインストール
# ===========================================
print_step "フロントエンド依存パッケージインストール..."
cd "$SCRIPT_DIR/frontend"
npm install

print_warn "フロントエンドは動的ルートがあるため、静的ビルドをスキップします。"
print_warn "開発時は 'npm run dev' を使用してください。"
print_warn "本番デプロイには Vercel または AWS Amplify を推奨します。"

# ===========================================
# 5. CDK デプロイ
# ===========================================
print_step "CDK デプロイ..."
cd "$SCRIPT_DIR/infra"
npx cdk deploy --all --context env=$ENV_NAME --require-approval never

# ===========================================
# 6. 出力値の取得
# ===========================================
print_step "デプロイ完了！出力値を取得中..."

STACK_NAME="PropertySystemStack-$ENV_NAME"

# CloudFormation から出力値を取得
API_ENDPOINT=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text 2>/dev/null || echo "")
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text 2>/dev/null || echo "")
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text 2>/dev/null || echo "")
CLOUDFRONT_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" --output text 2>/dev/null || echo "")

echo ""
echo "=============================================="
echo "デプロイ完了！"
echo "=============================================="
echo ""
echo "📌 重要な値:"
echo "  API Endpoint:      $API_ENDPOINT"
echo "  User Pool ID:      $USER_POOL_ID"
echo "  User Pool Client:  $USER_POOL_CLIENT_ID"
echo "  CloudFront URL:    $CLOUDFRONT_URL"
echo ""
echo "📝 次のステップ:"
echo "  1. frontend/.env.local を作成し、上記の値を設定"
echo "  2. npm run build で再ビルド"
echo "  3. npm run deploy で再デプロイ"
echo "  4. AWS Console で Cognito ユーザーを作成"
echo ""
echo "=============================================="




