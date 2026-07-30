import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/repository.dart';

/// Full-screen UI for moving a checked-in guest to a different room.
///
/// Required constructor args:
///  - [bookingId]   – the UUID of the booking to move.
///  - [currentRoom] – display label of the current room (e.g. "FA09").
///  - [guestName]   – guest's full name shown in the header.
///  - [checkIn]     – ISO check-in date string (for available-room query).
///  - [checkOut]    – ISO check-out date string (for available-room query).
class MoveRoomScreen extends ConsumerStatefulWidget {
  const MoveRoomScreen({
    super.key,
    required this.bookingId,
    required this.currentRoom,
    required this.guestName,
    required this.checkIn,
    required this.checkOut,
  });

  final String bookingId;
  final String currentRoom;
  final String guestName;
  final String checkIn;
  final String checkOut;

  @override
  ConsumerState<MoveRoomScreen> createState() => _MoveRoomScreenState();
}

class _MoveRoomScreenState extends ConsumerState<MoveRoomScreen> {
  late final ReceptionRepository _repo;

  List<Map<String, dynamic>> _availableRooms = [];
  Map<String, dynamic>? _selected;
  final _reasonController = TextEditingController();
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _repo = ref.read(receptionRepositoryProvider);
    _fetchRooms();
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _fetchRooms() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rooms = await _repo.getAvailableRooms({
        'check_in_date': widget.checkIn,
        'check_out_date': widget.checkOut,
      });
      setState(() {
        _availableRooms = rooms;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _submit() async {
    if (_selected == null) return;
    setState(() => _submitting = true);
    try {
      await _repo.moveRoom(
        bookingId: widget.bookingId,
        newRoomId: '${_selected!['id']}',
        reason: _reasonController.text.trim().isEmpty
            ? null
            : _reasonController.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Guest moved to room ${_selected!['room_number'] ?? _selected!['number']}',
            ),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.of(context).pop(true); // true = refresh caller
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Move failed: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FA),
      appBar: AppBar(
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Move Room',
                style: TextStyle(fontWeight: FontWeight.bold)),
            Text(
              widget.guestName,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w400),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchRooms,
            tooltip: 'Refresh rooms',
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Header banner ──────────────────────────────────────────
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            decoration: BoxDecoration(
              color: AppColors.kPrimary.withValues(alpha: 0.08),
              border: Border(
                bottom: BorderSide(
                    color: AppColors.kPrimary.withValues(alpha: 0.15)),
              ),
            ),
            child: Row(
              children: [
                _roomBadge(
                  label: 'CURRENT',
                  room: widget.currentRoom,
                  color: Colors.orange,
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Icon(Icons.arrow_forward,
                      color: Colors.grey, size: 28),
                ),
                _roomBadge(
                  label: 'NEW ROOM',
                  room: _selected == null
                      ? '—'
                      : '${_selected!['room_number'] ?? _selected!['number']}',
                  color: _selected == null ? Colors.grey : Colors.green,
                ),
              ],
            ),
          ),

          // ── Room list ──────────────────────────────────────────────
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? _errorWidget()
                    : _availableRooms.isEmpty
                        ? const Center(
                            child: Text(
                              'No available rooms for the selected dates.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Colors.grey),
                            ),
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.all(16),
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: 8),
                            itemCount: _availableRooms.length,
                            itemBuilder: (context, index) {
                              final room = _availableRooms[index];
                              final isSelected =
                                  _selected != null &&
                                  '${_selected!['id']}' == '${room['id']}';
                              return _RoomTile(
                                room: room,
                                isSelected: isSelected,
                                onTap: () =>
                                    setState(() => _selected = room),
                              );
                            },
                          ),
          ),

          // ── Reason + CTA ───────────────────────────────────────────
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: SafeArea(
              top: false,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    controller: _reasonController,
                    decoration: InputDecoration(
                      labelText: 'Reason for move (optional)',
                      hintText: 'e.g. Guest preference, maintenance …',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      prefixIcon: const Icon(Icons.comment_outlined),
                    ),
                    maxLines: 2,
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.kPrimary,
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(50),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: (_selected == null || _submitting)
                        ? null
                        : _submit,
                    icon: _submitting
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white),
                          )
                        : const Icon(Icons.swap_horiz),
                    label: Text(
                      _submitting
                          ? 'Moving …'
                          : _selected == null
                              ? 'Select a room to proceed'
                              : 'Move to room ${_selected!['room_number'] ?? _selected!['number']}',
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _roomBadge(
      {required String label, required String room, required Color color}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: color,
                letterSpacing: 1)),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: color.withValues(alpha: 0.4)),
          ),
          child: Text(
            room,
            style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: color),
          ),
        ),
      ],
    );
  }

  Widget _errorWidget() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, color: Colors.red, size: 48),
          const SizedBox(height: 12),
          Text(_error ?? 'Unknown error',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.red)),
          const SizedBox(height: 12),
          ElevatedButton(
              onPressed: _fetchRooms, child: const Text('Retry')),
        ],
      ),
    );
  }
}

// ── Individual room tile ──────────────────────────────────────────────────────

class _RoomTile extends StatelessWidget {
  const _RoomTile({
    required this.room,
    required this.isSelected,
    required this.onTap,
  });

  final Map<String, dynamic> room;
  final bool isSelected;
  final VoidCallback onTap;

  Color _typeColor(String? type) {
    switch ((type ?? '').toLowerCase()) {
      case 'suite':
        return Colors.purple;
      case 'deluxe':
        return Colors.indigo;
      case 'family':
        return Colors.teal;
      default:
        return Colors.blueGrey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final roomNumber =
        room['room_number'] ?? room['number'] ?? room['displayNumber'] ?? '?';
    final type = room['type'] ?? room['room_type'] ?? '';
    final floor = room['floor'];
    final price = room['price_per_night'] ?? room['rate'] ?? room['pricePerNight'];
    final maxOcc = room['max_occupancy'] ?? room['maxOccupancy'];
    final tc = _typeColor(type is String ? type : null);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        color: isSelected ? AppColors.kPrimary.withValues(alpha: 0.06) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isSelected ? AppColors.kPrimary : Colors.grey.shade200,
          width: isSelected ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              // Room number badge
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: tc.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: Text(
                  '$roomNumber',
                  style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: tc),
                ),
              ),
              const SizedBox(width: 14),
              // Details
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          '$roomNumber',
                          style: const TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                        const SizedBox(width: 8),
                        if (type is String && type.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: tc.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              type.toUpperCase(),
                              style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                  color: tc,
                                  letterSpacing: 0.5),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        if (floor != null) ...[
                          const Icon(Icons.layers_outlined,
                              size: 13, color: Colors.grey),
                          const SizedBox(width: 3),
                          Text('Floor $floor',
                              style: const TextStyle(
                                  fontSize: 12, color: Colors.grey)),
                          const SizedBox(width: 10),
                        ],
                        if (maxOcc != null) ...[
                          const Icon(Icons.group_outlined,
                              size: 13, color: Colors.grey),
                          const SizedBox(width: 3),
                          Text('Max $maxOcc',
                              style: const TextStyle(
                                  fontSize: 12, color: Colors.grey)),
                        ],
                      ],
                    ),
                    if (price != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'KES ${double.tryParse('$price')?.toStringAsFixed(0) ?? price}/night',
                          style: TextStyle(
                              fontSize: 13,
                              color: Colors.green.shade700,
                              fontWeight: FontWeight.w600),
                        ),
                      ),
                  ],
                ),
              ),
              // Selection indicator
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: isSelected
                    ? const Icon(Icons.check_circle,
                        key: ValueKey('selected'),
                        color: AppColors.kPrimary,
                        size: 26)
                    : Icon(Icons.radio_button_unchecked,
                        key: const ValueKey('unselected'),
                        color: Colors.grey.shade300,
                        size: 26),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
