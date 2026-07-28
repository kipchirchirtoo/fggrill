import 'package:flutter/material.dart';
import '../../domain/models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../shared/presentation/guest_invoice_pdf.dart';

import '../../data/repository.dart';

class CheckOutScreen extends ConsumerStatefulWidget {
  final Booking? booking;

  const CheckOutScreen({super.key, this.booking});

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

  // Payment
  final _notesController = TextEditingController();

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
      final bookingPaid = _selectedBooking?.amountPaid ?? _selectedBooking?.depositAmount ?? 0.0;

      final rawRoom = (folioMap['room_charges'] ?? folioMap['roomCharges']) as num?;
      final rawFood = (folioMap['food_charges'] ?? folioMap['foodCharges']) as num?;
      final rawBev = (folioMap['beverage_charges'] ?? folioMap['beverageCharges']) as num?;
      final rawOther = (folioMap['other_charges'] ?? folioMap['otherCharges']) as num?;
      final rawTotal = (folioMap['total_charges'] ?? folioMap['totalCharges']) as num?;
      final rawPayments = (folioMap['total_payments'] ?? folioMap['totalPayments']) as num?;
      final rawBal = (folioMap['balance'] ?? folioMap['balance_due']) as num?;

      final rCharges = (rawRoom != null && rawRoom.toDouble() > 0) ? rawRoom.toDouble() : bookingTotal;
      final fCharges = rawFood?.toDouble() ?? 0.0;
      final bCharges = rawBev?.toDouble() ?? 0.0;
      final oCharges = rawOther?.toDouble() ?? 0.0;

      final calcTotal = (rawTotal != null && rawTotal.toDouble() > 0)
          ? rawTotal.toDouble()
          : (rCharges + fCharges + bCharges + oCharges);

      final calcPayments = rawPayments?.toDouble() ?? bookingPaid;
      final calcBalance = rawBal?.toDouble() ?? (calcTotal - calcPayments);

      final txList = raw['transactions'] is List
          ? List<Map<String, dynamic>>.from(raw['transactions'])
          : (folioMap['transactions'] is List
              ? List<Map<String, dynamic>>.from(folioMap['transactions'])
              : <Map<String, dynamic>>[]);

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

  Future<void> _generateReceiptPDF() async {
    if (_selectedBooking == null) return;
    final booking = _selectedBooking!;

    final foodCharges = (_folio?['food_charges'] as num?)?.toDouble() ?? 0.0;
    final bevCharges = (_folio?['beverage_charges'] as num?)?.toDouble() ?? 0.0;
    final foodBevTotal = foodCharges + bevCharges;
    final roomCharges = (_folio?['room_charges'] as num?)?.toDouble() ?? 0.0;
    final otherCharges = (_folio?['other_charges'] as num?)?.toDouble() ?? 0.0;

    final items = <Map<String, dynamic>>[];
    if (roomCharges > 0) {
      items.add({
        'description': 'Accommodation Services (${booking.roomType ?? 'Room'} ${booking.roomNumber ?? ''})',
        'qty': 1,
        'unitPrice': roomCharges,
        'totalAmount': roomCharges,
      });
    }
    if (foodBevTotal > 0) {
      items.add({
        'description': 'Food & Beverage (POS Charges)',
        'qty': 1,
        'unitPrice': foodBevTotal,
        'totalAmount': foodBevTotal,
      });
    }
    if (otherCharges > 0) {
      items.add({
        'description': 'Other Services / Incidentals',
        'qty': 1,
        'unitPrice': otherCharges,
        'totalAmount': otherCharges,
      });
    }

    for (final tx in _transactions) {
      if (tx['type'] == 'charge') {
        final desc = tx['description'] ?? tx['category'] ?? 'POS Charge';
        final amt = (tx['amount'] as num?)?.toDouble() ?? 0.0;
        if (amt > 0 && !items.any((i) => i['description'] == desc)) {
          items.add({
            'description': desc,
            'qty': 1,
            'unitPrice': amt,
            'totalAmount': amt,
          });
        }
      }
    }

    if (items.isEmpty) {
      items.add({
        'description': 'Hotel Accommodation & Guest Services',
        'qty': 1,
        'unitPrice': _totalCharges > 0 ? _totalCharges : (booking.totalAmount ?? 0.0),
        'totalAmount': _totalCharges > 0 ? _totalCharges : (booking.totalAmount ?? 0.0),
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
      notes: 'Thank you for staying at FamousGate Hotels!',
    );
  }

  Future<void> _showCashierPaymentDialog() async {
    if (_selectedBooking == null || _balance <= 0) return;

    final amountController = TextEditingController(text: _balance.toStringAsFixed(2));
    final refController = TextEditingController();
    String selectedMethod = 'Cash';
    bool isProcessing = false;

    await showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Row(
                children: const [
                  Icon(Icons.point_of_sale, color: AppColors.kPrimary),
                  SizedBox(width: 8),
                  Text('Cashier Payment Station'),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Guest: ${_selectedBooking!.guestName ?? "Guest"}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    Text(
                      'Room ${_selectedBooking!.roomNumber ?? "-"} • Balance KES ${_balance.toStringAsFixed(2)}',
                      style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
                    ),
                    const Divider(height: 24),
                    const Text('Payment Method', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      value: selectedMethod,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                      items: ['Cash', 'M-Pesa', 'Card', 'Bank Transfer'].map((m) {
                        return DropdownMenuItem(value: m, child: Text(m));
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) setDialogState(() => selectedMethod = val);
                      },
                    ),
                    const SizedBox(height: 12),
                    const Text('Amount (KES)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    const SizedBox(height: 6),
                    TextField(
                      controller: amountController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        prefixText: 'KES ',
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text('Payment Ref / Code (Optional)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    const SizedBox(height: 6),
                    TextField(
                      controller: refController,
                      decoration: const InputDecoration(
                        hintText: 'e.g. M-Pesa Code / Receipt #',
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isProcessing ? null : () => Navigator.of(context).pop(),
                  child: const Text('Cancel'),
                ),
                ElevatedButton.icon(
                  onPressed: isProcessing
                      ? null
                      : () async {
                          final amount = double.tryParse(amountController.text.trim()) ?? 0.0;
                          if (amount <= 0) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Please enter a valid payment amount')),
                            );
                            return;
                          }
                          setDialogState(() => isProcessing = true);
                          try {
                            await _repository.recordBillPayment(_selectedBooking!.id, {
                              'payment_amount': amount,
                              'payment_method': selectedMethod,
                              'payment_reference': refController.text.trim(),
                            });
                            if (mounted) {
                              Navigator.of(context).pop();
                              await _loadFolio();
                              if (!mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Payment of KES ${amount.toStringAsFixed(2)} processed successfully at Cashier Station.'),
                                  backgroundColor: Colors.green,
                                  duration: const Duration(seconds: 8),
                                  action: SnackBarAction(
                                    label: 'PRINT RECEIPT',
                                    textColor: Colors.yellow,
                                    onPressed: () => _generateReceiptPDF(),
                                  ),
                                ),
                              );
                              await _generateReceiptPDF();
                            }
                          } catch (e) {
                            setDialogState(() => isProcessing = false);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Payment processing failed: $e')),
                              );
                            }
                          }
                        },
                  icon: isProcessing
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.check, size: 18),
                  label: const Text('Process Payment'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green.shade700,
                    foregroundColor: Colors.white,
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _performCheckOut() async {
    if (_selectedBooking == null) return;

    if (_balance > 0) {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Outstanding Balance'),
          content: Text('Guest has an outstanding balance of KES ${_balance.toStringAsFixed(2)}. Continue with check-out?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Continue'),
            ),
          ],
        ),
      );
      if (confirm != true) return;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Guest Check-Out'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
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
                      ElevatedButton.icon(
                        onPressed: _generateReceiptPDF,
                        icon: const Icon(Icons.receipt_long, size: 16),
                        label: const Text('Generate Receipt'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.kPrimary,
                          foregroundColor: Colors.white,
                          visualDensity: VisualDensity.compact,
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
                    ..._transactions.take(5).map((tx) {
                      final isCharge = tx['type'] == 'charge';
                      return ListTile(
                        leading: Icon(
                          isCharge ? Icons.add_circle_outline : Icons.remove_circle_outline,
                          color: isCharge ? Colors.red : Colors.green,
                        ),
                        title: Text(tx['description'] ?? tx['category'] ?? 'Transaction'),
                        subtitle: Text(DateFormat('MMM dd, HH:mm').format(DateTime.parse(tx['created_at']))),
                        trailing: Text(
                          'KES ${(tx['amount'] ?? 0).toStringAsFixed(2)}',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: isCharge ? Colors.red : Colors.green,
                          ),
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],

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
                      'Payments are processed through the Cashier Station. Collect payment via Cash, M-Pesa, or Card to settle balance before check-out.',
                      style: TextStyle(fontSize: 13, color: Colors.black87),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _showCashierPaymentDialog,
                        icon: const Icon(Icons.payment, size: 18),
                        label: const Text('Collect Payment at Cashier Station'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.orange.shade800,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                      ),
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

          // Check-Out Button
          ElevatedButton(
            onPressed: _isSubmitting ? null : _performCheckOut,
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
                    _balance > 0 ? 'Check-Out (Pending Cashier Settlement)' : 'Complete Check-Out (Fully Paid)',
                    style: const TextStyle(fontSize: 16),
                  ),
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
