import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

class HRDashboard extends StatelessWidget {
  const HRDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Human Resources'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
      ),
      body: Row(
        children: [
          _buildHRNav(context),
          Expanded(child: _buildHRContent(context)),
        ],
      ),
    );
  }

  Widget _buildHRNav(BuildContext context) {
    return Container(
      width: 200,
      color: Colors.white,
      decoration: const BoxDecoration(
        border: Border(right: BorderSide(color: AppColors.kDivider)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 16),
          _buildNavItem('Staff Directory', PhosphorIcons.users(), true),
          _buildNavItem('Attendance', PhosphorIcons.clock()),
          _buildNavItem('Leave Requests', PhosphorIcons.calendar()),
          _buildNavItem('Payroll', PhosphorIcons.bank()),
          _buildNavItem('Performance', PhosphorIcons.chartBar()),
        ],
      ),
    );
  }

  Widget _buildNavItem(String label, IconData icon, [bool isSelected = false]) {
    return ListTile(
      leading: Icon(icon, size: 20, color: isSelected ? AppColors.kPrimary : AppColors.kTextSecondary),
      title: Text(label, style: TextStyle(
        fontSize: 13,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        color: isSelected ? AppColors.kPrimary : AppColors.kTextPrimary,
      )),
      selected: isSelected,
      onTap: () {},
    );
  }

  Widget _buildHRContent(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.start,
            children: [
              Text('Staff Directory', style: Theme.of(context).textTheme.displaySmall),
              const Spacer(),
              ElevatedButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.person_add),
                label: const Text('Add Staff'),
              ),
            ],
          ),
          const SizedBox(height: 32),
          Expanded(
            child: Card(
              child: ListView.separated(
                itemCount: 15,
                separatorBuilder: (context, index) => const Divider(),
                itemBuilder: (context, index) {
                  return ListTile(
                    leading: const CircleAvatar(child: Icon(Icons.person)),
                    title: Text('Staff Member $index'),
                    subtitle: const Text('Role: Receptionist • Branch: HQ'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {},
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
