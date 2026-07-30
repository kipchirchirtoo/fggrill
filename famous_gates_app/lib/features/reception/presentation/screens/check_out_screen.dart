import 'package:flutter/material.dart';
import '../../domain/models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/dashboard_shell.dart';
import '../../../shared/presentation/guest_invoice_pdf.dart';
import '../../../pos/domain/models.dart';
import '../../../cashier/data/cashier_repository.dart';
import '../../../templates/data/document_printer.dart';

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
  double _balance = 0;
  List<Map<String, dynamic>> _transactions = [];
  // Itemised Charge-to-Room lines (outlet · item) from the folio (folio_items).
  List<Map<String, dynamic>> _folioItems = [];
  // Per-bill charge lines (outlet + bill) from folio_transactions — the
  // detailed fallback when per-item folio_items isn't available.
  List<Map<String, dynamic>> _chargeLines = [];

  // Payment
  final _notesController = TextEditingController();

  // Additional Services
  final _serviceNameController = TextEditingController();
  final _servicePriceController = TextEditingController();
  bool _isAddingService = false;

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
            const SnackBar(content: Text('No matching checked-in guests found')),
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
                      subtitle: Text('Room ${booking.roomNumber ?? "-"} • ${booking.confirmationNumber ?? "-"}'),
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
          ? (_selectedBooking?.amountPaid ?? _selectedBooking?.depositAmount ?? 0.0)
          : (_selectedBooking?.amountPaid ?? 0.0);

      final rawRoom = (folioMap['room_charges'] ?? folioMap['roomCharges']) as num?;
      final rawFood = (folioMap['food_charges'] ?? folioMap['foodCharges']) as num?;
      final rawBev = (folioMap['beverage_charges'] ?? folioMap['beverageCharges']) as num?;
      final rawOther = (folioMap['other_charges'] ?? folioMap['otherCharges']) as num?;
      final rawTotal = (folioMap['total_charges'] ?? folioMap['totalCharges']) as num?;
      final rawPayments = (folioMap['total_payments'] ?? folioMap['totalPayments']) as num?;

      final rCharges = (rawRoom != null && rawRoom.toDouble() > 0) ? rawRoom.toDouble() : bookingTotal;
      final fCharges = rawFood?.toDouble() ?? 0.0;
      final bCharges = rawBev?.toDouble() ?? 0.0;
      final oCharges = rawOther?.toDouble() ?? 0.0;

      final calcTotal = (rawTotal != null && rawTotal.toDouble() > 0)
          ? rawTotal.toDouble()
          : (rCharges + fCharges + bCharges + oCharges);

      final calcPayments = (rawPayments != null && rawPayments.toDouble() > 0)
          ? rawPayments.toDouble()
          : bookingPaid;
      final calcBalance = (calcTotal - calcPayments) > 0 ? (calcTotal - calcPayments) : 0.0;

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

      setState(() {
        _folio = {
          'room_charges': rCharges,
          'food_charges': fCharges,
          'beverage_charges': bCharges,
          'other_charges': oCharges,
        };
        _totalCharges = calcTotal;
        _totalPayments = calcPayments;
        _balance = calcBalance > 0 ? calcBalance : 0.0;
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
    final items = buildFolioInvoiceItems(
      folio: _folio ?? const {},
      folioItems: _folioItems,
      chargeLines: _chargeLines,
      roomLabel: '${booking.roomType ?? 'Room'} ${booking.roomNumber ?? ''}'.trim(),
      bookingTotal: booking.totalAmount ?? 0.0,
    );

    if (items.isEmpty) {
      final fallback =
          _totalCharges > 0 ? _totalCharges : (booking.totalAmount ?? 0.0);
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
      invoiceNumber: booking.confirmationNumber ?? 'REC-${booking.id.length > 8 ? booking.id.substring(0, 8) : booking.id}',
      invoiceDate: nowStr,
      dueDate: nowStr,
      clientName: booking.guestName ?? 'Guest',
      clientPhone: booking.guestPhone,
      clientDetails: 'Room ${booking.roomNumber ?? "-"}',
      items: items,
      totalAmount: _totalCharges > 0 ? _totalCharges : (booking.totalAmount ?? 0.0),
      amountPaid: _totalPayments,
      balanceDue: _balance,
      notes: 'Final guest stay invoice generated from Reception checkout.',
    );
  }

  Future<void> _showCashierSettlementGuide() async {
    if (_selectedBooking == null || _balance <= 0) return;

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
                'Outstanding balance: KES ${_balance.toStringAsFixed(2)}',
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

    if (_balance > 0) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Checkout is locked until Cashier Station confirms payment of KES ${_balance.toStringAsFixed(2)}.',
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

      // Update room status
      if (_selectedBooking!.roomId != null && _selectedBooking!.roomId!.isNotEmpty) {
        await _repository.updateRoomStatus(_selectedBooking!.roomId!, 'available');
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Guest checked out from Room ${_selectedBooking!.roomNumber}'),
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

  Future<void> _reprintPOSBill(Map<String, dynamic> tx) async {
    final refCode = (tx['reference'] ?? tx['referenceNumber'] ?? tx['reference_number'])?.toString();
    if (refCode == null || refCode.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No reference code found for this transaction.')),
        );
      }
      return;
    }

    setState(() => _loadingFolio = true);
    try {
      final fetched = await ref.read(cashierRepositoryProvider).getBillDetails(refCode);
      if (fetched['success'] == true) {
        final data = fetched['data'];
        if (data is Map) {
          final billData = data['booking'] ?? data['order'] ?? data;
          final bill = Map<String, dynamic>.from(billData);
          final financials = bill['financials'] is Map ? Map<String, dynamic>.from(bill['financials']) : <String, dynamic>{};
          var total = double.tryParse('${financials['total_amount'] ?? bill['total_amount'] ?? financials['balance'] ?? bill['balance_amount'] ?? bill['balance']}') ?? 0.0;
          
          List<CartItem> items = [];
          final itemsRaw = bill['items'] ?? bill['line_items'] ?? [];
          if (itemsRaw is List) {
            for (final rawItem in itemsRaw) {
              if (rawItem is Map) {
                final qty = double.tryParse('${rawItem['active_qty'] ?? rawItem['qty'] ?? rawItem['quantity']}') ?? 1.0;
                if (qty <= 0) continue;
                final price = double.tryParse('${rawItem['unit_price'] ?? rawItem['price']}') ?? 0.0;
                final name = '${rawItem['name'] ?? rawItem['description'] ?? rawItem['item_name']}';
                items.add(CartItem(
                  productId: '${rawItem['id'] ?? ''}',
                  name: name,
                  unitPrice: price,
                  qty: qty.round() > 0 ? qty.round() : 1,
                ));
              }
            }
          }
          if (total <= 0 && items.isNotEmpty) {
            total = items.fold(0.0, (sum, item) => sum + (item.unitPrice * item.qty));
          }
          if (items.isEmpty) {
            items.add(CartItem(
              productId: '${bill['id'] ?? ''}',
              name: 'POS Charge',
              unitPrice: total,
              qty: 1,
            ));
          }

          final nav = ref.read(dashboardNavProvider);
          await printCustomerDocument(
            ref,
            templateKey: 'customer_bill',
            fallbackTitle: 'CUSTOMER BILL',
            branchId: nav.user?.branchId,
            outletId: '${bill['outlet_id'] ?? bill['outletId'] ?? nav.user?.outletId ?? ''}',
            sale: SaleResult(
              transactionId: refCode,
              createdAt: DateTime.now(),
              receiptNumber: refCode,
              cashierName: nav.user?.name,
              total: total,
              paymentMethod: 'pending',
            ),
            items: items,
            branchName: nav.branchName,
            customerName: '${bill['customer_name'] ?? bill['customerName'] ?? ''}',
            staffLabel: 'Waiter',
            publicCode: refCode,
            barcodeValue: refCode,
            duplicateLabel: 'REPRINT',
          );
          
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Customer bill reprinted')),
            );
          }
        } else {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Bill details not found.')),
            );
          }
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Failed to fetch bill details.')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Reprint failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loadingFolio = false);
    }
  }

  Future<void> _addAdditionalService() async {
    final name = _serviceNameController.text.trim();
    final priceStr = _servicePriceController.text.trim();
    final price = double.tryParse(priceStr);

    if (name.isEmpty || price == null || price <= 0) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please enter a valid service name and price')),
        );
      }
      return;
    }

    if (_selectedBooking == null) return;

    setState(() => _isAddingService = true);
    try {
      await _repository.addFolioTransaction(_selectedBooking!.id, {
        'type': 'charge',
        'category': 'Additional Service',
        'description': name,
        'amount': price,
      });

      _serviceNameController.clear();
      _servicePriceController.clear();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Added $name successfully'), backgroundColor: Colors.green),
        );
      }
      
      await _loadFolio();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to add service: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isAddingService = false);
      }
    }
  }

  void _redirectToCashierStation() {
    final conf = _selectedBooking?.confirmationNumber ?? _selectedBooking?.id ?? '';
    Navigator.of(context).pop(conf);
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
      body: _selectedBooking == null ? _buildSearchView() : _buildCheckOutView(),
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
    final otherCharges = (_folio?['other_charges'] as num?)?.toDouble() ?? 0.0;

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
                      const Text('Guest Stay', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => setState(() => _selectedBooking = null),
                      ),
                    ],
                  ),
                  const Divider(),
                  _infoRow('Guest', booking.guestName ?? '-'),
                  _infoRow('Room', booking.roomNumber ?? '-'),
                  _infoRow('Confirmation', booking.confirmationNumber ?? '-'),
                  _infoRow('Check-In', DateFormat('MMM dd, yyyy').format(booking.checkIn)),
                  _infoRow('Check-Out', DateFormat('MMM dd, yyyy').format(booking.checkOut)),
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
                      const Text('Folio Summary', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
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
                    _infoRow('Room Charges', 'KES ${roomCharges.toStringAsFixed(2)}'),
                    _infoRow('Food & Beverage', 'KES ${foodBevTotal.toStringAsFixed(2)}'),
                    _infoRow('Other Charges', 'KES ${otherCharges.toStringAsFixed(2)}'),
                    const Divider(),
                    _infoRow('Total Charges', 'KES ${_totalCharges.toStringAsFixed(2)}', bold: true),
                    _infoRow('Total Payments', 'KES ${_totalPayments.toStringAsFixed(2)}'),
                    const Divider(),
                    _infoRow(
                      'Balance',
                      'KES ${_balance.toStringAsFixed(2)}',
                      bold: true,
                      color: _balance > 0 ? Colors.red : Colors.green,
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Transactions
          if (_transactions.isNotEmpty) ...[
            Card(
              elevation: 2,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Recent Transactions', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    const Divider(),
                    ...(() {
                      final printedRefs = <String>{};
                      return _transactions.take(5).map((tx) {
                        final isCharge = tx['type'] == 'charge';
                        final referenceCode = (tx['reference'] ?? tx['referenceNumber'])?.toString() ?? '';
                        final bool showPrint = isCharge && referenceCode.isNotEmpty && !printedRefs.contains(referenceCode);
                        if (showPrint) printedRefs.add(referenceCode);
                        
                        return ExpansionTile(
                          leading: Icon(
                            isCharge ? Icons.add_circle_outline : Icons.remove_circle_outline,
                            color: isCharge ? Colors.red : Colors.green,
                          ),
                          title: Text(tx['description'] ?? tx['category'] ?? 'Transaction'),
                          subtitle: Text(
                              _formatTxDate(tx['created_at'] ?? tx['createdAt'])),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'KES ${(tx['amount'] ?? 0).toStringAsFixed(2)}',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: isCharge ? Colors.red : Colors.green,
                                ),
                              ),
                              if (showPrint)
                                IconButton(
                                  icon: const Icon(Icons.print, size: 20),
                                  onPressed: () => _reprintPOSBill(tx),
                                  tooltip: 'Reprint POS Bill',
                                  color: Colors.blueGrey,
                                ),
                            ],
                          ),
                          children: [
                            if (referenceCode.isNotEmpty)
                              FutureBuilder(
                                future: ref.read(cashierRepositoryProvider).getBillDetails(referenceCode),
                                builder: (context, snapshot) {
                                  if (snapshot.connectionState == ConnectionState.waiting) {
                                    return const Padding(
                                      padding: EdgeInsets.all(16.0),
                                      child: Center(child: CircularProgressIndicator()),
                                    );
                                  }
                                  if (snapshot.hasError || !snapshot.hasData) {
                                    return const Padding(
                                      padding: EdgeInsets.all(16.0),
                                      child: Text('Could not load items'),
                                    );
                                  }
                                  final fetched = snapshot.data as Map<String, dynamic>;
                                  if (fetched['success'] != true) {
                                    return const Padding(
                                      padding: EdgeInsets.all(16.0),
                                      child: Text('Could not load items'),
                                    );
                                  }
                                  final data = fetched['data'];
                                  final billData = data is Map ? (data['booking'] ?? data['order'] ?? data) as Map : {};
                                  final itemsRaw = billData['items'] ?? billData['line_items'] ?? [];
                                  if (itemsRaw is! List || itemsRaw.isEmpty) {
                                    return const Padding(
                                      padding: EdgeInsets.all(16.0),
                                      child: Text('No item details available'),
                                    );
                                  }
                                  return ListView.builder(
                                    shrinkWrap: true,
                                    physics: const NeverScrollableScrollPhysics(),
                                    itemCount: itemsRaw.length,
                                    itemBuilder: (context, index) {
                                      final rawItem = itemsRaw[index];
                                      if (rawItem is! Map) return const SizedBox.shrink();
                                      final qty = double.tryParse('${rawItem['active_qty'] ?? rawItem['qty'] ?? rawItem['quantity']}') ?? 1.0;
                                      final price = double.tryParse('${rawItem['unit_price'] ?? rawItem['price']}') ?? 0.0;
                                      final name = '${rawItem['name'] ?? rawItem['description'] ?? rawItem['item_name']}';
                                      return ListTile(
                                        title: Text(name),
                                        subtitle: Text('${qty.toStringAsFixed(0)} x KES ${price.toStringAsFixed(2)}'),
                                        trailing: Text('KES ${(qty * price).toStringAsFixed(2)}'),
                                      );
                                    },
                                  );
                                },
                              )
                            else
                              const Padding(
                                padding: EdgeInsets.all(16.0),
                                child: Text('No details available for this transaction'),
                              )
                          ],
                        );
                    }).toList();
                    })(),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Additional Services
          Card(
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Additional Services', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const Divider(),
                  Row(
                    children: [
                      Expanded(
                        flex: 2,
                        child: TextFormField(
                          controller: _serviceNameController,
                          decoration: const InputDecoration(
                            labelText: 'Service Name',
                            border: OutlineInputBorder(),
                            isDense: true,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextFormField(
                          controller: _servicePriceController,
                          decoration: const InputDecoration(
                            labelText: 'Price',
                            border: OutlineInputBorder(),
                            prefixText: 'KES ',
                            isDense: true,
                          ),
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        ),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: _isAddingService ? null : _addAdditionalService,
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: _isAddingService
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Text('Add'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Cashier Station Payment Section (if balance > 0)
          if (_balance > 0) ...[
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
                        Icon(Icons.point_of_sale, color: Colors.orange.shade800),
                        const SizedBox(width: 8),
                        const Text('Cashier Payment Station', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text('Balance Due: KES ${_balance.toStringAsFixed(2)}', 
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.orange.shade900)),
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
                  const Text('Check-Out Notes', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
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
                    side: const BorderSide(color: AppColors.kPrimary, width: 1.5),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton(
                  onPressed:
                      _isSubmitting || _loadingFolio || _balance > 0 ? null : _performCheckOut,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _balance > 0 ? Colors.orange.shade700 : AppColors.kPrimary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : Text(
                          _balance > 0
                              ? 'Awaiting Cashier Payment Confirmation'
                              : 'Complete Check-Out',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value, {bool bold = false, Color? color}) {
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
