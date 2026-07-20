import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../data/repository.dart';

class EventOrdersScreen extends ConsumerStatefulWidget {
  const EventOrdersScreen({super.key});

  @override
  ConsumerState<EventOrdersScreen> createState() => _EventOrdersScreenState();
}

class _EventOrdersScreenState extends ConsumerState<EventOrdersScreen> {
  final NumberFormat _money = NumberFormat.currency(symbol: 'KES ', decimalDigits: 2);
  String _statusFilter = 'all';
  String _typeFilter = 'all';
  int _reloadTick = 0;

  Future<List<Map<String, dynamic>>> _load() {
    return ref.read(branchAccountantRepositoryProvider).getEventOrders(
          activeOnly: _statusFilter == 'active',
          eventType: _typeFilter == 'all' ? null : _typeFilter,
        );
  }

  void _refresh() {
    setState(() => _reloadTick++);
  }

  String _eventTypeLabel(String raw) {
    switch (raw.trim().toLowerCase()) {
      case 'conference':
        return 'Conference';
      case 'buffet':
        return 'Buffet';
      case 'outside_catering':
        return 'Outside Catering';
      case 'group_meal':
        return 'Group Meal';
      default:
        return raw.isEmpty ? '-' : raw;
    }
  }

  Color _statusColor(String raw) {
    switch (raw.trim().toLowerCase()) {
      case 'completed':
        return const Color(0xFF15803D);
      case 'cancelled':
        return const Color(0xFFB91C1C);
      case 'in_progress':
        return const Color(0xFF7C3AED);
      case 'open':
      default:
        return const Color(0xFF1D4ED8);
    }
  }

  Future<void> _openEditor({Map<String, dynamic>? existing}) async {
    final changed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _EventOrderEditorDialog(existing: existing),
    );
    if (changed == true && mounted) {
      _refresh();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(existing == null
              ? 'Event Order created.'
              : 'Event Order updated.'),
        ),
      );
    }
  }

  Future<void> _completeOrder(Map<String, dynamic> row) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Complete Event Order'),
            content: Text(
              'Mark ${row['event_number'] ?? 'this event order'} as completed?',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Complete'),
              ),
            ],
          ),
        ) ??
        false;
    if (!confirmed || !mounted) return;

    try {
      await ref
          .read(branchAccountantRepositoryProvider)
          .completeEventOrder('${row['id']}');
      _refresh();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Event Order marked as completed.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to complete Event Order: $e')),
      );
    }
  }

  Future<void> _deleteOrder(Map<String, dynamic> row) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Delete Event Order'),
            content: Text(
              'Delete ${row['event_number'] ?? 'this event order'}? This cannot be undone.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: Colors.red),
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Delete'),
              ),
            ],
          ),
        ) ??
        false;
    if (!confirmed || !mounted) return;

    try {
      await ref
          .read(branchAccountantRepositoryProvider)
          .deleteEventOrder('${row['id']}');
      _refresh();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Event Order deleted.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to delete Event Order: $e')),
      );
    }
  }

  Future<void> _exportOrder(Map<String, dynamic> row) async {
    try {
      final file = await ref
          .read(branchAccountantRepositoryProvider)
          .downloadEventOrderPdf(
            '${row['id']}',
            eventNumber: row['event_number']?.toString(),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('PDF exported to ${file.path}')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to export PDF: $e')),
      );
    }
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color tint) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: tint.withOpacity(0.12),
            child: Icon(icon, color: tint),
          ),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(color: Colors.black54)),
              const SizedBox(height: 4),
              Text(
                value,
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final repo = ref.read(branchAccountantRepositoryProvider);

    return FutureBuilder<List<Map<String, dynamic>>>(
      key: ValueKey('event_orders_$_reloadTick|$_statusFilter|$_typeFilter'),
      future: _load(),
      builder: (context, snapshot) {
        final rows = snapshot.data ?? const <Map<String, dynamic>>[];
        final activeCount = rows
            .where((row) => '${row['status'] ?? ''}'.toLowerCase() == 'open')
            .length;
        final totalValue = rows.fold<double>(
          0,
          (sum, row) => sum + ((row['total_amount'] as num?)?.toDouble() ?? 0),
        );

        return ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Row(
              children: [
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Event Orders',
                        style: TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      SizedBox(height: 8),
                      Text(
                        'Create and manage event orders for Conference, Buffet, Outside Catering, and Group Meal from Branch Accountant.',
                        style: TextStyle(color: Colors.black54, fontSize: 14),
                      ),
                    ],
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: _refresh,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Refresh'),
                ),
                const SizedBox(width: 12),
                FilledButton.icon(
                  onPressed: () => _openEditor(),
                  icon: const Icon(Icons.add),
                  label: const Text('New Event Order'),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _buildStatCard(
                    'Active Orders',
                    '$activeCount',
                    Icons.event_available,
                    const Color(0xFF1D4ED8),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildStatCard(
                    'Loaded Orders',
                    '${rows.length}',
                    Icons.inventory_2_outlined,
                    const Color(0xFF7C3AED),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildStatCard(
                    'Order Value',
                    _money.format(totalValue),
                    Icons.payments_outlined,
                    const Color(0xFF15803D),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Wrap(
                spacing: 16,
                runSpacing: 16,
                crossAxisAlignment: WrapCrossAlignment.end,
                children: [
                  SizedBox(
                    width: 260,
                    child: FutureBuilder<String>(
                      future: repo.getBranchId(),
                      builder: (context, branchSnapshot) => InputDecorator(
                        decoration: const InputDecoration(
                          labelText: 'Branch',
                          border: OutlineInputBorder(),
                        ),
                        child: Text(
                          branchSnapshot.connectionState == ConnectionState.waiting
                              ? 'Loading...'
                              : ((branchSnapshot.data?.isNotEmpty ?? false)
                                  ? 'Branch ${branchSnapshot.data}'
                                  : '-'),
                        ),
                      ),
                    ),
                  ),
                  SizedBox(
                    width: 220,
                    child: DropdownButtonFormField<String>(
                      value: _typeFilter,
                      decoration: const InputDecoration(
                        labelText: 'Event Type',
                        border: OutlineInputBorder(),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'all', child: Text('All')),
                        DropdownMenuItem(
                            value: 'conference', child: Text('Conference')),
                        DropdownMenuItem(value: 'buffet', child: Text('Buffet')),
                        DropdownMenuItem(
                            value: 'outside_catering',
                            child: Text('Outside Catering')),
                        DropdownMenuItem(
                            value: 'group_meal', child: Text('Group Meal')),
                      ],
                      onChanged: (value) {
                        setState(() => _typeFilter = value ?? 'all');
                      },
                    ),
                  ),
                  SizedBox(
                    width: 220,
                    child: DropdownButtonFormField<String>(
                      value: _statusFilter,
                      decoration: const InputDecoration(
                        labelText: 'Status Scope',
                        border: OutlineInputBorder(),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'all', child: Text('All Orders')),
                        DropdownMenuItem(
                            value: 'active', child: Text('Active Only')),
                      ],
                      onChanged: (value) {
                        setState(() => _statusFilter = value ?? 'all');
                      },
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: snapshot.connectionState == ConnectionState.waiting
                  ? const SizedBox(
                      height: 320,
                      child: Center(child: CircularProgressIndicator()),
                    )
                  : snapshot.hasError
                      ? Padding(
                          padding: const EdgeInsets.all(24),
                          child: Text(
                            'Failed to load Event Orders: ${snapshot.error}',
                            style: TextStyle(color: Colors.red.shade700),
                          ),
                        )
                      : rows.isEmpty
                          ? const Padding(
                              padding: EdgeInsets.all(24),
                              child: Text(
                                'No Event Orders found for the selected filters.',
                                style: TextStyle(color: Colors.black54),
                              ),
                            )
                          : SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: DataTable(
                                columnSpacing: 18,
                                headingRowColor: WidgetStateProperty.all(
                                  const Color(0xFFF8FAFC),
                                ),
                                columns: const [
                                  DataColumn(label: Text('Event No.')),
                                  DataColumn(label: Text('Event')),
                                  DataColumn(label: Text('Client')),
                                  DataColumn(label: Text('Type')),
                                  DataColumn(label: Text('Date')),
                                  DataColumn(label: Text('Pax')),
                                  DataColumn(label: Text('Package')),
                                  DataColumn(label: Text('Total')),
                                  DataColumn(label: Text('Paid')),
                                  DataColumn(label: Text('Payment')),
                                  DataColumn(label: Text('Status')),
                                  DataColumn(label: Text('Actions')),
                                ],
                                rows: rows.map((row) {
                                  final status = '${row['status'] ?? 'open'}';
                                  final total =
                                      (row['total_amount'] as num?)?.toDouble() ?? 0;
                                  final paid =
                                      (row['amount_paid'] as num?)?.toDouble() ?? 0;
                                  return DataRow(
                                    cells: [
                                      DataCell(Text(
                                          row['event_number']?.toString() ?? '-')),
                                      DataCell(Text(
                                          row['event_name']?.toString() ?? '-')),
                                      DataCell(Text(
                                          row['client_name']?.toString() ?? '-')),
                                      DataCell(
                                          Text(_eventTypeLabel('${row['event_type'] ?? ''}'))),
                                      DataCell(Text(
                                          row['event_date']?.toString() ?? '-')),
                                      DataCell(Text('${row['pax'] ?? 0}')),
                                      DataCell(Text(
                                          row['menu_package']?.toString() ?? '-')),
                                      DataCell(Text(_money.format(total))),
                                      DataCell(Text(_money.format(paid))),
                                      DataCell(Text(
                                          row['payment_status']?.toString() ??
                                              'pending')),
                                      DataCell(
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 10,
                                            vertical: 6,
                                          ),
                                          decoration: BoxDecoration(
                                            color: _statusColor(status)
                                                .withOpacity(0.12),
                                            borderRadius:
                                                BorderRadius.circular(999),
                                          ),
                                          child: Text(
                                            status.toUpperCase(),
                                            style: TextStyle(
                                              color: _statusColor(status),
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ),
                                      ),
                                      DataCell(
                                        Wrap(
                                          spacing: 8,
                                          children: [
                                            IconButton(
                                              tooltip: 'Edit',
                                              onPressed: () =>
                                                  _openEditor(existing: row),
                                              icon: const Icon(Icons.edit_outlined),
                                            ),
                                            IconButton(
                                              tooltip: 'Export PDF',
                                              onPressed: () => _exportOrder(row),
                                              icon:
                                                  const Icon(Icons.picture_as_pdf),
                                            ),
                                            if (status.toLowerCase() !=
                                                    'completed' &&
                                                status.toLowerCase() !=
                                                    'cancelled')
                                              IconButton(
                                                tooltip: 'Complete',
                                                onPressed: () => _completeOrder(row),
                                                icon: const Icon(
                                                    Icons.task_alt_outlined),
                                              ),
                                            IconButton(
                                              tooltip: 'Delete',
                                              onPressed: () => _deleteOrder(row),
                                              icon: const Icon(Icons.delete_outline),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  );
                                }).toList(),
                              ),
                            ),
            ),
          ],
        );
      },
    );
  }
}

class _EventOrderEditorDialog extends ConsumerStatefulWidget {
  const _EventOrderEditorDialog({this.existing});

  final Map<String, dynamic>? existing;

  @override
  ConsumerState<_EventOrderEditorDialog> createState() =>
      _EventOrderEditorDialogState();
}

class _EventOrderEditorDialogState
    extends ConsumerState<_EventOrderEditorDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _eventNameCtrl;
  late final TextEditingController _clientNameCtrl;
  late final TextEditingController _eventDateCtrl;
  late final TextEditingController _paxCtrl;
  late final TextEditingController _packageCtrl;
  late final TextEditingController _chargePerPaxCtrl;
  late final TextEditingController _totalAmountCtrl;
  late final TextEditingController _amountPaidCtrl;
  late final TextEditingController _creditDueDateCtrl;
  late final TextEditingController _notesCtrl;
  String _eventType = 'conference';
  String _paymentStatus = 'pending';
  String _paymentMethod = 'cash';
  String _status = 'open';
  String? _selectedPackageDefinitionId;
  bool _saving = false;
  bool _loadingPackages = true;
  String? _packageLoadError;
  List<Map<String, dynamic>> _packageOptions = const [];

  bool get _isEdit => widget.existing != null;
  String get _channelStandardCode =>
      _eventType == 'conference' ? 'conference_event' : _eventType;
  String get _eventTypeLabelForPackage {
    switch (_eventType) {
      case 'conference':
        return 'Conference';
      case 'buffet':
        return 'Buffet';
      case 'outside_catering':
        return 'Outside Catering';
      case 'group_meal':
        return 'Group Meal';
      default:
        return _eventType;
    }
  }

  @override
  void initState() {
    super.initState();
    final row = widget.existing ?? const <String, dynamic>{};
    _eventNameCtrl =
        TextEditingController(text: row['event_name']?.toString() ?? '');
    _clientNameCtrl =
        TextEditingController(text: row['client_name']?.toString() ?? '');
    _eventDateCtrl =
        TextEditingController(text: row['event_date']?.toString() ?? '');
    _paxCtrl = TextEditingController(text: '${row['pax'] ?? ''}');
    _packageCtrl =
        TextEditingController(text: row['menu_package']?.toString() ?? '');
    _chargePerPaxCtrl =
        TextEditingController(text: '${row['charge_per_pax'] ?? ''}');
    _totalAmountCtrl =
        TextEditingController(text: '${row['total_amount'] ?? ''}');
    _amountPaidCtrl =
        TextEditingController(text: '${row['amount_paid'] ?? ''}');
    _creditDueDateCtrl =
        TextEditingController(text: row['credit_due_date']?.toString() ?? '');
    _notesCtrl = TextEditingController(text: row['notes']?.toString() ?? '');
    _eventType = row['event_type']?.toString() ?? 'conference';
    _paymentStatus = row['payment_status']?.toString() ?? 'pending';
    _paymentMethod = row['payment_method']?.toString() ?? 'cash';
    _status = row['status']?.toString() ?? 'open';
    _selectedPackageDefinitionId =
        row['package_definition_id']?.toString().trim().isEmpty ?? true
            ? null
            : row['package_definition_id']?.toString();
    _loadPackageOptions();
  }

  @override
  void dispose() {
    _eventNameCtrl.dispose();
    _clientNameCtrl.dispose();
    _eventDateCtrl.dispose();
    _paxCtrl.dispose();
    _packageCtrl.dispose();
    _chargePerPaxCtrl.dispose();
    _totalAmountCtrl.dispose();
    _amountPaidCtrl.dispose();
    _creditDueDateCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate(TextEditingController controller) async {
    final initial = DateTime.tryParse(controller.text.trim()) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2024),
      lastDate: DateTime(2035),
    );
    if (picked != null) {
      controller.text = DateFormat('yyyy-MM-dd').format(picked);
    }
  }

  Future<void> _loadPackageOptions() async {
    setState(() {
      _loadingPackages = true;
      _packageLoadError = null;
    });
    try {
      final repo = ref.read(branchAccountantRepositoryProvider);
      final packages = await repo.getChannelPackages(
        channel: _channelStandardCode,
        completeOnly: true,
      );
      final existingValue = _packageCtrl.text.trim();
      if (existingValue.isNotEmpty &&
          !packages.any(
            (row) =>
                (row['package_name']?.toString().trim() ?? '') == existingValue,
          )) {
        packages.insert(0, {
          'id': _selectedPackageDefinitionId,
          'package_name': existingValue,
          'is_complete': false,
        });
      }
      if (_selectedPackageDefinitionId != null &&
          !packages.any(
            (row) =>
                (row['id']?.toString().trim() ?? '') ==
                _selectedPackageDefinitionId,
          ) &&
          existingValue.isNotEmpty) {
        packages.insert(0, {
          'id': _selectedPackageDefinitionId,
          'package_name': existingValue,
          'is_complete': false,
        });
      }
      if (mounted) {
        setState(() {
          _packageOptions = packages;
          _loadingPackages = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _packageLoadError = '$e';
          _packageOptions = const [];
          _loadingPackages = false;
        });
      }
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final repo = ref.read(branchAccountantRepositoryProvider);
      final payload = <String, dynamic>{
        'event_name': _eventNameCtrl.text.trim(),
        'client_name': _clientNameCtrl.text.trim(),
        'event_type': _eventType,
        'event_date': _eventDateCtrl.text.trim(),
        'pax': num.tryParse(_paxCtrl.text.trim()) ?? 0,
        'package_definition_id': _selectedPackageDefinitionId,
        'menu_package': _packageCtrl.text.trim(),
        'charge_per_pax': num.tryParse(_chargePerPaxCtrl.text.trim()) ?? 0,
        'total_amount': num.tryParse(_totalAmountCtrl.text.trim()) ?? 0,
        'amount_paid': num.tryParse(_amountPaidCtrl.text.trim()) ?? 0,
        'payment_status': _paymentStatus,
        'payment_method': _paymentMethod,
        'credit_due_date': _creditDueDateCtrl.text.trim().isEmpty
            ? null
            : _creditDueDateCtrl.text.trim(),
        'notes': _notesCtrl.text.trim(),
        'status': _status,
      };

      if (_isEdit) {
        await repo.updateEventOrder('${widget.existing!['id']}', payload);
      } else {
        await repo.createEventOrder(payload);
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to save Event Order: $e')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  InputDecoration _input(String label, {String? hint}) => InputDecoration(
        labelText: label,
        hintText: hint,
        border: const OutlineInputBorder(),
      );

  String? _packageIdForName(String name) {
    final normalized = name.trim();
    for (final row in _packageOptions) {
      if ((row['package_name']?.toString().trim() ?? '') == normalized) {
        final id = row['id']?.toString().trim();
        return (id == null || id.isEmpty) ? null : id;
      }
    }
    return null;
  }

  Widget _buildPackageField() {
    if (_loadingPackages) {
      return InputDecorator(
        decoration: _input('Menu / Package'),
        child: const Row(
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            SizedBox(width: 12),
            Text('Loading configured packages...'),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<String>(
          value: _packageCtrl.text.trim().isEmpty ? null : _packageCtrl.text.trim(),
          decoration: _input(
            'Menu / Package',
            hint: _packageOptions.isEmpty
                ? 'Set package standards first'
                : 'Select configured package',
          ),
          items: _packageOptions
              .map(
                (pkg) => DropdownMenuItem<String>(
                  value: pkg['package_name']?.toString().trim() ?? '',
                  child: Text(
                    pkg['package_name']?.toString() ?? '',
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
          onChanged: _packageOptions.isEmpty
              ? null
              : (value) {
                  setState(() {
                    _packageCtrl.text = value ?? '';
                    _selectedPackageDefinitionId =
                        value == null ? null : _packageIdForName(value);
                  });
                },
          validator: (value) {
            if (_loadingPackages) return 'Loading packages...';
            if (_packageLoadError != null) {
              return 'Failed to load configured packages';
            }
            if (_packageOptions.isEmpty) {
              return 'Set $_eventTypeLabelForPackage package standards first';
            }
            if (value == null || value.trim().isEmpty) {
              return 'Required';
            }
            return null;
          },
        ),
        const SizedBox(height: 8),
        Text(
          _packageLoadError != null
              ? 'Could not load package standards for $_eventTypeLabelForPackage.'
              : _packageOptions.isEmpty
                  ? 'No complete packages found for $_eventTypeLabelForPackage. Each package must have served POS menu items and raw stock items in Food Control Standards.'
                  : 'Loaded ${_packageOptions.length} configured package(s) with both served items and raw stock standards.',
          style: TextStyle(
            fontSize: 12,
            color: _packageLoadError != null || _packageOptions.isEmpty
                ? Colors.red.shade700
                : Colors.black54,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: const EdgeInsets.all(24),
      child: SizedBox(
        width: 980,
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _isEdit ? 'Edit Event Order' : 'New Event Order',
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Create event orders here in Branch Accountant so Storekeeper can issue stock against the correct active order.',
                  style: TextStyle(color: Colors.black54),
                ),
                const SizedBox(height: 20),
                Flexible(
                  child: SingleChildScrollView(
                    child: Wrap(
                      spacing: 16,
                      runSpacing: 16,
                      children: [
                        SizedBox(
                          width: 300,
                          child: TextFormField(
                            controller: _eventNameCtrl,
                            decoration: _input('Event Name'),
                            validator: (value) => (value == null || value.trim().isEmpty)
                                ? 'Required'
                                : null,
                          ),
                        ),
                        SizedBox(
                          width: 300,
                          child: TextFormField(
                            controller: _clientNameCtrl,
                            decoration: _input('Client Name'),
                            validator: (value) => (value == null || value.trim().isEmpty)
                                ? 'Required'
                                : null,
                          ),
                        ),
                        SizedBox(
                          width: 220,
                          child: DropdownButtonFormField<String>(
                            value: _eventType,
                            decoration: _input('Event Type'),
                            items: const [
                              DropdownMenuItem(
                                  value: 'conference', child: Text('Conference')),
                              DropdownMenuItem(value: 'buffet', child: Text('Buffet')),
                              DropdownMenuItem(
                                  value: 'outside_catering',
                                  child: Text('Outside Catering')),
                              DropdownMenuItem(
                                  value: 'group_meal', child: Text('Group Meal')),
                            ],
                            onChanged: (value) {
                              setState(() {
                                _eventType = value ?? 'conference';
                                _packageCtrl.clear();
                                _selectedPackageDefinitionId = null;
                              });
                              _loadPackageOptions();
                            },
                          ),
                        ),
                        SizedBox(
                          width: 220,
                          child: TextFormField(
                            controller: _eventDateCtrl,
                            readOnly: true,
                            decoration: _input('Event Date').copyWith(
                              suffixIcon: IconButton(
                                icon: const Icon(Icons.calendar_month_outlined),
                                onPressed: () => _pickDate(_eventDateCtrl),
                              ),
                            ),
                            validator: (value) => (value == null || value.trim().isEmpty)
                                ? 'Required'
                                : null,
                          ),
                        ),
                        SizedBox(
                          width: 160,
                          child: TextFormField(
                            controller: _paxCtrl,
                            keyboardType: TextInputType.number,
                            decoration: _input('Pax'),
                          ),
                        ),
                        SizedBox(
                          width: 300,
                          child: _buildPackageField(),
                        ),
                        SizedBox(
                          width: 180,
                          child: TextFormField(
                            controller: _chargePerPaxCtrl,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            decoration: _input('Charge / Pax'),
                          ),
                        ),
                        SizedBox(
                          width: 180,
                          child: TextFormField(
                            controller: _totalAmountCtrl,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            decoration: _input('Total Amount'),
                          ),
                        ),
                        SizedBox(
                          width: 180,
                          child: TextFormField(
                            controller: _amountPaidCtrl,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            decoration: _input('Amount Paid'),
                          ),
                        ),
                        SizedBox(
                          width: 180,
                          child: DropdownButtonFormField<String>(
                            value: _paymentStatus,
                            decoration: _input('Payment Status'),
                            items: const [
                              DropdownMenuItem(
                                  value: 'pending', child: Text('Pending')),
                              DropdownMenuItem(
                                  value: 'deposit_paid',
                                  child: Text('Deposit Paid')),
                              DropdownMenuItem(value: 'paid', child: Text('Paid')),
                            ],
                            onChanged: (value) {
                              setState(() => _paymentStatus = value ?? 'pending');
                            },
                          ),
                        ),
                        SizedBox(
                          width: 180,
                          child: DropdownButtonFormField<String>(
                            value: _paymentMethod,
                            decoration: _input('Payment Method'),
                            items: const [
                              DropdownMenuItem(value: 'cash', child: Text('Cash')),
                              DropdownMenuItem(value: 'mpesa', child: Text('M-Pesa')),
                              DropdownMenuItem(value: 'bank', child: Text('Bank')),
                              DropdownMenuItem(value: 'card', child: Text('Card')),
                              DropdownMenuItem(value: 'credit', child: Text('Credit')),
                            ],
                            onChanged: (value) {
                              setState(() => _paymentMethod = value ?? 'cash');
                            },
                          ),
                        ),
                        SizedBox(
                          width: 180,
                          child: DropdownButtonFormField<String>(
                            value: _status,
                            decoration: _input('Order Status'),
                            items: const [
                              DropdownMenuItem(value: 'open', child: Text('Open')),
                              DropdownMenuItem(
                                  value: 'in_progress', child: Text('In Progress')),
                              DropdownMenuItem(
                                  value: 'completed', child: Text('Completed')),
                              DropdownMenuItem(
                                  value: 'cancelled', child: Text('Cancelled')),
                            ],
                            onChanged: (value) {
                              setState(() => _status = value ?? 'open');
                            },
                          ),
                        ),
                        SizedBox(
                          width: 220,
                          child: TextFormField(
                            controller: _creditDueDateCtrl,
                            readOnly: true,
                            decoration: _input('Credit Due Date').copyWith(
                              suffixIcon: IconButton(
                                icon: const Icon(Icons.calendar_month_outlined),
                                onPressed: () => _pickDate(_creditDueDateCtrl),
                              ),
                            ),
                          ),
                        ),
                        SizedBox(
                          width: 936,
                          child: TextFormField(
                            controller: _notesCtrl,
                            maxLines: 4,
                            decoration: _input('Notes'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: _saving ? null : () => Navigator.of(context).pop(false),
                      child: const Text('Cancel'),
                    ),
                    const SizedBox(width: 12),
                    FilledButton.icon(
                      onPressed: _saving ? null : _save,
                      icon: _saving
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.save_outlined),
                      label: Text(_isEdit ? 'Save Changes' : 'Create Event Order'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
