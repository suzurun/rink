import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const property = await prisma.property.findUnique({
      where: { id: params.id },
    });

    if (!property) {
      return NextResponse.json(
        { error: '物件が見つかりません' },
        { status: 404 }
      );
    }

    const languages = ['EN', 'ZH_CN', 'ZH_TW'] as const;

    for (const language of languages) {
      // Check if translation already exists
      const existing = await prisma.translation.findUnique({
        where: {
          propertyId_language: {
            propertyId: params.id,
            language,
          },
        },
      });

      if (existing) {
        // Update existing translation
        await prisma.translation.update({
          where: { id: existing.id },
          data: { status: 'PROCESSING' },
        });
      } else {
        // Create new translation
        await prisma.translation.create({
          data: {
            propertyId: params.id,
            language,
            status: 'PROCESSING',
          },
        });
      }

      // Simulate translation process
      setTimeout(async () => {
        const translated = generateMockTranslation(property, language);
        
        await prisma.translation.update({
          where: {
            propertyId_language: {
              propertyId: params.id,
              language,
            },
          },
          data: {
            ...translated,
            status: 'COMPLETED',
          },
        });
      }, 3000 + Math.random() * 2000);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

function generateMockTranslation(
  property: any,
  language: 'EN' | 'ZH_CN' | 'ZH_TW'
) {
  const translations = {
    EN: {
      name: property.name.replace(/マンション/, 'Apartment').replace(/区/, ' Ward'),
      address: property.address.replace(/東京都/, 'Tokyo, ').replace(/区/, ' Ward'),
      locationDesc: `Conveniently located near ${property.nearestStation?.replace('駅', ' Station')}. The area is well-equipped with convenience stores, supermarkets, and restaurants.`,
      facilityDesc: 'Auto-lock system, delivery box, air conditioning. System kitchen, independent washbasin, bathroom dryer included.',
      investmentDesc: 'Located near the station with stable rental demand, suitable for long-term investment. Low maintenance costs due to recent construction.',
      scriptOpening: `Welcome to this excellent investment opportunity in Tokyo. Today we present a ${property.layout} apartment in the heart of ${property.address?.split('区')[0]} Ward.`,
      scriptLocation: `This property is ideally situated just ${property.walkMinutes} minutes walk from ${property.nearestStation?.replace('駅', ' Station')}. The neighborhood offers excellent amenities including supermarkets, restaurants, and convenience stores.`,
      scriptInterior: `The apartment features ${property.area} square meters of living space with a modern ${property.layout} layout. Built in ${property.buildYear}, this ${property.structure} construction offers excellent quality and durability.`,
      scriptConditions: `The property is listed at ${(property.price / 1000000).toFixed(1)} million yen. Monthly expenses include a management fee of ${property.maintenanceFee?.toLocaleString()} yen and repair reserve of ${property.repairReserve?.toLocaleString()} yen.`,
      scriptInvestment: `With an estimated monthly rent of ${property.expectedRent?.toLocaleString()} yen, this property offers a gross yield of approximately ${property.grossYield?.toFixed(2)}% and a net yield of ${property.netYield?.toFixed(2)}%. Please note these figures are estimates for reference only.`,
      scriptSummary: `This property presents an attractive investment opportunity in one of Tokyo's most sought-after locations. Don't miss this chance to add a quality asset to your portfolio.`,
      scriptDisclaimer: `The investment information provided is for reference purposes only. All prospective investors should conduct their own due diligence before making any investment decisions.`,
    },
    ZH_CN: {
      name: property.name.replace(/マンション/, '公寓').replace(/区/, '区'),
      address: property.address.replace(/東京都/, '东京都'),
      locationDesc: `位于${property.nearestStation?.replace('駅', '站')}附近的便利位置。周边设施齐全，包括便利店、超市和餐厅。`,
      facilityDesc: '自动锁系统、快递柜、空调。系统厨房、独立洗手台、浴室干燥机。',
      investmentDesc: '靠近车站，租赁需求稳定，适合长期投资。由于是较新建筑，维护成本较低。',
      scriptOpening: `欢迎了解这个位于东京的优质投资机会。今天为您介绍位于${property.address?.split('区')[0]}区中心的${property.layout}公寓。`,
      scriptLocation: `该物业位置优越，距离${property.nearestStation?.replace('駅', '站')}仅${property.walkMinutes}分钟步行路程。周边设施完善，包括超市、餐厅和便利店。`,
      scriptInterior: `公寓面积${property.area}平方米，采用现代${property.layout}布局。建于${property.buildYear}年，${property.structure}结构，品质优良，经久耐用。`,
      scriptConditions: `物业售价${(property.price / 10000).toFixed(0)}万日元。每月费用包括管理费${property.maintenanceFee?.toLocaleString()}日元和修缮储备金${property.repairReserve?.toLocaleString()}日元。`,
      scriptInvestment: `预计月租金${property.expectedRent?.toLocaleString()}日元，毛收益率约${property.grossYield?.toFixed(2)}%，净收益率${property.netYield?.toFixed(2)}%。请注意，这些数字仅供参考。`,
      scriptSummary: `该物业是东京最受欢迎地段的优质投资机会。不要错过将优质资产纳入投资组合的机会。`,
      scriptDisclaimer: `所提供的投资信息仅供参考。所有潜在投资者在做出任何投资决定之前应进行自己的尽职调查。`,
    },
    ZH_TW: {
      name: property.name.replace(/マンション/, '公寓').replace(/区/, '區'),
      address: property.address.replace(/東京都/, '東京都'),
      locationDesc: `位於${property.nearestStation?.replace('駅', '站')}附近的便利位置。周邊設施齊全，包括便利商店、超市和餐廳。`,
      facilityDesc: '自動鎖系統、快遞櫃、空調。系統廚房、獨立洗手台、浴室乾燥機。',
      investmentDesc: '靠近車站，租賃需求穩定，適合長期投資。由於是較新建築，維護成本較低。',
      scriptOpening: `歡迎了解這個位於東京的優質投資機會。今天為您介紹位於${property.address?.split('区')[0]}區中心的${property.layout}公寓。`,
      scriptLocation: `該物業位置優越，距離${property.nearestStation?.replace('駅', '站')}僅${property.walkMinutes}分鐘步行路程。周邊設施完善，包括超市、餐廳和便利商店。`,
      scriptInterior: `公寓面積${property.area}平方公尺，採用現代${property.layout}佈局。建於${property.buildYear}年，${property.structure}結構，品質優良，經久耐用。`,
      scriptConditions: `物業售價${(property.price / 10000).toFixed(0)}萬日圓。每月費用包括管理費${property.maintenanceFee?.toLocaleString()}日圓和修繕儲備金${property.repairReserve?.toLocaleString()}日圓。`,
      scriptInvestment: `預計月租金${property.expectedRent?.toLocaleString()}日圓，毛收益率約${property.grossYield?.toFixed(2)}%，淨收益率${property.netYield?.toFixed(2)}%。請注意，這些數字僅供參考。`,
      scriptSummary: `該物業是東京最受歡迎地段的優質投資機會。不要錯過將優質資產納入投資組合的機會。`,
      scriptDisclaimer: `所提供的投資資訊僅供參考。所有潛在投資者在做出任何投資決定之前應進行自己的盡職調查。`,
    },
  };

  return translations[language];
}

