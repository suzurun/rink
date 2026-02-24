import Header from '@/components/Header';
import Card from '@/components/Card';
import StatusBadge from '@/components/StatusBadge';
import { 
  Building2, 
  MapPin, 
  Train, 
  Ruler, 
  Calendar, 
  Layers, 
  TrendingUp,
  DollarSign,
  Languages,
  Video,
  Edit,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import PropertyActions from './PropertyActions';

async function getProperty(id: string) {
  return prisma.property.findUnique({
    where: { id },
    include: {
      url: true,
      translations: true,
      videos: true
    }
  });
}

export default async function PropertyDetailPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  const property = await getProperty(params.id);

  if (!property) {
    notFound();
  }

  const exteriorImages = property.exteriorImages ? JSON.parse(property.exteriorImages) : [];
  const interiorImages = property.interiorImages ? JSON.parse(property.interiorImages) : [];

  return (
    <div className="animate-fade-in">
      <Header 
        title={property.name} 
        subtitle={property.address} 
      />

      <div className="grid grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary-400" />
              基本情報
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-white/5">
                <span className="text-sm text-surface-400 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  住所
                </span>
                <p className="font-medium mt-1">{property.address}</p>
              </div>
              
              {property.nearestStation && (
                <div className="p-4 rounded-lg bg-white/5">
                  <span className="text-sm text-surface-400 flex items-center gap-2">
                    <Train className="w-4 h-4" />
                    最寄り駅
                  </span>
                  <p className="font-medium mt-1">
                    {property.nearestStation}
                    {property.walkMinutes && ` 徒歩${property.walkMinutes}分`}
                  </p>
                </div>
              )}
              
              {property.layout && (
                <div className="p-4 rounded-lg bg-white/5">
                  <span className="text-sm text-surface-400 flex items-center gap-2">
                    <Ruler className="w-4 h-4" />
                    間取り / 面積
                  </span>
                  <p className="font-medium mt-1">
                    {property.layout} / {property.area}㎡
                  </p>
                </div>
              )}
              
              {property.buildYear && (
                <div className="p-4 rounded-lg bg-white/5">
                  <span className="text-sm text-surface-400 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    築年 / 構造
                  </span>
                  <p className="font-medium mt-1">
                    {property.buildYear}年 / {property.structure || '-'}
                  </p>
                </div>
              )}
              
              {property.floors && (
                <div className="p-4 rounded-lg bg-white/5">
                  <span className="text-sm text-surface-400 flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    階数
                  </span>
                  <p className="font-medium mt-1">{property.floors}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Pricing */}
          <Card>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              販売条件
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-gradient-to-br from-primary-500/10 to-accent-500/10 border border-primary-500/20">
                <span className="text-sm text-surface-400">販売価格</span>
                <p className="text-3xl font-bold gradient-text mt-1">
                  ¥{property.price.toLocaleString()}
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-white/5">
                <span className="text-sm text-surface-400">月額費用</span>
                <div className="mt-1 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>管理費</span>
                    <span className="font-mono">¥{(property.maintenanceFee || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>修繕積立金</span>
                    <span className="font-mono">¥{(property.repairReserve || 0).toLocaleString()}</span>
                  </div>
                  {property.otherCosts && (
                    <div className="flex justify-between">
                      <span>その他</span>
                      <span className="font-mono">¥{property.otherCosts.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Investment Info */}
          <Card>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-yellow-400" />
              投資情報
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full ml-2">
                参考値
              </span>
            </h3>
            
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-white/5 text-center">
                <span className="text-sm text-surface-400 block">想定賃料</span>
                <p className="text-xl font-bold mt-1">
                  ¥{(property.expectedRent || 0).toLocaleString()}
                </p>
                <span className="text-xs text-surface-500">/月</span>
              </div>
              
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                <span className="text-sm text-surface-400 block">表面利回り</span>
                <p className="text-xl font-bold text-green-400 mt-1">
                  {property.grossYield ? `${property.grossYield.toFixed(2)}%` : '-'}
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                <span className="text-sm text-surface-400 block">実質利回り</span>
                <p className="text-xl font-bold text-blue-400 mt-1">
                  {property.netYield ? `${property.netYield.toFixed(2)}%` : '-'}
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-white/5 text-center">
                <span className="text-sm text-surface-400 block">空室率</span>
                <p className="text-xl font-bold mt-1">
                  {property.vacancyRate ? `${(property.vacancyRate * 100).toFixed(1)}%` : '-'}
                </p>
              </div>
            </div>
            
            <p className="mt-4 text-xs text-surface-500">
              ※ 表示されている投資情報は推定値であり、実際の投資判断には十分な調査が必要です。
            </p>
          </Card>

          {/* Descriptions */}
          {(property.locationDesc || property.facilityDesc || property.investmentDesc) && (
            <Card>
              <h3 className="text-lg font-semibold mb-4">物件説明</h3>
              
              {property.locationDesc && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-surface-400 mb-2">立地</h4>
                  <p className="text-sm">{property.locationDesc}</p>
                </div>
              )}
              
              {property.facilityDesc && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-surface-400 mb-2">設備</h4>
                  <p className="text-sm">{property.facilityDesc}</p>
                </div>
              )}
              
              {property.investmentDesc && (
                <div>
                  <h4 className="text-sm font-medium text-surface-400 mb-2">投資価値</h4>
                  <p className="text-sm">{property.investmentDesc}</p>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <PropertyActions propertyId={property.id} />

          {/* Translations */}
          <Card>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Languages className="w-5 h-5 text-purple-400" />
              翻訳状況
            </h3>
            
            <div className="space-y-3">
              {['EN', 'ZH_CN', 'ZH_TW'].map((lang) => {
                const translation = property.translations.find(t => t.language === lang);
                const langLabels: Record<string, string> = {
                  EN: '英語',
                  ZH_CN: '中国語（簡体）',
                  ZH_TW: '中国語（繁体）'
                };
                
                return (
                  <div key={lang} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <span className="text-sm">{langLabels[lang]}</span>
                    {translation ? (
                      <StatusBadge status={translation.status} size="sm" />
                    ) : (
                      <span className="text-xs text-surface-500">未作成</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Videos */}
          <Card>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Video className="w-5 h-5 text-red-400" />
              動画状況
            </h3>
            
            {property.videos.length === 0 ? (
              <p className="text-sm text-surface-400 text-center py-4">
                動画未生成
              </p>
            ) : (
              <div className="space-y-3">
                {property.videos.map((video) => (
                  <div key={video.id} className="p-3 rounded-lg bg-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        {video.videoType === 'STANDARD' ? '本編' : 'Short'}
                        ({video.language === 'EN' ? '英語' : 
                          video.language === 'ZH_CN' ? '簡体' : '繁体'})
                      </span>
                      <StatusBadge status={video.status} size="sm" />
                    </div>
                    {video.videoUrl && (
                      <a 
                        href={video.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 mt-2"
                      >
                        動画を見る
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Source URL */}
          <Card>
            <h3 className="text-sm font-medium text-surface-400 mb-2">元URL</h3>
            <a 
              href={property.url.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1 break-all"
            >
              {property.url.url}
              <ExternalLink className="w-4 h-4 flex-shrink-0" />
            </a>
          </Card>
        </div>
      </div>
    </div>
  );
}

