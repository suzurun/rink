'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import Card from '@/components/Card';
import { Link2, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function UrlRegisterPage() {
  const router = useRouter();
  const [urls, setUrls] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    count?: number;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const urlList = urls
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      if (urlList.length === 0) {
        setResult({ success: false, message: 'URLを入力してください' });
        setLoading(false);
        return;
      }

      const response = await fetch('/api/urls/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlList }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({ 
          success: true, 
          message: `${data.created}件のURLを登録しました`,
          count: data.created
        });
        setUrls('');
        setTimeout(() => router.push('/urls'), 2000);
      } else {
        setResult({ success: false, message: data.error || 'エラーが発生しました' });
      }
    } catch (error) {
      setResult({ success: false, message: 'ネットワークエラーが発生しました' });
    } finally {
      setLoading(false);
    }
  };

  const urlCount = urls.split('\n').filter(url => url.trim().length > 0).length;

  return (
    <div className="animate-fade-in">
      <Header 
        title="URL一括登録" 
        subtitle="物件URLを一括で登録してスクレイピングを開始" 
      />

      <div className="max-w-3xl">
        <Card>
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-surface-300">
                物件URL（1行に1URLを入力）
              </label>
              <textarea
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder="https://example.com/property/12345&#10;https://example.com/property/67890&#10;https://example.com/property/11111"
                className="w-full h-64 font-mono text-sm resize-none"
                disabled={loading}
              />
              <p className="mt-2 text-sm text-surface-500">
                入力URL数: <span className="font-mono text-primary-400">{urlCount}</span>
              </p>
            </div>

            {result && (
              <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                result.success 
                  ? 'bg-green-500/10 border border-green-500/20' 
                  : 'bg-red-500/10 border border-red-500/20'
              }`}>
                {result.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400" />
                )}
                <span className={result.success ? 'text-green-400' : 'text-red-400'}>
                  {result.message}
                </span>
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading || urlCount === 0}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    登録中...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    一括登録
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setUrls('')}
                className="btn-secondary"
                disabled={loading}
              >
                クリア
              </button>
            </div>
          </form>
        </Card>

        <Card className="mt-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary-400" />
            対応サイト
          </h3>
          <ul className="space-y-2 text-sm text-surface-400">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              自社サイト（スクレイピング許可設定済み）
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              SUUMO（デモ用モックデータ）
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              HOME'S（デモ用モックデータ）
            </li>
          </ul>
          <p className="mt-4 text-xs text-surface-500">
            ※ 実際の運用では、明示的にスクレイピングが許可されているサイトのみ対応しています。
          </p>
        </Card>
      </div>
    </div>
  );
}

