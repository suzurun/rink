/**
 * POST /upload-url - 署名付きURL発行 API
 *
 * 認可: internal / admin（external → 403）
 *
 * Request Body:
 * {
 *   "propertyId": "P00001",
 *   "fileType": "photo",
 *   "fileName": "天井.jpg",
 *   "contentType": "image/jpeg" // optional
 * }
 *
 * Response:
 * {
 *   "status": "success",
 *   "uploadUrl": "https://s3...signed-url",
 *   "finalUrl": "s3://bucket/property/P00001/photo/天井.jpg",
 *   "s3Key": "property/P00001/photo/天井.jpg",
 *   "expiresIn": 900
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
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { recordHistory } from '../shared/auditLog';

// S3 クライアント初期化
const s3Client = new S3Client({});

// 環境変数
const BUCKET_NAME = process.env.BUCKET_NAME || '';
const REGION = process.env.REGION || 'ap-northeast-1';

// 署名付き URL の有効期限（秒）
const URL_EXPIRATION_SECONDS = 900; // 15分

// 許可されるファイルタイプ
const ALLOWED_FILE_TYPES = ['photo', 'drawing', 'pdf', 'movie', 'others'] as const;
type FileType = typeof ALLOWED_FILE_TYPES[number];

// Content-Type マッピング（拡張子 → MIME タイプ）
const CONTENT_TYPE_MAP: Record<string, string> = {
  // 画像
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  heic: 'image/heic',
  heif: 'image/heif',
  // PDF
  pdf: 'application/pdf',
  // 動画
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  // 図面（CAD）
  dwg: 'application/acad',
  dxf: 'application/dxf',
  // Office
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // その他
  zip: 'application/zip',
  txt: 'text/plain',
};

// ファイルサイズ制限（バイト）
const MAX_FILE_SIZES: Record<FileType, number> = {
  photo: 50 * 1024 * 1024,    // 50MB
  drawing: 100 * 1024 * 1024, // 100MB
  pdf: 100 * 1024 * 1024,     // 100MB
  movie: 500 * 1024 * 1024,   // 500MB
  others: 100 * 1024 * 1024,  // 100MB
};

// 操作履歴の表示用ラベル
const FILE_TYPE_LABELS: Record<FileType, string> = {
  photo: '写真',
  drawing: '図面',
  pdf: 'PDF',
  movie: '動画',
  others: 'その他',
};

// リクエストボディの型定義
interface UploadUrlRequest {
  propertyId: string;
  fileType: FileType;
  fileName: string;
  contentType?: string;
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
    // 2. リクエストボディのパース
    // ========================================
    if (!event.body) {
      return errorResponse(400, 'Request body is required');
    }

    let requestBody: UploadUrlRequest;
    try {
      requestBody = JSON.parse(event.body);
    } catch {
      return errorResponse(400, 'Invalid JSON format');
    }

    // ========================================
    // 3. バリデーション
    // ========================================
    const validationError = validateRequest(requestBody);
    if (validationError) {
      return errorResponse(400, validationError);
    }

    const { propertyId, fileType, fileName, contentType } = requestBody;

    // ========================================
    // 4. S3 キーの生成
    // ========================================
    // ファイル名をサニタイズ（危険な文字を除去、日本語はOK）
    const sanitizedFileName = sanitizeFileName(fileName);
    const s3Key = `property/${propertyId}/${fileType}/${sanitizedFileName}`;

    // ========================================
    // 5. Content-Type の決定
    // ========================================
    const resolvedContentType = resolveContentType(fileName, contentType);

    // ========================================
    // 6. 署名付き URL の生成
    // ========================================
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: resolvedContentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: URL_EXPIRATION_SECONDS,
    });

    // ========================================
    // 7. 操作履歴を記録
    // ========================================
    // 署名付き URL の発行時点で記録する（実アップロードは S3 へ直接行われるため）
    await recordHistory({
      event,
      propertyId,
      action: 'fileUpload',
      detail: `${FILE_TYPE_LABELS[fileType] || fileType}: ${sanitizedFileName}`,
    });

    // ========================================
    // 8. レスポンス
    // ========================================
    return successResponse({
      status: 'success',
      uploadUrl,
      s3Key,
      finalUrl: `s3://${BUCKET_NAME}/${s3Key}`,
      httpUrl: `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/${encodeURIComponent(s3Key)}`,
      contentType: resolvedContentType,
      expiresIn: URL_EXPIRATION_SECONDS,
      maxFileSize: MAX_FILE_SIZES[fileType],
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
 * リクエストのバリデーション
 */
function validateRequest(request: UploadUrlRequest): string | null {
  // propertyId チェック
  if (!request.propertyId || typeof request.propertyId !== 'string') {
    return 'propertyId is required';
  }

  if (!/^[A-Za-z0-9_-]+$/.test(request.propertyId)) {
    return 'propertyId contains invalid characters';
  }

  // fileType チェック
  if (!request.fileType) {
    return 'fileType is required';
  }

  if (!ALLOWED_FILE_TYPES.includes(request.fileType as FileType)) {
    return `fileType must be one of: ${ALLOWED_FILE_TYPES.join(', ')}`;
  }

  // fileName チェック
  if (!request.fileName || typeof request.fileName !== 'string') {
    return 'fileName is required';
  }

  if (request.fileName.length > 255) {
    return 'fileName is too long (max 255 characters)';
  }

  // パストラバーサル攻撃の防止
  if (request.fileName.includes('..') || request.fileName.includes('/') || request.fileName.includes('\\')) {
    return 'fileName contains invalid characters';
  }

  // BUCKET_NAME チェック
  if (!BUCKET_NAME) {
    return 'S3 bucket is not configured';
  }

  return null;
}

/**
 * ファイル名のサニタイズ
 * - 危険な文字を除去
 * - 日本語ファイル名は許可
 */
function sanitizeFileName(fileName: string): string {
  // 制御文字を除去
  let sanitized = fileName.replace(/[\x00-\x1f\x7f]/g, '');

  // 先頭・末尾の空白を除去
  sanitized = sanitized.trim();

  // 空文字になった場合はデフォルト名
  if (!sanitized) {
    sanitized = `file_${Date.now()}`;
  }

  return sanitized;
}

/**
 * Content-Type の決定
 * - リクエストで指定された場合はそれを使用
 * - 指定がない場合は拡張子から推測
 */
function resolveContentType(fileName: string, requestedContentType?: string): string {
  // リクエストで指定された場合
  if (requestedContentType) {
    return requestedContentType;
  }

  // 拡張子から推測
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension && CONTENT_TYPE_MAP[extension]) {
    return CONTENT_TYPE_MAP[extension];
  }

  // デフォルト
  return 'application/octet-stream';
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
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };
}
