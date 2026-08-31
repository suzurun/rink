'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '../api/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // 保存済みトークンではなく Amplify のセッションで判定する。
    // トークンの期限が切れていても、リフレッシュトークンが有効なら
    // 自動で更新されるためログイン画面に戻されない。
    const checkAuth = async () => {
      const authenticated = await isAuthenticated();
      router.push(authenticated ? '/properties' : '/login');
    };
    checkAuth();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto"></div>
        <p className="mt-4 text-slate-600">読み込み中...</p>
      </div>
    </div>
  );
}
