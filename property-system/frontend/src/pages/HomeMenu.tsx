/**
 * G00: トップページ（ログイン直後のメニュー）
 *
 * 画面仕様:
 * - 物件登録 / 物件検索 / 地図検索 / ワード検索 の 4 タイル
 * - ワード検索はこの画面で入力し、/properties?keyword=... へ渡す
 * - 最終更新（システム全体で最後に行われた編集）
 * - たまにしか使わない機能は区切り線の下にテキストリンクでまとめる
 *
 * 認可: internal / admin
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { logout, isAdmin, getFreshIdToken } from '../api/auth';
import { getHistory } from '../api/history';
import { HistoryEntry } from '../types/history';
import HomeLogo from '../components/HomeLogo';

export default function HomeMenu() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<HistoryEntry | null>(null);
  const [keyword, setKeyword] = useState('');

  // ========================================
  // 認証チェック（未ログインはログインへ誘導）
  // ========================================
  useEffect(() => {
    const checkAuth = async () => {
      // 保存済みトークンは 1 時間で切れるため、セッションから取り直して判定する
      const token = await getFreshIdToken();
      if (!token) {
        router.push('/login');
        return;
      }
      setAuthorized(true);
    };
    checkAuth();
  }, [router]);

  // 管理者権限チェック
  useEffect(() => {
    if (!authorized) return;
    const checkAdmin = async () => {
      setIsAdminUser(await isAdmin());
    };
    checkAdmin();
  }, [authorized]);

  // 最終更新の取得（履歴が無い場合や取得失敗時は何も表示しない）
  useEffect(() => {
    if (!authorized) return;
    const fetchLastUpdate = async () => {
      try {
        const response = await getHistory({ limit: 1 });
        setLastUpdate(response.data?.[0] || null);
      } catch {
        setLastUpdate(null);
      }
    };
    fetchLastUpdate();
  }, [authorized]);

  // ========================================
  // イベントハンドラー
  // ========================================
  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleWordSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = keyword.trim();
    if (!trimmed) return;
    router.push(`/properties?keyword=${encodeURIComponent(trimmed)}`);
  };

  // ========================================
  // Render
  // ========================================
  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-slate-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー（トップページ自身なのでロゴはリンクにしない） */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <HomeLogo link={false} divider />
              <span className="hidden sm:block text-sm font-semibold text-slate-500">
                物件管理システム
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-baseline gap-3 mb-5">
          <h1 className="text-lg font-bold text-slate-800">メニュー</h1>
          <p className="text-sm text-slate-400">使う機能を選んでください</p>
        </div>

        {/* 4 つのタイル */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MenuTile
            label="物件登録"
            hint="新しい物件を1件ずつ入力"
            icon={<RegisterIcon />}
            onClick={() => router.push('/properties/new')}
          />
          <MenuTile
            label="物件検索"
            hint="種別・担当者・エリアで絞る"
            icon={<SearchPropertyIcon />}
            onClick={() => router.push('/properties')}
          />
          <MenuTile
            label="地図検索"
            hint="マップ上の位置から探す"
            icon={<MapSearchIcon />}
            onClick={() => router.push('/map')}
          />

          {/* ワード検索はタイルの中で入力する */}
          <div className="bg-white border-[1.5px] border-blue-200 rounded-2xl p-4 sm:p-5 min-h-[140px] lg:min-h-[196px] flex flex-col items-center justify-center gap-3 focus-within:border-blue-600 transition-colors">
            <span className="text-slate-800">
              <WordSearchIcon />
            </span>
            <form onSubmit={handleWordSearch} className="w-full flex rounded-lg border-[1.5px] border-slate-300 overflow-hidden bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-500/20">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="キーワード"
                aria-label="ワード検索"
                className="flex-1 min-w-0 px-2.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                aria-label="検索する"
                className="px-3 bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <MagnifierIcon className="w-4 h-4" />
              </button>
            </form>
            <span className="text-base sm:text-[17px] font-bold text-slate-800 tracking-wide">
              ワード検索
            </span>
            <span className="hidden lg:block text-[11px] text-slate-400 -mt-1.5">
              物件名・住所・担当者から探す
            </span>
          </div>
        </div>

        {/* 最終更新 */}
        {lastUpdate && (
          <button
            type="button"
            onClick={() => router.push(`/properties/${lastUpdate.propertyId}`)}
            className="w-full text-left bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 mt-5 hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xs font-medium text-slate-500">最終更新</span>
              <span className="text-sm font-semibold text-slate-800">{lastUpdate.userName}</span>
              <span className="text-sm text-slate-600">{formatDateTime(lastUpdate.timestamp)}</span>
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              <span className="font-medium text-blue-600">{lastUpdate.propertyId}</span>
              {lastUpdate.propertyName && <span className="ml-1.5">{lastUpdate.propertyName}</span>}
              <span className="ml-1.5">（{describeLastUpdate(lastUpdate)}）</span>
            </div>
          </button>
        )}

        {/* その他の機能（毎日は使わないもの） */}
        <div className="mt-7 pt-4 border-t border-slate-200">
          <span className="block text-[10.5px] font-semibold tracking-[0.12em] text-slate-400 mb-2">
            その他の機能
          </span>
          <div className="flex flex-wrap gap-0.5">
            {/* テーブル編集・一括登録は横に広い画面が前提のため PC のみ */}
            <UtilityLink
              className="hidden md:inline-flex"
              icon={<TableIcon />}
              label="テーブル編集"
              onClick={() => { window.location.href = '/properties/table'; }}
            />
            <UtilityLink
              className="hidden md:inline-flex"
              icon={<UploadIcon />}
              label="一括登録"
              onClick={() => router.push('/bulk-upload')}
            />
            {/* スマホでは閲覧専用で表を開く */}
            <UtilityLink
              className="md:hidden inline-flex"
              icon={<EyeIcon />}
              label="土地・表を見る"
              onClick={() => { window.location.href = '/properties/table?view=1'; }}
            />
            {isAdminUser && (
              <UtilityLink
                icon={<UsersIcon />}
                label="ユーザー管理"
                onClick={() => router.push('/users')}
              />
            )}
            {isAdminUser && (
              <UtilityLink
                icon={<HistoryIcon />}
                label="操作ログ"
                onClick={() => router.push('/logs')}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ========================================
// 部品
// ========================================

function MenuTile({
  label,
  hint,
  icon,
  onClick,
}: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white border-[1.5px] border-blue-200 rounded-2xl p-4 sm:p-5 min-h-[140px] lg:min-h-[196px] flex flex-col items-center justify-center gap-3 text-center hover:border-blue-600 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-600/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-all"
    >
      <span className="text-slate-800">{icon}</span>
      <span className="text-base sm:text-[17px] font-bold text-slate-800 tracking-wide">
        {label}
      </span>
      <span className="hidden lg:block text-[11px] text-slate-400 -mt-1.5">{hint}</span>
    </button>
  );
}

function UtilityLink({
  icon,
  label,
  onClick,
  className = '',
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-[12.5px] text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors ${className || 'inline-flex'}`}
    >
      <span className="text-slate-400">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ========================================
// アイコン（タイル用は線画・大きめ）
// ========================================

const TILE_ICON_CLASS = 'w-11 h-11 lg:w-[62px] lg:h-[62px]';

function RegisterIcon() {
  return (
    <svg className={TILE_ICON_CLASS} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 30 32 12l22 18" />
      <path d="M15 28v22h20" />
      <path d="M49 28v6" />
      <path d="M21 50V38h9v12" />
      <circle cx="46" cy="46" r="10" />
      <path d="M46 41v10M41 46h10" />
    </svg>
  );
}

function SearchPropertyIcon() {
  return (
    <svg className={TILE_ICON_CLASS} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="28" cy="27" r="18" />
      <path d="M41 40 55 54" />
      <path d="M19 27l9-8 9 8" />
      <path d="M22 26v10h12V26" />
    </svg>
  );
}

function MapSearchIcon() {
  return (
    <svg className={TILE_ICON_CLASS} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 48V26l14-6 20 8 14-6v22" />
      <path d="M22 20v10M42 28v22" />
      <path d="M8 48l14-6 20 8 14-6" />
      <path d="M32 40s9-11 9-18a9 9 0 1 0-18 0c0 7 9 18 9 18Z" />
      <circle cx="32" cy="22" r="3.4" />
    </svg>
  );
}

function WordSearchIcon() {
  return (
    <svg className="w-8 h-8 lg:w-11 lg:h-11" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="27" cy="27" r="17" />
      <path d="M39 39 55 55" />
    </svg>
  );
}

function MagnifierIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4" />
    </svg>
  );
}

const UTILITY_ICON_CLASS = 'w-3.5 h-3.5';

function TableIcon() {
  return (
    <svg className={UTILITY_ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M3 15h18M9.5 9.5V20" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className={UTILITY_ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
      <path d="M12 4v11" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg className={UTILITY_ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className={UTILITY_ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="9" cy="7" r="3.5" />
      <path d="M22 20v-1.5a4 4 0 0 0-3-3.87" />
      <path d="M16 3.6a3.5 3.5 0 0 1 0 6.8" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg className={UTILITY_ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 4v4h4" />
      <path d="M12 8v4.5l3 1.8" />
    </svg>
  );
}

// ========================================
// ユーティリティ
// ========================================

function formatDateTime(isoStr: string): string {
  const date = new Date(isoStr);
  if (Number.isNaN(date.getTime())) return isoStr;

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');

  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
}

/**
 * 最終更新の内容を短く説明する
 * 例: 「担当者を変更」「担当者ほか2項目を変更」「新規登録」
 */
function describeLastUpdate(entry: HistoryEntry): string {
  switch (entry.action) {
    case 'create':
      return '新規登録';
    case 'delete':
      return '削除';
    case 'bulkCreate':
      return 'CSV一括登録';
    case 'fileUpload':
      return entry.detail ? `ファイルを追加 ${entry.detail}` : 'ファイルを追加';
    case 'fileDelete':
      return entry.detail ? `ファイルを削除 ${entry.detail}` : 'ファイルを削除';
    case 'update': {
      const changes = entry.changes || [];
      if (changes.length === 0) return '編集';
      if (changes.length === 1) return `${changes[0].label}を変更`;
      return `${changes[0].label}ほか${changes.length - 1}項目を変更`;
    }
    default:
      return '編集';
  }
}
