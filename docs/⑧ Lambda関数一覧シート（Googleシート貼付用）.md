# **⑧ Lambda関数一覧シート（Googleシート貼付用）**

# **\===============================================**

| 関数名 | 役割 | 入力 | 出力 |
| ----- | ----- | ----- | ----- |
| getProperties | 一覧取得 | QueryString | 物件一覧 |
| getProperty | 詳細取得 | propertyId | 物件情報 |
| createProperty | 新規登録 | JSON | success |
| updateProperty | 更新 | JSON | success |
| deleteProperty | 削除 | propertyId | success |
| getUploadUrl | 署名URL | propertyId, fileType | uploadUrl |
| bulkUpload | 一括登録 | S3トリガー | DB登録 \+ エラーCSV |

---

