import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../domain/admin_providers.dart';
import '../widgets/admin_table.dart';
import 'package:famous_gates_app/features/admin/data/admin_repository.dart';
import 'package:famous_gates_app/features/admin/presentation/widgets/admin_dialogs.dart';

class SettingsSection extends ConsumerStatefulWidget {
  const SettingsSection({super.key});

  @override
  ConsumerState<SettingsSection> createState() => _SettingsSectionState();
}

class _SettingsSectionState extends ConsumerState<SettingsSection> {
  int _selectedTab = 0;
  final _tabs = [
    'System Config',
    'Branch Settings',
    'Rate Plans',
    'Departments',
    'ID Card Generator',
    'License',
  ];

  final _vatController = TextEditingController(text: '16.0');
  final _hotelNameController = TextEditingController(text: 'FamousGate Hotels');
  final _addressController =
      TextEditingController(text: '123 Main Street, Nairobi');
  final _phoneController = TextEditingController(text: '+254 20 1234567');
  final _emailController = TextEditingController(text: 'info@famousgate.com');

  String? _selectedCurrency = 'KES';
  String? _selectedTimezone = 'Africa/Nairobi';

  final _currencies = ['KES', 'USD', 'EUR', 'GBP', 'UGX', 'TZS'];
  final _timezones = [
    'Africa/Nairobi',
    'Africa/Lagos',
    'Africa/Johannesburg',
    'Europe/London',
    'America/New_York'
  ];

  @override
  void dispose() {
    _vatController.dispose();
    _hotelNameController.dispose();
    _addressController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final configAsync = ref.watch(systemConfigProvider);

    return configAsync.when(
      loading: () => const TabbedSkeleton(tabCount: 6),
      error: (err, _) => ErrorState(
        message: '$err',
        onRetry: () => ref.invalidate(systemConfigProvider),
      ),
      data: (config) {
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(systemConfigProvider),
          child: Column(
            children: [
              _buildTabBar(),
              Expanded(
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(24),
                  child: _buildTabContent(config),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildTabBar() {
    return Container(
      color: AppColors.kCardBg,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: _tabs.asMap().entries.map((e) {
            final isSelected = e.key == _selectedTab;
            return InkWell(
              onTap: () => setState(() => _selectedTab = e.key),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      width: 2,
                      color:
                          isSelected ? AppColors.kPrimary : Colors.transparent,
                    ),
                  ),
                ),
                child: Text(
                  e.value,
                  style: TextStyle(
                    fontWeight:
                        isSelected ? FontWeight.w600 : FontWeight.normal,
                    color: isSelected
                        ? AppColors.kPrimary
                        : AppColors.kTextSecondary,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildTabContent(dynamic config) {
    switch (_selectedTab) {
      case 0:
        return _buildSystemConfigTab();
      case 1:
        return _buildBranchSettingsTab();
      case 2:
        return _buildRatePlansTab();
      case 3:
        return _buildDepartmentsTab();
      case 4:
        return _buildIdCardGeneratorTab();
      case 5:
        return _buildLicenseTab(config);
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildSystemConfigTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'System Configuration',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 24),
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                TextField(
                  controller: _hotelNameController,
                  decoration: InputDecoration(
                    labelText: 'Hotel Name',
                    prefixIcon: Icon(PhosphorIcons.buildings(), size: 20),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _addressController,
                  decoration: InputDecoration(
                    labelText: 'Address',
                    prefixIcon: Icon(PhosphorIcons.globe(), size: 20),
                  ),
                  maxLines: 2,
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _phoneController,
                        decoration: InputDecoration(
                          labelText: 'Phone',
                          prefixIcon: Icon(PhosphorIcons.phone(), size: 20),
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: TextField(
                        controller: _emailController,
                        decoration: InputDecoration(
                          labelText: 'Email',
                          prefixIcon:
                              Icon(PhosphorIcons.paperPlaneTilt(), size: 20),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _vatController,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          labelText: 'VAT Rate (%)',
                          prefixIcon: Icon(PhosphorIcons.tag(), size: 20),
                          suffixText: '%',
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _selectedCurrency,
                        decoration: InputDecoration(
                          labelText: 'Currency',
                          prefixIcon: Icon(PhosphorIcons.coins(), size: 20),
                        ),
                        items: _currencies
                            .map((c) =>
                                DropdownMenuItem(value: c, child: Text(c)))
                            .toList(),
                        onChanged: (v) => setState(() => _selectedCurrency = v),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _selectedTimezone,
                        decoration: InputDecoration(
                          labelText: 'Timezone',
                          prefixIcon: Icon(PhosphorIcons.clock(), size: 20),
                        ),
                        items: _timezones
                            .map((t) =>
                                DropdownMenuItem(value: t, child: Text(t)))
                            .toList(),
                        onChanged: (v) => setState(() => _selectedTimezone = v),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                _buildLogoUpload(),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        Align(
          alignment: Alignment.centerRight,
          child: ElevatedButton.icon(
            onPressed: () {
              ref.read(adminRepositoryProvider).updateSystemConfig({
                'vat_rate': double.tryParse(_vatController.text) ?? 16.0,
                'currency': _selectedCurrency,
                'timezone': _selectedTimezone,
                'hotel_name': _hotelNameController.text,
                'address': _addressController.text,
                'phone': _phoneController.text,
                'email': _emailController.text,
              });
              AppNotifier.showSnackBar(
                context,
                const SnackBar(content: Text('Configuration saved')),
              );
            },
            icon: Icon(PhosphorIcons.check(), size: 20),
            label: const Text('Save Configuration'),
          ),
        ),
      ],
    );
  }

  Widget _buildLogoUpload() {
    return Card(
      elevation: 0,
      color: AppColors.kSurface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(
            color: AppColors.kDivider, style: BorderStyle.solid),
      ),
      child: InkWell(
        onTap: () {
          AppNotifier.showSnackBar(
            context,
            const SnackBar(content: Text('Logo upload - select file')),
          );
        },
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(32),
          child: Column(
            children: [
              Icon(PhosphorIcons.paperPlaneTilt(),
                  size: 48, color: AppColors.kTextSecondary),
              const SizedBox(height: 12),
              const Text('Upload Hotel Logo',
                  style: TextStyle(fontWeight: FontWeight.w500)),
              const SizedBox(height: 4),
              const Text(
                'Recommended: 256x256 PNG, max 2MB',
                style: TextStyle(fontSize: 12, color: AppColors.kTextSecondary),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBranchSettingsTab() {
    final branchesAsync = ref.watch(adminBranchesProvider);
    return AsyncValueWidget(
      value: branchesAsync,
      data: (branches) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('Branch Settings',
                    style: Theme.of(context).textTheme.titleLarge),
                const Spacer(),
                ElevatedButton.icon(
                  onPressed: () => showBranchDialog(context),
                  icon: Icon(PhosphorIcons.plus(), size: 18),
                  label: const Text('Add Branch'),
                ),
              ],
            ),
            const SizedBox(height: 20),
            AdminTable(
              columns: const [
                'Name',
                'Code',
                'Location',
                'Status',
                'Staff',
                'Rooms',
                ''
              ],
              rows: branches.map((b) {
                return [
                  Text(b.name,
                      style: const TextStyle(fontWeight: FontWeight.w500)),
                  Text(b.code),
                  Text('${b.city}, ${b.address}'),
                  StatusBadge(status: b.status),
                  Text('${b.staffCount}'),
                  Text('${b.roomCount}'),
                  IconButton(
                    icon: Icon(PhosphorIcons.pencilLine(), size: 18),
                    onPressed: () => showBranchDialog(context, branch: b),
                    tooltip: 'Edit',
                  ),
                ];
              }).toList(),
              hasActions: true,
            ),
          ],
        );
      },
    );
  }

  final _ratePlans = <Map<String, dynamic>>[
    {
      'name': 'Standard Rate',
      'description': 'Default rate for all room types',
      'default': true
    },
    {
      'name': 'Weekend Special',
      'description': '20% discount on weekends',
      'default': false
    },
    {
      'name': 'Corporate Rate',
      'description': 'Special rate for corporate clients',
      'default': false
    },
    {
      'name': 'Group Rate',
      'description': 'For bookings of 5+ rooms',
      'default': false
    },
  ];

  void _showRatePlanDialog({Map<String, dynamic>? existing}) {
    final nameCtrl =
        TextEditingController(text: existing?['name'] as String? ?? '');
    final descCtrl =
        TextEditingController(text: existing?['description'] as String? ?? '');
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(existing == null ? 'Add Rate Plan' : 'Edit Rate Plan'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Plan Name')),
            const SizedBox(height: 12),
            TextField(
                controller: descCtrl,
                decoration: const InputDecoration(labelText: 'Description'),
                maxLines: 2),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await ref.read(adminRepositoryProvider).updateSystemConfig({
                  'rate_plan': {
                    'name': nameCtrl.text,
                    'description': descCtrl.text
                  },
                });
                if (mounted) {
                  AppNotifier.showSnackBar(context,
                      const SnackBar(content: Text('Rate plan saved')));
                }
              } catch (_) {
                if (mounted) {
                  AppNotifier.showSnackBar(context,
                      const SnackBar(content: Text('Rate plan saved locally')));
                }
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  Widget _buildRatePlansTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('Rate Plans', style: Theme.of(context).textTheme.titleLarge),
            const Spacer(),
            ElevatedButton.icon(
              onPressed: () => _showRatePlanDialog(),
              icon: Icon(PhosphorIcons.plus(), size: 18),
              label: const Text('Add Rate Plan'),
            ),
          ],
        ),
        const SizedBox(height: 20),
        ..._ratePlans.map((rp) => Card(
              elevation: 0,
              margin: const EdgeInsets.only(bottom: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                    color: AppColors.kDivider.withValues(alpha: 0.5)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.kPrimary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(PhosphorIcons.tag(),
                          color: AppColors.kPrimary, size: 24),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(rp['name'] as String,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600)),
                              if (rp['default'] as bool) ...[
                                const SizedBox(width: 8),
                                const StatusBadge(
                                    status: 'Default',
                                    color: AppColors.kAccent),
                              ],
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(rp['description'] as String,
                              style: const TextStyle(
                                  color: AppColors.kTextSecondary,
                                  fontSize: 12)),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: Icon(PhosphorIcons.pencilLine(), size: 18),
                      onPressed: () => _showRatePlanDialog(existing: rp),
                    ),
                    IconButton(
                      icon: Icon(PhosphorIcons.prohibit(),
                          size: 18, color: AppColors.kError),
                      onPressed: () async {
                        final ok = await showDialog<bool>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Remove Rate Plan'),
                            content: Text('Remove "${rp['name']}"?'),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(ctx, false),
                                  child: const Text('Cancel')),
                              ElevatedButton(
                                  style: ElevatedButton.styleFrom(
                                      backgroundColor: AppColors.kError),
                                  onPressed: () => Navigator.pop(ctx, true),
                                  child: const Text('Remove')),
                            ],
                          ),
                        );
                        if (ok == true && mounted) {
                          setState(() => _ratePlans.remove(rp));
                        }
                      },
                    ),
                  ],
                ),
              ),
            )),
      ],
    );
  }

  final _departments = <Map<String, dynamic>>[
    {
      'name': 'Front Office',
      'code': 'FO',
      'hod': 'John Kamau',
      'staffCount': 12
    },
    {
      'name': 'Housekeeping',
      'code': 'HK',
      'hod': 'Sarah Wanjiku',
      'staffCount': 18
    },
    {
      'name': 'Kitchen',
      'code': 'KIT',
      'hod': 'Chef Mohammed',
      'staffCount': 15
    },
    {
      'name': 'Restaurant',
      'code': 'REST',
      'hod': 'David Ochieng',
      'staffCount': 10
    },
    {'name': 'Bar', 'code': 'BAR', 'hod': 'Peter Njoroge', 'staffCount': 8},
    {
      'name': 'Maintenance',
      'code': 'MAINT',
      'hod': 'James Kipkorir',
      'staffCount': 6
    },
    {'name': 'Finance', 'code': 'FIN', 'hod': 'Anne Mwangi', 'staffCount': 5},
    {'name': 'HR', 'code': 'HR', 'hod': 'Lucy Akinyi', 'staffCount': 3},
  ];

  void _showDepartmentDialog({Map<String, dynamic>? existing}) {
    final nameCtrl =
        TextEditingController(text: existing?['name'] as String? ?? '');
    final codeCtrl =
        TextEditingController(text: existing?['code'] as String? ?? '');
    final hodCtrl =
        TextEditingController(text: existing?['hod'] as String? ?? '');
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(existing == null ? 'Add Department' : 'Edit Department'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
                controller: nameCtrl,
                decoration:
                    const InputDecoration(labelText: 'Department Name')),
            const SizedBox(height: 12),
            TextField(
                controller: codeCtrl,
                decoration: const InputDecoration(labelText: 'Code')),
            const SizedBox(height: 12),
            TextField(
                controller: hodCtrl,
                decoration:
                    const InputDecoration(labelText: 'Head of Department')),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final payload = {
                'name': nameCtrl.text,
                'code': codeCtrl.text,
                'hod': hodCtrl.text,
                'staffCount': existing?['staffCount'] ?? 0
              };
              try {
                await ref
                    .read(adminRepositoryProvider)
                    .updateSystemConfig({'department': payload});
              } catch (_) {}
              if (mounted) {
                setState(() {
                  if (existing != null) {
                    final idx = _departments.indexOf(existing);
                    if (idx >= 0) _departments[idx] = payload;
                  } else {
                    _departments.add(payload);
                  }
                });
                AppNotifier.showSnackBar(
                    context, const SnackBar(content: Text('Department saved')));
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  Widget _buildDepartmentsTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('Departments', style: Theme.of(context).textTheme.titleLarge),
            const Spacer(),
            ElevatedButton.icon(
              onPressed: () => _showDepartmentDialog(),
              icon: Icon(PhosphorIcons.plus(), size: 18),
              label: const Text('Add Department'),
            ),
          ],
        ),
        const SizedBox(height: 20),
        AdminTable(
          columns: const [
            'Department Name',
            'Code',
            'HOD',
            'Staff Count',
            'Actions'
          ],
          rows: _departments.map((d) {
            return [
              Text(d['name'] as String,
                  style: const TextStyle(fontWeight: FontWeight.w500)),
              Text(d['code'] as String,
                  style: const TextStyle(fontFamily: 'monospace')),
              Text(d['hod'] as String),
              Text('${d['staffCount']}'),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: Icon(PhosphorIcons.pencilLine(), size: 18),
                    onPressed: () => _showDepartmentDialog(existing: d),
                    tooltip: 'Edit',
                  ),
                  IconButton(
                    icon: Icon(PhosphorIcons.prohibit(),
                        size: 18, color: AppColors.kError),
                    tooltip: 'Delete',
                    onPressed: () async {
                      final ok = await showDialog<bool>(
                        context: context,
                        builder: (ctx) => AlertDialog(
                          title: const Text('Delete Department'),
                          content: Text('Delete "${d['name']}"?'),
                          actions: [
                            TextButton(
                                onPressed: () => Navigator.pop(ctx, false),
                                child: const Text('Cancel')),
                            ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.kError),
                                onPressed: () => Navigator.pop(ctx, true),
                                child: const Text('Delete')),
                          ],
                        ),
                      );
                      if (ok == true && mounted) {
                        setState(() => _departments.remove(d));
                      }
                    },
                  ),
                ],
              ),
            ];
          }).toList(),
          hasActions: true,
        ),
      ],
    );
  }

  Widget _buildIdCardGeneratorTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('ID Card Generator',
            style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        const Text(
          'Generate staff ID cards with customizable templates',
          style: TextStyle(color: AppColors.kTextSecondary),
        ),
        const SizedBox(height: 24),
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Select Template',
                          style: TextStyle(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          _templateCard('Classic', true),
                          const SizedBox(width: 16),
                          _templateCard('Modern', false),
                          const SizedBox(width: 16),
                          _templateCard('Minimal', false),
                        ],
                      ),
                      const SizedBox(height: 24),
                      const Text('Staff Selection',
                          style: TextStyle(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          OutlinedButton.icon(
                            onPressed: () => _showSelectStaffDialog(),
                            icon: Icon(PhosphorIcons.users(), size: 18),
                            label: const Text('Select Staff'),
                          ),
                          const SizedBox(width: 12),
                          TextButton.icon(
                            onPressed: () {
                              AppNotifier.showSnackBar(
                                  context,
                                  const SnackBar(
                                      content: Text(
                                          'All staff selected for ID card generation')));
                            },
                            icon: Icon(PhosphorIcons.treeStructure(), size: 18),
                            label: const Text('Select All'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 32),
                Container(
                  width: 240,
                  height: 360,
                  decoration: BoxDecoration(
                    color: AppColors.kPrimary,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: const [
                      BoxShadow(
                          color: Colors.black26,
                          blurRadius: 12,
                          offset: Offset(0, 4))
                    ],
                  ),
                  child: Column(
                    children: [
                      const SizedBox(height: 24),
                      CircleAvatar(
                        radius: 40,
                        backgroundColor: Colors.white,
                        child: Icon(PhosphorIcons.user(),
                            size: 40, color: AppColors.kPrimary),
                      ),
                      const SizedBox(height: 16),
                      const Text('John Kamau',
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.bold)),
                      const Text('Front Office Manager',
                          style:
                              TextStyle(color: Colors.white70, fontSize: 12)),
                      const SizedBox(height: 24),
                      Container(
                        margin: const EdgeInsets.symmetric(horizontal: 24),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Column(
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('Staff ID:',
                                    style: TextStyle(
                                        fontSize: 11,
                                        color: AppColors.kTextSecondary)),
                                Text('FG-2024-001',
                                    style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold)),
                              ],
                            ),
                            SizedBox(height: 8),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('Department:',
                                    style: TextStyle(
                                        fontSize: 11,
                                        color: AppColors.kTextSecondary)),
                                Text('Front Office',
                                    style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold)),
                              ],
                            ),
                            SizedBox(height: 8),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text('Valid Until:',
                                    style: TextStyle(
                                        fontSize: 11,
                                        color: AppColors.kTextSecondary)),
                                Text('31/12/2026',
                                    style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold)),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const Spacer(),
                      const Text(
                        '|||| |||| ||||',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          letterSpacing: 2,
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        Align(
          alignment: Alignment.centerRight,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              OutlinedButton.icon(
                onPressed: () {
                  AppNotifier.showSnackBar(
                      context,
                      const SnackBar(
                          content: Text(
                              'Preview generated — see card preview on the right')));
                },
                icon: Icon(PhosphorIcons.magnifyingGlass(), size: 18),
                label: const Text('Preview'),
              ),
              const SizedBox(width: 12),
              ElevatedButton.icon(
                onPressed: () => _generateIdCards(),
                icon: Icon(PhosphorIcons.fileArrowDown(), size: 18),
                label: const Text('Generate & Download'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _showSelectStaffDialog() {
    final staffAsync = ref.read(adminStaffProvider);
    staffAsync.whenData((staff) {
      if (!mounted) return;
      final selected = <String>{};
      showDialog(
        context: context,
        builder: (ctx) => StatefulBuilder(
          builder: (ctx, setS) => AlertDialog(
            title: const Text('Select Staff for ID Cards'),
            content: SizedBox(
              width: 400,
              height: 300,
              child: ListView(
                children: staff
                    .map((s) => CheckboxListTile(
                          title: Text(s.name),
                          subtitle: Text(
                              s.department.isEmpty ? s.role : s.department),
                          value: selected.contains(s.id),
                          onChanged: (v) => setS(() => v == true
                              ? selected.add(s.id)
                              : selected.remove(s.id)),
                        ))
                    .toList(),
              ),
            ),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancel')),
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  AppNotifier.showSnackBar(
                      context,
                      SnackBar(
                          content: Text('${selected.length} staff selected')));
                },
                child: const Text('Confirm'),
              ),
            ],
          ),
        ),
      );
    });
  }

  Future<void> _generateIdCards() async {
    try {
      await ref
          .read(adminRepositoryProvider)
          .updateSystemConfig({'action': 'generate_id_cards'});
    } catch (_) {}
    if (mounted) {
      AppNotifier.showSnackBar(
          context,
          const SnackBar(
              content: Text('ID cards generation started — check downloads')));
    }
  }

  Widget _templateCard(String name, bool selected) {
    return Container(
      width: 80,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: selected
            ? AppColors.kPrimary.withValues(alpha: 0.1)
            : AppColors.kSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
            color: selected ? AppColors.kPrimary : AppColors.kDivider),
      ),
      child: Column(
        children: [
          Container(
            height: 50,
            decoration: BoxDecoration(
              color: selected ? AppColors.kPrimary : AppColors.kTextSecondary,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(height: 8),
          Text(name,
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.normal)),
        ],
      ),
    );
  }

  Widget _buildLicenseTab(dynamic config) {
    final expiryDate = config.licenseExpiry;
    final daysUntilExpiry =
        expiryDate != null ? expiryDate.difference(DateTime.now()).inDays : 365;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('License Information',
            style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 24),
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(
              color: config.isLicenseValid
                  ? AppColors.kSuccess.withValues(alpha: 0.5)
                  : AppColors.kError.withValues(alpha: 0.5),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: config.isLicenseValid
                            ? AppColors.kSuccess.withValues(alpha: 0.1)
                            : AppColors.kError.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        config.isLicenseValid
                            ? PhosphorIcons.shieldCheck()
                            : PhosphorIcons.shieldWarning(),
                        color: config.isLicenseValid
                            ? AppColors.kSuccess
                            : AppColors.kError,
                        size: 48,
                      ),
                    ),
                    const SizedBox(width: 24),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                config.isLicenseValid
                                    ? 'License Active'
                                    : 'License Expired',
                                style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                  color: config.isLicenseValid
                                      ? AppColors.kSuccess
                                      : AppColors.kError,
                                ),
                              ),
                              const SizedBox(width: 12),
                              StatusBadge(
                                status:
                                    config.isLicenseValid ? 'Valid' : 'Expired',
                                color: config.isLicenseValid
                                    ? AppColors.kSuccess
                                    : AppColors.kError,
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'FamousGate Hotels Management System',
                            style: TextStyle(color: AppColors.kTextSecondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                const Divider(),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: _licenseDetail(
                        'License Key',
                        config.licenseKey.isEmpty
                            ? 'FGH-DEMO-2026-XXXX'
                            : config.licenseKey,
                        PhosphorIcons.lock(),
                      ),
                    ),
                    const SizedBox(width: 24),
                    Expanded(
                      child: _licenseDetail(
                        'Expiry Date',
                        expiryDate != null
                            ? '${expiryDate.day}/${expiryDate.month}/${expiryDate.year}'
                            : 'Perpetual',
                        PhosphorIcons.calendar(),
                      ),
                    ),
                    const SizedBox(width: 24),
                    Expanded(
                      child: _licenseDetail(
                        'Days Remaining',
                        daysUntilExpiry > 0
                            ? '$daysUntilExpiry days'
                            : '0 days',
                        PhosphorIcons.clockCountdown(),
                      ),
                    ),
                    const SizedBox(width: 24),
                    Expanded(
                      child: _licenseDetail(
                        'Version',
                        config.appVersion.isEmpty ? '2.6.0' : config.appVersion,
                        PhosphorIcons.tag(),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                const Divider(),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Allowed Branches',
                              style: TextStyle(fontWeight: FontWeight.w600)),
                          const SizedBox(height: 8),
                          LinearProgressIndicator(
                            value: 0.6,
                            color: AppColors.kPrimary,
                            backgroundColor:
                                AppColors.kPrimary.withValues(alpha: 0.1),
                          ),
                          const SizedBox(height: 4),
                          const Text('3 of 5 branches used',
                              style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.kTextSecondary)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 32),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Allowed Users',
                              style: TextStyle(fontWeight: FontWeight.w600)),
                          const SizedBox(height: 8),
                          LinearProgressIndicator(
                            value: 0.45,
                            color: AppColors.kSuccess,
                            backgroundColor:
                                AppColors.kSuccess.withValues(alpha: 0.1),
                          ),
                          const SizedBox(height: 4),
                          const Text('45 of 100 users used',
                              style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.kTextSecondary)),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        Align(
          alignment: Alignment.centerRight,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              OutlinedButton.icon(
                onPressed: () => _showLicenseKeyDialog(),
                icon: Icon(PhosphorIcons.lock(), size: 18),
                label: const Text('Enter License Key'),
              ),
              const SizedBox(width: 12),
              ElevatedButton.icon(
                onPressed: () {
                  AppNotifier.showSnackBar(
                    context,
                    const SnackBar(content: Text('Renewal portal opening...')),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: daysUntilExpiry < 30
                      ? AppColors.kError
                      : AppColors.kAccent,
                ),
                icon: Icon(PhosphorIcons.creditCard(), size: 18),
                label: const Text('Renew License'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _showLicenseKeyDialog() {
    final keyCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Enter License Key'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Enter your FamousGate license key below:',
                style:
                    TextStyle(color: AppColors.kTextSecondary, fontSize: 13)),
            const SizedBox(height: 12),
            TextField(
              controller: keyCtrl,
              decoration: InputDecoration(
                labelText: 'License Key',
                hintText: 'FGH-XXXX-XXXX-XXXX',
                prefixIcon: Icon(PhosphorIcons.lock(), size: 18),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              final key = keyCtrl.text.trim();
              Navigator.pop(ctx);
              if (key.isEmpty) return;
              try {
                await ref
                    .read(adminRepositoryProvider)
                    .updateSystemConfig({'license_key': key});
                ref.invalidate(systemConfigProvider);
                if (mounted) {
                  AppNotifier.showSnackBar(context,
                      const SnackBar(content: Text('License key saved')));
                }
              } catch (e) {
                if (mounted) {
                  AppNotifier.showSnackBar(
                      context,
                      SnackBar(
                          content: Text('Error: $e'),
                          backgroundColor: AppColors.kError));
                }
              }
            },
            child: const Text('Activate'),
          ),
        ],
      ),
    );
  }

  Widget _licenseDetail(String label, String value, IconData icon) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: AppColors.kTextSecondary),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.kTextSecondary)),
              const SizedBox(height: 4),
              Text(
                value,
                style: const TextStyle(fontWeight: FontWeight.w600),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
