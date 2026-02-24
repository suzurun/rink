import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urls } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'URLの配列が必要です' },
        { status: 400 }
      );
    }

    // Validate URLs
    const validUrls: string[] = [];
    const invalidUrls: string[] = [];

    for (const url of urls) {
      try {
        new URL(url);
        validUrls.push(url);
      } catch {
        invalidUrls.push(url);
      }
    }

    if (validUrls.length === 0) {
      return NextResponse.json(
        { error: '有効なURLがありません', invalidUrls },
        { status: 400 }
      );
    }

    // Create URL records
    const results = await Promise.allSettled(
      validUrls.map(url =>
        prisma.url.create({
          data: {
            url,
            status: 'PENDING',
          },
        })
      )
    );

    const created = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    // Trigger scraping for pending URLs (in background)
    // In production, this would be handled by a job queue
    triggerScraping();

    return NextResponse.json({
      created,
      failed,
      invalidUrls: invalidUrls.length > 0 ? invalidUrls : undefined,
    });
  } catch (error) {
    console.error('URL batch registration error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

// Simulate scraping process
async function triggerScraping() {
  const pendingUrls = await prisma.url.findMany({
    where: { status: 'PENDING' },
    take: 5,
  });

  for (const urlRecord of pendingUrls) {
    // Update status to running
    await prisma.url.update({
      where: { id: urlRecord.id },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    // Simulate scraping delay
    setTimeout(async () => {
      try {
        // Generate mock property data
        const mockProperty = generateMockProperty(urlRecord.url);

        // Create property
        await prisma.property.create({
          data: {
            urlId: urlRecord.id,
            ...mockProperty,
          },
        });

        // Update URL status
        await prisma.url.update({
          where: { id: urlRecord.id },
          data: { status: 'COMPLETED', finishedAt: new Date() },
        });
      } catch (error) {
        console.error('Scraping error:', error);
        await prisma.url.update({
          where: { id: urlRecord.id },
          data: { 
            status: 'ERROR', 
            finishedAt: new Date(),
            errorMessage: 'スクレイピングに失敗しました'
          },
        });
      }
    }, 2000 + Math.random() * 3000); // Random delay 2-5 seconds
  }
}

function generateMockProperty(url: string) {
  const areas = ['渋谷区', '新宿区', '港区', '中央区', '千代田区', '目黒区', '世田谷区'];
  const stations = ['渋谷駅', '新宿駅', '品川駅', '東京駅', '六本木駅', '恵比寿駅', '中目黒駅'];
  const layouts = ['1K', '1DK', '1LDK', '2LDK', '3LDK', '2DK'];
  const structures = ['RC造', 'SRC造', '鉄骨造', '木造'];
  
  const area = areas[Math.floor(Math.random() * areas.length)];
  const station = stations[Math.floor(Math.random() * stations.length)];
  const layout = layouts[Math.floor(Math.random() * layouts.length)];
  const price = Math.floor(Math.random() * 50000000) + 10000000;
  const sqm = Math.floor(Math.random() * 50) + 20;
  const buildYear = 2000 + Math.floor(Math.random() * 24);
  const expectedRent = Math.floor(price * 0.004 + Math.random() * 50000);
  
  const grossYield = ((expectedRent * 12) / price) * 100;
  const monthlyExpenses = Math.floor(expectedRent * 0.15);
  const netYield = (((expectedRent - monthlyExpenses) * 12) / price) * 100;

  return {
    name: `${area}${layout}マンション ${Math.floor(Math.random() * 100) + 1}`,
    address: `東京都${area}${Math.floor(Math.random() * 5) + 1}-${Math.floor(Math.random() * 20) + 1}-${Math.floor(Math.random() * 30) + 1}`,
    nearestStation: station,
    walkMinutes: Math.floor(Math.random() * 15) + 1,
    layout,
    area: sqm,
    buildYear,
    structure: structures[Math.floor(Math.random() * structures.length)],
    floors: `${Math.floor(Math.random() * 15) + 1}階 / ${Math.floor(Math.random() * 20) + 5}階建`,
    price,
    maintenanceFee: Math.floor(Math.random() * 15000) + 5000,
    repairReserve: Math.floor(Math.random() * 10000) + 3000,
    otherCosts: Math.floor(Math.random() * 5000),
    expectedRent,
    grossYield: parseFloat(grossYield.toFixed(2)),
    netYield: parseFloat(netYield.toFixed(2)),
    vacancyRate: parseFloat((Math.random() * 0.1).toFixed(3)),
    marketRentEstimate: expectedRent + Math.floor(Math.random() * 20000) - 10000,
    locationDesc: `${station}から徒歩圏内の好立地。周辺にはコンビニ、スーパー、飲食店が充実しており、生活利便性が高いエリアです。`,
    facilityDesc: 'オートロック、宅配ボックス、エアコン完備。システムキッチン、独立洗面台、浴室乾燥機付き。',
    investmentDesc: '駅近立地で賃貸需要が安定しており、長期投資に適した物件です。築浅で維持費も抑えられます。',
    exteriorImages: JSON.stringify([]),
    interiorImages: JSON.stringify([]),
    layoutImages: JSON.stringify([]),
  };
}

