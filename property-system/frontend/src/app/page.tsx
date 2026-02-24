'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // 認証チェック後、物件一覧へリダイレクト
    const token = localStorage.getItem('idToken');
    if (token) {
      router.push('/properties');
    } else {
      router.push('/login');
    }
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






