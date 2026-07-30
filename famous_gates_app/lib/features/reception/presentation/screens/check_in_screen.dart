import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/models.dart';
import '../../data/repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'move_room_screen.dart';

class CheckInScreen extends ConsumerStatefulWidget {
  final Booking? booking;

  const CheckInScreen({super.key, this.booking});

  @override
  ConsumerState<CheckInScreen> createState() => _CheckInScreenState();
}

class _CheckInScreenState extends ConsumerState<CheckInScreen> {
  late final ReceptionRepository _repository;
  final _searchController = TextEditingController();

  Booking? _selectedBooking;
  bool _isSearching = false;
  bool _isSubmitting = false;

  // Payment

  // Documents
  final List<Map<String, dynamic>> _uploadedDocuments = [];

  @override
  void initState() {
    super.initState();
    _repository = ref.read(receptionRepositoryProvider);
    if (widget.booking != null) {
      _selectedBooking = widget.booking;
      _calculatePayment();
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _calculatePayment() {
    // Payment calculation for future implementation
    // if (_selectedBooking == null) return;
    // final balance = _selectedBooking!.balance;
    // setState(() => _paymentAmount = balance > 0 ? balance : 0);
  }

  Future<void> _searchBooking() async {
    final query = _searchController.text.trim();
    if (query.isEmpty) return;

    setState(() => _isSearching = true);
    try {
      final bookings = await _repository.getBookings(status: 'confirmed');
      final found = bookings.where((b) {
        final q = query.toLowerCase();
        return (b.confirmationNumber?.toLowerCase().contains(q) ?? false) ||
            (b.guestName?.toLowerCase().contains(q) ?? false) ||
            (b.roomNumber?.toLowerCase().contains(q) ?? false);
      }).toList();

      if (found.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('No matching confirmed bookings found')),
          );
        }
      } else if (found.length == 1) {
        setState(() {
          _selectedBooking = found.first;
          _isSearching = false;
        });
        _calculatePayment();
      } else {
        // Show selection dialog
        if (mounted) {
          final selected = await showDialog<Booking>(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Select Booking'),
              content: SizedBox(
                width: double.maxFinite,
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: found.length,
                  itemBuilder: (context, index) {
                    final booking = found[index];
                    return ListTile(
                      title: Text(booking.guestName ?? 'Guest'),
                      subtitle: Text('${booking.confirmationNumber ?? "-"} • Room ${booking.roomNumber ?? "TBA"}'),
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
            _calculatePayment();
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

  Future<void> _pickDocument() async {
    // File picker functionality would require adding file_picker package
    // For now, show a placeholder message
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Document upload feature - add file_picker package')),
      );
    }
  }

  Future<void> _performCheckIn() async {
    if (_selectedBooking == null) return;

    setState(() => _isSubmitting = true);
    try {
      // Perform check-in
      await _repository.checkInBooking(_selectedBooking!.id);

      // Update room status
      if (_selectedBooking!.roomId != null && _selectedBooking!.roomId!.isNotEmpty) {
        await _repository.updateRoomStatus(_selectedBooking!.roomId!, 'occupied');
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Guest checked in to Room ${_selectedBooking!.roomNumber}'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Check-in failed: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Guest Check-In'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
      ),
      body: _selectedBooking == null ? _buildSearchView() : _buildCheckInView(),
    );
  }

  Widget _buildSearchView() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Search Confirmed Booking',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _searchController,
            decoration: InputDecoration(
              labelText: 'Confirmation Number, Guest Name, or Room',
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
          const SizedBox(height: 16),
          const Text(
            'Or scan QR code / NFC tag',
            style: TextStyle(color: Colors.grey),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildCheckInView() {
    final booking = _selectedBooking!;
    final nights = booking.checkOut.difference(booking.checkIn).inDays;
    final balance = booking.balance;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Booking Summary Card
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
                      const Text('Booking Details', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => setState(() => _selectedBooking = null),
                      ),
                    ],
                  ),
                  const Divider(),
                  _infoRow('Confirmation', booking.confirmationNumber ?? '-'),
                  _infoRow('Guest', booking.guestName ?? '-'),
                  _infoRow('Room', booking.roomNumber ?? 'To be assigned'),
                  _infoRow('Room Type', booking.roomType ?? '-'),
                  _infoRow('Check-In', DateFormat('MMM dd, yyyy').format(booking.checkIn)),
                  _infoRow('Check-Out', DateFormat('MMM dd, yyyy').format(booking.checkOut)),
                  _infoRow('Nights', '$nights'),
                  _infoRow('Guests', '${booking.adults} Adults, ${booking.children} Children'),
                  if (booking.specialRequests != null && booking.specialRequests!.isNotEmpty) ...[
                    const Divider(),
                    const Text('Special Requests:', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    Text(booking.specialRequests!, style: const TextStyle(fontStyle: FontStyle.italic)),
                  ],
                  // Move Room button — only show for checked-in bookings
                  if (booking.status == 'checked_in') ...[
                    const Divider(),
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.deepOrange,
                        side: const BorderSide(color: Colors.deepOrange),
                        minimumSize: const Size.fromHeight(42),
                      ),
                      icon: const Icon(Icons.swap_horiz),
                      label: const Text('Move to Another Room'),
                      onPressed: () async {
                        final result = await Navigator.of(context).push<bool>(
                          MaterialPageRoute(
                            builder: (_) => MoveRoomScreen(
                              bookingId: booking.id,
                              currentRoom: booking.roomNumber ?? 'Current Room',
                              guestName: booking.guestName ?? 'Guest',
                              checkIn: DateFormat('yyyy-MM-dd').format(booking.checkIn),
                              checkOut: DateFormat('yyyy-MM-dd').format(booking.checkOut),
                            ),
                          ),
                        );
                        if (result == true && mounted) {
                          setState(() => _selectedBooking = null);
                        }
                      },
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Financial Summary
          Card(
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Financial Summary', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const Divider(),
                  _infoRow('Total Amount', 'KES ${(booking.totalAmount ?? 0).toStringAsFixed(2)}'),
                  _infoRow('Amount Paid', 'KES ${(booking.amountPaid ?? 0).toStringAsFixed(2)}'),
                  _infoRow('Balance Due', 'KES ${balance.toStringAsFixed(2)}', bold: true),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Payment Collection (if balance > 0) - Future implementation
          // Payment collection will be implemented in a future update
          if (balance > 0) ...[
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
                    Text('Balance: KES ${balance.toStringAsFixed(2)}', 
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    const Text('Payment can be collected at check-out', 
                      style: TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Document Upload
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
                      const Text('Guest Documents', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      IconButton(
                        icon: const Icon(Icons.add_circle_outline),
                        onPressed: _pickDocument,
                      ),
                    ],
                  ),
                  const Divider(),
                  if (_uploadedDocuments.isEmpty)
                    const Text('No documents uploaded', style: TextStyle(color: Colors.grey))
                  else
                    ..._uploadedDocuments.map((doc) {
                      return ListTile(
                        leading: const Icon(Icons.insert_drive_file),
                        title: Text(doc['name']),
                        subtitle: Text('${(doc['size'] / 1024).toStringAsFixed(1)} KB'),
                        trailing: IconButton(
                          icon: const Icon(Icons.delete_outline),
                          onPressed: () {
                            setState(() => _uploadedDocuments.remove(doc));
                          },
                        ),
                      );
                    }),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Check-In Button
          ElevatedButton(
            onPressed: _isSubmitting ? null : _performCheckIn,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.kPrimary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            child: _isSubmitting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                  )
                : const Text('Complete Check-In', style: TextStyle(fontSize: 16)),
          ),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value, {bool bold = false}) {
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
            ),
          ),
        ],
      ),
    );
  }
}
