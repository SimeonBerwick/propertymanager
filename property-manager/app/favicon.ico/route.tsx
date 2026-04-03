import { NextResponse } from 'next/server';
import { ImageResponse } from 'next/og';

export async function GET() {
  const image = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #020617 0%, #0f172a 100%)',
          color: '#67e8f9',
          fontSize: 32,
          fontWeight: 700,
          fontFamily: 'Inter, system-ui, sans-serif',
          borderRadius: 12,
          border: '2px solid rgba(34,211,238,0.35)',
        }}
      >
        PM
      </div>
    ),
    {
      width: 64,
      height: 64,
    },
  );

  const buffer = await image.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
