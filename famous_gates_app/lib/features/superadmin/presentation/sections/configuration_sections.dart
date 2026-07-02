import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../../core/services/system_service.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../admin/data/admin_repository.dart';

String _text(dynamic value, [String fallback = '-']) {
  if (value == null) return fallback;
  final text = '$value'.trim();
  return text.isEmpty || text == 'null' ? fallback : text;
}

num _number(dynamic value) {
  if (value is num) return value;
  return num.tryParse('$value') ?? 0;
}

String _money(dynamic value) {
  final amount = _number(value);
  if (amount.abs() >= 1000000) {
    return 'KES ${(amount / 1000000).toStringAsFixed(1)}M';
  }
  if (amount.abs() >= 1000) return 'KES ${(amount / 1000).toStringAsFixed(1)}K';
  return 'KES ${amount.toStringAsFixed(0)}';
}

class SuperAdminSearchSection extends ConsumerStatefulWidget {
  const SuperAdminSearchSection({super.key});

  @override
  ConsumerState<SuperAdminSearchSection> createState() =>
      _SuperAdminSearchSectionState();
}

class _SuperAdminSearchSectionState
    extends ConsumerState<SuperAdminSearchSection> {
  final _query = TextEditingController();
  List<Map<String, dynamic>> _results = [];
  bool _loading = false;
  String? _error;

  Future<void> _search() async {
    final query = _query.text.trim();
    if (query.length < 2) {
      setState(() => _error = 'Enter at least 2 characters.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ref.read(adminRepositoryProvider).globalSearch(query);
      if (!mounted) return;
      setState(() => _results = data);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = _friendlyError(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _PageScaffold(
      title: 'Global Search',
      subtitle:
          'Search staff, users, branches, bookings, orders, POS outlets, stock items, payments and audit records.',
      children: [
        _ToolbarCard(
          children: [
            Expanded(
              child: TextField(
                controller: _query,
                onSubmitted: (_) => _search(),
                decoration: InputDecoration(
                  hintText:
                      'Search by name, short code, order number, branch, staff ID...',
                  prefixIcon: Icon(PhosphorIcons.magnifyingGlass()),
                ),
              ),
            ),
            FilledButton.icon(
              onPressed: _loading ? null : _search,
              icon: _loading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(PhosphorIcons.magnifyingGlass()),
              label: const Text('Search'),
            ),
          ],
        ),
        if (_error != null) _ErrorBanner(_error!),
        _RecordTable(
          title: 'Search Results',
          count: _results.length,
          columns: const ['Type', 'Record', 'Details'],
          rows: _results
              .map((record) => [
                    _text(record['type']),
                    _text(record['display_name']),
                    _text(record['subtitle']),
                  ])
              .toList(),
          emptyText: 'No records found.',
        ),
      ],
    );
  }
}

class RolesPermissionsSection extends ConsumerStatefulWidget {
  const RolesPermissionsSection({super.key});

  @override
  ConsumerState<RolesPermissionsSection> createState() =>
      _RolesPermissionsSectionState();
}

class _RolesPermissionsSectionState
    extends ConsumerState<RolesPermissionsSection> {
  List<Map<String, dynamic>> _roles = [];
  List<Map<String, dynamic>> _permissions = [];
  String? _selectedRoleId;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final roles = await ref.read(adminRepositoryProvider).getSystemRoles();
      final selected = roles.isNotEmpty ? _text(roles.first['id'], '') : null;
      List<Map<String, dynamic>> permissions = [];
      if (selected != null && selected.isNotEmpty) {
        permissions = await ref
            .read(adminRepositoryProvider)
            .getRolePermissions(selected);
      }
      if (!mounted) return;
      setState(() {
        _roles = roles;
        _selectedRoleId = selected;
        _permissions = permissions;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = _friendlyError(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _selectRole(String? roleId) async {
    if (roleId == null) return;
    setState(() {
      _selectedRoleId = roleId;
      _permissions = [];
      _loading = true;
    });
    try {
      final permissions =
          await ref.read(adminRepositoryProvider).getRolePermissions(roleId);
      if (!mounted) return;
      setState(() => _permissions = permissions);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = _friendlyError(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectedRole = _roles.firstWhere(
      (role) => _text(role['id'], '') == _selectedRoleId,
      orElse: () => const {},
    );

    return _PageScaffold(
      title: 'Roles & Permissions',
      subtitle:
          'Review dashboard access, POS permissions and branch-scoped role capabilities.',
      actions: [
        OutlinedButton.icon(
          onPressed: _load,
          icon: Icon(PhosphorIcons.arrowsClockwise()),
          label: const Text('Refresh'),
        ),
      ],
      children: [
        if (_error != null) _ErrorBanner(_error!),
        _ToolbarCard(
          children: [
            SizedBox(
              width: 320,
              child: DropdownButtonFormField<String>(
                initialValue: _selectedRoleId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Role'),
                items: _roles
                    .map(
                      (role) => DropdownMenuItem(
                        value: _text(role['id'], ''),
                        child: Text(
                          _text(role['role_name'] ??
                              role['name'] ??
                              role['role']),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(),
                onChanged: _selectRole,
              ),
            ),
            _SummaryChip(
              icon: PhosphorIcons.key(),
              label: '${_roles.length} roles',
            ),
            _SummaryChip(
              icon: PhosphorIcons.shieldCheck(),
              label: '${_permissions.length} permissions',
            ),
          ],
        ),
        if (_loading) const LinearProgressIndicator(minHeight: 2),
        _RecordTable(
          title:
              'Permissions - ${_text(selectedRole['role_name'] ?? selectedRole['name'], 'Select role')}',
          count: _permissions.length,
          columns: const ['Permission', 'Module', 'Action'],
          rows: _permissions
              .map((permission) => [
                    _text(permission['permission_name'] ?? permission['name']),
                    _text(permission['module']),
                    _text(permission['action']),
                  ])
              .toList(),
          emptyText: 'No permissions found for this role.',
        ),
      ],
    );
  }
}

class PaymentBillingSettingsSection extends ConsumerStatefulWidget {
  const PaymentBillingSettingsSection({super.key});

  @override
  ConsumerState<PaymentBillingSettingsSection> createState() =>
      _PaymentBillingSettingsSectionState();
}

class _PaymentBillingSettingsSectionState
    extends ConsumerState<PaymentBillingSettingsSection> {
  Map<String, dynamic> _stats = {};
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final stats = await ref.read(adminRepositoryProvider).getPaymentStats();
      if (!mounted) return;
      setState(() => _stats = stats);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = _friendlyError(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _PageScaffold(
      title: 'Payment & Billing Settings',
      subtitle:
          'Monitor payment verification and standardize clearing rules for cash, M-Pesa, card, credit bill and split payments.',
      actions: [
        OutlinedButton.icon(
          onPressed: _load,
          icon: Icon(PhosphorIcons.arrowsClockwise()),
          label: const Text('Refresh'),
        ),
      ],
      children: [
        if (_loading) const LinearProgressIndicator(minHeight: 2),
        if (_error != null) _ErrorBanner(_error!),
        _MetricGrid(cards: [
          _MetricData(
            title: 'Total Verified',
            value: _money(_stats['total_verified'] ?? _stats['verifiedTotal']),
            icon: PhosphorIcons.checkCircle(),
            color: Colors.green,
          ),
          _MetricData(
            title: 'Pending Review',
            value: '${_number(_stats['pending'] ?? _stats['pending_count'])}',
            icon: PhosphorIcons.clock(),
            color: Colors.orange,
          ),
          _MetricData(
            title: 'Rejected',
            value: '${_number(_stats['rejected'] ?? _stats['rejected_count'])}',
            icon: PhosphorIcons.warning(),
            color: Colors.red,
          ),
        ]),
        const _InfoGrid(cards: [
          _ConfigCardData(
            title: 'Short Code Clearing',
            description:
                'Cashiers clear pending bills by shortcode, order number, invoice number or booking reference.',
            icon: Icons.tag,
          ),
          _ConfigCardData(
            title: 'Credit Bill Routing',
            description:
                'Credit bill payments require staff allocation and feed payroll deductions unless settled.',
            icon: Icons.badge_outlined,
          ),
          _ConfigCardData(
            title: 'Receipt Branding',
            description:
                'Receipts and exports use Famous Gates branded report styling and audit references.',
            icon: Icons.receipt_long_outlined,
          ),
        ]),
      ],
    );
  }
}

class ReportTemplatesSection extends ConsumerStatefulWidget {
  const ReportTemplatesSection({super.key});

  @override
  ConsumerState<ReportTemplatesSection> createState() =>
      _ReportTemplatesSectionState();
}

class _ReportTemplatesSectionState
    extends ConsumerState<ReportTemplatesSection> {
  List<Map<String, dynamic>> _templates = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final templates =
          await ref.read(adminRepositoryProvider).getReportTemplates();
      if (!mounted) return;
      setState(() => _templates = templates);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = _friendlyError(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openForm([Map<String, dynamic>? template]) async {
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _ReportTemplateDialog(template: template),
    );
    if (result == null) return;
    try {
      if (template == null) {
        await ref.read(adminRepositoryProvider).createReportTemplate(result);
      } else {
        await ref
            .read(adminRepositoryProvider)
            .updateReportTemplate(_text(template['id'], ''), result);
      }
      if (!mounted) return;
      _toast(context, 'Report template saved.');
      await _load();
    } catch (error) {
      if (mounted) _toast(context, _friendlyError(error), isError: true);
    }
  }

  Future<void> _delete(Map<String, dynamic> template) async {
    try {
      await ref
          .read(adminRepositoryProvider)
          .deleteReportTemplate(_text(template['id'], ''));
      if (!mounted) return;
      _toast(context, 'Report template deleted.');
      await _load();
    } catch (error) {
      if (mounted) _toast(context, _friendlyError(error), isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _PageScaffold(
      title: 'Report Templates',
      subtitle:
          'Control branded templates used by stock, payroll, cashier, audit and finance PDF exports.',
      actions: [
        OutlinedButton.icon(
          onPressed: _load,
          icon: Icon(PhosphorIcons.arrowsClockwise()),
          label: const Text('Refresh'),
        ),
        FilledButton.icon(
          onPressed: () => _openForm(),
          icon: Icon(PhosphorIcons.plus()),
          label: const Text('New Template'),
        ),
      ],
      children: [
        if (_loading) const LinearProgressIndicator(minHeight: 2),
        if (_error != null) _ErrorBanner(_error!),
        _RecordTable(
          title: 'Templates',
          count: _templates.length,
          columns: const ['Name', 'Type', 'Category', 'Status', 'Actions'],
          rows: _templates
              .map((template) => [
                    _text(template['name']),
                    _text(template['type']),
                    _text(template['category']),
                    _text(template['status']),
                    'actions:${_text(template['id'])}',
                  ])
              .toList(),
          actionBuilder: (rowIndex) {
            final template = _templates[rowIndex];
            return Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextButton(
                  onPressed: () => _openForm(template),
                  child: const Text('Edit'),
                ),
                TextButton(
                  onPressed: () => _delete(template),
                  child: const Text('Delete'),
                ),
              ],
            );
          },
          emptyText: 'No report templates configured.',
        ),
      ],
    );
  }
}

class CashierStationConfigSection extends ConsumerStatefulWidget {
  const CashierStationConfigSection({super.key});

  @override
  ConsumerState<CashierStationConfigSection> createState() =>
      _CashierStationConfigSectionState();
}

class _CashierStationConfigSectionState
    extends ConsumerState<CashierStationConfigSection> {
  List<Map<String, dynamic>> _outlets = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final outlets = await ref.read(adminRepositoryProvider).getPosOutlets();
      if (!mounted) return;
      setState(() => _outlets = outlets);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = _friendlyError(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final active =
        _outlets.where((outlet) => _text(outlet['status']) == 'active').length;
    final cashierEnabled =
        _outlets.where((outlet) => outlet['requires_shift'] == true).length;

    return _PageScaffold(
      title: 'Cashier Station Config',
      subtitle:
          'Review POS outlet shift controls, cashier stock sheets and credit bill routing.',
      actions: [
        OutlinedButton.icon(
          onPressed: _load,
          icon: Icon(PhosphorIcons.arrowsClockwise()),
          label: const Text('Refresh'),
        ),
      ],
      children: [
        if (_loading) const LinearProgressIndicator(minHeight: 2),
        if (_error != null) _ErrorBanner(_error!),
        _MetricGrid(cards: [
          _MetricData(
            title: 'POS Outlets',
            value: '${_outlets.length}',
            icon: Icons.point_of_sale,
            color: AppColors.kPrimary,
          ),
          _MetricData(
            title: 'Active',
            value: '$active',
            icon: PhosphorIcons.checkCircle(),
            color: Colors.green,
          ),
          _MetricData(
            title: 'Shift Controlled',
            value: '$cashierEnabled',
            icon: PhosphorIcons.clock(),
            color: Colors.orange,
          ),
        ]),
        _RecordTable(
          title: 'Outlet Rules',
          count: _outlets.length,
          columns: const ['Outlet', 'Type', 'Branch', 'Shift', 'Status'],
          rows: _outlets
              .map((outlet) => [
                    _text(outlet['name'] ?? outlet['code']),
                    _text(outlet['outlet_type']),
                    _text(outlet['branch_name'] ?? outlet['branch']?['name']),
                    outlet['requires_shift'] == true ? 'Required' : 'Optional',
                    _text(outlet['status']),
                  ])
              .toList(),
          emptyText: 'No POS outlets configured.',
        ),
      ],
    );
  }
}

class StorekeepingConfigSection extends ConsumerStatefulWidget {
  const StorekeepingConfigSection({super.key});

  @override
  ConsumerState<StorekeepingConfigSection> createState() =>
      _StorekeepingConfigSectionState();
}

class _StorekeepingConfigSectionState
    extends ConsumerState<StorekeepingConfigSection> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await ref
          .read(adminRepositoryProvider)
          .getStoreItems(limit: 250, page: 1);
      if (!mounted) return;
      setState(() => _items = items);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = _friendlyError(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final totals = <String, Map<String, num>>{};
    for (final item in _items) {
      final storeType =
          _text(item['store_type'] ?? item['category'], 'general');
      final current = totals.putIfAbsent(
        storeType,
        () => {'items': 0, 'value': 0},
      );
      current['items'] = (current['items'] ?? 0) + 1;
      final quantity = _number(item['current_stock'] ?? item['quantity']);
      final cost = _number(item['cost_price'] ?? item['unit_cost']);
      current['value'] = (current['value'] ?? 0) + (quantity * cost);
    }

    return _PageScaffold(
      title: 'Storekeeping Config',
      subtitle:
          'Review foodstuff, bar store, non-consumable and department issue stock setup.',
      actions: [
        OutlinedButton.icon(
          onPressed: _load,
          icon: Icon(PhosphorIcons.arrowsClockwise()),
          label: const Text('Refresh'),
        ),
      ],
      children: [
        if (_loading) const LinearProgressIndicator(minHeight: 2),
        if (_error != null) _ErrorBanner(_error!),
        _MetricGrid(cards: [
          _MetricData(
            title: 'Store Items',
            value: '${_items.length}',
            icon: PhosphorIcons.package(),
            color: AppColors.kPrimary,
          ),
          _MetricData(
            title: 'Store Types',
            value: '${totals.keys.length}',
            icon: PhosphorIcons.warehouse(),
            color: Colors.green,
          ),
          _MetricData(
            title: 'Stock Value',
            value: _money(totals.values.fold<num>(
              0,
              (sum, group) => sum + (group['value'] ?? 0),
            )),
            icon: PhosphorIcons.coins(),
            color: Colors.orange,
          ),
        ]),
        _RecordTable(
          title: 'Store Type Summary',
          count: totals.length,
          columns: const ['Store Type', 'Items', 'Stock Value'],
          rows: totals.entries
              .map((entry) => [
                    entry.key,
                    '${entry.value['items'] ?? 0}',
                    _money(entry.value['value'] ?? 0),
                  ])
              .toList(),
          emptyText: 'No store items configured.',
        ),
      ],
    );
  }
}

class PayrollSettingsSection extends ConsumerStatefulWidget {
  const PayrollSettingsSection({super.key});

  @override
  ConsumerState<PayrollSettingsSection> createState() =>
      _PayrollSettingsSectionState();
}

class _PayrollSettingsSectionState
    extends ConsumerState<PayrollSettingsSection> {
  List<Map<String, dynamic>> _policies = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final policies =
          await ref.read(adminRepositoryProvider).getPayrollPolicies();
      if (!mounted) return;
      setState(() => _policies = policies);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = _friendlyError(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openForm([Map<String, dynamic>? policy]) async {
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _PayrollPolicyDialog(policy: policy),
    );
    if (result == null) return;
    try {
      if (policy == null) {
        await ref.read(adminRepositoryProvider).createPayrollPolicy(result);
      } else {
        await ref
            .read(adminRepositoryProvider)
            .updatePayrollPolicy(_text(policy['id'], ''), result);
      }
      if (!mounted) return;
      _toast(context, 'Payroll policy saved.');
      await _load();
    } catch (error) {
      if (mounted) _toast(context, _friendlyError(error), isError: true);
    }
  }

  Future<void> _delete(Map<String, dynamic> policy) async {
    try {
      await ref
          .read(adminRepositoryProvider)
          .deletePayrollPolicy(_text(policy['id'], ''));
      if (!mounted) return;
      _toast(context, 'Payroll policy deleted.');
      await _load();
    } catch (error) {
      if (mounted) _toast(context, _friendlyError(error), isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final active =
        _policies.where((policy) => policy['is_active'] != false).length;
    return _PageScaffold(
      title: 'Payroll Settings',
      subtitle:
          'Configure statutory rates, deductions, credit bill handling and payroll approval policy.',
      actions: [
        OutlinedButton.icon(
          onPressed: _load,
          icon: Icon(PhosphorIcons.arrowsClockwise()),
          label: const Text('Refresh'),
        ),
        FilledButton.icon(
          onPressed: () => _openForm(),
          icon: Icon(PhosphorIcons.plus()),
          label: const Text('New Policy'),
        ),
      ],
      children: [
        if (_loading) const LinearProgressIndicator(minHeight: 2),
        if (_error != null) _ErrorBanner(_error!),
        _MetricGrid(cards: [
          _MetricData(
            title: 'Policies',
            value: '${_policies.length}',
            icon: PhosphorIcons.clipboardText(),
            color: AppColors.kPrimary,
          ),
          _MetricData(
            title: 'Active',
            value: '$active',
            icon: PhosphorIcons.checkCircle(),
            color: Colors.green,
          ),
          _MetricData(
            title: 'Inactive',
            value: '${_policies.length - active}',
            icon: Icons.remove_circle_outline,
            color: Colors.orange,
          ),
        ]),
        _RecordTable(
          title: 'Payroll Policies',
          count: _policies.length,
          columns: const [
            'Name',
            'Category',
            'Formula',
            'Rate',
            'Status',
            'Actions'
          ],
          rows: _policies
              .map((policy) => [
                    _text(policy['name']),
                    _text(policy['category']),
                    _text(policy['formula_type']),
                    '${_number(policy['rate'])}',
                    policy['is_active'] == false ? 'Inactive' : 'Active',
                    'actions:${_text(policy['id'])}',
                  ])
              .toList(),
          actionBuilder: (rowIndex) {
            final policy = _policies[rowIndex];
            return Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextButton(
                  onPressed: () => _openForm(policy),
                  child: const Text('Edit'),
                ),
                TextButton(
                  onPressed: () => _delete(policy),
                  child: const Text('Delete'),
                ),
              ],
            );
          },
          emptyText: 'No payroll policies configured.',
        ),
      ],
    );
  }
}

class SystemIntegrationsSection extends ConsumerStatefulWidget {
  const SystemIntegrationsSection({super.key});

  @override
  ConsumerState<SystemIntegrationsSection> createState() =>
      _SystemIntegrationsSectionState();
}

class _SystemIntegrationsSectionState
    extends ConsumerState<SystemIntegrationsSection> {
  Map<String, dynamic> _status = {};
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final status = await ref.read(systemServiceProvider).getSystemStatus();
      if (!mounted) return;
      setState(() => _status = status);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = _friendlyError(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _PageScaffold(
      title: 'System Integrations',
      subtitle:
          'Track services used by payments, reports, notifications, authentication and hotel distribution.',
      actions: [
        OutlinedButton.icon(
          onPressed: _load,
          icon: Icon(PhosphorIcons.arrowsClockwise()),
          label: const Text('Refresh'),
        ),
      ],
      children: [
        if (_loading) const LinearProgressIndicator(minHeight: 2),
        if (_error != null) _ErrorBanner(_error!),
        _InfoGrid(cards: [
          _ConfigCardData(
            title: 'API',
            description:
                'Status: ${_text(_status['api']?['status'], 'unknown')}',
            icon: PhosphorIcons.cloud(),
          ),
          _ConfigCardData(
            title: 'Database',
            description:
                'Status: ${_text(_status['database']?['status'], 'unknown')} | Latency: ${_text(_status['database']?['latency'], 'N/A')}',
            icon: PhosphorIcons.database(),
          ),
          _ConfigCardData(
            title: 'Queue & Cache',
            description:
                'Queue: ${_text(_status['queue']?['status'], 'unknown')} | Cache: ${_text(_status['cache']?['status'], 'unknown')}',
            icon: Icons.layers_outlined,
          ),
        ]),
      ],
    );
  }
}

class _ReportTemplateDialog extends StatefulWidget {
  final Map<String, dynamic>? template;

  const _ReportTemplateDialog({this.template});

  @override
  State<_ReportTemplateDialog> createState() => _ReportTemplateDialogState();
}

class _ReportTemplateDialogState extends State<_ReportTemplateDialog> {
  late final TextEditingController _name;
  late final TextEditingController _description;
  String _type = 'audit';
  String _category = 'operations';

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: _text(widget.template?['name'], ''));
    _description =
        TextEditingController(text: _text(widget.template?['description'], ''));
    _type = _text(widget.template?['type'], 'audit');
    _category = _text(widget.template?['category'], 'operations');
  }

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _FormDialog(
      title: widget.template == null
          ? 'New Report Template'
          : 'Edit Report Template',
      children: [
        TextField(
          controller: _name,
          decoration: const InputDecoration(labelText: 'Template name'),
        ),
        _DropdownField(
          label: 'Type',
          value: _type,
          values: const [
            'audit',
            'stock',
            'payroll',
            'cashier',
            'finance',
            'hotel'
          ],
          onChanged: (value) => setState(() => _type = value),
        ),
        _DropdownField(
          label: 'Category',
          value: _category,
          values: const [
            'operations',
            'financial',
            'inventory',
            'hr',
            'compliance'
          ],
          onChanged: (value) => setState(() => _category = value),
        ),
        TextField(
          controller: _description,
          maxLines: 3,
          decoration: const InputDecoration(labelText: 'Description'),
        ),
      ],
      onSave: () {
        if (_name.text.trim().isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Template name is required.')),
          );
          return;
        }
        Navigator.of(context).pop({
          'name': _name.text.trim(),
          'type': _type,
          'category': _category,
          'description': _description.text.trim(),
          'status': 'active',
          'parameters': {
            'branding': 'famous_gates',
            'format': 'pdf',
          },
        });
      },
    );
  }
}

class _PayrollPolicyDialog extends StatefulWidget {
  final Map<String, dynamic>? policy;

  const _PayrollPolicyDialog({this.policy});

  @override
  State<_PayrollPolicyDialog> createState() => _PayrollPolicyDialogState();
}

class _PayrollPolicyDialogState extends State<_PayrollPolicyDialog> {
  late final TextEditingController _name;
  late final TextEditingController _rate;
  late final TextEditingController _min;
  late final TextEditingController _max;
  String _category = 'statutory';
  String _formulaType = 'percentage';
  bool _isActive = true;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: _text(widget.policy?['name'], ''));
    _rate = TextEditingController(text: _text(widget.policy?['rate'], '0'));
    _min = TextEditingController(text: _text(widget.policy?['min_limit'], '0'));
    _max = TextEditingController(text: _text(widget.policy?['max_limit'], '0'));
    _category = _text(widget.policy?['category'], 'statutory');
    _formulaType = _text(widget.policy?['formula_type'], 'percentage');
    _isActive = widget.policy?['is_active'] != false;
  }

  @override
  void dispose() {
    _name.dispose();
    _rate.dispose();
    _min.dispose();
    _max.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _FormDialog(
      title:
          widget.policy == null ? 'New Payroll Policy' : 'Edit Payroll Policy',
      children: [
        TextField(
          controller: _name,
          decoration: const InputDecoration(labelText: 'Policy name'),
        ),
        _DropdownField(
          label: 'Category',
          value: _category,
          values: const [
            'statutory',
            'deduction',
            'addition',
            'credit_bill',
            'unpaid_bill'
          ],
          onChanged: (value) => setState(() => _category = value),
        ),
        _DropdownField(
          label: 'Formula',
          value: _formulaType,
          values: const ['percentage', 'fixed', 'tiered'],
          onChanged: (value) => setState(() => _formulaType = value),
        ),
        TextField(
          controller: _rate,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Rate'),
        ),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _min,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Minimum'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextField(
                controller: _max,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Maximum'),
              ),
            ),
          ],
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Active'),
          value: _isActive,
          onChanged: (value) => setState(() => _isActive = value),
        ),
      ],
      onSave: () {
        if (_name.text.trim().isEmpty) return;
        Navigator.of(context).pop({
          'name': _name.text.trim(),
          'category': _category,
          'formula_type': _formulaType,
          'rate': num.tryParse(_rate.text.trim()) ?? 0,
          'min_limit': num.tryParse(_min.text.trim()) ?? 0,
          'max_limit': num.tryParse(_max.text.trim()) ?? 0,
          'is_active': _isActive,
        });
      },
    );
  }
}

class _PageScaffold extends StatelessWidget {
  final String title;
  final String subtitle;
  final List<Widget> children;
  final List<Widget> actions;

  const _PageScaffold({
    required this.title,
    required this.subtitle,
    required this.children,
    this.actions = const [],
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                        color: AppColors.kTextPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 15,
                        color: AppColors.kTextSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              if (actions.isNotEmpty)
                Wrap(spacing: 10, runSpacing: 10, children: actions),
            ],
          ),
          const SizedBox(height: 24),
          ...children.expand((child) => [child, const SizedBox(height: 18)]),
        ],
      ),
    );
  }
}

class _ToolbarCard extends StatelessWidget {
  final List<Widget> children;

  const _ToolbarCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return _Panel(
      child: Row(
        children: children
            .expand((child) => [child, const SizedBox(width: 12)])
            .toList()
          ..removeLast(),
      ),
    );
  }
}

class _MetricGrid extends StatelessWidget {
  final List<_MetricData> cards;

  const _MetricGrid({required this.cards});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 920 ? 3 : 1;
        final width = (constraints.maxWidth - (16 * (columns - 1))) / columns;
        return Wrap(
          spacing: 16,
          runSpacing: 16,
          children: cards
              .map((card) => SizedBox(width: width, child: _MetricCard(card)))
              .toList(),
        );
      },
    );
  }
}

class _MetricCard extends StatelessWidget {
  final _MetricData data;

  const _MetricCard(this.data);

  @override
  Widget build(BuildContext context) {
    return _Panel(
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: data.color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(data.icon, color: data.color),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  data.value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: AppColors.kTextPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  data.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: AppColors.kTextSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoGrid extends StatelessWidget {
  final List<_ConfigCardData> cards;

  const _InfoGrid({required this.cards});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 1100
            ? 3
            : constraints.maxWidth >= 720
                ? 2
                : 1;
        const spacing = 16.0;
        final width =
            (constraints.maxWidth - (spacing * (columns - 1))) / columns;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: cards
              .map((card) =>
                  SizedBox(width: width, child: _ConfigCard(data: card)))
              .toList(),
        );
      },
    );
  }
}

class _RecordTable extends StatelessWidget {
  final String title;
  final int count;
  final List<String> columns;
  final List<List<String>> rows;
  final String emptyText;
  final Widget Function(int rowIndex)? actionBuilder;

  const _RecordTable({
    required this.title,
    required this.count,
    required this.columns,
    required this.rows,
    required this.emptyText,
    this.actionBuilder,
  });

  @override
  Widget build(BuildContext context) {
    return _Panel(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                Text(
                  '$count records',
                  style: const TextStyle(color: AppColors.kTextSecondary),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          if (rows.isEmpty)
            Padding(
              padding: const EdgeInsets.all(36),
              child: Center(
                child: Text(
                  emptyText,
                  style: const TextStyle(color: AppColors.kTextSecondary),
                ),
              ),
            )
          else
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                columns: columns
                    .map((column) => DataColumn(label: Text(column)))
                    .toList(),
                rows: List.generate(rows.length, (rowIndex) {
                  final row = rows[rowIndex];
                  return DataRow(
                    cells: List.generate(columns.length, (columnIndex) {
                      if (actionBuilder != null &&
                          columnIndex == columns.length - 1 &&
                          row[columnIndex].startsWith('actions:')) {
                        return DataCell(actionBuilder!(rowIndex));
                      }
                      return DataCell(
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 280),
                          child: Text(
                            row[columnIndex],
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      );
                    }),
                  );
                }),
              ),
            ),
        ],
      ),
    );
  }
}

class _ConfigCard extends StatelessWidget {
  final _ConfigCardData data;

  const _ConfigCard({required this.data});

  @override
  Widget build(BuildContext context) {
    return _Panel(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.kPrimary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(data.icon, color: AppColors.kPrimary, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  data.title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.kTextPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  data.description,
                  style: const TextStyle(
                    fontSize: 13,
                    height: 1.35,
                    color: AppColors.kTextSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;

  const _Panel({
    required this.child,
    this.padding = const EdgeInsets.all(18),
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.kDivider),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  final String message;

  const _ErrorBanner(this.message);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.red.shade100),
      ),
      child: Row(
        children: [
          Icon(PhosphorIcons.warning(), color: Colors.red.shade700),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: Colors.red.shade800),
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _SummaryChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: Icon(icon, size: 16, color: AppColors.kPrimary),
      label: Text(label),
      backgroundColor: AppColors.kPrimary.withValues(alpha: 0.08),
      side: BorderSide.none,
    );
  }
}

class _FormDialog extends StatelessWidget {
  final String title;
  final List<Widget> children;
  final VoidCallback onSave;

  const _FormDialog({
    required this.title,
    required this.children,
    required this.onSave,
  });

  @override
  Widget build(BuildContext context) {
    return Dialog(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 18),
              ...children
                  .expand((child) => [child, const SizedBox(height: 14)]),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Cancel'),
                  ),
                  const SizedBox(width: 10),
                  FilledButton(
                    onPressed: onSave,
                    child: const Text('Save'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DropdownField extends StatelessWidget {
  final String label;
  final String value;
  final List<String> values;
  final ValueChanged<String> onChanged;

  const _DropdownField({
    required this.label,
    required this.value,
    required this.values,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final distinctValues = values.toSet().toList();
    final selected =
        distinctValues.contains(value) ? value : distinctValues.first;
    return DropdownButtonFormField<String>(
      initialValue: selected,
      isExpanded: true,
      decoration: InputDecoration(labelText: label),
      items: distinctValues
          .map((item) => DropdownMenuItem(value: item, child: Text(item)))
          .toList(),
      onChanged: (value) {
        if (value != null) onChanged(value);
      },
    );
  }
}

class _ConfigCardData {
  final String title;
  final String description;
  final IconData icon;

  const _ConfigCardData({
    required this.title,
    required this.description,
    required this.icon,
  });
}

class _MetricData {
  final String title;
  final String value;
  final IconData icon;
  final Color color;

  const _MetricData({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });
}

String _friendlyError(Object error) {
  final text = error.toString();
  final marker = RegExp(r'message: ([^,}]+)').firstMatch(text);
  if (marker != null) return marker.group(1)!.trim();
  return text.replaceFirst('Exception: ', '');
}

void _toast(BuildContext context, String message, {bool isError = false}) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(message),
      backgroundColor: isError ? Colors.red.shade700 : AppColors.kPrimary,
    ),
  );
}
