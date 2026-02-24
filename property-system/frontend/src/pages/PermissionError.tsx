/**
 * G10: 権限エラー画面
 *
 * 画面仕様:
 * - アクセス権限がない場合に表示
 * - エラーメッセージと戻るボタン
 *
 * 全ユーザーがアクセス可能
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export default function PermissionError() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* アイコン */}
          <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
            <ShieldExclamationIcon className="w-10 h-10 text-red-600" />
          </div>

          {/* タイトル */}
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            アクセス権限がありません
          </h1>

          {/* メッセージ */}
          <p className="text-slate-600 mb-8">
            このページにアクセスする権限がありません。
            <br />
            必要な場合は管理者にお問い合わせください。
          </p>

          {/* エラーコード */}
          <div className="bg-slate-50 rounded-lg p-4 mb-8">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
              エラーコード
            </p>
            <p className="text-lg font-mono font-semibold text-slate-700">403 Forbidden</p>
          </div>

          {/* ボタン */}
          <div className="space-y-3">
            <button
              onClick={() => router.push('/properties')}
              className="w-full py-3 px-4 text-white bg-blue-600 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              物件一覧に戻る
            </button>
            <button
              onClick={() => router.back()}
              className="w-full py-3 px-4 text-slate-700 bg-white border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              前のページに戻る
            </button>
          </div>
        </div>

        {/* ヘルプリンク */}
        <div className="text-center mt-6">
          <p className="text-sm text-slate-500">
            問題が解決しない場合は
            <a
              href="mailto:support@example.com"
              className="text-blue-600 hover:text-blue-800 hover:underline ml-1"
            >
              サポートにお問い合わせください
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ========================================
// アイコン
// ========================================
function ShieldExclamationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016zM12 9v2m0 4h.01"
      />
    </svg>
  );
}






