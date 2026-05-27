import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../domain/admin_providers.dart';
import '../widgets/admin_table.dart';
import '../widgets/admin_dialogs.dart';
import 'package:famous_gates_app/features/admin/data/admin_repository.dart';

class VehiclesSection extends ConsumerStatefulWidget {
  const VehiclesSection({super.key});

  @override
  ConsumerState<VehiclesSection> createState() => _VehiclesSectionState();
}

class _VehiclesSectionState extends ConsumerState<VehiclesSection> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final vehiclesAsync = ref.watch(adminVehiclesProvider);

    return vehiclesAsync.when(
      loading: () => const LoadingSkeleton(type: SkeletonType.table),
      error: (err, _) => ErrorState(
        message: '$err',
        onRetry: () => ref.invalidate(adminVehiclesProvider),
      ),
      data: (vehicles) {
        final filtered = _searchController.text.isEmpty
            ? vehicles
            : vehicles
                .where((v) =>
                    v.registration
                        .toLowerCase()
                        .contains(_searchController.text.toLowerCase()) ||
                    v.make
                        .toLowerCase()
                        .contains(_searchController.text.toLowerCase()) ||
                    v.model
                        .toLowerCase()
                        .contains(_searchController.text.toLowerCase()))
                .toList();

        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(adminVehiclesProvider),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Vehicle Management',
                  style: Theme.of(context).textTheme.displaySmall,
                ),
                const SizedBox(height: 20),
                _buildHeaderRow(),
                const SizedBox(height: 20),
                if (filtered.isEmpty)
                  EmptyState(
                    message: 'No vehicles found',
                    icon: PhosphorIcons.truck(),
                    actionLabel: 'Add Vehicle',
                    onAction: () => showVehicleDialog(context),
                  )
                else
                  _buildVehiclesTable(filtered),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildHeaderRow() {
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search vehicles...',
              prefixIcon: Icon(PhosphorIcons.magnifyingGlass(), size: 20),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
            onChanged: (_) => setState(() {}),
          ),
        ),
        const SizedBox(width: 16),
        ElevatedButton.icon(
          onPressed: () => showVehicleDialog(context),
          icon: Icon(PhosphorIcons.plus(), size: 20),
          label: const Text('Add Vehicle'),
          style: ElevatedButton.styleFrom(
            minimumSize: const Size(0, 40),
            padding: const EdgeInsets.symmetric(horizontal: 16),
          ),
        ),
      ],
    );
  }

  Widget _buildVehiclesTable(List<dynamic> vehicles) {
    return AdminTable(
      columns: const [
        'Registration',
        'Make',
        'Model',
        'Driver',
        'Status',
        'Insurance Expiry',
        'Next Service',
        ''
      ],
      rows: vehicles.map<List<Widget>>((v) {
        final insuranceStr = v.insuranceExpiry != null
            ? '${v.insuranceExpiry!.day}/${v.insuranceExpiry!.month}/${v.insuranceExpiry!.year}'
            : 'N/A';
        final serviceStr = v.nextService != null
            ? '${v.nextService!.day}/${v.nextService!.month}/${v.nextService!.year}'
            : 'N/A';

        Color statusColor;
        switch (v.status) {
          case 'Available':
            statusColor = AppColors.kSuccess;
            break;
          case 'In Use':
            statusColor = AppColors.kPrimary;
            break;
          case 'Maintenance':
            statusColor = AppColors.kWarning;
            break;
          default:
            statusColor = AppColors.kTextSecondary;
        }

        return [
          Text(
            v.registration,
            style: const TextStyle(
                fontWeight: FontWeight.w600, color: AppColors.kPrimary),
          ),
          Text(v.make),
          Text(v.model),
          Text(v.driverName.isEmpty ? 'Unassigned' : v.driverName),
          StatusBadge(status: v.status, color: statusColor),
          Text(insuranceStr),
          Text(serviceStr),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                icon: Icon(PhosphorIcons.pencilLine(), size: 18),
                onPressed: () => showVehicleDialog(context, vehicle: v),
                tooltip: 'Edit',
              ),
              IconButton(
                icon: Icon(PhosphorIcons.prohibit(),
                    size: 18, color: AppColors.kError),
                onPressed: () => _confirmDelete(context, v),
                tooltip: 'Delete',
              ),
            ],
          ),
        ];
      }).toList(),
      hasActions: true,
    );
  }

  void _confirmDelete(BuildContext context, dynamic vehicle) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Vehicle'),
        content:
            Text('Are you sure you want to delete "${vehicle.registration}"?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref.read(adminRepositoryProvider).deleteVehicle(vehicle.id);
              ref.invalidate(adminVehiclesProvider);
              AppNotifier.showSnackBar(
                context,
                const SnackBar(content: Text('Vehicle deleted')),
              );
            },
            child:
                const Text('Delete', style: TextStyle(color: AppColors.kError)),
          ),
        ],
      ),
    );
  }
}
