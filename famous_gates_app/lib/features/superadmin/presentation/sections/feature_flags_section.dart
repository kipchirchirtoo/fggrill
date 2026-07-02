import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../domain/superadmin_providers.dart';

class FeatureFlagsSection extends ConsumerStatefulWidget {
  const FeatureFlagsSection({super.key});

  @override
  ConsumerState<FeatureFlagsSection> createState() =>
      _FeatureFlagsSectionState();
}

class _FeatureFlagsSectionState extends ConsumerState<FeatureFlagsSection> {
  @override
  Widget build(BuildContext context) {
    final flagsAsync = ref.watch(featureFlagsProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          const SizedBox(height: 24),
          flagsAsync.when(
            data: (flags) => flags.isEmpty
                ? _buildEmptyState()
                : _buildFlagsList(flags),
            loading: () => const LoadingSkeleton(height: 100, count: 5),
            error: (e, _) => ErrorState(
              message: e.toString(),
              onRetry: () => ref.invalidate(featureFlagsProvider),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(PhosphorIcons.slidersHorizontal(),
                  color: AppColors.kPrimary, size: 28),
              const SizedBox(width: 10),
              const Text(
                'Feature Flags',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5,
                ),
              ),
            ]),
            const SizedBox(height: 4),
            Text(
              'Enable/disable system features globally or per branch',
              style: TextStyle(fontSize: 14, color: Colors.grey.shade500),
            ),
          ],
        ),
        ElevatedButton.icon(
          onPressed: _showAddFlagDialog,
          icon: Icon(PhosphorIcons.plus(), size: 16),
          label: const Text('Add Flag'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.kPrimary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(48),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: [
          Icon(PhosphorIcons.slidersHorizontal(),
              color: Colors.grey.shade400, size: 40),
          const SizedBox(height: 12),
          const Text('No feature flags configured',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 6),
          Text('Add flags to control system features dynamically.',
              style: TextStyle(color: Colors.grey.shade500)),
          const SizedBox(height: 20),
          ElevatedButton.icon(
            onPressed: _showAddFlagDialog,
            icon: Icon(PhosphorIcons.plus(), size: 16),
            label: const Text('Add First Flag'),
          ),
        ],
      ),
    );
  }

  Widget _buildFlagsList(List<Map<String, dynamic>> flags) {
    return Column(
      children: flags.map((flag) => _buildFlagCard(flag)).toList(),
    );
  }

  Widget _buildFlagCard(Map<String, dynamic> flag) {
    final rawId = flag['id'];
    final id = rawId is int ? rawId : int.tryParse('${rawId ?? ''}');
    final flagName = flag['flag_name']?.toString() ?? flag['flag_key']?.toString() ?? 'Unnamed';
    final flagKey = flag['flag_key']?.toString() ?? '';
    final description = flag['description']?.toString() ?? '';
    final isEnabled = flag['is_enabled'] == true;
    final isGlobal = flag['is_global'] == true;
    final branchName = flag['branch_name']?.toString();

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isEnabled
              ? AppColors.kPrimary.withValues(alpha: 0.3)
              : Colors.grey.shade200,
        ),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 4,
              offset: const Offset(0, 1)),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: isEnabled
                  ? AppColors.kPrimary.withValues(alpha: 0.1)
                  : Colors.grey.shade100,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              PhosphorIcons.bookmark(),
              color: isEnabled ? AppColors.kPrimary : Colors.grey.shade400,
              size: 20,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Text(flagName,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 15)),
                  const SizedBox(width: 8),
                  if (flagKey.isNotEmpty && flagKey != flagName)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(flagKey,
                          style: TextStyle(
                              fontSize: 10,
                              color: Colors.grey.shade600,
                              fontFamily: 'monospace')),
                    ),
                  const SizedBox(width: 8),
                  _buildBadge(
                    isGlobal ? 'GLOBAL' : 'BRANCH',
                    isGlobal ? Colors.blue : Colors.teal,
                  ),
                  if (!isGlobal && branchName != null) ...[
                    const SizedBox(width: 6),
                    Text(branchName,
                        style: TextStyle(
                            fontSize: 11, color: Colors.grey.shade500)),
                  ],
                ]),
                if (description.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(description,
                      style: TextStyle(
                          fontSize: 13, color: Colors.grey.shade600)),
                ],
              ],
            ),
          ),
          Switch(
            value: isEnabled,
            activeThumbColor: AppColors.kPrimary,
            onChanged: id == null
                ? null
                : (newValue) => _onToggle(flag, id, newValue),
          ),
        ],
      ),
    );
  }

  Widget _buildBadge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        text,
        style: TextStyle(
            fontSize: 10, fontWeight: FontWeight.bold, color: color),
      ),
    );
  }

  void _onToggle(Map<String, dynamic> flag, int id, bool newValue) {
    final flagName = flag['flag_name']?.toString() ?? 'this feature';
    final isCritical = flag['is_critical'] == true ||
        (flag['flag_key']?.toString() ?? '').contains('core');

    if (!newValue && isCritical) {
      _showCriticalWarningDialog(flagName, () => _doToggle(id, newValue));
    } else {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(newValue ? 'Enable Feature' : 'Disable Feature'),
          content: Text(
              '${newValue ? "Enable" : "Disable"} "$flagName"?'),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(ctx);
                _doToggle(id, newValue);
              },
              child: const Text('Confirm'),
            ),
          ],
        ),
      );
    }
  }

  void _showCriticalWarningDialog(String flagName, VoidCallback onConfirm) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(children: [
          Icon(PhosphorIcons.warning(), color: AppColors.kError, size: 22),
          const SizedBox(width: 8),
          const Text('Critical Feature Warning'),
        ]),
        content: Container(
          width: 400,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.red.shade50,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            'You are about to DISABLE "$flagName", which may be a critical feature. '
            'This could impact system functionality for all users. Are you sure?',
            style: TextStyle(color: Colors.red.shade800),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              onConfirm();
            },
            style:
                ElevatedButton.styleFrom(backgroundColor: AppColors.kError),
            child: const Text('Disable Anyway'),
          ),
        ],
      ),
    );
  }

  Future<void> _doToggle(int id, bool newValue) async {
    try {
      await ref.read(superadminGodRepositoryProvider).updateFeatureFlag(
        id,
        {
          'is_enabled': newValue,
          'justification': 'Toggled via admin panel',
        },
      );
      ref.invalidate(featureFlagsProvider);
      if (mounted) {
        AppNotifier.show(
            context, 'Feature flag ${newValue ? "enabled" : "disabled"}.');
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.show(context, 'Failed to update flag: $e', isError: true);
      }
    }
  }

  Future<void> _showAddFlagDialog() async {
    final flagKeyCtrl = TextEditingController();
    final flagNameCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    bool isGlobal = true;
    int? selectedBranch;
    final formKey = GlobalKey<FormState>();

    List<Map<String, dynamic>> branches = [];
    try {
      final data = await ref.read(allBranchesProvider.future);
      final rawBranches = data['data'] as List<dynamic>? ?? const [];
      branches = rawBranches
          .whereType<Map>()
          .map((b) => Map<String, dynamic>.from(b))
          .toList();
    } catch (_) {
      branches = [];
    }

    if (!mounted) return;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: Row(children: [
            Icon(PhosphorIcons.bookmark(), color: AppColors.kPrimary),
            const SizedBox(width: 8),
            const Text('Add Feature Flag'),
          ]),
          content: SizedBox(
            width: 480,
            child: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: flagKeyCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Flag Key *',
                      hintText: 'e.g. enable_new_checkout',
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? 'Flag key is required'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: flagNameCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Flag Name *',
                      hintText: 'e.g. New Checkout Flow',
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? 'Flag name is required'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: descCtrl,
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Description',
                      alignLabelWithHint: true,
                    ),
                  ),
                  const SizedBox(height: 12),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Global Flag'),
                    subtitle: const Text('Applies to all branches'),
                    value: isGlobal,
                    activeThumbColor: AppColors.kPrimary,
                    onChanged: (v) => setS(() {
                      isGlobal = v;
                      if (isGlobal) selectedBranch = null;
                    }),
                  ),
                  if (!isGlobal) ...[
                    const SizedBox(height: 8),
                    DropdownButtonFormField<int?>(
                      initialValue: selectedBranch,
                      decoration: const InputDecoration(
                          labelText: 'Branch *'),
                      items: [
                        const DropdownMenuItem<int?>(
                            value: null,
                            child: Text('Select a branch')),
                        ...branches.map((b) => DropdownMenuItem<int?>(
                              value: int.tryParse('${b['id']}'),
                              child:
                                  Text('${b['name'] ?? 'Branch'}'),
                            )),
                      ],
                      onChanged: (v) => setS(() => selectedBranch = v),
                      validator: (v) =>
                          (!isGlobal && v == null)
                              ? 'Select a branch'
                              : null,
                    ),
                  ],
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                if (!formKey.currentState!.validate()) return;
                Navigator.pop(ctx);
                if (!mounted) return;
                await _createFlag({
                  'flag_key': flagKeyCtrl.text.trim(),
                  'flag_name': flagNameCtrl.text.trim(),
                  'description': descCtrl.text.trim(),
                  'is_global': isGlobal,
                  'is_enabled': true,
                  if (!isGlobal && selectedBranch != null)
                    'branch_id': selectedBranch,
                });
              },
              child: const Text('Create Flag'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _createFlag(Map<String, dynamic> payload) async {
    try {
      await ref
          .read(superadminGodRepositoryProvider)
          .createFeatureFlag(payload);
      ref.invalidate(featureFlagsProvider);
      if (mounted) {
        AppNotifier.show(context, 'Feature flag created successfully.');
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.show(context, 'Failed to create flag: $e', isError: true);
      }
    }
  }
}
