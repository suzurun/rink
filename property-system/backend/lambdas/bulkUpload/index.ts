/**
 * POST /properties/bulk - 一括登録 API
 * S3 トリガー対応
 *
 * 認可: admin のみ
 *
 * 処理フロー:
 * 1. S3トリガー or API Gateway から CSV/JSON を受信
 * 2. データをパース・バリデーション
 * 3. DynamoDB に登録（成功分）
 * 4. エラー行を CSV として S3 に保存
 * 5. 結果サマリを返却
 *
 * S3 フォルダ構成:
 * - uploads/bulk/   : アップロード先（トリガー対象）
 * - errors/bulk/    : エラーファイル保存先
 *
 * Response:
 * {
 *   "status": "success",
 *   "successCount": 120,
 *   "errorCount": 5,
 *   "errorFileUrl": "https://s3/.../errors.csv"
 * }
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, S3Event } from 'aws-lambda';
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  BatchWriteItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { marshall } from '@aws-sdk/util-dynamodb';

// クライアント初期化
const dynamoClient = new DynamoDBClient({});
const s3Client = new S3Client({});

import { resolveTableName } from '../shared/tenantResolver';

const DEFAULT_TABLE_NAME = process.env.TABLE_NAME || 'Properties';
const BUCKET_NAME = process.env.BUCKET_NAME || '';
const REGION = process.env.REGION || 'ap-northeast-1';

// エラー行の型
interface ErrorRow {
  row: number;
  propertyId: string;
  error: string;
  data: Record<string, any>;
}

// 物件データの型
interface PropertyRow {
  propertyId: string;
  name: string;
  zipcode: string;
  prefecture: string;
  city: string;
  address: string;
  lat?: number;
  lng?: number;
  typeLarge: string;
  typeMedium?: string;
  typeSmall?: string;
  landUse?: string;
  structure?: string;
  area?: number;
  owner?: string;
  staff?: string;
  deliveryDate?: string;
  memo?: string;
}

// CSVヘッダー定義
const CSV_HEADERS = [
  'propertyId',
  'name',
  'zipcode',
  'prefecture',
  'city',
  'address',
  'lat',
  'lng',
  'typeLarge',
  'typeMedium',
  'typeSmall',
  'landUse',
  'structure',
  'area',
  'owner',
  'staff',
  'deliveryDate',
  'memo',
];

/**
 * Lambda ハンドラー
 * S3 トリガーと API Gateway の両方に対応
 */
export const handler = async (
  event: S3Event | APIGatewayProxyEvent
): Promise<APIGatewayProxyResult | void> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    if ('Records' in event && event.Records?.[0]?.s3) {
      await handleS3Trigger(event as S3Event, DEFAULT_TABLE_NAME);
      return;
    }

    return await handleApiGateway(event as APIGatewayProxyEvent);
  } catch (error) {
    console.error('Error:', error);
    return errorResponse(500, 'Internal Server Error');
  }
};

/**
 * S3 トリガー処理
 */
async function handleS3Trigger(event: S3Event, tableName: string): Promise<void> {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`Processing S3 file: s3://${bucket}/${key}`);

    const csvContent = await getS3FileContent(bucket, key);
    const rows = parseCSV(csvContent);
    const result = await processRows(rows, tableName);

    console.log(`Bulk upload result: ${result.successCount} success, ${result.errorCount} errors`);

    // 処理完了後、元ファイルを削除（オプション）
    // await deleteS3File(bucket, key);
  }
}

/**
 * API Gateway 処理
 */
async function handleApiGateway(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const TABLE_NAME = resolveTableName(event);
  console.log('Resolved TABLE_NAME:', TABLE_NAME);

  // ========================================
  // 1. 認可チェック（admin のみ）
  // ========================================
  const authResult = checkAuthorization(event);
  if (authResult) {
    return authResult;
  }

  // ========================================
  // 2. リクエストボディの取得
  // ========================================
  if (!event.body) {
    return errorResponse(400, 'Request body is required');
  }

  let requestData: { data?: PropertyRow[]; csv?: string };
  try {
    requestData = JSON.parse(event.body);
  } catch {
    return errorResponse(400, 'Invalid JSON format');
  }

  // ========================================
  // 3. データのパース
  // ========================================
  let rows: PropertyRow[];

  if (requestData.csv) {
    // CSV 文字列の場合
    rows = parseCSV(requestData.csv);
  } else if (requestData.data && Array.isArray(requestData.data)) {
    // JSON 配列の場合
    rows = requestData.data;
  } else {
    return errorResponse(400, 'data array or csv string is required');
  }

  if (rows.length === 0) {
    return errorResponse(400, 'No data to process');
  }

  // ========================================
  // 4. 一括登録実行
  // ========================================
  const result = await processRows(rows, TABLE_NAME);

  // ========================================
  // 5. レスポンス
  // ========================================
  return successResponse({
    status: 'success',
    successCount: result.successCount,
    errorCount: result.errorCount,
    errorFileUrl: result.errorFileUrl,
    errors: result.errors.slice(0, 10), // 最初の10件のエラーを返す
  });
}

/**
 * 認可チェック（admin のみ）
 */
function checkAuthorization(event: APIGatewayProxyEvent): APIGatewayProxyResult | null {
  const claims = event.requestContext.authorizer?.claims;

  if (!claims) {
    console.warn('No authorizer claims found');
    return null;
  }

  const groups: string = claims['cognito:groups'] || '';
  const groupList = groups.split(',').map((g: string) => g.trim());

  // admin グループに属していない場合は拒否
  if (!groupList.includes('admin')) {
    return errorResponse(403, '一括登録は管理者のみ可能です');
  }

  return null;
}

/**
 * CSV パース
 */
function parseCSV(csvContent: string): PropertyRow[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    return [];
  }

  // ヘッダー行を取得
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  // ヘッダーのインデックスマッピング
  const headerIndex: Record<string, number> = {};
  headers.forEach((header, index) => {
    const normalizedHeader = header.trim().toLowerCase();
    // 日本語ヘッダーの対応
    const mappedHeader = mapJapaneseHeader(normalizedHeader);
    if (mappedHeader) {
      headerIndex[mappedHeader] = index;
    }
  });

  // データ行をパース
  const rows: PropertyRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: Record<string, any> = {};

    CSV_HEADERS.forEach((header) => {
      const index = headerIndex[header];
      if (index !== undefined && values[index] !== undefined) {
        let value = values[index].trim();

        // 数値フィールドの変換
        if (['lat', 'lng', 'area'].includes(header) && value) {
          const numValue = parseFloat(value);
          row[header] = isNaN(numValue) ? undefined : numValue;
        } else {
          row[header] = value || undefined;
        }
      }
    });

    rows.push(row as PropertyRow);
  }

  return rows;
}

/**
 * CSV 行のパース（引用符対応）
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',' || char === '\t') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current);

  return result;
}

/**
 * 日本語ヘッダーのマッピング
 */
function mapJapaneseHeader(header: string): string | null {
  const mapping: Record<string, string> = {
    propertyid: 'propertyId',
    '物件id': 'propertyId',
    name: 'name',
    '物件名': 'name',
    zipcode: 'zipcode',
    '郵便番号': 'zipcode',
    prefecture: 'prefecture',
    '都道府県': 'prefecture',
    city: 'city',
    '市区町村': 'city',
    address: 'address',
    '番地': 'address',
    '住所': 'address',
    lat: 'lat',
    '緯度': 'lat',
    lng: 'lng',
    '経度': 'lng',
    typelarge: 'typeLarge',
    '大項目': 'typeLarge',
    typemedium: 'typeMedium',
    '中項目': 'typeMedium',
    typesmall: 'typeSmall',
    '小項目': 'typeSmall',
    landuse: 'landUse',
    '用途地域': 'landUse',
    structure: 'structure',
    '構造': 'structure',
    area: 'area',
    '面積': 'area',
    owner: 'owner',
    '施主': 'owner',
    staff: 'staff',
    '担当者': 'staff',
    deliverydate: 'deliveryDate',
    '引渡時期': 'deliveryDate',
    memo: 'memo',
    '備考': 'memo',
  };

  return mapping[header] || null;
}

/**
 * 行データの処理
 */
async function processRows(rows: PropertyRow[], tableName: string): Promise<{
  successCount: number;
  errorCount: number;
  errorFileUrl?: string;
  errors: ErrorRow[];
}> {
  const errors: ErrorRow[] = [];
  let successCount = 0;
  const now = new Date().toISOString();

  // 既存の propertyId をチェックするためのセット
  const processedIds = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;

    try {
      // バリデーション
      const validationError = validateRow(row);
      if (validationError) {
        errors.push({
          row: rowNumber,
          propertyId: row.propertyId || '',
          error: validationError,
          data: row,
        });
        continue;
      }

      // 重複チェック（同一バッチ内）
      if (processedIds.has(row.propertyId)) {
        errors.push({
          row: rowNumber,
          propertyId: row.propertyId,
          error: 'propertyId が重複しています（同一ファイル内）',
          data: row,
        });
        continue;
      }

      // 重複チェック（既存データ）
      const existingItem = await dynamoClient.send(
        new GetItemCommand({
          TableName: tableName,
          Key: { propertyId: { S: row.propertyId } },
          ProjectionExpression: 'propertyId',
        })
      );

      if (existingItem.Item) {
        errors.push({
          row: rowNumber,
          propertyId: row.propertyId,
          error: 'propertyId が既に存在します',
          data: row,
        });
        continue;
      }

      // DynamoDB に登録
      const item = {
        ...row,
        files: {
          photo: [],
          drawing: [],
          pdf: [],
          movie: [],
          others: [],
        },
        createdAt: now,
        updatedAt: now,
      };

      await dynamoClient.send(
        new PutItemCommand({
          TableName: tableName,
          Item: marshall(item, { removeUndefinedValues: true }),
          ConditionExpression: 'attribute_not_exists(propertyId)',
        })
      );

      processedIds.add(row.propertyId);
      successCount++;
    } catch (err) {
      errors.push({
        row: rowNumber,
        propertyId: row.propertyId || '',
        error: err instanceof Error ? err.message : 'Unknown error',
        data: row,
      });
    }
  }

  // エラーファイルを S3 に保存
  let errorFileUrl: string | undefined;
  if (errors.length > 0 && BUCKET_NAME) {
    errorFileUrl = await saveErrorsToS3(errors);
  }

  return {
    successCount,
    errorCount: errors.length,
    errorFileUrl,
    errors,
  };
}

/**
 * 行データのバリデーション
 */
function validateRow(row: PropertyRow): string | null {
  if (!row.propertyId || typeof row.propertyId !== 'string') {
    return 'propertyId is required';
  }
  if (!/^[A-Za-z0-9_-]+$/.test(row.propertyId)) {
    return 'propertyId contains invalid characters';
  }
  if (!row.name) {
    return 'name is required';
  }
  if (!row.zipcode) {
    return 'zipcode is required';
  }
  if (!row.prefecture) {
    return 'prefecture is required';
  }
  if (!row.city) {
    return 'city is required';
  }
  if (!row.address) {
    return 'address is required';
  }
  if (!row.typeLarge) {
    return 'typeLarge is required';
  }

  // 緯度経度の範囲チェック
  if (row.lat !== undefined && (row.lat < -90 || row.lat > 90)) {
    return 'lat must be between -90 and 90';
  }
  if (row.lng !== undefined && (row.lng < -180 || row.lng > 180)) {
    return 'lng must be between -180 and 180';
  }

  return null;
}

/**
 * S3 ファイルの内容を取得
 */
async function getS3FileContent(bucket: string, key: string): Promise<string> {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );

  const bodyContents = await streamToString(response.Body);
  return bodyContents;
}

/**
 * Stream を文字列に変換
 */
async function streamToString(stream: any): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * エラーを S3 に保存
 */
async function saveErrorsToS3(errors: ErrorRow[]): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const errorKey = `errors/bulk/bulk-upload-errors-${timestamp}.csv`;

  // CSV ヘッダー
  const csvHeaders = ['row', 'propertyId', 'error', ...CSV_HEADERS];

  // CSV 行を生成
  const csvRows = errors.map((e) => {
    const values = [
      e.row.toString(),
      escapeCSVValue(e.propertyId),
      escapeCSVValue(e.error),
      ...CSV_HEADERS.map((h) => escapeCSVValue(String(e.data[h] || ''))),
    ];
    return values.join(',');
  });

  const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

  // S3 に保存
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: errorKey,
      Body: csvContent,
      ContentType: 'text/csv; charset=utf-8',
    })
  );

  // 署名付き URL を生成（1時間有効）
  const signedUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: BUCKET_NAME, Key: errorKey }),
    { expiresIn: 3600 }
  );

  return signedUrl;
}

/**
 * CSV 値のエスケープ
 */
function escapeCSVValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * 成功レスポンス生成
 */
function successResponse(body: object): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: corsHeaders(),
    body: JSON.stringify(body),
  };
}

/**
 * エラーレスポンス生成
 */
function errorResponse(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: corsHeaders(),
    body: JSON.stringify({ status: 'error', message }),
  };
}

/**
 * CORS ヘッダー
 */
function corsHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Tenant-Host',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };
}
