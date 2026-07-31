import 'package:flutter/material.dart';
import '../../domain/models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../shared/presentation/guest_invoice_pdf.dart';
import '../../data/repository.dart';

class CheckOutScreen extends ConsumerStatefulWidget {
  final Booking? booking;
  final void Function(String lookupCode)? onPayAtCashier;

  const CheckOutScreen({super.key, this.booking, this.onPayAtCashier});

  @override
  ConsumerState<CheckOutScreen> createState() => _CheckOutScreenState();
}

class _CheckOutScreenState extends ConsumerState<CheckOutScreen> {
  late final ReceptionRepository _repository;
  final _searchController = TextEditingController();

  Booking? _selectedBooking;
  bool _isSearching = false;
  bool _isSubmitting = false;
  bool _loadingFolio = false;

  // Folio data
  Map<String, dynamic>? _folio;
  double _totalCharges = 0;
  double _totalPayments = 0;
  List<Map<String, dynamic>> _transactions = [];
  List<Map<String, dynamic>> _folioItems = [];
  List<Map<String, dynamic>> _chargeLines = [];

  // Payment
  final _notesController = TextEditingController();

  // Additional Services
  final _serviceNameController = TextEditingController();
  final _servicePriceController = TextEditingController();
  String? _editingServiceId;
  bool _savingService = false;

  bool _isAdditionalServiceTransaction(Map<String, dynamic> tx) {
    final type = '${tx['type'] ?? tx['transaction_type'] ?? ''}'.trim().toLowerCase();
    final status = '${tx['status'] ?? ''}'.trim().toLowerCase();
    final voided = tx['voided'] == true;
    if (voided || status == 'voided' || status == 'cancelled' || status == 'reversed') {
      return false;
    }
    return type != 'payment';
  }

  List<Map<String, dynamic>> get _additionalServiceTransactions =>
      _transactions.where(_isAdditionalServiceTransaction).toList();

  double get _additionalServicesTotal =>
      _additionalServiceTransactions.fold<double>(
        0,
        (sum, service) =>
            sum + ((service['amount'] as num?)?.toDouble() ?? 0.0),
      );

  double get _displayOtherCharges =>
      ((_folio?['other_charges'] as num?)?.toDouble() ?? 0.0);

  double get _displayTotalCharges => _totalCharges;

  double get _displayBalance {
    final value = _displayTotalCharges - _totalPayments;
    return value > 0 ? value : 0.0;
  }

  bool get _isEditingService => _editingServiceId != null;

  String _serviceReferenceLabel(Map<String, dynamic> tx) {
    final explicit = '${tx['reference'] ?? tx['referenceNumber'] ?? ''}'.trim();
    if (explicit.isNotEmpty) return explicit;
    final id = '${tx['id'] ?? ''}'.replaceAll('-', '').toUpperCase();
    if (id.isEmpty) return 'SERVICE';
    final short = id.length > 8 ? id.substring(0, 8) : id;
    return 'AS-$short';
  }

  @override
  void initState() {
    _repository = ref.read(receptionRepositoryProvider);
    super.initState();
    if (widget.booking != null) {
      _selectedBooking = widget.booking;
      _loadFolio();
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _notesController.dispose();
    _serviceNameController.dispose();
    _servicePriceController.dispose();
    super.dispose();
  }

  Future<void> _searchBooking() async {
    final query = _searchController.text.trim();
    if (query.isEmpty) return;

    setState(() => _isSearching = true);
    try {
      final bookings = await _repository.getBookings(status: 'checked_in');
      final found = bookings.where((b) {
        final q = query.toLowerCase();
        final conf = b.confirmationNumber?.toLowerCase() ?? '';
        final guest = b.guestName?.toLowerCase() ?? '';
        final room = b.roomNumber?.toLowerCase() ?? '';
        return conf.contains(q) || guest.contains(q) || room.contains(q);
      }).toList();

      if (found.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content: Text('No matching checked-in guests found')),
          );
        }
        setState(() => _isSearching = false);
      } else if (found.length == 1) {
        setState(() {
          _selectedBooking = found.first;
          _isSearching = false;
        });
        _loadFolio();
      } else {
        // Show selection dialog
        if (mounted) {
          final selected = await showDialog<Booking>(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Select Guest'),
              content: SizedBox(
                width: double.maxFinite,
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: found.length,
                  itemBuilder: (context, index) {
                    final booking = found[index];
                    return ListTile(
                      title: Text(booking.guestName ?? 'Guest'),
                      subtitle: Text(
                          'Room ${booking.roomNumber ?? "-"} • ${booking.confirmationNumber ?? "-"}'),
                      onTap: () => Navigator.of(context).pop(booking),
                    );
                  },
                ),
              ),
            ),
          );
          if (selected != null) {
            setState(() {
              _selectedBooking = selected;
              _isSearching = false;
            });
            _loadFolio();
          }
        }
      }
    } catch (e) {
      setState(() => _isSearching = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Search failed: $e')),
        );
      }
    }
  }

  Future<void> _loadFolio() async {
    if (_selectedBooking == null || _selectedBooking!.id.isEmpty) return;

    setState(() => _loadingFolio = true);
    try {
      final raw = await _repository.getFolio(_selectedBooking!.id);
      final folioMap = (raw['folio'] is Map)
          ? Map<String, dynamic>.from(raw['folio'] as Map)
          : raw;

      final bookingTotal = _selectedBooking?.totalAmount ?? 0.0;
      final depositPaid = _selectedBooking?.raw['deposit_paid'] == true ||
          _selectedBooking?.raw['depositPaid'] == true;
      final bookingPaid = depositPaid
          ? (_selectedBooking?.amountPaid ??
              _selectedBooking?.depositAmount ??
              0.0)
          : (_selectedBooking?.amountPaid ?? 0.0);

      final rawRoom =
          (folioMap['room_charges'] ?? folioMap['roomCharges']) as num?;
      final rawFood =
          (folioMap['food_charges'] ?? folioMap['foodCharges']) as num?;
      final rawBev =
          (folioMap['beverage_charges'] ?? folioMap['beverageCharges']) as num?;
      final rawOther =
          (folioMap['other_charges'] ?? folioMap['otherCharges']) as num?;
      final rawTotal =
          (folioMap['total_charges'] ?? folioMap['totalCharges']) as num?;
      final rawPayments =
          (folioMap['total_payments'] ?? folioMap['totalPayments']) as num?;

      final rCharges = (rawRoom != null && rawRoom.toDouble() > 0)
          ? rawRoom.toDouble()
          : bookingTotal;
      final fCharges = rawFood?.toDouble() ?? 0.0;
      final bCharges = rawBev?.toDouble() ?? 0.0;
      final oCharges = rawOther?.toDouble() ?? 0.0;

      final calcTotal = (rawTotal != null && rawTotal.toDouble() > 0)
          ? rawTotal.toDouble()
          : (rCharges + fCharges + bCharges + oCharges);

      final calcPayments = (rawPayments != null && rawPayments.toDouble() > 0)
          ? rawPayments.toDouble()
          : bookingPaid;

      final txList = raw['transactions'] is List
          ? List<Map<String, dynamic>>.from(raw['transactions'])
          : (folioMap['transactions'] is List
              ? List<Map<String, dynamic>>.from(folioMap['transactions'])
              : <Map<String, dynamic>>[]);

      final itemList = raw['items'] is List
          ? (raw['items'] as List)
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList()
          : <Map<String, dynamic>>[];

      final chargeList = raw['charge_lines'] is List
          ? (raw['charge_lines'] as List)
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList()
          : <Map<String, dynamic>>[];
      final reservationMap = raw['reservation'] is Map
          ? Map<String, dynamic>.from(raw['reservation'] as Map)
          : null;

      Booking? refreshedBooking;
      if (reservationMap != null && reservationMap.isNotEmpty) {
        refreshedBooking = Booking.fromJson({
          ...reservationMap,
          'guest_name': reservationMap['guest_name'] ??
              _selectedBooking?.guestName,
          'guest_phone': reservationMap['guest_phone'] ??
              _selectedBooking?.guestPhone,
          'guest_email': reservationMap['guest_email'] ??
              _selectedBooking?.guestEmail,
          'room_number': reservationMap['room_number'] ??
              _selectedBooking?.roomNumber,
          'room_type': reservationMap['room_type'] ??
              _selectedBooking?.roomType,
          'confirmation_number': reservationMap['confirmation_number'] ??
              _selectedBooking?.confirmationNumber,
        });
      }

      setState(() {
        if (refreshedBooking != null) {
          _selectedBooking = refreshedBooking;
        }
        _folio = {
          'room_charges': rCharges,
          'food_charges': fCharges,
          'beverage_charges': bCharges,
          'other_charges': oCharges,
        };
        _totalCharges = calcTotal;
        _totalPayments = calcPayments;
        _transactions = txList;
        _folioItems = itemList;
        _chargeLines = chargeList;
        _loadingFolio = false;
      });
    } catch (e) {
      setState(() => _loadingFolio = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load folio: $e')),
        );
      }
    }
  }

  // Safe date formatter for a folio transaction. getFolio returns the timestamp
  // as `createdAt` (camelCase); it can also be absent — never crash on null.
  String _formatTxDate(dynamic raw) {
    final dt = raw == null ? null : DateTime.tryParse('$raw');
    return dt == null ? '' : DateFormat('MMM dd, HH:mm').format(dt);
  }

  Future<void> _generateInvoicePDF() async {
    if (_selectedBooking == null) return;
    // Always pull the latest folio first so the invoice reflects every POS
    // Charge-to-Room bill posted since the screen loaded.
    await _loadFolio();
    if (!mounted) return;
    final booking = _selectedBooking!;

    // Detailed lines: accommodation + one line per itemised POS Charge-to-Room
    // item (outlet · item), from the folio's itemised entries. Falls back to the
    // bucket lumps only when no itemised detail exists (never double-counts).
    final adjustedOtherCharges =
        (_displayOtherCharges - _additionalServicesTotal)
            .clamp(0.0, double.infinity);

    final items = buildFolioInvoiceItems(
      folio: {
        ...?_folio,
        'other_charges': adjustedOtherCharges,
      },
      folioItems: _folioItems,
      chargeLines: _chargeLines,
      roomLabel:
          '${booking.roomType ?? 'Room'} ${booking.roomNumber ?? ''}'.trim(),
      bookingTotal: booking.totalAmount ?? 0.0,
    );

    for (final service in _additionalServiceTransactions) {
      final amount = (service['amount'] as num?)?.toDouble() ?? 0.0;
      if (amount <= 0) continue;
      items.add({
        'description':
            '${service['description'] ?? 'Additional Service'}'.trim(),
        'qty': 1,
        'unitPrice': amount,
        'totalAmount': amount,
      });
    }

    if (items.isEmpty) {
      final fallback = _displayTotalCharges > 0
          ? _displayTotalCharges
          : (booking.totalAmount ?? 0.0);
      items.add({
        'description': 'Hotel Accommodation & Guest Services',
        'qty': 1,
        'unitPrice': fallback,
        'totalAmount': fallback,
      });
    }

    final nowStr = DateFormat('yyyy-MM-dd HH:mm').format(DateTime.now());

    await printBookingInvoicePDF(
      context: context,
      invoiceNumber: booking.confirmationNumber ??
          'REC-${booking.id.length > 8 ? booking.id.substring(0, 8) : booking.id}',
      invoiceDate: nowStr,
      dueDate: nowStr,
      clientName: booking.guestName ?? 'Guest',
      clientPhone: booking.guestPhone,
      clientDetails: 'Room ${booking.roomNumber ?? "-"}',
      items: items,
      totalAmount: _displayTotalCharges > 0
          ? _displayTotalCharges
          : (booking.totalAmount ?? 0.0),
      amountPaid: _totalPayments,
      balanceDue: _displayBalance,
      notes: 'Final guest stay invoice generated from Reception checkout.',
    );
  }

  Future<void> _showCashierSettlementGuide() async {
    if (_selectedBooking == null || _displayBalance <= 0) return;

    final booking = _selectedBooking!;
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.point_of_sale, color: AppColors.kPrimary),
            SizedBox(width: 8),
            Text('Settle at Cashier Station'),
          ],
        ),
        content: SizedBox(
          width: 420,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Guest: ${booking.guestName ?? "Guest"}',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              Text('Room ${booking.roomNumber ?? "-"}'),
              Text('Confirmation: ${booking.confirmationNumber ?? "-"}'),
              Text(
                'Outstanding balance: KES ${_displayBalance.toStringAsFixed(2)}',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: Colors.orange.shade900,
                ),
              ),
              const SizedBox(height: 14),
              const Text(
                'Use the Cashier Station to confirm payment. The official receipt is generated after cashier payment confirmation, not from the checkout screen.',
              ),
              const SizedBox(height: 10),
              const Text(
                'After the cashier settles the folio, return here, refresh the folio if needed, then complete guest checkout.',
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Future<void> _performCheckOut() async {
    if (_selectedBooking == null) return;

    if (_displayBalance > 0) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Checkout is locked until Cashier Station confirms payment of KES ${_displayBalance.toStringAsFixed(2)}.',
            ),
            backgroundColor: Colors.orange.shade800,
            duration: const Duration(seconds: 6),
          ),
        );
      }
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      // Perform check-out
      await _repository.checkOutBooking(_selectedBooking!.id);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                'Guest checked out from Room ${_selectedBooking!.roomNumber}'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Check-out failed: $e')),
        );
      }
    }
  }

  Future<void> _saveAdditionalService() async {
    if (_selectedBooking == null) return;

    final name = _serviceNameController.text.trim();
    final priceStr = _servicePriceController.text.trim();
    final price = double.tryParse(priceStr);

    if (name.isEmpty || price == null || price <= 0) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Please enter a valid service name and price')),
        );
      }
      return;
    }

    setState(() => _savingService = true);
    try {
      final wasEditing = _editingServiceId != null;

      if (!wasEditing) {
        await _repository.addFolioTransaction(_selectedBooking!.id, {
          'type': 'charge',
          'category': 'Additional Service',
          'amount': price,
          'description': name,
        });
      } else {
        await _repository.updateFolioTransaction(
          _selectedBooking!.id,
          _editingServiceId!,
          {
            'amount': price,
            'description': name,
          },
        );
      }

      _serviceNameController.clear();
      _servicePriceController.clear();
      _editingServiceId = null;
      await _loadFolio();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              wasEditing
                  ? 'Additional service updated'
                  : 'Additional service added to folio',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save additional service: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _savingService = false);
      }
    }
  }

  void _startEditingAdditionalService(Map<String, dynamic> transaction) {
    setState(() {
      _editingServiceId = '${transaction['id']}';
      _serviceNameController.text =
          '${transaction['description'] ?? 'Additional Service'}'.trim();
      _servicePriceController.text =
          (((transaction['amount'] as num?)?.toDouble() ?? 0.0).toStringAsFixed(
        2,
      ));
    });
  }

  void _cancelServiceEdit() {
    setState(() {
      _editingServiceId = null;
      _serviceNameController.clear();
      _servicePriceController.clear();
    });
  }

  Future<void> _removeAdditionalService(
      Map<String, dynamic> transaction) async {
    if (_selectedBooking == null) return;

    final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Delete service line'),
            content: Text(
              'Remove "${transaction['description'] ?? 'Additional Service'}" from this guest folio?',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Delete'),
              ),
            ],
          ),
        ) ??
        false;

    if (!confirmed) return;

    setState(() => _savingService = true);
    try {
      await _repository.deleteFolioTransaction(
        _selectedBooking!.id,
        '${transaction['id']}',
      );
      if (_editingServiceId == '${transaction['id']}') {
        _cancelServiceEdit();
      }
      await _loadFolio();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Additional service deleted')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to delete service: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _savingService = false);
      }
    }
  }

  void _redirectToCashierStation() {
    final conf =
        _selectedBooking?.confirmationNumber ?? _selectedBooking?.id ?? '';
    final handoff = widget.onPayAtCashier;
    if (handoff != null) {
      // Hand the confirmation code to the embedded (Reception) cashier.
      handoff(conf);
    }
    // Always pop with NO result. Some callers push this screen with
    // Navigator.push<bool>(...); returning a String there throws
    // "type 'String' is not a subtype of type 'bool?'". The handoff above (or,
    // for the standalone route, the caller re-loading by code) does the routing.
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Guest Check-Out'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
        actions: [
          if (_selectedBooking != null)
            IconButton(
              icon: const Icon(Icons.receipt_long),
              tooltip: 'Generate & Print Invoice',
              onPressed: _generateInvoicePDF,
            ),
        ],
      ),
      body:
          _selectedBooking == null ? _buildSearchView() : _buildCheckOutView(),
    );
  }

  Widget _buildSearchView() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Search Checked-In Guest',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _searchController,
            decoration: InputDecoration(
              labelText: 'Guest Name, Room Number, or Confirmation',
              border: const OutlineInputBorder(),
              suffixIcon: IconButton(
                icon: _isSearching
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.search),
                onPressed: _isSearching ? null : _searchBooking,
              ),
            ),
            onSubmitted: (_) => _searchBooking(),
          ),
        ],
      ),
    );
  }

  Widget _buildCheckOutView() {
    final booking = _selectedBooking!;
    final nights = booking.checkOut.difference(booking.checkIn).inDays;

    final foodCharges = (_folio?['food_charges'] as num?)?.toDouble() ?? 0.0;
    final bevCharges = (_folio?['beverage_charges'] as num?)?.toDouble() ?? 0.0;
    final foodBevTotal = foodCharges + bevCharges;
    final roomCharges = (_folio?['room_charges'] as num?)?.toDouble() ?? 0.0;
    final otherCharges = _displayOtherCharges;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Guest Summary Card
          Card(
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Guest Stay',
                          style: TextStyle(
                              fontSize: 18, fontWeight: FontWeight.bold)),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () =>
                            setState(() => _selectedBooking = null),
                      ),
                    ],
                  ),
                  const Divider(),
                  _infoRow('Guest', booking.guestName ?? '-'),
                  _infoRow('Room', booking.roomNumber ?? '-'),
                  _infoRow('Confirmation', booking.confirmationNumber ?? '-'),
                  _infoRow('Check-In',
                      DateFormat('MMM dd, yyyy').format(booking.checkIn)),
                  _infoRow('Check-Out',
                      DateFormat('MMM dd, yyyy').format(booking.checkOut)),
                  _infoRow('Nights', '$nights'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Folio Card
          Card(
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Folio Summary',
                          style: TextStyle(
                              fontSize: 18, fontWeight: FontWeight.bold)),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: Colors.blue.shade100),
                        ),
                        child: Text(
                          'Receipt prints after cashier payment confirmation',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Colors.blue.shade800,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const Divider(),
                  if (_loadingFolio)
                    const Center(child: CircularProgressIndicator())
                  else ...[
                    _infoRow('Room Charges',
                        'KES ${roomCharges.toStringAsFixed(2)}'),
                    _infoRow('Food & Beverage',
                        'KES ${foodBevTotal.toStringAsFixed(2)}'),
                    _infoRow('Other Charges',
                        'KES ${otherCharges.toStringAsFixed(2)}'),
                    const Divider(),
                    _infoRow('Total Charges',
                        'KES ${_displayTotalCharges.toStringAsFixed(2)}',
                        bold: true),
                    _infoRow('Total Payments',
                        'KES ${_totalPayments.toStringAsFixed(2)}'),
                    const Divider(),
                    _infoRow(
                      'Balance',
                      'KES ${_displayBalance.toStringAsFixed(2)}',
                      bold: true,
                      color: _displayBalance > 0 ? Colors.red : Colors.green,
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Additional Services Ledger
          Card(
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Additional Services Register',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      if (_additionalServiceTransactions.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF4F0E7),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFFD7D0C3)),
                          ),
                          child: Text(
                            '${_additionalServiceTransactions.length} line${_additionalServiceTransactions.length == 1 ? '' : 's'} • KES ${_additionalServicesTotal.toStringAsFixed(2)}',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF233A56),
                            ),
                          ),
                        ),
                    ],
                  ),
                  const Divider(),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8F6F1),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFD8D2C8)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _isEditingService
                              ? 'Edit posted service line'
                              : 'Post a checkout service line',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF233A56),
                          ),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Expanded(
                              flex: 3,
                              child: TextFormField(
                                controller: _serviceNameController,
                                textInputAction: TextInputAction.next,
                                decoration: const InputDecoration(
                                  labelText: 'Service name',
                                  hintText:
                                      'Laundry, late checkout, transport...',
                                  border: OutlineInputBorder(),
                                  isDense: true,
                                  filled: true,
                                  fillColor: Colors.white,
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              flex: 2,
                              child: TextFormField(
                                controller: _servicePriceController,
                                decoration: const InputDecoration(
                                  labelText: 'Amount',
                                  prefixText: 'KES ',
                                  border: OutlineInputBorder(),
                                  isDense: true,
                                  filled: true,
                                  fillColor: Colors.white,
                                ),
                                keyboardType:
                                    const TextInputType.numberWithOptions(
                                  decimal: true,
                                ),
                                onFieldSubmitted: (_) => _savingService
                                    ? null
                                    : _saveAdditionalService(),
                              ),
                            ),
                            const SizedBox(width: 10),
                            FilledButton.icon(
                              onPressed: _savingService
                                  ? null
                                  : _saveAdditionalService,
                              icon: Icon(
                                _isEditingService
                                    ? Icons.save_outlined
                                    : Icons.add,
                                size: 18,
                              ),
                              label: Text(
                                _savingService
                                    ? 'Saving...'
                                    : _isEditingService
                                        ? 'Update'
                                        : 'Add Service',
                              ),
                              style: FilledButton.styleFrom(
                                backgroundColor: const Color(0xFF233A56),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 16,
                                ),
                              ),
                            ),
                            if (_isEditingService) ...[
                              const SizedBox(width: 10),
                              OutlinedButton(
                                onPressed:
                                    _savingService ? null : _cancelServiceEdit,
                                style: OutlinedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 16,
                                  ),
                                ),
                                child: const Text('Cancel'),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Every posted line appears on the final guest invoice and increases the folio balance until cashier settlement.',
                          style: TextStyle(
                            color: Colors.grey.shade700,
                            fontSize: 12,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFD8D2C8)),
                    ),
                    child: Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          decoration: const BoxDecoration(
                            color: Color(0xFFF4F0E7),
                            borderRadius: BorderRadius.vertical(
                              top: Radius.circular(10),
                            ),
                          ),
                          child: const Row(
                            children: [
                              Expanded(
                                flex: 4,
                                child: Text(
                                  'Service / Narrative',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF233A56),
                                  ),
                                ),
                              ),
                              Expanded(
                                flex: 2,
                                child: Text(
                                  'Posted',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF233A56),
                                  ),
                                ),
                              ),
                              Expanded(
                                child: Text(
                                  'Amount',
                                  textAlign: TextAlign.right,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF233A56),
                                  ),
                                ),
                              ),
                              SizedBox(width: 120),
                            ],
                          ),
                        ),
                        if (_additionalServiceTransactions.isEmpty)
                          Padding(
                            padding: const EdgeInsets.all(18),
                            child: Text(
                              'No additional services have been posted for this stay.',
                              style: TextStyle(
                                color: Colors.grey.shade600,
                                fontSize: 13,
                              ),
                            ),
                          )
                        else
                          Column(
                            children:
                                _additionalServiceTransactions.map((service) {
                              final amount =
                                  (service['amount'] as num?)?.toDouble() ??
                                      0.0;
                              final isEditing =
                                  _editingServiceId == '${service['id']}';
                              return Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 12,
                                ),
                                decoration: BoxDecoration(
                                  color: isEditing
                                      ? const Color(0xFFFFFBF2)
                                      : Colors.white,
                                  border: Border(
                                    top: BorderSide(
                                      color: Colors.grey.shade200,
                                    ),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      flex: 4,
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            '${service['description'] ?? 'Additional Service'}'
                                                .trim(),
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w700,
                                              fontSize: 14,
                                              color: Color(0xFF1F2D3D),
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            _serviceReferenceLabel(service),
                                            style: TextStyle(
                                              color: Colors.grey.shade600,
                                              fontSize: 12,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Expanded(
                                      flex: 2,
                                      child: Text(
                                        _formatTxDate(
                                          service['created_at'] ??
                                              service['createdAt'],
                                        ),
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey.shade700,
                                        ),
                                      ),
                                    ),
                                    Expanded(
                                      child: Text(
                                        'KES ${amount.toStringAsFixed(2)}',
                                        textAlign: TextAlign.right,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFF8A2F12),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 16),
                                    SizedBox(
                                      width: 104,
                                      child: Row(
                                        children: [
                                          IconButton(
                                            tooltip: 'Edit line',
                                            onPressed: _savingService
                                                ? null
                                                : () =>
                                                    _startEditingAdditionalService(
                                                      service,
                                                    ),
                                            icon: const Icon(
                                              Icons.edit_outlined,
                                              size: 18,
                                              color: Color(0xFF233A56),
                                            ),
                                          ),
                                          IconButton(
                                            tooltip: 'Delete line',
                                            onPressed: _savingService
                                                ? null
                                                : () =>
                                                    _removeAdditionalService(
                                                      service,
                                                    ),
                                            icon: const Icon(
                                              Icons.delete_outline,
                                              size: 18,
                                              color: AppColors.kError,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }).toList(),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Cashier Station Payment Section (if balance > 0)
          if (_displayBalance > 0) ...[
            Card(
              elevation: 2,
              color: Colors.orange.shade50,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.point_of_sale,
                            color: Colors.orange.shade800),
                        const SizedBox(width: 8),
                        const Text('Cashier Payment Station',
                            style: TextStyle(
                                fontSize: 16, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                        'Balance Due: KES ${_displayBalance.toStringAsFixed(2)}',
                        style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.orange.shade900)),
                    const SizedBox(height: 4),
                    const Text(
                      'Payments are processed through the Cashier Station. Collect payment via Cash, M-Pesa, or Card there first. After cashier confirmation, the official receipt is generated and this checkout can be completed.',
                      style: TextStyle(fontSize: 13, color: Colors.black87),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: _redirectToCashierStation,
                            icon: const Icon(Icons.point_of_sale, size: 20),
                            label: const Text(
                              'Pay at Cashier Station →',
                              style: TextStyle(
                                  fontSize: 15, fontWeight: FontWeight.bold),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.kPrimary,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        OutlinedButton(
                          onPressed: _showCashierSettlementGuide,
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(
                                vertical: 14, horizontal: 14),
                          ),
                          child: const Text('Guide'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Notes
          Card(
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Check-Out Notes',
                      style:
                          TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const Divider(),
                  TextFormField(
                    controller: _notesController,
                    decoration: const InputDecoration(
                      labelText: 'Additional Notes (optional)',
                      border: OutlineInputBorder(),
                    ),
                    maxLines: 3,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Action Buttons: Invoice + Check-Out
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _generateInvoicePDF,
                  icon: const Icon(Icons.print, size: 18),
                  label: const Text('Generate & Print Invoice'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.kPrimary,
                    side:
                        const BorderSide(color: AppColors.kPrimary, width: 1.5),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton(
                  onPressed:
                      _isSubmitting || _loadingFolio || _displayBalance > 0
                          ? null
                          : _performCheckOut,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _displayBalance > 0
                        ? Colors.orange.shade700
                        : AppColors.kPrimary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2),
                        )
                      : Text(
                          _displayBalance > 0
                              ? 'Awaiting Cashier Payment Confirmation'
                              : 'Complete Check-Out',
                          style: const TextStyle(
                              fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value,
      {bool bold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey)),
          Text(
            value,
            style: TextStyle(
              fontWeight: bold ? FontWeight.bold : FontWeight.normal,
              fontSize: bold ? 16 : 14,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
