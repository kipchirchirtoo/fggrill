import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../domain/branch_health_models.dart';
import '../domain/branch_health_providers.dart';

/// Standalone route wrapper (used by `/branch-health`).
class BranchHealthScreen extends StatelessWidget {
  const BranchHealthScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Branch Data Health')),
      body: const BranchHealthView(),
    );
  }
}

/// Embeddable view (no Scaffold) so dashboards can host it as a section.
/// [branchId] is null for the signed-in user's own branch; central roles
/// (superadmin fleet view) pass an explicit branch id.
class BranchHealthView extends ConsumerWidget {
  const BranchHealthView({super.key, this.branchId});

  final int? branchId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final health = ref.watch(branchHealthProvider(branchId));

    return health.when(
      skipLoadingOnRefresh: false,
      loading: () => const _HealthLoading(),
      error: (err, _) => _HealthError(
        message: err.toString(),
        onRetry: () => ref.invalidate(branchHealthProvider(branchId)),
      ),
      data: (result) => RefreshIndicator(
        onRefresh: () =>
            ref.read(branchHealthProvider(branchId).notifier).forceRefresh(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            _ScoreHeader(result: result),
            const SizedBox(height: 8),
            _LastCheckedRow(
              checkedAt: result.checkedAt,
              onRefresh: () => ref
                  .read(branchHealthProvider(branchId).notifier)
                  .forceRefresh(),
            ),
            if (!result.isAiInterpreted) ...[
              const SizedBox(height: 8),
              const _BasicDiagnosticsNote(),
            ],
            const SizedBox(height: 16),
            if (result.issues.isEmpty)
              const _AllClearCard()
            else
              ...result.issues.map((issue) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _IssueCard(issue: issue),
                  )),
          ],
        ),
      ),
    );
  }
}

// ── Score ────────────────────────────────────────────────────────────────────

Color _scoreColor(int score) {
  if (score >= 80) return const Color(0xFF2E7D32); // green
  if (score >= 50) return const Color(0xFFF9A825); // amber
  return const Color(0xFFC62828); // red
}

class _ScoreHeader extends StatelessWidget {
  const _ScoreHeader({required this.result});

  final BranchHealthResult result;

  @override
  Widget build(BuildContext context) {
    final color = _scoreColor(result.healthScore);
    final label = result.healthScore >= 80
        ? 'Healthy'
        : result.healthScore >= 50
            ? 'Needs attention'
            : 'Critical gaps';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            SizedBox(
              width: 96,
              height: 96,
              child: Stack(
                fit: StackFit.expand,
                alignment: Alignment.center,
                children: [
                  CircularProgressIndicator(
                    value: result.healthScore / 100,
                    strokeWidth: 8,
                    color: color,
                    backgroundColor: color.withValues(alpha: 0.15),
                  ),
                  Center(
                    child: Text(
                      '${result.healthScore}',
                      style: Theme.of(context)
                          .textTheme
                          .headlineMedium
                          ?.copyWith(color: color, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Data Health Score',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(label,
                      style: Theme.of(context)
                          .textTheme
                          .titleLarge
                          ?.copyWith(color: color, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(
                    result.issues.isEmpty
                        ? 'No setup issues found.'
                        : '${result.issues.length} issue(s) found — tap one to fix it.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LastCheckedRow extends StatelessWidget {
  const _LastCheckedRow({required this.checkedAt, required this.onRefresh});

  final DateTime checkedAt;
  final Future<void> Function() onRefresh;

  static String _ago(DateTime time) {
    final diff = DateTime.now().difference(time);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} hr ago';
    return '${diff.inDays} day(s) ago';
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(Icons.schedule, size: 16, color: Colors.grey.shade600),
        const SizedBox(width: 6),
        Text('Last checked ${_ago(checkedAt)}',
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: Colors.grey.shade600)),
        const Spacer(),
        TextButton.icon(
          onPressed: onRefresh,
          icon: const Icon(Icons.refresh, size: 18),
          label: const Text('Check now'),
        ),
      ],
    );
  }
}

class _BasicDiagnosticsNote extends StatelessWidget {
  const _BasicDiagnosticsNote();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.blueGrey.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline, size: 16, color: Colors.blueGrey.shade600),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Showing basic diagnostics',
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: Colors.blueGrey.shade700),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Issues ───────────────────────────────────────────────────────────────────

Color _severityColor(HealthIssueSeverity severity) {
  switch (severity) {
    case HealthIssueSeverity.critical:
      return const Color(0xFFC62828);
    case HealthIssueSeverity.high:
      return const Color(0xFFEF6C00);
    case HealthIssueSeverity.medium:
      return const Color(0xFFF9A825);
    case HealthIssueSeverity.low:
      return const Color(0xFF546E7A);
  }
}

String _severityLabel(HealthIssueSeverity severity) {
  switch (severity) {
    case HealthIssueSeverity.critical:
      return 'CRITICAL';
    case HealthIssueSeverity.high:
      return 'HIGH';
    case HealthIssueSeverity.medium:
      return 'MEDIUM';
    case HealthIssueSeverity.low:
      return 'LOW';
  }
}

/// Deep-link mapping from affected area to the existing management screen.
String _areaRoute(HealthAffectedArea area) {
  switch (area) {
    case HealthAffectedArea.bar:
      return '/branch-manager/bar-menu';
    case HealthAffectedArea.kitchen:
      return '/branch-manager/kitchen/recipes';
    case HealthAffectedArea.menu:
      return '/branch-manager/menu';
    case HealthAffectedArea.store:
      return '/branch-manager/stock-requests';
  }
}

String _areaLabel(HealthAffectedArea area) {
  switch (area) {
    case HealthAffectedArea.bar:
      return 'Bar';
    case HealthAffectedArea.kitchen:
      return 'Kitchen';
    case HealthAffectedArea.menu:
      return 'Menu';
    case HealthAffectedArea.store:
      return 'Store';
  }
}

class _IssueCard extends StatelessWidget {
  const _IssueCard({required this.issue});

  final BranchHealthIssue issue;

  @override
  Widget build(BuildContext context) {
    final color = _severityColor(issue.severity);

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.go(_areaRoute(issue.affectedArea)),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      _severityLabel(issue.severity),
                      style: TextStyle(
                        color: color,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.grey.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      _areaLabel(issue.affectedArea),
                      style: TextStyle(
                          color: Colors.grey.shade700,
                          fontSize: 11,
                          fontWeight: FontWeight.w600),
                    ),
                  ),
                  const Spacer(),
                  Icon(Icons.chevron_right,
                      size: 20, color: Colors.grey.shade500),
                ],
              ),
              const SizedBox(height: 10),
              Text(issue.title,
                  style: Theme.of(context)
                      .textTheme
                      .titleSmall
                      ?.copyWith(fontWeight: FontWeight.w600)),
              if (issue.plainExplanation.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(issue.plainExplanation,
                    style: Theme.of(context).textTheme.bodySmall),
              ],
              if (issue.suggestedAction.isNotEmpty) ...[
                const SizedBox(height: 8),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.arrow_forward,
                        size: 14, color: Colors.grey.shade600),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        issue.suggestedAction,
                        style: Theme.of(context)
                            .textTheme
                            .bodySmall
                            ?.copyWith(fontStyle: FontStyle.italic),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ── States ───────────────────────────────────────────────────────────────────

class _HealthLoading extends StatelessWidget {
  const _HealthLoading();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(),
          SizedBox(height: 16),
          Text('Checking your branch data...'),
          SizedBox(height: 4),
          Text('This can take a few seconds.',
              style: TextStyle(fontSize: 12, color: Colors.grey)),
        ],
      ),
    );
  }
}

class _HealthError extends StatelessWidget {
  const _HealthError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 40, color: Colors.grey.shade500),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}

class _AllClearCard extends StatelessWidget {
  const _AllClearCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const Icon(Icons.check_circle_outline,
                size: 40, color: Color(0xFF2E7D32)),
            const SizedBox(height: 12),
            Text('All checks passed',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(
              'Your branch data is set up correctly for cost tracking.',
              style: Theme.of(context).textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
