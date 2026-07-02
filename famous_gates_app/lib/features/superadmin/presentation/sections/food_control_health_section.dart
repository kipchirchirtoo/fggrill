import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../branch_health/domain/branch_health_models.dart';
import '../../../branch_health/domain/branch_health_providers.dart';
import '../../../branch_health/presentation/branch_health_screen.dart';
import '../../domain/superadmin_providers.dart';

/// Superadmin fleet-wide food-control health: every branch's deterministic
/// data-health score (POS→stock links, recipes, stocktake linkage, par levels,
/// dispatch reconciliation, menu costs). Tap a branch for the full diagnosis;
/// "Ask Lina" jumps to the Lina section, which has the same findings wired in
/// as chat evidence.
class FoodControlHealthSection extends ConsumerWidget {
  const FoodControlHealthSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fleet = ref.watch(fleetHealthProvider);

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Food Control Health',
                        style: Theme.of(context)
                            .textTheme
                            .titleLarge
                            ?.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(
                      'Whether each branch can track food and drink costs: POS stock links, recipes, stocktakes, and dispatches.',
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: AppColors.kTextSecondary),
                    ),
                  ],
                ),
              ),
              OutlinedButton.icon(
                onPressed: () => ref
                    .read(superAdminSectionProvider.notifier)
                    .state = SuperAdminSection.lina,
                icon: Icon(PhosphorIcons.sparkle(), size: 16),
                label: const Text('Ask Lina'),
              ),
              const SizedBox(width: 8),
              IconButton(
                tooltip: 'Re-run checks',
                onPressed: () => ref.invalidate(fleetHealthProvider),
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: fleet.when(
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (err, _) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('$err', textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: () => ref.invalidate(fleetHealthProvider),
                      child: const Text('Try again'),
                    ),
                  ],
                ),
              ),
              data: (branches) => LayoutBuilder(
                builder: (context, constraints) {
                  final columns = (constraints.maxWidth / 360)
                      .floor()
                      .clamp(1, 4);
                  return GridView.builder(
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: columns,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      mainAxisExtent: 170,
                    ),
                    itemCount: branches.length,
                    itemBuilder: (context, i) =>
                        _FleetBranchCard(branch: branches[i]),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

Color _scoreColor(int score) {
  if (score >= 80) return const Color(0xFF2E7D32);
  if (score >= 50) return const Color(0xFFF9A825);
  return const Color(0xFFC62828);
}

class _FleetBranchCard extends StatelessWidget {
  const _FleetBranchCard({required this.branch});

  final FleetBranchHealth branch;

  @override
  Widget build(BuildContext context) {
    final color = _scoreColor(branch.healthScore);
    final isLive = branch.totalOrders > 0;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _showBranchDetail(context),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  SizedBox(
                    width: 46,
                    height: 46,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        CircularProgressIndicator(
                          value: branch.healthScore / 100,
                          strokeWidth: 5,
                          color: color,
                          backgroundColor: color.withValues(alpha: 0.15),
                        ),
                        Center(
                          child: Text(
                            '${branch.healthScore}',
                            style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: color),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(branch.branchName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 14)),
                        const SizedBox(height: 2),
                        Text(
                          isLive
                              ? '${branch.totalOrders} orders · live ${branch.daysLive ?? 0}d'
                              : 'Not selling yet',
                          style: TextStyle(
                              fontSize: 11, color: Colors.grey.shade600),
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right,
                      size: 18, color: Colors.grey.shade500),
                ],
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: [
                  for (final entry in branch.issueCounts.entries)
                    if (entry.value > 0)
                      _SeverityChip(severity: entry.key, count: entry.value),
                  if (branch.totalIssues == 0)
                    const _SeverityChip(severity: 'clear', count: 0),
                ],
              ),
              const Spacer(),
              if (branch.topIssues.isNotEmpty)
                Text(
                  branch.topIssues.first,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
                ),
            ],
          ),
        ),
      ),
    );
  }

  void _showBranchDetail(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => Dialog(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640, maxHeight: 720),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 8, 0),
                child: Row(
                  children: [
                    Expanded(
                      child: Text('${branch.branchName} — Data Health',
                          style: const TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w700)),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              Expanded(child: BranchHealthView(branchId: branch.branchId)),
            ],
          ),
        ),
      ),
    );
  }
}

class _SeverityChip extends StatelessWidget {
  const _SeverityChip({required this.severity, required this.count});

  final String severity;
  final int count;

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (severity) {
      'critical' => (const Color(0xFFC62828), '$count critical'),
      'high' => (const Color(0xFFEF6C00), '$count high'),
      'medium' => (const Color(0xFFF9A825), '$count medium'),
      'low' => (const Color(0xFF546E7A), '$count low'),
      _ => (const Color(0xFF2E7D32), 'All clear'),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(label,
          style: TextStyle(
              fontSize: 10.5, fontWeight: FontWeight.w600, color: color)),
    );
  }
}
