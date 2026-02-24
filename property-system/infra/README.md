# Property System Infrastructure (AWS CDK)

不動産建築会社向け施工情報管理システムの AWS インフラストラクチャ定義です。

## 前提条件

- Node.js 18.x 以上
- AWS CLI（設定済み）
- AWS アカウント

## 構成リソース

| リソース | サービス | 説明 |
|---------|---------|------|
| PropertyUserPool | Cognito | ユーザー認証（メールログイン） |
| PropertiesTable | DynamoDB | 物件データベース + 3 GSI |
| PropertyBucket | S3 | 物件ファイル保存 |
| FrontendBucket | S3 | フロントエンドホスティング |
| PropertyApi | API Gateway | REST API |
| Lambda Functions | Lambda | API 処理（8関数） |
| FrontendDistribution | CloudFront | フロントエンド配信 |

## クイックスタート

### 1. 依存パッケージのインストール

```bash
cd property-system/infra
npm install
```

### 2. AWS 認証情報の確認

```bash
aws sts get-caller-identity
```

### 3. CDK ブートストラップ（初回のみ）

```bash
npm run bootstrap
# または
npx cdk bootstrap aws://ACCOUNT_ID/ap-northeast-1
```

### 4. デプロイ

```bash
# 開発環境
npm run deploy:dev

# 本番環境
npm run deploy:prod
```

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `npm install` | 依存パッケージインストール |
| `npm run build` | TypeScript コンパイル |
| `npm run synth` | CloudFormation テンプレート生成 |
| `npm run diff` | 変更差分の確認 |
| `npm run deploy` | 全スタックデプロイ |
| `npm run deploy:dev` | 開発環境デプロイ |
| `npm run deploy:prod` | 本番環境デプロイ |
| `npm run destroy` | 全スタック削除 |
| `npm run bootstrap` | CDK ブートストラップ |

## 環境変数

| 変数 | 説明 | デフォルト |
|-----|------|-----------|
| `CDK_DEFAULT_ACCOUNT` | AWS アカウント ID | - |
| `CDK_DEFAULT_REGION` | AWS リージョン | ap-northeast-1 |

## 出力値

デプロイ後、以下の値が出力されます：

```
Outputs:
PropertySystemStack-dev.UserPoolId = ap-northeast-1_XXXXXXXXX
PropertySystemStack-dev.UserPoolClientId = xxxxxxxxxxxxxxxxxxxx
PropertySystemStack-dev.ApiEndpoint = https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/dev/
PropertySystemStack-dev.PropertyBucketName = property-system-files-dev-123456789012
PropertySystemStack-dev.FrontendBucketName = property-system-frontend-dev-123456789012
PropertySystemStack-dev.CloudFrontUrl = https://dxxxxxxxxxxxxx.cloudfront.net
PropertySystemStack-dev.DynamoDBTableName = Properties-dev
```

## フォルダ構成

```
infra/
├── lib/
│   ├── index.ts                  # CDK エントリーポイント
│   └── property-system-stack.ts  # メインスタック定義
├── cdk.json                      # CDK 設定
├── package.json                  # 依存関係
├── tsconfig.json                 # TypeScript 設定
├── .gitignore
└── README.md
```

## トラブルシューティング

### エラー: `CDK bootstrap required`

```bash
npm run bootstrap
```

### エラー: `Resource already exists`

同名のリソースが既に存在する場合、環境名を変更するか既存リソースを削除してください。

```bash
# 別の環境名でデプロイ
npx cdk deploy --context env=dev2
```

### エラー: `EACCES permission denied`

npm キャッシュの権限問題：

```bash
sudo chown -R $(whoami) ~/.npm
```

## Lambda 関数

| 関数名 | エンドポイント | 説明 |
|--------|--------------|------|
| getProperties | GET /properties | 物件一覧 |
| getProperty | GET /properties/{id} | 物件詳細 |
| createProperty | POST /properties | 物件登録 |
| updateProperty | PUT /properties/{id} | 物件更新 |
| deleteProperty | DELETE /properties/{id} | 物件削除 |
| getUploadUrl | POST /upload-url | 署名付きURL |
| bulkUpload | POST /properties/bulk | 一括登録 |
| getFiles | GET /properties/{id}/files | ファイル一覧 |

## 次のステップ

1. デプロイ完了後、Cognito で最初の管理者ユーザーを作成
2. フロントエンドをビルドして S3 にアップロード
3. CloudFront URL でアクセス確認cloude
