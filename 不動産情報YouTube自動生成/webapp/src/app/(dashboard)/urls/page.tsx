import Header from '@/components/Header';
import Card from '@/components/Card';
import StatusBadge from '@/components/StatusBadge';
import { Link2, RefreshCw, Trash2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import prisma from '@/lib/db';

async function getUrls() {
  return prisma.url.findMany({
    orderBy: { createdAt: 'desc' },
    include: { property: true }
  });
}

export default async function UrlsPage() {
  const urls = await getUrls();

  return (
    <div className="animate-fade-in">
      <Header 
        title="URLステータス一覧" 
        subtitle="登録URLの処理状況を確認" 
      />

      <div className="flex gap-4 mb-6">
        <Link href="/urls/register" className="btn-primary flex items-center gap-2">
          <Link2 className="w-5 h-5" />
          URL一括登録
        </Link>
      </div>

      <Card padding="none">
        {urls.length === 0 ? (
          <div className="text-center py-16">
            <Link2 className="w-12 h-12 text-surface-600 mx-auto mb-4" />
            <p className="text-surface-400 mb-4">まだURLが登録されていません</p>
            <Link href="/urls/register" className="btn-primary inline-block">
              URLを登録する
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  <th>URL</th>
                  <th>ステータス</th>
                  <th>物件</th>
                  <th>登録日時</th>
                  <th>完了日時</th>
                  <th className="w-24">操作</th>
                </tr>
              </thead>
              <tbody>
                {urls.map((url, index) => (
                  <tr key={url.id}>
                    <td className="font-mono text-surface-500">{index + 1}</td>
                    <td>
                      <div className="flex items-center gap-2 max-w-md">
                        <span className="truncate font-mono text-sm">{url.url}</span>
                        <a 
                          href={url.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-surface-500 hover:text-primary-400 flex-shrink-0"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      {url.errorMessage && (
                        <p className="text-xs text-red-400 mt-1">{url.errorMessage}</p>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={url.status} />
                    </td>
                    <td>
                      {url.property ? (
                        <Link 
                          href={`/properties/${url.property.id}`}
                          className="text-primary-400 hover:text-primary-300"
                        >
                          {url.property.name}
                        </Link>
                      ) : (
                        <span className="text-surface-500">-</span>
                      )}
                    </td>
                    <td className="text-surface-400 text-sm">
                      {new Date(url.createdAt).toLocaleString('ja-JP')}
                    </td>
                    <td className="text-surface-400 text-sm">
                      {url.finishedAt 
                        ? new Date(url.finishedAt).toLocaleString('ja-JP')
                        : '-'
                      }
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <form action={`/api/urls/${url.id}/retry`} method="POST">
                          <button
                            type="submit"
                            className="p-2 rounded-lg hover:bg-white/5 text-surface-400 hover:text-white transition-colors"
                            title="再試行"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

