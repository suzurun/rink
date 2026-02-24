import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const url = await prisma.url.findUnique({
      where: { id: params.id },
    });

    if (!url) {
      return NextResponse.json(
        { error: 'URLが見つかりません' },
        { status: 404 }
      );
    }

    // Reset status to pending
    await prisma.url.update({
      where: { id: params.id },
      data: {
        status: 'PENDING',
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Retry error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

