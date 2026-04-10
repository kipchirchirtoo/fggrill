'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { MapPin } from 'lucide-react';

// Dynamically import Leaflet to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);

const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);

const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

interface SecurityMapProps {
  logs: Array<{
    id: string;
    geo_latitude?: number;
    geo_longitude?: number;
    geo_city?: string;
    geo_country?: string;
    ip_address?: string;
    email?: string;
    is_suspicious?: boolean;
    threat_score?: number;
  }>;
}

export function SecurityMap({ logs }: SecurityMapProps) {
  const mapRef = useRef<any>(null);

  // Filter logs with valid coordinates
  const logsWithCoords = logs.filter(
    (log) => log.geo_latitude && log.geo_longitude
  );

  useEffect(() => {
    // Import Leaflet CSS
    import('leaflet/dist/leaflet.css');
    
    // Fix Leaflet default marker icon issue
    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });
    });
  }, []);

  if (logsWithCoords.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900 text-gray-400">
        <div className="text-center">
          <MapPin className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>No geolocation data available</p>
          <p className="text-sm mt-1">Login attempts will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      <MapContainer
        center={[logsWithCoords[0].geo_latitude!, logsWithCoords[0].geo_longitude!]}
        zoom={3}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {logsWithCoords.map((log) => (
          <Marker
            key={log.id}
            position={[log.geo_latitude!, log.geo_longitude!]}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-bold mb-1">
                  {log.geo_city}, {log.geo_country}
                </div>
                <div className="text-xs space-y-1">
                  <div>IP: {log.ip_address}</div>
                  <div>User: {log.email}</div>
                  {log.is_suspicious && (
                    <div className="text-red-500 font-bold">
                      ⚠️ Suspicious (Score: {log.threat_score})
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs z-[1000]">
        <div className="font-bold text-gray-300 mb-2">Legend</div>
        <div className="space-y-1 text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Login Location</span>
          </div>
          <div className="text-gray-500 text-[10px] mt-2">
            {logsWithCoords.length} location{logsWithCoords.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
