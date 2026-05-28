import 'package:flutter/material.dart';
import '../../domain/models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';

import '../../data/repository.dart';

class RoomManagementScreen extends ConsumerStatefulWidget {
  const RoomManagementScreen({super.key});

  @override
  ConsumerState<RoomManagementScreen> createState() => _RoomManagementScreenState();
}

class _RoomManagementScreenState extends ConsumerState<RoomManagementScreen> {
  late final ReceptionRepository _repository;

  List<Room> _rooms = [];
  List<Room> _filteredRooms = [];
  bool _isLoading = false;
  String _filterStatus = 'all';
  String _filterType = 'all';

  @override
  void initState() {
    _repository = ref.read(receptionRepositoryProvider);
    super.initState();
    _loadRooms();
  }

  Future<void> _loadRooms() async {
    setState(() => _isLoading = true);
    try {
      final rooms = await _repository.getRooms();
      setState(() {
        _rooms = rooms;
        _applyFilters();
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load rooms: $e')),
        );
      }
    }
  }

  void _applyFilters() {
    var filtered = _rooms;

    if (_filterStatus != 'all') {
      filtered = filtered.where((r) => r.status == _filterStatus).toList();
    }

    if (_filterType != 'all') {
      filtered = filtered.where((r) => r.type == _filterType).toList();
    }

    setState(() => _filteredRooms = filtered);
  }

  Future<void> _updateRoomStatus(Room room, String newStatus) async {
    try {
      await _repository.updateRoomStatus(room.id, newStatus);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Room ${room.number} status updated to $newStatus'),
            backgroundColor: Colors.green,
          ),
        );
        _loadRooms();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update room status: $e')),
        );
      }
    }
  }

  Future<void> _showRoomDetails(Room room) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.5,
        maxChildSize: 0.9,
        builder: (context, scrollController) => _RoomDetailsSheet(
          room: room,
          scrollController: scrollController,
          onStatusChange: (status) => _updateRoomStatus(room, status),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final statusCounts = {
      'available': _rooms.where((r) => r.status == 'available').length,
      'occupied': _rooms.where((r) => r.status == 'occupied').length,
      'cleaning': _rooms.where((r) => r.status == 'cleaning').length,
      'maintenance': _rooms.where((r) => r.status == 'maintenance').length,
      'blocked': _rooms.where((r) => r.status == 'blocked').length,
    };

    return Scaffold(
      appBar: AppBar(
        title: const Text('Room Management'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          // Status Overview
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.grey.shade100,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _statusBadge('Available', statusCounts['available']!, Colors.green),
                _statusBadge('Occupied', statusCounts['occupied']!, Colors.blue),
                _statusBadge('Cleaning', statusCounts['cleaning']!, Colors.orange),
                _statusBadge('Maintenance', statusCounts['maintenance']!, Colors.red),
              ],
            ),
          ),

          // Filters
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                const Text('Filter by Status', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _filterChip('All', 'all', isStatus: true),
                      _filterChip('Available', 'available', isStatus: true),
                      _filterChip('Occupied', 'occupied', isStatus: true),
                      _filterChip('Cleaning', 'cleaning', isStatus: true),
                      _filterChip('Maintenance', 'maintenance', isStatus: true),
                      _filterChip('Blocked', 'blocked', isStatus: true),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Room Grid
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _filteredRooms.isEmpty
                    ? const Center(child: Text('No rooms found'))
                    : RefreshIndicator(
                        onRefresh: _loadRooms,
                        child: GridView.builder(
                          padding: const EdgeInsets.all(16),
                          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            crossAxisSpacing: 12,
                            mainAxisSpacing: 12,
                            childAspectRatio: 1.2,
                          ),
                          itemCount: _filteredRooms.length,
                          itemBuilder: (context, index) {
                            final room = _filteredRooms[index];
                            return _RoomCard(
                              room: room,
                              onTap: () => _showRoomDetails(room),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _statusBadge(String label, int count, Color color) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            '$count',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }

  Widget _filterChip(String label, String value, {required bool isStatus}) {
    final isSelected = isStatus ? _filterStatus == value : _filterType == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (_) {
          setState(() {
            if (isStatus) {
              _filterStatus = value;
            } else {
              _filterType = value;
            }
            _applyFilters();
          });
        },
        selectedColor: AppColors.kPrimary.withValues(alpha: 0.2),
      ),
    );
  }
}

class _RoomCard extends StatelessWidget {
  final Room room;
  final VoidCallback onTap;

  const _RoomCard({required this.room, required this.onTap});

  Color _getStatusColor() {
    switch (room.status) {
      case 'available':
        return Colors.green;
      case 'occupied':
        return Colors.blue;
      case 'cleaning':
        return Colors.orange;
      case 'maintenance':
        return Colors.red;
      case 'blocked':
        return Colors.grey;
      default:
        return Colors.grey;
    }
  }

  IconData _getStatusIcon() {
    switch (room.status) {
      case 'available':
        return Icons.check_circle;
      case 'occupied':
        return Icons.person;
      case 'cleaning':
        return Icons.cleaning_services;
      case 'maintenance':
        return Icons.build;
      case 'blocked':
        return Icons.block;
      default:
        return Icons.help;
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _getStatusColor();

    return Card(
      elevation: 2,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            border: Border.all(color: statusColor, width: 2),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${room.number}',
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  Icon(_getStatusIcon(), color: statusColor),
                ],
              ),
              const Spacer(),
              Text(room.type ?? 'Room', style: const TextStyle(fontSize: 12, color: Colors.grey)),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  room.status.toUpperCase(),
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: statusColor),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoomDetailsSheet extends StatelessWidget {
  final Room room;
  final ScrollController scrollController;
  final Function(String) onStatusChange;

  const _RoomDetailsSheet({
    required this.room,
    required this.scrollController,
    required this.onStatusChange,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      child: ListView(
        controller: scrollController,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Room ${room.number}',
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
          const Divider(),
          _infoRow('Room Type', room.type ?? '-'),
          _infoRow('Floor', '${room.floor ?? "-"}'),
          _infoRow('Status', room.status.toUpperCase()),
          _infoRow('Price', 'KES ${room.pricePerNight ?? 0}/night'),
          _infoRow('Max Occupancy', '${room.maxOccupancy ?? "-"} guests'),
          if (room.isClean != null) _infoRow('Clean Status', room.isClean! ? 'Clean' : 'Needs Cleaning'),
          const Divider(),
          const Text('Change Status', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _statusButton(context, 'Available', 'available', Colors.green),
              _statusButton(context, 'Occupied', 'occupied', Colors.blue),
              _statusButton(context, 'Cleaning', 'cleaning', Colors.orange),
              _statusButton(context, 'Maintenance', 'maintenance', Colors.red),
              _statusButton(context, 'Blocked', 'blocked', Colors.grey),
            ],
          ),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _statusButton(BuildContext context, String label, String status, Color color) {
    final isCurrent = room.status == status;
    return ElevatedButton(
      onPressed: isCurrent
          ? null
          : () {
              onStatusChange(status);
              Navigator.of(context).pop();
            },
      style: ElevatedButton.styleFrom(
        backgroundColor: isCurrent ? color.withValues(alpha: 0.5) : color,
        foregroundColor: Colors.white,
      ),
      child: Text(label),
    );
  }
}
