import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_notifier.dart';
import '../../../core/widgets/sticky_horizontal_scrollbar.dart';
import '../data/branch_storekeeper_repository.dart';
import 'record_spoilage_screen.dart';

class KitchenStocktakeScreen extends ConsumerStatefulWidget {
  final VoidCallback? onBack;
  const KitchenStocktakeScreen({super.key, this.onBack});

  @override
  ConsumerState<KitchenStocktakeScreen> createState() =>
      _KitchenStocktakeScreenState();
}

class _KitchenStocktakeScreenState
    extends ConsumerState<KitchenStocktakeScreen> {
  DateTime _date = DateTime.now();
  String _selectedShift = 'A';
  late Future<Map<String, dynamic>> _future = _load();
  bool _saving = false;

  final Map<String, TextEditingController> _physicalControllers = {};
  final List<TextEditingController> _chefControllers =
      List.generate(5, (_) => TextEditingController());
  final TextEditingController _dispenserController = TextEditingController();
  final TextEditingController _confirmationController = TextEditingController();

  @override
  void dispose() {
    for (final controller in [
      ..._physicalControllers.values,
      ..._chefControllers,
      _dispenserController,
      _confirmationController,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  String get _dateStr => DateFormat('yyyy-MM-dd').format(_date);

  String _rowKey(Map<String, dynamic> item) =>
      '${item['item_id'] ?? ''}::${item['item_name'] ?? ''}';

  double _toDouble(dynamic value) =>
      value is num ? value.toDouble() : double.tryParse('$value') ?? 0;

  String _fmt(dynamic value) {
    final number = _toDouble(value);
    if (number == 0) return '0.00';
    if (number == number.roundToDouble()) return number.toInt().toString();
    return number.toStringAsFixed(2);
  }

  String _emptyStateMessage(Map<String, dynamic> data) {
    final standardsConfigured = data['standards_configured'] == true;
    if (!standardsConfigured) {
      return 'No kitchen standards are configured for this branch yet.';
    }
    return 'No standards-backed kitchen stock items were found for this stocktake context.';
  }

  String _emptyStateHint(Map<String, dynamic> data) {
    final standardsConfigured = data['standards_configured'] == true;
    if (!standardsConfigured) {
      return 'Branch Accountant should configure kitchen recipe/channel standards first. Only items with standards load here.';
    }
    return 'Open the kitchen session, or complete stock issue/production against standards-backed items and refresh.';
  }

  bool _isLockedStatus(String status) {
    final normalized = status.trim().toLowerCase();
    return normalized == 'submitted' ||
        normalized == 'reviewed' ||
        normalized == 'approved' ||
        normalized == 'posted';
  }

  Future<Map<String, dynamic>> _load() async {
    final repo = ref.read(branchStorekeeperRepositoryProvider);
    final data =
        await repo.kitchenStocktake(date: _dateStr, shift: _selectedShift);

    _dispenserController.text = '${data['dispenser_name'] ?? ''}';
    _confirmationController.text = '${data['confirmation_name'] ?? ''}';

    final chefs = (data['cheps_on_duty'] as List?) ?? const [];
    for (var i = 0; i < _chefControllers.length; i++) {
      _chefControllers[i].text = i < chefs.length ? '${chefs[i]}' : '';
    }

    final items = ((data['items'] as List?) ?? const [])
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
    for (final item in items) {
      final key = _rowKey(item);
      _physicalControllers
          .putIfAbsent(key, () => TextEditingController())
          .text = _fmt(item['closing_qty']);
    }

    final resolvedShift = (data['shift'] ?? _selectedShift).toString();
    if (resolvedShift != _selectedShift && mounted) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          setState(() => _selectedShift = resolvedShift);
        }
      });
    }

    return data;
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (picked == null) return;
    setState(() {
      _date = picked;
      _future = _load();
    });
  }

  void _reload() {
    setState(() {
      _future = _load();
    });
  }

  Future<void> _submit(Map<String, dynamic> data) async {
    final items = ((data['items'] as List?) ?? const [])
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();

    final payload = <Map<String, dynamic>>[];

    for (final item in items) {
      final key = _rowKey(item);
      final physicalQty = _toDouble(_physicalControllers[key]?.text.trim());

      payload.add({
        'item_id': item['item_id'],
        'item_name': item['item_name'],
        'closing_qty': physicalQty,
      });
    }

    setState(() => _saving = true);
    try {
      await ref.read(branchStorekeeperRepositoryProvider).saveKitchenStocktake(
            date: _dateStr,
            shift: _selectedShift,
            items: payload,
            dispenserName: _dispenserController.text.trim(),
            chepsOnDuty: _chefControllers
                .map((controller) => controller.text.trim())
                .where((value) => value.isNotEmpty)
                .toList(),
            confirmationName: _confirmationController.text.trim(),
            submit: true,
          );
      if (!mounted) return;
      AppNotifier.showSnackBar(
        context,
        const SnackBar(content: Text('Kitchen stocktake submitted')),
      );
      _reload();
    } catch (error) {
      if (!mounted) return;
      AppNotifier.showSnackBar(
        context,
        SnackBar(content: Text('Submission failed: $error')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      appBar: AppBar(
        title: const Text('Kitchen Stocktake'),
        actions: [
          IconButton(
            tooltip: 'Record Spoilage',
            icon: const Icon(Icons.report_problem_outlined),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => RecordSpoilageScreen(
                  initialArea: 'kitchen',
                  initialShift: _selectedShift,
                ),
              ),
            ),
          ),
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: _reload,
          ),
        ],
      ),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
                child: Text(
                    'Failed to load kitchen stocktake: ${snapshot.error}'));
          }

          final data = snapshot.data ?? <String, dynamic>{};
          final items = ((data['items'] as List?) ?? const [])
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList();
          final status = (data['status'] ?? 'draft').toString();
          final isLocked = _isLockedStatus(status);
          final shiftOptions = ((data['available_shifts'] as List?) ?? const [])
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList();

          return Column(
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(
                    bottom: BorderSide(color: Color(0xFFE2E8F0)),
                  ),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.event,
                            size: 18, color: AppColors.kTextSecondary),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Stocktake date: $_dateStr',
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                        OutlinedButton.icon(
                          onPressed: _pickDate,
                          icon: const Icon(Icons.calendar_month, size: 16),
                          label: const Text('Change date'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    if (shiftOptions.length > 1)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: shiftOptions.map((option) {
                            final value = (option['value'] ?? 'A').toString();
                            final selected = value == _selectedShift;
                            return ChoiceChip(
                              label:
                                  Text((option['label'] ?? value).toString()),
                              selected: selected,
                              onSelected: (_) {
                                if (_selectedShift == value) return;
                                setState(() {
                                  _selectedShift = value;
                                  _future = _load();
                                });
                              },
                            );
                          }).toList(),
                        ),
                      ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    _ContextCard(data: data),
                    const SizedBox(height: 16),
                    if (data['fixed_catalog'] == true) ...[
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF7ED),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFFED7AA)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.info_outline,
                                size: 18, color: Color(0xFF9A3412)),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'No kitchen standards are configured for this branch yet, '
                                'so the default kitchen catalog is loaded. You can still '
                                'count physical stock now; the Branch Accountant can set '
                                'recipe/channel standards later for variance analysis.',
                                style: TextStyle(
                                  color: Color(0xFF9A3412),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    if (items.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(28),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          children: [
                            Icon(
                              Icons.inventory_2_outlined,
                              color: Colors.grey.shade500,
                              size: 34,
                            ),
                            const SizedBox(height: 10),
                            Text(
                              _emptyStateMessage(data),
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              _emptyStateHint(data),
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Colors.grey.shade700),
                            ),
                          ],
                        ),
                      )
                    else
                      _LedgerTable(
                        items: items,
                        physicalControllers: _physicalControllers,
                        formatNumber: _fmt,
                        rowKeyFor: _rowKey,
                        locked: isLocked,
                      ),
                    const SizedBox(height: 16),
                    _StaffSection(
                      dispenserController: _dispenserController,
                      confirmationController: _confirmationController,
                      chefControllers: _chefControllers,
                      shiftLabel:
                          (data['shift_label'] ?? _selectedShift).toString(),
                      locked: isLocked,
                    ),
                    const SizedBox(height: 18),
                    if (isLocked)
                      Container(
                        margin: const EdgeInsets.only(bottom: 14),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.lock_outline,
                                size: 18, color: Color(0xFF334155)),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'This stocktake is locked after submission. Variance is now visible for review, and Branch Accountant handles the analysis and approval.',
                                style: TextStyle(
                                  color: Color(0xFF334155),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _saving
                                ? null
                                : () {
                                    if (widget.onBack != null) {
                                      widget.onBack!();
                                    } else {
                                      Navigator.of(context).pop();
                                    }
                                  },
                            child: const Text('Back'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        if (!isLocked)
                          Expanded(
                            child: FilledButton(
                              onPressed: _saving ? null : () => _submit(data),
                              child: Text(_saving
                                  ? 'Submitting...'
                                  : 'Submit Stocktake'),
                            ),
                          )
                        else
                          Expanded(
                            child: FilledButton(
                              onPressed: null,
                              child: Text(status.toUpperCase()),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ContextCard extends StatelessWidget {
  const _ContextCard({required this.data});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final stocktakeType =
        (data['stocktake_type'] ?? 'opening_shift_a').toString();
    final stocktakeTypeLabel = _stocktakeTypeLabelStatic(stocktakeType);
    final shiftLabel =
        (data['shift_label'] ?? data['shift'] ?? 'Shift A').toString();
    final kitchenShiftNumber =
        (data['kitchen_shift_number'] ?? 'Not opened yet').toString();
    final kitchenShiftStatus =
        (data['kitchen_shift_status'] ?? 'draft').toString().toUpperCase();
    final department = (data['department'] ?? 'KITCHEN').toString();

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Wrap(
        spacing: 18,
        runSpacing: 16,
        children: [
          _ContextPill(label: 'Stocktake Type', value: stocktakeTypeLabel),
          _ContextPill(label: 'Shift', value: shiftLabel),
          _ContextPill(label: 'Kitchen Shift', value: kitchenShiftNumber),
          _ContextPill(label: 'Status', value: kitchenShiftStatus),
          _ContextPill(label: 'Department', value: department),
        ],
      ),
    );
  }

  static String _stocktakeTypeLabelStatic(String type) {
    switch (type) {
      case 'opening_shift_a':
        return 'Opening Stocktake';
      case 'opening_single_shift':
        return 'Opening Single Shift';
      case 'shift_a_active':
        return 'Shift A Active';
      case 'shift_a_handover':
        return 'Shift A Handover';
      case 'shift_b_active':
        return 'Shift B Active';
      case 'single_shift_stocktake':
        return 'Single Shift';
      case 'shift_b_unavailable':
        return 'Shift B Not Available';
      default:
        return type.replaceAll('_', ' ');
    }
  }
}

class _ContextPill extends StatelessWidget {
  const _ContextPill({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 210,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: Colors.grey.shade700,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }
}

class _LedgerTable extends StatelessWidget {
  const _LedgerTable({
    required this.items,
    required this.physicalControllers,
    required this.formatNumber,
    required this.rowKeyFor,
    required this.locked,
  });

  final List<Map<String, dynamic>> items;
  final Map<String, TextEditingController> physicalControllers;
  final String Function(dynamic value) formatNumber;
  final String Function(Map<String, dynamic> item) rowKeyFor;
  final bool locked;

  double _toDouble(dynamic value) =>
      value is num ? value.toDouble() : double.tryParse('$value') ?? 0;

  double _varianceFor(Map<String, dynamic> item, TextEditingController controller) {
    final physical = _toDouble(controller.text.trim());
    final systemQty = _toDouble(item['system_qty']);
    return physical - systemQty;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: StickyHorizontalScrollbar(
          contentWidth: locked ? 748 : 636,
          child: Column(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: const BoxDecoration(
                  color: Color(0xFF0F2E5E),
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(12),
                    topRight: Radius.circular(12),
                  ),
                ),
                child: Row(
                  children: [
                    const _HeaderCell('#', 50),
                    const _HeaderCell('Item', 290),
                    const _HeaderCell('Physical Count', 160),
                    const _HeaderCell('Unit', 96),
                    if (locked) const _HeaderCell('Variance', 120),
                  ],
                ),
              ),
              ...List.generate(items.length, (index) {
                final item = items[index];
                final key = rowKeyFor(item);
                final physicalController = physicalControllers.putIfAbsent(
                  key,
                  () => TextEditingController(),
                );
                final rowColor =
                    index.isEven ? Colors.white : const Color(0xFFF8FAFC);
                final variance = _varianceFor(item, physicalController);

                return Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: rowColor,
                    border: Border(
                      bottom: BorderSide(color: Colors.grey.shade200),
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _BodyCell('${index + 1}', 50),
                      _BodyCell(
                        item['item_name']?.toString() ?? '-',
                        290,
                        bold: true,
                      ),
                      SizedBox(
                        width: 160,
                        child: TextField(
                          controller: physicalController,
                          readOnly: locked,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          decoration: const InputDecoration(
                            isDense: true,
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 10,
                            ),
                          ),
                        ),
                      ),
                      SizedBox(
                        width: 96,
                        child: Padding(
                          padding: const EdgeInsets.only(left: 14, top: 10),
                          child: Text(
                            item['unit']?.toString() ?? '-',
                            style: const TextStyle(
                              color: Color(0xFF0F172A),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ),
                      if (locked)
                        _BodyCell(
                          '${variance > 0 ? '+' : ''}${formatNumber(variance)}',
                          120,
                          bold: true,
                        ),
                    ],
                  ),
                );
              }),
            ],
          ),
        ),
      ),
    );
  }
}

class _HeaderCell extends StatelessWidget {
  const _HeaderCell(this.label, this.width);

  final String label;
  final double width;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w800,
          fontSize: 13,
        ),
      ),
    );
  }
}

class _BodyCell extends StatelessWidget {
  const _BodyCell(
    this.value,
    this.width, {
    this.bold = false,
  });

  final String value;
  final double width;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: Padding(
        padding: const EdgeInsets.only(top: 10),
        child: Text(
          value,
          style: TextStyle(
            color: const Color(0xFF0F172A),
            fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _StaffSection extends StatelessWidget {
  const _StaffSection({
    required this.dispenserController,
    required this.confirmationController,
    required this.chefControllers,
    required this.shiftLabel,
    required this.locked,
  });

  final TextEditingController dispenserController;
  final TextEditingController confirmationController;
  final List<TextEditingController> chefControllers;
  final String shiftLabel;
  final bool locked;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Shift Team',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: dispenserController,
            readOnly: locked,
            decoration: const InputDecoration(
              labelText: 'Dispenser on duty',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            'Chefs on duty - $shiftLabel',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          ...chefControllers.asMap().entries.map(
                (entry) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: TextField(
                    controller: entry.value,
                    readOnly: locked,
                    decoration: InputDecoration(
                      labelText: 'Chef ${entry.key + 1}',
                      border: const OutlineInputBorder(),
                    ),
                  ),
                ),
              ),
          const SizedBox(height: 8),
          TextField(
            controller: confirmationController,
            readOnly: locked,
            decoration: const InputDecoration(
              labelText: 'Confirmation name / sign-off',
              border: OutlineInputBorder(),
            ),
          ),
        ],
      ),
    );
  }
}
