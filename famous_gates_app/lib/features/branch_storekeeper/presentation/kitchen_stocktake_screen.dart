import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_notifier.dart';
import '../data/branch_storekeeper_repository.dart';
import 'record_spoilage_screen.dart';

/// Kitchen Stocktake — Branch Storekeeper. Digital replica of the physical
/// paper logbook used at the kitchen serving counter: OPEN / ADD / CLOSING /
/// VAR per item, two shifts (A/B) per day, with dispenser/cheps-on-duty and
/// a confirmation name to stand in for the handwritten sign-off.
///
/// OPEN is the previous shift's closing stock, pulled from the system and
/// read-only. ADD defaults to the system's production output for the shift
/// but is editable — kitchen staff often prepare extra items without a
/// separate logged production session. CLOSING is always entered by hand.
class KitchenStocktakeScreen extends ConsumerStatefulWidget {
  const KitchenStocktakeScreen({super.key});

  @override
  ConsumerState<KitchenStocktakeScreen> createState() =>
      _KitchenStocktakeScreenState();
}

class _KitchenStocktakeScreenState extends ConsumerState<KitchenStocktakeScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController =
      TabController(length: 2, vsync: this);
  DateTime _date = DateTime.now();

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  String get _dateStr => DateFormat('yyyy-MM-dd').format(_date);

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (picked != null) setState(() => _date = picked);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Kitchen Stocktake'),
        actions: [
          IconButton(
            tooltip: 'Record Spoilage',
            icon: const Icon(Icons.report_problem_outlined),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => RecordSpoilageScreen(
                  initialArea: 'kitchen',
                  initialShift: _tabController.index == 1 ? 'B' : 'A',
                ),
              ),
            ),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [Tab(text: 'Shift A'), Tab(text: 'Shift B')],
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                const Icon(Icons.event, size: 18, color: AppColors.kTextSecondary),
                const SizedBox(width: 6),
                Text('Stocktake date: $_dateStr',
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                const Spacer(),
                OutlinedButton.icon(
                  onPressed: _pickDate,
                  icon: const Icon(Icons.calendar_month, size: 16),
                  label: const Text('Change date'),
                ),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              key: ValueKey(_dateStr),
              controller: _tabController,
              children: [
                _KitchenShiftStocktake(shift: 'A', date: _dateStr),
                _KitchenShiftStocktake(shift: 'B', date: _dateStr),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _KitchenShiftStocktake extends ConsumerStatefulWidget {
  const _KitchenShiftStocktake({required this.shift, required this.date});
  final String shift;
  final String date;

  @override
  ConsumerState<_KitchenShiftStocktake> createState() =>
      _KitchenShiftStocktakeState();
}

class _KitchenShiftStocktakeState
    extends ConsumerState<_KitchenShiftStocktake> {
  late Future<Map<String, dynamic>> _future = _load();
  final Map<String, TextEditingController> _closingCtrl = {};
  final Map<String, TextEditingController> _addedCtrl = {};
  final Map<String, String> _itemIdByName = {};
  final Map<String, num> _opening = {};
  final List<TextEditingController> _chepsCtrl =
      List.generate(5, (_) => TextEditingController());
  final TextEditingController _dispenserCtrl = TextEditingController();
  final TextEditingController _confirmationCtrl = TextEditingController();
  bool _saving = false;

  Future<Map<String, dynamic>> _load() async {
    final repo = ref.read(branchStorekeeperRepositoryProvider);
    final data = await repo.kitchenStocktake(date: widget.date, shift: widget.shift);

    _dispenserCtrl.text = '${data['dispenser_name'] ?? ''}';
    _confirmationCtrl.text = '${data['confirmation_name'] ?? ''}';
    final cheps = (data['cheps_on_duty'] as List?) ?? const [];
    for (var i = 0; i < _chepsCtrl.length; i++) {
      _chepsCtrl[i].text = i < cheps.length ? '${cheps[i]}' : '';
    }

    final items = (data['items'] as List?) ?? const [];
    for (final raw in items) {
      final item = raw as Map<String, dynamic>;
      final name = '${item['item_name']}';
      final itemId = item['item_id'];
      if (itemId != null) _itemIdByName[name] = '$itemId';
      _opening[name] = _num(item['opening_qty']);
      _ctrlFor(name).text = _fmt(item['closing_qty']);
      _addedCtrlFor(name).text = _fmt(item['added_qty']);
    }
    return data;
  }

  String _fmt(dynamic v) {
    final n = _num(v);
    return n == 0 ? '' : (n == n.roundToDouble() ? n.toInt().toString() : n.toString());
  }

  TextEditingController _ctrlFor(String name) =>
      _closingCtrl.putIfAbsent(name, () => TextEditingController());

  TextEditingController _addedCtrlFor(String name) =>
      _addedCtrl.putIfAbsent(name, () => TextEditingController());

  @override
  void dispose() {
    for (final c in [..._closingCtrl.values, ..._addedCtrl.values, ..._chepsCtrl]) {
      c.dispose();
    }
    _dispenserCtrl.dispose();
    _confirmationCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final items = KitchenStocktakeItems.kFixedItems.map((name) {
      return {
        'item_id': _itemIdByName[name],
        'item_name': name,
        'added_qty': double.tryParse(_addedCtrlFor(name).text.trim()) ?? 0,
        'closing_qty': double.tryParse(_ctrlFor(name).text.trim()) ?? 0,
      };
    }).toList();

    setState(() => _saving = true);
    try {
      await ref.read(branchStorekeeperRepositoryProvider).saveKitchenStocktake(
            date: widget.date,
            shift: widget.shift,
            items: items,
            dispenserName: _dispenserCtrl.text.trim(),
            chepsOnDuty: _chepsCtrl.map((c) => c.text.trim()).where((s) => s.isNotEmpty).toList(),
            confirmationName: _confirmationCtrl.text.trim(),
            submit: true,
          );
      if (mounted) {
        AppNotifier.showSnackBar(context, const SnackBar(content: Text('Kitchen stocktake saved')));
        setState(() => _future = _load());
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text('Save failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.hasError) {
          return Center(child: Text('Failed to load: ${snap.error}'));
        }
        final data = snap.data!;
        final submitted = data['status'] == 'submitted';

        return ListView(
          padding: const EdgeInsets.all(12),
          children: [
            if (submitted)
              Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text('✅ Submitted for this date/shift — editing will update the saved log',
                    style: TextStyle(color: Colors.green, fontWeight: FontWeight.w700)),
              ),
            _headerRow(),
            const Divider(height: 1),
            for (final name in KitchenStocktakeItems.kFixedItems) _itemRow(name),
            const SizedBox(height: 16),
            const Text('Dispenser on duty', style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            TextField(
              controller: _dispenserCtrl,
              decoration: const InputDecoration(
                isDense: true,
                border: OutlineInputBorder(),
                hintText: 'Name',
              ),
            ),
            const SizedBox(height: 16),
            Text('Cheps on duty — Shift (${widget.shift})',
                style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            for (var i = 0; i < _chepsCtrl.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: TextField(
                  controller: _chepsCtrl[i],
                  decoration: InputDecoration(
                    isDense: true,
                    border: const OutlineInputBorder(),
                    prefixText: '${i + 1}. ',
                    hintText: 'Name',
                  ),
                ),
              ),
            const SizedBox(height: 8),
            const Text('Confirmation', style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            TextField(
              controller: _confirmationCtrl,
              decoration: const InputDecoration(
                isDense: true,
                border: OutlineInputBorder(),
                labelText: 'Confirmation name / sign',
                hintText: 'Name confirming this stocktake',
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saving ? null : _submit,
                child: Text(_saving ? 'Saving…' : 'Submit Stocktake'),
              ),
            ),
            const SizedBox(height: 24),
          ],
        );
      },
    );
  }

  Widget _headerRow() {
    const style = TextStyle(fontWeight: FontWeight.w800, fontSize: 12);
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(flex: 3, child: Text('ITEM', style: style)),
          Expanded(flex: 2, child: Text('OPEN', style: style, textAlign: TextAlign.center)),
          Expanded(flex: 2, child: Text('ADD', style: style, textAlign: TextAlign.center)),
          Expanded(flex: 2, child: Text('CLOSING', style: style, textAlign: TextAlign.center)),
          Expanded(flex: 2, child: Text('VAR', style: style, textAlign: TextAlign.center)),
        ],
      ),
    );
  }

  Widget _itemRow(String name) {
    final open = _opening[name] ?? 0;
    final closing = _ctrlFor(name);
    final added = _addedCtrlFor(name);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(flex: 3, child: Text(name, style: const TextStyle(fontSize: 13))),
          Expanded(flex: 2, child: Center(child: Text(_fmt(open)))),
          Expanded(flex: 2, child: _qtyField(added)),
          Expanded(flex: 2, child: _qtyField(closing)),
          Expanded(
            flex: 2,
            child: Builder(builder: (context) {
              final c = double.tryParse(closing.text.trim()) ?? 0;
              final add = double.tryParse(added.text.trim()) ?? 0;
              // variance = physical − system (positive = surplus, negative = shortage)
              // matches bar stocktake convention
              final variance = c - open - add;
              return Center(
                child: Text(
                  variance.toStringAsFixed(variance == variance.roundToDouble() ? 0 : 1),
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: variance < 0
                        ? Colors.red
                        : (variance > 0 ? Colors.orange.shade800 : Colors.green),
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  Widget _qtyField(TextEditingController controller) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 3),
      child: TextField(
        controller: controller,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        textAlign: TextAlign.center,
        decoration: const InputDecoration(isDense: true, contentPadding: EdgeInsets.symmetric(vertical: 8)),
        onChanged: (_) => setState(() {}),
      ),
    );
  }
}

num _num(dynamic v) => v is num ? v : num.tryParse('${v ?? 0}') ?? 0;

/// Fixed kitchen-counter item catalog — mirrors the physical paper logbook.
/// These are prepared dishes (not raw branch_stock ingredients), so the list
/// is hardcoded rather than sourced from inventory tables.
class KitchenStocktakeItems {
  static const List<String> kFixedItems = [
    'Mbuzi Wetfry',
    'Mbuzi Choma',
    'Mbuzi Raw',
    'Chicken K',
    'Chicken B',
    'Sausages',
    'Samosa',
    'Chapati',
    'Fish',
    'Rice',
    'Pilau',
    'Beef',
    'Mandazi',
    'Kebab',
    'Mahamri',
    'Chips',
    'Eggs B',
    'Eggs K',
    'Milk',
  ];
}
