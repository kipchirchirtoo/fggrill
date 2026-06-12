import 'package:flutter/material.dart';
import '../../domain/models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';

import '../../data/repository.dart';

class GuestManagementScreen extends ConsumerStatefulWidget {
  const GuestManagementScreen({super.key});

  @override
  ConsumerState<GuestManagementScreen> createState() =>
      _GuestManagementScreenState();
}

class _GuestManagementScreenState extends ConsumerState<GuestManagementScreen> {
  late final ReceptionRepository _repository;
  final _searchController = TextEditingController();

  List<Guest> _guests = [];
  List<Guest> _filteredGuests = [];
  bool _isLoading = false;
  String _filterType = 'all'; // all, vip, blacklisted

  @override
  void initState() {
    _repository = ref.read(receptionRepositoryProvider);
    super.initState();
    _loadGuests();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadGuests() async {
    setState(() => _isLoading = true);
    try {
      final guests = await _repository.getGuests();
      setState(() {
        _guests = guests;
        _applyFilters();
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load guests: $e')),
        );
      }
    }
  }

  void _applyFilters() {
    var filtered = _guests;

    // Apply type filter
    if (_filterType == 'vip') {
      filtered = filtered.where((g) => g.isVip).toList();
    } else if (_filterType == 'blacklisted') {
      filtered = filtered.where((g) => g.blacklistStatus).toList();
    }

    // Apply search filter
    final query = _searchController.text.toLowerCase();
    if (query.isNotEmpty) {
      filtered = filtered.where((g) {
        final first = g.firstName?.toLowerCase() ?? '';
        final last = g.lastName?.toLowerCase() ?? '';
        final phone = g.phone?.toLowerCase() ?? '';
        final email = g.email?.toLowerCase() ?? '';
        final idNumber = g.idNumber?.toLowerCase() ?? '';
        final carNumberPlate = g.carNumberPlate?.toLowerCase() ?? '';
        return first.contains(query) ||
            last.contains(query) ||
            phone.contains(query) ||
            email.contains(query) ||
            idNumber.contains(query) ||
            carNumberPlate.contains(query);
      }).toList();
    }

    setState(() => _filteredGuests = filtered);
  }

  Future<void> _showGuestDetails(Guest guest) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.9,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (context, scrollController) => _GuestDetailsSheet(
          guest: guest,
          scrollController: scrollController,
          onUpdate: _loadGuests,
        ),
      ),
    );
  }

  Future<void> _showCreateGuestDialog() async {
    await showDialog(
      context: context,
      builder: (context) => _CreateGuestDialog(onCreate: _loadGuests),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Guest Management'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: _showCreateGuestDialog,
          ),
        ],
      ),
      body: Column(
        children: [
          // Search and Filter
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                TextField(
                  controller: _searchController,
                  decoration: const InputDecoration(
                    labelText: 'Search guests',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.search),
                  ),
                  onChanged: (_) => _applyFilters(),
                ),
                const SizedBox(height: 12),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _filterChip('All', 'all'),
                      _filterChip('VIP', 'vip'),
                      _filterChip('Blacklisted', 'blacklisted'),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Guest List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _filteredGuests.isEmpty
                    ? const Center(child: Text('No guests found'))
                    : RefreshIndicator(
                        onRefresh: _loadGuests,
                        child: ListView.builder(
                          itemCount: _filteredGuests.length,
                          itemBuilder: (context, index) {
                            final guest = _filteredGuests[index];
                            return Card(
                              margin: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 4),
                              child: ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: guest.isVip
                                      ? Colors.amber
                                      : guest.blacklistStatus
                                          ? Colors.red
                                          : AppColors.kPrimary,
                                  child: Text(
                                    (guest.firstName?.isNotEmpty == true
                                        ? guest.firstName![0].toUpperCase()
                                        : 'G'),
                                    style: const TextStyle(color: Colors.white),
                                  ),
                                ),
                                title: Text(
                                    '${guest.firstName} ${guest.lastName}'),
                                subtitle: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(guest.phone ?? '-'),
                                    if (guest.email != null) Text(guest.email!),
                                    if (guest.loyaltyPoints != null &&
                                        guest.loyaltyPoints! > 0)
                                      Text('${guest.loyaltyPoints} points',
                                          style: const TextStyle(
                                              color: Colors.green)),
                                  ],
                                ),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (guest.isVip)
                                      const Icon(Icons.star,
                                          color: Colors.amber, size: 20),
                                    if (guest.blacklistStatus)
                                      const Icon(Icons.block,
                                          color: Colors.red, size: 20),
                                    const Icon(Icons.chevron_right),
                                  ],
                                ),
                                onTap: () => _showGuestDetails(guest),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String label, String value) {
    final isSelected = _filterType == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (_) {
          setState(() {
            _filterType = value;
            _applyFilters();
          });
        },
        selectedColor: AppColors.kPrimary.withValues(alpha: 0.2),
      ),
    );
  }
}

class _GuestDetailsSheet extends StatelessWidget {
  final Guest guest;
  final ScrollController scrollController;
  final VoidCallback onUpdate;

  const _GuestDetailsSheet({
    required this.guest,
    required this.scrollController,
    required this.onUpdate,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      child: ListView(
        controller: scrollController,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${guest.firstName} ${guest.lastName}',
                style:
                    const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
          const Divider(),
          _section('Contact Information', [
            _infoRow('Phone', guest.phone ?? '-'),
            if (guest.email != null) _infoRow('Email', guest.email!),
            if (guest.address != null) _infoRow('Address', guest.address!),
            if (guest.nationality != null)
              _infoRow('Nationality', guest.nationality!),
          ]),
          _section('Identification', [
            if (guest.idType != null) _infoRow('ID Type', guest.idType!),
            if (guest.idNumber != null) _infoRow('ID Number', guest.idNumber!),
            if (guest.carNumberPlate != null)
              _infoRow('Car Number Plate', guest.carNumberPlate!),
          ]),
          _section('Loyalty & Status', [
            _infoRow('VIP Status', guest.isVip ? 'Yes' : 'No'),
            if (guest.vipTier != null) _infoRow('VIP Tier', guest.vipTier!),
            if (guest.loyaltyPoints != null)
              _infoRow('Loyalty Points', '${guest.loyaltyPoints}'),
            _infoRow('Blacklisted', guest.blacklistStatus ? 'Yes' : 'No'),
            if (guest.blacklistReason != null)
              _infoRow('Reason', guest.blacklistReason!),
          ]),
          if (guest.notes != null)
            _section('Notes', [
              Text(guest.notes!,
                  style: const TextStyle(fontStyle: FontStyle.italic)),
            ]),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    // Edit guest
                  },
                  icon: const Icon(Icons.edit),
                  label: const Text('Edit'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    // View booking history
                  },
                  icon: const Icon(Icons.history),
                  label: const Text('History'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _section(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 16),
        Text(title,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const Divider(),
        ...children,
      ],
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(label, style: const TextStyle(color: Colors.grey)),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}

class _CreateGuestDialog extends ConsumerStatefulWidget {
  final VoidCallback onCreate;

  const _CreateGuestDialog({required this.onCreate});

  @override
  ConsumerState<_CreateGuestDialog> createState() => _CreateGuestDialogState();
}

class _CreateGuestDialogState extends ConsumerState<_CreateGuestDialog> {
  final _formKey = GlobalKey<FormState>();
  late final ReceptionRepository _repository;
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _idNumberController = TextEditingController();
  final _carNumberPlateController = TextEditingController();
  String _idType = 'National ID';
  bool _isSubmitting = false;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _idNumberController.dispose();
    _carNumberPlateController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);
    try {
      await _repository.createGuest({
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

      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Guest created successfully'),
              backgroundColor: Colors.green),
        );
        widget.onCreate();
      }
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create guest: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('New Guest'),
      content: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _firstNameController,
                decoration: const InputDecoration(labelText: 'First Name *'),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              TextFormField(
                controller: _lastNameController,
                decoration: const InputDecoration(labelText: 'Last Name *'),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              TextFormField(
                controller: _phoneController,
                decoration: const InputDecoration(labelText: 'Phone *'),
                keyboardType: TextInputType.phone,
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              TextFormField(
                controller: _emailController,
                decoration: const InputDecoration(labelText: 'Email'),
                keyboardType: TextInputType.emailAddress,
              ),
              DropdownButtonFormField<String>(
                initialValue: _idType,
                decoration: const InputDecoration(labelText: 'ID Type'),
                items: ['National ID', 'Passport', 'Driving License']
                    .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                    .toList(),
                onChanged: (v) => setState(() => _idType = v!),
              ),
              TextFormField(
                controller: _idNumberController,
                decoration: const InputDecoration(labelText: 'ID Number *'),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? 'Required' : null,
              ),
              TextFormField(
                controller: _carNumberPlateController,
                decoration: const InputDecoration(
                    labelText: 'Car Number Plate (optional)'),
                textCapitalization: TextCapitalization.characters,
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSubmitting ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: _isSubmitting ? null : _submit,
          child: _isSubmitting
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Create'),
        ),
      ],
    );
  }
}
