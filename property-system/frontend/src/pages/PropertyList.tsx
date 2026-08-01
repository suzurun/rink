/**
 * G02: 物件一覧（ホーム画面）
 *
 * 画面仕様:
 * - 検索バー（キーワード／住所／担当者）
 * - 絞り込み: 大項目・中項目・小項目、用途地域、構造、引渡時期
 * - 並び順：最新順／名称順
 * - 一覧：カードビュー（iPad向け）
 * - 地図ビューへ切替ボタン
 * - 新規登録（PCのみ表示）
 *
 * 認可: internal / admin
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getProperties } from '../api/properties';
import { logout, isAdmin } from '../api/auth';
import {
  PropertyListItem,
  PropertySearchParams,
  TYPE_LARGE_OPTIONS,
  TYPE_MEDIUM_OPTIONS,
} from '../types/property';

// ページあたりの表示件数
const PAGE_SIZE = 20;

export default function PropertyList() {
  const router = useRouter();

  // ========================================
  // State
  // ========================================
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ページネーション
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // 検索・フィルター
  const [keyword, setKeyword] = useState('');
  const [typeLarge, setTypeLarge] = useState('');
  const [typeMedium, setTypeMedium] = useState('');
  const [staff, setStaff] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'staff' | 'typeLarge'>('name');

  // 管理者権限
  const [isAdminUser, setIsAdminUser] = useState(false);

  // 管理者権限チェック
  useEffect(() => {
    const checkAdmin = async () => {
      const admin = await isAdmin();
      setIsAdminUser(admin);
    };
    checkAdmin();
  }, []);

  // マップ未登録フィルター
  const [noMapOnly, setNoMapOnly] = useState(false);

  // フィルターパネル表示
  const [showFilters, setShowFilters] = useState(false);

  // ビューモード（list / map）
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // ========================================
  // データ取得
  // ========================================
  const fetchProperties = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params: PropertySearchParams = {
        page: currentPage,
        limit: PAGE_SIZE,
      };

      if (keyword.trim()) params.keyword = keyword.trim();
      if (typeLarge) params.typeLarge = typeLarge;
      if (typeMedium) params.typeMedium = typeMedium;
      if (staff.trim()) params.staff = staff.trim();
      if (sortBy) params.sortBy = sortBy;

      const response = await getProperties(params);

      if (response.status === 'success') {
        setProperties(response.data);
        setTotalCount(response.total);
      } else {
        setError('データの取得に失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [currentPage, keyword, typeLarge, typeMedium, staff, sortBy]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  // ========================================
  // イベントハンドラー
  // ========================================
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchProperties();
  };

  const handleClearFilters = () => {
    setKeyword('');
    setTypeLarge('');
    setTypeMedium('');
    setStaff('');
    setNoMapOnly(false);
    setCurrentPage(1);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleNewProperty = () => {
    router.push('/properties/new');
  };

  const handleMapView = () => {
    router.push('/map');
  };

  // ========================================
  // 中項目の選択肢（大項目に連動）
  // ========================================
  const mediumOptions = typeLarge ? TYPE_MEDIUM_OPTIONS[typeLarge] || [] : [];

  // ========================================
  // Render
  // ========================================
  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-slate-800">物件一覧</h1>
            <div className="flex items-center gap-3">
              {/* ユーザー管理（管理者のみ） */}
              {isAdminUser && (
                <button
                  onClick={() => router.push('/users')}
                  className="inline-flex items-center px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <UsersIcon className="w-4 h-4 mr-1.5" />
                  ユーザー管理
                </button>
              )}
              {/* ログアウトボタン */}
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                ログアウト
              </button>
              {/* 地図ビュー切替 */}
              <button
                onClick={handleMapView}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <MapIcon className="w-4 h-4 mr-2" />
                地図で表示
              </button>
              {/* テーブル閲覧（スマホのみ・閲覧専用） */}
              <button
                onClick={() => { window.location.href = '/properties/table?view=1'; }}
                className="md:hidden inline-flex items-center px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <TableIcon className="w-4 h-4 mr-1.5" />
                土地・表を見る
              </button>
              {/* テーブル編集（PCのみ） */}
              <button
                onClick={() => { window.location.href = '/properties/table'; }}
                className="hidden md:inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <TableIcon className="w-4 h-4 mr-2" />
                テーブル編集
              </button>
              {/* 一括登録（PCのみ） */}
              <button
                onClick={() => router.push('/bulk-upload')}
                className="hidden md:inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <UploadIcon className="w-4 h-4 mr-2" />
                一括登録
              </button>
              {/* 新規登録（PCのみ） */}
              <button
                onClick={handleNewProperty}
                className="hidden md:inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                新規登録
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 検索・フィルター */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <form onSubmit={handleSearch}>
            {/* 並び順 */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs font-medium text-slate-600">並び順</span>
              {[
                { value: 'name', label: 'あいうえお順' },
                { value: 'staff', label: '担当者順' },
                { value: 'typeLarge', label: '種類順' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSortBy(option.value as 'name' | 'staff' | 'typeLarge')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                    sortBy === option.value
                      ? 'text-blue-700 bg-blue-50 border-blue-300'
                      : 'text-slate-700 bg-white border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <div className="ml-auto">
                <button
                  type="button"
                  onClick={() => { setNoMapOnly(!noMapOnly); setCurrentPage(1); }}
                  className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                    noMapOnly
                      ? 'text-orange-700 bg-orange-50 border-orange-300'
                      : 'text-slate-700 bg-white border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <NoMapIcon className="w-4 h-4 mr-1.5" />
                  マップ未登録のみ
                </button>
              </div>
            </div>

            {/* 検索バー */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1 relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="物件名・住所で検索..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center px-4 py-2.5 text-sm font-medium border rounded-lg transition-colors ${
                  showFilters
                    ? 'text-blue-700 bg-blue-50 border-blue-300'
                    : 'text-slate-700 bg-white border-slate-300 hover:bg-slate-50'
                }`}
              >
                <FilterIcon className="w-4 h-4 mr-2" />
                絞り込み
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                検索
              </button>
            </div>

            {/* フィルターパネル */}
            {showFilters && (
              <div className="pt-4 border-t border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* 大項目 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      大項目
                    </label>
                    <select
                      value={typeLarge}
                      onChange={(e) => {
                        setTypeLarge(e.target.value);
                        setTypeMedium('');
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      <option value="">すべて</option>
                      {TYPE_LARGE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 中項目 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      中項目
                    </label>
                    <select
                      value={typeMedium}
                      onChange={(e) => setTypeMedium(e.target.value)}
                      disabled={!typeLarge}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="">すべて</option>
                      {mediumOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 担当者 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      担当者
                    </label>
                    <input
                      type="text"
                      value={staff}
                      onChange={(e) => setStaff(e.target.value)}
                      placeholder="担当者名"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  {/* クリアボタン */}
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="w-full px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      条件をクリア
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* 件数表示 */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-600">
            {totalCount > 0 ? (
              <>
                <span className="font-semibold text-slate-800">{totalCount}</span> 件の物件
                {totalPages > 1 && (
                  <span className="ml-2">
                    （{currentPage} / {totalPages} ページ）
                  </span>
                )}
              </>
            ) : (
              '物件が見つかりません'
            )}
          </p>
        </div>

        {/* ローディング */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
            <span className="ml-3 text-slate-600">読み込み中...</span>
          </div>
        )}

        {/* エラー */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={fetchProperties}
              className="mt-2 text-sm font-medium text-red-700 hover:text-red-800"
            >
              再試行
            </button>
          </div>
        )}

        {/* 物件カード一覧 */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties
              .filter((p) => !noMapOnly || (!p.lat && !p.lng))
              .map((property) => (
                <PropertyCard
                  key={property.propertyId}
                  property={property}
                />
              ))}
          </div>
        )}

        {/* ページネーション */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center mt-8 gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              前へ
            </button>

            {/* ページ番号 */}
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i;
                if (pageNum > totalPages) return null;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 text-sm font-medium rounded-lg transition-colors ${
                      pageNum === currentPage
                        ? 'text-white bg-blue-600'
                        : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              次へ
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// ========================================
// 物件カードコンポーネント
// ========================================
interface PropertyCardProps {
  property: PropertyListItem;
}

function PropertyCard({ property }: PropertyCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md hover:border-blue-300 transition-all">

      {/* 物件名 + マップ未登録バッジ */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-lg font-semibold text-slate-800 truncate">{property.name}</h3>
        {!property.lat && !property.lng && (
          <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-full">
            マップ未登録
          </span>
        )}
      </div>

      {/* 住所 */}
      <p className="text-sm text-slate-600 mb-3 flex items-start">
        <LocationIcon className="w-4 h-4 mr-1.5 mt-0.5 text-slate-400 flex-shrink-0" />
        <span className="truncate">
          {property.prefecture}
          {property.city}
          {property.address}
        </span>
      </p>

      {/* タグ */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-full">
          {property.typeLarge}
        </span>
        {property.typeMedium && (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-full">
            {property.typeMedium}
          </span>
        )}
        {property.typeSmall && (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-full">
            {property.typeSmall}
          </span>
        )}
      </div>

      {/* 担当者 */}
      {property.staff && (
        <p className="text-xs text-slate-500 flex items-center mb-3">
          <UserIcon className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
          担当: {property.staff}
        </p>
      )}

      {/* 詳細ボタン */}
      <div className="mt-4 pt-3 border-t border-slate-100">
        <button
          onClick={() => { window.location.href = `/properties/${property.propertyId}/`; }}
          className="block w-full py-2 px-4 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors text-center cursor-pointer"
        >
          詳細を見る →
        </button>
      </div>
    </div>
  );
}

// ========================================
// アイコンコンポーネント
// ========================================
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function LocationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function TableIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );
}

function NoMapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  );
}

