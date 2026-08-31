/**
 * 物件 API クライアント
 */

import {
  PropertyListResponse,
  PropertyDetailResponse,
  PropertySearchParams,
} from '../types/property';
import { signOut } from 'aws-amplify/auth';
import { getFreshIdToken, clearRememberedSession } from './auth';

// API ベース URL（環境変数から取得）
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * 共通のリクエストヘッダー
 *
 * 保存済みトークンをそのまま使うと 1 時間で期限切れになるため、
 * 毎回 Amplify からトークンを取得する（期限が近ければ自動で更新される）。
 * これによりリフレッシュトークンの有効期間中はログイン状態が維持される。
 */
export async function getHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const token = await getFreshIdToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (typeof window !== 'undefined') {
    headers['X-Tenant-Host'] = window.location.hostname;
  }

  return headers;
}

/**
 * API エラーハンドリング
 */
export async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      // ここに来るのはトークンの自動更新にも失敗した場合
      // （リフレッシュトークンの期限切れ＝最後のログインから30日経過など）。
      // セッションを片付けてログイン画面へ戻す。
      if (typeof window !== 'undefined') {
        try {
          await signOut();
        } catch (e) {
          console.error('Sign out error:', e);
        }
        clearRememberedSession();
        // リダイレクト（次のイベントループで実行）
        setTimeout(() => {
          window.location.href = '/login';
        }, 0);
      }
      throw new Error('認証の有効期限が切れました。再度ログインしてください。');
    }
    
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP Error: ${response.status}`);
  }

  return response.json();
}

/**
 * GET /properties - 物件一覧取得
 */
export async function getProperties(
  params: PropertySearchParams = {}
): Promise<PropertyListResponse> {
  const queryParams = new URLSearchParams();

  if (params.keyword) queryParams.set('keyword', params.keyword);
  if (params.typeLarge) queryParams.set('typeLarge', params.typeLarge);
  if (params.typeMedium) queryParams.set('typeMedium', params.typeMedium);
  if (params.typeSmall) queryParams.set('typeSmall', params.typeSmall);
  if (params.staff) queryParams.set('staff', params.staff);
  if (params.sortBy) queryParams.set('sortBy', params.sortBy);
  if (params.page) queryParams.set('page', params.page.toString());
  if (params.limit) queryParams.set('limit', params.limit.toString());

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/properties${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: await getHeaders(),
  });

  return handleResponse<PropertyListResponse>(response);
}

/**
 * GET /properties?export=true - 全フィールド付き物件一覧取得（CSV出力用）
 */
export async function getPropertiesForExport(): Promise<{
  status: string;
  data: Array<Record<string, any>>;
  total: number;
}> {
  const url = `${API_BASE_URL}/properties?export=true&limit=1000`;

  const response = await fetch(url, {
    method: 'GET',
    headers: await getHeaders(),
  });

  return handleResponse(response);
}

/**
 * GET /properties/{propertyId} - 物件詳細取得
 */
export async function getProperty(propertyId: string): Promise<PropertyDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/properties/${propertyId}`, {
    method: 'GET',
    headers: await getHeaders(),
  });

  return handleResponse<PropertyDetailResponse>(response);
}

/**
 * POST /upload-url - 署名付きURL取得
 */
export async function getUploadUrl(
  propertyId: string,
  fileType: string,
  fileName: string
): Promise<{
  status: string;
  uploadUrl: string;
  s3Key: string;
  finalUrl: string;
  contentType: string;
}> {
  const response = await fetch(`${API_BASE_URL}/upload-url`, {
    method: 'POST',
    headers: await getHeaders(),
    body: JSON.stringify({ propertyId, fileType, fileName }),
  });

  return handleResponse(response);
}

/**
 * S3 に直接ファイルをアップロード
 */
export async function uploadFileToS3(
  uploadUrl: string,
  file: File,
  contentType: string
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error('ファイルのアップロードに失敗しました');
  }
}

/**
 * 物件作成用の入力データ型
 */
export interface CreatePropertyInput {
  propertyId: string;
  name: string;
  zipcode: string;
  prefecture: string;
  city: string;
  address: string;
  typeLarge: string;
  lat?: number;
  lng?: number;
  typeMedium?: string;
  typeSmall?: string;
  landUse?: string;
  structure?: string;
  area?: number | string;
  owner?: string;
  staff?: string;
  deliveryDate?: string;
  memo?: string;
}

/**
 * POST /properties - 物件登録
 */
export async function createProperty(
  data: CreatePropertyInput
): Promise<PropertyDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/properties`, {
    method: 'POST',
    headers: await getHeaders(),
    body: JSON.stringify(data),
  });

  return handleResponse<PropertyDetailResponse>(response);
}

/**
 * PUT /properties/{propertyId} - 物件更新
 */
export async function updateProperty(
  propertyId: string,
  data: Partial<Omit<CreatePropertyInput, 'propertyId'>>
): Promise<PropertyDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/properties/${propertyId}`, {
    method: 'PUT',
    headers: await getHeaders(),
    body: JSON.stringify(data),
  });

  return handleResponse<PropertyDetailResponse>(response);
}

/**
 * DELETE /properties/{propertyId} - 物件削除
 */
export async function deleteProperty(propertyId: string): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/properties/${propertyId}`, {
    method: 'DELETE',
    headers: await getHeaders(),
  });

  return handleResponse(response);
}

/**
 * ファイル情報の型
 */
export interface FileInfo {
  name: string;
  url: string;
  key: string;
  size?: number;
  lastModified?: string;
}

/**
 * ファイル一覧レスポンスの型
 */
export interface FilesResponse {
  status: string;
  data: {
    photo: FileInfo[];
    drawing: FileInfo[];
    pdf: FileInfo[];
    movie: FileInfo[];
    others: FileInfo[];
  };
}

/**
 * GET /properties/{propertyId}/files - 物件ファイル一覧取得
 */
export async function getPropertyFiles(propertyId: string): Promise<FilesResponse> {
  const response = await fetch(`${API_BASE_URL}/properties/${propertyId}/files`, {
    method: 'GET',
    headers: await getHeaders(),
  });

  return handleResponse<FilesResponse>(response);
}

/**
 * DELETE /properties/{propertyId}/files?key={s3Key} - 物件ファイル削除
 */
export async function deleteFile(
  propertyId: string,
  key: string
): Promise<{ status: string; message: string }> {
  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/files?key=${encodeURIComponent(key)}`,
    {
      method: 'DELETE',
      headers: await getHeaders(),
    }
  );

  return handleResponse(response);
}

