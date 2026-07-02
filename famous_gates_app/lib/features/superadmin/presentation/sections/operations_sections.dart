// New superadmin sections for pages not yet represented in Flutter:
//  • DepartmentsSection   — system/departments
//  • RatePlansSection     — rates
//  • CheckInSection       — checkin (today's arrivals)
//  • FleetOverviewSection — fleet (links to vehicles + drivers)
//  • ChannelManagerSection — channels

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/services.dart';
import '../../domain/superadmin_providers.dart';
import '../../../admin/domain/admin_providers.dart';

// ─── Shared helpers ──────────────────────────────────────────────────────────

Widget _sectionHeader(String title, IconData icon, {String? subtitle}) {
  return Container(
    padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
    decoration: const BoxDecoration(
      color: Colors.white,
      border: Border(bottom: BorderSide(color: AppColors.kDivider)),
    ),
    child: Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.kPrimary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: AppColors.kPrimary, size: 20),
        ),
        const SizedBox(width: 14),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            if (subtitle != null)
              Text(subtitle,
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
          ],
        ),
      ],
    ),
  );
}

Widget _loadingCenter() => const Center(child: CircularProgressIndicator());

Widget _emptyState(String message, IconData icon) => Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 48, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          Text(message, style: TextStyle(color: Colors.grey.shade500)),
        ],
      ),
    );

// ─── Departments ─────────────────────────────────────────────────────────────

class DepartmentsSection extends ConsumerStatefulWidget {
  const DepartmentsSection({super.key});

  @override
  ConsumerState<DepartmentsSection> createState() => _DepartmentsSectionState();
}

class _DepartmentsSectionState extends ConsumerState<DepartmentsSection> {
  List<Map<String, dynamic>> _departments = [];
  bool _isLoading = true;
  final _nameController = TextEditingController();
  final _descController = TextEditingController();
  Map<String, dynamic>? _editing;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final svc = ref.read(systemServiceProvider);
      final res = await svc.getDepartments();
      final raw = res['data'];
      if (mounted) {
        setState(() {
          _departments = (raw is List ? raw : [])
              .map((e) => Map<String, dynamic>.from(e as Map))
              .toList();
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load departments: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _openDialog({Map<String, dynamic>? dept}) {
    _editing = dept;
    _nameController.text = dept?['name'] ?? '';
    _descController.text = dept?['description'] ?? '';
    showDialog(context: context, builder: (ctx) => _DeptDialog(this, ctx));
  }

  Future<void> _save(BuildContext dialogContext) async {
    if (_nameController.text.trim().isEmpty) return;
    setState(() => _submitting = true);
    try {
      final svc = ref.read(systemServiceProvider);
      final payload = {
        'name': _nameController.text.trim(),
        'description': _descController.text.trim(),
      };
      if (_editing != null) {
        final eid = _editing!['id'];
        await svc.updateDepartment(
          eid is int ? eid : int.tryParse(eid.toString()) ?? 0,
          payload,
        );
      } else {
        await svc.createDepartment(payload);
      }
      if (dialogContext.mounted) Navigator.pop(dialogContext);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _delete(Map<String, dynamic> dept) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Department'),
        content: Text('Delete "${dept['name']}"?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      final deptId = dept['id'];
      await ref.read(systemServiceProvider).deleteDepartment(
          deptId is int ? deptId : int.tryParse(deptId.toString()) ?? 0);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to delete department: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _sectionHeader('Departments', PhosphorIcons.buildings(),
            subtitle: 'Manage company departments'),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${_departments.length} departments',
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
              ElevatedButton.icon(
                onPressed: () => _openDialog(),
                icon: Icon(PhosphorIcons.plus(), size: 16),
                label: const Text('Add Department'),
                style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.kPrimary,
                    foregroundColor: Colors.white),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: _isLoading
              ? _loadingCenter()
              : _departments.isEmpty
                  ? _emptyState('No departments', PhosphorIcons.buildings())
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                      itemCount: _departments.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, i) {
                        final d = _departments[i];
                        final isActive =
                            (d['status'] ?? 'active').toString() == 'active';
                        return Card(
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(
                                color:
                                    AppColors.kDivider.withValues(alpha: 0.5)),
                          ),
                          child: ListTile(
                            leading: Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color:
                                    AppColors.kPrimary.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(PhosphorIcons.buildings(),
                                  color: AppColors.kPrimary, size: 18),
                            ),
                            title: Text(d['name'] ?? '',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600)),
                            subtitle: d['description'] != null &&
                                    d['description'].toString().isNotEmpty
                                ? Text(d['description'].toString(),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis)
                                : null,
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color:
                                        (isActive ? Colors.green : Colors.grey)
                                            .withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    isActive ? 'Active' : 'Inactive',
                                    style: TextStyle(
                                        fontSize: 11,
                                        color: isActive
                                            ? Colors.green.shade700
                                            : Colors.grey.shade600,
                                        fontWeight: FontWeight.bold),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                IconButton(
                                  icon: Icon(PhosphorIcons.pencilSimple(),
                                      size: 18,
                                      color: AppColors.kTextSecondary),
                                  onPressed: () => _openDialog(dept: d),
                                ),
                                IconButton(
                                  icon: Icon(PhosphorIcons.trash(),
                                      size: 18, color: Colors.red.shade400),
                                  onPressed: () => _delete(d),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
        ),
      ],
    );
  }
}

class _DeptDialog extends StatelessWidget {
  final _DepartmentsSectionState state;
  // dialogContext is passed by the showDialog builder but the build(context)
  // parameter is the same dialog context and is used directly below.
  // ignore: avoid_unused_constructor_parameters
  const _DeptDialog(this.state, BuildContext dialogContext);

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title:
          Text(state._editing != null ? 'Edit Department' : 'Add Department'),
      content: SizedBox(
        width: 400,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: state._nameController,
              decoration: const InputDecoration(
                  labelText: 'Department Name *', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: state._descController,
              decoration: const InputDecoration(
                  labelText: 'Description', border: OutlineInputBorder()),
              maxLines: 2,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: state._submitting ? null : () => Navigator.pop(context),
            child: const Text('Cancel')),
        ElevatedButton(
          onPressed: state._submitting ? null : () => state._save(context),
          style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.kPrimary,
              foregroundColor: Colors.white),
          child: state._submitting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white))
              : Text(state._editing != null ? 'Update' : 'Add'),
        ),
      ],
    );
  }
}

// ─── Rate Plans ──────────────────────────────────────────────────────────────

class RatePlansSection extends ConsumerStatefulWidget {
  const RatePlansSection({super.key});

  @override
  ConsumerState<RatePlansSection> createState() => _RatePlansSectionState();
}

class _RatePlansSectionState extends ConsumerState<RatePlansSection> {
  List<Map<String, dynamic>> _plans = [];
  bool _isLoading = true;
  Map<String, dynamic>? _editing;
  bool _submitting = false;

  final _nameCtrl = TextEditingController();
  final _codeCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _minNightsCtrl = TextEditingController(text: '1');
  final _multiplierCtrl = TextEditingController(text: '1.0');
  final _fixedCtrl = TextEditingController(text: '0');
  String _rateType = 'standard';
  bool _isPercentage = true;
  bool _refundable = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in [
      _nameCtrl,
      _codeCtrl,
      _descCtrl,
      _minNightsCtrl,
      _multiplierCtrl,
      _fixedCtrl,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final svc = ref.read(roomServiceProvider);
      final res = await svc.getRatePlans();
      final raw = res['data'];
      if (mounted) {
        setState(() {
          _plans = (raw is List ? raw : [])
              .map((e) => Map<String, dynamic>.from(e as Map))
              .toList();
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load rate plans: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _openDialog({Map<String, dynamic>? plan}) {
    _editing = plan;
    _nameCtrl.text = (plan?['name'] ?? '').toString();
    _codeCtrl.text = (plan?['code'] ?? '').toString();
    _descCtrl.text = (plan?['description'] ?? '').toString();
    _minNightsCtrl.text = (plan?['minNights'] ?? 1).toString();
    _multiplierCtrl.text = (plan?['multiplier'] ?? 1.0).toString();
    _fixedCtrl.text = (plan?['fixedAmount'] ?? 0).toString();
    _rateType = (plan?['rateType'] ?? 'standard').toString();
    _isPercentage = plan?['isPercentage'] == true;
    _refundable = plan?['refundable'] != false;
    showDialog(context: context, builder: (ctx) => _RatePlanDialog(this, ctx));
  }

  Future<void> _save(BuildContext dialogContext) async {
    if (_nameCtrl.text.trim().isEmpty) return;
    setState(() => _submitting = true);
    try {
      final svc = ref.read(roomServiceProvider);
      final payload = {
        'name': _nameCtrl.text.trim(),
        'code': _codeCtrl.text.trim().toUpperCase(),
        'description': _descCtrl.text.trim(),
        'rateType': _rateType,
        'isPercentage': _isPercentage,
        'multiplier': double.tryParse(_multiplierCtrl.text) ?? 1.0,
        'fixedAmount': double.tryParse(_fixedCtrl.text) ?? 0,
        'minNights': int.tryParse(_minNightsCtrl.text) ?? 1,
        'refundable': _refundable,
        'active': true,
      };
      if (_editing != null) {
        await svc.updateRatePlan(_editing!['id'].toString(), payload);
      } else {
        await svc.createRatePlan(payload);
      }
      if (dialogContext.mounted) Navigator.pop(dialogContext);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _sectionHeader('Rate Plans', PhosphorIcons.trendUp(),
            subtitle: 'Room rates, pricing rules and restrictions'),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${_plans.length} rate plans',
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
              ElevatedButton.icon(
                onPressed: () => _openDialog(),
                icon: Icon(PhosphorIcons.plus(), size: 16),
                label: const Text('New Rate Plan'),
                style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.kPrimary,
                    foregroundColor: Colors.white),
              ),
            ],
          ),
        ),
        Expanded(
          child: _isLoading
              ? _loadingCenter()
              : _plans.isEmpty
                  ? _emptyState('No rate plans yet', PhosphorIcons.trendUp())
                  : GridView.builder(
                      padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                      gridDelegate:
                          const SliverGridDelegateWithMaxCrossAxisExtent(
                        maxCrossAxisExtent: 360,
                        mainAxisSpacing: 12,
                        crossAxisSpacing: 12,
                        childAspectRatio: 1.08,
                      ),
                      itemCount: _plans.length,
                      itemBuilder: (_, i) => _RatePlanCard(
                        plan: _plans[i],
                        onEdit: () => _openDialog(plan: _plans[i]),
                        onDelete: () async {
                          final confirm = await showDialog<bool>(
                            context: context,
                            builder: (ctx) => AlertDialog(
                              title: const Text('Delete Rate Plan'),
                              content: Text('Delete "${_plans[i]['name']}"?'),
                              actions: [
                                TextButton(
                                    onPressed: () =>
                                        Navigator.pop(ctx, false),
                                    child: const Text('Cancel')),
                                TextButton(
                                    onPressed: () =>
                                        Navigator.pop(ctx, true),
                                    child: const Text('Delete',
                                        style: TextStyle(color: Colors.red))),
                              ],
                            ),
                          );
                          if (confirm == true) {
                            try {
                              await ref
                                  .read(roomServiceProvider)
                                  .deleteRatePlan(_plans[i]['id'].toString());
                              _load();
                            } catch (e) {
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                        content: Text('Delete failed: $e')));
                              }
                            }
                          }
                        },
                      ),
                    ),
        ),
      ],
    );
  }
}

class _RatePlanCard extends StatelessWidget {
  final Map<String, dynamic> plan;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _RatePlanCard(
      {required this.plan, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final isActive = plan['active'] != false;
    final source = (plan['source'] ?? '').toString();
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(plan['name'] ?? '',
                          style: const TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 15)),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(plan['code'] ?? '',
                            style: TextStyle(
                                fontSize: 10,
                                fontFamily: 'monospace',
                                color: Colors.grey.shade700)),
                      ),
                    ],
                  ),
                ),
                if (source == 'room_types') ...[
                  const SizedBox(width: 8),
                  Tooltip(
                    message:
                        'This is the room type base rate shown as a rate plan fallback.',
                    child: Icon(PhosphorIcons.bed(),
                        size: 18, color: Colors.grey.shade500),
                  ),
                ],
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: (isActive ? Colors.green : Colors.grey)
                        .withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    isActive ? 'Active' : 'Inactive',
                    style: TextStyle(
                        fontSize: 11,
                        color: isActive
                            ? Colors.green.shade700
                            : Colors.grey.shade600,
                        fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            if ((plan['description'] ?? '').toString().isNotEmpty)
              Text(plan['description'].toString(),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            const Spacer(),
            Divider(color: Colors.grey.shade100),
            _InfoRow('Type', plan['rateType'] ?? '—'),
            _InfoRow(
                'Pricing',
                plan['isPercentage'] == true
                    ? '${plan['multiplier'] ?? 1}x Base'
                    : 'Fixed KES ${plan['fixedAmount'] ?? 0}'),
            _InfoRow('Min Stay', '${plan['minNights'] ?? 1} Nights'),
            _InfoRow('Refundable', plan['refundable'] == true ? 'Yes' : 'No',
                valueColor: plan['refundable'] == true
                    ? Colors.green.shade700
                    : Colors.red.shade600),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                IconButton(
                  icon: Icon(PhosphorIcons.pencilSimple(),
                      size: 18, color: AppColors.kTextSecondary),
                  onPressed: onEdit,
                ),
                IconButton(
                  icon: Icon(PhosphorIcons.trash(),
                      size: 18, color: Colors.red.shade400),
                  onPressed: source == 'room_types' ? null : onDelete,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;
  const _InfoRow(this.label, this.value, {this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
          Text(value,
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: valueColor ?? const Color(0xFF1c1917))),
        ],
      ),
    );
  }
}

class _RatePlanDialog extends StatefulWidget {
  final _RatePlansSectionState state;
  // dialogContext is passed by the showDialog builder but the build(context)
  // parameter of _RatePlanDialogState is the same dialog context and is used
  // directly inside the widget tree below.
  // ignore: avoid_unused_constructor_parameters
  const _RatePlanDialog(this.state, BuildContext dialogContext);

  @override
  State<_RatePlanDialog> createState() => _RatePlanDialogState();
}

class _RatePlanDialogState extends State<_RatePlanDialog> {
  @override
  Widget build(BuildContext context) {
    final s = widget.state;
    return StatefulBuilder(
      builder: (ctx, setS) {
        return AlertDialog(
          title: Text(s._editing != null ? 'Edit Rate Plan' : 'New Rate Plan'),
          content: SizedBox(
            width: 480,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(children: [
                    Expanded(
                      flex: 3,
                      child: TextField(
                        controller: s._nameCtrl,
                        decoration: const InputDecoration(
                            labelText: 'Plan Name *',
                            border: OutlineInputBorder()),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 2,
                      child: TextField(
                        controller: s._codeCtrl,
                        decoration: const InputDecoration(
                            labelText: 'Code', border: OutlineInputBorder()),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  TextField(
                    controller: s._descCtrl,
                    decoration: const InputDecoration(
                        labelText: 'Description', border: OutlineInputBorder()),
                    maxLines: 2,
                  ),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: s._rateType,
                        decoration: const InputDecoration(
                            labelText: 'Rate Type',
                            border: OutlineInputBorder()),
                        items: [
                          'standard',
                          'promotional',
                          'corporate',
                          'group',
                          'seasonal'
                        ]
                            .map((r) =>
                                DropdownMenuItem(value: r, child: Text(r)))
                            .toList(),
                        onChanged: (v) => setS(() => s._rateType = v!),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: s._minNightsCtrl,
                        decoration: const InputDecoration(
                            labelText: 'Min Nights',
                            border: OutlineInputBorder()),
                        keyboardType: TextInputType.number,
                      ),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                      child: SwitchListTile(
                        title: const Text('Percentage-based',
                            style: TextStyle(fontSize: 13)),
                        value: s._isPercentage,
                        onChanged: (v) => setS(() => s._isPercentage = v),
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                    Expanded(
                      child: SwitchListTile(
                        title: const Text('Refundable',
                            style: TextStyle(fontSize: 13)),
                        value: s._refundable,
                        onChanged: (v) => setS(() => s._refundable = v),
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  if (s._isPercentage)
                    TextField(
                      controller: s._multiplierCtrl,
                      decoration: const InputDecoration(
                          labelText: 'Multiplier (e.g. 1.2 = 20% premium)',
                          border: OutlineInputBorder()),
                      keyboardType: TextInputType.number,
                    )
                  else
                    TextField(
                      controller: s._fixedCtrl,
                      decoration: const InputDecoration(
                          labelText: 'Fixed Amount (KES)',
                          border: OutlineInputBorder()),
                      keyboardType: TextInputType.number,
                    ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
                onPressed: s._submitting ? null : () => Navigator.pop(context),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: s._submitting ? null : () => s._save(context),
              style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.kPrimary,
                  foregroundColor: Colors.white),
              child: s._submitting
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : Text(s._editing != null ? 'Update' : 'Create'),
            ),
          ],
        );
      },
    );
  }
}

// ─── Check-In (Today's Arrivals) ─────────────────────────────────────────────

class CheckInSection extends ConsumerStatefulWidget {
  const CheckInSection({super.key});

  @override
  ConsumerState<CheckInSection> createState() => _CheckInSectionState();
}

class _CheckInSectionState extends ConsumerState<CheckInSection> {
  List<Map<String, dynamic>> _arrivals = [];
  bool _isLoading = true;
  final Set<String> _processing = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final svc = ref.read(bookingServiceProvider);
      final today = DateTime.now().toIso8601String().split('T').first;
      final res = await svc.getBookings(
          checkInFrom: today, checkInTo: today, status: 'confirmed');
      final raw = res['data'];
      if (mounted) {
        setState(() {
          _arrivals = (raw is List ? raw : [])
              .map((e) => Map<String, dynamic>.from(e as Map))
              .toList();
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load arrivals: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _checkIn(String id) async {
    setState(() => _processing.add(id));
    try {
      final svc = ref.read(bookingServiceProvider);
      await svc.checkIn(id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Guest checked in successfully')));
      }
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _processing.remove(id));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _sectionHeader('Guest Check-In', PhosphorIcons.check(),
            subtitle: "Today's expected arrivals"),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
          child: Row(children: [
            _StatBadge(
              label: 'Pending Arrivals',
              value: _arrivals.length.toString(),
              color: Colors.green,
              icon: PhosphorIcons.user(),
            ),
            const SizedBox(width: 12),
            const Spacer(),
            IconButton(
              onPressed: _load,
              icon: Icon(PhosphorIcons.arrowsClockwise(), size: 20),
              tooltip: 'Refresh',
            ),
          ]),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: _isLoading
              ? _loadingCenter()
              : _arrivals.isEmpty
                  ? _emptyState('No arrivals today', PhosphorIcons.user())
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                      itemCount: _arrivals.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, i) {
                        final a = _arrivals[i];
                        final id = a['id']?.toString() ?? '';
                        final isProcessing = _processing.contains(id);
                        return Card(
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(color: Colors.grey.shade200),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              children: [
                                Container(
                                  width: 48,
                                  height: 48,
                                  decoration: BoxDecoration(
                                    color: Colors.green.shade50,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Icon(PhosphorIcons.user(),
                                      color: Colors.green.shade600, size: 24),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        a['guest_name']?.toString() ??
                                            a['guestName']?.toString() ??
                                            'Guest',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 15),
                                      ),
                                      const SizedBox(height: 2),
                                      Row(children: [
                                        Icon(PhosphorIcons.bed(),
                                            size: 12,
                                            color: Colors.grey.shade500),
                                        const SizedBox(width: 4),
                                        Text(
                                            'Room ${a['room_number'] ?? a['roomNumber'] ?? '—'}',
                                            style: TextStyle(
                                                fontSize: 12,
                                                color: Colors.grey.shade600)),
                                        const SizedBox(width: 12),
                                        Icon(PhosphorIcons.clock(),
                                            size: 12,
                                            color: Colors.grey.shade500),
                                        const SizedBox(width: 4),
                                        Text(
                                          () {
                                            final ci = a['check_in'] ??
                                                a['checkIn'] ??
                                                '';
                                            if (ci.isEmpty) return '—';
                                            try {
                                              return TimeOfDay.fromDateTime(
                                                      DateTime.parse(ci))
                                                  .format(context);
                                            } catch (_) {
                                              return ci.toString();
                                            }
                                          }(),
                                          style: TextStyle(
                                              fontSize: 12,
                                              color: Colors.grey.shade600),
                                        ),
                                      ]),
                                    ],
                                  ),
                                ),
                                ElevatedButton.icon(
                                  onPressed:
                                      isProcessing ? null : () => _checkIn(id),
                                  icon: isProcessing
                                      ? const SizedBox(
                                          width: 14,
                                          height: 14,
                                          child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Colors.white))
                                      : Icon(PhosphorIcons.checkCircle(),
                                          size: 16),
                                  label: const Text('Check In'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.green,
                                    foregroundColor: Colors.white,
                                    shape: RoundedRectangleBorder(
                                        borderRadius:
                                            BorderRadius.circular(10)),
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
    );
  }
}

class _StatBadge extends StatelessWidget {
  final String label, value;
  final Color color;
  final IconData icon;
  const _StatBadge(
      {required this.label,
      required this.value,
      required this.color,
      required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(children: [
        Icon(icon, size: 20, color: color),
        const SizedBox(width: 8),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value,
              style: TextStyle(
                  fontWeight: FontWeight.bold, fontSize: 20, color: color)),
          Text(label,
              style:
                  TextStyle(fontSize: 11, color: color.withValues(alpha: 0.8))),
        ]),
      ]),
    );
  }
}

// ─── Fleet Overview ───────────────────────────────────────────────────────────

class FleetOverviewSection extends ConsumerStatefulWidget {
  const FleetOverviewSection({super.key});

  @override
  ConsumerState<FleetOverviewSection> createState() =>
      _FleetOverviewSectionState();
}

class _FleetOverviewSectionState extends ConsumerState<FleetOverviewSection> {
  int _vehicles = 0, _drivers = 0, _available = 0, _inUse = 0;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      int vCount = 0, dCount = 0, avail = 0, inUse = 0;
      try {
        final vehicles = await ref.read(adminVehiclesProvider.future);
        vCount = vehicles.length;
        avail = vehicles.where((v) => v.status == 'available').length;
        inUse = vehicles.where((v) => v.status == 'in_use').length;
      } catch (_) {}
      try {
        final drivers = await ref.read(centralStoreDriversProvider.future);
        dCount = drivers.length;
      } catch (_) {}
      setState(() {
        _vehicles = vCount;
        _drivers = dCount;
        _available = avail;
        _inUse = inUse;
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _sectionHeader('Fleet Management', PhosphorIcons.truck(),
            subtitle: 'Vehicles & drivers overview'),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_isLoading)
                  const Center(child: CircularProgressIndicator())
                else ...[
                  // Stat cards
                  Row(children: [
                    _FleetStatCard('Vehicles', _vehicles.toString(),
                        PhosphorIcons.truck(), Colors.blue),
                    const SizedBox(width: 12),
                    _FleetStatCard('Drivers', _drivers.toString(),
                        PhosphorIcons.user(), Colors.purple),
                    const SizedBox(width: 12),
                    _FleetStatCard('Available', _available.toString(),
                        PhosphorIcons.checkCircle(), Colors.green),
                    const SizedBox(width: 12),
                    _FleetStatCard('In Use', _inUse.toString(),
                        PhosphorIcons.truck(), Colors.orange),
                  ]),
                  const SizedBox(height: 24),
                  const Text('Quick Access',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                      child: _FleetQuickCard(
                        icon: PhosphorIcons.truck(),
                        title: 'Vehicles',
                        desc: 'Manage fleet vehicles',
                        color: Colors.blue,
                        onTap: () => ref
                            .read(superAdminSectionProvider.notifier)
                            .state = SuperAdminSection.vehicles,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _FleetQuickCard(
                        icon: PhosphorIcons.user(),
                        title: 'Drivers',
                        desc: 'Manage licensed drivers',
                        color: Colors.purple,
                        onTap: () => ref
                            .read(superAdminSectionProvider.notifier)
                            .state = SuperAdminSection.drivers,
                      ),
                    ),
                  ]),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _FleetStatCard extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color;
  const _FleetStatCard(this.label, this.value, this.icon, this.color);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.kDivider.withValues(alpha: 0.5)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, size: 24, color: color),
          const SizedBox(height: 8),
          Text(label,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
          Text(value,
              style: TextStyle(
                  fontSize: 22, fontWeight: FontWeight.bold, color: color)),
        ]),
      ),
    );
  }
}

class _FleetQuickCard extends StatelessWidget {
  final IconData icon;
  final String title, desc;
  final Color color;
  final VoidCallback onTap;

  const _FleetQuickCard({
    required this.icon,
    required this.title,
    required this.desc,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.kDivider.withValues(alpha: 0.5)),
        ),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, size: 28, color: color),
            ),
            const SizedBox(width: 16),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 16)),
                Text(desc,
                    style:
                        TextStyle(fontSize: 12, color: Colors.grey.shade500)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Channel Manager ──────────────────────────────────────────────────────────

class ChannelManagerSection extends ConsumerStatefulWidget {
  const ChannelManagerSection({super.key});

  @override
  ConsumerState<ChannelManagerSection> createState() =>
      _ChannelManagerSectionState();
}

class _ChannelManagerSectionState extends ConsumerState<ChannelManagerSection> {
  List<Map<String, dynamic>> _channels = [];
  bool _isLoading = true;
  // ignore: prefer_final_fields — intentionally mutable for future sync implementation
  bool _syncingAll = false;
  final Set<String> _syncingChannel = {};

  final _channelLogos = const {
    'booking_com': '🅱️',
    'expedia': '🌐',
    'airbnb': '🏠',
    'agoda': '🔵',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      // Channel manager uses a dedicated OTA endpoint not yet in BookingService.
      // Display the static placeholder channel cards until that endpoint exists.
      setState(() => _channels = []);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _sectionHeader('Channel Manager', PhosphorIcons.globe(),
            subtitle: 'OTA integrations — Booking.com, Expedia, Airbnb, Agoda'),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${_channels.length} channels configured',
                style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
              ),
              Row(children: [
                IconButton(
                    icon: Icon(PhosphorIcons.arrowsClockwise(), size: 20),
                    onPressed: _load,
                    tooltip: 'Refresh'),
                const SizedBox(width: 4),
                ElevatedButton.icon(
                  onPressed: _syncingAll
                      ? null
                      : () => ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Coming soon')),
                          ),
                  icon: Icon(PhosphorIcons.arrowsClockwise(), size: 16),
                  label: const Text('Sync All'),
                  style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.kPrimary,
                      foregroundColor: Colors.white),
                ),
              ]),
            ],
          ),
        ),
        Expanded(
          child: _isLoading
              ? _loadingCenter()
              : _channels.isEmpty
                  ? _buildEmptyChannels()
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                      itemCount: _channels.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, i) =>
                          _ChannelCard(_channels[i], _syncingChannel),
                    ),
        ),
      ],
    );
  }

  Widget _buildEmptyChannels() {
    // Show static channel cards as placeholders
    final staticChannels = [
      {
        'channelId': 'booking_com',
        'channelName': 'Booking.com',
        'enabled': false,
        'status': 'disconnected'
      },
      {
        'channelId': 'expedia',
        'channelName': 'Expedia',
        'enabled': false,
        'status': 'disconnected'
      },
      {
        'channelId': 'airbnb',
        'channelName': 'Airbnb',
        'enabled': false,
        'status': 'disconnected'
      },
      {
        'channelId': 'agoda',
        'channelName': 'Agoda',
        'enabled': false,
        'status': 'disconnected'
      },
    ];
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
      itemCount: staticChannels.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) => _ChannelCard(
        Map<String, dynamic>.from(staticChannels[i]),
        _syncingChannel,
        logo: _channelLogos[staticChannels[i]['channelId']] ?? '📡',
      ),
    );
  }
}

class _ChannelCard extends StatelessWidget {
  final Map<String, dynamic> channel;
  final Set<String> syncing;
  final String? logo;
  const _ChannelCard(this.channel, this.syncing, {this.logo});

  @override
  Widget build(BuildContext context) {
    final channelId = channel['channelId']?.toString() ?? '';
    final isEnabled = channel['enabled'] == true;
    final lastSync = channel['lastSync']?.toString();
    final isSyncing = syncing.contains(channelId);
    final logoStr = logo ?? '📡';

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color:
                        isEnabled ? Colors.blue.shade50 : Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: Text(logoStr, style: const TextStyle(fontSize: 26)),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(channel['channelName']?.toString() ?? channelId,
                          style: const TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 15)),
                      Row(children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isEnabled ? Colors.green : Colors.grey,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          isEnabled ? 'Connected' : 'Disconnected',
                          style: TextStyle(
                              fontSize: 12,
                              color: isEnabled
                                  ? Colors.green.shade700
                                  : Colors.grey.shade500),
                        ),
                        if (lastSync != null) ...[
                          Text(' • ',
                              style: TextStyle(color: Colors.grey.shade400)),
                          Text('Last sync: $lastSync',
                              style: TextStyle(
                                  fontSize: 11, color: Colors.grey.shade500)),
                        ],
                      ]),
                    ],
                  ),
                ),
                Switch(
                  value: isEnabled,
                  onChanged: (_) {},
                  activeThumbColor: AppColors.kPrimary,
                ),
              ],
            ),
            if (isEnabled) ...[
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: isSyncing
                        ? null
                        : () => ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Coming soon')),
                            ),
                    icon: Icon(PhosphorIcons.arrowsClockwise(), size: 14),
                    label: const Text('Push Availability'),
                    style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.kPrimary,
                        side: BorderSide(color: Colors.grey.shade300),
                        padding: const EdgeInsets.symmetric(vertical: 10)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: isSyncing
                        ? null
                        : () => ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Coming soon')),
                            ),
                    icon: Icon(PhosphorIcons.downloadSimple(), size: 14),
                    label: const Text('Pull Bookings'),
                    style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.kPrimary,
                        side: BorderSide(color: Colors.grey.shade300),
                        padding: const EdgeInsets.symmetric(vertical: 10)),
                  ),
                ),
              ]),
            ],
          ],
        ),
      ),
    );
  }
}
