import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

class ReportsDashboard extends StatelessWidget {
  const ReportsDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reports & Analytics'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
      ),
      body: GridView.count(
        padding: const EdgeInsets.all(32),
        crossAxisCount: 3,
        crossAxisSpacing: 24,
        mainAxisSpacing: 24,
        children: [
          _buildReportCard(context, 'Daily Sales Report', 'Detailed breakdown of all sales today.', PhosphorIcons.money()),
          _buildReportCard(context, 'Inventory Level Report', 'Stock status and low stock alerts.', PhosphorIcons.package()),
          _buildReportCard(context, 'Staff Performance', 'Order volume and revenue per waiter.', PhosphorIcons.users()),
          _buildReportCard(context, 'Occupancy Analysis', 'Room booking trends and vacancy.', PhosphorIcons.bed()),
          _buildReportCard(context, 'End of Day (Z-Report)', 'Consolidated financial summary.', PhosphorIcons.fileText()),
          _buildReportCard(context, 'Expense Audit', 'Track expenditure and procurement.', PhosphorIcons.coins()),
        ],
      ),
    );
  }

  Widget _buildReportCard(BuildContext context, String title, String desc, IconData icon) {
    return Card(
      child: InkWell(
        onTap: () {},
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppColors.kSurface, borderRadius: BorderRadius.circular(12)),
                child: Icon(icon, color: AppColors.kPrimary, size: 32),
              ),
              const SizedBox(height: 24),
              Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text(desc, style: const TextStyle(color: AppColors.kTextSecondary, fontSize: 13)),
              const Spacer(),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton.icon(
                    onPressed: () {},
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
