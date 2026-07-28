import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/network/dio_client.dart';
import '../../auth/domain/auth_notifier.dart';
import 'guest_invoice_pdf.dart';

/// Shared "Room Bills" view: the checked-in guests' room booking bills + their
/// folios (accommodation + Charge-to-Room POS charges). Reception embeds it
/// read-only to track; the Cashier embeds it with [canSettle]. Hotel room bills
/// no longer appear in the cashier's general Unpaid Bills — they live here.
class RoomBillsView extends ConsumerStatefulWidget {
  const RoomBillsView({super.key, this.canSettle = false, this.onPayAtCashier});

  final bool canSettle;

  /// When provided, "Pay at Cashier" hands the lookup code to this callback
  /// instead of navigating to the standalone /cashier route — so Reception can
  /// open its OWN embedded Cashier section (staying inside the Reception shell).
  final void Function(String lookupCode)? onPayAtCashier;

  @override
  ConsumerState<RoomBillsView> createState() => _RoomBillsViewState();
}

class _RoomBillsViewState extends ConsumerState<RoomBillsView> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _bills = const [];
  String _search = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Dio get _dio => ref.read(dioProvider);
  String _money(num v) => 'KES ${NumberFormat('#,##0').format(v)}';
  double _num(dynamic v) =>
      v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0;

  int? get _branchId {
    final u = ref.read(authNotifierProvider).valueOrNull;
    return int.tryParse('${u?.branchId ?? ''}');
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res =
          await _dio.get('/room-charge/eligible-guests', queryParameters: {
        if (_branchId != null) 'branch_id': _branchId,
      });
      final data = res.data;
      final list = data is Map
          ? (data['guests'] ?? data['data'] ?? [])
          : (data is List ? data : []);
      if (!mounted) return;
      setState(() {
        _bills = (list as List)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? Colors.red : Colors.green,
      behavior: SnackBarBehavior.floating,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final filtered = _search.isEmpty
        ? _bills
        : _bills.where((b) {
            final q = _search.toLowerCase();
            return [b['guest_name'], b['room_number'], b['confirmation_number']]
                .any((v) => '${v ?? ''}'.toLowerCase().contains(q));
          }).toList();
    final totalOutstanding =
        _bills.fold<double>(0, (s, b) => s + _num(b['folio_balance']));

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Room Bills',
                        style: theme.textTheme.titleLarge
                            ?.copyWith(fontWeight: FontWeight.w700)),
                    Text(
                      'Checked-in guests’ room booking bills & folios'
                      '${widget.canSettle ? ' — pay or invoice a guest.' : '.'}',
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: Colors.grey),
                    ),
                  ],
                ),
              ),
              _pill('${filtered.length} room(s)', Colors.indigo),
              const SizedBox(width: 8),
              _pill('Outstanding ${_money(totalOutstanding)}', Colors.orange),
              const SizedBox(width: 8),
              OutlinedButton.icon(
                onPressed: _loading ? null : _load,
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Refresh'),
              ),
            ],
          ),
          const SizedBox(height: 14),
          TextField(
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search),
              hintText: 'Search guest, room or confirmation code',
              isDense: true,
              filled: true,
              fillColor: Colors.grey.shade100,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
            onChanged: (v) => setState(() => _search = v),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? _errorState()
                    : filtered.isEmpty
                        ? const Center(
                            child: Text('No checked-in room bills.',
                                style: TextStyle(color: Colors.grey)))
                        : GridView.builder(
                            gridDelegate:
                                const SliverGridDelegateWithMaxCrossAxisExtent(
                              maxCrossAxisExtent: 560,
                              mainAxisExtent: 92,
                              crossAxisSpacing: 12,
                              mainAxisSpacing: 12,
                            ),
                            itemCount: filtered.length,
                            itemBuilder: (_, i) => _billCard(filtered[i], theme),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _pill(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: color.withOpacity(0.10),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(text,
            style: TextStyle(
                color: color, fontWeight: FontWeight.w700, fontSize: 12)),
      );

  Widget _errorState() => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Failed to load: $_error',
                style: const TextStyle(color: Colors.red)),
            const SizedBox(height: 12),
            FilledButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry')),
          ],
        ),
      );

  Widget _billCard(Map<String, dynamic> b, ThemeData theme) {
    final balance = _num(b['folio_balance']);
    final settled = balance <= 0.01;
    return Material(
      color: theme.colorScheme.surface,
      borderRadius: BorderRadius.circular(14),
      elevation: 0.5,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => _openFolio(b),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor:
                    settled ? Colors.green.shade50 : Colors.indigo.shade50,
                child: Text(
                  '${b['room_number'] ?? '?'}'.split(' ').last,
                  style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: settled ? Colors.green : Colors.indigo),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Room ${b['room_number'] ?? '—'}  •  ${b['guest_name'] ?? 'Guest'}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(
                      '${b['confirmation_number'] ?? ''}  •  ${b['stay_nights'] ?? 0} night(s)  •  Booking ${_money(_num(b['total_amount']))}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: Colors.grey.shade600),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(_money(balance),
                      style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                          color: settled ? Colors.green : Colors.black87)),
                  Text(settled ? 'Settled' : 'Outstanding',
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: settled ? Colors.green : Colors.orange)),
                ],
              ),
              const Icon(Icons.chevron_right, color: Colors.grey),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openFolio(Map<String, dynamic> bill) async {
    final reservationId = '${bill['booking_id'] ?? ''}';
    if (reservationId.isEmpty) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _FolioSheet(
        reservationId: reservationId,
        bill: bill,
        onSnack: _snack,
        onPayAtCashier: widget.onPayAtCashier,
      ),
    );
    // Refresh after returning (e.g. paid at the cashier) so balances update.
    if (mounted) await _load();
  }
}

class _FolioSheet extends ConsumerStatefulWidget {
  const _FolioSheet({
    required this.reservationId,
    required this.bill,
    required this.onSnack,
    this.onPayAtCashier,
  });

  final String reservationId;
  final Map<String, dynamic> bill;
  final void Function(String, {bool error}) onSnack;
  final void Function(String lookupCode)? onPayAtCashier;

  @override
  ConsumerState<_FolioSheet> createState() => _FolioSheetState();
}

class _FolioSheetState extends ConsumerState<_FolioSheet> {
  bool _loading = true;
  bool _busy = false;
  String? _error;
  Map<String, dynamic> _folio = const {};
  List<Map<String, dynamic>> _txns = const [];

  Dio get _dio => ref.read(dioProvider);
  Map<String, dynamic> get _b => widget.bill;
  String _money(num v) => 'KES ${NumberFormat('#,##0').format(v)}';
  double _num(dynamic v) =>
      v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0;
  String _s(dynamic v) => '${v ?? ''}'.trim();
  String _date(dynamic v) {
    final d = DateTime.tryParse('${v ?? ''}');
    return d == null ? '${v ?? '—'}' : DateFormat('EEE d MMM yyyy').format(d);
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await _dio.get('/folios/reservation/${widget.reservationId}');
      final data = res.data is Map ? res.data['data'] ?? res.data : {};
      if (!mounted) return;
      setState(() {
        _folio = Map<String, dynamic>.from((data['folio'] ?? {}) as Map);
        final t = data['transactions'];
        _txns = t is List
            ? t.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
            : const [];
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  // The guest owes: the ROOM BOOKING (accommodation) PLUS every Charge-to-Room
  // POS bill. The folios table columns aren't reliably kept in step, so the
  // real folio transaction LINES + the reservation booking are the source of
  // truth: total = room booking + Σ(charge lines); balance = total − payments.
  // Folio JSON may arrive snake_case OR camelCase depending on the serializer.
  double _fnum(Map<String, dynamic> m, List<String> keys) {
    for (final k in keys) {
      if (m[k] != null) return _num(m[k]);
    }
    return 0;
  }

  double get _txnCharges => _txns
      .where((t) => _s(t['type']) == 'charge')
      .fold(0.0, (s, t) => s + _num(t['amount']));
  double get _txnPayments => _txns
      .where((t) => _s(t['type']) == 'payment')
      .fold(0.0, (s, t) => s + _num(t['amount']));

  // Charge-to-Room POS bills live in the food/beverage/other folio buckets AND
  // as 'charge' transaction lines — take whichever is larger so nothing is lost.
  double get _bucketCharges =>
      _fnum(_folio, ['food_charges', 'foodCharges']) +
      _fnum(_folio, ['beverage_charges', 'beverageCharges']) +
      _fnum(_folio, ['other_charges', 'otherCharges']);
  double get _posCharges =>
      _txnCharges > _bucketCharges ? _txnCharges : _bucketCharges;

  // Room / accommodation (folio column if set, else the reservation booking).
  double get _roomCharge {
    final r = _fnum(_folio, ['room_charges', 'roomCharges']);
    return r > 0 ? r : _num(_b['total_amount']);
  }

  double get _totalCharges => _roomCharge + _posCharges;

  // Largest payment figure across sources, so a partial payment recorded
  // anywhere (folio settle / cashier station) is reflected and the remainder
  // stays outstanding on the room bill + guest invoice.
  double get _totalPayments {
    final vals = [
      _txnPayments,
      _fnum(_folio, ['total_payments', 'totalPayments']),
      _num(_b['amount_paid']),
      _num(_b['folio_payments']),
    ];
    return vals.reduce((a, b) => a > b ? a : b);
  }

  double get _balance {
    final v = _totalCharges - _totalPayments;
    return v < 0 ? 0 : v;
  }

  String get _lookupCode =>
      _s(_b['confirmation_number']).isNotEmpty ? _s(_b['confirmation_number']) : widget.reservationId;

  void _pay() {
    // Hand off to the Cashier pre-loaded with the room bill lookup code; the
    // cashier resolves the HTL reservation and shows the guest + WHOLE folio
    // bill. Prefer the host's embedded cashier (keeps the Reception shell); only
    // fall back to the standalone /cashier route when no host callback is given.
    Navigator.of(context).pop();
    if (widget.onPayAtCashier != null) {
      widget.onPayAtCashier!(_lookupCode);
    } else {
      context.go('/cashier?billRef=${Uri.encodeComponent(_lookupCode)}');
    }
  }

  Future<void> _generateInvoice() async {
    setState(() => _busy = true);
    try {
      final nightsStr = _s(_b['stay_nights']);
      final nightsInt = int.tryParse(nightsStr) ?? 1;
      final nights = nightsInt > 0 ? nightsInt : 1;

      final items = <Map<String, dynamic>>[];

      // 1. Accommodation line item
      items.add({
        'description':
            'Room ${_s(_b['room_number'])} Accommodation ($nights Night(s) Stay)',
        'qty': nights,
        'unitPrice': nights > 0 ? (_roomCharge / nights) : _roomCharge,
        'totalAmount': _roomCharge,
      });

      // 2. Individual Charge-to-Room POS transactions or summary
      final chargeTxns =
          _txns.where((t) => _s(t['type']) == 'charge').toList();
      for (final t in chargeTxns) {
        final amt = _num(t['amount']);
        final desc = _s(t['description']).isNotEmpty
            ? _s(t['description'])
            : (_s(t['category']).isNotEmpty
                ? _s(t['category'])
                : 'Charge to Room');
        items.add({
          'description': desc,
          'qty': 1,
          'unitPrice': amt,
          'totalAmount': amt,
        });
      }

      if (chargeTxns.isEmpty && _posCharges > 0) {
        items.add({
          'description': 'Restaurant / Bar POS Room Charges',
          'qty': 1,
          'unitPrice': _posCharges,
          'totalAmount': _posCharges,
        });
      }

      final todayStr = DateFormat('dd/MM/yyyy').format(DateTime.now());
      final checkOutStr = _s(_b['check_out_date']).isNotEmpty
          ? DateFormat('dd/MM/yyyy').format(
              DateTime.tryParse(_s(_b['check_out_date'])) ?? DateTime.now())
          : todayStr;

      await printBookingInvoicePDF(
        context: context,
        invoiceNumber: _lookupCode,
        invoiceDate: todayStr,
        dueDate: checkOutStr,
        clientName:
            _s(_b['guest_name']).isNotEmpty ? _s(_b['guest_name']) : 'Guest',
        clientPhone: _s(_b['guest_phone']),
        clientDetails:
            'Room ${_s(_b['room_number'])} • Stay: $nights Night(s) • Folio: $_lookupCode',
        items: items,
        totalAmount: _totalCharges,
        amountPaid: _totalPayments,
        balanceDue: _balance,
        notes:
            'Thank you for staying at FamousGate Hotels! Visit www.famousgatehotels.com',
      );
      widget.onSnack('Official Guest Invoice generated for Room ${_s(_b['room_number'])}.');
    } catch (e) {
      widget.onSnack('Invoice print failed: $e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DraggableScrollableSheet(
      initialChildSize: 0.88,
      minChildSize: 0.5,
      maxChildSize: 0.96,
      expand: false,
      builder: (_, controller) => Container(
        decoration: const BoxDecoration(
          color: Color(0xFFF7F8FB),
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            _header(theme),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                      ? Center(
                          child: Text('Failed: $_error',
                              style: const TextStyle(color: Colors.red)))
                      : ListView(
                          controller: controller,
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                          children: [
                            _guestCard(theme),
                            const SizedBox(height: 12),
                            _chargesCard(theme),
                            const SizedBox(height: 12),
                            _transactionsCard(theme),
                          ],
                        ),
            ),
            _bottomBar(theme),
          ],
        ),
      ),
    );
  }

  Widget _header(ThemeData theme) {
    final settled = _balance <= 0.01;
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 18, 12, 16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.indigo.shade600, Colors.indigo.shade400],
        ),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Row(
        children: [
          const CircleAvatar(
            backgroundColor: Colors.white24,
            child: Icon(Icons.meeting_room, color: Colors.white),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Room ${_s(_b['room_number'])} — ${_s(_b['guest_name'])}',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w700)),
                Text('Folio ${_s(_b['confirmation_number'])}',
                    style: const TextStyle(color: Colors.white70, fontSize: 12)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: settled ? Colors.green : Colors.orange,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(settled ? 'Settled' : 'Outstanding',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w700)),
          ),
          IconButton(
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.close, color: Colors.white),
          ),
        ],
      ),
    );
  }

  Widget _card({required Widget child}) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: child,
      );

  Widget _guestCard(ThemeData theme) => _card(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Guest & stay',
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
            Wrap(
              runSpacing: 10,
              children: [
                _info('Guest', _s(_b['guest_name']), Icons.person_outline),
                _info('Room', _s(_b['room_number']), Icons.hotel_outlined),
                _info('Phone', _s(_b['guest_phone']).isEmpty ? '—' : _s(_b['guest_phone']),
                    Icons.phone_outlined),
                _info('Confirmation', _s(_b['confirmation_number']),
                    Icons.confirmation_number_outlined),
                _info('Check-in', _date(_b['check_in_date']),
                    Icons.login_outlined),
                _info('Check-out', _date(_b['check_out_date']),
                    Icons.logout_outlined),
                _info('Nights', _s(_b['stay_nights']), Icons.nightlight_outlined),
                _info('Guests', _s(_b['occupants']), Icons.people_outline),
                _info('Meal plan', _s(_b['meal_plan']).isEmpty ? 'Room Only' : _s(_b['meal_plan']),
                    Icons.restaurant_outlined),
              ],
            ),
          ],
        ),
      );

  Widget _info(String label, String value, IconData icon) => SizedBox(
        width: 220,
        child: Row(
          children: [
            Icon(icon, size: 18, color: Colors.indigo.shade300),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(
                          fontSize: 11, color: Colors.grey)),
                  Text(value.isEmpty ? '—' : value,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _chargesCard(ThemeData theme) => _card(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Charges',
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            _row('Room / Accommodation', _roomCharge),
            if (_posCharges > 0)
              _row('Charge-to-Room (POS bills)', _posCharges),
            const Divider(height: 20),
            _row('Total charges', _totalCharges, bold: true),
            _row('Total payments', _totalPayments,
                bold: true, positive: true),
          ],
        ),
      );

  Widget _transactionsCard(ThemeData theme) => _card(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Folio transactions',
                style: theme.textTheme.titleSmall
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            if (_txns.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text('No charges or payments posted yet.',
                    style: TextStyle(color: Colors.grey)),
              )
            else
              for (final t in _txns) _txnRow(t, theme),
          ],
        ),
      );

  Widget _row(String label, double amount,
      {bool bold = false, bool positive = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
              child: Text(label,
                  style: TextStyle(
                      fontWeight: bold ? FontWeight.w700 : FontWeight.w400))),
          Text(
            '${positive && amount > 0 ? '-' : ''}${_money(amount)}',
            style: TextStyle(
                fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
                color: positive && amount > 0 ? Colors.green : null),
          ),
        ],
      ),
    );
  }

  Widget _txnRow(Map<String, dynamic> t, ThemeData theme) {
    final isPayment = _s(t['type']) == 'payment';
    final amount = _num(t['amount']);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Icon(isPayment ? Icons.south_west : Icons.north_east,
              size: 16, color: isPayment ? Colors.green : Colors.indigo),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
                _s(t['description']).isNotEmpty
                    ? _s(t['description'])
                    : (_s(t['category']).isNotEmpty
                        ? _s(t['category'])
                        : _s(t['type'])),
                style: theme.textTheme.bodyMedium),
          ),
          Text('${isPayment ? '-' : '+'}${_money(amount)}',
              style: TextStyle(
                  color: isPayment ? Colors.green : Colors.black87,
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _bottomBar(ThemeData theme) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey.shade200)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Row(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Balance due',
                      style: TextStyle(color: Colors.grey, fontSize: 12)),
                  Text(_money(_balance),
                      style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: _balance <= 0.01
                              ? Colors.green
                              : Colors.black87)),
                ],
              ),
              const Spacer(),
              OutlinedButton.icon(
                onPressed: _busy || _loading ? null : _generateInvoice,
                icon: _busy
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.print_outlined),
                label: const Text('Generate Invoice'),
                style: OutlinedButton.styleFrom(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                ),
              ),
              const SizedBox(width: 12),
              FilledButton.icon(
                onPressed: _loading || _balance <= 0.01 ? null : _pay,
                icon: const Icon(Icons.point_of_sale),
                label: const Text('Pay at Cashier'),
                style: FilledButton.styleFrom(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
