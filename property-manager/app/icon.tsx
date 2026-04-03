import { ImageResponse } from 'next/og';

export const size = {
  width: 512,
  height: 512,
};

export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 40,
          background: 'linear-gradient(180deg, #020617 0%, #0f172a 100%)',
          color: 'white',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 28,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: '#94a3b8',
          }}
        >
          PM Tenant
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 160,
              height: 160,
              borderRadius: 40,
              background: 'rgba(34,211,238,0.18)',
              border: '2px solid rgba(34,211,238,0.35)',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 72,
              fontWeight: 700,
              color: '#67e8f9',
            }}
          >
            PM
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', fontSize: 52, fontWeight: 700 }}>Tenant App</div>
            <div style={{ display: 'flex', fontSize: 26, color: '#cbd5e1' }}>
              Maintenance requests and updates
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 24,
            color: '#cbd5e1',
          }}
        >
          Secure request tracking for residents
        </div>
      </div>
    ),
    size,
  );
}
