'use client';

import { useState } from 'react';
import { Search, Globe, MapPin, Server, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface IPData {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
  asn?: string;
  postal?: string;
  country_name?: string;
  region_code?: string;
  utc_offset?: string;
  country_calling_code?: string;
  currency?: string;
  languages?: string;
  threat?: {
    is_tor?: boolean;
    is_proxy?: boolean;
    is_anonymous?: boolean;
    is_known_attacker?: boolean;
    is_known_abuser?: boolean;
    is_threat?: boolean;
    is_bogon?: boolean;
  };
  connection?: {
    asn?: number;
    domain?: string;
    organization?: string;
    route?: string;
    type?: string;
  };
}

export function IPLookup() {
  const [ipAddress, setIpAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [ipData, setIpData] = useState<IPData | null>(null);

  const lookupIP = async () => {
    if (!ipAddress.trim()) {
      toast.error('Please enter an IP address');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`https://ipapi.co/${ipAddress}/json/`);
      if (!response.ok) throw new Error('Failed to lookup IP');
      
      const data = await response.json();
      if (data.error) throw new Error(data.reason || 'Invalid IP address');
      
      setIpData(data);
      toast.success('IP lookup successful');
    } catch (error: any) {
      toast.error(error.message || 'Failed to lookup IP');
      setIpData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      lookupIP();
    }
  };

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter IP address (e.g., 8.8.8.8)"
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={lookupIP}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Looking up...
            </>
          ) : (
            <>
              <Globe className="w-4 h-4" />
              Lookup
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {ipData && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
          {/* IP Address Header */}
          <div className="border-b border-gray-700 pb-3">
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">IP Address</div>
            <div className="text-2xl font-bold text-blue-400 font-mono">{ipData.ip}</div>
            {(ipData.city || ipData.country_name || ipData.country) && (
              <div className="text-sm text-gray-400 mt-1">
                {ipData.city}, {ipData.region} · {ipData.country_name || ipData.country}
              </div>
            )}
            
            {/* Threat Indicators */}
            {ipData.threat && (
              <div className="flex flex-wrap gap-2 mt-2">
                {ipData.threat.is_tor && (
                  <span className="px-2 py-1 bg-red-900 text-red-200 text-xs rounded-full">TOR</span>
                )}
                {ipData.threat.is_proxy && (
                  <span className="px-2 py-1 bg-orange-900 text-orange-200 text-xs rounded-full">Proxy</span>
                )}
                {ipData.threat.is_anonymous && (
                  <span className="px-2 py-1 bg-yellow-900 text-yellow-200 text-xs rounded-full">Anonymous</span>
                )}
                {ipData.threat.is_known_attacker && (
                  <span className="px-2 py-1 bg-red-900 text-red-200 text-xs rounded-full">Known Attacker</span>
                )}
                {ipData.threat.is_known_abuser && (
                  <span className="px-2 py-1 bg-red-900 text-red-200 text-xs rounded-full">Known Abuser</span>
                )}
              </div>
            )}
          </div>

          {/* Location Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <MapPin className="w-3 h-3" />
                Location
              </div>
              <div className="space-y-1 text-sm">
                <div className="text-white">{ipData.city || 'Unknown'}</div>
                <div className="text-gray-400">{ipData.region || 'Unknown'}</div>
                <div className="text-gray-400">
                  {ipData.country_name || ipData.country} ({ipData.country_code})
                </div>
                {(ipData.postal || ipData.zip) && (
                  <div className="text-gray-400 text-xs">
                    Postal: {ipData.postal || ipData.zip}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <Globe className="w-3 h-3" />
                Coordinates
              </div>
              <div className="space-y-1 text-sm font-mono">
                <div className="text-white">
                  Lat: {ipData.latitude?.toFixed(5) || 'N/A'}
                </div>
                <div className="text-white">
                  Lon: {ipData.longitude?.toFixed(5) || 'N/A'}
                </div>
                <div className="text-gray-400 text-xs">
                  {ipData.timezone || 'Unknown'}
                </div>
                {ipData.utc_offset && (
                  <div className="text-gray-400 text-xs">
                    UTC {ipData.utc_offset}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Network Info */}
          {(ipData.isp || ipData.org || ipData.as || ipData.asn || ipData.connection) && (
            <div className="border-t border-gray-700 pt-3">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                <Server className="w-3 h-3" />
                Network Information
              </div>
              <div className="space-y-1 text-sm">
                {(ipData.isp || ipData.connection?.organization) && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">ISP:</span>
                    <span className="text-white text-right">{ipData.isp || ipData.connection?.organization}</span>
                  </div>
                )}
                {ipData.org && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Organization:</span>
                    <span className="text-white text-right">{ipData.org}</span>
                  </div>
                )}
                {(ipData.as || ipData.asn) && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">ASN:</span>
                    <span className="text-white font-mono">{ipData.as || ipData.asn}</span>
                  </div>
                )}
                {ipData.connection?.type && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Connection:</span>
                    <span className="text-white capitalize">{ipData.connection.type}</span>
                  </div>
                )}
                {ipData.connection?.domain && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Domain:</span>
                    <span className="text-white font-mono text-xs">{ipData.connection.domain}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Additional Info */}
          {(ipData.currency || ipData.languages || ipData.country_calling_code) && (
            <div className="border-t border-gray-700 pt-3">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                <Globe className="w-3 h-3" />
                Regional Information
              </div>
              <div className="space-y-1 text-sm">
                {ipData.currency && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Currency:</span>
                    <span className="text-white">{ipData.currency}</span>
                  </div>
                )}
                {ipData.languages && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Languages:</span>
                    <span className="text-white">{ipData.languages}</span>
                  </div>
                )}
                {ipData.country_calling_code && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Calling Code:</span>
                    <span className="text-white">{ipData.country_calling_code}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
