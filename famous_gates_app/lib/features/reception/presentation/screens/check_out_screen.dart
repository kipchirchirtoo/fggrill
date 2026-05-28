import 'package:flutter/material.dart';
import '../../domain/models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';

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
    if (_selectedBooking == null) return;

    setState(() => _loadingFolio = true);
    try {
      final folio = await _repository.getFolio(_selectedBooking!.id);
      setState(() {
        _folio = folio;
        _totalCharges = folio['total_charges'] ?? 0;
        _totalPayments = folio['total_payments'] ?? 0;
        _balance = folio['balance'] ?? 0;
        _transactions = List<Map<String, dynamic>>.from(folio['transactions'] ?? []);
        // _paymentAmount = _balance > 0 ? _balance : 0; // Future implementation
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
        await _repository.updateRoomStatus(_selectedBooking!.roomId!, 'cleaning');
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
                  const Text('Folio Summary', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const Divider(),
                  if (_loadingFolio)
                    const Center(child: CircularProgressIndicator())
                  else ...[
                    _infoRow('Room Charges', 'KES ${(_folio?['room_charges'] ?? 0).toStringAsFixed(2)}'),
                    _infoRow('Food & Beverage', 'KES ${(_folio?['food_charges'] ?? 0 + _folio?['beverage_charges'] ?? 0).toStringAsFixed(2)}'),
                    _infoRow('Other Charges', 'KES ${(_folio?['other_charges'] ?? 0).toStringAsFixed(2)}'),
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

          // Payment Collection (if balance > 0) - Future implementation
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
                        Icon(Icons.warning_amber, color: Colors.orange.shade700),
                        const SizedBox(width: 8),
                        const Text('Outstanding Balance', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text('Balance: KES ${_balance.toStringAsFixed(2)}', 
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    const Text('Payment collection feature coming soon', 
                      style: TextStyle(fontSize: 12, color: Colors.grey)),
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
              backgroundColor: _balance > 0 ? Colors.orange : AppColors.kPrimary,
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
                    _balance > 0 ? 'Check-Out (Balance Outstanding)' : 'Complete Check-Out',
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
