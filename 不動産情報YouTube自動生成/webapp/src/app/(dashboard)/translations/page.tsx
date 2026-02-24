import Header from '@/components/Header';
import Card from '@/components/Card';
import StatusBadge from '@/components/StatusBadge';
import { Languages, Building2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import prisma from '@/lib/db';

async function getTranslations() {
  return prisma.translation.findMany({
    orderBy: { createdAt: 'desc' },
    include: { property: true }
  });
}

export default async function TranslationsPage() {
  const translations = await getTranslations();

  const langLabels = {
    EN: '英語',
    ZH_CN: '中国語（簡体）',
    ZH_TW: '中国語（繁体）'
  };

  const langFlags = {
    EN: '🇺🇸',
    ZH_CN: '🇨🇳',
    ZH_TW: '🇹🇼'
  };

  // Group by property
  const groupedByProperty = translations.reduce((acc, t) => {
    if (!acc[t.propertyId]) {
      acc[t.propertyId] = {
        property: t.property,
        translations: []
      };
    }
    acc[t.propertyId].translations.push(t);
    return acc;
  }, {} as Record<string, { property: typeof translations[0]['property'], translations: typeof translations }>);

  return (
    <div className="animate-fade-in">
      <Header 
        title="翻訳管理" 
        subtitle="物件情報の多言語翻訳を管理" 
      />

      {translations.length === 0 ? (
        <Card>
          <div className="text-center py-16">
            <Languages className="w-12 h-12 text-surface-600 mx-auto mb-4" />
            <p className="text-surface-400 mb-4">まだ翻訳が生成されていません</p>
            <Link href="/properties" className="btn-primary inline-block">
              物件から翻訳を生成
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByProperty).map(([propertyId, { property, translations }]) => (
            <Card key={propertyId}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary-400" />
                  </div>
                  <div>
                    <Link 
                      href={`/properties/${propertyId}`}
                      className="font-semibold hover:text-primary-400 transition-colors"
                    >
                      {property.name}
                    </Link>
                    <p className="text-sm text-surface-400">{property.address}</p>
                  </div>
                </div>
                <Link 
                  href={`/properties/${propertyId}`}
                  className="btn-secondary text-sm flex items-center gap-1"
                >
                  詳細
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {translations.map((translation) => (
                  <div 
                    key={translation.id}
                    className="p-4 rounded-xl bg-white/5 border border-white/5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl">{langFlags[translation.language]}</span>
                      <StatusBadge status={translation.status} size="sm" />
                    </div>
                    
                    <h4 className="font-medium text-sm mb-1">
                      {langLabels[translation.language]}
                    </h4>
                    
                    {translation.name && (
                      <p className="text-xs text-surface-400 line-clamp-2">
                        {translation.name}
                      </p>
                    )}
                    
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <div className="flex items-center justify-between text-xs text-surface-500">
                        <span>ナレーション</span>
                        <span className={translation.scriptOpening ? 'text-green-400' : 'text-surface-600'}>
                          {translation.scriptOpening ? '✓' : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

