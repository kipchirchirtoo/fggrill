import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/services/booking_service.dart';
import '../../domain/admin_providers.dart';
import '../widgets/admin_table.dart';
import 'package:famous_gates_app/features/admin/data/models/branch.dart';

class ReservationsSection extends ConsumerStatefulWidget {
  const ReservationsSection({super.key});

  @override
  ConsumerState<ReservationsSection> createState() =>
      _ReservationsSectionState();
}

class _ReservationsSectionState extends ConsumerState<ReservationsSection> {
  DateTimeRange? _dateRange;
  String? _selectedBranchId;
  String? _selectedStatus;
  final _searchController = TextEditingController();
  final _statuses = [
    'All',
    'confirmed',
    'pending',
    'cancelled',
    'checked_in',
    'checked_out'
  ];

  Map<String, String?> get _filters => {
        'status': (_selectedStatus == null || _selectedStatus == 'All')
            ? null
            : _selectedStatus,
        'search':
            _searchController.text.isEmpty ? null : _searchController.text,
        'checkInFrom': _dateRange?.start.toIso8601String().substring(0, 10),
        'checkInTo': _dateRange?.end.toIso8601String().substring(0, 10),
      };

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final branchesAsync = ref.watch(adminBranchesProvider);
    final branches = branchesAsync.valueOrNull ?? [];
    final reservationsAsync = ref.watch(adminReservationsProvider(_filters));

    return reservationsAsync.when(
      loading: () => const LoadingSkeleton(type: SkeletonType.table),
      error: (err, _) => ErrorState(
        message: '$err',
        onRetry: () => ref.invalidate(adminReservationsProvider(_filters)),
      ),
      data: (reservations) => RefreshIndicator(
        onRefresh: () async =>
            ref.invalidate(adminReservationsProvider(_filters)),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Reservations',
                      style: Theme.of(context).textTheme.displaySmall),
                  Text('${reservations.length} records',
                      style: const TextStyle(color: AppColors.kTextSecondary)),
                ],
              ),
              const SizedBox(height: 20),
              _buildFilterBar(branches),
              const SizedBox(height: 20),
              if (reservations.isEmpty)
                EmptyState(
                    message: 'No reservations found',
                    icon: PhosphorIcons.calendarBlank())
              else
                _buildTable(reservations),
            ],
          ),
        ),
      ),
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
            OutlinedButton.icon(
              onPressed: _pickDateRange,
              icon: Icon(PhosphorIcons.calendarBlank(), size: 18),
              label: Text(
                _dateRange != null
                    ? '${_dateRange!.start.toString().substring(0, 10)} - ${_dateRange!.end.toString().substring(0, 10)}'
                    : 'Date Range',
              ),
            ),
            SizedBox(
              width: 180,
              child: DropdownButtonFormField<String>(
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
              width: 160,
              child: DropdownButtonFormField<String>(
                initialValue: _selectedStatus ?? 'All',
                decoration: const InputDecoration(
                  labelText: 'Status',
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                items: _statuses
                    .map((s) => DropdownMenuItem(
                          value: s,
                          child: Text(s[0].toUpperCase() +
                              s.substring(1).replaceAll('_', ' ')),
                        ))
                    .toList(),
                onChanged: (v) => setState(() => _selectedStatus = v),
              ),
            ),
            SizedBox(
              width: 200,
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Search guest name...',
                  prefixIcon: Icon(PhosphorIcons.magnifyingGlass(), size: 18),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                onChanged: (_) => setState(() {}),
              ),
            ),
            const SizedBox.shrink(),
            ElevatedButton.icon(
              onPressed: () => _showCreateBookingDialog(context),
              icon: Icon(PhosphorIcons.plus(), size: 20),
              label: const Text('New Booking'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTable(List<Map<String, dynamic>> reservations) {
    return AdminTable(
      columns: const [
        'Guest Name',
        'Room',
        'Check-in',
        'Check-out',
        'Status',
        'Total',
        ''
      ],
      rows: reservations.map((r) {
        final guestName =
            r['guest_name'] ?? r['guestName'] ?? r['name'] ?? 'Guest';
        final room = r['room_number'] ?? r['roomNumber'] ?? r['room'] ?? 'N/A';
        final checkIn = _formatDate(r['check_in'] ?? r['checkIn'] ?? '');
        final checkOut = _formatDate(r['check_out'] ?? r['checkOut'] ?? '');
        final status = (r['status'] ?? '').toString();
        final total = r['total_amount'] ?? r['totalAmount'] ?? r['total'] ?? 0;
        final totalStr = 'KES ${_fmtAmount(total)}';

        return [
          Text(guestName.toString(),
              style: const TextStyle(fontWeight: FontWeight.w500)),
          Text(room.toString()),
          Text(checkIn),
          Text(checkOut),
          StatusBadge(status: status),
          Text(totalStr, style: const TextStyle(fontWeight: FontWeight.w600)),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                icon: Icon(PhosphorIcons.magnifyingGlass(), size: 18),
                onPressed: () => _showDetailsDialog(context, r),
                tooltip: 'View',
              ),
              IconButton(
                icon: Icon(PhosphorIcons.pencilLine(), size: 18),
                onPressed: () => _showEditStatusDialog(context, r),
                tooltip: 'Edit Status',
              ),
              if (status != 'cancelled' && status != 'checked_out')
                IconButton(
                  icon: Icon(PhosphorIcons.x(),
                      size: 18, color: AppColors.kError),
                  onPressed: () => _confirmCancel(context, r),
                  tooltip: 'Cancel',
                ),
            ],
          ),
        ];
      }).toList(),
      hasActions: true,
    );
  }

  void _showDetailsDialog(BuildContext context, Map<String, dynamic> booking) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
            'Booking: ${booking['guest_name'] ?? booking['guestName'] ?? ''}'),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              _detailRow('Status', booking['status'] ?? ''),
              _detailRow(
                  'Room',
                  (booking['room_number'] ?? booking['room'] ?? 'N/A')
                      .toString()),
              _detailRow('Check-in',
                  _formatDate(booking['check_in'] ?? booking['checkIn'] ?? '')),
              _detailRow(
                  'Check-out',
                  _formatDate(
                      booking['check_out'] ?? booking['checkOut'] ?? '')),
              _detailRow(
                  'Guests',
                  (booking['adults'] ?? booking['num_guests'] ?? '')
                      .toString()),
              _detailRow('Total',
                  'KES ${_fmtAmount(booking['total_amount'] ?? booking['total'] ?? 0)}'),
              _detailRow(
                  'Notes',
                  (booking['special_requests'] ?? booking['notes'] ?? '')
                      .toString()),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
        ],
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 90,
            child: Text('$label:',
                style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppColors.kTextSecondary)),
          ),
          Expanded(child: Text(value.isEmpty ? '—' : value)),
        ],
      ),
    );
  }

  void _showEditStatusDialog(
      BuildContext context, Map<String, dynamic> booking) {
    String selectedStatus = booking['status'] ?? 'pending';
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setStateDialog) => AlertDialog(
          title: const Text('Update Booking Status'),
          content: DropdownButtonFormField<String>(
            initialValue: selectedStatus,
            decoration: const InputDecoration(labelText: 'Status'),
            items: [
              'pending',
              'confirmed',
              'checked_in',
              'checked_out',
              'cancelled'
            ]
                .map((s) => DropdownMenuItem(
                      value: s,
                      child: Text(s[0].toUpperCase() +
                          s.substring(1).replaceAll('_', ' ')),
                    ))
                .toList(),
            onChanged: (v) =>
                setStateDialog(() => selectedStatus = v ?? selectedStatus),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(ctx);
                try {
                  await ref.read(bookingServiceProvider).updateBookingStatus(
                      booking['id'].toString(), selectedStatus);
                  ref.invalidate(adminReservationsProvider(_filters));
                  if (context.mounted) {
                    AppNotifier.showSnackBar(
                      context,
                      const SnackBar(content: Text('Booking updated')),
                    );
                  }
                } catch (e) {
                  if (context.mounted) {
                    AppNotifier.showSnackBar(
                        context, SnackBar(content: Text('Error: $e')));
                  }
                }
              },
              child: const Text('Update'),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmCancel(BuildContext context, Map<String, dynamic> booking) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Booking'),
        content: Text(
            'Cancel booking for ${booking['guest_name'] ?? booking['guestName'] ?? 'this guest'}?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('No')),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await ref
                    .read(bookingServiceProvider)
                    .cancelBooking(booking['id'].toString());
                ref.invalidate(adminReservationsProvider(_filters));
                if (context.mounted) {
                  AppNotifier.showSnackBar(
                    context,
                    const SnackBar(content: Text('Booking cancelled')),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  AppNotifier.showSnackBar(
                      context, SnackBar(content: Text('Error: $e')));
                }
              }
            },
            child: const Text('Yes, Cancel',
                style: TextStyle(color: AppColors.kError)),
          ),
        ],
      ),
    );
  }

  void _showCreateBookingDialog(BuildContext context) {
    final guestNameCtrl = TextEditingController();
    final roomCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    DateTime checkIn = DateTime.now().add(const Duration(days: 1));
    DateTime checkOut = DateTime.now().add(const Duration(days: 3));

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setStateDialog) => AlertDialog(
          title: const Text('New Booking'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: guestNameCtrl,
                  decoration: const InputDecoration(labelText: 'Guest Name *'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: roomCtrl,
                  decoration: const InputDecoration(labelText: 'Room Number'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Check-in Date'),
                  subtitle: Text(checkIn.toString().substring(0, 10)),
                  trailing: Icon(PhosphorIcons.calendarBlank()),
                  onTap: () async {
                    final d = await showDatePicker(
                      context: ctx,
                      initialDate: checkIn,
                      firstDate: DateTime.now(),
                      lastDate: DateTime(2030),
                    );
                    if (d != null) setStateDialog(() => checkIn = d);
                  },
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Check-out Date'),
                  subtitle: Text(checkOut.toString().substring(0, 10)),
                  trailing: Icon(PhosphorIcons.calendarBlank()),
                  onTap: () async {
                    final d = await showDatePicker(
                      context: ctx,
                      initialDate: checkOut,
                      firstDate: checkIn,
                      lastDate: DateTime(2030),
                    );
                    if (d != null) setStateDialog(() => checkOut = d);
                  },
                ),
                TextField(
                  controller: notesCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Special Requests'),
                  maxLines: 2,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                if (guestNameCtrl.text.isEmpty) return;
                Navigator.pop(ctx);
                try {
                  await ref.read(bookingServiceProvider).createBooking({
                    'guest_name': guestNameCtrl.text,
                    'room_number': roomCtrl.text.isEmpty ? null : roomCtrl.text,
                    'check_in': checkIn.toIso8601String().substring(0, 10),
                    'check_out': checkOut.toIso8601String().substring(0, 10),
                    'special_requests': notesCtrl.text,
                    'status': 'pending',
                  });
                  ref.invalidate(adminReservationsProvider(_filters));
                  if (context.mounted) {
                    AppNotifier.showSnackBar(
                      context,
                      const SnackBar(content: Text('Booking created')),
                    );
                  }
                } catch (e) {
                  if (context.mounted) {
                    AppNotifier.showSnackBar(
                        context, SnackBar(content: Text('Error: $e')));
                  }
                }
              },
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickDateRange() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2024),
      lastDate: DateTime(2027),
      initialDateRange: _dateRange,
    );
    if (picked != null) {
      setState(() => _dateRange = picked);
    }
  }

  String _formatDate(dynamic date) {
    if (date == null || date.toString().isEmpty) return '—';
    final s = date.toString();
    return s.length >= 10 ? s.substring(0, 10) : s;
  }

  String _fmtAmount(dynamic val) {
    final n =
        (val is num) ? val.toDouble() : double.tryParse(val.toString()) ?? 0.0;
    if (n >= 1000000) return '${(n / 1000000).toStringAsFixed(1)}M';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return n.toStringAsFixed(0);
  }
}
