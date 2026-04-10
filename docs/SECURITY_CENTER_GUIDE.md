# Security Center - Comprehensive Guide

## Overview

The Security Center is a comprehensive security management dashboard that provides real-time monitoring, threat detection, and access control for the entire Famous Gates Hotels system.

## Features

### 1. **Real IP Address Tracking**
- Captures actual client IP addresses (not localhost)
- Handles proxies, load balancers, and CDNs correctly
- Supports IPv4 and IPv6
- Normalizes IP addresses for consistent storage

### 2. **Geolocation Tracking**
- **Country & City Detection**: Identifies the geographic location of each access attempt
- **Coordinates**: Stores latitude/longitude for mapping
- **ISP Information**: Tracks Internet Service Provider details
- **Timezone**: Records the user's timezone

### 3. **Threat Detection**
- **VPN Detection**: Identifies connections through VPN services
- **Proxy Detection**: Flags proxy server usage
- **Datacenter Detection**: Identifies connections from cloud/datacenter IPs
- **Threat Scoring**: Assigns risk scores (0-100) to each access attempt
- **Suspicious Activity Flagging**: Automatically marks high-risk activities

### 4. **Device Fingerprinting**
- **Browser Detection**: Chrome, Firefox, Safari, Edge, Opera
- **Operating System**: Windows, macOS, Linux, Android, iOS
- **Device Type**: Desktop, Mobile, Tablet
- **Bot Detection**: Identifies automated access attempts

### 5. **Security Alerts**
- **Brute Force Detection**: Automatically detects 5+ failed login attempts within 15 minutes
- **Geographic Anomalies**: Flags impossible travel (logins from different countries within 60 minutes)
- **Multiple Failure Alerts**: Tracks repeated failed access attempts
- **Real-time Notifications**: Instant alerts for critical security events

### 6. **IP Management**
- **Blocklist**: Block malicious IP addresses
- **Whitelist**: Whitelist trusted IP addresses
- **Automatic Blocking**: Option to auto-block IPs after threshold violations
- **Expiring Blocks**: Set temporary blocks with automatic expiration

### 7. **Active Session Management**
- **Session Tracking**: Monitor all active user sessions
- **Session Details**: IP, location, device, last activity
- **Session Termination**: Remotely terminate suspicious sessions
- **Bulk Actions**: Terminate all sessions for security incidents

### 8. **Analytics & Reporting**
- **Login Statistics**: Track successful and failed logins
- **Geographic Distribution**: Visualize access patterns by country
- **Threat Trends**: Monitor security threats over time
- **Export Reports**: Download security reports in various formats

## Dashboard Tabs

### Access Control Tab
Displays all access attempts with:
- Timestamp
- User information
- IP address (with VPN/Proxy indicators)
- Geographic location
- Device information
- Login status (success/failed)
- Threat level badge

### Threat Detection Tab
Shows:
- Threat overview statistics
- High-risk access attempts
- VPN/Proxy usage
- Suspicious activity list with detailed reasons
- Quick actions to block IPs

### Geolocation Tab
Provides:
- Access attempts grouped by country
- City-level breakdown
- Suspicious activity by location
- Interactive map visualization (when integrated)

### Active Sessions Tab
Displays:
- Currently active user sessions
- Session details (IP, location, device)
- Last activity timestamp
- Actions to terminate individual or all sessions

## API Endpoints

### Get Security Overview
```
GET /api/admin-logs/overview
```
Returns statistics for the dashboard.

### Get Security Logs
```
GET /api/admin-logs?category=security&page=1&limit=50
```
Fetches paginated security logs with filtering options.

### Block IP Address
```
POST /api/security/block-ip
Body: { ip_address, reason, expires_at }
```

### Whitelist IP Address
```
POST /api/security/whitelist-ip
Body: { ip_address, description }
```

### Terminate Session
```
DELETE /api/security/sessions/:sessionId
```

## Database Schema

### auth_logs (Enhanced)
```sql
- geo_country VARCHAR(100)
- geo_country_code VARCHAR(10)
- geo_region VARCHAR(100)
- geo_city VARCHAR(100)
- geo_latitude DECIMAL(10, 7)
- geo_longitude DECIMAL(10, 7)
- geo_timezone VARCHAR(50)
- geo_isp VARCHAR(255)
- is_proxy BOOLEAN
- is_vpn BOOLEAN
- is_datacenter BOOLEAN
- threat_score INTEGER
- is_suspicious BOOLEAN
- threat_reason TEXT
```

### ip_blocklist
```sql
- id UUID PRIMARY KEY
- ip_address VARCHAR(45) UNIQUE
- reason TEXT
- blocked_by UUID
- blocked_at TIMESTAMP
- expires_at TIMESTAMP
- is_active BOOLEAN
```

### ip_whitelist
```sql
- id UUID PRIMARY KEY
- ip_address VARCHAR(45) UNIQUE
- description TEXT
- added_by UUID
- added_at TIMESTAMP
- is_active BOOLEAN
```

### active_sessions
```sql
- id UUID PRIMARY KEY
- user_id UUID
- session_token VARCHAR(255)
- ip_address VARCHAR(45)
- user_agent TEXT
- device_info JSONB
- geo_country VARCHAR(100)
- geo_city VARCHAR(100)
- last_activity TIMESTAMP
- expires_at TIMESTAMP
- is_active BOOLEAN
```

### security_alerts
```sql
- id UUID PRIMARY KEY
- alert_type VARCHAR(50)
- severity VARCHAR(20)
- user_id UUID
- ip_address VARCHAR(45)
- description TEXT
- metadata JSONB
- status VARCHAR(20)
- resolved_by UUID
- resolved_at TIMESTAMP
```

## Automatic Security Features

### 1. Brute Force Protection
- Monitors failed login attempts
- Triggers alert after 5 failures in 15 minutes
- Can auto-block IP after threshold
- Sends notifications to administrators

### 2. Impossible Travel Detection
- Compares login locations
- Flags logins from different countries within 60 minutes
- Creates critical security alert
- Suggests session termination

### 3. Session Cleanup
- Automatically marks expired sessions as inactive
- Runs periodically to maintain database health

## Setup Instructions

### 1. Apply Database Migration
```bash
cd backend
node apply-security-migration.js
```

### 2. Install Dependencies
```bash
npm install axios
```

### 3. Configure Environment
No additional configuration needed. The system uses ip-api.com (free tier) for geolocation.

For production, consider upgrading to:
- **ipinfo.io** (50,000 requests/month free)
- **ipgeolocation.io** (30,000 requests/month free)
- **MaxMind GeoIP2** (Self-hosted, unlimited)

### 4. Access the Dashboard
Navigate to: `/dashboard/super/admin/security`

## Best Practices

### 1. Regular Monitoring
- Check the dashboard daily
- Review security alerts promptly
- Investigate suspicious activities

### 2. IP Management
- Whitelist known office/branch IPs
- Block confirmed malicious IPs
- Review blocklist monthly

### 3. Alert Response
- Investigate all critical alerts within 1 hour
- Document false positives
- Update detection rules based on patterns

### 4. Session Management
- Terminate inactive sessions regularly
- Force re-authentication for sensitive operations
- Monitor for session hijacking attempts

### 5. Reporting
- Export weekly security reports
- Share with management
- Track security metrics over time

## Threat Levels

### Low (0-19)
- Normal access patterns
- Trusted locations
- Known devices
- No suspicious indicators

### Medium (20-39)
- Cloud/datacenter IPs
- First-time locations
- Unusual access times
- Minor anomalies

### High (40-59)
- VPN/Proxy usage
- Multiple failed attempts
- Suspicious patterns
- Geographic anomalies

### Critical (60-100)
- Confirmed brute force attacks
- Impossible travel detected
- Known malicious IPs
- Multiple security violations

## Integration with Other Systems

### Email Notifications
Integrate with email service to send alerts:
```javascript
await sendSecurityAlert({
  type: 'brute_force',
  severity: 'high',
  details: alertData
});
```

### Slack/Teams Integration
Send real-time alerts to team channels:
```javascript
await postToSlack({
  channel: '#security-alerts',
  message: alertMessage
});
```

### SIEM Integration
Export logs to Security Information and Event Management systems:
- Splunk
- ELK Stack
- Azure Sentinel
- AWS Security Hub

## Troubleshooting

### Issue: IPs showing as localhost (::1 or 127.0.0.1)
**Solution**: Ensure your reverse proxy (nginx, Apache) is configured to forward real IPs:
```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
```

### Issue: Geolocation not working
**Solution**: 
1. Check internet connectivity from server
2. Verify ip-api.com is accessible
3. Check rate limits (45 requests/minute)
4. Consider upgrading to paid service

### Issue: Too many false positives
**Solution**:
1. Whitelist office/branch IPs
2. Adjust threat score thresholds
3. Review and tune detection rules
4. Document legitimate VPN usage

### Issue: Missing device information
**Solution**:
1. Ensure User-Agent header is being sent
2. Update device fingerprinting logic
3. Consider using dedicated library (ua-parser-js)

## Future Enhancements

### Planned Features
- [ ] Two-Factor Authentication (2FA) management
- [ ] Biometric authentication tracking
- [ ] Advanced threat intelligence integration
- [ ] Machine learning-based anomaly detection
- [ ] Real-time map visualization
- [ ] Mobile app for security monitoring
- [ ] Automated incident response workflows
- [ ] Integration with external threat databases
- [ ] Compliance reporting (GDPR, SOC 2, ISO 27001)
- [ ] Security score dashboard

### API Integrations (Recommended)
- **AbuseIPDB**: Check IP reputation
- **VirusTotal**: Scan for malicious IPs
- **Shodan**: Identify exposed services
- **Have I Been Pwned**: Check for compromised credentials
- **MaxMind**: Enhanced geolocation accuracy

## Compliance & Privacy

### Data Retention
- Security logs: 90 days (configurable)
- Blocked IPs: Until manually removed
- Active sessions: Until expiration
- Security alerts: 1 year

### Privacy Considerations
- IP addresses are considered personal data under GDPR
- Implement data minimization
- Provide user access to their security logs
- Allow users to request data deletion
- Document legitimate interest for security monitoring

### Audit Trail
All security actions are logged:
- IP blocks/unblocks
- Session terminations
- Alert resolutions
- Configuration changes

## Support

For issues or questions:
- Check this documentation
- Review system logs
- Contact system administrator
- Escalate to security team for critical issues

## License

This security system is part of the Famous Gates Hotels Management System.
Proprietary and confidential.
