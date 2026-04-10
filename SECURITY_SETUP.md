# 🔒 Security Center - Quick Setup Guide

## What's New

Your system now has a **comprehensive security management dashboard** with:

✅ **Real IP Address Tracking** - No more localhost, captures actual client IPs  
✅ **Geolocation Tracking** - See where users are logging in from (country, city, coordinates)  
✅ **Threat Detection** - Automatic detection of VPNs, proxies, suspicious IPs  
✅ **Device Fingerprinting** - Track browsers, OS, device types  
✅ **Security Alerts** - Auto-detect brute force attacks & impossible travel  
✅ **IP Blocklist/Whitelist** - Block malicious IPs, whitelist trusted ones  
✅ **Active Session Management** - Monitor and terminate sessions remotely  
✅ **Geographic Analytics** - Visualize access patterns by location  

## Quick Start (3 Steps)

### Step 1: Apply Database Migration

```bash
cd backend
node apply-security-migration.js
```

This adds:
- Geolocation fields to auth_logs
- IP blocklist/whitelist tables
- Active sessions tracking
- Security alerts system
- Automatic threat detection triggers

### Step 2: Install Dependencies

```bash
cd backend
npm install axios
```

### Step 3: Restart Backend

```bash
# Stop current backend
# Then restart
npm run dev
```

## Access the Dashboard

Navigate to: **`http://localhost:3001/dashboard/super/admin/security`**

(Only accessible to SUPER_ADMIN role)

## What You'll See

### 📊 Dashboard Overview
- Total logins today
- Failed login attempts
- Suspicious activity count
- Critical security events

### 🔍 Four Main Tabs

1. **Access Control** - All login attempts with IP, location, device info
2. **Threat Detection** - Suspicious activities, VPN/proxy usage, high-risk IPs
3. **Geolocation** - Access patterns by country and city
4. **Active Sessions** - Currently logged-in users with session details

## Key Features Explained

### Real IP Detection
The system now correctly captures real IP addresses by checking:
1. `X-Forwarded-For` header (from load balancers/proxies)
2. `X-Real-IP` header
3. `CF-Connecting-IP` (Cloudflare)
4. `True-Client-IP` (Akamai)
5. Fallback to socket address

### Geolocation
Every login attempt is enriched with:
- Country & Country Code
- Region/State
- City
- Latitude & Longitude
- Timezone
- ISP (Internet Service Provider)

### Threat Scoring
Each access attempt gets a threat score (0-100):
- **0-19**: Clean (green badge)
- **20-39**: Low Risk (yellow badge)
- **40-59**: Medium Risk (orange badge)
- **60-100**: High Risk (red badge)

Factors that increase threat score:
- VPN usage (+30)
- Proxy detected (+30)
- Datacenter IP (+20)
- Cloud provider (+10)

### Automatic Alerts

#### Brute Force Detection
- Triggers after 5 failed logins in 15 minutes
- Creates HIGH severity alert
- Can auto-block IP (configurable)

#### Impossible Travel
- Detects logins from different countries within 60 minutes
- Creates CRITICAL severity alert
- Suggests immediate investigation

## Configuration

### Geolocation Service

**Default**: Uses ip-api.com (free, 45 requests/minute)

**For Production**, upgrade to:

1. **ipinfo.io** (Recommended)
   ```typescript
   // In backend/src/services/geolocation.service.ts
   const response = await axios.get(
     `https://ipinfo.io/${ip}?token=YOUR_TOKEN`
   );
   ```

2. **ipgeolocation.io**
   ```typescript
   const response = await axios.get(
     `https://api.ipgeolocation.io/ipgeo?apiKey=YOUR_KEY&ip=${ip}`
   );
   ```

3. **MaxMind GeoIP2** (Self-hosted, unlimited)
   ```bash
   npm install @maxmind/geoip2-node
   ```

### Threat Detection Thresholds

Edit `backend/src/services/geolocation.service.ts`:

```typescript
// Adjust threat scoring
if (geo.is_proxy || geo.is_vpn) {
  threat_score += 30; // Change this value
}

if (geo.is_datacenter) {
  threat_score += 20; // Change this value
}
```

### Alert Triggers

Edit `database/migrations/013_add_geolocation_security_fields.sql`:

```sql
-- Brute force threshold (currently 5 attempts in 15 minutes)
IF failed_count >= 5 THEN  -- Change 5 to your threshold

-- Impossible travel window (currently 60 minutes)
IF time_diff_minutes < 60 THEN  -- Change 60 to your threshold
```

## Testing

### Test Real IP Detection

1. Login from different devices
2. Check Security Dashboard
3. Verify IP addresses are NOT showing as `::1` or `127.0.0.1`

### Test Geolocation

1. Login from your account
2. Go to Security Dashboard → Access Control tab
3. You should see your city and country

### Test Threat Detection

1. Try 5 failed login attempts
2. Check Security Dashboard → Threat Detection tab
3. Should see a brute force alert

### Test Geographic Anomaly

1. Use VPN to login from different country
2. Login again from original location within 60 minutes
3. Should trigger impossible travel alert

## Troubleshooting

### IPs Still Showing as Localhost

**Problem**: Reverse proxy not forwarding real IPs

**Solution**: Configure your reverse proxy (nginx example):
```nginx
location /api {
    proxy_pass http://localhost:5000;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Host $host;
}
```

### Geolocation Not Working

**Problem**: Rate limit exceeded or API unreachable

**Solutions**:
1. Check server internet connectivity
2. Verify ip-api.com is accessible: `curl http://ip-api.com/json/8.8.8.8`
3. Upgrade to paid service for higher limits
4. Add error handling to gracefully degrade

### Too Many False Positives

**Solutions**:
1. Whitelist your office/branch IPs
2. Increase threat score thresholds
3. Disable VPN detection if your staff uses VPNs
4. Adjust brute force threshold (5 → 10 attempts)

## Next Steps

### Recommended Actions

1. **Whitelist Known IPs**
   - Add your office/branch IPs to whitelist
   - Prevents false alerts for trusted locations

2. **Configure Email Alerts**
   - Set up email notifications for critical alerts
   - Integrate with your email service

3. **Review Security Policies**
   - Define response procedures for each alert type
   - Train staff on security best practices

4. **Regular Monitoring**
   - Check dashboard daily
   - Review weekly security reports
   - Investigate all critical alerts

5. **Upgrade Geolocation Service**
   - Sign up for ipinfo.io or ipgeolocation.io
   - Get higher rate limits and better accuracy

### Advanced Features (Optional)

- **Two-Factor Authentication**: Add 2FA requirement for high-risk logins
- **Session Timeout**: Auto-logout after inactivity
- **IP-based Access Control**: Restrict admin access to specific IPs
- **Webhook Integration**: Send alerts to Slack/Teams
- **SIEM Integration**: Export logs to security monitoring tools

## Documentation

Full documentation: `docs/SECURITY_CENTER_GUIDE.md`

## Support

For issues:
1. Check logs: `backend/logs/error.log`
2. Review this guide
3. Check the full documentation
4. Contact system administrator

---

## Summary

You now have enterprise-grade security monitoring! 🎉

The system automatically:
- Tracks real IP addresses and locations
- Detects threats (VPN, proxy, brute force)
- Alerts on suspicious activities
- Monitors active sessions

Access the dashboard at: `/dashboard/super/admin/security`

**Important**: Apply the database migration first, then restart the backend!
