import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.FIREFLIES_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'Fireflies API key not set' }, { status: 500 });
  }

  try {
    const res = await fetch('https://api.fireflies.ai/api/v1/meetings', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch transcripts from Fireflies' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}
