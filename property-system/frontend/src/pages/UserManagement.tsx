
/**
 * G09: ユーザー管理画面（管理者専用）
 *
 * 画面仕様:
 * - ユーザー一覧表示
 * - ユーザーグループ（admin/internal/external）の確認・変更
 * - ユーザーの有効化/無効化
 * - 新規ユーザー招待
 *
 * 認可: admin のみ
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { isAdmin, getIdToken, getFreshIdToken } from '../api/auth';
import HomeLogo from '../components/HomeLogo';

// API ベース URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// ユーザーグループ定義
const USER_GROUPS = [
  { id: 'admin', label: '管理者', color: 'red', description: '全機能にアクセス可能' },
  { id: 'internal', label: '社内', color: 'blue', description: '物件の閲覧・編集が可能' },
  { id: 'external', label: '外部', color: 'gray', description: '物件の閲覧のみ' },
];

// ユーザーの型
interface User {
  userId: string;
  email: string;
  name?: string;
  groups: string[];
  status: 'CONFIRMED' | 'UNCONFIRMED' | 'FORCE_CHANGE_PASSWORD' | 'DISABLED';
  createdAt?: string;
  lastLogin?: string;
}

// モーダルの状態
type ModalType = 'invite' | 'editGroup' | 'confirm' | null;

export default function UserManagement() {
  // State
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(true);

  // モーダル
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // 招待フォーム
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteGroup, setInviteGroup] = useState('internal');
  const [inviteLoading, setInviteLoading] = useState(false);

  // グループ編集
  const [editGroupValue, setEditGroupValue] = useState('');

  // 確認ダイアログ
  const [confirmAction, setConfirmAction] = useState<'enable' | 'disable' | 'delete' | null>(null);

  // 検索
  const [searchQuery, setSearchQuery] = useState('');

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
  // ユーザー一覧取得
  // ========================================
  const fetchUsers = useCallback(async () => {
    if (!hasPermission) return;

    setLoading(true);
    setError(null);

    try {
      const token = await getFreshIdToken();
      if (!token) {
        throw new Error('認証が必要です。再ログインしてください。');
      }
      const response = await fetch(`${API_BASE_URL}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('ユーザー一覧の取得に失敗しました');
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      // デモ用のダミーデータ
      setUsers([
        {
          userId: '1',
          email: 'admin@example.com',
          name: '管理者',
          groups: ['admin'],
          status: 'CONFIRMED',
          createdAt: '2024-01-01T00:00:00Z',
          lastLogin: '2024-12-10T10:00:00Z',
        },
        {
          userId: '2',
          email: 'user1@example.com',
          name: '田中太郎',
          groups: ['internal'],
          status: 'CONFIRMED',
          createdAt: '2024-02-15T00:00:00Z',
          lastLogin: '2024-12-09T15:30:00Z',
        },
        {
          userId: '3',
          email: 'user2@example.com',
          name: '佐藤花子',
          groups: ['internal'],
          status: 'CONFIRMED',
          createdAt: '2024-03-20T00:00:00Z',
          lastLogin: '2024-12-08T09:00:00Z',
        },
        {
          userId: '4',
          email: 'external@partner.com',
          name: '外部パートナー',
          groups: ['external'],
          status: 'CONFIRMED',
          createdAt: '2024-06-01T00:00:00Z',
          lastLogin: '2024-12-05T14:00:00Z',
        },
        {
          userId: '5',
          email: 'pending@example.com',
          groups: ['internal'],
          status: 'FORCE_CHANGE_PASSWORD',
          createdAt: '2024-12-01T00:00:00Z',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  useEffect(() => {
    if (hasPermission) {
      fetchUsers();
    }
  }, [hasPermission, fetchUsers]);

  // ========================================
  // ユーザー招待
  // ========================================
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);

    try {
      const token = await getFreshIdToken();
      if (!token) {
        throw new Error('認証が必要です。再ログインしてください。');
      }
      const response = await fetch(`${API_BASE_URL}/users/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: inviteEmail,
          group: inviteGroup,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || '招待に失敗しました');
      }

      alert(`${inviteEmail} に招待メールを送信しました`);
      setModalType(null);
      setInviteEmail('');
      setInviteGroup('internal');
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : '招待に失敗しました');
    } finally {
      setInviteLoading(false);
    }
  };

  // ========================================
  // グループ変更
  // ========================================
  const handleUpdateGroup = async () => {
    if (!selectedUser || !editGroupValue) return;

    try {
      const token = await getFreshIdToken();
      if (!token) {
        throw new Error('認証が必要です。再ログインしてください。');
      }
      const response = await fetch(`${API_BASE_URL}/users/${selectedUser.userId}/group`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ group: editGroupValue }),
      });

      if (!response.ok) {
        throw new Error('グループの変更に失敗しました');
      }

      alert('グループを変更しました');
      setModalType(null);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'グループの変更に失敗しました');
    }
  };

  // ========================================
  // ユーザー有効化/無効化/削除
  // ========================================
  const handleUserAction = async () => {
    if (!selectedUser || !confirmAction) return;

    try {
      const token = await getFreshIdToken();
      if (!token) {
        throw new Error('認証が必要です。再ログインしてください。');
      }
      let endpoint = '';
      let method = 'PUT';

      switch (confirmAction) {
        case 'enable':
          endpoint = `/users/${selectedUser.userId}/enable`;
          break;
        case 'disable':
          endpoint = `/users/${selectedUser.userId}/disable`;
          break;
        case 'delete':
          endpoint = `/users/${selectedUser.userId}`;
          method = 'DELETE';
          break;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('操作に失敗しました');
      }

      const actionText =
        confirmAction === 'enable' ? '有効化' : confirmAction === 'disable' ? '無効化' : '削除';
      alert(`ユーザーを${actionText}しました`);
      setModalType(null);
      setSelectedUser(null);
      setConfirmAction(null);
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作に失敗しました');
    }
  };

  // ========================================
  // フィルタリング
  // ========================================
  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ========================================
  // 権限チェック中/権限なし
  // ========================================
  if (checkingPermission) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!hasPermission) {
    return null; // リダイレクト中
  }

  // ========================================
  // Render
  // ========================================
  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3 sm:gap-4">
              <HomeLogo divider />
              <button
                onClick={() => {
                  window.location.href = '/properties';
                }}
                className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
              >
                <BackIcon className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-slate-800">ユーザー管理</h1>
              <span className="px-2.5 py-0.5 text-xs font-medium text-red-700 bg-red-100 rounded-full">
                管理者専用
              </span>
            </div>
            <button
              onClick={() => setModalType('invite')}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              ユーザーを招待
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 統計 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="総ユーザー数" value={users.length} icon={<UsersIcon />} />
          <StatCard
            label="管理者"
            value={users.filter((u) => u.groups.includes('admin')).length}
            color="red"
            icon={<ShieldIcon />}
          />
          <StatCard
            label="社内ユーザー"
            value={users.filter((u) => u.groups.includes('internal')).length}
            color="blue"
            icon={<BuildingIcon />}
          />
          <StatCard
            label="外部ユーザー"
            value={users.filter((u) => u.groups.includes('external')).length}
            color="gray"
            icon={<GlobeIcon />}
          />
        </div>

        {/* 検索 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="メールアドレスまたは名前で検索..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* エラー */}
        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-700">
              {error}（デモデータを表示しています）
            </p>
          </div>
        )}

        {/* ユーザー一覧 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto"></div>
              <p className="mt-4 text-slate-600">読み込み中...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center">
              <UsersIcon className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">ユーザーが見つかりません</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      ユーザー
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      グループ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      ステータス
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      最終ログイン
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredUsers.map((user) => (
                    <UserRow
                      key={user.userId}
                      user={user}
                      onEditGroup={() => {
                        setSelectedUser(user);
                        setEditGroupValue(user.groups[0] || 'internal');
                        setModalType('editGroup');
                      }}
                      onToggleStatus={() => {
                        setSelectedUser(user);
                        setConfirmAction(user.status === 'DISABLED' ? 'enable' : 'disable');
                        setModalType('confirm');
                      }}
                      onDelete={() => {
                        setSelectedUser(user);
                        setConfirmAction('delete');
                        setModalType('confirm');
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          最終ログインは、ログイン記録の仕組みを入れた日以降のサインインから記録されます。
          それ以前のログインは記録が残っていないため「記録なし」と表示されます。
        </p>
      </main>

      {/* 招待モーダル */}
      {modalType === 'invite' && (
        <Modal title="ユーザーを招待" onClose={() => setModalType(null)}>
          <form onSubmit={handleInviteUser} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                メールアドレス
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                グループ
              </label>
              <select
                value={inviteGroup}
                onChange={(e) => setInviteGroup(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {USER_GROUPS.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.label} - {group.description}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={inviteLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {inviteLoading ? '送信中...' : '招待メールを送信'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* グループ編集モーダル */}
      {modalType === 'editGroup' && selectedUser && (
        <Modal title="グループを変更" onClose={() => setModalType(null)}>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600 mb-4">
                <strong>{selectedUser.email}</strong> のグループを変更します
              </p>
              <div className="space-y-2">
                {USER_GROUPS.map((group) => (
                  <label
                    key={group.id}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      editGroupValue === group.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="group"
                      value={group.id}
                      checked={editGroupValue === group.id}
                      onChange={(e) => setEditGroupValue(e.target.value)}
                      className="sr-only"
                    />
                    <GroupBadge group={group.id} />
                    <span className="ml-3 text-sm text-slate-600">{group.description}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleUpdateGroup}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                変更を保存
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 確認モーダル */}
      {modalType === 'confirm' && selectedUser && confirmAction && (
        <Modal
          title={
            confirmAction === 'delete'
              ? 'ユーザーを削除'
              : confirmAction === 'enable'
              ? 'ユーザーを有効化'
              : 'ユーザーを無効化'
          }
          onClose={() => {
            setModalType(null);
            setConfirmAction(null);
          }}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              <strong>{selectedUser.email}</strong> を
              {confirmAction === 'delete' && '削除'}
              {confirmAction === 'enable' && '有効化'}
              {confirmAction === 'disable' && '無効化'}
              してもよろしいですか？
              {confirmAction === 'delete' && (
                <span className="block mt-2 text-red-600">
                  この操作は取り消せません。
                </span>
              )}
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => {
                  setModalType(null);
                  setConfirmAction(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleUserAction}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${
                  confirmAction === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmAction === 'delete' && '削除する'}
                {confirmAction === 'enable' && '有効化する'}
                {confirmAction === 'disable' && '無効化する'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ========================================
// ユーザー行コンポーネント
// ========================================
interface UserRowProps {
  user: User;
  onEditGroup: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}

function UserRow({ user, onEditGroup, onToggleStatus, onDelete }: UserRowProps) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-6 py-4">
        <div className="flex items-center">
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium">
            {user.name?.[0] || user.email[0].toUpperCase()}
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-slate-800">{user.name || '名前未設定'}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <GroupBadge group={user.groups[0]} />
      </td>
      <td className="px-6 py-4">
        <StatusBadge status={user.status} />
      </td>
      <td className="px-6 py-4 text-sm text-slate-500">
        {user.lastLogin ? (
          formatLoginTime(user.lastLogin)
        ) : (
          <span className="text-slate-400">記録なし</span>
        )}
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex justify-end gap-2">
          <button
            onClick={onEditGroup}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="グループを変更"
          >
            <EditIcon className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleStatus}
            className="p-1.5 text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 rounded"
            title={user.status === 'DISABLED' ? '有効化' : '無効化'}
          >
            {user.status === 'DISABLED' ? (
              <CheckCircleIcon className="w-4 h-4" />
            ) : (
              <BanIcon className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="削除"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ========================================
// グループバッジ
// ========================================
function GroupBadge({ group }: { group?: string }) {
  const groupInfo = USER_GROUPS.find((g) => g.id === group) || USER_GROUPS[2];

  const colorClasses: Record<string, string> = {
    red: 'text-red-700 bg-red-100',
    blue: 'text-blue-700 bg-blue-100',
    gray: 'text-slate-700 bg-slate-100',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${
        colorClasses[groupInfo.color]
      }`}
    >
      {groupInfo.label}
    </span>
  );
}

// ========================================
// ステータスバッジ
// ========================================
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    CONFIRMED: { label: '有効', className: 'text-green-700 bg-green-100' },
    UNCONFIRMED: { label: '未確認', className: 'text-yellow-700 bg-yellow-100' },
    FORCE_CHANGE_PASSWORD: { label: '初回ログイン待ち', className: 'text-blue-700 bg-blue-100' },
    DISABLED: { label: '無効', className: 'text-slate-700 bg-slate-100' },
  };

  const config = statusConfig[status] || statusConfig.CONFIRMED;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${config.className}`}>
      {config.label}
    </span>
  );
}

// ========================================
// 統計カード
// ========================================
interface StatCardProps {
  label: string;
  value: number;
  color?: string;
  icon: React.ReactNode;
}

function StatCard({ label, value, color = 'slate', icon }: StatCardProps) {
  const colorClasses: Record<string, string> = {
    red: 'text-red-600 bg-red-50',
    blue: 'text-blue-600 bg-blue-50',
    gray: 'text-slate-600 bg-slate-100',
    slate: 'text-slate-600 bg-slate-50',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-slate-800">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ========================================
// モーダル
// ========================================
interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ========================================
// アイコン
// ========================================
function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className || 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function BanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

/**
 * 最終ログイン日時の表示（今日ログインしたかが分かるよう時刻まで出す）
 */
function formatLoginTime(isoStr: string): string {
  const date = new Date(isoStr);
  if (Number.isNaN(date.getTime())) return isoStr;

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');

  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
}
