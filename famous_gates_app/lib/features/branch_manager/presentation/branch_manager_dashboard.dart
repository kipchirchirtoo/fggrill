import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

class BranchManagerDashboard extends StatelessWidget {
  const BranchManagerDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Branch Manager Dashboard'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Branch Overview', style: Theme.of(context).textTheme.displaySmall),
            const SizedBox(height: 24),
            _buildQuickStats(),
            const SizedBox(height: 32),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 2, child: _buildRecentActivity()),
                const SizedBox(width: 24),
                Expanded(child: _buildBranchQuickActions()),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickStats() {
    return Row(
      children: [
        _buildStatCard('Today\'s Revenue', 'KES 145,200', PhosphorIcons.money(), AppColors.kSuccess),
        const SizedBox(width: 16),
        _buildStatCard('Active Orders', '12', PhosphorIcons.shoppingCart(), AppColors.kWarning),
        const SizedBox(width: 16),
        _buildStatCard('Occupancy', '85%', PhosphorIcons.bed(), AppColors.kPrimary),
        const SizedBox(width: 16),
        _buildStatCard('Low Stock Items', '5', PhosphorIcons.warning(), AppColors.kError),
      ],
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: color, size: 28),
              const SizedBox(height: 16),
              Text(value, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
              Text(label, style: const TextStyle(color: AppColors.kTextSecondary, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRecentActivity() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Recent Activity', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: 5,
              separatorBuilder: (context, index) => const Divider(),
              itemBuilder: (context, index) {
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const CircleAvatar(backgroundColor: AppColors.kSurface, child: Icon(Icons.history, size: 20)),
                  title: Text('New sale processed by Cashier $index'),
                  subtitle: const Text('10 minutes ago'),
                  trailing: const Text('KES 1,200', style: TextStyle(fontWeight: FontWeight.bold)),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBranchQuickActions() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Quick Actions', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            _buildActionButton('Staff Management', PhosphorIcons.users()),
            _buildActionButton('Inventory Check', PhosphorIcons.package()),
            _buildActionButton('Room Status', PhosphorIcons.bed()),
            _buildActionButton('Generate Shift Report', PhosphorIcons.fileText()),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButton(String label, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: OutlinedButton.icon(
        onPressed: () {},
        icon: Icon(icon, size: 20),
        label: Text(label),
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(double.infinity, 56),
          alignment: Alignment.centerLeft,
        ),
      ),
    );
  }
}
