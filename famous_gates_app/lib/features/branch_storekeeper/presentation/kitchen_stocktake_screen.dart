import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:dio/dio.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_notifier.dart';
import '../../../core/network/dio_client.dart';
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
  final Map<String, num> _sold = {};
  final Map<String, num> _spoilage = {};
  final List<TextEditingController> _chepsCtrl =
      List.generate(5, (_) => TextEditingController());
  final TextEditingController _dispenserCtrl = TextEditingController();
  final TextEditingController _confirmationCtrl = TextEditingController();
  bool _saving = false;

  double _largePct = 3.0;
  double _extremePct = 10.0;
  final Map<String, TextEditingController> _explanationCtrl = {};
  final Map<String, TextEditingController> _actionTakenCtrl = {};

  TextEditingController _explanationCtrlFor(String name) =>
      _explanationCtrl.putIfAbsent(name, () => TextEditingController());

  TextEditingController _actionTakenCtrlFor(String name) =>
      _actionTakenCtrl.putIfAbsent(name, () => TextEditingController());

  Future<Map<String, dynamic>> _load() async {
    final repo = ref.read(branchStorekeeperRepositoryProvider);
    final data = await repo.kitchenStocktake(date: widget.date, shift: widget.shift);

    _dispenserCtrl.text = '${data['dispenser_name'] ?? ''}';
    _confirmationCtrl.text = '${data['confirmation_name'] ?? ''}';
    final cheps = (data['cheps_on_duty'] as List?) ?? const [];
    for (var i = 0; i < _chepsCtrl.length; i++) {
      _chepsCtrl[i].text = i < cheps.length ? '${cheps[i]}' : '';
    }

    _largePct = double.tryParse((data['stocktake_variance_large_pct'] ?? '').toString()) ?? 3.0;
    _extremePct = double.tryParse((data['stocktake_variance_extreme_pct'] ?? '').toString()) ?? 10.0;

    final items = (data['items'] as List?) ?? const [];
    for (final raw in items) {
      final item = raw as Map<String, dynamic>;
      final name = '${item['item_name']}';
      final itemId = item['item_id'];
      if (itemId != null) _itemIdByName[name] = '$itemId';
      _opening[name] = _num(item['opening_qty']);
      _sold[name] = _num(item['sold_qty']);
      _spoilage[name] = _num(item['spoilage_qty']);
      _ctrlFor(name).text = _fmt(item['closing_qty']);
      _addedCtrlFor(name).text = _fmt(item['added_qty']);
      _explanationCtrlFor(name).text = item['explanation']?.toString() ?? '';
      _actionTakenCtrlFor(name).text = item['action_taken']?.toString() ?? '';
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
    for (final c in [
      ..._closingCtrl.values,
      ..._addedCtrl.values,
      ..._chepsCtrl,
      ..._explanationCtrl.values,
      ..._actionTakenCtrl.values
    ]) {
      c.dispose();
    }
    _dispenserCtrl.dispose();
    _confirmationCtrl.dispose();
    super.dispose();
  }

  bool _isSupervisorOrManager(String role) {
    const supervisorRoles = {
      'super_admin',
      'director',
      'general_manager',
      'branch_manager',
      'branch_operations_manager',
      'central_operations_manager',
      'facilities_manager',
      'bar_manager',
      'head_chef',
      'purchasing_manager',
      'hr_manager',
      'branch_accountant',
      'auditor',
      'central_storekeeper',
    };
    return supervisorRoles.contains(role);
  }

  void _showLargeVarianceValidationDialog(BuildContext context, List<Map<String, dynamic>> items) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.error_outline, color: Color(0xFFD32F2F)),
            const SizedBox(width: 8),
            const Text('Validation Error'),
          ],
        ),
        content: Text(
          'All items with a large variance must have an explanation reason selected before you can submit.\n\n'
          'Please enter explanations for:\n' +
          items.map((i) => '• ${i['name']}').join('\n'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  void _showRecountConfirmationDialog(
    BuildContext context,
    List<Map<String, dynamic>> largeVariances,
    List<Map<String, dynamic>> itemsPayload,
  ) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.warning_amber_rounded, color: Color(0xFFF9A825)),
            const SizedBox(width: 8),
            const Text('Recount Confirmation Required'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'The following items have large variances:',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            ...largeVariances.map((item) => Text('• ${item['name']}')),
            const SizedBox(height: 16),
            const Text(
              'Please confirm that you have recounted these items and verified that the physical counts are correct.',
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFF9A825),
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              Navigator.pop(dialogContext);
              _executeSubmit(itemsPayload);
            },
            child: const Text('Confirm & Submit'),
          ),
        ],
      ),
    );
  }

  void _showSupervisorOverrideDialog(
    BuildContext context,
    List<Map<String, dynamic>> extremeVariances,
    List<Map<String, dynamic>> itemsPayload,
  ) {
    final emailController = TextEditingController();
    final passwordController = TextEditingController();
    bool isLoading = false;
    String? errorMsg;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setState) {
          return AlertDialog(
            title: Row(
              children: [
                const Icon(Icons.security, color: Color(0xFFD32F2F)),
                const SizedBox(width: 8),
                const Text('Supervisor Override Required'),
              ],
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'The following items have extreme variances:',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  ...extremeVariances.map((item) {
                    final expected = item['expected'];
                    final actual = item['closing'];
                    final variance = item['variance'];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Text('• ${item['name']}: Expected $expected, Actual $actual (Var: $variance)'),
                    );
                  }),
                  const SizedBox(height: 16),
                  const Text('Please have a Supervisor or Manager authorize this submission by entering their credentials below.'),
                  const SizedBox(height: 16),
                  TextField(
                    controller: emailController,
                    decoration: const InputDecoration(
                      labelText: 'Supervisor Email',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: passwordController,
                    decoration: const InputDecoration(
                      labelText: 'Supervisor Password',
                      border: OutlineInputBorder(),
                    ),
                    obscureText: true,
                  ),
                  if (errorMsg != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      errorMsg!,
                      style: const TextStyle(color: Colors.red, fontSize: 13),
                    ),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: isLoading ? null : () => Navigator.pop(dialogContext),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFD32F2F),
                  foregroundColor: Colors.white,
                ),
                onPressed: isLoading
                    ? null
                    : () async {
                        setState(() {
                          isLoading = true;
                          errorMsg = null;
                        });

                        try {
                          final email = emailController.text.trim();
                          final password = passwordController.text;

                          if (email.isEmpty || password.isEmpty) {
                            throw Exception('Please enter email and password.');
                          }

                          final dio = ref.read(dioProvider);
                          final response = await dio.post('/auth/login', data: {
                            'email': email,
                            'password': password,
                          });
                          final body = response.data;
                          final payload = body is Map && body['data'] is Map ? body['data'] : body;
                          final user = payload is Map ? payload['user'] : null;

                          if (user is Map) {
                            final role = user['role']?.toString() ?? '';
                            final name = user['name']?.toString() ?? 'Supervisor';

                            if (_isSupervisorOrManager(role)) {
                              for (final item in itemsPayload) {
                                final isExtreme = extremeVariances.any((ev) => ev['name'] == item['item_name']);
                                if (isExtreme) {
                                  final currentReason = item['explanation']?.toString() ?? '';
                                  final signature = '[OVERRIDE: Approved by $name ($role)]';
                                  item['explanation'] = currentReason.contains(signature)
                                      ? currentReason
                                      : '$signature ${currentReason.trim()}'.trim();
                                }
                              }

                              Navigator.pop(dialogContext);

                              WidgetsBinding.instance.addPostFrameCallback((_) {
                                final largeVariances = itemsPayload.where((item) {
                                  final name = item['item_name'];
                                  final opening = _opening[name] ?? 0;
                                  final added = item['added_qty'] as double;
                                  final sold = _sold[name] ?? 0;
                                  final spoilage = _spoilage[name] ?? 0;
                                  final expected = opening + added - sold - spoilage;
                                  final closing = item['closing_qty'] as double;
                                  final variance = closing - expected;
                                  final absVariance = variance.abs();

                                  double variancePercentage = 0;
                                  if (expected > 0) {
                                    variancePercentage = (absVariance / expected) * 100;
                                  } else if (absVariance > 0) {
                                    variancePercentage = 100.0;
                                  }

                                  String severity = 'NORMAL';
                                  if (expected >= 1.0) {
                                    if (variancePercentage >= _extremePct) {
                                      severity = 'EXTREME';
                                    } else if (variancePercentage >= _largePct) {
                                      severity = 'LARGE';
                                    }
                                  } else {
                                    if (absVariance >= 1.0) {
                                      severity = 'EXTREME';
                                    } else if (absVariance >= 0.1) {
                                      severity = 'LARGE';
                                    }
                                  }
                                  return severity == 'LARGE';
                                }).toList();

                                if (largeVariances.isNotEmpty) {
                                  _showRecountConfirmationDialog(context, largeVariances, itemsPayload);
                                } else {
                                  _executeSubmit(itemsPayload);
                                }
                              });
                              return;
                            }
                          }
                          throw Exception('User is not authorized as a supervisor/manager.');
                        } catch (e) {
                          String errMsg = 'Authorization failed';
                          if (e is DioException) {
                            final data = e.response?.data;
                            if (data is Map && data['message'] != null) {
                              errMsg = data['message'].toString();
                            } else {
                              errMsg = e.message ?? errMsg;
                            }
                          } else if (e is Exception) {
                            errMsg = e.toString().replaceFirst('Exception: ', '');
                          }
                          setState(() {
                            isLoading = false;
                            errorMsg = errMsg;
                          });
                        }
                      },
                child: isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Authorize & Submit'),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _executeSubmit(List<Map<String, dynamic>> items) async {
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

  Future<void> _submit() async {
    final List<Map<String, dynamic>> itemsPayload = [];
    final List<Map<String, dynamic>> largeVariances = [];
    final List<Map<String, dynamic>> extremeVariances = [];

    for (final name in KitchenStocktakeItems.kFixedItems) {
      final opening = _opening[name] ?? 0;
      final added = double.tryParse(_addedCtrlFor(name).text.trim()) ?? 0;
      final sold = _sold[name] ?? 0;
      final spoilage = _spoilage[name] ?? 0;
      final expected = opening + added - sold - spoilage;
      final closing = double.tryParse(_ctrlFor(name).text.trim()) ?? 0;
      final variance = closing - expected;
      final absVariance = variance.abs();

      double variancePercentage = 0;
      if (expected > 0) {
        variancePercentage = (absVariance / expected) * 100;
      } else if (absVariance > 0) {
        variancePercentage = 100.0;
      }

      String severity = 'NORMAL';
      if (expected >= 1.0) {
        if (variancePercentage >= _extremePct) {
          severity = 'EXTREME';
        } else if (variancePercentage >= _largePct) {
          severity = 'LARGE';
        }
      } else {
        if (absVariance >= 1.0) {
          severity = 'EXTREME';
        } else if (absVariance >= 0.1) {
          severity = 'LARGE';
        }
      }

      final explanation = _explanationCtrlFor(name).text.trim();
      final actionTaken = _actionTakenCtrlFor(name).text.trim();

      itemsPayload.add({
        'item_id': _itemIdByName[name],
        'item_name': name,
        'added_qty': added,
        'closing_qty': closing,
        'explanation': explanation,
        'action_taken': actionTaken,
      });

      if (severity == 'EXTREME') {
        extremeVariances.add({
          'name': name,
          'expected': expected,
          'closing': closing,
          'variance': variance,
        });
      } else if (severity == 'LARGE') {
        largeVariances.add({
          'name': name,
          'expected': expected,
          'closing': closing,
          'variance': variance,
          'explanation': explanation,
          'action_taken': actionTaken,
        });
      }
    }

    final largeWithoutReason = largeVariances.where((v) => (v['explanation'] as String).isEmpty).toList();
    if (largeWithoutReason.isNotEmpty) {
      _showLargeVarianceValidationDialog(context, largeWithoutReason);
      return;
    }

    if (extremeVariances.isNotEmpty) {
      _showSupervisorOverrideDialog(context, extremeVariances, itemsPayload);
      return;
    }

    if (largeVariances.isNotEmpty) {
      _showRecountConfirmationDialog(context, largeVariances, itemsPayload);
      return;
    }

    _executeSubmit(itemsPayload);
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
          Expanded(flex: 2, child: Text('CLOSING', style: style, textAlign: TextAlign.center)),
        ],
      ),
    );
  }

  Widget _itemRow(String name) {
    final closing = _ctrlFor(name);
    final opening = _opening[name] ?? 0;
    final added = double.tryParse(_addedCtrlFor(name).text.trim()) ?? 0;
    final sold = _sold[name] ?? 0;
    final spoilage = _spoilage[name] ?? 0;
    final expected = opening + added - sold - spoilage;
    final closingVal = double.tryParse(closing.text.trim()) ?? 0;
    final variance = closingVal - expected;
    final hasVariance = variance != 0;

    final absVariance = variance.abs();
    double variancePercentage = 0;
    if (expected > 0) {
      variancePercentage = (absVariance / expected) * 100;
    } else if (absVariance > 0) {
      variancePercentage = 100.0;
    }

    String severity = 'NORMAL';
    if (expected >= 1.0) {
      if (variancePercentage >= _extremePct) {
        severity = 'EXTREME';
      } else if (variancePercentage >= _largePct) {
        severity = 'LARGE';
      }
    } else {
      if (absVariance >= 1.0) {
        severity = 'EXTREME';
      } else if (absVariance >= 0.1) {
        severity = 'LARGE';
      }
    }

    Color? rowBgColor;
    if (severity == 'EXTREME') {
      rowBgColor = Colors.red.shade50;
    } else if (severity == 'LARGE') {
      rowBgColor = Colors.orange.shade50;
    }

    return Container(
      color: rowBgColor,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3, horizontal: 6),
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: const TextStyle(fontSize: 13)),
                      if (hasVariance)
                        Text(
                          'Expected: $expected | Var: ${variance > 0 ? "+$variance" : variance}',
                          style: TextStyle(
                            fontSize: 11,
                            color: severity == 'EXTREME'
                                ? Colors.red.shade900
                                : severity == 'LARGE'
                                    ? Colors.orange.shade900
                                    : Colors.grey,
                            fontWeight: severity != 'NORMAL' ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                    ],
                  ),
                ),
                Expanded(flex: 2, child: _qtyField(closing)),
              ],
            ),
          ),
          if (hasVariance)
            Padding(
              padding: const EdgeInsets.only(left: 12, right: 12, bottom: 8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _explanationCtrlFor(name),
                      decoration: const InputDecoration(
                        labelText: 'Reason for variance',
                        isDense: true,
                        contentPadding: EdgeInsets.symmetric(vertical: 6, horizontal: 8),
                        border: OutlineInputBorder(),
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                ],
              ),
            ),
          const Divider(height: 1),
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
