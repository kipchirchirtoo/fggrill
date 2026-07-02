/// Models for the Branch Data-Health Checker.
///
/// Mirrors the backend response from
/// `GET /api/branches/:branchId/health-check`.
enum HealthIssueSeverity { critical, high, medium, low }

enum HealthAffectedArea { bar, kitchen, menu, store }

HealthIssueSeverity severityFromString(String? value) {
  switch (value) {
    case 'critical':
      return HealthIssueSeverity.critical;
    case 'high':
      return HealthIssueSeverity.high;
    case 'medium':
      return HealthIssueSeverity.medium;
    default:
      return HealthIssueSeverity.low;
  }
}

HealthAffectedArea affectedAreaFromString(String? value) {
  switch (value) {
    case 'Bar':
      return HealthAffectedArea.bar;
    case 'Kitchen':
      return HealthAffectedArea.kitchen;
    case 'Store':
      return HealthAffectedArea.store;
    default:
      return HealthAffectedArea.menu;
  }
}

class BranchHealthIssue {
  const BranchHealthIssue({
    required this.severity,
    required this.title,
    required this.plainExplanation,
    required this.suggestedAction,
    required this.affectedArea,
  });

  final HealthIssueSeverity severity;
  final String title;
  final String plainExplanation;
  final String suggestedAction;
  final HealthAffectedArea affectedArea;

  factory BranchHealthIssue.fromJson(Map<String, dynamic> json) {
    return BranchHealthIssue(
      severity: severityFromString(json['severity'] as String?),
      title: (json['title'] as String?) ?? 'Issue',
      plainExplanation: (json['plain_explanation'] as String?) ?? '',
      suggestedAction: (json['suggested_action'] as String?) ?? '',
      affectedArea: affectedAreaFromString(json['affected_area'] as String?),
    );
  }
}

/// One branch's row in the fleet-wide overview
/// (`GET /api/branches/fleet/health-check`). Deterministic score only —
/// tap-through loads the full per-branch result with AI explanations.
class FleetBranchHealth {
  const FleetBranchHealth({
    required this.branchId,
    required this.branchName,
    required this.healthScore,
    required this.daysLive,
    required this.totalOrders,
    required this.issueCounts,
    required this.topIssues,
    required this.configuredOutletTypes,
  });

  final int branchId;
  final String branchName;
  final int healthScore;
  final int? daysLive; // null = no sales yet (pre-launch)
  final int totalOrders;
  final Map<String, int> issueCounts; // critical/high/medium/low
  final List<String> topIssues;
  final List<String> configuredOutletTypes;

  int get totalIssues =>
      issueCounts.values.fold(0, (sum, count) => sum + count);

  factory FleetBranchHealth.fromJson(Map<String, dynamic> json) {
    final rawCounts = (json['issue_counts'] as Map?) ?? const {};
    return FleetBranchHealth(
      branchId: (json['branch_id'] as num?)?.toInt() ?? 0,
      branchName: (json['branch_name'] as String?) ?? 'Branch',
      healthScore: (json['health_score'] as num?)?.toInt() ?? 0,
      daysLive: (json['days_live'] as num?)?.toInt(),
      totalOrders: (json['total_orders'] as num?)?.toInt() ?? 0,
      issueCounts: rawCounts.map(
          (k, v) => MapEntry('$k', (v as num?)?.toInt() ?? 0)),
      topIssues:
          ((json['top_issues'] as List?) ?? const []).map((e) => '$e').toList(),
      configuredOutletTypes: ((json['configured_outlet_types'] as List?) ??
              const [])
          .map((e) => '$e')
          .toList(),
    );
  }
}

class BranchHealthResult {
  const BranchHealthResult({
    required this.branchId,
    required this.healthScore,
    required this.issues,
    required this.isAiInterpreted,
    required this.checkedAt,
  });

  final int branchId;
  final int healthScore;
  final List<BranchHealthIssue> issues;

  /// False when the AI interpretation failed and the issues list was derived
  /// directly from the deterministic findings ("basic diagnostics").
  final bool isAiInterpreted;
  final DateTime checkedAt;

  factory BranchHealthResult.fromJson(Map<String, dynamic> json) {
    final rawIssues = (json['issues'] as List?) ?? const [];
    final issues = rawIssues
        .whereType<Map>()
        .map((i) => BranchHealthIssue.fromJson(Map<String, dynamic>.from(i)))
        .toList()
      ..sort((a, b) => a.severity.index.compareTo(b.severity.index));
    return BranchHealthResult(
      branchId: (json['branch_id'] as num?)?.toInt() ?? 0,
      healthScore: (json['health_score'] as num?)?.toInt() ?? 0,
      issues: issues,
      isAiInterpreted: json['is_ai_interpreted'] == true,
      checkedAt:
          DateTime.tryParse((json['checked_at'] as String?) ?? '')?.toLocal() ??
              DateTime.now(),
    );
  }
}
