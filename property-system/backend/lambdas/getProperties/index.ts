/**
 * GET /properties - 物件一覧取得 API
 *
 * 認可: internal / admin（external → 403）
 *
 * Query Parameters:
 * - keyword: string - 名称・住所検索
 * - typeLarge: string - 大項目（GSI: name-index）
 * - typeMedium: string - 中項目（GSI: medium-index）
 * - typeSmall: string - 小項目（フィルター）
 * - staff: string - 担当者（GSI: staff-index）
 * - page: number - ページ番号（デフォルト: 1）
 * - limit: number - 1ページ件数（デフォルト: 20）
 *
 * Response:
 * {
 *   "status": "success",
 *   "data": [...],
 *   "page": 1,
 *   "limit": 20,
 *   "total": 120
 * }
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  DynamoDBClient,
  ScanCommand,
  QueryCommand,
  ScanCommandInput,
  QueryCommandInput,
} from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

// DynamoDB クライアント初期化
const client = new DynamoDBClient({});

// 環境変数
const TABLE_NAME = process.env.TABLE_NAME || 'Properties';

// GSI 名定義
const GSI_NAME_INDEX = 'name-index'; // PK: typeLarge, SK: name
const GSI_STAFF_INDEX = 'staff-index'; // PK: staff, SK: name
const GSI_MEDIUM_INDEX = 'medium-index'; // PK: typeMedium, SK: name

// クエリパラメータの型定義
interface QueryParams {
  keyword?: string;
  typeLarge?: string;
  typeMedium?: string;
  typeSmall?: string;
  staff?: string;
  sortBy: 'name' | 'staff' | 'typeLarge';
  page: number;
  limit: number;
}

// 物件データの型定義
interface Property {
  propertyId: string;
  name: string;
  zipcode?: string;
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
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Lambda ハンドラー
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // ========================================
    // 1. 認可チェック
    // ========================================
    const authResult = checkAuthorization(event);
    if (authResult) {
      return authResult;
    }

    // ========================================
    // 2. クエリパラメータの取得・パース
    // ========================================
    const params = parseQueryParams(event);
    console.log('Query Params:', params);

    // ========================================
    // 3. DynamoDB からデータ取得
    // ========================================
    let items: Property[] = await fetchProperties(params);

    // ========================================
    // 4. 追加フィルター処理
    // ========================================
    items = applyFilters(items, params);

    // ========================================
    // 5. ソート
    // ========================================
    items = sortProperties(items, params.sortBy);

    // ========================================
    // 6. ページネーション
    // ========================================
    const total = items.length;
    const { page, limit } = params;
    const startIndex = (page - 1) * limit;
    const paginatedItems = items.slice(startIndex, startIndex + limit);

    // ========================================
    // 7. レスポンス
    // ========================================
    const qs = event.queryStringParameters || {};
    const isExport = qs.export === 'true';

    const responseData = isExport
      ? paginatedItems
      : paginatedItems.map((item) => ({
          propertyId: item.propertyId,
          name: item.name,
          prefecture: item.prefecture,
          city: item.city,
          address: item.address,
          typeLarge: item.typeLarge,
          typeMedium: item.typeMedium,
          typeSmall: item.typeSmall,
          staff: item.staff,
          lat: item.lat,
          lng: item.lng,
        }));

    return successResponse({
      status: 'success',
      data: responseData,
      page,
      limit,
      total,
    });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse(500, 'Internal Server Error');
  }
};

/**
 * 認可チェック
 * - external ユーザーは 403 を返す
 */
function checkAuthorization(event: APIGatewayProxyEvent): APIGatewayProxyResult | null {
  const claims = event.requestContext.authorizer?.claims;

  if (!claims) {
    // Authorizer が設定されていない場合（開発時など）
    console.warn('No authorizer claims found');
    return null;
  }

  const groups: string = claims['cognito:groups'] || '';
  const groupList = groups.split(',').map((g: string) => g.trim());

  // external グループに属している場合は拒否
  if (groupList.includes('external')) {
    return errorResponse(403, 'アクセス権限がありません');
  }

  // admin または internal グループに属していることを確認
  if (!groupList.includes('admin') && !groupList.includes('internal')) {
    return errorResponse(403, 'アクセス権限がありません');
  }

  return null;
}

/**
 * クエリパラメータのパース
 */
function parseQueryParams(event: APIGatewayProxyEvent): QueryParams {
  const qs = event.queryStringParameters || {};

  return {
    keyword: qs.keyword?.trim() || undefined,
    typeLarge: qs.typeLarge?.trim() || undefined,
    typeMedium: qs.typeMedium?.trim() || undefined,
    typeSmall: qs.typeSmall?.trim() || undefined,
    staff: qs.staff?.trim() || undefined,
    sortBy: (qs.sortBy as QueryParams['sortBy']) || 'name',
    page: Math.max(1, parseInt(qs.page || '1', 10)),
    limit: Math.min(100, Math.max(1, parseInt(qs.limit || '20', 10))),
  };
}

/**
 * DynamoDB からプロパティを取得
 * - GSI を使用した効率的なクエリを優先
 * - 複数条件の場合は最も絞り込める GSI を使用し、残りはフィルター
 */
async function fetchProperties(params: QueryParams): Promise<Property[]> {
  let items: Property[] = [];

  // GSI を使ったクエリ（優先順位: typeLarge > staff > typeMedium）
  if (params.typeLarge) {
    // GSI: name-index（PK: typeLarge, SK: name）
    items = await queryByGSI(GSI_NAME_INDEX, 'typeLarge', params.typeLarge);
  } else if (params.staff) {
    // GSI: staff-index（PK: staff, SK: name）
    items = await queryByGSI(GSI_STAFF_INDEX, 'staff', params.staff);
  } else if (params.typeMedium) {
    // GSI: medium-index（PK: typeMedium, SK: name）
    items = await queryByGSI(GSI_MEDIUM_INDEX, 'typeMedium', params.typeMedium);
  } else {
    // GSI を使わない場合は Scan
    items = await scanAllProperties();
  }

  return items;
}

/**
 * GSI を使用したクエリ
 */
async function queryByGSI(
  indexName: string,
  pkName: string,
  pkValue: string
): Promise<Property[]> {
  const items: Property[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const commandInput: QueryCommandInput = {
      TableName: TABLE_NAME,
      IndexName: indexName,
      KeyConditionExpression: '#pk = :pkValue',
      ExpressionAttributeNames: {
        '#pk': pkName,
      },
      ExpressionAttributeValues: {
        ':pkValue': { S: pkValue },
      },
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const result = await client.send(new QueryCommand(commandInput));

    if (result.Items) {
      for (const item of result.Items) {
        items.push(unmarshall(item) as Property);
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

/**
 * 全件スキャン（GSI が使えない場合）
 */
async function scanAllProperties(): Promise<Property[]> {
  const items: Property[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const commandInput: ScanCommandInput = {
      TableName: TABLE_NAME,
      ExclusiveStartKey: lastEvaluatedKey,
    };

    const result = await client.send(new ScanCommand(commandInput));

    if (result.Items) {
      for (const item of result.Items) {
        items.push(unmarshall(item) as Property);
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return items;
}

/**
 * 追加フィルター処理
 * - GSI で絞り込めないパラメータをメモリ上でフィルター
 */
function applyFilters(items: Property[], params: QueryParams): Property[] {
  let filtered = items;

  // typeSmall フィルター
  if (params.typeSmall) {
    filtered = filtered.filter((item) => item.typeSmall === params.typeSmall);
  }

  // typeMedium フィルター（GSI で typeLarge を使った場合）
  if (params.typeLarge && params.typeMedium) {
    filtered = filtered.filter((item) => item.typeMedium === params.typeMedium);
  }

  // staff フィルター（GSI で typeLarge/typeMedium を使った場合）
  if ((params.typeLarge || params.typeMedium) && params.staff) {
    filtered = filtered.filter((item) => item.staff === params.staff);
  }

  // キーワード検索（名称・住所・市区町村）
  if (params.keyword) {
    const keyword = params.keyword.toLowerCase();
    filtered = filtered.filter((item) => {
      const searchFields = [
        item.name,
        item.address,
        item.city,
        item.prefecture,
        item.owner,
      ];
      return searchFields.some(
        (field) => field && field.toLowerCase().includes(keyword)
      );
    });
  }

  return filtered;
}

/**
 * ソート処理
 * - name: 名前の五十音順（会社名の接頭語は無視）
 * - staff: 担当者 → 名前
 * - typeLarge: 種類 → 名前
 */
function sortProperties(items: Property[], sortBy: QueryParams['sortBy']): Property[] {
  return items.sort((a, b) => {
    const nameA = normalizeName(a.name);
    const nameB = normalizeName(b.name);

    if (sortBy === 'staff') {
      const staffA = (a.staff || '').localeCompare(b.staff || '', 'ja');
      if (staffA !== 0) return staffA;
      return nameA.localeCompare(nameB, 'ja');
    }

    if (sortBy === 'typeLarge') {
      const typeA = (a.typeLarge || '').localeCompare(b.typeLarge || '', 'ja');
      if (typeA !== 0) return typeA;
      return nameA.localeCompare(nameB, 'ja');
    }

    return nameA.localeCompare(nameB, 'ja');
  });
}

/**
 * 会社名の接頭語を除去して比較用に整形
 */
function normalizeName(name?: string): string {
  if (!name) return '';
  let normalized = name.trim();

  const patterns = [
    /^(株式会社|有限会社|合同会社|合名会社|合資会社)/,
    /^(（株）|\(株\)|㈱)/,
    /^(（有）|\(有\)|㈲)/,
    /^(（同）|\(同\))/,
  ];

  let replaced = true;
  while (replaced) {
    replaced = false;
    for (const pattern of patterns) {
      const next = normalized.replace(pattern, '').trim();
      if (next !== normalized) {
        normalized = next;
        replaced = true;
      }
    }
  }

  return normalized.replace(/^[・\s]+/, '');
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
    body: JSON.stringify({
      status: 'error',
      message,
    }),
  };
}

/**
 * CORS ヘッダー
 */
function corsHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
  };
}
