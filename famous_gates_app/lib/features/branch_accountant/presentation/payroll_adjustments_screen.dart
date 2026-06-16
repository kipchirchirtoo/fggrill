import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../data/repository.dart';

final _fmt = NumberFormat('#,##0.00', 'en_KE');

String _money(dynamic v) =>
    'KES ${_fmt.format(double.tryParse(v?.toString() ?? '0') ?? 0)}';

const _months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const _typeOptions = ['deduction', 'addition'];

const _categoryByType = <String, List<String>>{
  'deduction': [
    'credit_bills', 'absenteeism', 'loan', 'advance', 'shif', 'nssf',
    'uniform', 'other',
  ],
  'addition': [
    'bonus', 'overtime', 'allowance', 'extra_day', 'other',
  ],
};

class PayrollAdjustmentsScreen extends ConsumerStatefulWidget {
  const PayrollAdjustmentsScreen({super.key});

  @override
  ConsumerState<PayrollAdjustmentsScreen> createState() => _PayrollAdjustmentsScreenState();
}

class _PayrollAdjustmentsScreenState extends ConsumerState<PayrollAdjustmentsScreen> {
  int _month = DateTime.now().month;
  int _year = DateTime.now().year;

  bool _busy = false;
  String? _error;
  String _filterType = 'all';

  List<Map<String, dynamic>> _adjustments = [];
  List<Map<String, dynamic>> _staff = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _busy = true; _error = null; });
    try {
      final repo = ref.read(branchAccountantRepositoryProvider);
      final adjustments = await repo.getPayrollAdjustments(
        month: _month,
        year: _year,
      );
      final staff = await repo.getBranchStaff();
      if (!mounted) return;
      setState(() {
        _adjustments = adjustments;
        _staff = staff;
        _busy = false;
      });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _busy = false; });
    }
  }

  List<Map<String, dynamic>> get _filtered {
    if (_filterType == 'all') return _adjustments;
    return _adjustments.where((a) => '${a['type']}' == _filterType).toList();
  }

  String _staffName(String? staffId) {
    if (staffId == null) return 'Unknown';
    final s = _staff.firstWhere(
      (s) => '${s['id']}' == staffId,
      orElse: () => {},
    );
    if (s.isEmpty) return staffId;
    return '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();
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

  Future<void> _voidAdjustment(Map<String, dynamic> adj) async {
    final id = '${adj['id']}';
    setState(() => _busy = true);
    try {
      await ref.read(branchAccountantRepositoryProvider).voidPayrollAdjustment(id);
      if (mounted) {
        _notify('Adjustment voided');
        _load();
      }
    } catch (e) {
      if (mounted) {
        _notify('Error: $e', isError: true);
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _showCreateDialog() async {
    if (_staff.isEmpty) {
      _notify('No staff available. Please wait for staff to load.', isError: true);
      return;
    }

    String? selectedStaffId = _staff.first['id']?.toString();
    String type = 'deduction';
    String category = _categoryByType[type]!.first;
    final amountCtrl = TextEditingController();
    final descCtrl = TextEditingController();

    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('New Payroll Adjustment'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    DropdownButtonFormField<String>(
                      value: selectedStaffId,
                      decoration: const InputDecoration(labelText: 'Staff'),
                      items: _staff.map((s) {
                        final id = '${s['id']}';
                        final name = '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();
                        final emp = '${s['employee_number'] ?? s['id_number'] ?? ''}';
                        return DropdownMenuItem(
                          value: id,
                          child: Text('$name${emp.isNotEmpty ? ' ($emp)' : ''}', overflow: TextOverflow.ellipsis),
                        );
                      }).toList(),
                      onChanged: (v) => setDialogState(() => selectedStaffId = v),
                    ),
                    const SizedBox(height: 12),
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'deduction', label: Text('Deduction')),
                        ButtonSegment(value: 'addition', label: Text('Addition')),
                      ],
                      selected: {type},
                      onSelectionChanged: (set) {
                        setDialogState(() {
                          type = set.first;
                          category = _categoryByType[type]!.first;
                        });
                      },
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: category,
                      decoration: const InputDecoration(labelText: 'Category'),
                      items: _categoryByType[type]!.map((c) {
                        return DropdownMenuItem(
                          value: c,
                          child: Text(c[0].toUpperCase() + c.substring(1).replaceAll('_', ' ')),
                        );
                      }).toList(),
                      onChanged: (v) => setDialogState(() => category = v!),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: amountCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Amount (KES)',
                        prefixText: 'KES ',
                      ),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: descCtrl,
                      decoration: const InputDecoration(labelText: 'Description'),
                      maxLines: 2,
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: () {
                    final amount = double.tryParse(amountCtrl.text);
                    if (selectedStaffId == null || amount == null || amount <= 0) {
                      return;
                    }
                    Navigator.pop(context, {
                      'staff_id': selectedStaffId,
                      'type': type,
                      'category': category,
                      'amount': amount,
                      'description': descCtrl.text.trim(),
                    });
                  },
                  child: const Text('Create'),
                ),
              ],
            );
          },
        );
      },
    );

    if (result == null) return;

    setState(() => _busy = true);
    try {
      await ref.read(branchAccountantRepositoryProvider).createPayrollAdjustment(
        staffId: result['staff_id'],
        type: result['type'],
        category: result['category'],
        amount: result['amount'],
        description: result['description'],
        month: _month,
        year: _year,
      );
      if (mounted) {
        _notify('Adjustment created');
        _load();
      }
    } catch (e) {
      if (mounted) {
        _notify('Error: $e', isError: true);
        setState(() => _busy = false);
      }
    }
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
                        'Payroll Adjustments',
                        style: Theme.of(context).textTheme.displaySmall,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Manage additions & deductions for $_months[_month - 1] $_year',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: AppColors.kTextSecondary,
                            ),
                      ),
                    ],
                  ),
                ),
                ElevatedButton.icon(
                  onPressed: _busy ? null : _showCreateDialog,
                  icon: const Icon(Icons.add),
                  label: const Text('New Adjustment'),
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

            // Month / Year selector + filter
            Row(
              children: [
                SizedBox(
                  width: 160,
                  child: DropdownButtonFormField<int>(
                    value: _month,
                    decoration: const InputDecoration(labelText: 'Month'),
                    items: List.generate(12, (i) => DropdownMenuItem(
                      value: i + 1,
                      child: Text(_months[i]),
                    )),
                    onChanged: (v) {
                      if (v != null) {
                        setState(() => _month = v);
                        _load();
                      }
                    },
                  ),
                ),
                const SizedBox(width: 12),
                SizedBox(
                  width: 120,
                  child: DropdownButtonFormField<int>(
                    value: _year,
                    decoration: const InputDecoration(labelText: 'Year'),
                    items: List.generate(5, (i) {
                      final y = DateTime.now().year - 2 + i;
                      return DropdownMenuItem(value: y, child: Text('$y'));
                    }),
                    onChanged: (v) {
                      if (v != null) {
                        setState(() => _year = v);
                        _load();
                      }
                    },
                  ),
                ),
                const SizedBox(width: 12),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'all', label: Text('All')),
                    ButtonSegment(value: 'deduction', label: Text('Deductions')),
                    ButtonSegment(value: 'addition', label: Text('Additions')),
                  ],
                  selected: {_filterType},
                  onSelectionChanged: (set) {
                    setState(() => _filterType = set.first);
                  },
                ),
              ],
            ),
            const SizedBox(height: 16),

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

            // Stats
            Row(
              children: [
                _StatCard(
                  label: 'Total',
                  value: '${_adjustments.length}',
                  color: AppColors.kPrimary,
                ),
                const SizedBox(width: 12),
                _StatCard(
                  label: 'Deductions',
                  value: '${_adjustments.where((a) => a['type'] == 'deduction').length}',
                  color: AppColors.kError,
                ),
                const SizedBox(width: 12),
                _StatCard(
                  label: 'Additions',
                  value: '${_adjustments.where((a) => a['type'] == 'addition').length}',
                  color: AppColors.kSuccess,
                ),
                const SizedBox(width: 12),
                _StatCard(
                  label: 'Pending',
                  value: '${_adjustments.where((a) => '${a['status']}' != 'voided' && '${a['status']}' != 'approved').length}',
                  color: AppColors.kWarning,
                ),
              ],
            ),
            const SizedBox(height: 16),

            // List
            Expanded(
              child: _filtered.isEmpty && !_busy
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.inbox, size: 48, color: AppColors.kTextSecondary),
                          const SizedBox(height: 12),
                          Text(
                            'No adjustments for this period',
                            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                                  color: AppColors.kTextSecondary,
                                ),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      itemCount: _filtered.length,
                      itemBuilder: (context, index) {
                        final adj = _filtered[index];
                        final isDeduction = adj['type'] == 'deduction';
                        final isVoided = '${adj['status']}' == 'voided';

                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          elevation: 1,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                            side: isVoided
                                ? const BorderSide(color: AppColors.kDivider)
                                : BorderSide.none,
                          ),
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            leading: CircleAvatar(
                              backgroundColor: isVoided
                                  ? AppColors.kDivider
                                  : (isDeduction ? AppColors.kError.withOpacity(0.1) : AppColors.kSuccess.withOpacity(0.1)),
                              child: Icon(
                                isDeduction ? Icons.remove : Icons.add,
                                color: isVoided
                                    ? AppColors.kTextSecondary
                                    : (isDeduction ? AppColors.kError : AppColors.kSuccess),
                                size: 18,
                              ),
                            ),
                            title: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    _staffName('${adj['staff_id']}'),
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      decoration: isVoided ? TextDecoration.lineThrough : null,
                                      color: isVoided ? AppColors.kTextSecondary : AppColors.kTextPrimary,
                                    ),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: isDeduction
                                        ? AppColors.kError.withOpacity(0.1)
                                        : AppColors.kSuccess.withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    isDeduction ? 'Deduction' : 'Addition',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w500,
                                      color: isDeduction ? AppColors.kError : AppColors.kSuccess,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const SizedBox(height: 4),
                                Text(
                                  '${adj['category']?.toString()[0].toUpperCase()}${adj['category']?.toString().substring(1).replaceAll('_', ' ') ?? ''}',
                                  style: const TextStyle(fontSize: 12, color: AppColors.kTextSecondary),
                                ),
                                if ((adj['description']?.toString() ?? '').isNotEmpty)
                                  Text(
                                    '${adj['description']}',
                                    style: const TextStyle(fontSize: 11, color: AppColors.kTextSecondary),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    _StatusChip(status: '${adj['status'] ?? 'pending'}'),
                                    const SizedBox(width: 8),
                                    Text(
                                      _money(adj['amount']),
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                        color: isVoided
                                            ? AppColors.kTextSecondary
                                            : (isDeduction ? AppColors.kError : AppColors.kSuccess),
                                        decoration: isVoided ? TextDecoration.lineThrough : null,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            trailing: isVoided
                                ? null
                                : PopupMenuButton<String>(
                                    onSelected: (value) {
                                      if (value == 'void') {
                                        showDialog(
                                          context: context,
                                          builder: (ctx) => AlertDialog(
                                            title: const Text('Void Adjustment'),
                                            content: const Text('Are you sure you want to void this adjustment?'),
                                            actions: [
                                              TextButton(
                                                onPressed: () => Navigator.pop(ctx),
                                                child: const Text('Cancel'),
                                              ),
                                              ElevatedButton(
                                                onPressed: () {
                                                  Navigator.pop(ctx);
                                                  _voidAdjustment(adj);
                                                },
                                                style: ElevatedButton.styleFrom(
                                                  backgroundColor: AppColors.kError,
                                                ),
                                                child: const Text('Void'),
                                              ),
                                            ],
                                          ),
                                        );
                                      }
                                    },
                                    itemBuilder: (context) => [
                                      const PopupMenuItem(
                                        value: 'void',
                                        child: Row(
                                          children: [
                                            Icon(Icons.cancel, color: AppColors.kError, size: 18),
                                            SizedBox(width: 8),
                                            Text('Void'),
                                          ],
                                        ),
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

class _StatusChip extends StatelessWidget {
  final String status;

  const _StatusChip({required this.status});

  Color get _color {
    switch (status.toLowerCase()) {
      case 'approved':
        return AppColors.kSuccess;
      case 'voided':
        return AppColors.kTextSecondary;
      case 'rejected':
        return AppColors.kError;
      default:
        return AppColors.kWarning;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: _color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        status[0].toUpperCase() + status.substring(1),
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: _color),
      ),
    );
  }
}
