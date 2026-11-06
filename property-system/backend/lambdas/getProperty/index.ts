/**
 * GET /properties/{propertyId} - 物件詳細取得 API
 *
 * 認可: internal / admin（external → 403）
 *
 * Path Parameters:
 * - propertyId: string - 物件ID
 *
 * Response:
 * {
 *   "status": "success",
 *   "data": { ... property details ... }
 * }
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

// DynamoDB クライアント初期化
const client = new DynamoDBClient({});

// 環境変数
const TABLE_NAME = process.env.TABLE_NAME || 'Properties';

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
  files?: {
    photo: string[];
    drawing: string[];
    pdf: string[];
    movie: string[];
    others: string[];
  };
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
    // 2. パスパラメータから propertyId を取得
    // ========================================
    const propertyId = event.pathParameters?.propertyId || event.pathParameters?.id;

    if (!propertyId) {
      return errorResponse(400, '物件IDが指定されていません');
    }

    // ========================================
    // 3. DynamoDB から物件データを取得
    // ========================================
    const property = await getPropertyById(propertyId);

    if (!property) {
      return errorResponse(404, '物件が見つかりません');
    }

    // ========================================
    // 4. レスポンス返却
    // ========================================
    return successResponse({
      status: 'success',
      data: property,
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
 * DynamoDB から物件を取得
 */
async function getPropertyById(propertyId: string): Promise<Property | null> {
  const command = new GetItemCommand({
    TableName: TABLE_NAME,
    Key: {
      propertyId: { S: propertyId },
    },
  });

  const result = await client.send(command);

  if (!result.Item) {
    return null;
  }

  return unmarshall(result.Item) as Property;
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



