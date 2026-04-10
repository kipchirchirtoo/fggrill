import axios from 'axios';
import { logger } from '../utils/logger';
import dns from 'dns';
import { promisify } from 'util';

const dnsReverse = promisify(dns.reverse);

export interface GeolocationData {
  ip: string;
  country: string;
  country_code: string;
  region: string;
  region_code: string;
  city: string;
  zip: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
  is_proxy: boolean;
  is_vpn: boolean;
  is_tor: boolean;
  is_datacenter: boolean;
  is_hosting: boolean;
  threat_level: 'low' | 'medium' | 'high' | 'critical';
  reverse_dns?: string;
  connection_type?: string;
  usage_type?: string;
}

export interface EnhancedIPData {
  geo: GeolocationData | null;
  reputation: {
    is_suspicious: boolean;
    reason?: string;
    threat_score: number;
    risk_factors: string[];
  };
  device: {
    browser: string;
    browser_version: string;
    os: string;
    os_version: string;
    device_type: string;
    is_mobile: boolean;
    is_bot: boolean;
    engine: string;
  };
  network: {
    reverse_dns?: string;
    asn?: string;
    isp?: string;
    connection_type?: string;
  };
}

/**
 * Get real IP address from request, handling proxies and load balancers
 */
export const getRealIP = (req: any): string => {
  // Check various headers in order of priority
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    const ips = forwarded.split(',').map((ip: string) => ip.trim());
    return ips[0];
  }

  const realIP = req.headers['x-real-ip'];
  if (realIP) return realIP;

  const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
  if (cfConnectingIP) return cfConnectingIP;

  const trueClientIP = req.headers['true-client-ip']; // Akamai/Cloudflare
  if (trueClientIP) return trueClientIP;

  // Fallback to req.ip or socket address
  return req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
};

/**
 * Clean and normalize IP address (remove IPv6 prefix if present)
 */
export const normalizeIP = (ip: string): string => {
  if (!ip) return 'unknown';
  
  // Remove IPv6 prefix for IPv4 addresses
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }
  
  // Handle localhost
  if (ip === '::1' || ip === '127.0.0.1') {
    return '127.0.0.1';
  }
  
  return ip;
};

/**
 * Get reverse DNS for an IP address
 */
export const getReverseDNS = async (ip: string): Promise<string | undefined> => {
  try {
    const normalizedIP = normalizeIP(ip);
    if (normalizedIP === '127.0.0.1' || normalizedIP === 'unknown') {
      return 'localhost';
    }

    const hostnames = await dnsReverse(normalizedIP);
    return hostnames && hostnames.length > 0 ? hostnames[0] : undefined;
  } catch (error) {
    // DNS lookup failed - not necessarily an error
    return undefined;
  }
};

/**
 * Get geolocation data with fallback to multiple providers
 * Primary: ip-api.com (free, 45 req/min)
 * Fallback: ipapi.co (free, 1000 req/day)
 */
export const getGeolocation = async (ip: string): Promise<GeolocationData | null> => {
  try {
    const normalizedIP = normalizeIP(ip);
    
    // Skip localhost
    if (normalizedIP === '127.0.0.1' || normalizedIP === 'unknown') {
      return {
        ip: normalizedIP,
        country: 'Local',
        country_code: 'LOCAL',
        region: 'Local',
        region_code: 'LOCAL',
        city: 'Localhost',
        zip: '00000',
        latitude: 0,
        longitude: 0,
        timezone: 'UTC',
        isp: 'Local Network',
        org: 'Local',
        as: 'Local',
        is_proxy: false,
        is_vpn: false,
        is_tor: false,
        is_datacenter: false,
        is_hosting: false,
        threat_level: 'low',
        reverse_dns: 'localhost'
      };
    }

    // Get reverse DNS
    const reverse_dns = await getReverseDNS(normalizedIP);

    // Try primary provider: ip-api.com (free tier: 45 requests/minute)
    try {
      const response = await axios.get(
        `http://ip-api.com/json/${normalizedIP}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,proxy,hosting,mobile`,
        { timeout: 5000 }
      );

      if (response.data.status === 'success') {
        const data = response.data;

        // Determine threat level based on proxy/hosting detection
        let threat_level: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (data.proxy || data.hosting) {
          threat_level = 'medium';
        }

        return {
          ip: normalizedIP,
          country: data.country || 'Unknown',
          country_code: data.countryCode || 'XX',
          region: data.regionName || 'Unknown',
          region_code: data.region || 'XX',
          city: data.city || 'Unknown',
          zip: data.zip || '',
          latitude: data.lat || 0,
          longitude: data.lon || 0,
          timezone: data.timezone || 'UTC',
          isp: data.isp || 'Unknown',
          org: data.org || 'Unknown',
          as: data.as || 'Unknown',
          is_proxy: data.proxy || false,
          is_vpn: data.proxy || false,
          is_tor: false,
          is_datacenter: data.hosting || false,
          is_hosting: data.hosting || false,
          threat_level,
          reverse_dns,
          connection_type: data.mobile ? 'mobile' : 'broadband'
        };
      }
    } catch (primaryError: any) {
      logger.warn(`Primary geolocation provider failed, trying fallback: ${primaryError.message}`);
    }

    // Fallback to ipapi.co
    try {
      const response = await axios.get(
        `https://ipapi.co/${normalizedIP}/json/`,
        { timeout: 5000 }
      );

      if (!response.data.error) {
        const data = response.data;

        let threat_level: 'low' | 'medium' | 'high' | 'critical' = 'low';
        if (data.threat_level) {
          threat_level = data.threat_level;
        }

        return {
          ip: normalizedIP,
          country: data.country_name || 'Unknown',
          country_code: data.country_code || 'XX',
          region: data.region || 'Unknown',
          region_code: data.region_code || 'XX',
          city: data.city || 'Unknown',
          zip: data.postal || '',
          latitude: data.latitude || 0,
          longitude: data.longitude || 0,
          timezone: data.timezone || 'UTC',
          isp: data.org || 'Unknown',
          org: data.org || 'Unknown',
          as: data.asn || 'Unknown',
          is_proxy: false,
          is_vpn: false,
          is_tor: false,
          is_datacenter: false,
          is_hosting: false,
          threat_level,
          reverse_dns,
          connection_type: data.connection?.connection_type
        };
      }
    } catch (fallbackError: any) {
      logger.error(`Fallback geolocation provider also failed: ${fallbackError.message}`);
    }

    return null;
  } catch (error: any) {
    logger.error(`Error fetching geolocation for IP ${ip}:`, error.message);
    return null;
  }
};

/**
 * Enhanced IP reputation check with multiple risk factors
 */
export const checkIPReputation = async (ip: string): Promise<{
  is_suspicious: boolean;
  reason?: string;
  threat_score: number;
  risk_factors: string[];
}> => {
  try {
    const normalizedIP = normalizeIP(ip);
    
    // Skip localhost
    if (normalizedIP === '127.0.0.1' || normalizedIP === 'unknown') {
      return { is_suspicious: false, threat_score: 0, risk_factors: [] };
    }

    let threat_score = 0;
    const risk_factors: string[] = [];

    // Get geolocation data
    const geo = await getGeolocation(normalizedIP);
    
    if (geo) {
      // VPN/Proxy detection (HIGH RISK)
      if (geo.is_proxy || geo.is_vpn) {
        threat_score += 35;
        risk_factors.push('VPN/Proxy detected');
      }
      
      // Datacenter/Hosting IP (MEDIUM RISK)
      if (geo.is_datacenter || geo.is_hosting) {
        threat_score += 25;
        risk_factors.push('Datacenter/Hosting IP');
      }

      // TOR exit node (CRITICAL RISK)
      if (geo.is_tor) {
        threat_score += 50;
        risk_factors.push('TOR exit node');
      }

      // Cloud provider detection (MEDIUM RISK)
      const cloudProviders = [
        'amazonaws', 'aws', 'amazon',
        'google cloud', 'gcp',
        'azure', 'microsoft',
        'digitalocean',
        'linode',
        'vultr',
        'ovh',
        'hetzner'
      ];
      const orgLower = geo.org.toLowerCase();
      const ispLower = geo.isp.toLowerCase();
      
      if (cloudProviders.some(provider => orgLower.includes(provider) || ispLower.includes(provider))) {
        threat_score += 15;
        risk_factors.push('Cloud provider');
      }

      // Suspicious reverse DNS patterns
      if (geo.reverse_dns) {
        const suspiciousPatterns = ['vpn', 'proxy', 'tor', 'relay', 'exit'];
        if (suspiciousPatterns.some(pattern => geo.reverse_dns!.toLowerCase().includes(pattern))) {
          threat_score += 20;
          risk_factors.push('Suspicious reverse DNS');
        }
      }

      // Check for known malicious ASN patterns
      if (geo.as) {
        const suspiciousASNs = ['bulletproof', 'anonymous', 'privacy'];
        if (suspiciousASNs.some(pattern => geo.as.toLowerCase().includes(pattern))) {
          threat_score += 25;
          risk_factors.push('Suspicious ASN');
        }
      }
    }

    // Get reverse DNS for additional checks
    const reverseDNS = await getReverseDNS(normalizedIP);
    if (!reverseDNS) {
      threat_score += 5;
      risk_factors.push('No reverse DNS');
    }

    // Cap threat score at 100
    threat_score = Math.min(threat_score, 100);

    return {
      is_suspicious: threat_score >= 40,
      reason: risk_factors.join(', '),
      threat_score,
      risk_factors
    };
  } catch (error: any) {
    logger.error(`Error checking IP reputation for ${ip}:`, error.message);
    return { is_suspicious: false, threat_score: 0, risk_factors: [] };
  }
};

/**
 * Enhanced device fingerprint with detailed version detection
 */
export const getDeviceFingerprint = (userAgent: string): {
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  device_type: string;
  is_mobile: boolean;
  is_bot: boolean;
  engine: string;
} => {
  if (!userAgent) {
    return {
      browser: 'Unknown',
      browser_version: '',
      os: 'Unknown',
      os_version: '',
      device_type: 'Unknown',
      is_mobile: false,
      is_bot: false,
      engine: 'Unknown'
    };
  }

  const ua = userAgent.toLowerCase();

  // Detect bots (ENHANCED)
  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 
    'python', 'java', 'perl', 'ruby', 'go-http', 'axios',
    'postman', 'insomnia', 'httpie', 'slurp', 'mediapartners'
  ];
  const is_bot = botPatterns.some(pattern => ua.includes(pattern));

  // Detect browser with version (ENHANCED)
  let browser = 'Unknown';
  let browser_version = '';
  let engine = 'Unknown';

  if (ua.includes('edg/')) {
    browser = 'Edge';
    const match = ua.match(/edg\/([\d.]+)/);
    browser_version = match ? match[1] : '';
    engine = 'Blink';
  } else if (ua.includes('chrome/')) {
    browser = 'Chrome';
    const match = ua.match(/chrome\/([\d.]+)/);
    browser_version = match ? match[1] : '';
    engine = 'Blink';
  } else if (ua.includes('firefox/')) {
    browser = 'Firefox';
    const match = ua.match(/firefox\/([\d.]+)/);
    browser_version = match ? match[1] : '';
    engine = 'Gecko';
  } else if (ua.includes('safari/') && !ua.includes('chrome')) {
    browser = 'Safari';
    const match = ua.match(/version\/([\d.]+)/);
    browser_version = match ? match[1] : '';
    engine = 'WebKit';
  } else if (ua.includes('opera/') || ua.includes('opr/')) {
    browser = 'Opera';
    const match = ua.match(/(?:opera|opr)\/([\d.]+)/);
    browser_version = match ? match[1] : '';
    engine = 'Blink';
  } else if (ua.includes('brave/')) {
    browser = 'Brave';
    engine = 'Blink';
  }

  // Detect OS with version (ENHANCED)
  let os = 'Unknown';
  let os_version = '';

  if (ua.includes('windows nt')) {
    os = 'Windows';
    const match = ua.match(/windows nt ([\d.]+)/);
    if (match) {
      const version = match[1];
      // Map NT versions to Windows versions
      const versionMap: Record<string, string> = {
        '10.0': '10/11',
        '6.3': '8.1',
        '6.2': '8',
        '6.1': '7',
        '6.0': 'Vista',
        '5.1': 'XP'
      };
      os_version = versionMap[version] || version;
    }
  } else if (ua.includes('mac os x')) {
    os = 'macOS';
    const match = ua.match(/mac os x ([\d_]+)/);
    os_version = match ? match[1].replace(/_/g, '.') : '';
  } else if (ua.includes('android')) {
    os = 'Android';
    const match = ua.match(/android ([\d.]+)/);
    os_version = match ? match[1] : '';
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS';
    const match = ua.match(/os ([\d_]+)/);
    os_version = match ? match[1].replace(/_/g, '.') : '';
  } else if (ua.includes('linux')) {
    os = 'Linux';
    if (ua.includes('ubuntu')) os_version = 'Ubuntu';
    else if (ua.includes('debian')) os_version = 'Debian';
    else if (ua.includes('fedora')) os_version = 'Fedora';
    else if (ua.includes('centos')) os_version = 'CentOS';
  }

  // Detect device type (ENHANCED)
  const is_mobile = ua.includes('mobile') || ua.includes('android') || ua.includes('iphone');
  let device_type = 'Desktop';
  
  if (ua.includes('tablet') || ua.includes('ipad')) {
    device_type = 'Tablet';
  } else if (is_mobile) {
    device_type = 'Mobile';
  } else if (ua.includes('smart-tv') || ua.includes('smarttv')) {
    device_type = 'Smart TV';
  } else if (ua.includes('console')) {
    device_type = 'Gaming Console';
  }

  return {
    browser,
    browser_version,
    os,
    os_version,
    device_type,
    is_mobile,
    is_bot,
    engine
  };
};

/**
 * Get comprehensive IP analysis (all data in one call)
 */
export const getEnhancedIPData = async (ip: string, userAgent?: string): Promise<EnhancedIPData> => {
  const normalizedIP = normalizeIP(ip);
  
  // Run all checks in parallel for performance
  const [geo, reputation, reverseDNS] = await Promise.all([
    getGeolocation(normalizedIP),
    checkIPReputation(normalizedIP),
    getReverseDNS(normalizedIP)
  ]);

  const device = userAgent ? getDeviceFingerprint(userAgent) : {
    browser: 'Unknown',
    browser_version: '',
    os: 'Unknown',
    os_version: '',
    device_type: 'Unknown',
    is_mobile: false,
    is_bot: false,
    engine: 'Unknown'
  };

  return {
    geo,
    reputation,
    device,
    network: {
      reverse_dns: reverseDNS,
      asn: geo?.as,
      isp: geo?.isp,
      connection_type: geo?.connection_type
    }
  };
};
