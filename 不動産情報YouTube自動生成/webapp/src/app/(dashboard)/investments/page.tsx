import Header from '@/components/Header';
import Card from '@/components/Card';
import { TrendingUp, Building2, Calculator, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import prisma from '@/lib/db';

async function getPropertiesWithInvestment() {
  return prisma.property.findMany({
    orderBy: { grossYield: 'desc' },
    where: {
      grossYield: { not: null }
    }
  });
}

export default async function InvestmentsPage() {
  const properties = await getPropertiesWithInvestment();

  // Calculate summary stats
  const avgGrossYield = properties.length > 0 
    ? properties.reduce((acc, p) => acc + (p.grossYield || 0), 0) / properties.length 
    : 0;
  const avgNetYield = properties.length > 0 
    ? properties.reduce((acc, p) => acc + (p.netYield || 0), 0) / properties.length 
    : 0;
  const totalValue = properties.reduce((acc, p) => acc + p.price, 0);

  return (
    <div className="animate-fade-in">
      <Header 
        title="投資情報" 
        subtitle="物件の投資指標と利回り分析" 
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-surface-400">平均表面利回り</p>
              <p className="text-2xl font-bold text-green-400">{avgGrossYield.toFixed(2)}%</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
              <Calculator className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-surface-400">平均実質利回り</p>
              <p className="text-2xl font-bold text-blue-400">{avgNetYield.toFixed(2)}%</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-surface-400">物件数</p>
              <p className="text-2xl font-bold">{properties.length}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-surface-400">総資産価値</p>
              <p className="text-2xl font-bold">¥{(totalValue / 100000000).toFixed(1)}億</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Properties Table */}
      <Card padding="none">
        <div className="p-6 border-b border-white/5">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-400" />
            物件別投資指標
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full ml-2">
              参考値
            </span>
          </h3>
        </div>

        {properties.length === 0 ? (
          <div className="text-center py-16">
            <Calculator className="w-12 h-12 text-surface-600 mx-auto mb-4" />
            <p className="text-surface-400 mb-4">投資情報のある物件がありません</p>
            <Link href="/properties" className="btn-primary inline-block">
              物件一覧へ
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>物件名</th>
                  <th className="text-right">販売価格</th>
                  <th className="text-right">想定賃料</th>
                  <th className="text-right">表面利回り</th>
                  <th className="text-right">実質利回り</th>
                  <th className="text-right">空室率</th>
                  <th className="text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => (
                  <tr key={property.id}>
                    <td>
                      <Link 
                        href={`/properties/${property.id}`}
                        className="font-medium hover:text-primary-400 transition-colors"
                      >
                        {property.name}
                      </Link>
                      <p className="text-xs text-surface-500">{property.address}</p>
                    </td>
                    <td className="text-right font-mono">
                      ¥{property.price.toLocaleString()}
                    </td>
                    <td className="text-right font-mono">
                      ¥{(property.expectedRent || 0).toLocaleString()}/月
                    </td>
                    <td className="text-right">
                      <span className={`font-bold ${
                        (property.grossYield || 0) >= 5 ? 'text-green-400' :
                        (property.grossYield || 0) >= 4 ? 'text-yellow-400' : 'text-surface-400'
                      }`}>
                        {property.grossYield?.toFixed(2)}%
                      </span>
                    </td>
                    <td className="text-right">
                      <span className={`font-bold ${
                        (property.netYield || 0) >= 4 ? 'text-green-400' :
                        (property.netYield || 0) >= 3 ? 'text-yellow-400' : 'text-surface-400'
                      }`}>
                        {property.netYield?.toFixed(2)}%
                      </span>
                    </td>
                    <td className="text-right text-surface-400">
                      {property.vacancyRate 
                        ? `${(property.vacancyRate * 100).toFixed(1)}%`
                        : '-'
                      }
                    </td>
                    <td className="text-center">
                      <form action={`/api/properties/${property.id}/calculate`} method="POST">
                        <button
                          type="submit"
                          className="p-2 rounded-lg hover:bg-white/5 text-surface-400 hover:text-white transition-colors"
                          title="再計算"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-xs text-surface-500 text-center">
        ※ 表示されている投資情報は推定値であり、実際の投資判断には十分な調査が必要です。
      </p>
    </div>
  );
}

