import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../data/repository.dart';

final _fmt = NumberFormat('#,##0.00', 'en_KE');

String _money(dynamic v) =>
    'KES ${_fmt.format(double.tryParse(v?.toString() ?? '0') ?? 0)}';

class PayrollPoliciesScreen extends ConsumerStatefulWidget {
  const PayrollPoliciesScreen({super.key});

  @override
  ConsumerState<PayrollPoliciesScreen> createState() => _PayrollPoliciesScreenState();
}

class _PayrollPoliciesScreenState extends ConsumerState<PayrollPoliciesScreen> {
  bool _busy = false;
  String? _error;
  String _search = '';

  List<Map<String, dynamic>> _staff = [];
  final Map<String, Map<String, dynamic>> _changes = {};
  final Set<String> _savingIds = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _busy = true; _error = null; });
    try {
      final data = await ref.read(branchAccountantRepositoryProvider).getBranchStaff();
      if (!mounted) return;
      setState(() {
        _staff = data;
        _busy = false;
      });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _busy = false; });
    }
  }

  bool _isEnabled(Map<String, dynamic> s, String key) {
    final id = '${s['id']}';
    if (_changes.containsKey(id) && _changes[id]!.containsKey(key)) {
      return _changes[id]![key] as bool;
    }
    final raw = s[key];
    if (raw == null) return false;
    if (raw is bool) return raw;
    return raw.toString().toLowerCase() == 'true';
  }

  double? _amount(Map<String, dynamic> s, String key) {
    final id = '${s['id']}';
    if (_changes.containsKey(id) && _changes[id]!.containsKey(key)) {
      final v = _changes[id]![key];
      if (v == null) return null;
      return double.tryParse(v.toString());
    }
    final raw = s[key];
    if (raw == null) return null;
    return double.tryParse(raw.toString());
  }

  void _toggle(String staffId, String key) {
    setState(() {
      _changes.putIfAbsent(staffId, () => {});
      final current = _isEnabled(
        _staff.firstWhere((s) => '${s['id']}' == staffId),
        key,
      );
      _changes[staffId]![key] = !current;
    });
  }

  void _setAmount(String staffId, String key, String? value) {
    setState(() {
      _changes.putIfAbsent(staffId, () => {});
      if (value == null || value.trim().isEmpty) {
        _changes[staffId]![key] = null;
      } else {
        final parsed = double.tryParse(value.trim());
        if (parsed != null) _changes[staffId]![key] = parsed;
      }
    });
  }

  Future<void> _saveOne(String staffId) async {
    final staff = _staff.firstWhere((s) => '${s['id']}' == staffId);
    setState(() => _savingIds.add(staffId));
    try {
      await ref.read(branchAccountantRepositoryProvider).updateStaffDeductionSettings(
        staffId,
        nssfEnabled: _isEnabled(staff, 'nssf_enabled'),
        shifEnabled: _isEnabled(staff, 'shif_enabled'),
        housingFundEnabled: _isEnabled(staff, 'housing_fund_enabled'),
        nssfAmount: _amount(staff, 'nssf_amount'),
        shifAmount: _amount(staff, 'shif_amount'),
        housingFundAmount: _amount(staff, 'housing_fund_amount'),
      );
      if (mounted) {
        _notify('Saved successfully');
        setState(() {
          final idx = _staff.indexWhere((s) => '${s['id']}' == staffId);
          if (idx >= 0 && _changes.containsKey(staffId)) {
            final ch = _changes[staffId]!;
            for (final k in ch.keys) {
              _staff[idx][k] = ch[k];
            }
          }
          _changes.remove(staffId);
        });
      }
    } catch (e) {
      if (mounted) _notify('Error: $e', isError: true);
    } finally {
      if (mounted) setState(() => _savingIds.remove(staffId));
    }
  }

  Future<void> _saveAll() async {
    if (_changes.isEmpty) return;
    setState(() => _busy = true);
    try {
      final futures = _changes.entries.map((entry) {
        final staff = _staff.firstWhere((s) => '${s['id']}' == entry.key);
        return ref.read(branchAccountantRepositoryProvider).updateStaffDeductionSettings(
          entry.key,
          nssfEnabled: _isEnabled(staff, 'nssf_enabled'),
          shifEnabled: _isEnabled(staff, 'shif_enabled'),
          housingFundEnabled: _isEnabled(staff, 'housing_fund_enabled'),
          nssfAmount: _amount(staff, 'nssf_amount'),
          shifAmount: _amount(staff, 'shif_amount'),
          housingFundAmount: _amount(staff, 'housing_fund_amount'),
        );
      });
      await Future.wait(futures);
      if (mounted) {
        _notify('All settings saved');
        setState(() {
          for (final entry in _changes.entries) {
            final idx = _staff.indexWhere((s) => '${s['id']}' == entry.key);
            if (idx >= 0) {
              for (final k in entry.value.keys) {
                _staff[idx][k] = entry.value[k];
              }
            }
          }
          _changes.clear();
        });
      }
    } catch (e) {
      if (mounted) _notify('Error saving: $e', isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _notify(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? AppColors.kError : AppColors.kSuccess,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  List<Map<String, dynamic>> get _filtered {
    if (_search.trim().isEmpty) return _staff;
    final q = _search.trim().toLowerCase();
    return _staff.where((s) {
      final name = '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.toLowerCase();
      final dept = '${s['department'] ?? ''}'.toLowerCase();
      final pos = '${s['position'] ?? ''}'.toLowerCase();
      final empId = '${s['employee_number'] ?? s['id_number'] ?? s['national_id'] ?? ''}'.toLowerCase();
      return name.contains(q) || dept.contains(q) || pos.contains(q) || empId.contains(q);
    }).toList();
  }

  int _countEnabled(String key) {
    return _staff.where((s) => _isEnabled(s, key)).length;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.kSurface,
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Payroll Policies',
                        style: Theme.of(context).textTheme.displaySmall,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Configure statutory deductions per employee',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: AppColors.kTextSecondary,
                            ),
                      ),
                    ],
                  ),
                ),
                if (_changes.isNotEmpty)
                  ElevatedButton.icon(
                    onPressed: _busy ? null : _saveAll,
                    icon: const Icon(Icons.save),
                    label: const Text('Save All'),
                  ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: _busy ? null : _load,
                  icon: _busy
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.refresh),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Stats
            Row(
              children: [
                _StatCard(label: 'Total Staff', value: '${_staff.length}', color: AppColors.kPrimary),
                const SizedBox(width: 12),
                _StatCard(label: 'NSSF Enabled', value: '${_countEnabled('nssf_enabled')}', color: AppColors.kSuccess),
                const SizedBox(width: 12),
                _StatCard(label: 'SHIF Enabled', value: '${_countEnabled('shif_enabled')}', color: AppColors.kWarning),
                const SizedBox(width: 12),
                _StatCard(label: 'Housing Fund', value: '${_countEnabled('housing_fund_enabled')}', color: const Color(0xFF8B5CF6)),
              ],
            ),
            const SizedBox(height: 16),

            // Search
            TextField(
              decoration: InputDecoration(
                hintText: 'Search by name, department, position...',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: AppColors.kCardBg,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide.none,
                ),
              ),
              onChanged: (v) => setState(() => _search = v),
            ),
            const SizedBox(height: 12),

            // Error
            if (_error != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.kError.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error, color: AppColors.kError, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _error!,
                        style: const TextStyle(color: AppColors.kError, fontSize: 13),
                      ),
                    ),
                    TextButton(
                      onPressed: _load,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),

            if (_error != null) const SizedBox(height: 12),

            // Staff Cards
            Expanded(
              child: _staff.isEmpty && !_busy
                  ? const Center(child: Text('No active staff found'))
                  : ListView.builder(
                      itemCount: _filtered.length,
                      itemBuilder: (context, index) {
                        final s = _filtered[index];
                        final id = '${s['id']}';
                        final hasChange = _changes.containsKey(id);
                        final isSaving = _savingIds.contains(id);

                        return Card(
                          margin: const EdgeInsets.only(bottom: 10),
                          elevation: 2,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: hasChange ? const BorderSide(color: AppColors.kAccent, width: 1.5) : BorderSide.none,
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Staff header
                                Row(
                                  children: [
                                    CircleAvatar(
                                      backgroundColor: AppColors.kPrimary.withOpacity(0.1),
                                      child: Text(
                                        '${s['first_name']?.toString()[0] ?? ''}${s['last_name']?.toString()[0] ?? ''}',
                                        style: const TextStyle(color: AppColors.kPrimary, fontWeight: FontWeight.bold, fontSize: 12),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}',
                                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                                          ),
                                          Text(
                                            '${s['employee_number'] ?? ''} · ${s['department'] ?? '-'} · ${s['position'] ?? '-'}',
                                            style: const TextStyle(fontSize: 11, color: AppColors.kTextSecondary),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Text(
                                      _money(s['basic_salary']),
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, fontFamily: 'monospace'),
                                    ),
                                    const SizedBox(width: 8),
                                    isSaving
                                        ? const SizedBox(
                                            width: 18,
                                            height: 18,
                                            child: CircularProgressIndicator(strokeWidth: 2),
                                          )
                                        : IconButton(
                                            onPressed: hasChange ? () => _saveOne(id) : null,
                                            icon: Icon(
                                              Icons.save,
                                              size: 20,
                                              color: hasChange ? AppColors.kPrimary : AppColors.kDivider,
                                            ),
                                            tooltip: 'Save',
                                          ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                const Divider(height: 1),
                                const SizedBox(height: 12),
                                // Deduction controls
                                Row(
                                  children: [
                                    _DeductionControl(
                                      label: 'NSSF',
                                      enabled: _isEnabled(s, 'nssf_enabled'),
                                      amount: _amount(s, 'nssf_amount'),
                                      defaultHint: 'Auto (6%)',
                                      onToggle: () => _toggle(id, 'nssf_enabled'),
                                      onAmountChanged: (v) => _setAmount(id, 'nssf_amount', v),
                                    ),
                                    const SizedBox(width: 12),
                                    _DeductionControl(
                                      label: 'SHIF',
                                      enabled: _isEnabled(s, 'shif_enabled'),
                                      amount: _amount(s, 'shif_amount'),
                                      defaultHint: 'Auto (2.75%)',
                                      onToggle: () => _toggle(id, 'shif_enabled'),
                                      onAmountChanged: (v) => _setAmount(id, 'shif_amount', v),
                                    ),
                                    const SizedBox(width: 12),
                                    _DeductionControl(
                                      label: 'Housing',
                                      enabled: _isEnabled(s, 'housing_fund_enabled'),
                                      amount: _amount(s, 'housing_fund_amount'),
                                      defaultHint: 'Auto (1.5%)',
                                      onToggle: () => _toggle(id, 'housing_fund_enabled'),
                                      onAmountChanged: (v) => _setAmount(id, 'housing_fund_amount', v),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DeductionControl extends StatefulWidget {
  final String label;
  final bool enabled;
  final double? amount;
  final String defaultHint;
  final VoidCallback onToggle;
  final ValueChanged<String?> onAmountChanged;

  const _DeductionControl({
    required this.label,
    required this.enabled,
    required this.amount,
    required this.defaultHint,
    required this.onToggle,
    required this.onAmountChanged,
  });

  @override
  State<_DeductionControl> createState() => _DeductionControlState();
}

class _DeductionControlState extends State<_DeductionControl> {
  late TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(
      text: widget.amount != null ? widget.amount!.toStringAsFixed(2) : '',
    );
  }

  @override
  void didUpdateWidget(covariant _DeductionControl old) {
    super.didUpdateWidget(old);
    if (widget.amount != old.amount) {
      final newText = widget.amount != null ? widget.amount!.toStringAsFixed(2) : '';
      if (_ctrl.text != newText) {
        _ctrl.text = newText;
      }
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: widget.enabled ? const Color(0xFFF0FDF4) : const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: widget.enabled ? AppColors.kSuccess.withOpacity(0.3) : AppColors.kDivider,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    widget.label,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: widget.enabled ? AppColors.kSuccess : AppColors.kTextSecondary,
                    ),
                  ),
                ),
                Switch(
                  value: widget.enabled,
                  onChanged: (_) => widget.onToggle(),
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
              ],
            ),
            if (widget.enabled)
              TextField(
                controller: _ctrl,
                decoration: InputDecoration(
                  hintText: widget.defaultHint,
                  hintStyle: const TextStyle(fontSize: 11, color: AppColors.kTextSecondary),
                  prefixText: 'KES ',
                  prefixStyle: const TextStyle(fontSize: 11, color: AppColors.kTextSecondary),
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(6),
                    borderSide: const BorderSide(color: AppColors.kDivider),
                  ),
                ),
                style: const TextStyle(fontSize: 12),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                onChanged: widget.onAmountChanged,
              ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatCard({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.kCardBg,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.kDivider),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(fontSize: 11, color: AppColors.kTextSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
