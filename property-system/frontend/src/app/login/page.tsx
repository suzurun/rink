/**
 * G01: ログイン画面
 *
 * AWS Amplify を使用した Cognito 認証
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  login,
  confirmNewPassword,
  forgotPassword,
  confirmForgotPassword,
  isAuthenticated,
  register,
  confirmRegistration,
} from '../../api/auth';

type ViewMode = 'login' | 'newPassword' | 'forgotPassword' | 'confirmReset' | 'register' | 'confirmRegister';

export default function LoginPage() {
  const router = useRouter();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [name, setName] = useState('');
  const [registerCode, setRegisterCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false); // 最初からfalseにしてログイン画面を表示

  // 既にログイン済みかチェック（バックグラウンドで実行）
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // クライアントサイドでのみ実行
        if (typeof window === 'undefined') return;
        
        const authenticated = await isAuthenticated();
        if (authenticated) {
          router.push('/properties');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        // エラーが発生してもログイン画面を表示し続ける
      }
    };
    checkAuth();
  }, [router]);

  // ========================================
  // ログイン処理
  // ========================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const result = await login(email, password);

      if (result.requireNewPassword) {
        // 初回ログイン時のパスワード変更
        setViewMode('newPassword');
        setError(null);
      } else if (result.success) {
        // ログイン成功
        router.push('/properties');
      } else {
        setError(result.message || 'ログインに失敗しました');
      }
    } catch (err) {
      setError('ログイン処理中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // 新しいパスワード設定（初回ログイン）
  // ========================================
  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    if (newPassword.length < 8) {
      setError('パスワードは8文字以上で入力してください');
      return;
    }

    setLoading(true);

    try {
      const result = await confirmNewPassword(newPassword);

      if (result.success) {
        router.push('/properties');
      } else {
        setError(result.message || 'パスワードの設定に失敗しました');
      }
    } catch (err) {
      setError('パスワード設定中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // パスワードリセット開始
  // ========================================
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError('メールアドレスを入力してください');
      return;
    }

    setLoading(true);

    try {
      const result = await forgotPassword(email);

      if (result.success) {
        setSuccess(result.message || '確認コードを送信しました');
        setViewMode('confirmReset');
      } else {
        setError(result.message || 'リセットに失敗しました');
      }
    } catch (err) {
      setError('パスワードリセット処理中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // パスワードリセット確認
  // ========================================
  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    if (newPassword.length < 8) {
      setError('パスワードは8文字以上で入力してください');
      return;
    }

    setLoading(true);

    try {
      const result = await confirmForgotPassword(email, resetCode, newPassword);

      if (result.success) {
        setSuccess('パスワードをリセットしました。ログインしてください。');
        setViewMode('login');
        setNewPassword('');
        setConfirmPassword('');
        setResetCode('');
      } else {
        setError(result.message || 'リセットに失敗しました');
      }
    } catch (err) {
      setError('パスワードリセット処理中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // 新規登録処理
  // ========================================
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }

    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください');
      return;
    }

    setLoading(true);

    try {
      const result = await register(email, password, name || undefined);

      if (result.success) {
        setSuccess(result.message || '確認コードをメールで送信しました');
        setViewMode('confirmRegister');
      } else {
        setError(result.message || '登録に失敗しました');
      }
    } catch (err) {
      setError('登録処理中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // 登録確認処理
  // ========================================
  const handleConfirmRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!registerCode) {
      setError('確認コードを入力してください');
      return;
    }

    setLoading(true);

    try {
      const result = await confirmRegistration(email, registerCode);

      if (result.success) {
        setSuccess('登録が完了しました。ログインしてください。');
        setViewMode('login');
        setRegisterCode('');
      } else {
        setError(result.message || '確認に失敗しました');
      }
    } catch (err) {
      setError('確認処理中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // ローディング中
  // ========================================
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  // ========================================
  // Render
  // ========================================
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-4">
      <div className="w-full max-w-md">
        {/* ロゴ・タイトル */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            <BuildingIcon className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">物件管理システム</h1>
          <p className="text-sm text-slate-500 mt-1">施工情報管理システム</p>
        </div>

        {/* フォームカード */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* ログインフォーム */}
          {viewMode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <h2 className="text-lg font-semibold text-slate-800 text-center mb-2">
                ログイン
              </h2>

              {/* メッセージ */}
              {error && <ErrorMessage message={error} />}
              {success && <SuccessMessage message={success} />}

              {/* メールアドレス */}
              <FormInput
                id="email"
                label="メールアドレス"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="example@company.co.jp"
                autoComplete="email"
              />

              {/* パスワード */}
              <FormInput
                id="password"
                label="パスワード"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                autoComplete="current-password"
              />

              {/* ログインボタン */}
              <SubmitButton loading={loading} text="ログイン" loadingText="ログイン中..." />

              {/* パスワードリセットリンク */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('forgotPassword');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  パスワードを忘れた方はこちら
                </button>
              </div>

              {/* 新規登録案内 */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <p className="text-sm text-slate-600 text-center">
                  アカウントをお持ちでない方
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('register');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="mt-3 w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  新規アカウント登録
                </button>
              </div>
            </form>
          )}

          {/* 新しいパスワード設定フォーム */}
          {viewMode === 'newPassword' && (
            <form onSubmit={handleNewPassword} className="space-y-5">
              <h2 className="text-lg font-semibold text-slate-800 text-center mb-2">
                新しいパスワードを設定
              </h2>
              <p className="text-sm text-slate-600 text-center mb-4">
                初回ログインのため、新しいパスワードを設定してください
              </p>

              {error && <ErrorMessage message={error} />}

              <FormInput
                id="newPassword"
                label="新しいパスワード"
                type="password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="8文字以上"
                autoComplete="new-password"
              />

              <FormInput
                id="confirmPassword"
                label="パスワード（確認）"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="再入力してください"
                autoComplete="new-password"
              />

              <SubmitButton loading={loading} text="パスワードを設定" loadingText="設定中..." />

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('login');
                    setError(null);
                  }}
                  className="text-sm text-slate-600 hover:text-slate-800 hover:underline"
                >
                  ログインに戻る
                </button>
              </div>
            </form>
          )}

          {/* パスワードリセット（メール送信）フォーム */}
          {viewMode === 'forgotPassword' && (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <h2 className="text-lg font-semibold text-slate-800 text-center mb-2">
                パスワードをリセット
              </h2>
              <p className="text-sm text-slate-600 text-center mb-4">
                登録したメールアドレスを入力してください
              </p>

              {error && <ErrorMessage message={error} />}

              <FormInput
                id="resetEmail"
                label="メールアドレス"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="example@company.co.jp"
                autoComplete="email"
              />

              <SubmitButton loading={loading} text="確認コードを送信" loadingText="送信中..." />

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('login');
                    setError(null);
                  }}
                  className="text-sm text-slate-600 hover:text-slate-800 hover:underline"
                >
                  ログインに戻る
                </button>
              </div>
            </form>
          )}

          {/* パスワードリセット確認フォーム */}
          {viewMode === 'confirmReset' && (
            <form onSubmit={handleConfirmReset} className="space-y-5">
              <h2 className="text-lg font-semibold text-slate-800 text-center mb-2">
                新しいパスワードを設定
              </h2>
              <p className="text-sm text-slate-600 text-center mb-4">
                メールに送信された確認コードと新しいパスワードを入力してください
              </p>

              {error && <ErrorMessage message={error} />}
              {success && <SuccessMessage message={success} />}

              <FormInput
                id="resetCode"
                label="確認コード"
                type="text"
                value={resetCode}
                onChange={setResetCode}
                placeholder="6桁のコード"
                autoComplete="one-time-code"
              />

              <FormInput
                id="newResetPassword"
                label="新しいパスワード"
                type="password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="8文字以上"
                autoComplete="new-password"
              />

              <FormInput
                id="confirmResetPassword"
                label="パスワード（確認）"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="再入力してください"
                autoComplete="new-password"
              />

              <SubmitButton loading={loading} text="パスワードをリセット" loadingText="リセット中..." />

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('login');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-sm text-slate-600 hover:text-slate-800 hover:underline"
                >
                  ログインに戻る
                </button>
              </div>
            </form>
          )}

          {/* 新規登録フォーム */}
          {viewMode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-5">
              <h2 className="text-lg font-semibold text-slate-800 text-center mb-2">
                新規アカウント登録
              </h2>
              <p className="text-sm text-slate-600 text-center mb-4">
                必要事項を入力してアカウントを作成してください
              </p>

              {error && <ErrorMessage message={error} />}
              {success && <SuccessMessage message={success} />}

              <FormInput
                id="registerName"
                label="お名前（任意）"
                type="text"
                value={name}
                onChange={setName}
                placeholder="山田 太郎"
                autoComplete="name"
              />

              <FormInput
                id="registerEmail"
                label="メールアドレス"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="example@company.co.jp"
                autoComplete="email"
              />

              <FormInput
                id="registerPassword"
                label="パスワード"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="8文字以上（大文字・小文字・数字を含む）"
                autoComplete="new-password"
              />

              <SubmitButton loading={loading} text="登録する" loadingText="登録中..." />

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('login');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-sm text-slate-600 hover:text-slate-800 hover:underline"
                >
                  ログインに戻る
                </button>
              </div>
            </form>
          )}

          {/* 登録確認フォーム */}
          {viewMode === 'confirmRegister' && (
            <form onSubmit={handleConfirmRegister} className="space-y-5">
              <h2 className="text-lg font-semibold text-slate-800 text-center mb-2">
                メール確認
              </h2>
              <p className="text-sm text-slate-600 text-center mb-4">
                {email} に送信された確認コードを入力してください
              </p>

              {error && <ErrorMessage message={error} />}
              {success && <SuccessMessage message={success} />}

              <FormInput
                id="registerCode"
                label="確認コード"
                type="text"
                value={registerCode}
                onChange={setRegisterCode}
                placeholder="6桁のコード"
                autoComplete="one-time-code"
              />

              <SubmitButton loading={loading} text="確認する" loadingText="確認中..." />

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('login');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="text-sm text-slate-600 hover:text-slate-800 hover:underline"
                >
                  ログインに戻る
                </button>
              </div>
            </form>
          )}
        </div>

        {/* フッター */}
        <p className="text-center text-xs text-slate-400 mt-6">
          © 2024 Property Management System
        </p>
      </div>
    </div>
  );
}

// ========================================
// 共通コンポーネント
// ========================================
interface FormInputProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}

function FormInput({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: FormInputProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        autoComplete={autoComplete}
        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
        placeholder={placeholder}
      />
    </div>
  );
}

interface SubmitButtonProps {
  loading: boolean;
  text: string;
  loadingText: string;
}

function SubmitButton({ loading, text, loadingText }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-3 px-4 text-white bg-blue-600 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
    >
      {loading ? (
        <span className="flex items-center justify-center">
          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {loadingText}
        </span>
      ) : (
        text
      )}
    </button>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}

function SuccessMessage({ message }: { message: string }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
      <p className="text-sm text-green-700">{message}</p>
    </div>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  );
}
