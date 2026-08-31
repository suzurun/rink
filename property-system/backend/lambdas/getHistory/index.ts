/**
 * GET /history - 操作履歴の取得 API
 *
 * 認可: admin / internal（external → 403）
 *   - 操作ログ画面（/logs）は画面側で admin 限定
 *   - internal には物件一覧の「最終更新」表示のために開放
 *
 * Query Parameters:
 *   propertyId : 特定物件の履歴だけを取得
 *   userId     : 特定ユーザーの操作だけを取得
 *   from       : 開始日（YYYY-MM-DD）※その日の 00:00 から
 *   to         : 終了日（YYYY-MM-DD）※その日の 23:59 まで
 *   limit      : 取得件数（既定 200 / 最大 1000）
 *
 * Response:
 * {
 *   "status": "success",
 *   "data": [ { propertyId, timestamp, userName, action, changes, ... } ],
 *   "total": 42
 * }
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

import { resolveHistoryTableName, TIMELINE_PK } from '../shared/auditLog';

const client = new DynamoDBClient({});

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const TABLE_NAME = resolveHistoryTableName(event);
    console.log('Resolved HISTORY_TABLE_NAME:', TABLE_NAME);

    // ========================================
    // 1. 認可チェック（external は拒否）
    // ========================================
    const groups = event.requestContext.authorizer?.claims?.['cognito:groups'] || '';
    const groupList = groups.split(',').map((g: string) => g.trim());

    if (groupList.includes('external')) {
      return response(403, { status: 'error', message: 'アクセス権限がありません' });
    }

    if (!groupList.includes('admin') && !groupList.includes('internal')) {
      return response(403, { status: 'error', message: 'アクセス権限がありません' });
    }

    // ========================================
    // 2. パラメータ取得
    // ========================================
    const params = event.queryStringParameters || {};
    const propertyId = params.propertyId?.trim() || '';
    const userId = params.userId?.trim() || '';
    const limit = normalizeLimit(params.limit);

    const { fromTs, toTs } = buildTimeRange(params.from, params.to);

    // ========================================
    // 3. クエリ実行
    // ========================================
    // 期間が指定されているときだけ #ts を使う。
    // 使わない ExpressionAttributeNames を渡すと DynamoDB がエラーにするため、
    // 条件が無い場合は付与しない。
    const hasRange = Boolean(fromTs && toTs);
    const rangeNames = hasRange ? { ExpressionAttributeNames: { '#ts': 'timestamp' } } : {};
    const rangeValues = hasRange ? { ':from': { S: fromTs }, ':to': { S: toTs } } : {};

    let queryInput;

    if (propertyId) {
      // 物件を指定 → メインテーブルを直接引く
      queryInput = {
        TableName: TABLE_NAME,
        KeyConditionExpression: 'propertyId = :propertyId',
        ExpressionAttributeValues: {
          ':propertyId': { S: propertyId },
          ...rangeValues,
        },
        ...(hasRange ? { FilterExpression: '#ts BETWEEN :from AND :to' } : {}),
        ...rangeNames,
        ScanIndexForward: false, // 新しい順
        Limit: limit,
      };
    } else if (userId) {
      // ユーザーを指定 → user-index
      queryInput = {
        TableName: TABLE_NAME,
        IndexName: 'user-index',
        KeyConditionExpression: hasRange
          ? 'userId = :userId AND #ts BETWEEN :from AND :to'
          : 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': { S: userId },
          ...rangeValues,
        },
        ...rangeNames,
        ScanIndexForward: false,
        Limit: limit,
      };
    } else {
      // 全体ログ → timeline-index
      queryInput = {
        TableName: TABLE_NAME,
        IndexName: 'timeline-index',
        KeyConditionExpression: hasRange
          ? 'gsiPk = :pk AND #ts BETWEEN :from AND :to'
          : 'gsiPk = :pk',
        ExpressionAttributeValues: {
          ':pk': { S: TIMELINE_PK },
          ...rangeValues,
        },
        ...rangeNames,
        ScanIndexForward: false,
        Limit: limit,
      };
    }

    const result = await client.send(new QueryCommand(queryInput as any));

    const items = (result.Items || []).map((item) => unmarshall(item));

    // 念のため新しい順に整列（インデックス未使用パスの保険）
    items.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

    return response(200, {
      status: 'success',
      data: items,
      total: items.length,
    });
  } catch (error) {
    console.error('Error:', error);
    return response(500, { status: 'error', message: 'Internal Server Error' });
  }
};

/**
 * 取得件数を正規化する
 */
function normalizeLimit(raw?: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

/**
 * YYYY-MM-DD の期間指定を ISO8601 の範囲に変換する。
 * from / to は「日本時間の日付」として受け取り、その日全体を含める。
 */
function buildTimeRange(from?: string, to?: string): { fromTs: string; toTs: string } {
  if (!from || !to) return { fromTs: '', toTs: '' };

  const dateFormat = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateFormat.test(from) || !dateFormat.test(to)) {
    return { fromTs: '', toTs: '' };
  }

  // JST(UTC+9) の 0:00 / 24:00 を UTC に変換
  const fromTs = new Date(`${from}T00:00:00+09:00`).toISOString();
  const toTs = new Date(`${to}T23:59:59.999+09:00`).toISOString();

  return { fromTs, toTs };
}

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Host',
    },
    body: JSON.stringify(body),
  };
}
