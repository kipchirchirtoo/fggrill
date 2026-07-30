import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../data/models/room.dart';
import '../../domain/admin_providers.dart';
import '../widgets/admin_table.dart';
import '../widgets/admin_dialogs.dart';
import '../../data/admin_repository.dart';
import 'package:famous_gates_app/features/admin/data/models/branch.dart';

class RoomsSection extends ConsumerStatefulWidget {
  const RoomsSection({super.key});

  @override
  ConsumerState<RoomsSection> createState() => _RoomsSectionState();
}

class _RoomsSectionState extends ConsumerState<RoomsSection> {
  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Rooms & Pricing',
                  style: Theme.of(context).textTheme.displaySmall,
                ),
                FloatingActionButton.extended(
                  onPressed: () {
                    final tabIndex = DefaultTabController.of(context)?.index ?? 0;
                    if (tabIndex == 0) {
                      showRoomDialog(context);
                    } else if (tabIndex == 1) {
                      showRoomStandardDialog(context);
                    } else {
                      showRatePlanDialog(context);
                    }
                  },
                  backgroundColor: AppColors.kPrimary,
                  foregroundColor: Colors.white,
                  icon: Icon(PhosphorIcons.plus()),
                  label: const Text('Add New'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 24),
            child: TabBar(
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              labelColor: AppColors.kPrimary,
              unselectedLabelColor: AppColors.kTextSecondary,
              indicatorColor: AppColors.kPrimary,
              dividerColor: Colors.transparent,
              tabs: [
                Tab(text: 'Physical Rooms'),
                Tab(text: 'Room Standards'),
                Tab(text: 'Rate Plans & Meals'),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Expanded(
            child: TabBarView(
              children: [
                _PhysicalRoomsTab(),
                _RoomStandardsTab(),
                _RatePlansTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PhysicalRoomsTab extends ConsumerStatefulWidget {
  const _PhysicalRoomsTab();
  @override
  ConsumerState<_PhysicalRoomsTab> createState() => _PhysicalRoomsTabState();
}

class _PhysicalRoomsTabState extends ConsumerState<_PhysicalRoomsTab> {
  String? _selectedBranchId;
  String? _selectedType;
  String? _selectedStatus;
  final _searchController = TextEditingController();

  final _statuses = [
    'All',
    'available',
    'occupied',
    'reserved',
    'maintenance',
    'cleaning',
    'dirty',
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final roomsAsync = ref.watch(adminRoomsProvider);
    final branchesAsync = ref.watch(adminBranchesProvider);
    final isMobile = MediaQuery.of(context).size.width < 768;

    return roomsAsync.when(
      loading: () => const LoadingSkeleton(type: SkeletonType.grid),
      error: (err, _) => ErrorState(
        message: err.toString().replaceAll('Exception: ', ''),
        onRetry: () => ref.invalidate(adminRoomsProvider),
      ),
      data: (rooms) {
        final branches = branchesAsync.valueOrNull ?? [];
        final allTypes = rooms
            .map((r) => r.type)
            .where((t) => t.isNotEmpty)
            .toSet()
            .toList()
          ..sort();

        var filtered = List<AdminRoom>.from(rooms);

        if (_selectedBranchId != null && _selectedBranchId!.isNotEmpty) {
          filtered = filtered
              .where((r) => r.branchId == _selectedBranchId)
              .toList();
        }
        if (_selectedType != null && _selectedType != 'All') {
          filtered = filtered.where((r) => r.type == _selectedType).toList();
        }
        if (_selectedStatus != null && _selectedStatus != 'All') {
          filtered =
              filtered.where((r) => r.status == _selectedStatus).toList();
        }
        if (_searchController.text.isNotEmpty) {
          final q = _searchController.text.toLowerCase();
          filtered = filtered
              .where((r) =>
                  r.roomNumber.toLowerCase().contains(q) ||
                  r.type.toLowerCase().contains(q) ||
                  r.branchName.toLowerCase().contains(q) ||
                  r.building.toLowerCase().contains(q))
              .toList();
        }

        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(adminRoomsProvider),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 80),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildFilterBar(branches, allTypes),
                const SizedBox(height: 20),
                if (filtered.isEmpty)
                  EmptyState(
                      message: 'No physical rooms found',
                      icon: Icons.meeting_room)
                else
                  isMobile
                      ? _buildRoomList(filtered)
                      : _buildRoomGrid(filtered),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildFilterBar(List<AdminBranch> branches, List<String> roomTypes) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Wrap(
          spacing: 12,
          runSpacing: 12,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            SizedBox(
              width: 180,
              child: DropdownButtonFormField<String>(
                isExpanded: true,
                initialValue: _selectedBranchId,
                decoration: const InputDecoration(
                  labelText: 'Branch',
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 8),
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
            if (roomTypes.isNotEmpty)
              SizedBox(
                width: 180,
                child: DropdownButtonFormField<String>(
                  isExpanded: true,
                  initialValue: _selectedType,
                  decoration: const InputDecoration(
                    labelText: 'Room Type',
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  items: [
                    const DropdownMenuItem(
                        value: null, child: Text('All Types')),
                    ...roomTypes.map((t) =>
                        DropdownMenuItem(value: t, child: Text(t))),
                  ],
                  onChanged: (v) => setState(() => _selectedType = v),
                ),
              ),
            SizedBox(
              width: 160,
              child: DropdownButtonFormField<String>(
                isExpanded: true,
                initialValue: _selectedStatus,
                decoration: const InputDecoration(
                  labelText: 'Status',
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                items: _statuses
                    .map((s) => DropdownMenuItem(
                        value: s == 'All' ? null : s,
                        child: Text(
                            s == 'All' ? 'All Statuses' : _capitalize(s))))
                    .toList(),
                onChanged: (v) => setState(() => _selectedStatus = v),
              ),
            ),
            SizedBox(
              width: 200,
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Search rooms...',
                  prefixIcon:
                      Icon(PhosphorIcons.magnifyingGlass(), size: 20),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                ),
                onChanged: (_) => setState(() {}),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _capitalize(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

  Widget _buildRoomGrid(List<AdminRoom> rooms) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 16,
        mainAxisSpacing: 16,
        childAspectRatio: 0.82,
      ),
      itemCount: rooms.length,
      itemBuilder: (_, i) => _buildRoomCard(rooms[i]),
    );
  }

  Widget _buildRoomList(List<AdminRoom> rooms) {
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: rooms.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, i) => _buildRoomCard(rooms[i]),
    );
  }

  Widget _buildRoomCard(AdminRoom room) {
    Color statusColor;
    switch (room.status.toLowerCase()) {
      case 'available':
        statusColor = AppColors.kSuccess;
        break;
      case 'occupied':
        statusColor = AppColors.kError;
        break;
      case 'reserved':
        statusColor = Colors.orange;
        break;
      case 'maintenance':
        statusColor = AppColors.kWarning;
        break;
      case 'cleaning':
      case 'dirty':
        statusColor = AppColors.kPrimary;
        break;
      default:
        statusColor = AppColors.kTextSecondary;
    }

    final amenityIcons = {
      'wifi': PhosphorIcons.wifiHigh(),
      'ac': PhosphorIcons.sun(),
      'tv': PhosphorIcons.info(),
      'minibar': PhosphorIcons.wine(),
      'safe': PhosphorIcons.lock(),
      'bathtub': PhosphorIcons.star(),
    };

    final displayPrice = room.price > 0
        ? 'KES ${room.price.toStringAsFixed(0)}/night'
        : 'Rate not set';

    final locationParts = <String>[];
    if (room.branchName.isNotEmpty) locationParts.add(room.branchName);
    if (room.building.isNotEmpty) locationParts.add('Blk ${room.building}');
    if (room.floor > 0) locationParts.add('Fl ${room.floor}');

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: room.isActive
              ? AppColors.kDivider.withValues(alpha: 0.5)
              : Colors.red.withValues(alpha: 0.3),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Room ${room.roomNumber}',
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w600),
                ),
                StatusBadge(status: room.status, color: statusColor),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              room.type.isNotEmpty ? room.type : 'Standard Room',
              style: const TextStyle(
                  color: AppColors.kTextSecondary, fontSize: 13),
            ),
            if (locationParts.isNotEmpty) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(PhosphorIcons.buildings(),
                      size: 13, color: AppColors.kTextSecondary),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      locationParts.join(' · '),
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.kTextSecondary),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(PhosphorIcons.users(),
                    size: 13, color: AppColors.kTextSecondary),
                const SizedBox(width: 4),
                Text('${room.capacity} pax max',
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.kTextSecondary)),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              displayPrice,
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: room.price > 0
                      ? AppColors.kPrimary
                      : AppColors.kTextSecondary),
            ),
            const SizedBox(height: 8),
            if (room.amenities.isNotEmpty)
              Row(
                children: [
                  ...room.amenities.take(4).map((a) {
                    final icon = amenityIcons[a.toLowerCase()] ??
                        PhosphorIcons.star();
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child:
                          Icon(icon, size: 15, color: AppColors.kTextSecondary),
                    );
                  }),
                  if (room.amenities.length > 4)
                    Text('+${room.amenities.length - 4}',
                        style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.kTextSecondary)),
                ],
              ),
            if (!room.isActive)
              Container(
                margin: const EdgeInsets.only(top: 6),
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  'INACTIVE',
                  style: TextStyle(
                      fontSize: 10,
                      color: Colors.red,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.5),
                ),
              ),
            const Spacer(),
            const Divider(),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton.icon(
                  onPressed: () => showRoomDialog(context, room: room),
                  icon: Icon(PhosphorIcons.pencilSimple(), size: 16),
                  label: const Text('Edit'),
                ),
                TextButton.icon(
                  onPressed: () async {
                    final confirm = await showDialog<bool>(
                      context: context,
                      builder: (c) => AlertDialog(
                        title: const Text('Delete Room?'),
                        content: Text('Are you sure you want to delete Room ${room.roomNumber}?'),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
                          TextButton(
                            onPressed: () => Navigator.pop(c, true),
                            style: TextButton.styleFrom(foregroundColor: Colors.red),
                            child: const Text('Delete'),
                          ),
                        ],
                      ),
                    );
                    if (confirm == true) {
                      try {
                        await ref.read(adminRepositoryProvider).deleteRoom(room.id);
                        ref.invalidate(adminRoomsProvider);
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
                        }
                      }
                    }
                  },
                  icon: Icon(PhosphorIcons.trash(), size: 16, color: Colors.red),
                  label: const Text('Delete', style: TextStyle(color: Colors.red)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _RoomStandardsTab extends ConsumerStatefulWidget {
  const _RoomStandardsTab();
  @override
  ConsumerState<_RoomStandardsTab> createState() => _RoomStandardsTabState();
}

class _RoomStandardsTabState extends ConsumerState<_RoomStandardsTab> {
  @override
  Widget build(BuildContext context) {
    final typesAsync = ref.watch(adminRoomTypesProvider);

    return typesAsync.when(
      loading: () => const LoadingSkeleton(type: SkeletonType.list),
      error: (err, _) => ErrorState(
        message: err.toString().replaceAll('Exception: ', ''),
        onRetry: () => ref.invalidate(adminRoomTypesProvider),
      ),
      data: (types) {
        if (types.isEmpty) {
          return EmptyState(
              message: 'No room standards found', icon: PhosphorIcons.bed());
        }
        return ListView.separated(
          padding: const EdgeInsets.all(24),
          itemCount: types.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final type = types[index];
            return Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                    color: AppColors.kDivider.withValues(alpha: 0.5)),
              ),
              child: ListTile(
                title: Text(type.name,
                    style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text('Base Price: KES ${type.basePrice.toStringAsFixed(0)} | Capacity: ${type.capacity} pax\n${type.description}'),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: Icon(PhosphorIcons.pencilSimple(), color: AppColors.kPrimary),
                      onPressed: () => showRoomStandardDialog(context, type: type),
                    ),
                    IconButton(
                      icon: Icon(PhosphorIcons.trash(), color: Colors.red),
                      onPressed: () async {
                        final confirm = await showDialog<bool>(
                          context: context,
                          builder: (c) => AlertDialog(
                            title: const Text('Delete Standard?'),
                            content: Text('Are you sure you want to delete ${type.name}?'),
                            actions: [
                              TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
                              TextButton(
                                onPressed: () => Navigator.pop(c, true),
                                style: TextButton.styleFrom(foregroundColor: Colors.red),
                                child: const Text('Delete'),
                              ),
                            ],
                          ),
                        );
                        if (confirm == true) {
                          try {
                            await ref.read(adminRepositoryProvider).deleteRoomType(type.id);
                            ref.invalidate(adminRoomTypesProvider);
                          } catch (e) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
                            }
                          }
                        }
                      },
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

class _RatePlansTab extends ConsumerStatefulWidget {
  const _RatePlansTab();
  @override
  ConsumerState<_RatePlansTab> createState() => _RatePlansTabState();
}

class _RatePlansTabState extends ConsumerState<_RatePlansTab> {
  @override
  Widget build(BuildContext context) {
    final plansAsync = ref.watch(adminRatePlansProvider);

    return plansAsync.when(
      loading: () => const LoadingSkeleton(type: SkeletonType.list),
      error: (err, _) => ErrorState(
        message: err.toString().replaceAll('Exception: ', ''),
        onRetry: () => ref.invalidate(adminRatePlansProvider),
      ),
      data: (plans) {
        if (plans.isEmpty) {
          return EmptyState(
              message: 'No rate plans found', icon: PhosphorIcons.currencyDollar());
        }
        return ListView.separated(
          padding: const EdgeInsets.all(24),
          itemCount: plans.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final plan = plans[index];
            return Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                    color: AppColors.kDivider.withValues(alpha: 0.5)),
              ),
              child: ListTile(
                title: Text(plan.name,
                    style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text('${plan.rateType} | Multiplier: ${plan.multiplier} | Fixed: KES ${plan.fixedAmount}\n${plan.description}'),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: Icon(PhosphorIcons.pencilSimple(), color: AppColors.kPrimary),
                      onPressed: () => showRatePlanDialog(context, plan: plan),
                    ),
                    IconButton(
                      icon: Icon(PhosphorIcons.trash(), color: Colors.red),
                      onPressed: () async {
                        final confirm = await showDialog<bool>(
                          context: context,
                          builder: (c) => AlertDialog(
                            title: const Text('Delete Rate Plan?'),
                            content: Text('Are you sure you want to delete ${plan.name}?'),
                            actions: [
                              TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
                              TextButton(
                                onPressed: () => Navigator.pop(c, true),
                                style: TextButton.styleFrom(foregroundColor: Colors.red),
                                child: const Text('Delete'),
                              ),
                            ],
                          ),
                        );
                        if (confirm == true) {
                          try {
                            await ref.read(adminRepositoryProvider).deleteRatePlan(plan.id);
                            ref.invalidate(adminRatePlansProvider);
                          } catch (e) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
                            }
                          }
                        }
                      },
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}
