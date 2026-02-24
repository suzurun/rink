# 不動産動画自動生成システム

海外投資家向け不動産紹介動画を自動生成するWebアプリケーションです。

## 機能

- **URL一括登録**: 物件URLを一括で登録してスクレイピング
- **物件管理**: 取得した物件情報の閲覧・編集
- **多言語翻訳**: 英語・中国語（簡体/繁体）への自動翻訳
- **投資指標計算**: 表面/実質利回り、空室率などの自動計算
- **動画生成**: 本編動画（4-5分）およびShort動画（30-60秒）の生成

## 技術スタック

- **フロントエンド**: Next.js 14 + React + TypeScript + Tailwind CSS
- **データベース**: SQLite (Prisma ORM)
- **UI**: カスタムコンポーネント + Lucide Icons

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. データベースの初期化

```bash
npx prisma generate
npx prisma db push
```

### 3. サンプルデータの投入（オプション）

```bash
npm run db:seed
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開いてください。

## 画面構成

1. **ダッシュボード** (`/`) - システム全体の状況確認
2. **URL一括登録** (`/urls/register`) - URLの一括登録
3. **URLステータス** (`/urls`) - URLの処理状況確認
4. **物件一覧** (`/properties`) - 登録物件の一覧
5. **物件詳細** (`/properties/[id]`) - 物件の詳細情報・編集
6. **翻訳管理** (`/translations`) - 翻訳状況の確認
7. **投資情報** (`/investments`) - 投資指標の一覧
8. **動画管理** (`/videos`) - 生成動画の管理
9. **設定** (`/settings`) - システム設定

## API エンドポイント

- `POST /api/urls/batch` - URL一括登録
- `POST /api/urls/[id]/retry` - URL再試行
- `POST /api/properties/[id]/translate` - 翻訳生成
- `POST /api/properties/[id]/calculate` - 投資指標計算
- `POST /api/properties/[id]/generate-video` - 動画生成

## ライセンス

MIT

