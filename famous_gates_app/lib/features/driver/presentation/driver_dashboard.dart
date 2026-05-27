import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/widgets/widgets.dart';
import '../domain/providers.dart';

class DriverDashboard extends ConsumerWidget {
  const DriverDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final vehicles = ref.watch(vehiclesProvider);
    return DashboardShell(
      title: 'Driver',
      tabs: [
        DashboardTab(
          label: 'Overview',
          content: vehicles.when(
            data: (rows) => ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: rows.length,
              itemBuilder: (_, i) => Card(
                  child: ListTile(
                leading: const Icon(Icons.local_shipping),
                title: Text(
                    (rows[i]['name'] ?? rows[i]['registration'] ?? 'Vehicle')
                        .toString()),
                subtitle: Text('Type: ${(rows[i]['type'] ?? '').toString()}'),
              )),
            ),
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text('Error: $e')),
          ),
        ),
      ],
    );
  }
}
