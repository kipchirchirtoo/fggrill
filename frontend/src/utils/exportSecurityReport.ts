/**
 * Security Report Export Utility
 * Generates comprehensive security reports in multiple formats
 */

interface SecurityLog {
  id: string;
  created_at: string;
  email: string;
  status: string;
  ip_address: string;
  user_agent: string;
  device_info: any;
  geo_country?: string;
  geo_city?: string;
  geo_latitude?: number;
  geo_longitude?: number;
  is_proxy?: boolean;
  is_vpn?: boolean;
  threat_score?: number;
  is_suspicious?: boolean;
  threat_reason?: string;
  user?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface SecurityStats {
  loginsToday: number;
  failedLoginsToday: number;
  securityAlertsToday: number;
  criticalEvents24h: number;
}

/**
 * Export security report as CSV
 */
export const exportToCSV = (logs: SecurityLog[], stats: SecurityStats | null) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `security-report-${timestamp}.csv`;

  // CSV Headers
  const headers = [
    'Timestamp',
    'User Email',
    'User Name',
    'Status',
    'IP Address',
    'Location',
    'Country',
    'Coordinates',
    'Device',
    'Browser',
    'OS',
    'Threat Score',
    'Threat Level',
    'VPN Detected',
    'Proxy Detected',
    'Suspicious',
    'Threat Reason'
  ];

  // Convert logs to CSV rows
  const rows = logs.map(log => {
    const userName = log.user 
      ? `${log.user.first_name} ${log.user.last_name}`
      : 'Unknown';
    
    const location = log.geo_city && log.geo_country
      ? `${log.geo_city}, ${log.geo_country}`
      : 'Unknown';
    
    const coordinates = log.geo_latitude && log.geo_longitude
      ? `${log.geo_latitude}, ${log.geo_longitude}`
      : 'N/A';
    
    const device = log.device_info?.device_type || 'Unknown';
    const browser = log.device_info?.browser || 'Unknown';
    const os = log.device_info?.os || 'Unknown';
    
    const threatScore = log.threat_score || 0;
    const threatLevel = 
      threatScore >= 60 ? 'Critical' :
      threatScore >= 40 ? 'High' :
      threatScore >= 20 ? 'Medium' : 'Low';

    return [
      new Date(log.created_at).toLocaleString(),
      log.email,
      userName,
      log.status,
      log.ip_address,
      location,
      log.geo_country || 'Unknown',
      coordinates,
      device,
      browser,
      os,
      threatScore,
      threatLevel,
      log.is_vpn ? 'Yes' : 'No',
      log.is_proxy ? 'Yes' : 'No',
      log.is_suspicious ? 'Yes' : 'No',
      log.threat_reason || 'None'
    ];
  });

  // Add summary section at the top
  const summaryRows = stats ? [
    ['SECURITY REPORT SUMMARY'],
    ['Generated', new Date().toLocaleString()],
    [''],
    ['Total Logins (24h)', stats.loginsToday],
    ['Failed Logins (24h)', stats.failedLoginsToday],
    ['Security Alerts (24h)', stats.securityAlertsToday],
    ['Critical Events (24h)', stats.criticalEvents24h],
    [''],
    ['DETAILED LOGS'],
    headers
  ] : [
    ['SECURITY REPORT'],
    ['Generated', new Date().toLocaleString()],
    [''],
    headers
  ];

  // Combine summary and data
  const allRows = [...summaryRows, ...rows];

  // Convert to CSV string
  const csvContent = allRows
    .map(row => row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma
      const cellStr = String(cell);
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(','))
    .join('\n');

  // Download file
  downloadFile(csvContent, filename, 'text/csv');
};

/**
 * Export security report as JSON
 */
export const exportToJSON = (logs: SecurityLog[], stats: SecurityStats | null) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `security-report-${timestamp}.json`;

  const report = {
    metadata: {
      generated: new Date().toISOString(),
      reportType: 'Security Analysis Report',
      totalRecords: logs.length,
      dateRange: {
        from: logs.length > 0 ? logs[logs.length - 1].created_at : null,
        to: logs.length > 0 ? logs[0].created_at : null
      }
    },
    summary: stats ? {
      loginsToday: stats.loginsToday,
      failedLoginsToday: stats.failedLoginsToday,
      securityAlertsToday: stats.securityAlertsToday,
      criticalEvents24h: stats.criticalEvents24h,
      failureRate: stats.loginsToday > 0 
        ? ((stats.failedLoginsToday / stats.loginsToday) * 100).toFixed(2) + '%'
        : '0%'
    } : null,
    threatAnalysis: {
      total: logs.length,
      suspicious: logs.filter(l => l.is_suspicious).length,
      vpnDetected: logs.filter(l => l.is_vpn).length,
      proxyDetected: logs.filter(l => l.is_proxy).length,
      highThreat: logs.filter(l => (l.threat_score || 0) >= 60).length,
      mediumThreat: logs.filter(l => {
        const score = l.threat_score || 0;
        return score >= 40 && score < 60;
      }).length,
      lowThreat: logs.filter(l => {
        const score = l.threat_score || 0;
        return score >= 20 && score < 40;
      }).length
    },
    geographicDistribution: calculateGeographicDistribution(logs),
    logs: logs.map(log => ({
      timestamp: log.created_at,
      user: {
        email: log.email,
        name: log.user ? `${log.user.first_name} ${log.user.last_name}` : 'Unknown'
      },
      authentication: {
        status: log.status,
        ipAddress: log.ip_address
      },
      location: {
        city: log.geo_city,
        country: log.geo_country,
        coordinates: {
          latitude: log.geo_latitude,
          longitude: log.geo_longitude
        }
      },
      device: {
        type: log.device_info?.device_type,
        browser: log.device_info?.browser,
        os: log.device_info?.os,
        userAgent: log.user_agent
      },
      security: {
        threatScore: log.threat_score || 0,
        threatLevel: getThreatLevel(log.threat_score || 0),
        isVPN: log.is_vpn || false,
        isProxy: log.is_proxy || false,
        isSuspicious: log.is_suspicious || false,
        threatReason: log.threat_reason
      }
    }))
  };

  const jsonContent = JSON.stringify(report, null, 2);
  downloadFile(jsonContent, filename, 'application/json');
};

/**
 * Export security report as PDF (HTML-based)
 */
export const exportToPDF = (logs: SecurityLog[], stats: SecurityStats | null) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `security-report-${timestamp}.html`;

  // Calculate statistics
  const threatStats = {
    total: logs.length,
    suspicious: logs.filter(l => l.is_suspicious).length,
    vpn: logs.filter(l => l.is_vpn).length,
    proxy: logs.filter(l => l.is_proxy).length,
    highThreat: logs.filter(l => (l.threat_score || 0) >= 60).length
  };

  const geoDistribution = calculateGeographicDistribution(logs);

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Security Report - ${new Date().toLocaleDateString()}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 40px;
      color: #333;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #1e40af;
      margin: 0;
      font-size: 32px;
    }
    .header .subtitle {
      color: #6b7280;
      margin-top: 10px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }
    .summary-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .summary-card.danger {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
    .summary-card.warning {
      background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    }
    .summary-card.success {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }
    .summary-card h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      opacity: 0.9;
    }
    .summary-card .value {
      font-size: 36px;
      font-weight: bold;
      margin: 0;
    }
    .section {
      margin-bottom: 40px;
    }
    .section h2 {
      color: #1e40af;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    th {
      background: #1e40af;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:hover {
      background: #f9fafb;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge.success { background: #d1fae5; color: #065f46; }
    .badge.danger { background: #fee2e2; color: #991b1b; }
    .badge.warning { background: #fef3c7; color: #92400e; }
    .badge.info { background: #dbeafe; color: #1e40af; }
    .threat-critical { color: #dc2626; font-weight: bold; }
    .threat-high { color: #ea580c; font-weight: bold; }
    .threat-medium { color: #ca8a04; }
    .threat-low { color: #16a34a; }
    .footer {
      margin-top: 50px;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
      border-top: 1px solid #e5e7eb;
      padding-top: 20px;
    }
    @media print {
      body { margin: 20px; }
      .summary { page-break-inside: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔒 Security Analysis Report</h1>
    <div class="subtitle">
      Generated: ${new Date().toLocaleString()}<br>
      Report Period: Last 24 Hours
    </div>
  </div>

  ${stats ? `
  <div class="summary">
    <div class="summary-card success">
      <h3>Total Logins</h3>
      <p class="value">${stats.loginsToday}</p>
    </div>
    <div class="summary-card danger">
      <h3>Failed Logins</h3>
      <p class="value">${stats.failedLoginsToday}</p>
    </div>
    <div class="summary-card warning">
      <h3>Security Alerts</h3>
      <p class="value">${stats.securityAlertsToday}</p>
    </div>
    <div class="summary-card">
      <h3>Critical Events</h3>
      <p class="value">${stats.criticalEvents24h}</p>
    </div>
  </div>
  ` : ''}

  <div class="section">
    <h2>📊 Threat Analysis</h2>
    <table>
      <tr>
        <th>Metric</th>
        <th>Count</th>
        <th>Percentage</th>
      </tr>
      <tr>
        <td>Total Attempts</td>
        <td>${threatStats.total}</td>
        <td>100%</td>
      </tr>
      <tr>
        <td>Suspicious Activity</td>
        <td>${threatStats.suspicious}</td>
        <td>${((threatStats.suspicious / threatStats.total) * 100).toFixed(1)}%</td>
      </tr>
      <tr>
        <td>VPN Detected</td>
        <td>${threatStats.vpn}</td>
        <td>${((threatStats.vpn / threatStats.total) * 100).toFixed(1)}%</td>
      </tr>
      <tr>
        <td>Proxy Detected</td>
        <td>${threatStats.proxy}</td>
        <td>${((threatStats.proxy / threatStats.total) * 100).toFixed(1)}%</td>
      </tr>
      <tr>
        <td>High Threat (Score ≥60)</td>
        <td>${threatStats.highThreat}</td>
        <td>${((threatStats.highThreat / threatStats.total) * 100).toFixed(1)}%</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <h2>🌍 Geographic Distribution</h2>
    <table>
      <tr>
        <th>Country</th>
        <th>Access Count</th>
        <th>Suspicious</th>
      </tr>
      ${geoDistribution.slice(0, 10).map(item => `
        <tr>
          <td>${item.country}</td>
          <td>${item.count}</td>
          <td>${item.suspicious > 0 ? `<span class="badge danger">${item.suspicious}</span>` : '-'}</td>
        </tr>
      `).join('')}
    </table>
  </div>

  <div class="section">
    <h2>📝 Detailed Access Logs</h2>
    <table>
      <tr>
        <th>Timestamp</th>
        <th>User</th>
        <th>IP Address</th>
        <th>Location</th>
        <th>Status</th>
        <th>Threat</th>
      </tr>
      ${logs.slice(0, 100).map(log => {
        const threatScore = log.threat_score || 0;
        const threatClass = 
          threatScore >= 60 ? 'threat-critical' :
          threatScore >= 40 ? 'threat-high' :
          threatScore >= 20 ? 'threat-medium' : 'threat-low';
        
        return `
        <tr>
          <td>${new Date(log.created_at).toLocaleString()}</td>
          <td>${log.email}</td>
          <td>${log.ip_address}${log.is_vpn ? ' <span class="badge warning">VPN</span>' : ''}</td>
          <td>${log.geo_city || 'Unknown'}, ${log.geo_country || 'Unknown'}</td>
          <td><span class="badge ${log.status === 'success' ? 'success' : 'danger'}">${log.status}</span></td>
          <td class="${threatClass}">${threatScore}</td>
        </tr>
        `;
      }).join('')}
    </table>
    ${logs.length > 100 ? `<p style="text-align: center; color: #6b7280; margin-top: 20px;">Showing first 100 of ${logs.length} logs. Export to CSV/JSON for complete data.</p>` : ''}
  </div>

  <div class="footer">
    <p>
      <strong>Famous Gate Hotel Management System</strong><br>
      Security Center Report | Confidential<br>
      This report contains sensitive security information. Handle with care.
    </p>
  </div>

  <script>
    // Auto-print dialog on load (optional)
    // window.onload = () => window.print();
  </script>
</body>
</html>
  `;

  downloadFile(htmlContent, filename, 'text/html');
  
  // Open in new window for printing
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
};

/**
 * Helper: Calculate geographic distribution
 */
function calculateGeographicDistribution(logs: SecurityLog[]) {
  const distribution: Record<string, { count: number; suspicious: number }> = {};
  
  logs.forEach(log => {
    const country = log.geo_country || 'Unknown';
    if (!distribution[country]) {
      distribution[country] = { count: 0, suspicious: 0 };
    }
    distribution[country].count++;
    if (log.is_suspicious) {
      distribution[country].suspicious++;
    }
  });

  return Object.entries(distribution)
    .map(([country, data]) => ({ country, ...data }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Helper: Get threat level label
 */
function getThreatLevel(score: number): string {
  if (score >= 60) return 'Critical';
  if (score >= 40) return 'High';
  if (score >= 20) return 'Medium';
  return 'Low';
}

/**
 * Helper: Download file
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
