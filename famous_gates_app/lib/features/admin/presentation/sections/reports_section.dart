import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/admin_providers.dart';

final _reportGenerationProvider = StateProvider<bool>((ref) => false);

class _ReportCard {
  final String title;
  final IconData icon;
  final String description;
  final String key;

  const _ReportCard({
    required this.title,
    required this.icon,
    required this.description,
    required this.key,
  });
}

final _reportCards = [
  _ReportCard(
      title: 'Daily Sales',
      icon: PhosphorIcons.trendUp(),
      description: 'Detailed daily sales across all outlets',
      key: 'daily_sales'),
  _ReportCard(
      title: 'Monthly Summary',
      icon: PhosphorIcons.calendar(),
      description: 'Monthly revenue, expenses, and profit',
      key: 'monthly_summary'),
  _ReportCard(
      title: 'Financial Statement',
      icon: PhosphorIcons.chartBar(),
      description: 'Comprehensive financial overview',
      key: 'financial_statement'),
  _ReportCard(
      title: 'Occupancy Analysis',
      icon: PhosphorIcons.building(),
      description: 'Room occupancy trends and metrics',
      key: 'occupancy'),
  _ReportCard(
      title: 'Inventory Valuation',
      icon: PhosphorIcons.package(),
      description: 'Current stock value and turnover',
      key: 'inventory_valuation'),
  _ReportCard(
      title: 'Staff Performance',
      icon: PhosphorIcons.users(),
      description: 'Staff productivity and attendance',
      key: 'staff_performance'),
  _ReportCard(
      title: 'Audit Summary',
      icon: PhosphorIcons.shield(),
      description: 'Audit trail and security events',
      key: 'audit_summary'),
  _ReportCard(
      title: 'Revenue by Outlet',
      icon: PhosphorIcons.chartPie(),
      description: 'Revenue breakdown by department',
      key: 'revenue_by_outlet'),
];

class ReportsSection extends ConsumerStatefulWidget {
  const ReportsSection({super.key});

  @override
  ConsumerState<ReportsSection> createState() => _ReportsSectionState();
}

class _ReportsSectionState extends ConsumerState<ReportsSection> {
  DateTime? _dateFrom;
  DateTime? _dateTo;

  @override
  Widget build(BuildContext context) {
    final branchesAsync = ref.watch(adminBranchesProvider);
    final isGenerating = ref.watch(_reportGenerationProvider);

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: AppColors.kDivider)),
          ),
          child: Row(
            children: [
              Icon(PhosphorIcons.buildings(),
                  size: 18, color: AppColors.kTextSecondary),
              const SizedBox(width: 8),
              const Text('Branch:',
                  style:
                      TextStyle(color: AppColors.kTextSecondary, fontSize: 14)),
              const SizedBox(width: 12),
              SizedBox(
                width: 180,
                child: branchesAsync.when(
                  data: (branches) => DropdownButtonHideUnderline(
                    child: DropdownButton<String?>(
                      value: ref.watch(adminSelectedBranchProvider),
                      hint: const Text('All Branches'),
                      isDense: true,
                      items: [
                        const DropdownMenuItem(
                            value: null, child: Text('All Branches')),
                        ...branches.map((b) =>
                            DropdownMenuItem(value: b.id, child: Text(b.name))),
                      ],
                      onChanged: (v) => ref
                          .read(adminSelectedBranchProvider.notifier)
                          .state = v,
                    ),
                  ),
                  loading: () => const SizedBox(width: 100),
                  error: (_, __) => const SizedBox(width: 100),
                ),
              ),
              const SizedBox(width: 24),
              _DateRangePicker(
                label: 'From',
                date: _dateFrom,
                onChanged: (d) => setState(() => _dateFrom = d),
              ),
              const SizedBox(width: 12),
              _DateRangePicker(
                label: 'To',
                date: _dateTo,
                onChanged: (d) => setState(() => _dateTo = d),
              ),
            ],
          ),
        ),
        Expanded(
          child: isGenerating
              ? const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircularProgressIndicator(),
                      SizedBox(height: 16),
                      Text('Generating report...',
                          style: TextStyle(color: AppColors.kTextSecondary)),
                    ],
                  ),
                )
              : GridView.builder(
                  padding: const EdgeInsets.all(24),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 4,
                    crossAxisSpacing: 16,
                    mainAxisSpacing: 16,
                    childAspectRatio: 1.3,
                  ),
                  itemCount: _reportCards.length,
                  itemBuilder: (context, index) {
                    final card = _reportCards[index];
                    return _ReportExportCard(
                        card: card, onExport: () => _exportReport(card));
                  },
                ),
        ),
      ],
    );
  }

  Future<void> _exportReport(_ReportCard card) async {
    if (_dateFrom == null || _dateTo == null) {
      final range = await showDateRangePicker(
        context: context,
        firstDate: DateTime(2020),
        lastDate: DateTime.now(),
        initialDateRange: _dateFrom != null && _dateTo != null
            ? DateTimeRange(start: _dateFrom!, end: _dateTo!)
            : DateTimeRange(
                start: DateTime.now().subtract(const Duration(days: 30)),
                end: DateTime.now()),
      );
      if (range == null) return;
      setState(() {
        _dateFrom = range.start;
        _dateTo = range.end;
      });
    }

    ref.read(_reportGenerationProvider.notifier).state = true;

    await Future.delayed(const Duration(seconds: 2));

    if (mounted) {
      ref.read(_reportGenerationProvider.notifier).state = false;
      AppNotifier.showSnackBar(
        context,
        SnackBar(
          content: Text('${card.title} report generated'),
          backgroundColor: AppColors.kSuccess,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }
}

class _DateRangePicker extends StatelessWidget {
  final String label;
  final DateTime? date;
  final ValueChanged<DateTime?> onChanged;

  const _DateRangePicker(
      {required this.label, required this.date, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () async {
        final picked = await showDatePicker(
            context: context,
            initialDate: date ?? DateTime.now(),
            firstDate: DateTime(2020),
            lastDate: DateTime.now());
        if (picked != null) onChanged(picked);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.kDivider),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label,
                style: const TextStyle(
                    color: AppColors.kTextSecondary, fontSize: 12)),
            const SizedBox(width: 8),
            Icon(PhosphorIcons.calendarBlank(),
                size: 14, color: AppColors.kTextSecondary),
            const SizedBox(width: 4),
            Text(
                date != null
                    ? '${date!.day}/${date!.month}/${date!.year}'
                    : 'Select',
                style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

class _ReportExportCard extends StatelessWidget {
  final _ReportCard card;
  final VoidCallback onExport;

  const _ReportExportCard({required this.card, required this.onExport});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.kPrimary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(card.icon, color: AppColors.kPrimary, size: 22),
            ),
            const SizedBox(height: 4),
            Text(card.title,
                style:
                    const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
            const SizedBox(height: 4),
            Text(card.description,
                style: const TextStyle(
                    color: AppColors.kTextSecondary, fontSize: 12),
                maxLines: 2,
                overflow: TextOverflow.ellipsis),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              height: 34,
              child: OutlinedButton.icon(
                onPressed: onExport,
                icon: Icon(PhosphorIcons.fileText(), size: 16),
                label: const Text('Export PDF', style: TextStyle(fontSize: 12)),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.kPrimary,
                  side: const BorderSide(color: AppColors.kPrimary),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
