import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/widgets.dart';
import '../domain/providers.dart';
import '../data/repository.dart';

class ReportsDashboard extends ConsumerWidget {
  const ReportsDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reportsAsync = ref.watch(reportsListProvider);

    return DashboardShell(
      title: 'Reports & Analytics',
      tabs: [
        DashboardTab(
            label: 'Reports',
            content: SingleChildScrollView(
              padding: const EdgeInsets.all(32),
              child: reportsAsync.when(
                data: (reports) {
                  if (reports.isNotEmpty) {
                    return GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 3,
                        crossAxisSpacing: 24,
                        mainAxisSpacing: 24,
                        childAspectRatio: 1.3,
                      ),
                      itemCount: reports.length,
                      itemBuilder: (context, index) => _ReportCard(
                        report: reports[index],
                        onExport: () =>
                            _exportReport(context, ref, reports[index]),
                      ),
                    );
                  }
                  return _buildDefaultGrid(context, ref);
                },
                loading: () => GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    crossAxisSpacing: 24,
                    mainAxisSpacing: 24,
                    childAspectRatio: 1.3,
                  ),
                  itemCount: 6,
                  itemBuilder: (context, index) =>
                      const LoadingSkeleton(type: SkeletonType.card),
                ),
                error: (e, _) => ErrorState(
                    message: '$e',
                    onRetry: () => ref.refresh(reportsListProvider)),
              ),
            ))
      ],
    );
  }

  Widget _buildDefaultGrid(BuildContext context, WidgetRef ref) {
    final reports = [
      _ReportInfo(
          'Daily Sales Report',
          'Detailed breakdown of all sales today.',
          PhosphorIcons.money(),
          'daily-sales'),
      _ReportInfo(
          'Inventory Level Report',
          'Stock status and low stock alerts.',
          PhosphorIcons.package(),
          'inventory'),
      _ReportInfo('Staff Performance', 'Order volume and revenue per waiter.',
          PhosphorIcons.users(), 'staff-performance'),
      _ReportInfo('Occupancy Analysis', 'Room booking trends and vacancy.',
          PhosphorIcons.bed(), 'occupancy'),
      _ReportInfo('End of Day (Z-Report)', 'Consolidated financial summary.',
          PhosphorIcons.fileText(), 'z-report'),
      _ReportInfo('Expense Audit', 'Track expenditure and procurement.',
          PhosphorIcons.coins(), 'expense-audit'),
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 24,
        mainAxisSpacing: 24,
        childAspectRatio: 1.3,
      ),
      itemCount: reports.length,
      itemBuilder: (context, index) => _DefaultReportCard(
        info: reports[index],
        onExport: () => _exportReportType(context, ref, reports[index].type),
      ),
    );
  }

  Future<void> _exportReport(
      BuildContext context, WidgetRef ref, dynamic report) async {
    await _generateReport(
        context,
        ref,
        report.type ?? report.name.toLowerCase().replaceAll(' ', '-'),
        report.name);
  }

  Future<void> _exportReportType(
      BuildContext context, WidgetRef ref, String type) async {
    await _generateReport(
        context, ref, type, type.replaceAll('-', ' ').replaceAll('_', ' '));
  }

  Future<void> _generateReport(BuildContext context, WidgetRef ref, String type,
      String displayName) async {
    final repo = ref.read(reportsRepositoryProvider);
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _ReportJobDialog(
          repo: repo, reportType: type, displayName: displayName),
    );
  }
}

class _ReportInfo {
  final String title;
  final String desc;
  final IconData icon;
  final String type;

  const _ReportInfo(this.title, this.desc, this.icon, this.type);
}

class _ReportCard extends StatelessWidget {
  final dynamic report;
  final VoidCallback onExport;

  const _ReportCard({required this.report, required this.onExport});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onExport,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.kSurface,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(PhosphorIcons.fileText(),
                    color: AppColors.kPrimary, size: 32),
              ),
              const SizedBox(height: 24),
              Text(report.name,
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text(report.description,
                  style: const TextStyle(
                      color: AppColors.kTextSecondary, fontSize: 13)),
              const Spacer(),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton.icon(
                    onPressed: onExport,
                    icon: const Icon(Icons.picture_as_pdf, size: 16),
                    label: const Text('Export PDF'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DefaultReportCard extends StatelessWidget {
  final _ReportInfo info;
  final VoidCallback onExport;

  const _DefaultReportCard({required this.info, required this.onExport});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onExport,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.kSurface,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(info.icon, color: AppColors.kPrimary, size: 32),
              ),
              const SizedBox(height: 24),
              Text(info.title,
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text(info.desc,
                  style: const TextStyle(
                      color: AppColors.kTextSecondary, fontSize: 13)),
              const Spacer(),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton.icon(
                    onPressed: onExport,
                    icon: const Icon(Icons.picture_as_pdf, size: 16),
                    label: const Text('Export PDF'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReportJobDialog extends StatefulWidget {
  final ReportsRepository repo;
  final String reportType;
  final String displayName;
  const _ReportJobDialog(
      {required this.repo,
      required this.reportType,
      required this.displayName});

  @override
  State<_ReportJobDialog> createState() => _ReportJobDialogState();
}

class _ReportJobDialogState extends State<_ReportJobDialog> {
  String _status = 'pending';
  String? _resultUrl;
  String? _error;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    if (_started) return;
    _started = true;
    try {
      setState(() => _status = 'processing');
      final url =
          await widget.repo.generateBrandedPdfAndWait(widget.reportType);
      if (mounted) {
        setState(() {
          _status = 'completed';
          _resultUrl = url;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _status = 'failed';
          _error = '$e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Generating: ${widget.displayName}'),
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_status == 'processing') ...[
              const CircularProgressIndicator(),
              const SizedBox(height: 16),
              const Text('Generating branded PDF, please wait...',
                  textAlign: TextAlign.center),
            ] else if (_status == 'completed') ...[
              const Icon(Icons.check_circle,
                  color: AppColors.kSuccess, size: 48),
              const SizedBox(height: 12),
              const Text('Report ready!',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              if (_resultUrl != null) ...[
                const SizedBox(height: 8),
                Text(_resultUrl!,
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.kTextSecondary)),
              ],
            ] else if (_status == 'failed') ...[
              const Icon(Icons.error, color: AppColors.kError, size: 48),
              const SizedBox(height: 12),
              Text('Failed: ${_error ?? 'Unknown error'}',
                  style: const TextStyle(color: AppColors.kError),
                  textAlign: TextAlign.center),
            ],
          ],
        ),
      ),
      actions: [
        if (_status != 'processing')
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Close')),
        if (_status == 'completed' && _resultUrl != null)
          ElevatedButton.icon(
            onPressed: () async {
              final uri = Uri.tryParse(_resultUrl!);
              if (uri != null && await canLaunchUrl(uri)) await launchUrl(uri);
            },
            icon: const Icon(Icons.download, size: 16),
            label: const Text('Open PDF'),
          ),
        if (_status == 'failed')
          ElevatedButton.icon(
            onPressed: () {
              setState(() {
                _started = false;
                _error = null;
              });
              _start();
            },
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Retry'),
          ),
      ],
    );
  }
}
