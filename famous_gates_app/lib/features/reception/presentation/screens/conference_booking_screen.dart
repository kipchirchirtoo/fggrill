// ============================================================
// Conference Hall Booking Screen — Reception Module
// ============================================================
// Full-featured dedicated screen for:
//   • Viewing all conference halls (availability, capacity, rates)
//   • Booking a hall with date/time picker and availability check
//   • Managing active/upcoming bookings (pay, cancel, PDF invoice)
//   • Quick status updates per hall
// ============================================================

import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/api_error_message.dart';
import '../../data/repository.dart';

// ─── Formatters ───────────────────────────────────────────────────────────────

final _kCurrency = NumberFormat.currency(symbol: 'KES ', decimalDigits: 0);
final _kDate = DateFormat('MMM d, yyyy  HH:mm');
final _kDateShort = DateFormat('MMM d, yyyy');

String _money(num v) => _kCurrency.format(v);

String? _t(Map<String, dynamic> row, List<String> keys) {
  for (final k in keys) {
    dynamic cur = row;
    for (final part in k.split('.')) {
      if (cur is Map) {
        cur = cur[part];
      } else {
        cur = null;
        break;
      }
    }
    if (cur != null && '$cur'.isNotEmpty && '$cur' != 'null') return '$cur';
  }
  return null;
}

num _n(Map<String, dynamic> row, List<String> keys) {
  for (final k in keys) {
    final v = row[k];
    if (v is num) return v;
    final p = num.tryParse('$v');
    if (p != null) return p;
  }
  return 0;
}

Color _statusColor(String s) {
  switch (s) {
    case 'available':
    case 'confirmed':
    case 'paid':
      return AppColors.kSuccess;
    case 'occupied':
    case 'partial':
      return Colors.blue;
    case 'pending':
    case 'reserved':
    case 'unpaid':
      return AppColors.kWarning;
    case 'maintenance':
    case 'cancelled':
      return AppColors.kError;
    default:
      return AppColors.kPrimary;
  }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

class ConferenceBookingScreen extends ConsumerStatefulWidget {
  const ConferenceBookingScreen({super.key});

  @override
  ConsumerState<ConferenceBookingScreen> createState() =>
      _ConferenceBookingScreenState();
}

class _ConferenceBookingScreenState
    extends ConsumerState<ConferenceBookingScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  late ReceptionRepository _repo;

  List<Map<String, dynamic>> _halls = [];
  List<Map<String, dynamic>> _bookings = [];
  bool _loading = true;
  String _bookingFilter = 'all'; // all | confirmed | pending | cancelled

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _repo = ref.read(receptionRepositoryProvider);
      _load();
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final halls = await _repo.getConferenceHalls();
      final bookings = await _repo.getConferenceBookings();
      if (mounted) setState(() {
        _halls = halls;
        _bookings = bookings;
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        _snack('Failed to load data: ${apiErrorMessage(e)}', error: true);
      }
    }
  }

  List<Map<String, dynamic>> get _filteredBookings {
    if (_bookingFilter == 'all') return _bookings;
    return _bookings
        .where((b) =>
            (_t(b, ['booking_status', 'status']) ?? '') == _bookingFilter)
        .toList();
  }

  void _snack(String msg, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: error ? AppColors.kError : AppColors.kSuccess,
      ),
    );
  }

  // ── Dialogs ────────────────────────────────────────────────────────────────

  Future<void> _openBookingDialog() async {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => ConferenceBookingDialog(
        halls: _halls,
        repo: _repo,
        onSuccess: () {
          _load();
          _snack('Conference hall booked successfully!');
        },
      ),
    );
  }

  Future<void> _openPaymentDialog(Map<String, dynamic> booking) async {
    final id = _t(booking, ['id']);
    if (id == null) return;
    await showDialog<void>(
      context: context,
      builder: (ctx) => _PaymentDialog(
        booking: booking,
        onSubmit: (amount, method) async {
          await _repo.addConferencePayment(id, {
            'payment_amount': amount,
            'payment_method': method,
            'payment_reference': '$method-${DateTime.now().millisecondsSinceEpoch}',
          });
          if (mounted) {
            _load();
            _snack('Payment recorded');
          }
        },
      ),
    );
  }

  Future<void> _cancelBooking(Map<String, dynamic> booking) async {
    final id = _t(booking, ['id']);
    final company = _t(booking, ['company_name']) ?? 'this booking';
    if (id == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Cancel Booking'),
        content: Text('Cancel the booking for $company?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('No')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kError),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Yes, Cancel'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _repo.updateConferenceBookingStatus(id, 'cancelled');
      _load();
      _snack('Booking cancelled');
    } catch (e) {
      _snack(apiErrorMessage(e, fallback: 'Failed to cancel'), error: true);
    }
  }

  Future<void> _updateHallStatus(String hallId, String status) async {
    try {
      await _repo.updateConferenceHall(hallId, {'status': status});
      _load();
      _snack('Hall status updated to $status');
    } catch (e) {
      _snack(apiErrorMessage(e, fallback: 'Update failed'), error: true);
    }
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: theme.colorScheme.background,
      appBar: AppBar(
        backgroundColor: AppColors.kSurface,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Conference Halls',
                style: theme.textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.bold)),
            Text('Book, manage and track hall reservations',
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: AppColors.kTextSecondary)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: _load,
          ),
          const SizedBox(width: 4),
          FilledButton.icon(
            onPressed: _halls.isEmpty ? null : _openBookingDialog,
            icon: const Icon(Icons.add, size: 18),
            label: const Text('New Booking'),
          ),
          const SizedBox(width: 16),
        ],
        bottom: TabBar(
          controller: _tabs,
          tabs: [
            Tab(
              icon: const Icon(Icons.meeting_room_outlined, size: 18),
              text: 'Halls (${_halls.length})',
            ),
            Tab(
              icon: const Icon(Icons.event_note_outlined, size: 18),
              text: 'Bookings (${_bookings.length})',
            ),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabs,
              children: [
                _HallsTab(
                  halls: _halls,
                  onStatusChange: _updateHallStatus,
                  onBook: _openBookingDialog,
                ),
                _BookingsTab(
                  bookings: _filteredBookings,
                  allBookings: _bookings,
                  filter: _bookingFilter,
                  onFilterChange: (f) => setState(() => _bookingFilter = f),
                  onPay: _openPaymentDialog,
                  onCancel: _cancelBooking,
                  onStatusChange: (id, status) async {
                    await _repo.updateConferenceBookingStatus(id, status);
                    _load();
                  },
                ),
              ],
            ),
    );
  }
}

// ─── Halls Tab ────────────────────────────────────────────────────────────────

class _HallsTab extends StatelessWidget {
  const _HallsTab({
    required this.halls,
    required this.onStatusChange,
    required this.onBook,
  });

  final List<Map<String, dynamic>> halls;
  final void Function(String hallId, String status) onStatusChange;
  final VoidCallback onBook;

  @override
  Widget build(BuildContext context) {
    if (halls.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.meeting_room_outlined,
                size: 64, color: AppColors.kTextSecondary.withOpacity(0.4)),
            const SizedBox(height: 16),
            Text('No conference halls configured',
                style: TextStyle(color: AppColors.kTextSecondary)),
            const SizedBox(height: 8),
            const Text('Contact admin to add conference halls.',
                style: TextStyle(fontSize: 12)),
          ],
        ),
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 360,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 1.35,
      ),
      itemCount: halls.length,
      itemBuilder: (_, i) => _HallCard(
        hall: halls[i],
        onStatusChange: onStatusChange,
        onBook: onBook,
      ),
    );
  }
}

class _HallCard extends StatelessWidget {
  const _HallCard({
    required this.hall,
    required this.onStatusChange,
    required this.onBook,
  });

  final Map<String, dynamic> hall;
  final void Function(String hallId, String status) onStatusChange;
  final VoidCallback onBook;

  @override
  Widget build(BuildContext context) {
    final id = _t(hall, ['id']) ?? '';
    final name = _t(hall, ['name', 'hall_name']) ?? 'Conference Hall';
    final capacity = _n(hall, ['capacity']).toInt();
    final priceDay = _n(hall, ['base_price_per_day', 'price_per_day', 'rate']);
    final priceHour =
        _n(hall, ['base_price_per_hour', 'price_per_hour']);
    final status = _t(hall, ['status']) ?? 'available';
    final description = _t(hall, ['description']) ?? '';
    final amenities = hall['amenities'];

    final statusColor = _statusColor(status);

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.kPrimary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(Icons.meeting_room,
                      color: AppColors.kPrimary, size: 20),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(name,
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 15),
                      overflow: TextOverflow.ellipsis),
                ),
                _StatusBadge(status),
              ],
            ),
            const SizedBox(height: 12),

            // Info rows
            _InfoRow(Icons.people_outline, 'Capacity', '$capacity pax'),
            if (priceDay > 0)
              _InfoRow(Icons.today_outlined, 'Per day', _money(priceDay)),
            if (priceHour > 0)
              _InfoRow(
                  Icons.timer_outlined, 'Per hour', _money(priceHour)),
            if (description.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(description,
                  style: TextStyle(
                      fontSize: 11, color: AppColors.kTextSecondary),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis),
            ],
            if (amenities is List && amenities.isNotEmpty) ...[
              const SizedBox(height: 6),
              Wrap(
                spacing: 4,
                runSpacing: 4,
                children: amenities
                    .take(4)
                    .map((a) => Chip(
                          label: Text('$a',
                              style: const TextStyle(fontSize: 10)),
                          padding: EdgeInsets.zero,
                          materialTapTargetSize:
                              MaterialTapTargetSize.shrinkWrap,
                          visualDensity: VisualDensity.compact,
                        ))
                    .toList(),
              ),
            ],

            const Spacer(),

            // Actions
            Row(
              children: [
                Expanded(
                  child: FilledButton.tonal(
                    onPressed: onBook,
                    style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 8)),
                    child: const Text('Book', style: TextStyle(fontSize: 12)),
                  ),
                ),
                const SizedBox(width: 8),
                PopupMenuButton<String>(
                  tooltip: 'Change status',
                  icon: const Icon(Icons.more_vert, size: 18),
                  onSelected: (s) => id.isNotEmpty
                      ? onStatusChange(id, s)
                      : null,
                  itemBuilder: (_) => [
                    for (final s in ['available', 'occupied', 'maintenance'])
                      PopupMenuItem(
                        value: s,
                        child: Row(children: [
                          Container(
                              width: 8,
                              height: 8,
                              margin: const EdgeInsets.only(right: 8),
                              decoration: BoxDecoration(
                                  color: _statusColor(s),
                                  shape: BoxShape.circle)),
                          Text(_capitalize(s)),
                        ]),
                      ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.icon, this.label, this.value);
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 3),
      child: Row(
        children: [
          Icon(icon, size: 13, color: AppColors.kTextSecondary),
          const SizedBox(width: 5),
          Text('$label: ',
              style: TextStyle(
                  fontSize: 12, color: AppColors.kTextSecondary)),
          Text(value,
              style: const TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge(this.status);
  final String status;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: _statusColor(status).withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _statusColor(status).withOpacity(0.4)),
      ),
      child: Text(
        _capitalize(status),
        style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: _statusColor(status)),
      ),
    );
  }
}

// ─── Bookings Tab ─────────────────────────────────────────────────────────────

class _BookingsTab extends StatelessWidget {
  const _BookingsTab({
    required this.bookings,
    required this.allBookings,
    required this.filter,
    required this.onFilterChange,
    required this.onPay,
    required this.onCancel,
    required this.onStatusChange,
  });

  final List<Map<String, dynamic>> bookings;
  final List<Map<String, dynamic>> allBookings;
  final String filter;
  final ValueChanged<String> onFilterChange;
  final Future<void> Function(Map<String, dynamic>) onPay;
  final Future<void> Function(Map<String, dynamic>) onCancel;
  final Future<void> Function(String id, String status) onStatusChange;

  @override
  Widget build(BuildContext context) {
    final filters = ['all', 'confirmed', 'pending', 'cancelled'];

    return Column(
      children: [
        // Filter chips
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Row(
            children: [
              for (final f in filters)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(
                      '${_capitalize(f)} (${f == 'all' ? allBookings.length : allBookings.where((b) => (_t(b, ['booking_status', 'status']) ?? '') == f).length})',
                      style: const TextStyle(fontSize: 12),
                    ),
                    selected: filter == f,
                    onSelected: (_) => onFilterChange(f),
                    selectedColor: AppColors.kPrimary.withOpacity(0.15),
                    checkmarkColor: AppColors.kPrimary,
                    visualDensity: VisualDensity.compact,
                  ),
                ),
            ],
          ),
        ),

        // List
        Expanded(
          child: bookings.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.event_busy_outlined,
                          size: 56,
                          color: AppColors.kTextSecondary.withOpacity(0.4)),
                      const SizedBox(height: 12),
                      Text(
                        filter == 'all'
                            ? 'No bookings yet'
                            : 'No ${filter} bookings',
                        style:
                            TextStyle(color: AppColors.kTextSecondary),
                      ),
                    ],
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: bookings.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (ctx, i) => _BookingCard(
                    booking: bookings[i],
                    onPay: () => onPay(bookings[i]),
                    onCancel: () => onCancel(bookings[i]),
                    onStatusChange: onStatusChange,
                  ),
                ),
        ),
      ],
    );
  }
}

class _BookingCard extends StatelessWidget {
  const _BookingCard({
    required this.booking,
    required this.onPay,
    required this.onCancel,
    required this.onStatusChange,
  });

  final Map<String, dynamic> booking;
  final VoidCallback onPay;
  final VoidCallback onCancel;
  final Future<void> Function(String id, String status) onStatusChange;

  @override
  Widget build(BuildContext context) {
    final id = _t(booking, ['id']) ?? '';
    final invoice = _t(booking, ['invoice_number']) ?? '';
    final company = _t(booking, ['company_name']) ?? 'Unknown client';
    final contact = _t(booking, ['contact_person', 'customer_name']) ?? '';
    final phone = _t(booking, ['customer_phone', 'phone']) ?? '';
    final hallName = _t(booking, ['hall.name', 'hall_name']) ?? 'Hall';
    final participants = _n(booking, ['num_participants', 'participants']).toInt();
    final startRaw = _t(booking, ['start_date', 'check_in']) ?? '';
    final endRaw = _t(booking, ['end_date', 'check_out']) ?? '';
    final total = _n(booking, ['total_amount', 'amount']);
    final paid = _n(booking, ['paid_amount', 'amount_paid']);
    final balance = total - paid;
    final status = _t(booking, ['booking_status', 'status']) ?? 'pending';
    final payStatus = _t(booking, ['payment_status']) ?? (balance <= 0 ? 'paid' : 'unpaid');

    final startDt = DateTime.tryParse(startRaw);
    final endDt = DateTime.tryParse(endRaw);

    final isCancelled = status == 'cancelled';

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(
          color: _statusColor(status).withOpacity(0.3),
          width: 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top row
            Row(
              children: [
                // Hall icon
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.kPrimary.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(Icons.meeting_room,
                      size: 18, color: AppColors.kPrimary),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(company,
                          style: const TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 14)),
                      Text(hallName,
                          style: TextStyle(
                              fontSize: 12, color: AppColors.kTextSecondary)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    _StatusBadge(status),
                    const SizedBox(height: 4),
                    _StatusBadge(payStatus),
                  ],
                ),
              ],
            ),

            const SizedBox(height: 10),
            const Divider(height: 1),
            const SizedBox(height: 10),

            // Details grid
            Wrap(
              spacing: 16,
              runSpacing: 6,
              children: [
                if (invoice.isNotEmpty)
                  _Detail('Invoice', invoice),
                if (contact.isNotEmpty)
                  _Detail('Contact', contact),
                if (phone.isNotEmpty)
                  _Detail('Phone', phone),
                if (participants > 0)
                  _Detail('Participants', '$participants pax'),
                if (startDt != null)
                  _Detail('Start', _kDate.format(startDt)),
                if (endDt != null)
                  _Detail('End', _kDate.format(endDt)),
                _Detail('Total', _money(total)),
                if (paid > 0)
                  _Detail('Paid', _money(paid),
                      color: AppColors.kSuccess),
                if (balance > 0)
                  _Detail('Balance', _money(balance),
                      color: AppColors.kError),
              ],
            ),

            if (!isCancelled) ...[
              const SizedBox(height: 12),
              // Actions
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  if (balance > 0)
                    OutlinedButton.icon(
                      onPressed: onPay,
                      icon: const Icon(Icons.payments_outlined, size: 15),
                      label: const Text('Add Payment',
                          style: TextStyle(fontSize: 12)),
                      style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.kSuccess,
                          side: BorderSide(color: AppColors.kSuccess),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          visualDensity: VisualDensity.compact),
                    ),
                  if (status == 'pending' && id.isNotEmpty)
                    OutlinedButton.icon(
                      onPressed: () => onStatusChange(id, 'confirmed'),
                      icon: const Icon(Icons.check_circle_outline, size: 15),
                      label: const Text('Confirm',
                          style: TextStyle(fontSize: 12)),
                      style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.kPrimary,
                          side: BorderSide(color: AppColors.kPrimary),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          visualDensity: VisualDensity.compact),
                    ),
                  OutlinedButton.icon(
                    onPressed: onCancel,
                    icon: const Icon(Icons.cancel_outlined, size: 15),
                    label: const Text('Cancel',
                        style: TextStyle(fontSize: 12)),
                    style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.kError,
                        side: BorderSide(color: AppColors.kError),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        visualDensity: VisualDensity.compact),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Detail extends StatelessWidget {
  const _Detail(this.label, this.value, {this.color});
  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: TextStyle(
                fontSize: 10,
                color: AppColors.kTextSecondary,
                fontWeight: FontWeight.w500)),
        Text(value,
            style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: color)),
      ],
    );
  }
}

// ─── Booking Dialog ───────────────────────────────────────────────────────────

class ConferenceBookingDialog extends ConsumerStatefulWidget {
  const ConferenceBookingDialog({
    super.key,
    required this.halls,
    required this.repo,
    required this.onSuccess,
    this.initialHall,
    this.currentBranch = 'Kyogong',
  });

  final List<Map<String, dynamic>> halls;
  final ReceptionRepository repo;
  final VoidCallback onSuccess;
  final Map<String, dynamic>? initialHall;
  final String currentBranch;

  @override
  ConsumerState<ConferenceBookingDialog> createState() =>
      _ConferenceBookingDialogState();
}

class _ConferenceBookingDialogState
    extends ConsumerState<ConferenceBookingDialog> {
  final _formKey = GlobalKey<FormState>();

  // Ref
  final String _bookingRef =
      'CB-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}';

  // Branch & Date
  String _selectedBranch = 'Kyogong';
  DateTime _bookingDate = DateTime.now();

  // Client Details
  final _clientCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _orgCtrl = TextEditingController();

  // Package
  String _selectedPackage = 'half_day'; // half_day | full_day | half_board | full_board | none
  final Map<String, Map<String, dynamic>> _packages = {
    'half_day': {
      'title': 'Half day',
      'rate': 1800,
      'desc': '10am tea, buffet lunch + soft drink',
    },
    'full_day': {
      'title': 'Full day',
      'rate': 2500,
      'desc': '10am tea, lunch, 4pm tea + snacks',
    },
    'half_board': {
      'title': 'Half board',
      'rate': 6500,
      'desc': 'Accommodation, tea, lunch or dinner',
    },
    'full_board': {
      'title': 'Full board',
      'rate': 7500,
      'desc': 'Accommodation, all meals + tea breaks',
    },
    'none': {
      'title': 'Hall Only (No Package)',
      'rate': 0,
      'desc': 'Hall rental only, no catering package',
    },
  };

  // Pax & Days
  final _paxCtrl = TextEditingController(text: '1');
  final _daysCtrl = TextEditingController(text: '1');

  // Hall Selection
  Map<String, dynamic>? _selectedHall;

  // Equipment Add-ons
  bool _addProjector = false;
  bool _addPaSystem = false;
  static const num _projectorRate = 3500;
  static const num _paSystemRate = 3500;

  // Other Space Charges
  bool _chargeGarden = false;
  bool _chargeVideoShoot = false;
  bool _chargePartySpace = false;
  static const num _gardenRate = 5000;
  static const num _videoShootRate = 5000;
  static const num _partySpaceRate = 5000;

  // Notes & Payment
  final _notesCtrl = TextEditingController();
  final _depositCtrl = TextEditingController(text: '0');
  String _paymentMethod = 'cash';
  String _bookingStatus = 'confirmed';

  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _selectedBranch = widget.currentBranch;
    if (widget.initialHall != null) {
      _selectedHall = widget.initialHall;
    } else if (widget.halls.isNotEmpty) {
      _selectedHall = widget.halls.first;
    }
  }

  @override
  void dispose() {
    _clientCtrl.dispose();
    _phoneCtrl.dispose();
    _orgCtrl.dispose();
    _paxCtrl.dispose();
    _daysCtrl.dispose();
    _notesCtrl.dispose();
    _depositCtrl.dispose();
    super.dispose();
  }

  // ── Calculation Logic ──────────────────────────────────────────────────────

  int get _pax => math.max(1, int.tryParse(_paxCtrl.text.trim()) ?? 1);
  int get _days => math.max(1, int.tryParse(_daysCtrl.text.trim()) ?? 1);

  num get _packageRate =>
      (_packages[_selectedPackage]?['rate'] as num?) ?? 0;
  num get _packageTotal => _packageRate * _pax * _days;

  num get _hallRate {
    if (_selectedHall == null) return 0;
    final rateInDb = _n(_selectedHall!, ['base_price_per_day', 'rate']);
    if (rateInDb > 0) return rateInDb;
    // Default preset rates by hall name if 0 in DB
    final name = (_t(_selectedHall!, ['name']) ?? '').toLowerCase();
    if (name.contains('sinai') || name.contains('boardroom') || name.contains('rooftop')) {
      return 10000;
    }
    if (name.contains('olive')) return 7000;
    if (name.contains('zion')) return 5000;
    if (name.contains('garden')) return 15000;
    return 5000;
  }
  num get _hallTotal => _hallRate * _days;

  num get _addOnsTotal =>
      ((_addProjector ? _projectorRate : 0) +
          (_addPaSystem ? _paSystemRate : 0)) *
      _days;

  num get _otherChargesTotal =>
      (_chargeGarden ? _gardenRate : 0) +
      (_chargeVideoShoot ? _videoShootRate : 0) +
      (_chargePartySpace ? _partySpaceRate : 0);

  num get _grandTotal =>
      _packageTotal + _hallTotal + _addOnsTotal + _otherChargesTotal;

  bool get _isVideoShootWeekdayWarning {
    if (!_chargeVideoShoot) return false;
    final weekday = _bookingDate.weekday; // 1 = Mon, 7 = Sun
    return weekday == DateTime.saturday || weekday == DateTime.sunday;
  }

  bool get _isCapacityExceeded {
    if (_selectedHall == null) return false;
    final cap = _n(_selectedHall!, ['capacity']).toInt();
    return cap > 0 && _pax > cap;
  }

  // ── Date Picker ────────────────────────────────────────────────────────────

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _bookingDate,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null && mounted) {
      setState(() => _bookingDate = picked);
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedHall == null) {
      _showError('Please select a conference hall');
      return;
    }
    if (_pax <= 0) {
      _showError('Number of pax must be at least 1');
      return;
    }
    if (_days <= 0) {
      _showError('Number of days must be at least 1');
      return;
    }

    setState(() => _submitting = true);
    try {
      final hallId = _t(_selectedHall!, ['id']);
      final endDate = _bookingDate.add(Duration(days: _days));
      final deposit = double.tryParse(_depositCtrl.text.trim()) ?? 0;

      // Compile line items into notes
      final detailsList = <String>[];
      if (_selectedPackage != 'none') {
        detailsList.add('Package: ${_packages[_selectedPackage]?['title']} @ KES ${_packageRate}/pp');
      }
      if (_addProjector) detailsList.add('Projector @ KES $_projectorRate/day');
      if (_addPaSystem) detailsList.add('PA System @ KES $_paSystemRate/day');
      if (_chargeGarden) detailsList.add('Garden Space @ KES $_gardenRate');
      if (_chargeVideoShoot) detailsList.add('Video Shoot @ KES $_videoShootRate');
      if (_chargePartySpace) detailsList.add('Party Space @ KES $_partySpaceRate');
      if (_notesCtrl.text.trim().isNotEmpty) {
        detailsList.add('Notes: ${_notesCtrl.text.trim()}');
      }

      await widget.repo.createConferenceBooking({
        'conference_hall_id': hallId,
        'hall_id': hallId,
        'company_name': _clientCtrl.text.trim().isNotEmpty
            ? _clientCtrl.text.trim()
            : (_orgCtrl.text.trim().isNotEmpty
                ? _orgCtrl.text.trim()
                : 'Individual Client'),
        'contact_person': _clientCtrl.text.trim(),
        'customer_phone': _phoneCtrl.text.trim(),
        'menu_package': _packages[_selectedPackage]?['title'] ?? 'Half day',
        'amount_per_pax': _packageRate,
        'start_date': _bookingDate.toIso8601String(),
        'end_date': endDate.toIso8601String(),
        'num_participants': _pax,
        'total_amount': _grandTotal,
        'deposit_amount': deposit,
        'payment_method': _paymentMethod,
        'booking_status': _bookingStatus,
        'payment_status': deposit >= _grandTotal && _grandTotal > 0
            ? 'paid'
            : (deposit > 0 ? 'partial' : 'unpaid'),
        'notes': detailsList.join(' | '),
      });

      if (mounted) {
        Navigator.pop(context);
        widget.onSuccess();

        // Print Invoice automatically with full details
        printConferenceBookingInvoice(
          bookingRef: _bookingRef,
          branchName: _selectedBranch,
          bookingDate: _bookingDate,
          clientName: _clientCtrl.text.trim(),
          customerPhone: _phoneCtrl.text.trim(),
          organization: _orgCtrl.text.trim(),
          hallName: _t(_selectedHall!, ['name']) ?? 'Conference Hall',
          hallCapacity: _n(_selectedHall!, ['capacity']).toInt(),
          packageTitle: _packages[_selectedPackage]?['title'] ?? 'Custom',
          packageRate: _packageRate,
          pax: _pax,
          days: _days,
          packageTotal: _packageTotal,
          hallRate: _hallRate,
          hallTotal: _hallTotal,
          addProjector: _addProjector,
          addPaSystem: _addPaSystem,
          chargeGarden: _chargeGarden,
          chargeVideoShoot: _chargeVideoShoot,
          chargePartySpace: _chargePartySpace,
          grandTotal: _grandTotal,
          depositPaid: deposit,
          paymentMethod: _paymentMethod,
          bookingStatus: _bookingStatus,
          notes: _notesCtrl.text.trim(),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        _showError(apiErrorMessage(e, fallback: 'Failed to create booking'));
      }
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: AppColors.kError),
    );
  }

  List<Map<String, dynamic>> get _availableHalls {
    if (widget.halls.isEmpty) return [];
    final selBranch = _selectedBranch.trim().toLowerCase();
    final filtered = widget.halls.where((h) {
      final bName = (_t(h, ['branch_name', 'branch', 'branches']) ?? '')
          .toString()
          .trim()
          .toLowerCase();
      if (bName.isEmpty) return true;
      return bName.contains(selBranch) || selBranch.contains(bName);
    }).toList();
    return filtered.isNotEmpty ? filtered : widget.halls;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final maxHeight = math.min(840.0, MediaQuery.of(context).size.height * 0.90);

    final availableHalls = _availableHalls;

    return Dialog(
      backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: 820, maxHeight: maxHeight),
        child: Column(
          children: [
            // ── Pinned Header ───────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 18, 16, 14),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('New conference booking',
                            style: theme.textTheme.titleLarge
                                ?.copyWith(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 2),
                        Text('Ref: $_bookingRef',
                            style: TextStyle(
                                fontSize: 12,
                                color: AppColors.kTextSecondary)),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, thickness: 1),

            // ── Scrollable Form Body ─────────────────────────────────────────
            Expanded(
              child: Form(
                key: _formKey,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // ── 1. Branch & Date & Client Info ───────────────────
                      Row(
                        children: [
                          Expanded(
                            child: InputDecorator(
                              decoration: _inputDec('Branch'),
                              child: Row(
                                children: [
                                  const Icon(Icons.location_on_outlined,
                                      size: 16, color: AppColors.kPrimary),
                                  const SizedBox(width: 8),
                                  Text(
                                    _selectedBranch,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13),
                                  ),
                                  const Spacer(),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppColors.kPrimary.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      'Current Branch',
                                      style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w600,
                                          color: AppColors.kPrimary),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: InkWell(
                              onTap: _pickDate,
                              borderRadius: BorderRadius.circular(8),
                              child: InputDecorator(
                                decoration: _inputDec('Booking date'),
                                child: Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(_kDateShort.format(_bookingDate),
                                        style: const TextStyle(fontSize: 13)),
                                    const Icon(Icons.calendar_today, size: 16),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _clientCtrl,
                              decoration:
                                  _inputDec('Client / organizer name *'),
                              validator: (v) => (v ?? '').trim().isEmpty
                                  ? 'Required'
                                  : null,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: _phoneCtrl,
                              decoration: _inputDec('Phone number *'),
                              keyboardType: TextInputType.phone,
                              validator: (v) => (v ?? '').trim().isEmpty
                                  ? 'Required'
                                  : null,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _orgCtrl,
                        decoration: _inputDec('Organization (optional)'),
                      ),
                      const SizedBox(height: 20),

                      // ── 2. Conference Package Cards ──────────────────────
                      _SectionHeader('Conference package'),
                      GridView.count(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        crossAxisCount: 2,
                        childAspectRatio: 3.0,
                        crossAxisSpacing: 10,
                        mainAxisSpacing: 10,
                        children: _packages.entries.map((entry) {
                          final key = entry.key;
                          final pkg = entry.value;
                          final isSelected = _selectedPackage == key;
                          return InkWell(
                            onTap: () =>
                                setState(() => _selectedPackage = key),
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 8),
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? AppColors.kPrimary.withOpacity(0.08)
                                    : (isDark
                                        ? const Color(0xFF0F172A)
                                        : Colors.white),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: isSelected
                                      ? AppColors.kPrimary
                                      : Colors.grey.shade300,
                                  width: isSelected ? 2 : 1,
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Row(
                                    children: [
                                      Radio<String>(
                                        value: key,
                                        groupValue: _selectedPackage,
                                        onChanged: (v) => setState(
                                            () => _selectedPackage = v!),
                                        visualDensity: VisualDensity.compact,
                                        activeColor: AppColors.kPrimary,
                                      ),
                                      Expanded(
                                        child: Text(
                                          pkg['title'],
                                          style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 13),
                                        ),
                                      ),
                                      Text(
                                        pkg['rate'] > 0
                                            ? '${_money(pkg['rate'])} pp'
                                            : 'Free',
                                        style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            color: isSelected
                                                ? AppColors.kPrimary
                                                : Colors.grey.shade700),
                                      ),
                                    ],
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.only(left: 32),
                                    child: Text(
                                      pkg['desc'],
                                      style: TextStyle(
                                          fontSize: 10,
                                          color: AppColors.kTextSecondary),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 16),

                      // ── 3. Pax & Days Inputs ─────────────────────────────
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _paxCtrl,
                              decoration: _inputDec('Number of pax *'),
                              keyboardType: TextInputType.number,
                              onChanged: (_) => setState(() {}),
                              validator: (v) {
                                final val = int.tryParse(v ?? '');
                                if (val == null || val < 1) {
                                  return 'Must be at least 1';
                                }
                                return null;
                              },
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: _daysCtrl,
                              decoration: _inputDec('Number of days (hall) *'),
                              keyboardType: TextInputType.number,
                              onChanged: (_) => setState(() {}),
                              validator: (v) {
                                final val = int.tryParse(v ?? '');
                                if (val == null || val < 1) {
                                  return 'Must be at least 1';
                                }
                                return null;
                              },
                            ),
                          ),
                        ],
                      ),

                      // Capacity Warning Banner
                      if (_isCapacityExceeded) ...[
                        const SizedBox(height: 10),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppColors.kWarning.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                                color: AppColors.kWarning.withOpacity(0.5)),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.warning_amber_rounded,
                                  color: AppColors.kWarning, size: 20),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Warning: Participant count ($_pax pax) exceeds selected hall\'s capacity (${_n(_selectedHall!, ['capacity']).toInt()} pax max).',
                                  style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.kWarning),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],

                      const SizedBox(height: 20),

                      // ── 4. Hall Selection Cards ──────────────────────────
                      _SectionHeader('Select Hall'),
                      if (availableHalls.isEmpty)
                        const Text('No conference halls found for this branch.')
                      else
                        GridView.count(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisCount: 3,
                          childAspectRatio: 2.2,
                          crossAxisSpacing: 8,
                          mainAxisSpacing: 8,
                          children: availableHalls.map((hall) {
                            final id = _t(hall, ['id']);
                            final isSelected =
                                _t(_selectedHall ?? {}, ['id']) == id;
                            final name =
                                _t(hall, ['name']) ?? 'Conference Hall';
                            final capacity =
                                _n(hall, ['capacity']).toInt();
                            final rate = () {
                              final r =
                                  _n(hall, ['base_price_per_day', 'rate']);
                              if (r > 0) return r;
                              final n = name.toLowerCase();
                              if (n.contains('sinai') ||
                                  n.contains('boardroom') ||
                                  n.contains('rooftop')) return 10000;
                              if (n.contains('olive')) return 7000;
                              if (n.contains('zion')) return 5000;
                              if (n.contains('garden')) return 15000;
                              return 5000;
                            }();

                            return InkWell(
                              onTap: () =>
                                  setState(() => _selectedHall = hall),
                              borderRadius: BorderRadius.circular(8),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 8),
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? AppColors.kPrimary.withOpacity(0.12)
                                      : (isDark
                                          ? const Color(0xFF0F172A)
                                          : Colors.white),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                    color: isSelected
                                        ? AppColors.kPrimary
                                        : Colors.grey.shade300,
                                    width: isSelected ? 2 : 1,
                                  ),
                                ),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      name,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 12),
                                      textAlign: TextAlign.center,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      'Cap: $capacity pax',
                                      style: TextStyle(
                                          fontSize: 10,
                                          color: AppColors.kTextSecondary),
                                    ),
                                    Text(
                                      '${_money(rate)}/day',
                                      style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.kPrimary),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          }).toList(),
                        ),

                      const SizedBox(height: 20),

                      // ── 5. Equipment Add-ons ─────────────────────────────
                      _SectionHeader('Equipment Add-ons'),
                      Row(
                        children: [
                          Expanded(
                            child: _CheckboxCard(
                              title: 'Projector',
                              subtitle: '${_money(_projectorRate)}/day',
                              value: _addProjector,
                              onChanged: (v) =>
                                  setState(() => _addProjector = v ?? false),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _CheckboxCard(
                              title: 'PA System & Mic',
                              subtitle: '${_money(_paSystemRate)}/day',
                              value: _addPaSystem,
                              onChanged: (v) =>
                                  setState(() => _addPaSystem = v ?? false),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // ── 6. Space Charges ─────────────────────────────────
                      _SectionHeader('Space Charges'),
                      Row(
                        children: [
                          Expanded(
                            child: _CheckboxCard(
                              title: 'Garden Space',
                              subtitle: _money(_gardenRate),
                              value: _chargeGarden,
                              onChanged: (v) =>
                                  setState(() => _chargeGarden = v ?? false),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _CheckboxCard(
                              title: 'Video Shoot',
                              subtitle: _money(_videoShootRate) + ' (8-9am)',
                              value: _chargeVideoShoot,
                              onChanged: (v) => setState(
                                  () => _chargeVideoShoot = v ?? false),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _CheckboxCard(
                              title: 'Party Space',
                              subtitle: _money(_partySpaceRate),
                              value: _chargePartySpace,
                              onChanged: (v) => setState(
                                  () => _chargePartySpace = v ?? false),
                            ),
                          ),
                        ],
                      ),
                      if (_isVideoShootWeekdayWarning) ...[
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppColors.kWarning.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                                color: AppColors.kWarning.withOpacity(0.5)),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.info_outline,
                                  color: AppColors.kWarning, size: 18),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Video shoots are restricted to 8:00 AM – 9:00 AM on Weekdays only.',
                                  style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.kWarning),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],

                      const SizedBox(height: 20),

                      // ── 7. Static Inclusions Notice ──────────────────────
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.kPrimary.withOpacity(0.06),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                              color: AppColors.kPrimary.withOpacity(0.2)),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.info_outline,
                                color: AppColors.kPrimary, size: 20),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Standard Inclusions',
                                    style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.kPrimary),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    'All packages include 500ml mineral water pp/session, high-speed Wi-Fi, flip chart paper & markers, biros & note pads. No outside food or drinks permitted.',
                                    style: TextStyle(
                                        fontSize: 11,
                                        color: isDark
                                            ? Colors.grey.shade300
                                            : Colors.grey.shade800),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 20),

                      // ── 8. Live Dynamic Breakdown Panel ──────────────────
                      _SectionHeader('Price Calculation Summary'),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: isDark
                              ? const Color(0xFF0F172A)
                              : Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.grey.shade300),
                        ),
                        child: Column(
                          children: [
                            if (_selectedPackage != 'none')
                              _SummaryLine(
                                'Package (${_packages[_selectedPackage]?['title']} × $_pax pax × $_days d)',
                                '${_money(_packageRate)} × $_pax × $_days = ${_money(_packageTotal)}',
                              ),
                            _SummaryLine(
                              'Hall (${_t(_selectedHall ?? {}, ['name']) ?? 'Hall'} × $_days d)',
                              '${_money(_hallRate)} × $_days d = ${_money(_hallTotal)}',
                            ),
                            if (_addOnsTotal > 0)
                              _SummaryLine('Add-ons (equipment × days)',
                                  _money(_addOnsTotal)),
                            if (_otherChargesTotal > 0)
                              _SummaryLine('Other space charges',
                                  _money(_otherChargesTotal)),
                            const Divider(height: 16),
                            Row(
                              mainAxisAlignment:
                                  MainAxisAlignment.spaceBetween,
                              children: [
                                const Text('Total (VAT inclusive)',
                                    style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14)),
                                Text(
                                  _money(_grandTotal),
                                  style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 18,
                                      color: AppColors.kPrimary),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 20),

                      // ── 9. Notes & Payment Deposit ───────────────────────
                      _SectionHeader('Notes & Deposit'),
                      TextFormField(
                        controller: _notesCtrl,
                        decoration: _inputDec('Special requests or notes'),
                        maxLines: 2,
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _depositCtrl,
                              decoration:
                                  _inputDec('Advance payment / Deposit'),
                              keyboardType: TextInputType.number,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: DropdownButtonFormField<String>(
                              value: _paymentMethod,
                              decoration: _inputDec('Payment method'),
                              items: const [
                                DropdownMenuItem(
                                    value: 'cash', child: Text('Cash')),
                                DropdownMenuItem(
                                    value: 'mpesa', child: Text('M-Pesa')),
                                DropdownMenuItem(
                                    value: 'bank',
                                    child: Text('Card / Bank')),
                                DropdownMenuItem(
                                    value: 'invoice',
                                    child: Text('Invoice / Bill Later')),
                              ],
                              onChanged: (v) =>
                                  setState(() => _paymentMethod = v!),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        value: _bookingStatus,
                        decoration: _inputDec('Booking status'),
                        items: const [
                          DropdownMenuItem(
                              value: 'confirmed', child: Text('Confirmed')),
                          DropdownMenuItem(
                              value: 'pending',
                              child: Text('Pending (tentative)')),
                        ],
                        onChanged: (v) =>
                            setState(() => _bookingStatus = v!),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            const Divider(height: 1, thickness: 1),

            // ── Pinned Footer Actions ────────────────────────────────────────
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              color: isDark ? const Color(0xFF0F172A) : Colors.grey.shade50,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Total: ${_money(_grandTotal)}',
                    style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: AppColors.kPrimary),
                  ),
                  Row(
                    children: [
                      TextButton(
                        onPressed:
                            _submitting ? null : () => Navigator.pop(context),
                        child: const Text('Cancel'),
                      ),
                      const SizedBox(width: 12),
                      FilledButton.icon(
                        onPressed: _submitting ? null : _submit,
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.kPrimary,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 20, vertical: 12),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8)),
                        ),
                        icon: _submitting
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.check, size: 18),
                        label: Text(_submitting ? 'Saving…' : 'Save Booking'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Helpers for Booking Dialog ───────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text,
          style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.kPrimary)),
    );
  }
}

class _CheckboxCard extends StatelessWidget {
  const _CheckboxCard({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool?> onChanged;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return InkWell(
      onTap: () => onChanged(!value),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: value
              ? AppColors.kPrimary.withOpacity(0.1)
              : (isDark ? Colors.grey.shade900 : Colors.grey.shade100),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: value ? AppColors.kPrimary : Colors.grey.shade300,
            width: value ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Checkbox(
              value: value,
              onChanged: onChanged,
              visualDensity: VisualDensity.compact,
              activeColor: AppColors.kPrimary,
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w600)),
                  Text(subtitle,
                      style: TextStyle(
                          fontSize: 10, color: AppColors.kTextSecondary)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryLine extends StatelessWidget {
  const _SummaryLine(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(fontSize: 12, color: AppColors.kTextSecondary)),
          Text(value,
              style:
                  const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

// ─── Payment Dialog ───────────────────────────────────────────────────────────

class _PaymentDialog extends StatefulWidget {
  const _PaymentDialog({required this.booking, required this.onSubmit});
  final Map<String, dynamic> booking;
  final Future<void> Function(num amount, String method) onSubmit;

  @override
  State<_PaymentDialog> createState() => _PaymentDialogState();
}

class _PaymentDialogState extends State<_PaymentDialog> {
  final _ctrl = TextEditingController();
  String _method = 'cash';
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    // Pre-fill with balance
    final total = _n(widget.booking, ['total_amount']);
    final paid = _n(widget.booking, ['paid_amount', 'amount_paid']);
    final balance = total - paid;
    if (balance > 0) _ctrl.text = balance.round().toString();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final company = _t(widget.booking, ['company_name']) ?? '';
    final total = _n(widget.booking, ['total_amount']);
    final paid = _n(widget.booking, ['paid_amount', 'amount_paid']);
    final balance = total - paid;

    return AlertDialog(
      shape:
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      title: Row(
        children: [
          Icon(Icons.payments_outlined, color: AppColors.kSuccess),
          const SizedBox(width: 8),
          const Text('Add Payment'),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (company.isNotEmpty) ...[
            Text('Client: $company',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
          ],
          Row(
            children: [
              _Detail('Total', _money(total)),
              const SizedBox(width: 20),
              _Detail('Paid', _money(paid), color: AppColors.kSuccess),
              const SizedBox(width: 20),
              _Detail('Balance', _money(balance), color: AppColors.kError),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _ctrl,
            autofocus: true,
            keyboardType:
                const TextInputType.numberWithOptions(decimal: true),
            decoration: _inputDec('Amount (KES) *'),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _method,
            decoration: _inputDec('Payment method'),
            items: const [
              DropdownMenuItem(value: 'cash', child: Text('Cash')),
              DropdownMenuItem(value: 'mpesa', child: Text('M-Pesa')),
              DropdownMenuItem(value: 'card', child: Text('Card / Bank')),
            ],
            onChanged: (v) => setState(() => _method = v ?? 'cash'),
          ),
        ],
      ),
      actions: [
        TextButton(
            onPressed: _loading ? null : () => Navigator.pop(context),
            child: const Text('Cancel')),
        FilledButton(
          onPressed: _loading
              ? null
              : () async {
                  final v = num.tryParse(_ctrl.text.trim()) ?? 0;
                  if (v <= 0) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                          content: const Text('Enter a valid amount'),
                          backgroundColor: AppColors.kError),
                    );
                    return;
                  }
                  setState(() => _loading = true);
                  try {
                    await widget.onSubmit(v, _method);
                    if (mounted) Navigator.pop(context);
                  } catch (e) {
                    if (mounted) {
                      setState(() => _loading = false);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                            content: Text(apiErrorMessage(e,
                                fallback: 'Payment failed')),
                            backgroundColor: AppColors.kError),
                      );
                    }
                  }
                },
          child: _loading
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white))
              : const Text('Record Payment'),
        ),
      ],
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────


InputDecoration _inputDec(String label) => InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
      floatingLabelBehavior: FloatingLabelBehavior.auto,
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppColors.kPrimary, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    );

String _capitalize(String s) =>
    s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';

Future<void> printConferenceBookingInvoice({
  required String bookingRef,
  required String branchName,
  required DateTime bookingDate,
  required String clientName,
  required String customerPhone,
  required String organization,
  required String hallName,
  required int hallCapacity,
  required String packageTitle,
  required num packageRate,
  required int pax,
  required int days,
  required num packageTotal,
  required num hallRate,
  required num hallTotal,
  required bool addProjector,
  required bool addPaSystem,
  required bool chargeGarden,
  required bool chargeVideoShoot,
  required bool chargePartySpace,
  required num grandTotal,
  required num depositPaid,
  required String paymentMethod,
  required String bookingStatus,
  required String notes,
}) async {
  final pdf = pw.Document();

  final balanceDue = math.max(0, grandTotal - depositPaid);
  final paymentStatus = depositPaid >= grandTotal && grandTotal > 0
      ? 'PAID'
      : (depositPaid > 0 ? 'PARTIAL' : 'UNPAID');

  pdf.addPage(
    pw.Page(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(32),
      build: (pw.Context context) {
        return pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            // Header
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('FAMOUSGATE HOTELS',
                        style: pw.TextStyle(
                            fontSize: 18,
                            fontWeight: pw.FontWeight.bold,
                            color: PdfColors.blue900)),
                    pw.Text('$branchName Branch • Conference & Events',
                        style: const pw.TextStyle(
                            fontSize: 10, color: PdfColors.grey700)),
                    pw.Text('Tel: +254 700 000 000 | bookings@famousgatehotels.com',
                        style: const pw.TextStyle(
                            fontSize: 9, color: PdfColors.grey600)),
                  ],
                ),
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.end,
                  children: [
                    pw.Container(
                      padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: pw.BoxDecoration(
                        color: PdfColors.blue900,
                        borderRadius: pw.BorderRadius.circular(4),
                      ),
                      child: pw.Text('CONFERENCE INVOICE',
                          style: pw.TextStyle(
                              fontSize: 11,
                              fontWeight: pw.FontWeight.bold,
                              color: PdfColors.white)),
                    ),
                    pw.SizedBox(height: 4),
                    pw.Text('Ref #: $bookingRef',
                        style: pw.TextStyle(
                            fontSize: 10, fontWeight: pw.FontWeight.bold)),
                    pw.Text('Date: ${DateFormat('dd MMM yyyy').format(bookingDate)}',
                        style: const pw.TextStyle(fontSize: 9)),
                  ],
                ),
              ],
            ),
            pw.SizedBox(height: 16),
            pw.Divider(thickness: 1, color: PdfColors.grey300),
            pw.SizedBox(height: 12),

            // Client & Event Details Box
            pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Expanded(
                  child: pw.Container(
                    padding: const pw.EdgeInsets.all(10),
                    decoration: pw.BoxDecoration(
                      color: PdfColors.grey100,
                      borderRadius: pw.BorderRadius.circular(6),
                    ),
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text('CLIENT / ORGANIZER DETAILS',
                            style: pw.TextStyle(
                                fontSize: 9,
                                fontWeight: pw.FontWeight.bold,
                                color: PdfColors.blue900)),
                        pw.SizedBox(height: 4),
                        pw.Text('Client Name: $clientName',
                            style: pw.TextStyle(
                                fontSize: 10, fontWeight: pw.FontWeight.bold)),
                        pw.Text('Phone: $customerPhone',
                            style: const pw.TextStyle(fontSize: 9)),
                        if (organization.isNotEmpty)
                          pw.Text('Organization: $organization',
                              style: const pw.TextStyle(fontSize: 9)),
                      ],
                    ),
                  ),
                ),
                pw.SizedBox(width: 12),
                pw.Expanded(
                  child: pw.Container(
                    padding: const pw.EdgeInsets.all(10),
                    decoration: pw.BoxDecoration(
                      color: PdfColors.grey100,
                      borderRadius: pw.BorderRadius.circular(6),
                    ),
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text('HALL & RESERVATION DETAILS',
                            style: pw.TextStyle(
                                fontSize: 9,
                                fontWeight: pw.FontWeight.bold,
                                color: PdfColors.blue900)),
                        pw.SizedBox(height: 4),
                        pw.Text('Conference Hall: $hallName ($hallCapacity pax max)',
                            style: pw.TextStyle(
                                fontSize: 10, fontWeight: pw.FontWeight.bold)),
                        pw.Text('Delegates: $pax pax | Duration: $days day(s)',
                            style: const pw.TextStyle(fontSize: 9)),
                        pw.Text('Booking Status: ${bookingStatus.toUpperCase()}',
                            style: const pw.TextStyle(fontSize: 9)),
                      ],
                    ),
                  ),
                ),
              ],
            ),

            pw.SizedBox(height: 16),

            // Itemized Charges Table
            pw.Table(
              border: pw.TableBorder.all(color: PdfColors.grey300, width: 0.5),
              children: [
                // Header
                pw.TableRow(
                  decoration: const pw.BoxDecoration(color: PdfColors.grey200),
                  children: [
                    pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('Item Description',
                            style: pw.TextStyle(
                                fontSize: 9, fontWeight: pw.FontWeight.bold))),
                    pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('Qty / Rate',
                            style: pw.TextStyle(
                                fontSize: 9, fontWeight: pw.FontWeight.bold))),
                    pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('Total (KES)',
                            style: pw.TextStyle(
                                fontSize: 9, fontWeight: pw.FontWeight.bold),
                            textAlign: pw.TextAlign.right)),
                  ],
                ),
                // Package line
                if (packageRate > 0)
                  pw.TableRow(
                    children: [
                      pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text('Conference Package: $packageTitle',
                              style: const pw.TextStyle(fontSize: 9))),
                      pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text(
                              '${_kCurrency.format(packageRate)} pp × $pax pax × $days d',
                              style: const pw.TextStyle(fontSize: 9))),
                      pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text(_kCurrency.format(packageTotal),
                              style: const pw.TextStyle(fontSize: 9),
                              textAlign: pw.TextAlign.right)),
                    ],
                  ),
                // Hall line
                pw.TableRow(
                  children: [
                    pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('Hall Base Rental ($hallName)',
                            style: const pw.TextStyle(fontSize: 9))),
                    pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text('${_kCurrency.format(hallRate)}/day × $days d',
                            style: const pw.TextStyle(fontSize: 9))),
                    pw.Padding(
                        padding: const pw.EdgeInsets.all(6),
                        child: pw.Text(_kCurrency.format(hallTotal),
                            style: const pw.TextStyle(fontSize: 9),
                            textAlign: pw.TextAlign.right)),
                  ],
                ),
                if (addProjector)
                  pw.TableRow(
                    children: [
                      pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text('Equipment: HD Projector',
                              style: const pw.TextStyle(fontSize: 9))),
                      pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text('KES 3,500/day × $days d',
                              style: const pw.TextStyle(fontSize: 9))),
                      pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text(_kCurrency.format(3500 * days),
                              style: const pw.TextStyle(fontSize: 9),
                              textAlign: pw.TextAlign.right)),
                    ],
                  ),
                if (addPaSystem)
                  pw.TableRow(
                    children: [
                      pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text('Equipment: PA System & Microphones',
                              style: const pw.TextStyle(fontSize: 9))),
                      pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text('KES 3,500/day × $days d',
                              style: const pw.TextStyle(fontSize: 9))),
                      pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text(_kCurrency.format(3500 * days),
                              style: const pw.TextStyle(fontSize: 9),
                              textAlign: pw.TextAlign.right)),
                    ],
                  ),
                if (chargeGarden)
                  pw.TableRow(
                    children: [
                      pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text('Space Charge: Garden Grounds',
                              style: const pw.TextStyle(fontSize: 9))),
                      pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text('Fixed Rate',
                              style: const pw.TextStyle(fontSize: 9))),
                      pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text('KES 5,000',
                              style: const pw.TextStyle(fontSize: 9),
                              textAlign: pw.TextAlign.right)),
                    ],
                  ),
                if (chargeVideoShoot)
                  pw.TableRow(
                    children: [
                      pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text('Space Charge: Video Shoot (8-9am)',
                              style: const pw.TextStyle(fontSize: 9))),
                      pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text('Fixed Rate',
                              style: const pw.TextStyle(fontSize: 9))),
                      pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text('KES 5,000',
                              style: const pw.TextStyle(fontSize: 9),
                              textAlign: pw.TextAlign.right)),
                    ],
                  ),
                if (chargePartySpace)
                  pw.TableRow(
                    children: [
                      pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text('Space Charge: Party Area',
                              style: const pw.TextStyle(fontSize: 9))),
                      pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text('Fixed Rate',
                              style: const pw.TextStyle(fontSize: 9))),
                      pw.Padding(
                          padding: const pw.EdgeInsets.all(6),
                          child: pw.Text('KES 5,000',
                              style: const pw.TextStyle(fontSize: 9),
                              textAlign: pw.TextAlign.right)),
                    ],
                  ),
              ],
            ),

            pw.SizedBox(height: 12),

            // Summary Totals & Payment Box
            pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Expanded(
                  child: pw.Container(
                    padding: const pw.EdgeInsets.all(10),
                    decoration: pw.BoxDecoration(
                      border: pw.Border.all(color: PdfColors.grey300),
                      borderRadius: pw.BorderRadius.circular(6),
                    ),
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text('INCLUSIONS & TERMS',
                            style: pw.TextStyle(
                                fontSize: 8,
                                fontWeight: pw.FontWeight.bold,
                                color: PdfColors.grey800)),
                        pw.SizedBox(height: 2),
                        pw.Text(
                          'Includes 500ml mineral water pp/session, high-speed Wi-Fi, flip charts & markers, biros & note pads. No outside catering permitted.',
                          style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700),
                        ),
                        if (notes.isNotEmpty) ...[
                          pw.SizedBox(height: 4),
                          pw.Text('Notes: $notes',
                              style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold)),
                        ],
                      ],
                    ),
                  ),
                ),
                pw.SizedBox(width: 16),
                pw.Container(
                  width: 200,
                  padding: const pw.EdgeInsets.all(10),
                  decoration: pw.BoxDecoration(
                    color: PdfColors.grey100,
                    borderRadius: pw.BorderRadius.circular(6),
                  ),
                  child: pw.Column(
                    children: [
                      pw.Row(
                        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                        children: [
                          pw.Text('Total Amount:', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
                          pw.Text(_kCurrency.format(grandTotal), style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
                        ],
                      ),
                      pw.SizedBox(height: 2),
                      pw.Row(
                        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                        children: [
                          pw.Text('Deposit Paid:', style: const pw.TextStyle(fontSize: 8)),
                          pw.Text(_kCurrency.format(depositPaid), style: const pw.TextStyle(fontSize: 8)),
                        ],
                      ),
                      pw.Divider(thickness: 0.5, color: PdfColors.grey400),
                      pw.Row(
                        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                        children: [
                          pw.Text('Balance Due:', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
                          pw.Text(_kCurrency.format(balanceDue), style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: balanceDue > 0 ? PdfColors.red900 : PdfColors.green900)),
                        ],
                      ),
                      pw.SizedBox(height: 6),
                      pw.Row(
                        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                        children: [
                          pw.Text('Payment Status:', style: const pw.TextStyle(fontSize: 8)),
                          pw.Text('$paymentStatus (${paymentMethod.toUpperCase()})',
                              style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold, color: paymentStatus == 'PAID' ? PdfColors.green800 : PdfColors.orange800)),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),

            pw.Spacer(),

            // Footer Signatures
            pw.Divider(thickness: 1, color: PdfColors.grey300),
            pw.SizedBox(height: 4),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text('Issued by: Receptionist Desk', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700)),
                pw.Text('Thank you for choosing FamousGate Hotels', style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold, color: PdfColors.blue900)),
                pw.Text('Page 1 of 1', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700)),
              ],
            ),
          ],
        );
      },
    ),
  );

  await Printing.layoutPdf(
    onLayout: (PdfPageFormat format) async => pdf.save(),
    name: 'Invoice_${bookingRef}.pdf',
  );
}
