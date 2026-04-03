import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
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
          fontSize: 72,
          fontWeight: 700,
          fontFamily: 'Inter, system-ui, sans-serif',
          borderRadius: 36,
          border: '6px solid rgba(34,211,238,0.3)',
        }}
      >
        PM
      </div>
    ),
    size,
  );
}
