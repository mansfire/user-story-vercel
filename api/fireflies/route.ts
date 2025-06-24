import { NextRequest, NextResponse } from 'next/server';

const FIRE_FLIES_API_KEY = process.env.FIREFLIES_API_KEY;

export async function GET() {
  if (!FIRE_FLIES_API_KEY) {
    return NextResponse.json({ error: 'Fireflies API key not set' }, { status: 500 });
  }

  const res = await fetch('https://api.fireflies.ai/api/v1/meetings', {
    headers: {
      Authorization: `Bearer ${FIRE_FLIES_API_KEY}`,
    },
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch transcripts' }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
