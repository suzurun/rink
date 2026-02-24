import Header from '@/components/Header';
import Card from '@/components/Card';
import StatusBadge from '@/components/StatusBadge';
import { Video, Play, Download, RefreshCw, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import prisma from '@/lib/db';

async function getVideos() {
  return prisma.video.findMany({
    orderBy: { createdAt: 'desc' },
    include: { property: true }
  });
}

export default async function VideosPage() {
  const videos = await getVideos();

  const videoTypeLabels = {
    STANDARD: '本編動画',
    SHORT: 'Short動画'
  };

  const langLabels = {
    EN: '英語',
    ZH_CN: '中国語（簡体）',
    ZH_TW: '中国語（繁体）'
  };

  return (
    <div className="animate-fade-in">
      <Header 
        title="動画管理" 
        subtitle="生成された動画の一覧と管理" 
      />

      {videos.length === 0 ? (
        <Card>
          <div className="text-center py-16">
            <Video className="w-12 h-12 text-surface-600 mx-auto mb-4" />
            <p className="text-surface-400 mb-4">まだ動画が生成されていません</p>
            <Link href="/properties" className="btn-primary inline-block">
              物件から動画を生成
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {videos.map((video) => (
            <Card key={video.id} hover>
              {/* Thumbnail */}
              <div className="aspect-video rounded-xl bg-gradient-to-br from-surface-700 to-surface-800 flex items-center justify-center mb-4 relative overflow-hidden group">
                {video.thumbnailUrl ? (
                  <img 
                    src={video.thumbnailUrl} 
                    alt={video.property.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Video className="w-12 h-12 text-surface-500" />
                )}
                
                {video.status === 'COMPLETED' && video.videoUrl && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <a 
                      href={video.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"
                    >
                      <Play className="w-8 h-8 text-white ml-1" />
                    </a>
                  </div>
                )}
                
                <div className="absolute top-2 left-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    video.videoType === 'SHORT' 
                      ? 'bg-accent-500/80 text-white' 
                      : 'bg-primary-500/80 text-white'
                  }`}>
                    {videoTypeLabels[video.videoType]}
                  </span>
                </div>
                
                <div className="absolute top-2 right-2">
                  <StatusBadge status={video.status} size="sm" />
                </div>
              </div>

              {/* Info */}
              <div>
                <Link 
                  href={`/properties/${video.propertyId}`}
                  className="font-semibold hover:text-primary-400 transition-colors line-clamp-1"
                >
                  {video.property.name}
                </Link>
                
                <div className="flex items-center gap-2 mt-2 text-sm text-surface-400">
                  <span className="px-2 py-0.5 rounded bg-white/5">
                    {langLabels[video.language]}
                  </span>
                  {video.duration && (
                    <span>{Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}</span>
                  )}
                </div>
                
                <p className="text-xs text-surface-500 mt-2">
                  {new Date(video.createdAt).toLocaleString('ja-JP')}
                </p>
              </div>

              {/* Actions */}
              {video.status === 'COMPLETED' && video.videoUrl && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
                  <a 
                    href={video.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 btn-secondary flex items-center justify-center gap-2 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    開く
                  </a>
                  <a 
                    href={video.videoUrl}
                    download
                    className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    DL
                  </a>
                </div>
              )}
              
              {video.status === 'ERROR' && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="text-xs text-red-400 mb-2">{video.errorMessage}</p>
                  <button className="btn-secondary w-full flex items-center justify-center gap-2 text-sm">
                    <RefreshCw className="w-4 h-4" />
                    再生成
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

