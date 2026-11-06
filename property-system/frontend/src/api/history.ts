/**
 * 操作履歴 API クライアント
 */

import { HistoryResponse, HistorySearchParams } from '../types/history';
import { handleResponse } from './properties';
import { getFreshIdToken } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * リクエストヘッダー（期限切れを避けるため毎回トークンを取り直す）
 */
async function getAuthHeaders(): Promise<HeadersInit> {
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
 * GET /history - 操作履歴の取得（管理者のみ）
 *
 * 条件を指定しない場合は、全体の操作ログを新しい順に返す。
 */
export async function getHistory(
  params: HistorySearchParams = {}
): Promise<HistoryResponse> {
  const queryParams = new URLSearchParams();

  if (params.propertyId) queryParams.set('propertyId', params.propertyId);
  if (params.userId) queryParams.set('userId', params.userId);
  if (params.from) queryParams.set('from', params.from);
  if (params.to) queryParams.set('to', params.to);
  if (params.limit) queryParams.set('limit', params.limit.toString());

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/history${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: await getAuthHeaders(),
  });

  return handleResponse<HistoryResponse>(response);
}
