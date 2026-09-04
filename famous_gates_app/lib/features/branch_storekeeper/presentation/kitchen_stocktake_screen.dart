import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_notifier.dart';
import '../../../core/widgets/sticky_horizontal_scrollbar.dart';
import '../../../services/report_service.dart';
import '../../auth/domain/auth_notifier.dart';
import '../stocktakes/data/store_stocktake_repository.dart';
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
  bool _exportingPdf = false;

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
    if (value == null) return '';
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
    final repo = ref.read(storeStocktakeRepositoryProvider);
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
      final rawClosing = item['closing_qty'];
      _physicalControllers
          .putIfAbsent(key, () => TextEditingController())
          .text = rawClosing != null ? _fmt(rawClosing) : '';
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

  Future<void> _exportKitchenStocktakePdf(
    Map<String, dynamic> data,
    List<Map<String, dynamic>> items,
  ) async {
    if (_exportingPdf) return;
    setState(() => _exportingPdf = true);
    try {
      final user = ref.read(authNotifierProvider).valueOrNull;
      final branchName = user?.branchName ?? 'Famous Gates Hotel';
      final status = (data['status'] ?? 'draft').toString();
      final shiftLabel = data['shift_name'] ?? _selectedShift;

      final enrichedItems = items.map((item) {
        final key = _rowKey(item);
        final physicalVal = _physicalControllers[key]?.text.trim();
        final numVal = double.tryParse(physicalVal ?? '');
        return {
          ...item,
          if (numVal != null) 'closing_qty': numVal,
        };
      }).toList();

      await ReportService().generateKitchenStocktakeReport(
        branchName: branchName,
        date: _dateStr,
        shift: '$shiftLabel',
        status: status,
        items: enrichedItems,
        dispenserName: _dispenserController.text.trim(),
        confirmationName: _confirmationController.text.trim(),
        chefsOnDuty: _chefControllers
            .map((c) => c.text.trim())
            .where((s) => s.isNotEmpty)
            .toList(),
        preparedBy: user?.name,
      );
    } catch (error) {
      if (!mounted) return;
      AppNotifier.showSnackBar(
        context,
        SnackBar(content: Text('Failed to generate PDF: $error')),
      );
    } finally {
      if (mounted) setState(() => _exportingPdf = false);
    }
  }

  Future<void> _submit(Map<String, dynamic> data) async {
    final items = ((data['items'] as List?) ?? const [])
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();

    if (items.isEmpty) {
      AppNotifier.showSnackBar(
        context,
        const SnackBar(content: Text('No kitchen items found to submit.')),
      );
      return;
    }

    // Check for items with missing physical counts
    final missingItems = <String>[];
    for (final item in items) {
      final key = _rowKey(item);
      final rawText = _physicalControllers[key]?.text.trim() ?? '';
      if (rawText.isEmpty) {
        final name = (item['item_name'] ?? item['name'] ?? 'Item').toString();
        missingItems.add(name);
      }
    }

    if (missingItems.isNotEmpty) {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Color(0xFFF9A825)),
              SizedBox(width: 8),
              Text('Missing Physical Counts'),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'You cannot submit without entering physical counts for all items (${missingItems.length} uncounted):\n',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                ...missingItems.take(15).map((name) => Padding(
                      padding: const EdgeInsets.only(bottom: 3),
                      child: Text('• $name', style: const TextStyle(fontSize: 13)),
                    )),
                if (missingItems.length > 15)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      '... and ${missingItems.length - 15} more items',
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('OK'),
            ),
          ],
        ),
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Submit Kitchen Stocktake'),
        content: Text(
          'Are you sure you want to submit the kitchen stocktake for date $_dateStr (Shift $_selectedShift)?\n\n'
          'Once submitted, the counts will be locked and sent to the Accountant and Auditor for review.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF0D2C54),
            ),
            child: const Text('Submit'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

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
      await ref.read(storeStocktakeRepositoryProvider).saveKitchenStocktake(
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
        const SnackBar(content: Text('Kitchen stocktake submitted successfully!')),
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
            tooltip: 'Download / Print Branded PDF',
            icon: _exportingPdf
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.picture_as_pdf_outlined),
            onPressed: () {
              _future.then((data) {
                final items = ((data['items'] as List?) ?? const [])
                    .whereType<Map>()
                    .map((item) => Map<String, dynamic>.from(item))
                    .toList();
                _exportKitchenStocktakePdf(data, items);
              });
            },
          ),
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
                        const SizedBox(width: 8),
                        FilledButton.icon(
                          onPressed: items.isEmpty || _exportingPdf
                              ? null
                              : () => _exportKitchenStocktakePdf(data, items),
                          icon: _exportingPdf
                              ? const SizedBox(
                                  width: 14,
                                  height: 14,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(
                                      Colors.white,
                                    ),
                                  ),
                                )
                              : const Icon(Icons.download_rounded, size: 16),
                          label: const Text('Download PDF'),
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF0D2C54),
                            foregroundColor: Colors.white,
                          ),
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
                    _BlindCountInfoCard(itemCount: items.length, locked: isLocked),
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

class _LedgerTable extends StatefulWidget {
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

  @override
  State<_LedgerTable> createState() => _LedgerTableState();
}

class _LedgerTableState extends State<_LedgerTable> {
  List<FocusNode> _focusNodes = [];
  int _lastItemCount = 0;

  void _ensureFocusNodes(int count) {
    if (count == _lastItemCount) return;
    for (final node in _focusNodes) {
      node.dispose();
    }
    _focusNodes = List.generate(count, (_) => FocusNode());
    _lastItemCount = count;
  }

  @override
  void dispose() {
    for (final node in _focusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  double _toDouble(dynamic value) =>
      value is num ? value.toDouble() : double.tryParse('$value') ?? 0;

  double _varianceFor(Map<String, dynamic> item, TextEditingController controller) {
    final physical = _toDouble(controller.text.trim());
    final systemQty = _toDouble(item['system_qty']);
    return physical - systemQty;
  }

  void _focusNextField(int index) {
    if (index >= _focusNodes.length - 1) {
      _focusNodes[index].unfocus();
      return;
    }

    final nextNode = _focusNodes[index + 1];
    FocusScope.of(context).requestFocus(nextNode);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final targetContext = nextNode.context;
      if (targetContext != null) {
        Scrollable.ensureVisible(
          targetContext,
          duration: const Duration(milliseconds: 140),
          curve: Curves.easeOut,
          alignment: 0.25,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    _ensureFocusNodes(widget.items.length);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A0F172A),
            blurRadius: 20,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: StickyHorizontalScrollbar(
          contentWidth: widget.locked ? 780 : 670,
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
                decoration: const BoxDecoration(
                  color: Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(12),
                    topRight: Radius.circular(12),
                  ),
                  border: Border(
                    bottom: BorderSide(color: Color(0xFFE2E8F0)),
                  ),
                ),
                child: Row(
                  children: [
                    const _HeaderCell('#', 50),
                    const _HeaderCell('Item', 308),
                    const _HeaderCell('Physical Count', 168, alignEnd: true),
                    const _HeaderCell('Unit', 94),
                    if (widget.locked)
                      const _HeaderCell('Variance', 120, alignEnd: true),
                  ],
                ),
              ),
              ...List.generate(widget.items.length, (index) {
                final item = widget.items[index];
                final key = widget.rowKeyFor(item);
                final physicalController = widget.physicalControllers.putIfAbsent(
                  key,
                  () => TextEditingController(),
                );
                final rowColor =
                    index.isEven ? Colors.white : const Color(0xFFF8FAFC);
                final variance = _varianceFor(item, physicalController);

                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
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
                        308,
                        bold: true,
                      ),
                      SizedBox(
                        width: 168,
                        child: TextField(
                          controller: physicalController,
                          focusNode: _focusNodes[index],
                          readOnly: widget.locked,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          textInputAction: index == widget.items.length - 1
                              ? TextInputAction.done
                              : TextInputAction.next,
                          onTap: () {
                            physicalController.selection = TextSelection(
                              baseOffset: 0,
                              extentOffset: physicalController.text.length,
                            );
                          },
                          onSubmitted: (_) {
                            _focusNextField(index);
                          },
                          decoration: InputDecoration(
                            isDense: true,
                            filled: true,
                            fillColor: Colors.white,
                            hintText: '0.00',
                            hintStyle: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              color: Colors.grey.shade400,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: const BorderSide(color: Color(0xFFD0D7E2)),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: const BorderSide(color: Color(0xFFD0D7E2)),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: BorderSide(
                                color: Theme.of(context).colorScheme.primary,
                                width: 1.5,
                              ),
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 14,
                            ),
                          ),
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A),
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      SizedBox(
                        width: 94,
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
                      if (widget.locked)
                        _BodyCell(
                          '${variance > 0 ? '+' : ''}${widget.formatNumber(variance)}',
                          120,
                          bold: true,
                          alignEnd: true,
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
  const _HeaderCell(this.label, this.width, {this.alignEnd = false});

  final String label;
  final double width;
  final bool alignEnd;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: Align(
        alignment: alignEnd ? Alignment.centerRight : Alignment.centerLeft,
        child: Text(
          label,
          style: const TextStyle(
            color: Color(0xFF64748B),
            fontWeight: FontWeight.w800,
            fontSize: 12,
          ),
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
    this.alignEnd = false,
  });

  final String value;
  final double width;
  final bool bold;
  final bool alignEnd;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: Align(
        alignment: alignEnd ? Alignment.centerRight : Alignment.centerLeft,
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
      ),
    );
  }
}

class _BlindCountInfoCard extends StatelessWidget {
  const _BlindCountInfoCard({
    required this.itemCount,
    required this.locked,
  });

  final int itemCount;
  final bool locked;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              locked ? Icons.lock_outline : Icons.visibility_off_outlined,
              color: const Color(0xFF1565C0),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              locked
                  ? 'This stocktake is locked. Physical counts remain visible and variance is now available for review.'
                  : 'Blind count mode is active. Enter physical count only, then press Enter to move straight to the next line.',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF334155),
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              '$itemCount item(s)',
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: Color(0xFF334155),
              ),
            ),
          ),
        ],
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
