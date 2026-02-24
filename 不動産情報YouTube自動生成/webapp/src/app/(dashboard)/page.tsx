import Header from '@/components/Header';
import Card from '@/components/Card';
import { 
  Building2, 
  Link2, 
  Video, 
  Languages,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import prisma from '@/lib/db';

async function getStats() {
  const [urlCount, propertyCount, videoCount, translationCount] = await Promise.all([
    prisma.url.count(),
    prisma.property.count(),
    prisma.video.count(),
    prisma.translation.count(),
  ]);

  const [pendingUrls, completedVideos, errorCount] = await Promise.all([
    prisma.url.count({ where: { status: 'PENDING' } }),
    prisma.video.count({ where: { status: 'COMPLETED' } }),
    prisma.url.count({ where: { status: 'ERROR' } }),
  ]);

  const recentProperties = await prisma.property.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { url: true }
  });

  return {
    urlCount,
    propertyCount,
    videoCount,
    translationCount,
    pendingUrls,
    completedVideos,
    errorCount,
    recentProperties,
  };
}

export default async function DashboardPage() {
  const stats = await getStats();

  const statCards = [
    { 
      label: '登録URL数', 
      value: stats.urlCount, 
      icon: Link2, 
      color: 'from-blue-500 to-cyan-500',
      href: '/urls'
    },
    { 
      label: '物件数', 
      value: stats.propertyCount, 
      icon: Building2, 
      color: 'from-purple-500 to-pink-500',
      href: '/properties'
    },
    { 
      label: '生成動画数', 
      value: stats.videoCount, 
      icon: Video, 
      color: 'from-orange-500 to-red-500',
      href: '/videos'
    },
    { 
      label: '翻訳数', 
      value: stats.translationCount, 
      icon: Languages, 
      color: 'from-green-500 to-emerald-500',
      href: '/translations'
    },
  ];

  return (
    <div className="animate-fade-in">
      <Header 
        title="ダッシュボード" 
        subtitle="不動産動画自動生成システムの概要" 
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, index) => (
          <Link key={stat.label} href={stat.href}>
            <Card hover className="relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-surface-400 text-sm">{stat.label}</p>
                  <p className="text-4xl font-display font-bold mt-2">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center opacity-80`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color}`} />
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Actions & Status */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <Card>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-500" />
            処理待ち
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <span className="text-sm">待機中のURL</span>
              <span className="font-mono font-bold text-yellow-400">{stats.pendingUrls}</span>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            完了
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <span className="text-sm">生成完了動画</span>
              <span className="font-mono font-bold text-green-400">{stats.completedVideos}</span>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            エラー
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <span className="text-sm">エラー発生</span>
              <span className="font-mono font-bold text-red-400">{stats.errorCount}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Properties */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">最近登録された物件</h3>
          <Link 
            href="/properties" 
            className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
          >
            すべて見る
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>

        {stats.recentProperties.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-surface-600 mx-auto mb-4" />
            <p className="text-surface-400">まだ物件が登録されていません</p>
            <Link href="/urls/register" className="btn-primary inline-block mt-4">
              URLを登録する
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>物件名</th>
                  <th>住所</th>
                  <th>価格</th>
                  <th>表面利回り</th>
                  <th>登録日</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentProperties.map((property) => (
                  <tr key={property.id}>
                    <td>
                      <Link 
                        href={`/properties/${property.id}`}
                        className="text-primary-400 hover:text-primary-300"
                      >
                        {property.name}
                      </Link>
                    </td>
                    <td className="text-surface-400">{property.address}</td>
                    <td className="font-mono">¥{property.price.toLocaleString()}</td>
                    <td>
                      {property.grossYield ? (
                        <span className="flex items-center gap-1 text-green-400">
                          <TrendingUp className="w-4 h-4" />
                          {property.grossYield.toFixed(2)}%
                        </span>
                      ) : '-'}
                    </td>
                    <td className="text-surface-400">
                      {new Date(property.createdAt).toLocaleDateString('ja-JP')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <div className="mt-8 flex gap-4">
        <Link href="/urls/register" className="btn-primary flex items-center gap-2">
          <Link2 className="w-5 h-5" />
          URL一括登録
        </Link>
        <Link href="/properties" className="btn-secondary flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          物件一覧
        </Link>
        <Link href="/videos" className="btn-secondary flex items-center gap-2">
          <Video className="w-5 h-5" />
          動画管理
        </Link>
      </div>
    </div>
  );
}

