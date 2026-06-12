import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/models.dart';
import '../../data/repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CreateReservationScreen extends ConsumerStatefulWidget {
  const CreateReservationScreen({super.key});

  @override
  ConsumerState<CreateReservationScreen> createState() =>
      _CreateReservationScreenState();
}

class _CreateReservationScreenState
    extends ConsumerState<CreateReservationScreen> {
  final _formKey = GlobalKey<FormState>();
  late final ReceptionRepository _repository;

  // Step tracking
  int _currentStep = 0;

  // Guest selection
  Guest? _selectedGuest;
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _idNumberController = TextEditingController();
  final _carNumberPlateController = TextEditingController();
  String _idType = 'National ID';

  // Room selection
  Room? _selectedRoom;
  String? _selectedRoomTypeId;
  List<Room> _availableRooms = [];
  bool _loadingRooms = false;

  // Dates
  DateTime _checkInDate = DateTime.now();
  DateTime _checkOutDate = DateTime.now().add(const Duration(days: 1));

  // Occupancy
  int _adults = 1;
  int _children = 0;
  int _infants = 0;

  // Pricing
  double _roomRate = 0;
  double _subtotal = 0;
  double _taxAmount = 0;
  double _serviceCharge = 0;
  double _totalAmount = 0;
  bool _loadingPrice = false;

  // Additional
  String _mealPlan = 'Room Only';
  String _bookingSource = 'Walk-In';
  final _specialRequestsController = TextEditingController();
  final _internalNotesController = TextEditingController();

  // Payment
  double _depositAmount = 0;
  String _paymentMethod = 'Cash';

  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _repository = ref.read(receptionRepositoryProvider);
    _searchAvailableRooms();
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _idNumberController.dispose();
    _carNumberPlateController.dispose();
    _specialRequestsController.dispose();
    _internalNotesController.dispose();
    super.dispose();
  }

  Future<void> _searchAvailableRooms() async {
    setState(() => _loadingRooms = true);
    try {
      final roomsData = await _repository.getAvailableRooms({
        'check_in_date': _checkInDate.toIso8601String().split('T')[0],
        'check_out_date': _checkOutDate.toIso8601String().split('T')[0],
      });
      final rooms = roomsData.map((data) => Room.fromJson(data)).toList();
      setState(() {
        _availableRooms = rooms;
        _loadingRooms = false;
      });
    } catch (e) {
      setState(() => _loadingRooms = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load rooms: $e')),
        );
      }
    }
  }

  Future<void> _calculatePricing() async {
    if (_selectedRoom == null && _selectedRoomTypeId == null) return;

    setState(() => _loadingPrice = true);
    try {
      final quote = await _repository.getBookingQuote(
        roomId: _selectedRoom?.id,
        roomTypeId: _selectedRoomTypeId,
        checkIn: _checkInDate,
        checkOut: _checkOutDate,
        adults: _adults,
        children: _children,
      );

      setState(() {
        _roomRate = quote['room_rate'] ?? 0;
        _subtotal = quote['subtotal'] ?? 0;
        _taxAmount = quote['tax_amount'] ?? 0;
        _serviceCharge = quote['service_charge'] ?? 0;
        _totalAmount = quote['total_amount'] ?? 0;
        _loadingPrice = false;
      });
    } catch (e) {
      setState(() => _loadingPrice = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to calculate price: $e')),
        );
      }
    }
  }

  Future<void> _submitReservation() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);
    try {
      // Create or use existing guest
      String guestId;
      if (_selectedGuest != null) {
        guestId = _selectedGuest!.id;
      } else {
        final guestData = await _repository.createGuest({
          'first_name': _firstNameController.text.trim(),
          'last_name': _lastNameController.text.trim(),
          'phone': _phoneController.text.trim(),
          if (_emailController.text.trim().isNotEmpty)
            'email': _emailController.text.trim(),
          if (_idType.isNotEmpty) 'id_type': _idType,
          'id_number': _idNumberController.text.trim(),
          if (_carNumberPlateController.text.trim().isNotEmpty)
            'car_number_plate':
                _carNumberPlateController.text.trim().toUpperCase(),
        });
        guestId = guestData['id'].toString();
      }

      // Create booking
      final booking = await _repository.createBooking({
        'guest_id': guestId,
        if (_selectedRoom?.id != null) 'room_id': _selectedRoom!.id,
        if (_selectedRoomTypeId != null) 'room_type_id': _selectedRoomTypeId,
        'check_in_date': _checkInDate.toIso8601String().split('T')[0],
        'check_out_date': _checkOutDate.toIso8601String().split('T')[0],
        'adults': _adults,
        'children': _children,
        'infants': _infants,
        'meal_plan': _mealPlan,
        'booking_source': _bookingSource,
        if (_specialRequestsController.text.trim().isNotEmpty)
          'special_requests': _specialRequestsController.text.trim(),
        if (_internalNotesController.text.trim().isNotEmpty)
          'internal_notes': _internalNotesController.text.trim(),
        'deposit_amount': _depositAmount,
        if (_paymentMethod.isNotEmpty) 'payment_method': _paymentMethod,
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Reservation created: ${booking.confirmationNumber}'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.of(context).pop(booking);
      }
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create reservation: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('New Reservation'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
      ),
      body: Form(
        key: _formKey,
        child: Stepper(
          currentStep: _currentStep,
          onStepContinue: () {
            if (_currentStep < 3) {
              setState(() => _currentStep++);
              if (_currentStep == 2) _calculatePricing();
            } else {
              _submitReservation();
            }
          },
          onStepCancel: () {
            if (_currentStep > 0) {
              setState(() => _currentStep--);
            } else {
              Navigator.of(context).pop();
            }
          },
          controlsBuilder: (context, details) {
            return Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Row(
                children: [
                  ElevatedButton(
                    onPressed: _isSubmitting ? null : details.onStepContinue,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.kPrimary,
                      foregroundColor: Colors.white,
                    ),
                    child: Text(
                        _currentStep == 3 ? 'Create Reservation' : 'Continue'),
                  ),
                  const SizedBox(width: 12),
                  TextButton(
                    onPressed: _isSubmitting ? null : details.onStepCancel,
                    child: Text(_currentStep == 0 ? 'Cancel' : 'Back'),
                  ),
                ],
              ),
            );
          },
          steps: [
            Step(
              title: const Text('Guest Information'),
              isActive: _currentStep >= 0,
              state: _currentStep > 0 ? StepState.complete : StepState.indexed,
              content: _buildGuestStep(),
            ),
            Step(
              title: const Text('Room & Dates'),
              isActive: _currentStep >= 1,
              state: _currentStep > 1 ? StepState.complete : StepState.indexed,
              content: _buildRoomStep(),
            ),
            Step(
              title: const Text('Details & Pricing'),
              isActive: _currentStep >= 2,
              state: _currentStep > 2 ? StepState.complete : StepState.indexed,
              content: _buildDetailsStep(),
            ),
            Step(
              title: const Text('Payment'),
              isActive: _currentStep >= 3,
              content: _buildPaymentStep(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGuestStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Guest search/select would go here
        const Text('New Guest', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        TextFormField(
          controller: _firstNameController,
          decoration: const InputDecoration(
            labelText: 'First Name *',
            border: OutlineInputBorder(),
          ),
          validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _lastNameController,
          decoration: const InputDecoration(
            labelText: 'Last Name *',
            border: OutlineInputBorder(),
          ),
          validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _phoneController,
          decoration: const InputDecoration(
            labelText: 'Phone *',
            border: OutlineInputBorder(),
          ),
          keyboardType: TextInputType.phone,
          validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _emailController,
          decoration: const InputDecoration(
            labelText: 'Email',
            border: OutlineInputBorder(),
          ),
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _idType,
          decoration: const InputDecoration(
            labelText: 'ID Type',
            border: OutlineInputBorder(),
          ),
          items: ['National ID', 'Passport', 'Driving License']
              .map((t) => DropdownMenuItem(value: t, child: Text(t)))
              .toList(),
          onChanged: (v) => setState(() => _idType = v!),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _idNumberController,
          decoration: const InputDecoration(
            labelText: 'ID Number *',
            border: OutlineInputBorder(),
          ),
          validator: (v) => v == null || v.trim().isEmpty ? 'Required' : null,
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _carNumberPlateController,
          decoration: const InputDecoration(
            labelText: 'Car Number Plate (optional)',
            border: OutlineInputBorder(),
          ),
          textCapitalization: TextCapitalization.characters,
        ),
      ],
    );
  }

  Widget _buildRoomStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Date selection
        ListTile(
          title: const Text('Check-In Date'),
          subtitle: Text(DateFormat('MMM dd, yyyy').format(_checkInDate)),
          trailing: const Icon(Icons.calendar_today),
          onTap: () async {
            final date = await showDatePicker(
              context: context,
              initialDate: _checkInDate,
              firstDate: DateTime.now(),
              lastDate: DateTime.now().add(const Duration(days: 365)),
            );
            if (date != null) {
              setState(() {
                _checkInDate = date;
                if (_checkOutDate
                    .isBefore(_checkInDate.add(const Duration(days: 1)))) {
                  _checkOutDate = _checkInDate.add(const Duration(days: 1));
                }
              });
              _searchAvailableRooms();
            }
          },
        ),
        ListTile(
          title: const Text('Check-Out Date'),
          subtitle: Text(DateFormat('MMM dd, yyyy').format(_checkOutDate)),
          trailing: const Icon(Icons.calendar_today),
          onTap: () async {
            final date = await showDatePicker(
              context: context,
              initialDate: _checkOutDate,
              firstDate: _checkInDate.add(const Duration(days: 1)),
              lastDate: DateTime.now().add(const Duration(days: 365)),
            );
            if (date != null) {
              setState(() => _checkOutDate = date);
              _searchAvailableRooms();
            }
          },
        ),
        const Divider(),
        // Occupancy
        Row(
          children: [
            Expanded(
              child: _buildCounter(
                  'Adults', _adults, (v) => setState(() => _adults = v)),
            ),
            Expanded(
              child: _buildCounter(
                  'Children', _children, (v) => setState(() => _children = v)),
            ),
            Expanded(
              child: _buildCounter(
                  'Infants', _infants, (v) => setState(() => _infants = v)),
            ),
          ],
        ),
        const Divider(),
        // Room selection
        const Text('Available Rooms',
            style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        if (_loadingRooms)
          const Center(child: CircularProgressIndicator())
        else if (_availableRooms.isEmpty)
          const Text('No rooms available for selected dates')
        else
          ..._availableRooms.map((room) {
            final isSelected = _selectedRoom?.id == room.id;
            return Card(
              color:
                  isSelected ? AppColors.kPrimary.withValues(alpha: 0.1) : null,
              child: ListTile(
                leading: Icon(
                  Icons.bed,
                  color: isSelected ? AppColors.kPrimary : null,
                ),
                title: Text('Room ${room.number}'),
                subtitle: Text(
                    '${room.type ?? "Standard"} • KES ${room.pricePerNight?.toStringAsFixed(0) ?? "0"}/night'),
                trailing: isSelected
                    ? const Icon(Icons.check_circle, color: AppColors.kPrimary)
                    : null,
                onTap: () {
                  setState(() {
                    _selectedRoom = room;
                    _selectedRoomTypeId = null;
                  });
                },
              ),
            );
          }),
      ],
    );
  }

  Widget _buildDetailsStep() {
    final nights = _checkOutDate.difference(_checkInDate).inDays;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<String>(
          initialValue: _mealPlan,
          decoration: const InputDecoration(
            labelText: 'Meal Plan',
            border: OutlineInputBorder(),
          ),
          items: ['Room Only', 'Bed & Breakfast', 'Half Board', 'Full Board']
              .map((m) => DropdownMenuItem(value: m, child: Text(m)))
              .toList(),
          onChanged: (v) => setState(() => _mealPlan = v!),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _bookingSource,
          decoration: const InputDecoration(
            labelText: 'Booking Source',
            border: OutlineInputBorder(),
          ),
          items: ['Walk-In', 'Phone', 'Email', 'Website', 'OTA']
              .map((s) => DropdownMenuItem(value: s, child: Text(s)))
              .toList(),
          onChanged: (v) => setState(() => _bookingSource = v!),
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _specialRequestsController,
          decoration: const InputDecoration(
            labelText: 'Special Requests',
            border: OutlineInputBorder(),
          ),
          maxLines: 2,
        ),
        const SizedBox(height: 12),
        TextFormField(
          controller: _internalNotesController,
          decoration: const InputDecoration(
            labelText: 'Internal Notes',
            border: OutlineInputBorder(),
          ),
          maxLines: 2,
        ),
        const Divider(height: 32),
        const Text('Pricing Summary',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 8),
        if (_loadingPrice)
          const Center(child: CircularProgressIndicator())
        else ...[
          _pricingRow('Nights', '$nights'),
          _pricingRow('Room Rate', 'KES ${_roomRate.toStringAsFixed(2)}/night'),
          _pricingRow('Subtotal', 'KES ${_subtotal.toStringAsFixed(2)}'),
          _pricingRow('Tax (16%)', 'KES ${_taxAmount.toStringAsFixed(2)}'),
          _pricingRow('Service Charge (10%)',
              'KES ${_serviceCharge.toStringAsFixed(2)}'),
          const Divider(),
          _pricingRow('Total Amount', 'KES ${_totalAmount.toStringAsFixed(2)}',
              bold: true),
        ],
      ],
    );
  }

  Widget _buildPaymentStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Deposit Payment',
            style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        TextFormField(
          decoration: const InputDecoration(
            labelText: 'Deposit Amount',
            border: OutlineInputBorder(),
            prefixText: 'KES ',
          ),
          keyboardType: TextInputType.number,
          onChanged: (v) =>
              setState(() => _depositAmount = double.tryParse(v) ?? 0),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          initialValue: _paymentMethod,
          decoration: const InputDecoration(
            labelText: 'Payment Method',
            border: OutlineInputBorder(),
          ),
          items: ['Cash', 'Card', 'M-Pesa', 'Bank Transfer']
              .map((m) => DropdownMenuItem(value: m, child: Text(m)))
              .toList(),
          onChanged: (v) => setState(() => _paymentMethod = v!),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.kPrimary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Total: KES ${_totalAmount.toStringAsFixed(2)}',
                  style: const TextStyle(fontWeight: FontWeight.bold)),
              Text('Deposit: KES ${_depositAmount.toStringAsFixed(2)}'),
              Text(
                  'Balance: KES ${(_totalAmount - _depositAmount).toStringAsFixed(2)}'),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCounter(String label, int value, ValueChanged<int> onChanged) {
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 12)),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            IconButton(
              icon: const Icon(Icons.remove_circle_outline),
              onPressed: value > 0 ? () => onChanged(value - 1) : null,
            ),
            Text('$value',
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            IconButton(
              icon: const Icon(Icons.add_circle_outline),
              onPressed: () => onChanged(value + 1),
            ),
          ],
        ),
      ],
    );
  }

  Widget _pricingRow(String label, String value, {bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                  fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
          Text(value,
              style: TextStyle(
                  fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
        ],
      ),
    );
  }
}
