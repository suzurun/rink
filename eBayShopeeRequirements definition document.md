# **\=========================================================**

# **\*\*完全版要件定義書**

（Shopee & eBay 連携／相場リサーチ／利益計算／出品テンプレ生成／最終ボタン出品）\*\*

# **\=========================================================**

---

# **0\. 前提**

## **■ 抽出した前提**

* 日本の卸から商品を仕入れる

* 販売先は海外（Shopee, eBay）

* ユーザーはSKU単位で商品を登録

* システムが相場調査・利益計算・出品テンプレ生成まで自動化

* 最後の「出品実行」だけユーザーが押す → APIで投稿

* 日本→各国の送料・手数料・為替などを含めた利益評価

* Shopee / eBay のどちらに出すべきかの判定を自動化

* 必要なのは「半自動出品」＝安全性と自動化のバランス重視

## **■ ターゲット**

* 越境EC初心者〜中級者

* 卸仕入れを海外で販売する個人/事業者

* 利益計算と出品作業を自動化したいセラー

## **■ ユースケース**

1. SKU を登録する

2. 相場ボタンを押す → Shopee/eBay 相場取得

3. 利益ボタンを押す → 自動利益計算

4. AI が「Shopee向き / eBay向き / 微妙」を自動判定

5. 出品テンプレート（タイトル・説明・価格）を自動生成

6. ユーザーが内容を確認し「Shopeeに出品」「eBayに出品」を押す

7. API経由で出品処理

8. 出品履歴に保存される

## **■ 制約条件**

* Shopee Partner API 必須（署名生成が必要）

* eBay Official API（Finding / Trading / Inventory）

* レート制限に従う必要がある

* 初期は1ユーザー前提（後でSaaS化可能）

* 出品操作はリスク回避のため手動

---

# **1\. 全体アーキテクチャ（テキスト図）**

`┌───────────────────────────────┐`  
 `│            Web UI              │`  
 `│ - ログイン／設定                │`  
 `│ - 商品登録／一覧                │`  
 `│ - 商品詳細（相場・利益・出品）  │`  
 `│ - 推奨市場一覧                  │`  
 `│ - 出品履歴                      │`  
 `└───────────────▲───────────────┘`  
                     `│ REST API`  
 `┌───────────────────┴───────────────────┐`  
 `│          Backend Orchestrator          │`  
 `│ - Auth / UserService                   │`  
 `│ - ProductService                       │`  
 `│ - MarketResearchService                │`  
 `│     ├─ ShopeeClient                    │`  
 `│     └─ EbayClient                      │`  
 `│ - ProfitCalculator                     │`  
 `│ - RecommendationEngine                 │`  
 `│ - ListingTemplateService               │`  
 `│ - ListingService (Shopee/eBay出品)      │`  
 `└───────────────────▲───────────────────┘`  
                     `│`  
        `┌────────────┴────────────┐`  
        `│   Shopee Partner API     │`  
        `│   eBay Official API      │`  
        `│   FX Rate API(任意)       │`  
        `└────────────┬────────────┘`  
                     `│`  
        `┌────────────▼────────────┐`  
        `│           DB              │`  
        `│ - users                   │`  
        `│ - settings                │`  
        `│ - products                │`  
        `│ - market_research         │`  
        `│ - profit_estimations      │`  
        `│ - listings                │`  
        `└───────────────────────────┘`

---

# **2\. 画面構成**

## **■ 画面一覧（全10画面）**

1. ログイン

2. ダッシュボード（概要）

3. 仕入れ商品登録

4. 仕入れ商品一覧

5. 商品詳細（相場取得＋利益計算＋出品準備）

6. 市場別レコメンド一覧

7. 出品履歴一覧

8. 設定（基本設定：利益率・送料・為替）

9. 設定（モール設定：APIキー）

10. 一括相場取得画面（任意）

---

## **■ 画面遷移図（テキスト）**

`[ログイン]`  
   `│`  
   `▼`  
`[ダッシュボード]`  
   `│`  
   `├→ [商品一覧] → [商品詳細]`  
   `│                     │`  
   `│                     ├ 相場取得`  
   `│                     ├ 利益計算`  
   `│                     ├ 出品テンプレ生成`  
   `│                     └ Shopee/eBay出品`  
   `│`  
   `├→ [市場別レコメンド]`  
   `│`  
   `├→ [出品履歴]`  
   `│`  
   `└→ [設定]`

---

# **3\. API / モジュール仕様（I/O詳細）**

ここは「そのまま実装できる」レベルで具体化します。

---

## **■ 3-1. 商品管理**

### **● POST `/api/products`**

`{`  
  `"sku": "ABC-1001",`  
  `"name": "Bluetooth Earphone",`  
  `"purchasePriceJPY": 1500,`  
  `"stock": 10,`  
  `"imageUrl": "https://..."`  
`}`

**Output**

`{`  
  `"status": "ok",`  
  `"productId": "p_123"`  
`}`

### **● GET `/api/products`**

`{`  
  `"items": [`  
    `{`  
      `"productId": "p_123",`  
      `"sku": "ABC-1001",`  
      `"name": "Earphone",`  
      `"purchasePriceJPY": 1500,`  
      `"marginShopee": 0.28,`  
      `"marginEbay": 0.15,`  
      `"recommendedMarket": "shopee"`  
    `}`  
  `]`  
`}`

---

## **■ 3-2. 相場リサーチ**

### **● POST `/api/market/shopee/search`**

`{`  
  `"productId": "p_123",`  
  `"market": "SG",`  
  `"keyword": "Bluetooth earphone japan"`  
`}`

**Output**

`{`  
  `"avgPrice": 25.0,`  
  `"minPrice": 20.0,`  
  `"maxPrice": 30.0,`  
  `"soldCount": 120,`  
  `"rating": 4.6,`  
  `"currency": "SGD"`  
`}`

---

### **● POST `/api/market/ebay/search`**

`{`  
  `"productId": "p_123",`  
  `"site": "US",`  
  `"keyword": "bluetooth earphone japan"`  
`}`

**Output**

`{`  
  `"avgPrice": 19.0,`  
  `"minPrice": 15.0,`  
  `"maxPrice": 23.0,`  
  `"avgShipping": 8.0,`  
  `"currency": "USD"`  
`}`

---

## **■ 3-3. 利益計算 ＋ 市場判定**

### **● POST `/api/profit/calc`**

**Input**

`{`  
  `"productId": "p_123",`  
  `"paramsShopee": {"sellPriceLocal": 26.0},`  
  `"paramsEbay": {"sellPriceLocal": 20.0}`  
`}`

**Output**

`{`  
  `"shopee": {`  
    `"profitLocal": 1.33,`  
    `"margin": 0.051,`  
    `"label": "AVOID"`  
  `},`  
  `"ebay": {`  
    `"profitLocal": 3.10,`  
    `"margin": 0.18,`  
    `"label": "BORDER"`  
  `},`  
  `"recommendedMarket": "ebay"`  
`}`

**内部処理**

* 仕入れ(円)＋送料(円)

* → 為替変換

* → 手数料、その他コスト計算

* → 利益・利益率

* → 判定ロジック

  * 利益率≥(最低利益＋10%) → RECOMMENDED

  * 利益率≥最低利益 → BORDER

  * それ未満 → AVOID

---

## **■ 3-4. 出品テンプレート生成**

### **● POST `/api/listing/template`**

**Output**

`{`  
  `"title": "【Japan Quality】Bluetooth Earphone",`  
  `"description": "・日本国内の正規卸仕入れ...\n・高品質...\n",`  
  `"priceLocal": 26.0,`  
  `"stock": 5,`  
  `"categoryId": "123456"`  
`}`

---

## **■ 3-5. 出品API（最後のボタンで発火）**

### **● POST `/api/shopee/publish`**

`{`  
  `"productId": "p_123",`  
  `"market": "SG",`  
  `"title": "...",`  
  `"description": "...",`  
  `"priceLocal": 26.0,`  
  `"stock": 5`  
`}`

**Output**

`{`  
  `"status": "success",`  
  `"listingId": "SHOPEE_ITEM_ID",`  
  `"listingUrl": "https://shopee.sg/item/..."`  
`}`

---

### **● POST `/api/ebay/publish`**

**Output**

`{`  
  `"status": "success",`  
  `"listingId": "EBAY_ITEM_ID",`  
  `"listingUrl": "https://ebay.com/itm/..."`  
`}`

---

# **4\. シーケンス図（2つ）**

---

## **■ 4-1. 相場 → 利益 → テンプレ生成**

`User`  
 `│ register product`  
 `▼`  
`Backend → DB`  
 `│`  
 `│ User clicks "Shopee相場取得"`  
 `▼`  
`Shopee API -> returns prices`  
 `▼`  
`Backend saves → market_research`  
 `│`  
 `│ User clicks "利益計算"`  
 `▼`  
`Backend calculates profit → saves → profit_estimations`  
 `│`  
 `│ User clicks "出品テンプレ生成"`  
 `▼`  
`Backend builds template → returns to UI`  
 `│`  
`User sees template`

---

## **■ 4-2. 出品ボタン押下 → 出品処理 → 履歴保存**

`User clicks "Shopeeに出品する"`  
 `▼`  
`UI → POST /api/shopee/publish`  
 `▼`  
`Backend → Shopee API`  
        `→ success or fail`  
 `▼`  
`Backend saves result to listings`  
 `▼`  
`UI shows success URL`  
 `▼`  
`User`

---

# **5\. 実行計画（6フェーズ）**

| Phase | 内容 | 納品物 | 期間 |
| ----- | ----- | ----- | ----- |
| 1 | 基盤（API/DB/認証） | Auth, DB, Settings | 1-2週 |
| 2 | 仕入れ商品管理 | products CRUD | 1-2週 |
| 3 | 相場リサーチ | Shopee/eBay API連携 | 2-3週 |
| 4 | 利益計算 | ProfitCalculator/判定 | 2週 |
| 5 | 出品テンプレ＆出品API | Shopee/eBay publish | 2-3週 |
| 6 | UI完成/統合テスト | 全画面＋E2E | 2週 |

**想定： 約10〜14週間**

---

# **6\. タスク分解（40タスク完全版）**

（※このまま GitHub Issue に登録できる粒度）

---

## **● 基盤（6件）**

* T-001 FastAPI/Next.js プロジェクト作成

* T-002 DBマイグレーション設定

* T-003 users テーブル作成

* T-004 settings テーブル作成

* T-005 認証API

* T-006 ログインUI

---

## **● 商品管理（6件）**

* T-010 products テーブル作成

* T-011 商品登録API

* T-012 商品一覧API

* T-013 商品詳細API

* T-014 商品登録UI

* T-015 商品一覧UI（推奨市場表示）

---

## **● Shopee相場（5件）**

* T-020 Shopee API認証準備

* T-021 ShopeeClient 実装

* T-022 market\_research テーブル

* T-023 Shopee相場API

* T-024 UIボタン実装

---

## **● eBay相場（5件）**

* T-030 eBay Credentials 設定

* T-031 EbayClient 実装

* T-032 eBay相場API

* T-033 レスポンス正規化

* T-034 UIボタン

---

## **● 利益計算＆判定（7件）**

* T-040 ProfitCalculator

* T-041 profit\_estimations テーブル

* T-042 利益計算API

* T-043 RecommendationEngine

* T-044 設定取得ロジック

* T-045 利益UI（商品詳細）

* T-046 一覧に推奨市場を表示

---

## **● 出品テンプレ＆出品API（10件）**

* T-050 ListingTemplateService（Shopee）

* T-051 ListingTemplateService（eBay）

* T-052 listings テーブル

* T-053 テンプレ生成API

* T-054 Shopee publish 実装

* T-055 eBay publish 実装

* T-056 出品APIレスポンス保存

* T-057 例外処理（エラー保存）

* T-058 出品プレビューUI

* T-059 出品ボタンUI

---

## **● 出品履歴＆設定（4件）**

* T-070 出品履歴API

* T-071 出品履歴UI

* T-072 settings API

* T-073 設定UI（利益率/送料/為替/手数料）

---

## **● QA/運用（4件）**

* T-080 利益計算テスト

* T-081 市場判定テスト

* T-082 API結合テスト

* T-083 E2Eテスト

---

# **7\. まとめ**

### **■ 実現できること**

* SKU登録 → 相場取得 → 利益計算 → 市場判定 → 出品テンプレ生成 → 最後のボタンで出品

* Shopee/eBay 両方へ出品対応

* 出品履歴管理

* 一連の越境ECを半自動化

### **■ 技術的特徴**

* Shopee & eBay の両API連携

* 相場取得〜出品直前まで完全自動

* 出品はワンクリックで安全性確保

* 将来の自動出品や在庫同期への拡張が容易

### **■ 推奨アーキテクチャ**

* Backend：FastAPI

* Frontend：Next.js

* DB：PostgreSQL

* Shopee Partner API / eBay API

* 将来は Celery \+ Queue で大規模バッチも可能

