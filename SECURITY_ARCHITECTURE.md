# Security Center Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LOGIN ATTEMPT                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION MIDDLEWARE                     │
│  • Extract Real IP (handles proxies/load balancers)            │
│  • Normalize IP (remove IPv6 prefix)                           │
│  • Extract User Agent                                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PARALLEL DATA COLLECTION                       │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Geolocation  │  │ Reverse DNS  │  │   Device     │         │
│  │   Service    │  │    Lookup    │  │ Fingerprint  │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                  │
│         ▼                  ▼                  ▼                  │
│  ┌──────────────────────────────────────────────────┐          │
│  │         Primary: ip-api.com (45 req/min)         │          │
│  │         Fallback: ipapi.co (1000 req/day)        │          │
│  └──────────────────────────────────────────────────┘          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    THREAT ANALYSIS ENGINE                        │
│                                                                  │
│  Risk Factor Scoring:                                           │
│  • VPN/Proxy Detection        → +35 points                      │
│  • Datacenter/Hosting IP      → +25 points                      │
│  • TOR Exit Node              → +50 points (CRITICAL)           │
│  • Cloud Provider             → +15 points                      │
│  • Suspicious Reverse DNS     → +20 points                      │
│  • Malicious ASN Pattern      → +25 points                      │
│  • No Reverse DNS             → +5 points                       │
│                                                                  │
│  Threat Score: 0-100                                            │
│  • 0-20:   Low Risk    (Green)                                  │
│  • 20-40:  Medium Risk (Yellow)                                 │
│  • 40-60:  High Risk   (Orange)                                 │
│  • 60-100: Critical    (Red)                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE STORAGE                            │
│                                                                  │
│  auth_logs table:                                               │
│  • Basic: email, status, timestamp                              │
│  • IP Data: ip_address, reverse_dns                            │
│  • Geo: country, city, lat, lon, timezone                      │
│  • Network: isp, org, asn                                       │
│  • Threat: is_proxy, is_vpn, is_tor, threat_score             │
│  • Device: browser, os, device_type, user_agent                │
│                                                                  │
│  Related tables:                                                │
│  • ip_blocklist (manual blocks)                                │
│  • ip_whitelist (trusted IPs)                                  │
│  • active_sessions (session tracking)                          │
│  • security_alerts (automated alerts)                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY DASHBOARD                            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Tab 1: ANALYTICS                                      │    │
│  │  • 4 Key Metrics (logins, failures, threats, avg score)│    │
│  │  • 24-hour activity timeline chart                     │    │
│  │  • Top 5 countries visualization                       │    │
│  │  • Trend analysis (vs previous 24h)                    │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Tab 2: ACCESS CONTROL                                 │    │
│  │  • Complete login history table                        │    │
│  │  • User, IP, location, device, status                  │    │
│  │  • Threat level badges                                 │    │
│  │  • Filterable and searchable                           │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Tab 3: THREAT DETECTION                               │    │
│  │  • Threat overview (high, VPN, proxy, suspicious)      │    │
│  │  • Suspicious activity list with details               │    │
│  │  • Risk factors and threat reasons                     │    │
│  │  • Quick block IP action                               │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Tab 4: GEOLOCATION                                    │    │
│  │  • Interactive Leaflet map (dark theme)                │    │
│  │  • Login location markers with popups                  │    │
│  │  • Country access statistics                           │    │
│  │  • IP Lookup Tool (comprehensive analysis)             │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Tab 5: ACTIVE SESSIONS                                │    │
│  │  • Current active user sessions (last 24h)             │    │
│  │  • User, IP, location, device, last active             │    │
│  │  • Terminate session capability                        │    │
│  │  • Bulk terminate all sessions                         │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

```
frontend/
├── src/
│   ├── app/
│   │   └── dashboard/
│   │       └── super/
│   │           └── admin/
│   │               └── security/
│   │                   └── page.tsx ─────────┐
│   │                                         │
│   └── components/                           │
│       └── security/                         │
│           ├── SecurityAnalytics.tsx ◄───────┤
│           ├── SecurityMap.tsx ◄─────────────┤
│           └── IPLookup.tsx ◄────────────────┘
│
backend/
├── src/
│   ├── services/
│   │   └── geolocation.service.ts ──────┐
│   │       • getRealIP()                │
│   │       • normalizeIP()              │
│   │       • getGeolocation()           │
│   │       • getReverseDNS()            │
│   │       • checkIPReputation()        │
│   │       • getDeviceFingerprint()     │
│   │       • getEnhancedIPData()        │
│   │                                     │
│   └── utils/                            │
│       └── audit.ts ◄────────────────────┘
│           • logAuthAttempt()
│           • Uses geolocation service
│
database/
└── migrations/
    └── 013_add_geolocation_security_fields.sql
        • 14 new columns in auth_logs
        • 4 new tables
        • 8 indexes
        • 3 functions
        • 2 triggers
```

## Data Flow

### 1. Login Attempt
```
User → Frontend → Backend Auth → Middleware
                                    ↓
                            Extract IP & User Agent
```

### 2. Data Collection (Parallel)
```
                    ┌─→ Geolocation API (ip-api.com)
                    │   ↓ (if fails)
IP Address ─────────┼─→ Fallback API (ipapi.co)
                    │
                    ├─→ Reverse DNS Lookup
                    │
                    └─→ Device Fingerprinting
```

### 3. Threat Analysis
```
Collected Data → Risk Factor Calculation → Threat Score (0-100)
                                              ↓
                                    Categorize Risk Level
                                              ↓
                                    Flag if Suspicious
```

### 4. Storage
```
Analyzed Data → Database (auth_logs)
                    ↓
            Indexed for Fast Queries
                    ↓
            Available for Dashboard
```

### 5. Visualization
```
Database → API Endpoint → Frontend Components → User Dashboard
                              ↓
                    Real-time Filtering & Search
                              ↓
                    Interactive Charts & Maps
```

## API Integration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    GEOLOCATION PROVIDERS                     │
└─────────────────────────────────────────────────────────────┘

Primary Provider (ip-api.com):
┌──────────────────────────────────────────────────────────────┐
│ GET http://ip-api.com/json/{ip}?fields=...                  │
│                                                              │
│ Rate Limit: 45 requests/minute (free)                       │
│ Response Time: ~200ms                                        │
│ Data: country, city, lat, lon, isp, org, as, proxy, hosting │
│                                                              │
│ Success → Return Data                                        │
│ Failure → Try Fallback                                       │
└──────────────────────────────────────────────────────────────┘
                             │
                             ▼ (on failure)
┌──────────────────────────────────────────────────────────────┐
│ Fallback Provider (ipapi.co):                               │
│ GET https://ipapi.co/{ip}/json/                             │
│                                                              │
│ Rate Limit: 1000 requests/day (free)                        │
│ Response Time: ~300ms                                        │
│ Data: country, city, lat, lon, isp, org, asn, threat_level  │
│                                                              │
│ Success → Return Data                                        │
│ Failure → Return null (graceful degradation)                │
└──────────────────────────────────────────────────────────────┘

Reverse DNS:
┌──────────────────────────────────────────────────────────────┐
│ Node.js dns.reverse(ip)                                      │
│                                                              │
│ Response Time: ~100ms                                        │
│ Returns: hostname or undefined                               │
│                                                              │
│ Used for: Suspicious pattern detection                      │
└──────────────────────────────────────────────────────────────┘
```

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: AUTHENTICATION                                      │
│ • User credentials validation                                │
│ • Session management                                         │
│ • Role-based access control                                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: IP ANALYSIS                                         │
│ • Real IP extraction                                         │
│ • Geolocation lookup                                         │
│ • Reverse DNS verification                                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: THREAT DETECTION                                    │
│ • VPN/Proxy detection                                        │
│ • TOR network identification                                 │
│ • Datacenter IP flagging                                     │
│ • Suspicious ASN patterns                                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: BEHAVIORAL ANALYSIS                                 │
│ • Brute force detection                                      │
│ • Impossible travel detection                                │
│ • Device fingerprint changes                                 │
│ • Geographic anomalies                                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: RESPONSE                                            │
│ • Log all attempts                                           │
│ • Alert on suspicious activity                               │
│ • Block malicious IPs                                        │
│ • Terminate suspicious sessions                              │
└─────────────────────────────────────────────────────────────┘
```

## Performance Optimization

```
┌─────────────────────────────────────────────────────────────┐
│                    OPTIMIZATION STRATEGIES                   │
└─────────────────────────────────────────────────────────────┘

1. Parallel Processing:
   ┌──────────────┐
   │ Geolocation  │─┐
   └──────────────┘ │
   ┌──────────────┐ ├─→ Promise.all() → Combined Result
   │ Reverse DNS  │─┤
   └──────────────┘ │
   ┌──────────────┐ │
   │ Fingerprint  │─┘
   └──────────────┘

2. Database Indexing:
   • ip_address (B-tree)
   • created_at (B-tree)
   • threat_score (B-tree)
   • geo_country (B-tree)
   • is_suspicious (B-tree)

3. Caching Strategy (Recommended):
   Redis Cache:
   • Key: ip:{ip_address}
   • TTL: 1 hour
   • Data: Geolocation + Threat Score
   • Hit Rate: ~80% (same IPs repeat)

4. Query Optimization:
   • Limit results (50 per page)
   • Use indexes for WHERE clauses
   • Aggregate data in database
   • Lazy load charts/maps

5. API Rate Limiting:
   • Track requests per minute
   • Implement exponential backoff
   • Use fallback providers
   • Cache successful lookups
```

## Monitoring & Alerts

```
┌─────────────────────────────────────────────────────────────┐
│                    MONITORING DASHBOARD                      │
└─────────────────────────────────────────────────────────────┘

Real-time Metrics:
├─ API Health
│  ├─ ip-api.com status
│  ├─ ipapi.co status
│  └─ Response times
│
├─ Threat Levels
│  ├─ Critical threats (60-100)
│  ├─ High threats (40-60)
│  └─ Medium threats (20-40)
│
├─ System Performance
│  ├─ Database query time
│  ├─ API response time
│  └─ Dashboard load time
│
└─ Security Events
   ├─ Failed login attempts
   ├─ Suspicious IPs detected
   ├─ VPN/Proxy usage
   └─ Geographic anomalies

Alert Triggers:
• Threat score > 60 → Critical Alert
• Failed logins > 5 in 5 min → Brute Force Alert
• Impossible travel detected → Geographic Alert
• TOR network detected → High Risk Alert
• API failure → System Alert
```

## Scalability Plan

```
Current Capacity:
├─ Concurrent Users: 100+
├─ Requests/min: 45 (API limit)
├─ Database: Millions of logs
└─ Response Time: 1-2 seconds

With Redis Caching:
├─ Concurrent Users: 1,000+
├─ Requests/min: Unlimited (cached)
├─ Database: Same
└─ Response Time: 200-500ms

With Load Balancing:
├─ Concurrent Users: 10,000+
├─ Requests/min: Distributed
├─ Database: Sharded
└─ Response Time: 100-300ms
```

This architecture provides a robust, scalable, and ethical security monitoring system focused on defensive protection.
