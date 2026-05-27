import 'package:flutter/material.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../core/theme/app_theme.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

class InventoryDashboard extends StatelessWidget {
  const InventoryDashboard({super.key, required this.isCentral});

  final bool isCentral;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(isCentral ? 'Central Inventory' : 'Branch Inventory'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _buildInventoryStat(
                    'Total Items', '1,240', PhosphorIcons.package()),
                const SizedBox(width: 16),
                _buildInventoryStat('Low Stock', '12', PhosphorIcons.warning(),
                    AppColors.kError),
                const SizedBox(width: 16),
                _buildInventoryStat('Pending Requests', '4',
                    PhosphorIcons.gitPullRequest(), AppColors.kWarning),
                const SizedBox(width: 16),
                _buildInventoryStat('In Transit', '2', PhosphorIcons.truck(),
                    AppColors.kPrimary),
              ],
            ),
            const SizedBox(height: 32),
            Expanded(
              child: Card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(24),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.start,
                        children: [
                          const Text('Inventory List',
                              style: TextStyle(
                                  fontSize: 18, fontWeight: FontWeight.bold)),
                          const Spacer(),
                          SizedBox(
                            width: 300,
                            child: TextField(
                              decoration: InputDecoration(
                                hintText: 'Search items...',
                                prefixIcon:
                                    Icon(PhosphorIcons.magnifyingGlass()),
                                contentPadding: EdgeInsets.zero,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: ListView.separated(
                        itemCount: 10,
                        separatorBuilder: (context, index) => const Divider(),
                        itemBuilder: (context, index) {
                          return ListTile(
                            leading: const CircleAvatar(
                                child: Icon(Icons.inventory_2)),
                            title: Text('Item Name $index'),
                            subtitle: const Text('Category: General'),
                            trailing: const Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text('Stock: 45',
                                    style:
                                        TextStyle(fontWeight: FontWeight.bold)),
                                Text('Unit: PCS',
                                    style: TextStyle(
                                        color: AppColors.kTextSecondary,
                                        fontSize: 10)),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => AppNotifier.showSnackBar(
          context,
          SnackBar(
              content: Text(isCentral
                  ? 'Add new item — use admin panel'
                  : 'Create stock request — use admin panel')),
        ),
        label: Text(isCentral ? 'Add New Item' : 'Create Stock Request'),
        icon: const Icon(Icons.add),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
      ),
    );
  }

  Widget _buildInventoryStat(String label, String value, IconData icon,
      [Color? color]) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.kDivider),
        ),
        child: Row(
          children: [
            Icon(icon, color: color ?? AppColors.kPrimary, size: 28),
            const SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value,
                    style: const TextStyle(
                        fontSize: 20, fontWeight: FontWeight.bold)),
                Text(label,
                    style: const TextStyle(
                        color: AppColors.kTextSecondary, fontSize: 11)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
