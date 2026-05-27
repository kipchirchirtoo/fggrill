import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../domain/admin_providers.dart';
import '../widgets/stat_card.dart';
import '../widgets/admin_table.dart';

class HousekeepingSection extends ConsumerStatefulWidget {
  const HousekeepingSection({super.key});

  @override
  ConsumerState<HousekeepingSection> createState() =>
      _HousekeepingSectionState();
}

class _HousekeepingSectionState extends ConsumerState<HousekeepingSection> {
  String? _selectedBranchId;

  @override
  Widget build(BuildContext context) {
    final roomsAsync = ref.watch(adminRoomsProvider);
    final branchesAsync = ref.watch(adminBranchesProvider);
    final isMobile = MediaQuery.of(context).size.width < 768;

    return roomsAsync.when(
      loading: () => const LoadingSkeleton(type: SkeletonType.card),
      error: (err, _) => ErrorState(
        message: '$err',
        onRetry: () => ref.invalidate(adminRoomsProvider),
      ),
      data: (rooms) {
        final branches = branchesAsync.valueOrNull ?? [];
        var filteredRooms = rooms;
        if (_selectedBranchId != null) {
          filteredRooms =
              rooms.where((r) => r.branchId == _selectedBranchId).toList();
        }

        final toClean = filteredRooms
            .where((r) => r.status == 'dirty' || r.status == 'occupied')
            .length;
        final cleaningNow =
            filteredRooms.where((r) => r.status == 'cleaning').length;
        final cleanedToday =
            filteredRooms.where((r) => r.status == 'clean').length;
        final inspectionsDue =
            filteredRooms.where((r) => r.status == 'inspected').length;

        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(adminRoomsProvider),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Housekeeping',
                  style: Theme.of(context).textTheme.displaySmall,
                ),
                const SizedBox(height: 20),
                _buildBranchSelector(branches),
                const SizedBox(height: 20),
                _buildStatCards(isMobile, toClean, cleaningNow, cleanedToday,
                    inspectionsDue),
                const SizedBox(height: 24),
                _buildRoomStatusGrid(filteredRooms, isMobile),
                const SizedBox(height: 24),
                _buildTaskList(filteredRooms),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildBranchSelector(List<dynamic> branches) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            Icon(PhosphorIcons.buildings(),
                size: 20, color: AppColors.kTextSecondary),
            const SizedBox(width: 12),
            Expanded(
              child: DropdownButtonFormField<String>(
                initialValue: _selectedBranchId,
                decoration: const InputDecoration(
                  border: InputBorder.none,
                  hintText: 'Select Branch',
                ),
                items: [
                  const DropdownMenuItem(
                      value: null, child: Text('All Branches')),
                  ...branches.map((b) =>
                      DropdownMenuItem(value: b.id, child: Text(b.name))),
                ],
                onChanged: (v) => setState(() => _selectedBranchId = v),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCards(bool isMobile, int toClean, int cleaningNow,
      int cleanedToday, int inspectionsDue) {
    final stats = [
      AdminStatCard(
        label: 'To Clean',
        value: '$toClean',
        icon: PhosphorIcons.checkCircle(),
        color: AppColors.kError,
      ),
      AdminStatCard(
        label: 'Cleaning Now',
        value: '$cleaningNow',
        icon: PhosphorIcons.clockCountdown(),
        color: AppColors.kWarning,
      ),
      AdminStatCard(
        label: 'Cleaned Today',
        value: '$cleanedToday',
        icon: PhosphorIcons.checkCircle(),
        color: AppColors.kSuccess,
      ),
      AdminStatCard(
        label: 'Inspections Due',
        value: '$inspectionsDue',
        icon: PhosphorIcons.magnifyingGlass(),
        color: AppColors.kPrimary,
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = isMobile ? 2 : 4;
        return GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: crossAxisCount,
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            childAspectRatio: isMobile ? 1.6 : 2.4,
          ),
          itemCount: stats.length,
          itemBuilder: (_, i) => stats[i],
        );
      },
    );
  }

  Widget _buildRoomStatusGrid(List<dynamic> rooms, bool isMobile) {
    if (rooms.isEmpty) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Center(
              child: Text('No rooms found',
                  style: TextStyle(color: AppColors.kTextSecondary))),
        ),
      );
    }

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Room Status Overview',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 16),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: isMobile ? 3 : 6,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.2,
              ),
              itemCount: rooms.length > 24 ? 24 : rooms.length,
              itemBuilder: (_, i) => _buildRoomStatusCard(rooms[i]),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRoomStatusCard(dynamic room) {
    Color statusColor;
    String statusLabel;

    switch (room.status) {
      case 'dirty':
        statusColor = AppColors.kError;
        statusLabel = 'Dirty';
        break;
      case 'cleaning':
        statusColor = AppColors.kWarning;
        statusLabel = 'Cleaning';
        break;
      case 'clean':
        statusColor = AppColors.kSuccess;
        statusLabel = 'Clean';
        break;
      case 'inspected':
        statusColor = AppColors.kPrimary;
        statusLabel = 'Inspected';
        break;
      case 'occupied':
        statusColor = AppColors.kAccent;
        statusLabel = 'Occupied';
        break;
      default:
        statusColor = AppColors.kTextSecondary;
        statusLabel = room.status;
    }

    return Container(
      decoration: BoxDecoration(
        color: statusColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: statusColor.withValues(alpha: 0.3)),
      ),
      padding: const EdgeInsets.all(8),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            room.roomNumber,
            style: TextStyle(fontWeight: FontWeight.bold, color: statusColor),
          ),
          const SizedBox(height: 4),
          StatusBadge(status: statusLabel, color: statusColor),
        ],
      ),
    );
  }

  Widget _buildTaskList(List<dynamic> rooms) {
    final tasks = rooms.map((r) {
      String taskType;
      String priority;
      switch (r.status) {
        case 'dirty':
          taskType = 'Full Cleaning';
          priority = 'High';
          break;
        case 'occupied':
          taskType = 'Turn Down Service';
          priority = 'Medium';
          break;
        case 'cleaning':
          taskType = 'In Progress';
          priority = 'Medium';
          break;
        default:
          taskType = 'Inspection';
          priority = 'Low';
      }
      return {
        'room': r.roomNumber,
        'task': taskType,
        'assigned': 'Housekeeping Staff',
        'priority': priority,
        'status': r.status,
      };
    }).toList();

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Today\'s Tasks',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 16),
            if (tasks.isEmpty)
              const Padding(
                padding: EdgeInsets.all(32),
                child: Center(
                    child: Text('No tasks for today',
                        style: TextStyle(color: AppColors.kTextSecondary))),
              )
            else
              AdminTable(
                columns: const [
                  'Room',
                  'Task Type',
                  'Assigned To',
                  'Priority',
                  'Status'
                ],
                rows: tasks.take(10).map((t) {
                  final priorityColor = t['priority'] == 'High'
                      ? AppColors.kError
                      : t['priority'] == 'Medium'
                          ? AppColors.kWarning
                          : AppColors.kSuccess;
                  return [
                    Text(t['room'],
                        style: const TextStyle(fontWeight: FontWeight.w500)),
                    Text(t['task']),
                    Text(t['assigned']),
                    StatusBadge(status: t['priority'], color: priorityColor),
                    StatusBadge(status: t['status']),
                  ];
                }).toList(),
                hasActions: false,
              ),
          ],
        ),
      ),
    );
  }
}
