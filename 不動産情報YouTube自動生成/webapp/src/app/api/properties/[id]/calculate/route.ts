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

    // Calculate investment metrics
    const price = property.price;
    const expectedRent = property.expectedRent || estimateRent(property);
    const monthlyExpenses = (property.maintenanceFee || 0) + 
                           (property.repairReserve || 0) + 
                           (property.otherCosts || 0);

    // Gross yield = (Annual rent / Price) * 100
    const grossYield = ((expectedRent * 12) / price) * 100;

    // Net yield = ((Annual rent - Annual expenses) / Price) * 100
    const annualExpenses = monthlyExpenses * 12;
    const netYield = (((expectedRent * 12) - annualExpenses) / price) * 100;

    // Estimate vacancy rate based on location and property type
    const vacancyRate = estimateVacancyRate(property);

    // Market rent estimate (simplified)
    const marketRentEstimate = estimateMarketRent(property);

    // Update property with calculated values
    await prisma.property.update({
      where: { id: params.id },
      data: {
        expectedRent,
        grossYield: parseFloat(grossYield.toFixed(2)),
        netYield: parseFloat(netYield.toFixed(2)),
        vacancyRate: parseFloat(vacancyRate.toFixed(3)),
        marketRentEstimate,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        expectedRent,
        grossYield: grossYield.toFixed(2),
        netYield: netYield.toFixed(2),
        vacancyRate: (vacancyRate * 100).toFixed(1),
        marketRentEstimate,
      },
    });
  } catch (error) {
    console.error('Calculation error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

function estimateRent(property: any): number {
  // Simple rent estimation based on area and location
  const baseRentPerSqm = 3500; // Base rent per sqm in yen
  const area = property.area || 30;
  
  // Adjust based on walk minutes
  const walkMinutes = property.walkMinutes || 10;
  const walkAdjustment = walkMinutes <= 5 ? 1.2 : walkMinutes <= 10 ? 1.0 : 0.9;
  
  // Adjust based on build year
  const buildYear = property.buildYear || 2000;
  const age = new Date().getFullYear() - buildYear;
  const ageAdjustment = age <= 5 ? 1.1 : age <= 15 ? 1.0 : age <= 30 ? 0.9 : 0.8;
  
  return Math.round(baseRentPerSqm * area * walkAdjustment * ageAdjustment);
}

function estimateVacancyRate(property: any): number {
  // Simplified vacancy rate estimation
  const walkMinutes = property.walkMinutes || 10;
  
  // Base vacancy rate
  let rate = 0.05;
  
  // Adjust based on station proximity
  if (walkMinutes <= 5) {
    rate = 0.03;
  } else if (walkMinutes <= 10) {
    rate = 0.05;
  } else {
    rate = 0.08;
  }
  
  // Add some random variation
  rate += (Math.random() - 0.5) * 0.02;
  
  return Math.max(0.01, Math.min(0.15, rate));
}

function estimateMarketRent(property: any): number {
  // Estimate market rent with some variation
  const expectedRent = property.expectedRent || estimateRent(property);
  const variation = (Math.random() - 0.5) * 0.2; // ±10%
  
  return Math.round(expectedRent * (1 + variation));
}

