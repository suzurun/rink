import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create sample URLs
  const sampleUrls = [
    'https://suumo.jp/ms/chuko/tokyo/sc_shibuya/nc_123456/',
    'https://suumo.jp/ms/chuko/tokyo/sc_shinjuku/nc_234567/',
    'https://homes.co.jp/mansion/tokyo/minato/building_345678/',
  ];

  for (const url of sampleUrls) {
    const urlRecord = await prisma.url.create({
      data: {
        url,
        status: 'COMPLETED',
        startedAt: new Date(Date.now() - 60000),
        finishedAt: new Date(),
      },
    });

    // Create property for each URL
    const property = await prisma.property.create({
      data: {
        urlId: urlRecord.id,
        name: `サンプルマンション${Math.floor(Math.random() * 100)}`,
        address: `東京都渋谷区恵比寿${Math.floor(Math.random() * 5) + 1}-${Math.floor(Math.random() * 20) + 1}`,
        nearestStation: '恵比寿駅',
        walkMinutes: Math.floor(Math.random() * 10) + 1,
        layout: ['1LDK', '2LDK', '3LDK'][Math.floor(Math.random() * 3)],
        area: 45 + Math.floor(Math.random() * 30),
        buildYear: 2010 + Math.floor(Math.random() * 14),
        structure: 'RC造',
        floors: `${Math.floor(Math.random() * 10) + 1}階 / 15階建`,
        price: 30000000 + Math.floor(Math.random() * 50000000),
        maintenanceFee: 10000 + Math.floor(Math.random() * 10000),
        repairReserve: 5000 + Math.floor(Math.random() * 10000),
        otherCosts: Math.floor(Math.random() * 5000),
        expectedRent: 150000 + Math.floor(Math.random() * 100000),
        grossYield: 4 + Math.random() * 3,
        netYield: 3 + Math.random() * 2,
        vacancyRate: 0.03 + Math.random() * 0.05,
        marketRentEstimate: 140000 + Math.floor(Math.random() * 120000),
        locationDesc: '恵比寿駅から徒歩圏内の好立地。周辺にはカフェ、レストラン、商業施設が充実。',
        facilityDesc: 'オートロック、宅配ボックス、24時間ゴミ出し可。システムキッチン、浴室乾燥機付き。',
        investmentDesc: '渋谷区の人気エリアで安定した賃貸需要が見込めます。',
        exteriorImages: JSON.stringify([]),
        interiorImages: JSON.stringify([]),
        layoutImages: JSON.stringify([]),
      },
    });

    // Create translations for English
    await prisma.translation.create({
      data: {
        propertyId: property.id,
        language: 'EN',
        status: 'COMPLETED',
        name: property.name.replace('マンション', 'Apartment'),
        address: property.address.replace('東京都', 'Tokyo, ').replace('区', ' Ward'),
        locationDesc: 'Conveniently located near Ebisu Station. The area features many cafes, restaurants, and commercial facilities.',
        facilityDesc: 'Auto-lock, delivery box, 24-hour garbage disposal. System kitchen, bathroom dryer included.',
        investmentDesc: 'Stable rental demand expected in this popular Shibuya Ward area.',
        scriptOpening: 'Welcome to this excellent investment opportunity in Tokyo.',
        scriptLocation: 'This property is ideally situated in the heart of Ebisu.',
        scriptInterior: 'The apartment features modern amenities and quality finishes.',
        scriptConditions: `Listed at ${(property.price / 1000000).toFixed(1)} million yen.`,
        scriptInvestment: `Offering a gross yield of ${property.grossYield?.toFixed(2)}%.`,
        scriptSummary: 'An attractive investment opportunity in Tokyo.',
        scriptDisclaimer: 'Investment information is for reference only.',
      },
    });

    // Create a sample video
    await prisma.video.create({
      data: {
        propertyId: property.id,
        videoType: 'STANDARD',
        language: 'EN',
        status: 'COMPLETED',
        videoUrl: `https://example.com/videos/${property.id}-standard-en.mp4`,
        thumbnailUrl: `https://example.com/thumbnails/${property.id}.jpg`,
        duration: 270,
        packageJson: JSON.stringify({
          propertyId: property.id,
          sections: ['Opening', 'Location', 'Interior', 'Investment', 'Summary'],
        }),
      },
    });
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

