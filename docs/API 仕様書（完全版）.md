# **\=============================================**

# **📘 API SPECIFICATION (AWS Lambda \+ API Gateway)**

# **Version 1.0**

# **\=============================================**

---

# **🔐 認証方式（共通）**

* 全APIは AWS Cognito User Pool の JWT トークンを必須とする

* グループ（ロール）

  * `admin`

  * `internal`

  * `external`（物件APIはすべて禁止）

API Gateway の Cognito Authorizer を利用。

---

# **\=============================================**

# **🚀 1\. 物件一覧 API**

# **\=============================================**

### **GET /properties**

### **認可**

* internal / admin

* external → 403

### **Query Params（任意）**

| param | type | description |
| ----- | ----- | ----- |
| keyword | string | 名称・住所検索 |
| typeLarge | string | 大項目 |
| typeMedium | string | 中項目 |
| typeSmall | string | 小項目 |
| staff | string | 担当者 |
| page | number | ページ番号 |
| limit | number | 1ページ件数 |

### **Response（成功）**

`{`  
  `"status": "success",`  
  `"data": [`  
    `{`  
      `"propertyId": "P00001",`  
      `"name": "大谷ビル",`  
      `"prefecture": "福岡県",`  
      `"city": "福岡市中央区",`  
      `"address": "薬院1-1-1",`  
      `"typeLarge": "工場",`  
      `"staff": "佐藤",`  
      `"lat": 33.1,`  
      `"lng": 130.2`  
    `}`  
  `],`  
  `"page": 1,`  
  `"total": 120`  
`}`

---

# **\=============================================**

# **🚀 2\. 物件詳細 API**

# **\=============================================**

### **GET /properties/{propertyId}**

### **認可**

* internal / admin

* external → 403

### **Response**

`{`  
  `"status": "success",`  
  `"data": {`  
    `"propertyId": "P00001",`  
    `"name": "大谷ビル",`  
    `"zipcode": "8100004",`  
    `"prefecture": "福岡県",`  
    `"city": "福岡市中央区",`  
    `"address": "薬院1-1-1",`  
    `"lat": 33.583,`  
    `"lng": 130.394,`  
    `"typeLarge": "工場",`  
    `"typeMedium": "製造",`  
    `"typeSmall": "食品",`  
    `"structure": "木造",`  
    `"area": 200,`  
    `"owner": "山田太郎",`  
    `"staff": "佐藤",`  
    `"deliveryDate": "20231201",`  
    `"memo": "",`  
    `"files": {`  
      `"photo": [],`  
      `"drawing": [],`  
      `"pdf": [],`  
      `"movie": []`  
    `}`  
  `}`  
`}`

---

# **\=============================================**

# **🚀 3\. 物件登録 API**

# **\=============================================**

### **POST /properties**

### **Body**

`{`  
  `"propertyId": "P00001",`  
  `"name": "大谷ビル",`  
  `"prefecture": "福岡県",`  
  `"city": "福岡市中央区",`  
  `"address": "薬院1-1-1",`  
  `"lat": 33.583,`  
  `"lng": 130.394,`  
  `"typeLarge": "工場",`  
  `"typeMedium": "製造",`  
  `"typeSmall": "食品",`  
  `"structure": "木造",`  
  `"area": 200,`  
  `"staff": "佐藤",`  
  `"deliveryDate": "20231201"`  
`}`

### **認可**

* internal / admin

### **バリデーション**

* propertyId 重複 → 409

* name 必須

* typeLarge 必須

* zipcode / address 必須

---

# **\=============================================**

# **🚀 4\. 物件編集 API**

# **\=============================================**

### **PUT /properties/{propertyId}**

### **Body**

（POSTと同じ構造）

### **認可**

* internal / admin

---

# **\=============================================**

# **🚀 5\. 物件削除 API**

# **\=============================================**

### **DELETE /properties/{propertyId}**

* admin のみ許可

* S3の物件フォルダも削除

---

# **\=============================================**

# **🚀 6\. 署名付きURL発行（ファイルアップロード）**

# **\=============================================**

### **POST /upload-url**

### **Body**

`{`  
  `"propertyId": "P00001",`  
  `"fileType": "photo",`  
  `"fileName": "天井.jpg"`  
`}`

### **Response**

`{`  
  `"status": "success",`  
  `"uploadUrl": "https://s3...signed-url",`  
  `"finalUrl": "s3://bucket/property/P00001/photo/天井.jpg"`  
`}`

---

# **\=============================================**

# **🚀 7\. 一括登録（Excel/CSV）**

# **\=============================================**

### **POST /properties/bulk**

### **認可**

* admin

### **Response**

`{`  
  `"status": "success",`  
  `"successCount": 120,`  
  `"errorCount": 5,`  
  `"errorFileUrl": "https://s3/.../errors.csv"`  
`}`

---

# **\=============================================**

# **🚀 8\. ファイル一覧 API（物件別）**

# **\=============================================**

### **GET /properties/{propertyId}/files**

### **Response**

`{`  
  `"status": "success",`  
  `"data": {`  
    `"photo": [`  
      `{ "name": "天井.jpg", "url": "signed-url" }`  
    `],`  
    `"pdf": [],`  
    `"drawing": [],`  
    `"movie": []`  
  `}`  
`}`

---

# **\=============================================**

# **② DynamoDB テーブル定義書**

# **\=============================================**

| 項目 | 内容 |
| ----- | ----- |
| テーブル名 | Properties |
| 主キー | PK \= propertyId |
| GSI | 必要になれば追加（例：担当者検索・大項目検索など） |
| バックアップ | PITR 有効 |
| データ形式 | JSON（スキーマレス） |

### **項目一覧（型）**

`propertyId: string (PK)`  
`name: string`  
`zipcode: string`  
`prefecture: string`  
`city: string`  
`address: string`  
`lat: number`  
`lng: number`  
`typeLarge: string`  
`typeMedium: string`  
`typeSmall: string`  
`landUse: string`  
`structure: string`  
`area: number`  
`owner: string`  
`staff: string`  
`deliveryDate: string`  
`memo: string`  
`files: map`  
`createdAt: string (ISO)`  
`updatedAt: string (ISO)`

---

# **\=============================================**

# **③ S3フォルダ構成（完全版）**

# **\=============================================**

バケット名例：  
 `property-system-prod`

`s3://property-system-prod/`  
  `property/`  
    `{propertyId}/`  
      `photo/`  
      `pdf/`  
      `drawing/`  
      `movie/`  
      `others/`

ファイル名仕様

* 日本語OK

* ソートはあいうえお順

* 配列はLambda側でソートして返す

---

# **\=============================================**

# **④ Cursor プロジェクト構造案**

# **\=============================================**

---

## **🔧 backend/**

`backend/`  
  `package.json`  
  `tsconfig.json`  
  `common/`  
    `dynamo.ts`  
    `s3.ts`  
    `auth.ts`  
    `response.ts`  
  `lambdas/`  
    `getProperties/`  
      `index.ts`  
    `getProperty/`  
      `index.ts`  
    `createProperty/`  
      `index.ts`  
    `updateProperty/`  
      `index.ts`  
    `deleteProperty/`  
      `index.ts`  
    `getUploadUrl/`  
      `index.ts`  
    `bulkUpload/`  
      `index.ts`

---

## **🎨 frontend/**

`frontend/`  
  `src/`  
    `api/`  
      `auth.ts`  
      `properties.ts`  
    `components/`  
      `FileGrid.tsx`  
      `MapView.tsx`  
      `PropertyCard.tsx`  
    `pages/`  
      `Login.tsx`  
      `PropertyList.tsx`  
      `PropertyDetail.tsx`  
      `PropertyRegister.tsx`  
      `BulkUpload.tsx`  
      `MapPage.tsx`  
    `utils/`  
    `hooks/`

