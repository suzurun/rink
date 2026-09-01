/**
 * 物件データの型定義
 */

import { PROPERTY_CATEGORIES } from '../config/propertyCategories';

// 物件一覧用（軽量版）
export interface PropertyListItem {
  propertyId: string;
  name: string;
  prefecture: string;
  city: string;
  address: string;
  typeLarge: string;
  typeMedium?: string;
  typeSmall?: string;
  staff?: string;
  lat?: number;
  lng?: number;
}

// 物件詳細用（完全版）
export interface Property extends PropertyListItem {
  // RBS 物件かどうか（該当する物件だけ 'RBS'、それ以外は空欄）
  rbs?: string;
  // 物件区分（リンクの物件か、預かりの物件か）
  ownershipType?: string;
  siteStaff?: string;
  zipcode: string;
  landUse?: string;
  structure?: string;
  area?: number | string;
  owner?: string;
  deliveryDate?: string;
  memo?: string;
  files?: PropertyFiles;
  createdAt?: string;
  updatedAt?: string;
  // 登録者・更新者（操作履歴と連動）
  createdBy?: string;
  createdByEmail?: string;
  updatedBy?: string;
  updatedByEmail?: string;
}

// ファイル一覧
export interface PropertyFiles {
  photo: string[];
  drawing: string[];
  pdf: string[];
  movie: string[];
  others?: string[];
}

// 検索パラメータ
export interface PropertySearchParams {
  keyword?: string;
  typeLarge?: string;
  typeMedium?: string;
  typeSmall?: string;
  staff?: string;
  sortBy?: 'name' | 'staff' | 'typeLarge';
  page?: number;
  limit?: number;
}

// API レスポンス
export interface PropertyListResponse {
  status: 'success' | 'error';
  data: PropertyListItem[];
  page: number;
  limit: number;
  total: number;
}

export interface PropertyDetailResponse {
  status: 'success' | 'error';
  data: Property;
}

// RBS の選択肢（空欄＝RBSではない／未記入）
export const RBS_OPTIONS = ['RBS'];

// 物件区分の選択肢（空欄＝未記入）
export const OWNERSHIP_TYPE_OPTIONS = ['リンク', '預かり'];

// 大項目・中項目の選択肢
export const TYPE_LARGE_OPTIONS = PROPERTY_CATEGORIES.map((item) => item.type);

export const TYPE_MEDIUM_OPTIONS: Record<string, string[]> = PROPERTY_CATEGORIES.reduce(
  (acc, item) => {
    acc[item.type] = item.mediumOptions || [];
    return acc;
  },
  {} as Record<string, string[]>
);

export const STRUCTURE_OPTIONS = [
  '木造',
  'S造',
  'RC造',
  'SRC造',
  '軽量鉄骨造',
  'その他',
];

export const LAND_USE_OPTIONS = [
  '第一種住居地域',
  '第二種住居地域',
  '準住居地域',
  '近隣商業地域',
  '商業地域',
  '準工業地域',
  '工業地域',
  '工業専用地域',
  '市街化調整区域',
];






