import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/screen_size.dart';
import '../../../core/widgets/widgets.dart';
import '../data/repository.dart';
import '../domain/models.dart';
import '../domain/providers.dart';

// ─── Status selection filter ─────────────────────────────────────────────────
final _statusFilterProvider = StateProvider<String?>((ref) => null);

// ─────────────────────────────────────────────────────────────────────────────
// Main tab
// ─────────────────────────────────────────────────────────────────────────────

class BranchOrdersTab extends ConsumerWidget {
  const BranchOrdersTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filters = ref.watch(branchOrdersFiltersProvider);
    final dataAsync = ref.watch(branchOrdersProvider(filters));
    final statusFilter = ref.watch(_statusFilterProvider);

    return Padding(
      padding: ScreenSize.p(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header row ─────────────────────────────────────────────────
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Branch Orders',
                        style: Theme.of(context).textTheme.headlineMedium),
                    const SizedBox(height: 2),
                    const Text(
                      'View branch stock requisitions. Approval is now handled by the branch accountant.',
                      style: TextStyle(
                          color: AppColors.kTextSecondary, fontSize: 13),
                    ),
                  ],
                ),
              ),
              // Date range picker
              _DateRangeButton(filters: filters),
              const SizedBox(width: 8),
              // Refresh
              IconButton.outlined(
                tooltip: 'Refresh',
                onPressed: () => ref.invalidate(branchOrdersProvider(filters)),
                icon: const Icon(Icons.refresh_rounded, size: 18),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // ── Summary + branch breakdown ─────────────────────────────────
          dataAsync.when(
            loading: () => const LoadingSkeleton(type: SkeletonType.card),
            error: (e, _) => ErrorState(
                message: '$e',
                onRetry: () => ref.invalidate(branchOrdersProvider(filters))),
            data: (data) => _SummarySection(summary: data.summary),
          ),

          const SizedBox(height: 20),

          // ── Status filter chips ────────────────────────────────────────
          _StatusFilterRow(current: statusFilter),

          const SizedBox(height: 12),

          // ── Requests list ──────────────────────────────────────────────
          Expanded(
            child: dataAsync.when(
              loading: () => const LoadingSkeleton(type: SkeletonType.list),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () => ref.invalidate(branchOrdersProvider(filters))),
              data: (data) {
                var requests = data.requests;
                if (statusFilter != null) {
                  requests = requests
                      .where((r) => _matchesFilter(r, statusFilter))
                      .toList();
                }
                if (requests.isEmpty) {
                  return const EmptyState(
                      message: 'No requisitions found for the selected period');
                }
                return ListView.separated(
                  itemCount: requests.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (ctx, i) => _RequestCard(
                    request: requests[i],
                    filters: filters,
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  static bool _matchesFilter(StockRequest r, String filter) {
    switch (filter) {
      case 'pending':
        return r.isPendingAudit;
      case 'approved':
        return r.isApproved;
      case 'rejected':
        return r.isRejected;
      case 'dispatched':
        return r.isDispatched;
      case 'delivered':
        return r.isDelivered;
      default:
        return true;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Date-range picker button
// ─────────────────────────────────────────────────────────────────────────────

class _DateRangeButton extends ConsumerWidget {
  const _DateRangeButton({required this.filters});
  final Map<String, String?> filters;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final start = filters['start_date'];
    final end = filters['end_date'];
    return OutlinedButton.icon(
      onPressed: () async {
        final picked = await showDateRangePicker(
          context: context,
          firstDate: DateTime(2024),
          lastDate: DateTime(2027),
          initialDateRange: (start != null && end != null)
              ? DateTimeRange(
                  start: DateTime.parse(start), end: DateTime.parse(end))
              : null,
        );
        if (picked != null) {
          ref.read(branchOrdersFiltersProvider.notifier).state = {
            'start_date': _fmt(picked.start),
            'end_date': _fmt(picked.end),
          };
        }
      },
      icon: const Icon(Icons.date_range_rounded, size: 16),
      label: Text(
        start != null ? '$start → $end' : 'Date Range',
        style: const TextStyle(fontSize: 13),
      ),
    );
  }

  static String _fmt(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary section
// ─────────────────────────────────────────────────────────────────────────────

class _SummarySection extends StatelessWidget {
  const _SummarySection({required this.summary});
  final BranchOrdersSummary summary;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Stat cards
        Row(
          children: [
            _StatCard(
              label: 'Total',
              value: '${summary.totalRequests}',
              icon: PhosphorIcons.package(),
              color: AppColors.kPrimary,
            ),
            const SizedBox(width: 10),
            _StatCard(
              label: 'Pending Audit',
              value: '${summary.pending}',
              icon: PhosphorIcons.clockCountdown(),
              color: AppColors.kWarning,
            ),
            const SizedBox(width: 10),
            _StatCard(
              label: 'Approved',
              value: '${summary.approved}',
              icon: PhosphorIcons.checkCircle(),
              color: AppColors.kSuccess,
            ),
            const SizedBox(width: 10),
            _StatCard(
              label: 'Rejected',
              value: '${summary.rejected}',
              icon: PhosphorIcons.xCircle(),
              color: AppColors.kError,
            ),
            const SizedBox(width: 10),
            _StatCard(
              label: 'Dispatched',
              value: '${summary.dispatched}',
              icon: PhosphorIcons.truck(),
              color: const Color(0xFF7C3AED),
            ),
          ],
        ),
        // Active branch chips (only those with requests)
        if (summary.branchSummaries.any((b) => b.totalRequests > 0)) ...[
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: summary.branchSummaries
                  .where((b) => b.totalRequests > 0)
                  .map((b) => _BranchChip(branch: b))
                  .toList(),
            ),
          ),
        ],
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.18)),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(icon, color: color, size: 18),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(value,
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: color)),
                  Text(label,
                      style: TextStyle(
                          fontSize: 11,
                          color: color.withValues(alpha: 0.8),
                          fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BranchChip extends StatelessWidget {
  const _BranchChip({required this.branch});
  final BranchOrderBranchSummary branch;

  @override
  Widget build(BuildContext context) {
    final hasPending = branch.pending > 0;
    return Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: hasPending
            ? AppColors.kWarning.withValues(alpha: 0.08)
            : Colors.grey.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: hasPending
              ? AppColors.kWarning.withValues(alpha: 0.35)
              : Colors.grey.withValues(alpha: 0.2),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (hasPending)
            Container(
              width: 6,
              height: 6,
              margin: const EdgeInsets.only(right: 6),
              decoration: const BoxDecoration(
                  shape: BoxShape.circle, color: AppColors.kWarning),
            ),
          Text(branch.branchName,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color:
                    hasPending ? AppColors.kWarning : AppColors.kTextSecondary,
              )),
          const SizedBox(width: 5),
          Text('${branch.totalRequests}',
              style: TextStyle(
                fontSize: 11,
                color:
                    hasPending ? AppColors.kWarning : AppColors.kTextSecondary,
              )),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status filter chips row
// ─────────────────────────────────────────────────────────────────────────────

class _StatusFilterRow extends ConsumerWidget {
  const _StatusFilterRow({required this.current});
  final String? current;

  static const _filters = [
    (null, 'All'),
    ('pending', 'Pending Branch Accountant'),
    ('approved', 'Approved'),
    ('dispatched', 'Dispatched'),
    ('delivered', 'Delivered'),
    ('rejected', 'Rejected'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: _filters.map((f) {
          final isActive = f.$1 == current;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(f.$2),
              selected: isActive,
              onSelected: (_) {
                ref.read(_statusFilterProvider.notifier).state = f.$1;
              },
              labelStyle: TextStyle(
                fontSize: 12,
                fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                color: isActive ? AppColors.kPrimary : AppColors.kTextSecondary,
              ),
              backgroundColor: Colors.transparent,
              selectedColor: AppColors.kPrimary.withValues(alpha: 0.10),
              side: BorderSide(
                color: isActive
                    ? AppColors.kPrimary
                    : Colors.grey.withValues(alpha: 0.25),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Request card
// ─────────────────────────────────────────────────────────────────────────────

class _RequestCard extends ConsumerStatefulWidget {
  const _RequestCard({
    required this.request,
    required this.filters,
  });

  final StockRequest request;
  final Map<String, String?> filters;

  @override
  ConsumerState<_RequestCard> createState() => _RequestCardState();
}

class _RequestCardState extends ConsumerState<_RequestCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final r = widget.request;
    final statusColor = _statusColor(r.status);
    final statusLabel = _statusLabel(r.status);
    final isUrgent = r.priority.toLowerCase() == 'urgent' ||
        r.priority.toLowerCase() == 'high';

    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: statusColor.withValues(alpha: 0.18),
          width: 1,
        ),
      ),
      child: Column(
        children: [
          // ── Card header ──────────────────────────────────────────────
          InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
              child: Row(
                children: [
                  // Status circle
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: statusColor,
                    ),
                  ),
                  const SizedBox(width: 10),

                  // Request info
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(r.requestNumber,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700, fontSize: 13)),
                            const SizedBox(width: 8),
                            if (isUrgent)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color:
                                      AppColors.kError.withValues(alpha: 0.10),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: const Text(
                                  'URGENT',
                                  style: TextStyle(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.kError,
                                      letterSpacing: 0.8),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${r.requestingBranchName}  •  ${r.requestType}  •  ${_dateShort(r.createdAt)}',
                          style: const TextStyle(
                              color: AppColors.kTextSecondary, fontSize: 12),
                        ),
                        if (r.reason.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(r.reason,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  color: AppColors.kTextSecondary,
                                  fontSize: 11,
                                  fontStyle: FontStyle.italic)),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Right side: status badge + items count + chevron
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      _StatusBadge(label: statusLabel, color: statusColor),
                      const SizedBox(height: 4),
                      Text(
                        '${r.items.length} item${r.items.length == 1 ? '' : 's'}',
                        style: const TextStyle(
                            color: AppColors.kTextSecondary, fontSize: 11),
                      ),
                    ],
                  ),
                  const SizedBox(width: 8),
                  AnimatedRotation(
                    turns: _expanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: const Icon(Icons.keyboard_arrow_down_rounded,
                        size: 20, color: AppColors.kTextSecondary),
                  ),
                ],
              ),
            ),
          ),

          // ── Flow progress bar ────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _FlowProgress(request: r),
          ),

          // ── Expanded items ───────────────────────────────────────────
          AnimatedSize(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOut,
            child: _expanded
                ? _ExpandedBody(
                    request: r,
                    filters: widget.filters,
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  // Helpers
  static Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'PENDING_AUDIT':
      case 'PENDING':
        return AppColors.kWarning;
      case 'UNDER_REVIEW':
        return AppColors.kPrimary;
      case 'APPROVED':
      case 'PARTIALLY_APPROVED':
        return AppColors.kSuccess;
      case 'REJECTED':
        return AppColors.kError;
      case 'DISPATCHED':
      case 'SHIPPED':
      case 'IN_TRANSIT':
        return const Color(0xFF7C3AED);
      case 'DELIVERED':
      case 'RECEIVED':
      case 'CONFIRMED':
        return const Color(0xFF0D9488);
      case 'CANCELLED':
        return AppColors.kTextSecondary;
      default:
        return AppColors.kTextSecondary;
    }
  }

  static String _statusLabel(String status) {
    switch (status.toUpperCase()) {
      case 'PENDING_AUDIT':
        return 'Pending Audit';
      case 'PENDING':
        return 'Pending';
      case 'UNDER_REVIEW':
        return 'Under Review';
      case 'APPROVED':
        return 'Approved';
      case 'PARTIALLY_APPROVED':
        return 'Partial';
      case 'REJECTED':
        return 'Rejected';
      case 'DISPATCHED':
        return 'Dispatched';
      case 'SHIPPED':
        return 'Shipped';
      case 'IN_TRANSIT':
        return 'In Transit';
      case 'DELIVERED':
        return 'Delivered';
      case 'RECEIVED':
        return 'Received';
      case 'CONFIRMED':
        return 'Confirmed';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        return status;
    }
  }

  static String _dateShort(DateTime dt) {
    return '${dt.day.toString().padLeft(2, '0')} '
        '${_months[dt.month - 1]} ${dt.year}';
  }

  static const _months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Flow progress bar (4-step)
// ─────────────────────────────────────────────────────────────────────────────

class _FlowProgress extends StatelessWidget {
  const _FlowProgress({required this.request});
  final StockRequest request;

  @override
  Widget build(BuildContext context) {
    // Step index: 0=Requested, 1=Auditor Review, 2=Dispatched, 3=Delivered
    int activeStep;
    if (request.isDelivered) {
      activeStep = 3;
    } else if (request.isDispatched) {
      activeStep = 2;
    } else if (request.isApproved) {
      activeStep = 1; // approved, waiting dispatch
    } else if (request.isRejected) {
      activeStep = -1; // rejected
    } else {
      activeStep = 1; // pending audit = at audit step
    }

    final steps = <(IconData, String)>[
      (PhosphorIcons.package(), 'Requested'),
      (PhosphorIcons.magnifyingGlass(), 'Audit'),
      (PhosphorIcons.truck(), 'Dispatch'),
      (PhosphorIcons.checkCircle(), 'Received'),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: List.generate(steps.length * 2 - 1, (i) {
          if (i.isOdd) {
            // Connector line
            final stepIndex = i ~/ 2;
            final done = activeStep > stepIndex;
            return Expanded(
              child: Container(
                height: 2,
                color: done
                    ? AppColors.kSuccess.withValues(alpha: 0.55)
                    : Colors.grey.withValues(alpha: 0.18),
              ),
            );
          }
          final stepIndex = i ~/ 2;
          final isDone = activeStep > stepIndex;
          final isCurrent = activeStep == stepIndex;
          final isRejected = request.isRejected && stepIndex == 1;
          final stepColor = isRejected
              ? AppColors.kError
              : isDone
                  ? AppColors.kSuccess
                  : isCurrent
                      ? AppColors.kWarning
                      : Colors.grey.withValues(alpha: 0.3);
          return Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: stepColor.withValues(alpha: 0.15),
                  border: Border.all(color: stepColor, width: 1.5),
                ),
                child: Icon(
                  isRejected
                      ? PhosphorIcons.x()
                      : isDone
                          ? PhosphorIcons.check()
                          : steps[stepIndex].$1,
                  size: 11,
                  color: stepColor,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                steps[stepIndex].$2,
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w600,
                  color: stepColor,
                ),
              ),
            ],
          );
        }),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Expanded body: items table + actions
// ─────────────────────────────────────────────────────────────────────────────

class _ExpandedBody extends StatelessWidget {
  const _ExpandedBody({
    required this.request,
    required this.filters,
  });

  final StockRequest request;
  final Map<String, String?> filters;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Divider(height: 20),

          // Metadata row
          Wrap(
            spacing: 20,
            runSpacing: 6,
            children: [
              if (request.reviewedByName != null &&
                  request.reviewedByName!.isNotEmpty)
                _MetaChip(
                    icon: PhosphorIcons.userCheck(),
                    label: 'Reviewed by ${request.reviewedByName}'),
              if (request.reviewNotes != null &&
                  request.reviewNotes!.isNotEmpty)
                _MetaChip(
                    icon: PhosphorIcons.note(), label: request.reviewNotes!),
              if (request.auditNotes != null && request.auditNotes!.isNotEmpty)
                _MetaChip(
                    icon: PhosphorIcons.shieldCheck(),
                    label: request.auditNotes!),
            ],
          ),

          // Items table
          const SizedBox(height: 10),
          Table(
            columnWidths: const {
              0: FlexColumnWidth(3),
              1: FlexColumnWidth(2),
              2: FixedColumnWidth(80),
              3: FixedColumnWidth(80),
              4: FixedColumnWidth(90),
            },
            border: TableBorder(
              horizontalInside: BorderSide(
                color: Colors.grey.withValues(alpha: 0.15),
                width: 1,
              ),
            ),
            children: [
              TableRow(
                decoration:
                    BoxDecoration(color: Colors.grey.withValues(alpha: 0.05)),
                children: const [
                  _TH('Item'),
                  _TH('Category'),
                  _TH('Requested'),
                  _TH('Approved'),
                  _TH('Status'),
                ],
              ),
              for (final item in request.items)
                TableRow(
                  children: [
                    _TD(item.itemName),
                    _TD('${item.itemCategory} • ${item.itemUnit}'),
                    _TD('${item.requestedQuantity}'),
                    _TD(item.approvedQuantity > 0
                        ? '${item.approvedQuantity}'
                        : '—'),
                    _TDStatus(item.status),
                  ],
                ),
            ],
          ),

        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Table helpers
// ─────────────────────────────────────────────────────────────────────────────

class _TH extends StatelessWidget {
  const _TH(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
      child: Text(text,
          style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.kTextSecondary)),
    );
  }
}

class _TD extends StatelessWidget {
  const _TD(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
      child: Text(text, style: const TextStyle(fontSize: 12)),
    );
  }
}

class _TDStatus extends StatelessWidget {
  const _TDStatus(this.status);
  final String status;

  @override
  Widget build(BuildContext context) {
    final color = _color(status);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(6)),
        child: Text(
          status.replaceAll('_', ' '),
          style: TextStyle(
              fontSize: 10, fontWeight: FontWeight.w700, color: color),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );
  }

  static Color _color(String s) {
    switch (s.toUpperCase()) {
      case 'APPROVED':
        return AppColors.kSuccess;
      case 'REJECTED':
        return AppColors.kError;
      case 'PENDING_AUDIT':
      case 'PENDING':
        return AppColors.kWarning;
      default:
        return AppColors.kTextSecondary;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Small shared widgets
// ─────────────────────────────────────────────────────────────────────────────

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(label,
          style: TextStyle(
              fontSize: 10.5, fontWeight: FontWeight.w700, color: color)),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: AppColors.kTextSecondary),
        const SizedBox(width: 4),
        Text(label,
            style:
                const TextStyle(color: AppColors.kTextSecondary, fontSize: 12)),
      ],
    );
  }
}
