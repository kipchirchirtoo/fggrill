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
import 'package:famous_gates_app/features/admin/data/models/branch.dart';

class RoomsSection extends ConsumerStatefulWidget {
  const RoomsSection({super.key});

  @override
  ConsumerState<RoomsSection> createState() => _RoomsSectionState();
}

class _RoomsSectionState extends ConsumerState<RoomsSection> {
  String? _selectedBranchId;
  String? _selectedType;
  String? _selectedStatus;
  final _searchController = TextEditingController();

  final _roomTypes = [
    'All',
    'Single',
    'Double',
    'Suite',
    'Deluxe',
    'Penthouse'
  ];
  final _statuses = ['All', 'available', 'occupied', 'maintenance', 'cleaning'];

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
        message: '$err',
        onRetry: () => ref.invalidate(adminRoomsProvider),
      ),
      data: (rooms) {
        final branches = branchesAsync.valueOrNull ?? [];
        var filtered = List<AdminRoom>.from(rooms);

        if (_selectedBranchId != null) {
          filtered =
              filtered.where((r) => r.branchId == _selectedBranchId).toList();
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
                  r.type.toLowerCase().contains(q))
              .toList();
        }

        return Stack(
          children: [
            RefreshIndicator(
              onRefresh: () async => ref.invalidate(adminRoomsProvider),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 80),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Rooms',
                      style: Theme.of(context).textTheme.displaySmall,
                    ),
                    const SizedBox(height: 20),
                    _buildFilterBar(branches),
                    const SizedBox(height: 20),
                    if (filtered.isEmpty)
                      EmptyState(
                          message: 'No rooms found',
                          icon: PhosphorIcons.building())
                    else
                      isMobile
                          ? _buildRoomList(filtered)
                          : _buildRoomGrid(filtered),
                  ],
                ),
              ),
            ),
            Positioned(
              bottom: 32,
              right: 32,
              child: FloatingActionButton.extended(
                onPressed: () => showRoomDialog(context),
                backgroundColor: AppColors.kPrimary,
                foregroundColor: Colors.white,
                icon: Icon(PhosphorIcons.plus()),
                label: const Text('Add Room'),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildFilterBar(List<AdminBranch> branches) {
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
            SizedBox(
              width: 150,
              child: DropdownButtonFormField<String>(
                isExpanded: true,
                initialValue: _selectedType,
                decoration: const InputDecoration(
                  labelText: 'Type',
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                items: _roomTypes
                    .map((t) => DropdownMenuItem(
                        value: t == 'All' ? null : t, child: Text(t)))
                    .toList(),
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
                        child: Text(s[0].toUpperCase() + s.substring(1))))
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
                  prefixIcon: Icon(PhosphorIcons.magnifyingGlass(), size: 20),
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

  Widget _buildRoomGrid(List<AdminRoom> rooms) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 16,
        mainAxisSpacing: 16,
        childAspectRatio: 0.85,
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
    switch (room.status) {
      case 'available':
        statusColor = AppColors.kSuccess;
        break;
      case 'occupied':
        statusColor = AppColors.kError;
        break;
      case 'maintenance':
        statusColor = AppColors.kWarning;
        break;
      case 'cleaning':
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
    };

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
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
            const SizedBox(height: 8),
            Text(room.type,
                style: const TextStyle(color: AppColors.kTextSecondary)),
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(PhosphorIcons.buildings(),
                    size: 14, color: AppColors.kTextSecondary),
                const SizedBox(width: 4),
                Text(room.branchName,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.kTextSecondary)),
                const Spacer(),
                Icon(PhosphorIcons.building(),
                    size: 14, color: AppColors.kTextSecondary),
                const SizedBox(width: 4),
                Text('Floor ${room.floor}',
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.kTextSecondary)),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '\$${room.price.toStringAsFixed(0)}/night',
              style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppColors.kPrimary),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                ...room.amenities.take(3).map((a) {
                  final icon = amenityIcons[a.toLowerCase()] ??
                      PhosphorIcons.treeStructure();
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child:
                        Icon(icon, size: 16, color: AppColors.kTextSecondary),
                  );
                }),
                if (room.amenities.length > 3)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Text('+${room.amenities.length - 3}',
                        style: const TextStyle(
                            fontSize: 11, color: AppColors.kTextSecondary)),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
