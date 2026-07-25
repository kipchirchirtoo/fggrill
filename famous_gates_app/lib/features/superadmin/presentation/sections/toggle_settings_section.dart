import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/config/app_config.dart';
import 'package:dio/dio.dart';

final toggleSettingsProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final dio = Dio();
  final response = await dio.get('${AppConfig.apiUrl}/branch-features');
  return response.data as Map<String, dynamic>;
});

class ToggleSettingsSection extends ConsumerStatefulWidget {
  const ToggleSettingsSection({super.key});

  @override
  ConsumerState<ToggleSettingsSection> createState() => _ToggleSettingsSectionState();
}

class _ToggleSettingsSectionState extends ConsumerState<ToggleSettingsSection> {
  String _searchQuery = '';
  int? _selectedBranchId;
  String _selectedCategory = 'All';

  final List<String> _categories = [
    'All',
    'Accommodation',
    'Restaurant POS',
    'Bar POS',
    'Kitchen Control',
    'Cashier',
    'Finance',
    'Reports',
  ];

  @override
  Widget build(BuildContext context) {
    final settingsAsync = ref.watch(toggleSettingsProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(context),
          const SizedBox(height: 20),
          _buildFilters(context, settingsAsync.valueOrNull?['branches'] as List? ?? []),
          const SizedBox(height: 24),
          settingsAsync.when(
            data: (data) => _buildBranchTables(data),
            loading: () => const LoadingSkeleton(height: 120, count: 4),
            error: (e, _) => ErrorState(
              message: e.toString(),
              onRetry: () => ref.invalidate(toggleSettingsProvider),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(PhosphorIcons.toggleRight(), color: AppColors.kPrimary, size: 28),
              const SizedBox(width: 10),
              const Text(
                'Toggle Settings',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5,
                ),
              ),
            ]),
            const SizedBox(height: 4),
            Text(
              'Central management for branch-specific feature toggles and outlet room-charging settings',
              style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
            ),
          ],
        ),
        Row(
          children: [
            OutlinedButton.icon(
              onPressed: () => ref.invalidate(toggleSettingsProvider),
              icon: Icon(PhosphorIcons.arrowsClockwise(), size: 16),
              label: const Text('Refresh'),
            ),
            const SizedBox(width: 12),
            ElevatedButton.icon(
              onPressed: () => _showAuditHistoryDialog(context),
              icon: Icon(PhosphorIcons.clockCounterClockwise(), size: 16),
              label: const Text('View Audit History'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kPrimary,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildFilters(BuildContext context, List branches) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search feature name or key...',
                prefixIcon: Icon(PhosphorIcons.magnifyingGlass(), size: 18),
                isDense: true,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onChanged: (val) => setState(() => _searchQuery = val.trim().toLowerCase()),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            flex: 2,
            child: DropdownButtonFormField<int?>(
              initialValue: _selectedBranchId,
              decoration: InputDecoration(
                labelText: 'Branch',
                isDense: true,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
              items: [
                const DropdownMenuItem<int?>(value: null, child: Text('All Branches')),
                ...branches.map((b) {
                  final id = (b['branch_id'] as num?)?.toInt() ?? 0;
                  final name = b['branch_name']?.toString() ?? 'Branch $id';
                  return DropdownMenuItem<int?>(value: id, child: Text(name));
                }),
              ],
              onChanged: (val) => setState(() => _selectedBranchId = val),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            flex: 2,
            child: DropdownButtonFormField<String>(
              initialValue: _selectedCategory,
              decoration: InputDecoration(
                labelText: 'Category',
                isDense: true,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
              items: _categories.map((cat) {
                return DropdownMenuItem<String>(value: cat, child: Text(cat));
              }).toList(),
              onChanged: (val) => setState(() => _selectedCategory = val ?? 'All'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBranchTables(Map<String, dynamic> data) {
    final List branchesList = data['branches'] as List? ?? [];
    if (branchesList.isEmpty) {
      return const Center(child: Text('No branches found'));
    }

    final filteredBranches = branchesList.where((b) {
      if (_selectedBranchId != null && (b['branch_id'] as num?)?.toInt() != _selectedBranchId) {
        return false;
      }
      return true;
    }).toList();

    return Column(
      children: filteredBranches.map((b) => _buildBranchCard(b)).toList(),
    );
  }

  Widget _buildBranchCard(Map<String, dynamic> branch) {
    final branchId = (branch['branch_id'] as num).toInt();
    final branchName = branch['branch_name']?.toString() ?? 'Branch $branchId';
    final branchCode = branch['branch_code']?.toString() ?? '';
    final List features = branch['features'] as List? ?? [];

    final filteredFeatures = features.where((f) {
      final key = (f['feature_key'] ?? '').toString().toLowerCase();
      final name = (f['feature_name'] ?? '').toString().toLowerCase();
      final cat = (f['category'] ?? '').toString();

      if (_searchQuery.isNotEmpty && !key.contains(_searchQuery) && !name.contains(_searchQuery)) {
        return false;
      }

      if (_selectedCategory != 'All' && cat != _selectedCategory) {
        return false;
      }

      return true;
    }).toList();

    // Check parent Guest Room Charging state
    final parentFeature = features.firstWhere(
      (f) => f['feature_key'] == 'GUEST_ROOM_CHARGING',
      orElse: () => null,
    );
    final bool parentEnabled = parentFeature != null ? (parentFeature['is_enabled'] == true) : false;

    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Branch Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppColors.kPrimary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(PhosphorIcons.buildings(), color: AppColors.kPrimary, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      branchName,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    if (branchCode.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          branchCode,
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.blue.shade700),
                        ),
                      ),
                    ],
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: parentEnabled ? Colors.green.shade50 : Colors.orange.shade50,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: parentEnabled ? Colors.green.shade200 : Colors.orange.shade200,
                    ),
                  ),
                  child: Text(
                    parentEnabled ? 'Room Charging Active' : 'Room Charging Disabled',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: parentEnabled ? Colors.green.shade800 : Colors.orange.shade800,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Features List
          if (filteredFeatures.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Text('No feature toggles match your filter in this branch.'),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: filteredFeatures.length,
              separatorBuilder: (_, __) => Divider(height: 1, color: Colors.grey.shade100),
              itemBuilder: (context, index) {
                final feature = filteredFeatures[index] as Map<String, dynamic>;
                final key = feature['feature_key']?.toString() ?? '';
                final name = feature['feature_name']?.toString() ?? key;
                final desc = feature['description']?.toString() ?? '';
                final cat = feature['category']?.toString() ?? 'General';
                final isParent = feature['isParent'] == true;
                final parentKey = feature['parentKey']?.toString();
                final bool isEnabled = feature['is_enabled'] == true;

                // Disable child toggle if parent is off
                final bool isDisabledByParent = (parentKey == 'GUEST_ROOM_CHARGING' && !parentEnabled);

                return Padding(
                  padding: EdgeInsets.only(
                    left: (parentKey != null) ? 44.0 : 24.0,
                    right: 24.0,
                    top: 14.0,
                    bottom: 14.0,
                  ),
                  child: Row(
                    children: [
                      if (parentKey != null)
                        Icon(PhosphorIcons.cornerDownRight(), size: 16, color: Colors.grey.shade400),
                      if (parentKey != null) const SizedBox(width: 8),

                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  name,
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: isParent ? FontWeight.bold : FontWeight.w600,
                                    color: isDisabledByParent ? Colors.grey.shade400 : Colors.black87,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade100,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    cat,
                                    style: TextStyle(fontSize: 10, color: Colors.grey.shade700),
                                  ),
                                ),
                              ],
                            ),
                            if (desc.isNotEmpty) ...[
                              const SizedBox(height: 3),
                              Text(
                                desc,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: isDisabledByParent ? Colors.grey.shade400 : Colors.grey.shade600,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),

                      Switch(
                        value: isEnabled && !isDisabledByParent,
                        activeColor: AppColors.kPrimary,
                        onChanged: isDisabledByParent
                            ? null
                            : (val) => _toggleFeature(branchId, key, val),
                      ),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  Future<void> _toggleFeature(int branchId, String featureKey, bool isEnabled) async {
    try {
      final dio = Dio();
      final response = await dio.put(
        '${AppConfig.apiUrl}/branch-features/toggle',
        data: {
          'branch_id': branchId,
          'feature_key': featureKey,
          'is_enabled': isEnabled,
        },
      );

      if (response.data['success'] == true) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(
            content: Text('Updated $featureKey setting for branch $branchId'),
            backgroundColor: AppColors.kSuccess,
          ),
        );
        ref.invalidate(toggleSettingsProvider);
      }
    } catch (e) {
      AppNotifier.showSnackBar(
        context,
        SnackBar(
          content: Text('Failed to update toggle: $e'),
          backgroundColor: AppColors.kError,
        ),
      );
    }
  }

  void _showAuditHistoryDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Row(
          children: [
            Icon(PhosphorIcons.clockCounterClockwise(), color: AppColors.kPrimary),
            const SizedBox(width: 8),
            const Text('Feature Toggle Audit History'),
          ],
        ),
        content: const SizedBox(
          width: 500,
          child: Text(
            'All feature toggle changes are logged with timestamp, user role, branch ID, previous state, and new state in audit_logs.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
}
