/**
 * Security Report Export Utility
 * Generates comprehensive security reports in multiple formats
 */

import { PYTHON_SERVICE_URL } from '@/lib/config';

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
 * Export security report as Branded CSV with FamousGate Headers
 */
export const exportToCSV = (logs: SecurityLog[], stats: SecurityStats | null) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `FG_Security_Report_${timestamp}.csv`;
  const now = new Date();

  // Calculate threat statistics
  const threatStats = {
    total: logs.length,
    suspicious: logs.filter(l => l.is_suspicious).length,
    vpn: logs.filter(l => l.is_vpn).length,
    proxy: logs.filter(l => l.is_proxy).length,
    highThreat: logs.filter(l => (l.threat_score || 0) >= 60).length,
    mediumThreat: logs.filter(l => {
      const score = l.threat_score || 0;
      return score >= 40 && score < 60;
    }).length,
    lowThreat: logs.filter(l => {
      const score = l.threat_score || 0;
      return score >= 20 && score < 40;
    }).length,
    clean: logs.filter(l => (l.threat_score || 0) < 20).length
  };

  // Geographic distribution
  const geoDistribution: Record<string, number> = {};
  logs.forEach(log => {
    const country = log.geo_country || 'Unknown';
    geoDistribution[country] = (geoDistribution[country] || 0) + 1;
  });
  const topCountries = Object.entries(geoDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Branded Header Section
  const brandedHeader = [
    ['═══════════════════════════════════════════════════════════════════════════════════════════════'],
    ['FAMOUSGATE HOTELS - SECURITY ANALYSIS REPORT'],
    ['Security Operations Center'],
    ['═══════════════════════════════════════════════════════════════════════════════════════════════'],
    [''],
    ['REPORT INFORMATION'],
    ['Report Type', 'Security Access & Threat Analysis'],
    ['Generated Date', now.toLocaleDateString('en-KE', { dateStyle: 'full' })],
    ['Generated Time', now.toLocaleTimeString('en-KE', { timeStyle: 'medium' })],
    ['Report Period', 'Last 24 Hours'],
    ['Classification', 'CONFIDENTIAL'],
    ['Total Records', logs.length],
    [''],
    ['COMPANY INFORMATION'],
    ['Organization', 'FamousGate Hotels'],
    ['Location', 'Bomet, Kenya'],
    ['Contact', '+254 706 782 828'],
    ['Email', 'security@famousgatehotels.com'],
    [''],
    ['═══════════════════════════════════════════════════════════════════════════════════════════════'],
    ['EXECUTIVE SUMMARY'],
    ['═══════════════════════════════════════════════════════════════════════════════════════════════'],
    ['']
  ];

  // Summary Statistics Section
  const summarySection = stats ? [
    ['AUTHENTICATION METRICS'],
    ['Total Login Attempts', stats.loginsToday],
    ['Successful Logins', stats.loginsToday - stats.failedLoginsToday],
    ['Failed Login Attempts', stats.failedLoginsToday],
    ['Failure Rate', `${((stats.failedLoginsToday / (stats.loginsToday || 1)) * 100).toFixed(2)}%`],
    [''],
    ['SECURITY ALERTS'],
    ['Security Alerts (24h)', stats.securityAlertsToday],
    ['Critical Events (24h)', stats.criticalEvents24h],
    ['']
  ] : [['No summary statistics available'], ['']];

  // Threat Analysis Section
  const threatSection = [
    ['THREAT ANALYSIS'],
    ['Total Access Attempts', threatStats.total],
    ['Suspicious Activity', `${threatStats.suspicious} (${((threatStats.suspicious / Math.max(threatStats.total, 1)) * 100).toFixed(1)}%)`],
    ['VPN Connections Detected', `${threatStats.vpn} (${((threatStats.vpn / Math.max(threatStats.total, 1)) * 100).toFixed(1)}%)`],
    ['Proxy Connections Detected', `${threatStats.proxy} (${((threatStats.proxy / Math.max(threatStats.total, 1)) * 100).toFixed(1)}%)`],
    [''],
    ['THREAT LEVEL DISTRIBUTION'],
    ['High Threat (Score ≥60)', threatStats.highThreat],
    ['Medium Threat (Score 40-59)', threatStats.mediumThreat],
    ['Low Threat (Score 20-39)', threatStats.lowThreat],
    ['Clean (Score <20)', threatStats.clean],
    ['']
  ];

  // Geographic Distribution Section
  const geoSection = [
    ['GEOGRAPHIC DISTRIBUTION'],
    ['Top 5 Countries by Access Count'],
    ['Country', 'Access Count'],
    ...topCountries.map(([country, count]) => [country, count]),
    ['']
  ];

  // Data Table Headers
  const dataHeaders = [
    ['═══════════════════════════════════════════════════════════════════════════════════════════════'],
    ['DETAILED ACCESS LOGS'],
    ['═══════════════════════════════════════════════════════════════════════════════════════════════'],
    [''],
    [
      'Timestamp',
      'User Email',
      'User Name',
      'Status',
      'IP Address',
      'City',
      'Country',
      'Coordinates',
      'Device Type',
      'Browser',
      'Operating System',
      'Threat Score',
      'Threat Level',
      'VPN',
      'Proxy',
      'Suspicious',
      'Threat Reason'
    ]
  ];

  // Convert logs to CSV rows
  const dataRows = logs.map(log => {
    const userName = log.user 
      ? `${log.user.first_name} ${log.user.last_name}`
      : 'Unknown';
    
    const city = log.geo_city || 'Unknown';
    const country = log.geo_country || 'Unknown';
    
    const coordinates = log.geo_latitude && log.geo_longitude
      ? `${log.geo_latitude}, ${log.geo_longitude}`
      : 'N/A';
    
    const device = log.device_info?.device_type || 'Unknown';
    const browser = log.device_info?.browser || 'Unknown';
    const os = log.device_info?.os || 'Unknown';
    
    const threatScore = log.threat_score || 0;
    const threatLevel = 
      threatScore >= 60 ? 'CRITICAL' :
      threatScore >= 40 ? 'HIGH' :
      threatScore >= 20 ? 'MEDIUM' : 
      threatScore > 0 ? 'LOW' : 'CLEAN';

    return [
      new Date(log.created_at).toLocaleString('en-KE'),
      log.email,
      userName,
      log.status.toUpperCase(),
      log.ip_address,
      city,
      country,
      coordinates,
      device,
      browser,
      os,
      threatScore,
      threatLevel,
      log.is_vpn ? 'YES' : 'NO',
      log.is_proxy ? 'YES' : 'NO',
      log.is_suspicious ? 'YES' : 'NO',
      log.threat_reason || 'None'
    ];
  });

  // Footer Section
  const footerSection = [
    [''],
    ['═══════════════════════════════════════════════════════════════════════════════════════════════'],
    ['END OF REPORT'],
    ['═══════════════════════════════════════════════════════════════════════════════════════════════'],
    [''],
    ['CONFIDENTIALITY NOTICE'],
    ['This report contains confidential security information and is intended solely for authorized personnel.'],
    ['Unauthorized access, disclosure, or distribution is strictly prohibited.'],
    [''],
    ['For security concerns or inquiries, contact: security@famousgatehotels.com'],
    [''],
    ['© ' + now.getFullYear() + ' FamousGate Hotels. All rights reserved.']
  ];

  // Combine all sections
  const allRows = [
    ...brandedHeader,
    ...summarySection,
    ...threatSection,
    ...geoSection,
    ...dataHeaders,
    ...dataRows,
    ...footerSection
  ];

  // Convert to CSV string with proper escaping
  const csvContent = allRows
    .map(row => row.map(cell => {
      const cellStr = String(cell);
      // Escape quotes and wrap in quotes if contains comma, quotes, or newlines
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(','))
    .join('\n');

  // Add UTF-8 BOM for proper Excel compatibility
  const BOM = '\uFEFF';
  const csvWithBOM = BOM + csvContent;

  // Download file
  downloadFile(csvWithBOM, filename, 'text/csv');
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
 * Export security report as Branded PDF (using Python service)
 */
export const exportToPDF = async (logs: SecurityLog[], stats: SecurityStats | null) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `FG_Security_Report_${timestamp}.pdf`;

  try {
    console.log('Generating PDF report with Python service URL:', PYTHON_SERVICE_URL);
    
    // Prepare data for Python service
    const reportData = {
      date_range: 'Last 24 Hours',
      summary: stats ? {
        total_logins: stats.loginsToday,
        failed_logins: stats.failedLoginsToday,
        suspicious_count: logs.filter(l => l.is_suspicious).length,
        critical_events: stats.criticalEvents24h,
        failure_rate: stats.loginsToday > 0 
          ? (stats.failedLoginsToday / stats.loginsToday) * 100 
          : 0,
        avg_threat_score: calculateAvgThreatScore(logs)
      } : {},
      threat_analysis: {
        total: logs.length,
        suspicious: logs.filter(l => l.is_suspicious).length,
        vpn_detected: logs.filter(l => l.is_vpn).length,
        proxy_detected: logs.filter(l => l.is_proxy).length,
        high_threat: logs.filter(l => (l.threat_score || 0) >= 60).length
      },
      geographic_distribution: calculateGeographicDistribution(logs),
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

    // Call Python service - URL is already normalized in config
    const url = `${PYTHON_SERVICE_URL}/api/reports/generate/security-report`;
    console.log('Calling PDF generation endpoint:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reportData)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('PDF generation failed:', response.status, errorText);
      throw new Error(`Failed to generate PDF report: ${response.status} ${response.statusText}`);
    }

    // Download the PDF
    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
    
    console.log('PDF report generated successfully:', filename);
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  }
};

/**
 * Helper: Calculate average threat score
 */
function calculateAvgThreatScore(logs: SecurityLog[]): number {
  const scores = logs.map(l => l.threat_score || 0).filter(s => s > 0);
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

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
