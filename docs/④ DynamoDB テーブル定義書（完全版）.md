# **④ DynamoDB テーブル定義書（完全版）**

---

## **🔶 ▼ DynamoDB テーブル：Properties（物件テーブル）**

| 項目名 | データ型 | 必須 | 説明 |
| ----- | ----- | ----- | ----- |
| propertyId | string | ○ | 主キー（PK） |
| name | string | ○ | 物件名 |
| zipcode | string | ○ | 郵便番号 |
| prefecture | string | ○ | 都道府県 |
| city | string | ○ | 市区町村 |
| address | string | ○ | 番地（詳細住所） |
| lat | number | 任意 | 緯度 |
| lng | number | 任意 | 経度 |
| typeLarge | string | ○ | 大項目 |
| typeMedium | string | 任意 | 中項目 |
| typeSmall | string | 任意 | 小項目 |
| landUse | string | 任意 | 用途地域 |
| structure | string | 任意 | 建物構造（木造、S造など） |
| area | number | 任意 | 面積（㎡） |
| owner | string | 任意 | 施主名 |
| staff | string | 任意 | 担当者（社内） |
| deliveryDate | string | 任意 | 引渡予定日（YYYYMMDD） |
| memo | string | 任意 | 備考 |
| files | map | 任意 | 種類別ファイル一覧（S3パス） |
| createdAt | string | 自動 | 作成日時（ISO） |
| updatedAt | string | 自動 | 更新日時（ISO） |

---

# **📄 ▼ テーブル構造**

| 項目 | 値 |
| ----- | ----- |
| テーブル名 | Properties |
| パーティションキー（PK） | propertyId |
| ソートキー（SK） | なし |
| BillingMode | PAY\_PER\_REQUEST |
| バックアップ | PITR 有効（任意） |
| PK重複 | 許容しない（ユニーク制約） |

---

# **📄 ▼ GSI（Global Secondary Index）一覧**

以下もシートの別表として追加してください。

| GSI名 | パーティションキー | ソートキー | 用途 |
| ----- | ----- | ----- | ----- |
| name-index | typeLarge | name | 大項目 × 名称検索 |
| staff-index | staff | name | 担当者検索 |
| medium-index | typeMedium | name | 中項目検索 |

---

# **📄 ▼ レコード例（シートに貼ってOK）**

| propertyId | name | prefecture | city | address | typeLarge | typeMedium | staff | createdAt |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| P0001 | 大谷ビル | 福岡県 | 福岡市中央区 | 薬院1-1-1 | 工場 | 製造 | 佐藤 | 2024-01-01T00:00:00Z |

