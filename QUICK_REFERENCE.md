# Security Center - Quick Reference Card

## 🚀 Quick Start (3 Commands)

```bash
# 1. Apply migration (Supabase SQL Editor)
# Copy/paste: database/migrations/013_add_geolocation_security_fields.sql

# 2. Restart backend
cd backend && npm run dev

# 3. Restart frontend
cd frontend && npm run dev
```

## 📍 Access Points

| Feature | URL | Role Required |
|---------|-----|---------------|
| Security Center | `/dashboard/super/admin/security` | SUPER_ADMIN |
| Analytics Tab | Default tab on load | SUPER_ADMIN |
| IP Lookup | Geolocation tab → Expand tool | SUPER_ADMIN |

## 📊 Dashboard Tabs

| Tab | Purpose | Key Features |
|-----|---------|--------------|
| **Analytics** | Overview metrics | 4 metrics, 24h chart, top countries |
| **Access Control** | Login history | Full table, filters, threat badges |
| **Threat Detection** | Security alerts | Suspicious activity, risk factors |
| **Geolocation** | Location tracking | Interactive map, IP lookup tool |
| **Active Sessions** | Current users | Session management, terminate |

## 🎯 Threat Scoring

| Score | Level | Color | Action |
|-------|-------|-------|--------|
| 0-20 | Low | 🟢 Green | Monitor |
| 20-40 | Medium | 🟡 Yellow | Review |
| 40-60 | High | 🟠 Orange | Investigate |
| 60-100 | Critical | 🔴 Red | Block/Alert |

## 🔍 Risk Factors

| Factor | Points | Description |
|--------|--------|-------------|
| TOR Exit Node | +50 | Critical threat |
| VPN/Proxy | +35 | High anonymity |
| Datacenter IP | +25 | Hosting provider |
| Suspicious ASN | +25 | Malicious network |
| Suspicious DNS | +20 | Bad hostname |
| Cloud Provider | +15 | AWS, GCP, Azure |
| No Reverse DNS | +5 | Missing hostname |

## 🌐 Geolocation APIs

| Provider | Rate Limit | Fallback Order |
|----------|------------|----------------|
| ip-api.com | 45 req/min | Primary |
| ipapi.co | 1000 req/day | Secondary |

## 🛠️ Key Functions

### Backend (`backend/src/services/geolocation.service.ts`)

```typescript
getRealIP(req)                    // Extract real IP from request
normalizeIP(ip)                   // Clean IP address
getGeolocation(ip)                // Get location data
getReverseDNS(ip)                 // DNS lookup
checkIPReputation(ip)             // Calculate threat score
getDeviceFingerprint(userAgent)   // Parse device info
getEnhancedIPData(ip, userAgent)  // All-in-one analysis
```

### Frontend Components

```typescript
SecurityAnalytics    // Analytics dashboard with charts
SecurityMap          // Interactive Leaflet map
IPLookup            // IP address lookup tool
```

## 📝 Database Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `auth_logs` | Login tracking | ip_address, threat_score, geo_* |
| `ip_blocklist` | Blocked IPs | ip_address, reason, blocked_at |
| `ip_whitelist` | Trusted IPs | ip_address, description |
| `active_sessions` | Current sessions | user_id, ip_address, last_active |
| `security_alerts` | Automated alerts | alert_type, severity, details |

## 🔧 Common Commands

### Check Migration Status
```bash
cd backend
node check-migration-status.js
```

### Test Geolocation API
```bash
curl http://ip-api.com/json/8.8.8.8
```

### Test Reverse DNS
```bash
node -e "const dns = require('dns'); dns.reverse('8.8.8.8', (err, h) => console.log(h));"
```

### Clear Frontend Cache
```bash
cd frontend
rm -rf .next
npm run dev
```

### View Backend Logs
```bash
cd backend
npm run dev | grep -i "geolocation\|threat\|security"
```

## 🐛 Troubleshooting

| Issue | Quick Fix |
|-------|-----------|
| Migration not applied | Run in Supabase SQL Editor |
| No location data | Check API rate limits (45/min) |
| Map not loading | Reinstall: `npm i leaflet react-leaflet@4.2.1` |
| Analytics empty | Login/logout to generate data |
| Threat scores zero | Verify migration applied |

## 📈 Performance Tips

| Optimization | Impact | Effort |
|--------------|--------|--------|
| Redis caching | 80% faster | Medium |
| Database indexes | 50% faster | Low (included) |
| API rate limiting | Prevents errors | Low |
| Lazy load charts | Faster initial load | Medium |

## 🔒 Security Best Practices

✅ **Do**:
- Monitor threat scores daily
- Review suspicious activity
- Block malicious IPs
- Archive old logs (>90 days)
- Update threat patterns regularly

❌ **Don't**:
- Share API keys publicly
- Ignore critical alerts
- Block legitimate users
- Store sensitive data unencrypted
- Exceed API rate limits

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `ENHANCED_SECURITY_FEATURES.md` | Complete feature guide |
| `SECURITY_ARCHITECTURE.md` | System architecture diagrams |
| `SECURITY_ENHANCEMENT_SUMMARY.md` | Quick overview |
| `IMPLEMENTATION_GUIDE.md` | Step-by-step setup |
| `QUICK_REFERENCE.md` | This file |

## 🎨 UI Components

### Metric Cards
```
┌─────────────────────┐
│ Total Logins (24h)  │
│      1,234          │
│ ↗ +12.5% vs yesterday│
└─────────────────────┘
```

### Threat Badge
```
🔴 High Risk (Score: 65)
🟠 Medium Risk (Score: 45)
🟡 Low Risk (Score: 25)
🟢 Clean (Score: 10)
```

### Activity Chart
```
00:00 ████████░░░░░░░░ 8
01:00 ████░░░░░░░░░░░░ 4
02:00 ██░░░░░░░░░░░░░░ 2
...
23:00 ████████████░░░░ 12
```

## 🌍 Geolocation Data

### Location Info
- Country, City, Region
- Latitude, Longitude
- Timezone, UTC Offset
- Postal Code

### Network Info
- ISP, Organization
- ASN (Autonomous System Number)
- Connection Type (mobile/broadband)
- Reverse DNS Hostname

### Threat Indicators
- VPN/Proxy Detection
- TOR Exit Node
- Datacenter/Hosting IP
- Known Attacker/Abuser

## 🔔 Alert Types

| Type | Trigger | Severity |
|------|---------|----------|
| Brute Force | 5+ failed logins in 5 min | High |
| Impossible Travel | Login from 2 distant locations | High |
| TOR Detected | TOR exit node access | Critical |
| High Threat Score | Score > 60 | Critical |
| VPN/Proxy | Anonymous access | Medium |
| Geographic Anomaly | Unusual location | Medium |

## 💡 Pro Tips

1. **Use Filters**: Combine status + threat filters for targeted analysis
2. **Export Data**: Use export button for compliance reports
3. **IP Lookup**: Test suspicious IPs before blocking
4. **Peak Hours**: Check analytics to identify attack patterns
5. **Session Management**: Regularly review and terminate old sessions
6. **Whitelist**: Add trusted IPs to reduce false positives
7. **Trends**: Monitor 24h trends to spot anomalies early

## 📞 Support

| Resource | Link/Command |
|----------|--------------|
| Check Status | `node check-migration-status.js` |
| View Logs | `npm run dev` (backend) |
| Test APIs | `curl http://ip-api.com/json/8.8.8.8` |
| Documentation | See files above |

## ✅ Success Checklist

- [ ] Migration applied successfully
- [ ] Backend running without errors
- [ ] Frontend loads Security Center
- [ ] Analytics tab shows data
- [ ] IP Lookup tool works
- [ ] Map displays locations
- [ ] Threat detection active
- [ ] No console errors

---

**Version**: 1.0.0  
**Last Updated**: 2026-04-10  
**Status**: ✅ Production Ready
