import Header from '@/components/Header';
import Card from '@/components/Card';
import StatusBadge from '@/components/StatusBadge';
import { Building2, MapPin, TrendingUp, Ruler, Calendar } from 'lucide-react';
import Link from 'next/link';
import prisma from '@/lib/db';

async function getProperties() {
  return prisma.property.findMany({
    orderBy: { createdAt: 'desc' },
    include: { 
      translations: true,
      videos: true
    }
  });
}

export default async function PropertiesPage() {
  const properties = await getProperties();

  return (
    <div className="animate-fade-in">
      <Header 
        title="物件一覧" 
        subtitle="登録されている物件情報を管理" 
      />

      {properties.length === 0 ? (
        <Card>
          <div className="text-center py-16">
            <Building2 className="w-12 h-12 text-surface-600 mx-auto mb-4" />
            <p className="text-surface-400 mb-4">まだ物件が登録されていません</p>
            <Link href="/urls/register" className="btn-primary inline-block">
              URLを登録して物件を取得
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {properties.map((property) => {
            const hasTranslation = property.translations.length > 0;
            const hasVideo = property.videos.length > 0;
            const completedVideos = property.videos.filter(v => v.status === 'COMPLETED').length;
            
            return (
              <Link key={property.id} href={`/properties/${property.id}`}>
                <Card hover className="h-full">
                  <div className="flex gap-4">
                    {/* Image placeholder */}
                    <div className="w-32 h-32 rounded-xl bg-gradient-to-br from-surface-700 to-surface-800 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-8 h-8 text-surface-500" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg mb-1 truncate">{property.name}</h3>
                      
                      <div className="flex items-center gap-1 text-sm text-surface-400 mb-3">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{property.address}</span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm">
                        {property.layout && (
                          <span className="flex items-center gap-1">
                            <Ruler className="w-4 h-4 text-surface-500" />
                            {property.layout}
                          </span>
                        )}
                        {property.area && (
                          <span>{property.area}㎡</span>
                        )}
                        {property.buildYear && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-surface-500" />
                            {property.buildYear}年
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xl font-bold gradient-text">
                          ¥{property.price.toLocaleString()}
                        </span>
                        
                        {property.grossYield && (
                          <span className="flex items-center gap-1 text-green-400">
                            <TrendingUp className="w-4 h-4" />
                            {property.grossYield.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Status indicators */}
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${hasTranslation ? 'bg-green-500' : 'bg-surface-600'}`} />
                      <span className="text-xs text-surface-400">翻訳</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${hasVideo ? 'bg-green-500' : 'bg-surface-600'}`} />
                      <span className="text-xs text-surface-400">
                        動画 {hasVideo ? `(${completedVideos}/${property.videos.length})` : ''}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

