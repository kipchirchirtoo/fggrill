import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

class MaintenanceDashboard extends StatelessWidget {
  const MaintenanceDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Maintenance & Work Orders'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Row(
              children: [
                _buildSummaryCard('Open Orders', '8', AppColors.kError),
                const SizedBox(width: 16),
                _buildSummaryCard('In Progress', '3', AppColors.kWarning),
                const SizedBox(width: 16),
                _buildSummaryCard('Completed Today', '12', AppColors.kSuccess),
              ],
            ),
            const SizedBox(height: 32),
            Expanded(
              child: Card(
                child: ListView.separated(
                  itemCount: 10,
                  separatorBuilder: (context, index) => const Divider(),
                  itemBuilder: (context, index) {
                    return ListTile(
                      leading: Icon(PhosphorIcons.wrench(), color: AppColors.kTextSecondary),
                      title: Text('Fix broken tap in Room ${101 + index}'),
                      subtitle: const Text('Requested by: Housekeeping • Priority: HIGH'),
                      trailing: _buildStatusBadge('Open', AppColors.kError),
                      onTap: () {},
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {},
        label: const Text('New Work Order'),
        icon: const Icon(Icons.add),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
      ),
    );
  }

  Widget _buildSummaryCard(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border(bottom: BorderSide(color: color, width: 4)),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10)],
        ),
        child: Column(
          children: [
            Text(value, style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: color)),
            Text(label, style: const TextStyle(color: AppColors.kTextSecondary, fontSize: 12)),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBadge(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color),
      ),
      child: Text(label, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold)),
    );
  }
}
