import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Famous Gates Hotels — Luxury Hotel in Nairobi, Kenya'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#1a1a2e',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px'
        }}
      >
        <div style={{ color: '#d4af37', fontSize: 28, marginBottom: 16 }}>
          ★ LUXURY HOTEL · NAIROBI, KENYA ★
        </div>
        <div style={{ color: '#ffffff', fontSize: 64, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>
          Famous Gates Hotels
        </div>
        <div style={{ color: '#cccccc', fontSize: 28, marginTop: 20, textAlign: 'center' }}>
          FG Grill · Conference Facilities · Luxury Rooms
        </div>
        <div style={{ color: '#d4af37', fontSize: 22, marginTop: 30 }}>
          famousgates.com
        </div>
      </div>
    ),
    { ...size }
  )
}
