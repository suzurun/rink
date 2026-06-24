/**
 * DELETE /properties/{propertyId}/files?key={s3Key} - 物件ファイル削除 API
 *
 * 認可: internal / admin（external → 403）
 *
 * Query Parameters:
 *   key: 削除対象の S3 キー（例: property/P00001/photo/天井.jpg）
 *
 * Response:
 * {
 *   "status": "success",
 *   "message": "ファイルを削除しました"
 * }
 *
 * S3 フォルダ構成:
 * property/{propertyId}/photo/
 * property/{propertyId}/drawing/
 * property/{propertyId}/pdf/
 * property/{propertyId}/movie/
 * property/{propertyId}/others/
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_NAME || '';

// 許可されるファイルタイプ（フォルダ名）
const ALLOWED_FILE_TYPES = ['photo', 'drawing', 'pdf', 'movie', 'others'];

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // ========================================
    // 1. 認可チェック（external 拒否、admin / internal のみ許可）
    // ========================================
    const authResult = checkAuthorization(event);
    if (authResult) {
      return authResult;
    }

    // ========================================
    // 2. パラメータ取得
    // ========================================
    const propertyId = event.pathParameters?.propertyId;
    const key = event.queryStringParameters?.key;

    if (!propertyId) {
      return errorResponse(400, 'propertyId is required');
    }

    if (!key) {
      return errorResponse(400, 'key (削除対象ファイル) is required');
    }

    if (!BUCKET_NAME) {
      return errorResponse(500, 'S3 bucket is not configured');
    }

    // ========================================
    // 3. バリデーション（他物件・他フォルダの削除を防止）
    // ========================================
    const validationError = validateKey(key, propertyId);
    if (validationError) {
      return errorResponse(400, validationError);
    }

    // ========================================
    // 4. 存在チェック（無い場合は 404）
    // ========================================
    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        })
      );
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      const statusCode = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
      if (name === 'NotFound' || name === 'NoSuchKey' || statusCode === 404) {
        return errorResponse(404, 'ファイルが見つかりません');
      }
      throw err;
    }

    // ========================================
    // 5. 削除
    // ========================================
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    return successResponse({
      status: 'success',
      message: 'ファイルを削除しました',
      key,
    });
  } catch (error) {
    console.error('Error:', error);
    return errorResponse(500, 'Internal Server Error');
  }
};

/**
 * 認可チェック
 * - external ユーザーは 403
 * - admin / internal のみ許可
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

  if (groupList.includes('external')) {
    return errorResponse(403, 'アクセス権限がありません');
  }

  if (!groupList.includes('admin') && !groupList.includes('internal')) {
    return errorResponse(403, 'アクセス権限がありません');
  }

  return null;
}

/**
 * S3 キーのバリデーション
 * - 対象物件のフォルダ配下のみ許可（他物件・バケット全体の削除を防止）
 * - 許可されたファイルタイプのフォルダのみ許可
 * - パストラバーサルを防止
 */
function validateKey(key: string, propertyId: string): string | null {
  // パストラバーサル防止
  if (key.includes('..')) {
    return 'key contains invalid characters';
  }

  // propertyId のフォーマット確認（getUploadUrl と同じ制約）
  if (!/^[A-Za-z0-9_-]+$/.test(propertyId)) {
    return 'propertyId contains invalid characters';
  }

  // 対象物件のフォルダ配下であることを確認
  const expectedPrefix = `property/${propertyId}/`;
  if (!key.startsWith(expectedPrefix)) {
    return 'key は対象物件のファイルではありません';
  }

  // フォルダ（ファイルタイプ）の確認
  const rest = key.slice(expectedPrefix.length);
  const fileType = rest.split('/')[0];
  if (!ALLOWED_FILE_TYPES.includes(fileType)) {
    return `fileType must be one of: ${ALLOWED_FILE_TYPES.join(', ')}`;
  }

  // フォルダ自体（末尾スラッシュ）ではなくファイルであることを確認
  if (key.endsWith('/')) {
    return 'key はファイルを指定してください';
  }

  return null;
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
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Tenant-Host',
    'Access-Control-Allow-Methods': 'DELETE,OPTIONS',
  };
}
