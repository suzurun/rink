import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const property = await prisma.property.findUnique({
      where: { id: params.id },
      include: { translations: true },
    });

    if (!property) {
      return NextResponse.json(
        { error: '物件が見つかりません' },
        { status: 404 }
      );
    }

    // Check if translations exist
    if (property.translations.length === 0) {
      return NextResponse.json(
        { error: '先に翻訳を生成してください' },
        { status: 400 }
      );
    }

    const videoTypes = ['STANDARD', 'SHORT'] as const;
    const languages = ['EN', 'ZH_CN'] as const; // Generate for EN and ZH_CN

    for (const language of languages) {
      const translation = property.translations.find(t => t.language === language);
      if (!translation || translation.status !== 'COMPLETED') continue;

      for (const videoType of videoTypes) {
        // Check if video already exists
        const existing = await prisma.video.findUnique({
          where: {
            propertyId_videoType_language: {
              propertyId: params.id,
              videoType,
              language,
            },
          },
        });

        const packageJson = generateVideoPackage(property, translation, videoType);

        if (existing) {
          await prisma.video.update({
            where: { id: existing.id },
            data: { 
              status: 'PROCESSING',
              packageJson: JSON.stringify(packageJson),
            },
          });
        } else {
          await prisma.video.create({
            data: {
              propertyId: params.id,
              videoType,
              language,
              status: 'PROCESSING',
              packageJson: JSON.stringify(packageJson),
            },
          });
        }

        // Simulate video generation process
        const duration = videoType === 'STANDARD' ? 240 + Math.floor(Math.random() * 60) : 30 + Math.floor(Math.random() * 30);
        
        setTimeout(async () => {
          await prisma.video.update({
            where: {
              propertyId_videoType_language: {
                propertyId: params.id,
                videoType,
                language,
              },
            },
            data: {
              status: 'COMPLETED',
              videoUrl: `https://example.com/videos/${params.id}-${videoType.toLowerCase()}-${language.toLowerCase()}.mp4`,
              thumbnailUrl: `https://example.com/thumbnails/${params.id}-${videoType.toLowerCase()}-${language.toLowerCase()}.jpg`,
              duration,
            },
          });
        }, 5000 + Math.random() * 5000);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Video generation error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

function generateVideoPackage(property: any, translation: any, videoType: 'STANDARD' | 'SHORT') {
  const basePackage = {
    propertyId: property.id,
    propertyName: translation.name || property.name,
    language: translation.language,
    videoType,
    sections: [] as any[],
  };

  if (videoType === 'STANDARD') {
    // Full 4-5 minute video
    basePackage.sections = [
      {
        name: 'Opening',
        duration: 15,
        script: translation.scriptOpening,
        images: [],
        transition: 'fade',
      },
      {
        name: 'Location',
        duration: 45,
        script: translation.scriptLocation,
        images: [],
        transition: 'slide',
        map: {
          address: property.address,
          station: property.nearestStation,
        },
      },
      {
        name: 'Interior',
        duration: 60,
        script: translation.scriptInterior,
        images: property.interiorImages ? JSON.parse(property.interiorImages) : [],
        transition: 'zoom',
      },
      {
        name: 'Selling Conditions',
        duration: 45,
        script: translation.scriptConditions,
        data: {
          price: property.price,
          maintenanceFee: property.maintenanceFee,
          repairReserve: property.repairReserve,
        },
        transition: 'fade',
      },
      {
        name: 'Investment Info',
        duration: 45,
        script: translation.scriptInvestment,
        data: {
          grossYield: property.grossYield,
          netYield: property.netYield,
          expectedRent: property.expectedRent,
        },
        transition: 'fade',
      },
      {
        name: 'Summary',
        duration: 30,
        script: translation.scriptSummary,
        transition: 'fade',
      },
      {
        name: 'Disclaimer',
        duration: 20,
        script: translation.scriptDisclaimer,
        transition: 'fade',
      },
    ];
  } else {
    // Short 30-60 second video
    basePackage.sections = [
      {
        name: 'Hook',
        duration: 5,
        script: `${translation.name || property.name} - ${property.layout}`,
        transition: 'quick',
      },
      {
        name: 'Key Points',
        duration: 15,
        script: `${property.nearestStation} ${property.walkMinutes}min | ${property.area}sqm | ${property.buildYear}`,
        transition: 'quick',
      },
      {
        name: 'Price & Yield',
        duration: 15,
        script: `¥${(property.price / 10000).toFixed(0)}万 | Yield: ${property.grossYield?.toFixed(1)}%`,
        transition: 'quick',
      },
      {
        name: 'CTA',
        duration: 10,
        script: 'Contact for details',
        transition: 'fade',
      },
    ];
  }

  return basePackage;
}

