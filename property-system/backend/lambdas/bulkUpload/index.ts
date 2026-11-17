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
  UpdateItemCommand,
  BatchWriteItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

// クライアント初期化
const dynamoClient = new DynamoDBClient({});
const s3Client = new S3Client({});

import { resolveTableName } from '../shared/tenantResolver';
import {
  Actor,
  getActor,
  systemActor,
  historyTableFromPropertiesTable,
  recordHistoryBatch,
  HistoryRecordInput,
  diffFields,
} from '../shared/auditLog';

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
  rbs?: string;
  ownershipType?: string;
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
  area?: number | string;
  owner?: string;
  staff?: string;
  siteStaff?: string;
  deliveryDate?: string;
  memo?: string;
  signboard?: string; // 看板（自社土地）
  price?: string; // 金額（自社土地）
  landUpdateDate?: string; // 更新日（自社土地・手入力）
}

// CSVヘッダー定義
const CSV_HEADERS = [
  'propertyId',
  'rbs',
  'ownershipType',
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
  'siteStaff',
  'deliveryDate',
  'memo',
  'signboard',
  'price',
  'landUpdateDate',
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
    const result = await processRows(rows, tableName, systemActor());

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
    try {
      rows = parseCSV(requestData.csv);
    } catch (err) {
      if (err instanceof CsvFormatError) {
        return errorResponse(400, err.message);
      }
      throw err;
    }
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
  const result = await processRows(rows, TABLE_NAME, getActor(event));

  // ========================================
  // 5. レスポンス
  // ========================================
  return successResponse({
    status: 'success',
    successCount: result.successCount,
    createdCount: result.createdCount,
    updatedCount: result.updatedCount,
    unchangedCount: result.unchangedCount,
    errorCount: result.errorCount,
    errorFileUrl: result.errorFileUrl,
    // 最初の10件のエラーを返す（画面は message を表示する）
    errors: result.errors.slice(0, 10).map((e) => ({
      row: e.row,
      propertyId: e.propertyId,
      message: e.error,
    })),
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
 *
 * 引用符で囲まれたセル内の改行（備考など）を 1 セルとして扱うため、
 * 行単位に split せず、文字列全体を 1 文字ずつ読んでレコードに分ける。
 * 見出しから物件IDの列が見つからない場合は例外を投げる（文字コード違いなど）。
 */
function parseCSV(csvContent: string): PropertyRow[] {
  const records = parseCSVRecords(csvContent.replace(/^\uFEFF/, ''));
  if (records.length < 2) {
    return [];
  }

  // ヘッダーのインデックスマッピング
  const headerIndex: Record<string, number> = {};
  records[0].forEach((header, index) => {
    const normalizedHeader = header.trim().toLowerCase();
    const mappedHeader = mapJapaneseHeader(normalizedHeader);
    if (mappedHeader) {
      headerIndex[mappedHeader] = index;
    }
  });

  if (headerIndex.propertyId === undefined) {
    throw new CsvFormatError(
      '1行目の見出しに「物件ID」が見つかりません。CSVを UTF-8 で保存しているか確認してください'
    );
  }

  const rows: PropertyRow[] = [];
  for (let i = 1; i < records.length; i++) {
    const values = records[i];
    // 空行はスキップ
    if (values.every((v) => v.trim() === '')) continue;

    const row: Record<string, any> = {};
    CSV_HEADERS.forEach((header) => {
      const index = headerIndex[header];
      if (index !== undefined && values[index] !== undefined) {
        const value = values[index].trim();

        // 数値フィールドの変換
        // 面積は「300坪」のような文字の値も登録されているため、数字だけのときに限り数値にする
        if (header === 'area' && value) {
          row[header] = /^-?\d+(\.\d+)?$/.test(value) ? parseFloat(value) : value;
        } else if (['lat', 'lng'].includes(header) && value) {
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

/** CSV の形式そのものが読めないときのエラー（400 で返す） */
class CsvFormatError extends Error {}

/**
 * CSV 全体をレコード（セルの配列）の配列に分ける（引用符・セル内改行・CRLF 対応）
 * 区切りはカンマ。タブ区切り（Excel からの貼り付け）も従来どおり受け付ける。
 */
function parseCSVRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else if (char === '\r' && text[i + 1] === '\n') {
        // セル内の CRLF は LF にそろえる
        current += '\n';
        i++;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',' || char === '\t') {
      record.push(current);
      current = '';
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      record.push(current);
      records.push(record);
      record = [];
      current = '';
    } else {
      current += char;
    }
  }

  // 最終行（末尾に改行が無い場合）
  if (current !== '' || record.length > 0) {
    record.push(current);
    records.push(record);
  }

  return records;
}

/**
 * 日本語ヘッダーのマッピング
 */
function mapJapaneseHeader(header: string): string | null {
  const mapping: Record<string, string> = {
    propertyid: 'propertyId',
    '物件id': 'propertyId',
    rbs: 'rbs',
    '管理先': 'rbs',
    ownershiptype: 'ownershipType',
    '物件区分': 'ownershipType',
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
    // テーブルのCSV出力（自社土地）の見出し
    '所在地': 'address',
    '管理番号': 'typeSmall',
    '通称': 'name',
    '概要': 'memo',
    '看板': 'signboard',
    '金額': 'price',
    '更新日': 'landUpdateDate',
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
    sitestaff: 'siteStaff',
    '現場担当者': 'siteStaff',
    deliverydate: 'deliveryDate',
    '引渡時期': 'deliveryDate',
    memo: 'memo',
    '備考': 'memo',
  };

  return mapping[header] || null;
}

/**
 * 行データの処理
 *
 * - 物件IDが未登録 → 新規登録
 * - 物件IDが登録済み → 上書き。CSV に値が入っている項目だけ更新し、
 *   空欄の項目・CSV に無い項目（看板・金額・ファイル等）は今の値を残す。
 *   値が何も変わらない行は書き込まない（書き出した CSV をそのまま上げても何も起きない）
 */
async function processRows(
  rows: PropertyRow[],
  tableName: string,
  actor: Actor
): Promise<{
  successCount: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  errorCount: number;
  errorFileUrl?: string;
  errors: ErrorRow[];
}> {
  const errors: ErrorRow[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  const now = new Date().toISOString();
  const historyTableName = historyTableFromPropertiesTable(tableName);
  const historyEntries: HistoryRecordInput[] = [];

  // 同一ファイル内の重複チェック用
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

      // 重複チェック（同一ファイル内）
      if (processedIds.has(row.propertyId)) {
        errors.push({
          row: rowNumber,
          propertyId: row.propertyId,
          error: '物件IDが同じファイルの中で重複しています',
          data: row,
        });
        continue;
      }
      processedIds.add(row.propertyId);

      const existingItem = await dynamoClient.send(
        new GetItemCommand({
          TableName: tableName,
          Key: { propertyId: { S: row.propertyId } },
        })
      );

      if (existingItem.Item) {
        // ---------- 上書き（値が入っている項目だけ） ----------
        const beforeData = unmarshall(existingItem.Item);
        const input: Record<string, unknown> = {};
        for (const key of CSV_HEADERS) {
          if (key === 'propertyId') continue;
          const value = (row as unknown as Record<string, unknown>)[key];
          if (value !== undefined && value !== null && value !== '') {
            input[key] = value;
          }
        }

        // 前後の空白だけの違い（CSV 読み込み時に trim される分）は変更とみなさない
        const changes = diffFields(beforeData, input).filter(
          (c) => c.before.trim() !== c.after.trim()
        );
        if (changes.length === 0) {
          unchangedCount++;
          continue;
        }

        const names: Record<string, string> = {
          '#updatedAt': 'updatedAt',
          '#updatedBy': 'updatedBy',
          '#updatedByUserId': 'updatedByUserId',
          '#updatedByEmail': 'updatedByEmail',
        };
        const values: Record<string, unknown> = {
          ':updatedAt': now,
          ':updatedBy': actor.userName,
          ':updatedByUserId': actor.userId,
          ':updatedByEmail': actor.userEmail,
        };
        const sets = [
          '#updatedAt = :updatedAt',
          '#updatedBy = :updatedBy',
          '#updatedByUserId = :updatedByUserId',
          '#updatedByEmail = :updatedByEmail',
        ];
        for (const change of changes) {
          names[`#${change.field}`] = change.field;
          values[`:${change.field}`] = input[change.field];
          sets.push(`#${change.field} = :${change.field}`);
        }

        await dynamoClient.send(
          new UpdateItemCommand({
            TableName: tableName,
            Key: { propertyId: { S: row.propertyId } },
            UpdateExpression: `SET ${sets.join(', ')}`,
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true }),
            ConditionExpression: 'attribute_exists(propertyId)',
          })
        );

        updatedCount++;
        historyEntries.push({
          propertyId: row.propertyId,
          propertyName: (input.name ?? beforeData.name ?? '') as string,
          action: 'update',
          changes,
          detail: 'CSV一括登録（上書き）',
          actor,
          tableName: historyTableName,
        });
        continue;
      }

      // ---------- 新規登録 ----------
      // Excel で開いて保存すると「001」が「1」になるため、
      // 0 を補うと登録済みの物件IDになる場合は新規登録せずエラーにする
      const zeroLostId = await findZeroPaddedExistingId(row.propertyId, tableName);
      if (zeroLostId) {
        errors.push({
          row: rowNumber,
          propertyId: row.propertyId,
          error: `物件ID「${row.propertyId}」は未登録です。先頭の0が消えて「${zeroLostId}」が「${row.propertyId}」になった可能性があります（Excelで保存すると消えます）`,
          data: row,
        });
        continue;
      }

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
        // 更新者表示・操作履歴用
        createdBy: actor.userName,
        createdByUserId: actor.userId,
        createdByEmail: actor.userEmail,
        updatedBy: actor.userName,
        updatedByUserId: actor.userId,
        updatedByEmail: actor.userEmail,
      };

      await dynamoClient.send(
        new PutItemCommand({
          TableName: tableName,
          Item: marshall(item, { removeUndefinedValues: true }),
          ConditionExpression: 'attribute_not_exists(propertyId)',
        })
      );

      createdCount++;
      historyEntries.push({
        propertyId: row.propertyId,
        propertyName: row.name || '',
        action: 'bulkCreate',
        detail: 'CSV一括登録',
        actor,
        tableName: historyTableName,
      });
    } catch (err) {
      errors.push({
        row: rowNumber,
        propertyId: row.propertyId || '',
        error: err instanceof Error ? err.message : 'Unknown error',
        data: row,
      });
    }
  }

  // 操作履歴をまとめて記録
  if (historyEntries.length > 0) {
    await recordHistoryBatch(historyEntries);
  }

  // エラーファイルを S3 に保存
  let errorFileUrl: string | undefined;
  if (errors.length > 0 && BUCKET_NAME) {
    errorFileUrl = await saveErrorsToS3(errors);
  }

  return {
    successCount: createdCount + updatedCount,
    createdCount,
    updatedCount,
    unchangedCount,
    errorCount: errors.length,
    errorFileUrl,
    errors,
  };
}

/**
 * 数字だけの物件IDについて、先頭に 0 を補った ID（3〜5桁）が登録済みなら、その ID を返す
 */
async function findZeroPaddedExistingId(
  propertyId: string,
  tableName: string
): Promise<string | null> {
  if (!/^\d+$/.test(propertyId)) return null;

  for (const width of [3, 4, 5]) {
    const padded = propertyId.padStart(width, '0');
    if (padded === propertyId) continue;
    const found = await dynamoClient.send(
      new GetItemCommand({
        TableName: tableName,
        Key: { propertyId: { S: padded } },
        ProjectionExpression: 'propertyId',
      })
    );
    if (found.Item) return padded;
  }
  return null;
}

/**
 * 行データのバリデーション
 */
function validateRow(row: PropertyRow): string | null {
  if (!row.propertyId || typeof row.propertyId !== 'string') {
    return '物件IDが空欄です';
  }
  if (!/^[A-Za-z0-9_-]+$/.test(row.propertyId)) {
    return '物件IDに使えない文字が入っています（半角英数字・-・_ のみ）';
  }
  // 物件名・市区町村・番地・大項目・郵便番号・都道府県はすべて任意
  // （土地など項目が埋まらないデータも登録できるようにするため）

  // 緯度経度の範囲チェック
  if (row.lat !== undefined && (row.lat < -90 || row.lat > 90)) {
    return '緯度は -90〜90 の範囲で入力してください';
  }
  if (row.lng !== undefined && (row.lng < -180 || row.lng > 180)) {
    return '経度は -180〜180 の範囲で入力してください';
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
