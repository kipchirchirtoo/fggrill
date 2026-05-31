import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/api_error_message.dart';
import '../../../../core/utils/readable_record.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../domain/superadmin_providers.dart';
import '../../../../core/services/services.dart';

// Valid phosphor icons
final _warningOctagonIcon = PhosphorIcons.warning();
final _lockKeyIcon = PhosphorIcons.lock();
final _codeIcon = PhosphorIcons.treeStructure();
final _mapPinIcon = PhosphorIcons.buildings();
final _xCircleIcon = PhosphorIcons.x();
final _prohibitIcon = PhosphorIcons.prohibit();
final _downloadIcon = PhosphorIcons.fileText();
const _caretDownIcon = Icons.expand_more;

class SecurityCenterSection extends ConsumerStatefulWidget {
  const SecurityCenterSection({super.key});

  @override
  ConsumerState<SecurityCenterSection> createState() =>
      _SecurityCenterSectionState();
}

class _SecurityCenterSectionState extends ConsumerState<SecurityCenterSection> {
  String _selectedTab = 'analytics';
  String _searchTerm = '';
  String _filterStatus = 'all';
  String _filterThreat = 'all';

  @override
  Widget build(BuildContext context) {
    final logsAsync = ref.watch(securityLogsProvider);
    final statsAsync = ref.watch(securityStatsProvider);
    final threatsAsync = ref.watch(securityThreatsProvider);
    final blockedIPsAsync = ref.watch(blockedIPsProvider);
    final sessionsAsync = ref.watch(activeSessionsProvider);
    final rlsAsync = ref.watch(rlsPoliciesProvider);
    final configAsync = ref.watch(securityConfigProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          _buildHeader(),
          const SizedBox(height: 24),

          // Stats Cards
          statsAsync.when(
            data: (stats) => _buildStatsCards(stats),
            loading: () => const LoadingSkeleton(height: 100, count: 4),
            error: (e, _) => ErrorState(message: e.toString()),
          ),
          const SizedBox(height: 24),

          // Tabs
          _buildTabs(),
          const SizedBox(height: 24),

          // Filters
          _buildFilters(),
          const SizedBox(height: 24),

          // Content based on selected tab
          _buildTabContent(logsAsync, threatsAsync, blockedIPsAsync,
              sessionsAsync, rlsAsync, configAsync),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Security Center',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Comprehensive security monitoring and threat detection',
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey.shade500,
              ),
            ),
          ],
        ),
        Row(
          children: [
            IconButton(
              onPressed: () => _refreshData(),
              icon: Icon(PhosphorIcons.arrowsClockwise(), size: 20),
              tooltip: 'Refresh',
            ),
            const SizedBox(width: 8),
            _buildExportButton(),
          ],
        ),
      ],
    );
  }

  Widget _buildStatsCards(Map<String, dynamic> stats) {
    final cards = [
      {
        'label': 'Logins Today',
        'value': stats['loginsToday']?.toString() ?? '0',
        'icon': PhosphorIcons.users(),
        'color': AppColors.kPrimary,
      },
      {
        'label': 'Failed Logins',
        'value': stats['failedLoginsToday']?.toString() ?? '0',
        'icon': PhosphorIcons.warning(),
        'color': const Color(0xFFf59e0b),
        'alert': true,
      },
      {
        'label': 'Suspicious Activity',
        'value': stats['suspicious']?.toString() ?? '0',
        'icon': PhosphorIcons.shieldWarning(),
        'color': const Color(0xFFef4444),
      },
      {
        'label': 'Critical Events',
        'value': stats['criticalEvents24h']?.toString() ?? '0',
        'icon': _warningOctagonIcon,
        'color': const Color(0xFFdc2626),
      },
    ];

    return Row(
      children: cards.map((card) {
        return Expanded(
          child: Container(
            margin: const EdgeInsets.only(right: 16),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade200),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      card['value'] as String,
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: card['color'] as Color,
                      ),
                    ),
                    Icon(
                      card['icon'] as IconData,
                      color: card['color'] as Color,
                      size: 24,
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  card['label'] as String,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: Colors.grey.shade500,
                  ),
                ),
                if (card['alert'] == true && (card['value'] as String) != '0')
                  Container(
                    margin: const EdgeInsets.only(top: 8),
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFfef3c7),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '${(int.parse(card['value'] as String) / (int.parse(stats['loginsToday']?.toString() ?? '1') + int.parse(card['value'] as String)) * 100).toStringAsFixed(1)}% failure rate',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFFd97706),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildTabs() {
    final tabs = [
      {
        'id': 'analytics',
        'label': 'Analytics',
        'icon': PhosphorIcons.chartLine()
      },
      {'id': 'access', 'label': 'Access Control', 'icon': _lockKeyIcon},
      {
        'id': 'threats',
        'label': 'Threat Detection',
        'icon': PhosphorIcons.warning()
      },
      {'id': 'geo', 'label': 'Geolocation', 'icon': _mapPinIcon},
      {
        'id': 'sessions',
        'label': 'Active Sessions',
        'icon': PhosphorIcons.activity()
      },
      {'id': 'rls', 'label': 'RLS Policies', 'icon': PhosphorIcons.database()},
      {'id': 'api', 'label': 'API Security', 'icon': _codeIcon},
      {'id': 'config', 'label': 'Configuration', 'icon': PhosphorIcons.gear()},
    ];

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: tabs.map((tab) {
            final isActive = _selectedTab == tab['id'];
            return InkWell(
              onTap: () => setState(() => _selectedTab = tab['id'] as String),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: isActive ? AppColors.kPrimary : Colors.transparent,
                      width: 2,
                    ),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      tab['icon'] as IconData,
                      size: 18,
                      color:
                          isActive ? AppColors.kPrimary : Colors.grey.shade400,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      tab['label'] as String,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight:
                            isActive ? FontWeight.w600 : FontWeight.w500,
                        color: isActive
                            ? AppColors.kPrimary
                            : Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildFilters() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              onChanged: (v) => setState(() => _searchTerm = v),
              decoration: InputDecoration(
                hintText: 'Search by email, IP address...',
                prefixIcon: Icon(PhosphorIcons.magnifyingGlass(),
                    color: Colors.grey.shade400),
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: Colors.grey.shade200),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: Colors.grey.shade200),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: AppColors.kPrimary),
                ),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),
          ),
          const SizedBox(width: 16),
          DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _filterStatus,
              items: const [
                DropdownMenuItem(value: 'all', child: Text('All Status')),
                DropdownMenuItem(value: 'success', child: Text('Success Only')),
                DropdownMenuItem(value: 'failed', child: Text('Failed Only')),
              ],
              onChanged: (v) => setState(() => _filterStatus = v!),
            ),
          ),
          const SizedBox(width: 16),
          DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _filterThreat,
              items: const [
                DropdownMenuItem(value: 'all', child: Text('All Threats')),
                DropdownMenuItem(
                    value: 'suspicious', child: Text('Suspicious Only')),
                DropdownMenuItem(value: 'clean', child: Text('Clean Only')),
              ],
              onChanged: (v) => setState(() => _filterThreat = v!),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabContent(
    AsyncValue<Map<String, dynamic>> logsAsync,
    AsyncValue<Map<String, dynamic>> threatsAsync,
    AsyncValue<Map<String, dynamic>> blockedIPsAsync,
    AsyncValue<Map<String, dynamic>> sessionsAsync,
    AsyncValue<Map<String, dynamic>> rlsAsync,
    AsyncValue<Map<String, dynamic>> configAsync,
  ) {
    switch (_selectedTab) {
      case 'analytics':
        return logsAsync.when(
          data: (data) => _buildAnalyticsSummary(data),
          loading: () => const LoadingSkeleton(height: 400),
          error: (e, _) => ErrorState(message: e.toString()),
        );
      case 'access':
        return logsAsync.when(
          data: (data) => _buildAccessLogsTable(data),
          loading: () => const LoadingSkeleton(height: 400),
          error: (e, _) => ErrorState(message: e.toString()),
        );
      case 'threats':
        return threatsAsync.when(
          data: (data) => _buildThreatsTable(data, blockedIPsAsync),
          loading: () => const LoadingSkeleton(height: 400),
          error: (e, _) => ErrorState(message: e.toString()),
        );
      case 'geo':
        return logsAsync.when(
          data: (data) => _buildGeolocationSection(data),
          loading: () => const LoadingSkeleton(height: 400),
          error: (e, _) => ErrorState(message: e.toString()),
        );
      case 'sessions':
        return sessionsAsync.when(
          data: (data) => _buildSessionsSection(data),
          loading: () => const LoadingSkeleton(height: 400),
          error: (e, _) => ErrorState(message: e.toString()),
        );
      case 'rls':
        return rlsAsync.when(
          data: (data) => _buildRlsSection(data),
          loading: () => const LoadingSkeleton(height: 400),
          error: (e, _) => ErrorState(message: e.toString()),
        );
      case 'api':
        return _buildAPISecuritySection();
      case 'config':
        return configAsync.when(
          data: (data) => _buildConfigSection(data),
          loading: () => const LoadingSkeleton(height: 400),
          error: (e, _) => ErrorState(message: e.toString()),
        );
      default:
        return const SizedBox.shrink();
    }
  }

  List<dynamic> _filteredLogs(Map<String, dynamic> data) {
    final logs = data['data'] as List<dynamic>? ?? [];
    return logs.where((log) {
      if (log is! Map<String, dynamic>) return false;
      final status = log['status']?.toString().toLowerCase() ?? '';
      final email = log['email']?.toString().toLowerCase() ?? '';
      final ip = log['ip_address']?.toString().toLowerCase() ?? '';
      final query = _searchTerm.trim().toLowerCase();
      if (query.isNotEmpty && !email.contains(query) && !ip.contains(query)) {
        return false;
      }
      if (_filterStatus != 'all' && status != _filterStatus) {
        return false;
      }
      if (_filterThreat == 'suspicious' && log['is_suspicious'] != true) {
        return false;
      }
      if (_filterThreat == 'clean' && log['is_suspicious'] == true) {
        return false;
      }
      return true;
    }).toList();
  }

  Widget _buildAnalyticsSummary(Map<String, dynamic> data) {
    final logs = _filteredLogs(data);
    final suspicious =
        logs.where((log) => log is Map && log['is_suspicious'] == true).length;
    final vpn = logs.where((log) => log is Map && log['is_vpn'] == true).length;
    final proxy =
        logs.where((log) => log is Map && log['is_proxy'] == true).length;
    final highThreat = logs.where((log) {
      if (log is! Map) return false;
      return ((log['threat_score'] as num?)?.toInt() ?? 0) >= 60;
    }).length;

    return Column(
      children: [
        Row(
          children: [
            _miniMetric('Filtered Events', logs.length.toString(),
                PhosphorIcons.activity(), AppColors.kPrimary),
            const SizedBox(width: 12),
            _miniMetric('Suspicious', suspicious.toString(),
                PhosphorIcons.shieldWarning(), const Color(0xFFef4444)),
            const SizedBox(width: 12),
            _miniMetric('VPN / Proxy', '$vpn / $proxy',
                PhosphorIcons.wifiSlash(), const Color(0xFFf59e0b)),
            const SizedBox(width: 12),
            _miniMetric('High Threat', highThreat.toString(),
                PhosphorIcons.warning(), const Color(0xFFdc2626)),
          ],
        ),
        const SizedBox(height: 20),
        _buildAccessLogsTable({'data': logs}),
      ],
    );
  }

  Widget _miniMetric(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value,
                    style: const TextStyle(
                        fontSize: 20, fontWeight: FontWeight.w700)),
                Text(label,
                    style:
                        TextStyle(fontSize: 12, color: Colors.grey.shade500)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAccessLogsTable(Map<String, dynamic> data) {
    final logs = _filteredLogs(data);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: logs.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(40),
                child: Column(
                  children: [
                    Icon(PhosphorIcons.shieldCheck(),
                        size: 64, color: Colors.grey.shade300),
                    const SizedBox(height: 16),
                    Text(
                      'No security events',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey.shade600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'All systems are operating normally',
                      style: TextStyle(color: Colors.grey.shade400),
                    ),
                  ],
                ),
              ),
            )
          : SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                columns: const [
                  DataColumn(label: Text('Timestamp')),
                  DataColumn(label: Text('User')),
                  DataColumn(label: Text('IP Address')),
                  DataColumn(label: Text('Location')),
                  DataColumn(label: Text('Device')),
                  DataColumn(label: Text('Status')),
                  DataColumn(label: Text('Threat')),
                ],
                rows: logs.map((log) {
                  final user = _mapValue(log['user']).isNotEmpty
                      ? _mapValue(log['user'])
                      : _mapValue(log['actor']);
                  final email = _firstText([
                    log['email'],
                    user['email'],
                  ]);
                  final userName = _securityUserName(user, email);
                  final geo = log;
                  final threatScore =
                      (log['threat_score'] as num?)?.toInt() ?? 0;

                  return DataRow(
                    cells: [
                      DataCell(Text(_formatTimestamp(log['created_at']))),
                      DataCell(
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              userName,
                              style:
                                  const TextStyle(fontWeight: FontWeight.w500),
                            ),
                            Text(
                              email,
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey.shade500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      DataCell(
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(log['ip_address']?.toString() ?? 'N/A'),
                            if (log['is_vpn'] == true)
                              Container(
                                margin: const EdgeInsets.only(left: 8),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFfef3c7),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: const Text(
                                  'VPN',
                                  style: TextStyle(
                                      fontSize: 10, color: Color(0xFFd97706)),
                                ),
                              ),
                            if (log['is_proxy'] == true)
                              Container(
                                margin: const EdgeInsets.only(left: 8),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFfee2e2),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: const Text(
                                  'PROXY',
                                  style: TextStyle(
                                      fontSize: 10, color: Color(0xFFef4444)),
                                ),
                              ),
                          ],
                        ),
                      ),
                      DataCell(
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(PhosphorIcons.buildings(),
                                size: 14, color: Colors.grey.shade400),
                            const SizedBox(width: 4),
                            Text(
                              geo['geo_city'] != null &&
                                      geo['geo_country'] != null
                                  ? '${geo['geo_city']}, ${geo['geo_country']}'
                                  : 'Unknown',
                              style: TextStyle(color: Colors.grey.shade600),
                            ),
                          ],
                        ),
                      ),
                      DataCell(
                        Text(
                          '${log['device_info']?['browser'] ?? 'Unknown'} / ${log['device_info']?['os'] ?? 'Unknown'}',
                          style: TextStyle(color: Colors.grey.shade600),
                        ),
                      ),
                      DataCell(
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: log['status'] == 'success'
                                ? const Color(0xFFd1fae5)
                                : const Color(0xFFfee2e2),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                log['status'] == 'success'
                                    ? PhosphorIcons.checkCircle()
                                    : _xCircleIcon,
                                size: 14,
                                color: log['status'] == 'success'
                                    ? const Color(0xFF10b981)
                                    : const Color(0xFFef4444),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                log['status']?.toString().toUpperCase() ??
                                    'UNKNOWN',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: log['status'] == 'success'
                                      ? const Color(0xFF10b981)
                                      : const Color(0xFFef4444),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      DataCell(_buildThreatBadge(threatScore)),
                    ],
                  );
                }).toList(),
              ),
            ),
    );
  }

  Widget _buildThreatsTable(Map<String, dynamic> data,
      AsyncValue<Map<String, dynamic>> blockedIPsAsync) {
    final threats = data['anomalies'] as List<dynamic>? ??
        data['threats'] as List<dynamic>? ??
        [];

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: threats.isEmpty
              ? Center(
                  child: Column(
                    children: [
                      Icon(PhosphorIcons.shieldCheck(),
                          size: 64, color: Colors.grey.shade300),
                      const SizedBox(height: 16),
                      Text(
                        'No threats detected',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                )
              : ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: threats.length,
                  separatorBuilder: (_, __) => const Divider(),
                  itemBuilder: (context, index) {
                    final threat = threats[index];
                    final severity = threat['severity'] as String? ?? 'LOW';
                    final ipAddress = threat['ip_address']?.toString();
                    return ListTile(
                        leading: Icon(
                          PhosphorIcons.warning(),
                          color: _getThreatColor(severity),
                        ),
                        title: Text(threat['title']?.toString() ??
                            threat['type']?.toString() ??
                            'Unknown Threat'),
                        subtitle: Text(threat['description']?.toString() ?? ''),
                        trailing: SizedBox(
                          width: ipAddress == null ? 120 : 220,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 6),
                                decoration: BoxDecoration(
                                  color: _getThreatColor(severity)
                                      .withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  severity,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: _getThreatColor(severity),
                                  ),
                                ),
                              ),
                              if (ipAddress != null) ...[
                                const SizedBox(width: 8),
                                TextButton.icon(
                                  onPressed: () => _blockIP(
                                      ipAddress,
                                      threat['description']?.toString() ??
                                          'Suspicious activity'),
                                  icon: Icon(_prohibitIcon, size: 16),
                                  label: const Text('Block'),
                                ),
                              ],
                            ],
                          ),
                        ));
                  },
                ),
        ),
        const SizedBox(height: 20),
        blockedIPsAsync.when(
          data: _buildBlockedIPsTable,
          loading: () => const LoadingSkeleton(height: 120),
          error: (e, _) => ErrorState(message: e.toString()),
        ),
      ],
    );
  }

  Widget _buildBlockedIPsTable(Map<String, dynamic> data) {
    final blockedIPs = data['data'] as List<dynamic>? ??
        data['blockedIPs'] as List<dynamic>? ??
        [];

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: blockedIPs.isEmpty
          ? Center(
              child: Column(
                children: [
                  Icon(PhosphorIcons.shieldCheck(),
                      size: 64, color: Colors.grey.shade300),
                  const SizedBox(height: 16),
                  Text(
                    'No IPs currently blocked',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.grey.shade600,
                    ),
                  ),
                ],
              ),
            )
          : ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: blockedIPs.length,
              separatorBuilder: (_, __) => const Divider(),
              itemBuilder: (context, index) {
                final ip = blockedIPs[index];
                return ListTile(
                  leading: Icon(_prohibitIcon, color: const Color(0xFFef4444)),
                  title: Text(ip['ip_address']?.toString() ??
                      ip['ipAddress']?.toString() ??
                      'Unknown'),
                  subtitle: Text(
                      'Blocked: ${ip['blocked_at']?.toString() ?? ip['blockedAt']?.toString() ?? 'Unknown'}\nReason: ${ip['reason']?.toString() ?? 'Unknown'}'),
                  trailing: TextButton(
                    onPressed: () => _unblockIP(ip['ip_address']?.toString() ??
                        ip['ipAddress']?.toString() ??
                        ''),
                    child: const Text('Unblock'),
                  ),
                );
              },
            ),
    );
  }

  Widget _buildGeolocationSection(Map<String, dynamic> data) {
    final logs = _filteredLogs(data);
    final grouped = <String, Map<String, dynamic>>{};
    for (final log in logs) {
      if (log is! Map<String, dynamic>) continue;
      final country = log['geo_country']?.toString() ?? 'Unknown';
      grouped.putIfAbsent(
          country, () => {'count': 0, 'suspicious': 0, 'cities': <String>{}});
      grouped[country]!['count'] = (grouped[country]!['count'] as int) + 1;
      if (log['is_suspicious'] == true) {
        grouped[country]!['suspicious'] =
            (grouped[country]!['suspicious'] as int) + 1;
      }
      final city = log['geo_city']?.toString();
      if (city != null && city.isNotEmpty) {
        (grouped[country]!['cities'] as Set<String>).add(city);
      }
    }
    final countries = grouped.entries.toList()
      ..sort((a, b) =>
          (b.value['count'] as int).compareTo(a.value['count'] as int));

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: countries.isEmpty
          ? const Center(child: Text('No geolocation data available'))
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: countries.map((entry) {
                final cities = entry.value['cities'] as Set<String>;
                return ListTile(
                  leading: Icon(_mapPinIcon, color: AppColors.kPrimary),
                  title: Text(entry.key),
                  subtitle: Text(
                      '${entry.value['count']} access attempts${cities.isEmpty ? '' : ' • ${cities.length} cities'}'),
                  trailing: (entry.value['suspicious'] as int) > 0
                      ? Chip(
                          label:
                              Text('${entry.value['suspicious']} suspicious'))
                      : const Chip(label: Text('Clean')),
                );
              }).toList(),
            ),
    );
  }

  Widget _buildSessionsSection(Map<String, dynamic> data) {
    final sessions = data['data'] as List<dynamic>? ?? [];
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Active Sessions (${sessions.length})',
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w700)),
              TextButton.icon(
                onPressed: sessions.isEmpty ? null : _terminateAllSessions,
                icon: Icon(_prohibitIcon, size: 16),
                label: const Text('Terminate All'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (sessions.isEmpty)
            const Center(
                child: Padding(
                    padding: EdgeInsets.all(32),
                    child: Text('No active sessions in the last 24 hours')))
          else
            Wrap(
              spacing: 16,
              runSpacing: 16,
              children: sessions.map((session) {
                final user = session['user'] as Map<String, dynamic>?;
                final userId = session['user_id']?.toString() ??
                    session['id']?.toString() ??
                    '';
                final email = session['email']?.toString() ??
                    user?['email']?.toString() ??
                    'Unknown';
                return SizedBox(
                  width: 360,
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade200),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(email,
                            style:
                                const TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        Text(
                            '${session['ip_address'] ?? 'Unknown IP'} • ${session['geo_city'] ?? 'Unknown'}, ${session['geo_country'] ?? 'Unknown'}'),
                        const SizedBox(height: 8),
                        Text(
                            'Last active: ${_formatTimestamp(session['created_at']?.toString())}'),
                        const SizedBox(height: 12),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: userId.isEmpty
                                ? null
                                : () => _terminateSession(userId, email),
                            child: const Text('Terminate'),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }

  Widget _buildRlsSection(Map<String, dynamic> data) {
    final policies = data['data'] as List<dynamic>? ?? [];
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: policies.isEmpty
          ? const Center(
              child: Text('No RLS policy metadata returned by the backend'))
          : DataTable(
              columns: const [
                DataColumn(label: Text('Table')),
                DataColumn(label: Text('Policy')),
                DataColumn(label: Text('Command')),
                DataColumn(label: Text('Violations 24h')),
              ],
              rows: policies.map((policy) {
                return DataRow(cells: [
                  DataCell(Text(policy['table_name']?.toString() ?? 'Unknown')),
                  DataCell(Text(policy['policy_name']?.toString() ??
                      policy['name']?.toString() ??
                      '-')),
                  DataCell(Text(policy['command']?.toString() ??
                      policy['cmd']?.toString() ??
                      '-')),
                  DataCell(Text(policy['violation_count']?.toString() ?? '0')),
                ]);
              }).toList(),
            ),
    );
  }

  Widget _buildConfigSection(Map<String, dynamic> data) {
    final config = data['data'] is Map<String, dynamic>
        ? data['data'] as Map<String, dynamic>
        : data;
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Wrap(
        spacing: 16,
        runSpacing: 16,
        children: config.entries.map((entry) {
          return SizedBox(
            width: 300,
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(entry.key.replaceAll('_', ' ')),
              subtitle:
                  Text(readableRecordValue(config, entry.key, entry.value)),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildAPISecuritySection() {
    final apiLogsAsync = ref.watch(apiSecurityLogsProvider);

    return apiLogsAsync.when(
      data: (data) {
        final metrics = data['data'] is Map<String, dynamic>
            ? data['data'] as Map<String, dynamic>
            : data;
        final endpoints = metrics['endpoints'] as List<dynamic>? ?? [];
        return Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: endpoints.isEmpty
              ? Center(
                  child: Column(
                    children: [
                      Icon(_codeIcon, size: 64, color: Colors.grey.shade300),
                      const SizedBox(height: 16),
                      Text(
                        'No API security events',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                )
              : ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: endpoints.length,
                  separatorBuilder: (_, __) => const Divider(),
                  itemBuilder: (context, index) {
                    final log = endpoints[index];
                    final errors = (log['errors'] as num?)?.toInt() ?? 0;
                    return ListTile(
                      leading: Icon(
                        PhosphorIcons.treeStructure(),
                        color: errors == 0
                            ? const Color(0xFF10b981)
                            : const Color(0xFFef4444),
                      ),
                      title: Text(log['endpoint']?.toString() ?? 'unknown'),
                      subtitle: Text(
                          'Requests: ${log['requests'] ?? 0} | Errors: $errors'),
                      trailing: Text('Total: ${metrics['totalRequests'] ?? 0}'),
                    );
                  },
                ),
        );
      },
      loading: () => const LoadingSkeleton(height: 400),
      error: (e, _) => ErrorState(message: e.toString()),
    );
  }

  Widget _buildThreatBadge(int score) {
    String label;
    Color color;

    if (score >= 60) {
      label = 'High Risk';
      color = const Color(0xFFef4444);
    } else if (score >= 40) {
      label = 'Medium Risk';
      color = const Color(0xFFf59e0b);
    } else if (score >= 20) {
      label = 'Low Risk';
      color = const Color(0xFFf97316);
    } else {
      label = 'Clean';
      color = const Color(0xFF10b981);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w500,
          color: color,
        ),
      ),
    );
  }

  Color _getThreatColor(String severity) {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return const Color(0xFFdc2626);
      case 'HIGH':
        return const Color(0xFFef4444);
      case 'MEDIUM':
        return const Color(0xFFf59e0b);
      case 'LOW':
        return const Color(0xFF3b82f6);
      default:
        return Colors.grey;
    }
  }

  Widget _buildExportButton() {
    return PopupMenuButton<String>(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.kPrimary,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(_downloadIcon, color: Colors.white, size: 18),
            const SizedBox(width: 8),
            const Text(
              'Export',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 4),
            const Icon(_caretDownIcon, color: Colors.white, size: 14),
          ],
        ),
      ),
      itemBuilder: (context) => [
        const PopupMenuItem(value: 'csv', child: Text('Export as CSV')),
        const PopupMenuItem(value: 'json', child: Text('Export as JSON')),
        const PopupMenuItem(value: 'pdf', child: Text('Export as PDF')),
      ],
      onSelected: (format) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(
              content: Text(
                  'Security $format export prepared from current records')),
        );
      },
    );
  }

  String _formatTimestamp(String? timestamp) {
    if (timestamp == null) return 'Unknown';
    try {
      final date = DateTime.parse(timestamp);
      return '${date.day}/${date.month}/${date.year} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
    } catch (e) {
      return timestamp;
    }
  }

  void _refreshData() {
    ref.invalidate(securityLogsProvider);
    ref.invalidate(securityStatsProvider);
    ref.invalidate(securityThreatsProvider);
    ref.invalidate(blockedIPsProvider);
    ref.invalidate(apiSecurityLogsProvider);
    ref.invalidate(activeSessionsProvider);
    ref.invalidate(rlsPoliciesProvider);
    ref.invalidate(securityConfigProvider);
  }

  Future<void> _blockIP(String ipAddress, String reason) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Block IP address'),
        content: Text(
            'Block $ipAddress?\n\nThis prevents access from this IP address.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Block')),
        ],
      ),
    );
    if (confirmed != true) return;

    final service = ref.read(securityServiceProvider);
    try {
      final response = await service.blockIP(ipAddress, reason);
      if (!mounted) return;
      AppNotifier.showSnackBar(
        context,
        SnackBar(
            content:
                Text(response['message']?.toString() ?? 'IP address blocked')),
      );
      _refreshData();
    } catch (e) {
      if (!mounted) return;
      AppNotifier.showSnackBar(
          context, SnackBar(content: Text(apiErrorMessage(e))));
    }
  }

  Future<void> _unblockIP(String ipAddress) async {
    final service = ref.read(securityServiceProvider);
    try {
      final response = await service.unblockIP(ipAddress);
      if (!mounted) return;
      AppNotifier.showSnackBar(
        context,
        SnackBar(
            content: Text(
                response['message']?.toString() ?? 'IP address unblocked')),
      );
      _refreshData();
    } catch (e) {
      if (!mounted) return;
      AppNotifier.showSnackBar(
          context, SnackBar(content: Text(apiErrorMessage(e))));
    }
  }

  Future<void> _terminateSession(String userId, String email) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Terminate session'),
        content: Text('Terminate the active session for $email?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Terminate')),
        ],
      ),
    );
    if (confirmed != true) return;

    final service = ref.read(securityServiceProvider);
    try {
      final response = await service.terminateSession(userId);
      if (!mounted) return;
      AppNotifier.showSnackBar(
        context,
        SnackBar(
            content:
                Text(response['message']?.toString() ?? 'Session terminated')),
      );
      ref.invalidate(activeSessionsProvider);
    } catch (e) {
      if (!mounted) return;
      AppNotifier.showSnackBar(
          context, SnackBar(content: Text(apiErrorMessage(e))));
    }
  }

  Future<void> _terminateAllSessions() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Terminate all sessions'),
        content: const Text(
            'Terminate all active user sessions? This logs out all users immediately.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Terminate all')),
        ],
      ),
    );
    if (confirmed != true) return;

    final service = ref.read(securityServiceProvider);
    try {
      final response = await service.terminateAllSessions();
      if (!mounted) return;
      AppNotifier.showSnackBar(
        context,
        SnackBar(
            content: Text(
                response['message']?.toString() ?? 'All sessions terminated')),
      );
      ref.invalidate(activeSessionsProvider);
    } catch (e) {
      if (!mounted) return;
      AppNotifier.showSnackBar(
          context, SnackBar(content: Text(apiErrorMessage(e))));
    }
  }
}

Map<String, dynamic> _mapValue(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return {};
}

String _firstText(Iterable<dynamic> values) {
  for (final value in values) {
    final text = value?.toString().trim() ?? '';
    if (text.isNotEmpty && text.toLowerCase() != 'null') return text;
  }
  return '';
}

String _securityUserName(Map<String, dynamic> user, String email) {
  final direct = _firstText([
    user['name'],
    user['full_name'],
    '${_firstText([user['first_name']])} ${_firstText([user['last_name']])}'
        .trim(),
  ]);
  if (direct.isNotEmpty) return direct;
  if (email.isNotEmpty && !email.startsWith('N/A')) {
    return email.split('@').first;
  }
  if (email.startsWith('N/A')) return 'PIN attempt';
  return 'Unknown user';
}
