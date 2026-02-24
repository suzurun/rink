/**
 * 認証 API クライアント
 *
 * AWS Amplify を使用した Cognito 認証
 *
 * 機能:
 * - ログイン（signIn）
 * - ログアウト（signOut）
 * - ログイン状態チェック
 * - トークン管理
 * - パスワード変更
 * - パスワードリセット
 */

import { Amplify } from 'aws-amplify';
import {
  signIn,
  signOut,
  signUp,
  confirmSignUp,
  getCurrentUser,
  fetchAuthSession,
  confirmSignIn,
  resetPassword,
  confirmResetPassword,
  updatePassword,
  fetchUserAttributes,
  AuthUser,
} from 'aws-amplify/auth';

// ========================================
// Amplify 設定
// ========================================
const REGION = process.env.NEXT_PUBLIC_COGNITO_REGION || 'ap-northeast-1';
const USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '';
const USER_POOL_CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID || '';

// Amplify の初期化（クライアントサイドでのみ実行）
let isConfigured = false;

function ensureAmplifyConfigured() {
  if (isConfigured) return;
  if (typeof window === 'undefined') return; // SSR時はスキップ
  
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: USER_POOL_ID,
        userPoolClientId: USER_POOL_CLIENT_ID,
        loginWith: {
          email: true,
        },
      },
    },
  });
  isConfigured = true;
}

// ========================================
// 型定義
// ========================================
export interface AuthResult {
  success: boolean;
  message?: string;
  user?: AuthUser;
  requireNewPassword?: boolean;
}

export interface UserInfo {
  userId: string;
  email: string;
  groups: string[];
  attributes: Record<string, string>;
}

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
}

// ========================================
// ログイン処理
// ========================================

/**
 * メールアドレスとパスワードでログイン
 */
export async function login(email: string, password: string): Promise<AuthResult> {
  ensureAmplifyConfigured();
  try {
    const result = await signIn({
      username: email,
      password,
    });

    // 新しいパスワードが必要な場合（初回ログイン時など）
    if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
      return {
        success: false,
        requireNewPassword: true,
        message: '新しいパスワードを設定してください',
      };
    }

    // ログイン成功
    if (result.isSignedIn) {
      // トークンを localStorage に保存
      await saveTokensToStorage();

      return {
        success: true,
        message: 'ログインしました',
      };
    }

    return {
      success: false,
      message: '認証に失敗しました',
    };
  } catch (error: any) {
    console.error('Login error:', error);

    // エラーメッセージの日本語化
    let message = 'ログインに失敗しました';

    if (error.name === 'NotAuthorizedException') {
      message = 'メールアドレスまたはパスワードが正しくありません';
    } else if (error.name === 'UserNotFoundException') {
      message = 'ユーザーが見つかりません';
    } else if (error.name === 'UserNotConfirmedException') {
      message = 'メールアドレスの確認が完了していません';
    } else if (error.name === 'PasswordResetRequiredException') {
      message = 'パスワードのリセットが必要です';
    } else if (error.name === 'TooManyRequestsException') {
      message = 'リクエストが多すぎます。しばらくしてから再試行してください';
    } else if (error.message) {
      message = error.message;
    }

    return {
      success: false,
      message,
    };
  }
}

/**
 * 新しいパスワードで確認（初回ログイン時）
 */
export async function confirmNewPassword(newPassword: string): Promise<AuthResult> {
  ensureAmplifyConfigured();
  try {
    const result = await confirmSignIn({
      challengeResponse: newPassword,
    });

    if (result.isSignedIn) {
      await saveTokensToStorage();
      return {
        success: true,
        message: 'パスワードを設定しました',
      };
    }

    return {
      success: false,
      message: 'パスワードの設定に失敗しました',
    };
  } catch (error: any) {
    console.error('Confirm new password error:', error);
    return {
      success: false,
      message: error.message || 'パスワードの設定に失敗しました',
    };
  }
}

// ========================================
// ログアウト処理
// ========================================

/**
 * ログアウト
 */
export async function logout(): Promise<void> {
  ensureAmplifyConfigured();
  try {
    await signOut();
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // localStorage からトークンを削除
    clearTokensFromStorage();
  }
}

/**
 * 全デバイスからログアウト
 */
export async function logoutAll(): Promise<void> {
  try {
    await signOut({ global: true });
  } catch (error) {
    console.error('Global logout error:', error);
  } finally {
    clearTokensFromStorage();
  }
}

// ========================================
// ログイン状態チェック
// ========================================

/**
 * 現在ログインしているかチェック
 */
export async function isAuthenticated(): Promise<boolean> {
  ensureAmplifyConfigured();
  try {
    await getCurrentUser();
    return true;
  } catch {
    return false;
  }
}

/**
 * 現在のユーザー情報を取得
 */
export async function getCurrentUserInfo(): Promise<UserInfo | null> {
  ensureAmplifyConfigured();
  try {
    const user = await getCurrentUser();
    const session = await fetchAuthSession();
    const attributes = await fetchUserAttributes();

    // グループ情報を取得
    const groups: string[] = (session.tokens?.accessToken?.payload?.['cognito:groups'] as string[]) || [];

    return {
      userId: user.userId,
      email: attributes.email || '',
      groups,
      attributes: attributes as Record<string, string>,
    };
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

/**
 * 認証セッションを取得
 */
export async function getAuthSession(): Promise<AuthTokens | null> {
  ensureAmplifyConfigured();
  try {
    const session = await fetchAuthSession();

    if (!session.tokens) {
      return null;
    }

    return {
      idToken: session.tokens.idToken?.toString() || '',
      accessToken: session.tokens.accessToken?.toString() || '',
    };
  } catch (error) {
    console.error('Get auth session error:', error);
    return null;
  }
}

/**
 * ユーザーが特定のグループに属しているかチェック
 */
export async function hasGroup(groupName: string): Promise<boolean> {
  const userInfo = await getCurrentUserInfo();
  return userInfo?.groups.includes(groupName) || false;
}

/**
 * ユーザーが管理者かチェック
 */
export async function isAdmin(): Promise<boolean> {
  return hasGroup('admin');
}

/**
 * ユーザーが社内ユーザーかチェック
 */
export async function isInternal(): Promise<boolean> {
  const userInfo = await getCurrentUserInfo();
  return userInfo?.groups.includes('admin') || userInfo?.groups.includes('internal') || false;
}

/**
 * ユーザーが外部ユーザーかチェック
 */
export async function isExternal(): Promise<boolean> {
  return hasGroup('external');
}

// ========================================
// トークン管理
// ========================================

/**
 * トークンを localStorage に保存
 */
async function saveTokensToStorage(): Promise<void> {
  try {
    const session = await fetchAuthSession();

    if (session.tokens) {
      const idToken = session.tokens.idToken?.toString();
      const accessToken = session.tokens.accessToken?.toString();

      if (idToken) {
        localStorage.setItem('idToken', idToken);
      }
      if (accessToken) {
        localStorage.setItem('accessToken', accessToken);
      }
    }
  } catch (error) {
    console.error('Save tokens error:', error);
  }
}

/**
 * localStorage からトークンを削除
 */
function clearTokensFromStorage(): void {
  localStorage.removeItem('idToken');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

/**
 * localStorage から ID トークンを取得
 */
export function getIdToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('idToken');
}

/**
 * 有効なIDトークンを取得（必要に応じてリフレッシュ）
 */
export async function getFreshIdToken(): Promise<string | null> {
  ensureAmplifyConfigured();
  try {
    // セッションを取得（期限切れの場合は自動リフレッシュ）
    const session = await fetchAuthSession({ forceRefresh: false });
    
    if (session.tokens?.idToken) {
      const idToken = session.tokens.idToken.toString();
      // localStorageも更新
      localStorage.setItem('idToken', idToken);
      if (session.tokens.accessToken) {
        localStorage.setItem('accessToken', session.tokens.accessToken.toString());
      }
      return idToken;
    }
    
    return null;
  } catch (error) {
    console.error('Get fresh token error:', error);
    // エラーの場合、強制リフレッシュを試みる
    try {
      const session = await fetchAuthSession({ forceRefresh: true });
      if (session.tokens?.idToken) {
        const idToken = session.tokens.idToken.toString();
        localStorage.setItem('idToken', idToken);
        if (session.tokens.accessToken) {
          localStorage.setItem('accessToken', session.tokens.accessToken.toString());
        }
        return idToken;
      }
    } catch (refreshError) {
      console.error('Force refresh failed:', refreshError);
    }
    return null;
  }
}

/**
 * localStorage からアクセストークンを取得
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

/**
 * トークンをリフレッシュ
 */
export async function refreshTokens(): Promise<boolean> {
  try {
    const session = await fetchAuthSession({ forceRefresh: true });

    if (session.tokens) {
      await saveTokensToStorage();
      return true;
    }

    return false;
  } catch (error) {
    console.error('Refresh tokens error:', error);
    return false;
  }
}

// ========================================
// 新規登録
// ========================================

/**
 * 新規ユーザー登録
 */
export async function register(email: string, password: string, name?: string): Promise<AuthResult> {
  ensureAmplifyConfigured();
  try {
    const result = await signUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          ...(name ? { name } : {}),
        },
      },
    });

    if (result.isSignUpComplete) {
      return {
        success: true,
        message: '登録が完了しました。ログインしてください。',
      };
    }

    // メール確認が必要な場合
    return {
      success: true,
      message: '確認コードをメールで送信しました。',
    };
  } catch (error: any) {
    console.error('Register error:', error);

    let message = '登録に失敗しました';

    if (error.name === 'UsernameExistsException') {
      message = 'このメールアドレスは既に登録されています';
    } else if (error.name === 'InvalidPasswordException') {
      message = 'パスワードは8文字以上で、大文字・小文字・数字を含めてください';
    } else if (error.name === 'InvalidParameterException') {
      message = '入力内容に問題があります';
    } else if (error.message) {
      message = error.message;
    }

    return {
      success: false,
      message,
    };
  }
}

/**
 * メール確認コードの検証
 */
export async function confirmRegistration(email: string, code: string): Promise<AuthResult> {
  ensureAmplifyConfigured();
  try {
    await confirmSignUp({
      username: email,
      confirmationCode: code,
    });

    return {
      success: true,
      message: '登録が完了しました。ログインしてください。',
    };
  } catch (error: any) {
    console.error('Confirm registration error:', error);

    let message = '確認に失敗しました';

    if (error.name === 'CodeMismatchException') {
      message = '確認コードが正しくありません';
    } else if (error.name === 'ExpiredCodeException') {
      message = '確認コードの有効期限が切れています';
    }

    return {
      success: false,
      message,
    };
  }
}

// ========================================
// パスワード管理
// ========================================

/**
 * パスワード変更（ログイン中のユーザー）
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<AuthResult> {
  try {
    await updatePassword({
      oldPassword,
      newPassword,
    });

    return {
      success: true,
      message: 'パスワードを変更しました',
    };
  } catch (error: any) {
    console.error('Change password error:', error);

    let message = 'パスワードの変更に失敗しました';

    if (error.name === 'NotAuthorizedException') {
      message = '現在のパスワードが正しくありません';
    } else if (error.name === 'InvalidPasswordException') {
      message = '新しいパスワードが要件を満たしていません';
    } else if (error.name === 'LimitExceededException') {
      message = '試行回数の上限に達しました。しばらくしてから再試行してください';
    }

    return {
      success: false,
      message,
    };
  }
}

/**
 * パスワードリセット開始（メール送信）
 */
export async function forgotPassword(email: string): Promise<AuthResult> {
  ensureAmplifyConfigured();
  try {
    await resetPassword({ username: email });

    return {
      success: true,
      message: 'パスワードリセット用のコードをメールで送信しました',
    };
  } catch (error: any) {
    console.error('Forgot password error:', error);

    let message = 'パスワードリセットに失敗しました';

    if (error.name === 'UserNotFoundException') {
      // セキュリティのため、ユーザーが存在しない場合も成功メッセージを返す
      return {
        success: true,
        message: 'パスワードリセット用のコードをメールで送信しました',
      };
    } else if (error.name === 'LimitExceededException') {
      message = '試行回数の上限に達しました。しばらくしてから再試行してください';
    }

    return {
      success: false,
      message,
    };
  }
}

/**
 * パスワードリセット確認（新しいパスワード設定）
 */
export async function confirmForgotPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<AuthResult> {
  ensureAmplifyConfigured();
  try {
    await confirmResetPassword({
      username: email,
      confirmationCode: code,
      newPassword,
    });

    return {
      success: true,
      message: 'パスワードをリセットしました',
    };
  } catch (error: any) {
    console.error('Confirm forgot password error:', error);

    let message = 'パスワードのリセットに失敗しました';

    if (error.name === 'CodeMismatchException') {
      message = '確認コードが正しくありません';
    } else if (error.name === 'ExpiredCodeException') {
      message = '確認コードの有効期限が切れています';
    } else if (error.name === 'InvalidPasswordException') {
      message = '新しいパスワードが要件を満たしていません';
    }

    return {
      success: false,
      message,
    };
  }
}

// ========================================
// 認証ガード（React 用）
// ========================================

/**
 * 認証が必要なページ用のチェック
 * 未認証の場合はログインページへリダイレクト
 */
export async function requireAuth(): Promise<UserInfo | null> {
  const isLoggedIn = await isAuthenticated();

  if (!isLoggedIn) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }

  return getCurrentUserInfo();
}

/**
 * 特定のグループが必要なページ用のチェック
 */
export async function requireGroup(groupName: string): Promise<UserInfo | null> {
  const userInfo = await requireAuth();

  if (!userInfo) {
    return null;
  }

  if (!userInfo.groups.includes(groupName)) {
    if (typeof window !== 'undefined') {
      window.location.href = '/permission-error';
    }
    return null;
  }

  return userInfo;
}

/**
 * 管理者のみアクセス可能なページ用のチェック
 */
export async function requireAdmin(): Promise<UserInfo | null> {
  return requireGroup('admin');
}

/**
 * 社内ユーザー以上がアクセス可能なページ用のチェック
 */
export async function requireInternal(): Promise<UserInfo | null> {
  const userInfo = await requireAuth();

  if (!userInfo) {
    return null;
  }

  const hasAccess =
    userInfo.groups.includes('admin') || userInfo.groups.includes('internal');

  if (!hasAccess) {
    if (typeof window !== 'undefined') {
      window.location.href = '/permission-error';
    }
    return null;
  }

  return userInfo;
}






