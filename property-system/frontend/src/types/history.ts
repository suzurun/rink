/**
 * 操作履歴（監査ログ）の型定義
 */

// 操作の種類
export type AuditAction =
  | 'create'      // 物件の新規登録
  | 'update'      // 物件の編集
  | 'delete'      // 物件の削除
  | 'bulkCreate'  // CSV 一括登録
  | 'fileUpload'  // ファイル追加
  | 'fileDelete'; // ファイル削除

// 画面表示用のラベル
export const ACTION_LABELS: Record<AuditAction, string> = {
  create: '新規登録',
  update: '編集',
  delete: '削除',
  bulkCreate: '一括登録',
  fileUpload: 'ファイル追加',
  fileDelete: 'ファイル削除',
};

// バッジの色
export const ACTION_COLORS: Record<AuditAction, string> = {
  create: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  update: 'bg-blue-50 text-blue-700 border-blue-200',
  delete: 'bg-red-50 text-red-700 border-red-200',
  bulkCreate: 'bg-violet-50 text-violet-700 border-violet-200',
  fileUpload: 'bg-amber-50 text-amber-700 border-amber-200',
  fileDelete: 'bg-orange-50 text-orange-700 border-orange-200',
};

// 変更された項目の内容
export interface FieldChange {
  field: string;
  label: string;
  before: string;
  after: string;
}

// 履歴 1 件
export interface HistoryEntry {
  propertyId: string;
  eventId: string;
  timestamp: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: AuditAction;
  propertyName: string;
  changes: FieldChange[];
  detail: string;
}

// 検索条件
export interface HistorySearchParams {
  propertyId?: string;
  userId?: string;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
  limit?: number;
}

// API レスポンス
export interface HistoryResponse {
  status: 'success' | 'error';
  data: HistoryEntry[];
  total: number;
}
