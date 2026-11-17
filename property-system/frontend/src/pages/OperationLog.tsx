/**
 * 操作ログ画面（管理者専用）
 *
 * 「誰が・いつ・どの物件を・どう変更したか」を一覧で確認する。
 *
 * 機能:
 * - ユーザー別 / 期間別 / 物件別の絞り込み
 * - 変更項目の before → after 表示
 * - CSV 出力
 *
 * 認可: admin のみ
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { isAdmin, getFreshIdToken } from '../api/auth';
import { getHistory } from '../api/history';
import { HistoryEntry, ACTION_LABELS, ACTION_COLORS } from '../types/history';
import HomeLogo from '../components/HomeLogo';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// 期間プリセット
const PERIOD_OPTIONS = [
  { value: '7', label: '直近7日' },
  { value: '30', label: '直近30日' },
  { value: '90', label: '直近90日' },
  { value: 'all', label: '全期間' },
  { value: 'custom', label: '期間を指定' },
];

interface UserOption {
  userId: string;
  email: string;
  name?: string;
}

export default function OperationLog() {
  const router = useRouter();

  // 権限
  const [hasPermission, setHasPermission] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(true);

  // データ
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 絞り込み条件
  const [userId, setUserId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [period, setPeriod] = useState('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // ========================================
  // 権限チェック
  // ========================================
  useEffect(() => {
    const checkPermission = async () => {
      const admin = await isAdmin();
      setHasPermission(admin);
      setCheckingPermission(false);

      if (!admin) {
        window.location.href = '/permission-error';
      }
    };
    checkPermission();
  }, []);

  // ========================================
  // ユーザー一覧の取得（絞り込み用）
  // ========================================
  useEffect(() => {
    if (!hasPermission) return;

    const fetchUsers = async () => {
      try {
        const token = await getFreshIdToken();
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;

        const data = await response.json();
        setUsers(data.users || []);
      } catch {
        // ユーザー一覧が取れなくてもログ自体は見られるので握り潰す
      }
    };

    fetchUsers();
  }, [hasPermission]);

  // ========================================
  // 履歴の取得
  // ========================================
  const fetchHistory = useCallback(async () => {
    if (!hasPermission) return;

    setLoading(true);
    setError(null);

    try {
      const { from, to } = resolvePeriod(period, customFrom, customTo);

      const response = await getHistory({
        userId: userId || undefined,
        propertyId: propertyId.trim() || undefined,
        from,
        to,
        limit: 1000,
      });

      setEntries(response.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作ログの取得に失敗しました');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [hasPermission, userId, propertyId, period, customFrom, customTo]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ========================================
  // CSV 出力
  // ========================================
  const handleExportCsv = () => {
    if (entries.length === 0) return;

    const header = ['日時', 'ユーザー', 'メールアドレス', '操作', '物件ID', '物件名', '変更内容'];
    const rows = entries.map((entry) => [
      formatDateTime(entry.timestamp),
      entry.userName,
      entry.userEmail,
      ACTION_LABELS[entry.action] || entry.action,
      entry.propertyId,
      entry.propertyName,
      describeChanges(entry),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    // Excel で開いたときに文字化けしないよう BOM を付与
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `操作ログ_${formatFileDate(new Date())}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  const handleClearFilters = () => {
    setUserId('');
    setPropertyId('');
    setPeriod('30');
    setCustomFrom('');
    setCustomTo('');
  };

  // ========================================
  // Render
  // ========================================
  if (checkingPermission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">権限を確認しています...</p>
      </div>
    );
  }

  if (!hasPermission) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* スマホは幅が足りないので2段（上=ロゴと画面名／下=操作ボタン）にする */}
          <div className="flex flex-col gap-2 py-2.5 md:flex-row md:items-center md:justify-between md:gap-3 md:py-0 md:h-16">
            <div className="flex items-center gap-3 overflow-x-auto -mx-1 px-1 md:overflow-visible md:mx-0 md:px-0">
              <HomeLogo divider />
              <h1 className="text-xl font-bold text-slate-800 whitespace-nowrap">操作ログ</h1>
            </div>
            <div className="flex items-center gap-3 overflow-x-auto -mx-1 px-1 md:overflow-visible md:mx-0 md:px-0">
              <button
                onClick={handleExportCsv}
                disabled={entries.length === 0}
                className="shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                CSV出力
              </button>
              <button
                onClick={() => router.push('/properties')}
                className="shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                物件一覧へ戻る
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 絞り込み */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* ユーザー */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">ユーザー</label>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全員</option>
                {users.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            </div>

            {/* 期間 */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">期間</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 物件ID */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">物件ID</label>
              <input
                type="text"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                placeholder="例: P00001"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* クリア */}
            <div className="flex items-end">
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                条件をクリア
              </button>
            </div>
          </div>

          {/* 期間を指定した場合の日付入力 */}
          {period === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">開始日</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">終了日</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* エラー */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 件数 */}
        <div className="mb-3 text-sm text-slate-500">
          {loading ? '読み込み中...' : `${entries.length} 件の操作履歴`}
        </div>

        {/* 一覧 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">日時</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">ユーザー</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">操作</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">物件</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">変更内容</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading && entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                      該当する操作履歴はありません
                    </td>
                  </tr>
                )}

                {entries.map((entry) => (
                  <tr key={`${entry.propertyId}-${entry.eventId}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap align-top">
                      {formatDateTime(entry.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-slate-800 whitespace-nowrap align-top">
                      <div className="font-medium">{entry.userName}</div>
                      {entry.userEmail && (
                        <div className="text-xs text-slate-400">{entry.userEmail}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap align-top">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-medium border rounded ${
                          ACTION_COLORS[entry.action] || 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {ACTION_LABELS[entry.action] || entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <button
                        onClick={() => router.push(`/properties/${entry.propertyId}`)}
                        className="text-blue-600 hover:underline font-medium whitespace-nowrap"
                      >
                        {entry.propertyId}
                      </button>
                      {entry.propertyName && (
                        <div className="text-xs text-slate-500">{entry.propertyName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 align-top">
                      <ChangeSummary entry={entry} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

// ========================================
// 変更内容の表示
// ========================================
function ChangeSummary({ entry }: { entry: HistoryEntry }) {
  if (entry.changes && entry.changes.length > 0) {
    return (
      <ul className="space-y-0.5">
        {entry.changes.map((change) => (
          <li key={change.field} className="text-xs">
            <span className="text-slate-500">{change.label}</span>
            <span className="mx-1.5 text-slate-400 line-through">{change.before}</span>
            <span className="text-slate-400">→</span>
            <span className="ml-1.5 text-slate-800 font-medium">{change.after}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (entry.detail) {
    return <span className="text-xs">{entry.detail}</span>;
  }

  return <span className="text-xs text-slate-300">—</span>;
}

// ========================================
// ユーティリティ
// ========================================

/** 期間プリセットを YYYY-MM-DD の範囲に変換する */
function resolvePeriod(
  period: string,
  customFrom: string,
  customTo: string
): { from?: string; to?: string } {
  if (period === 'all') return {};

  if (period === 'custom') {
    if (!customFrom || !customTo) return {};
    return { from: customFrom, to: customTo };
  }

  const days = Number(period);
  if (!Number.isFinite(days)) return {};

  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days + 1);

  return { from: toDateInput(from), to: toDateInput(to) };
}

/** Date → YYYY-MM-DD（ローカル時間基準） */
function toDateInput(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** ISO8601 → 2026/08/31 14:20 */
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

/** ファイル名用の日付（20260831） */
function formatFileDate(date: Date): string {
  return toDateInput(date).replace(/-/g, '');
}

/** CSV 用に変更内容を 1 セルへまとめる */
function describeChanges(entry: HistoryEntry): string {
  if (entry.changes && entry.changes.length > 0) {
    return entry.changes
      .map((change) => `${change.label}: ${change.before} → ${change.after}`)
      .join(' / ');
  }
  return entry.detail || '';
}
