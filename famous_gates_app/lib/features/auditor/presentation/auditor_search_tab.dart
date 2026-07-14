import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../../admin/domain/admin_providers.dart';
import '../data/repository.dart';

class AuditorSearchSection extends ConsumerStatefulWidget {
  const AuditorSearchSection({super.key});

  @override
  ConsumerState<AuditorSearchSection> createState() => _AuditorSearchSectionState();
}

class _AuditorSearchSectionState extends ConsumerState<AuditorSearchSection> {
  final _ctrl = TextEditingController();
  bool _loading = false;
  List<Map<String, dynamic>> _results = [];
  String? _error;
  bool _hasSearched = false;

  Future<void> _performSearch() async {
    final query = _ctrl.text.trim();
    if (query.length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter at least 2 characters to search.')),
      );
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
      _hasSearched = true;
    });

    try {
      final repo = ref.read(auditorRepositoryProvider);
      final branchId = ref.read(adminSelectedBranchProvider);
      final data = await repo.globalSearch(query, branchId: branchId);
      setState(() {
        _results = data;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(adminSelectedBranchProvider, (previous, next) {
      if (_hasSearched && _ctrl.text.trim().isNotEmpty) {
        _performSearch();
      }
    });

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _header('Universal Auditor Search', PhosphorIcons.magnifyingGlass(),
            subtitle: 'Real-time cross-entity audit intelligence & database search'),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Card(
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                    side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.55)),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _ctrl,
                                onSubmitted: (_) => _performSearch(),
                                decoration: InputDecoration(
                                  hintText: 'Search by confirmation #, bill #, customer name, employee ID, payment reference...',
                                  prefixIcon: Icon(PhosphorIcons.magnifyingGlass(), size: 20),
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            const _AuditBranchSelector(),
                            const SizedBox(width: 12),
                            FilledButton.icon(
                              onPressed: _performSearch,
                              icon: Icon(PhosphorIcons.magnifyingGlass(), size: 18),
                              label: const Text('Run Search'),
                              style: FilledButton.styleFrom(
                                backgroundColor: AppColors.kWarning,
                                foregroundColor: Colors.white,
                                minimumSize: const Size(150, 52),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(
                            color: AppColors.kSurface,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.kDivider.withValues(alpha: 0.45)),
                          ),
                          child: const Text(
                            'SEARCH DOMAINS: OPERATIONS, FINANCE, HUMAN RESOURCES, GUEST RELATIONS, INVENTORY',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: AppColors.kTextSecondary,
                              letterSpacing: 0.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                Expanded(
                  child: _buildContent(),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildContent() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(PhosphorIcons.warningCircle(), size: 48, color: AppColors.kError),
            const SizedBox(height: 16),
            Text('Search Error: $_error', style: const TextStyle(color: AppColors.kError)),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _performSearch, child: const Text('Retry')),
          ],
        ),
      );
    }

    if (!_hasSearched) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                color: AppColors.kSurface,
                borderRadius: BorderRadius.circular(34),
                border: Border.all(color: AppColors.kDivider),
              ),
              child: Icon(PhosphorIcons.magnifyingGlass(),
                  size: 42, color: AppColors.kTextSecondary.withValues(alpha: 0.28)),
            ),
            const SizedBox(height: 22),
            const Text('Centralized Intelligence',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            const SizedBox(
              width: 460,
              child: Text(
                'Perform a global cross-reference search across all operational nodes and financial records.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.kTextSecondary, fontWeight: FontWeight.w500),
              ),
            ),
          ],
        ),
      );
    }

    if (_results.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(PhosphorIcons.magnifyingGlass(), size: 48, color: AppColors.kTextSecondary),
            const SizedBox(height: 16),
            const Text('No records found matching your query.',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
      );
    }

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.55)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Match Summary (${_results.length})',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: ListView.separated(
                itemCount: _results.length,
                separatorBuilder: (context, index) => const Divider(),
                itemBuilder: (context, index) {
                  final item = _results[index];
                  final type = item['type'] ?? 'unknown';
                  final displayName = item['display_name'] ?? '—';
                  final subtitle = item['subtitle'] ?? '—';

                  IconData typeIcon = PhosphorIcons.database();
                  Color iconColor = AppColors.kPrimary;

                  if (type.contains('order')) {
                    typeIcon = PhosphorIcons.shoppingCart();
                    iconColor = Colors.blue;
                  } else if (type.contains('booking')) {
                    typeIcon = PhosphorIcons.calendar();
                    iconColor = Colors.green;
                  } else if (type.contains('payment')) {
                    typeIcon = PhosphorIcons.creditCard();
                    iconColor = Colors.amber;
                  } else if (type.contains('user') || type.contains('staff')) {
                    typeIcon = PhosphorIcons.users();
                    iconColor = Colors.purple;
                  } else if (type.contains('stock') || type.contains('item')) {
                    typeIcon = PhosphorIcons.package();
                    iconColor = Colors.orange;
                  } else if (type.contains('bill') || type.contains('invoice')) {
                    typeIcon = PhosphorIcons.receipt();
                    iconColor = Colors.teal;
                  }

                  return ListTile(
                    leading: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: iconColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(typeIcon, color: iconColor),
                    ),
                    title: Text(
                      displayName,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    subtitle: Text(
                      subtitle,
                      style: const TextStyle(color: AppColors.kTextSecondary, fontSize: 12),
                    ),
                    trailing: Text(
                      type.toString().toUpperCase(),
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                        color: AppColors.kTextSecondary,
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

  Widget _header(String title, IconData icon, {String? subtitle}) {
    return Container(
      padding: const EdgeInsets.fromLTRB(28, 28, 28, 10),
      color: Colors.white,
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: const Color(0xFF1D1917),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: 14,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Icon(icon, color: Colors.white, size: 24),
          ),
          const SizedBox(width: 18),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF1D1917)),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.kTextSecondary),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AuditBranchSelector extends ConsumerWidget {
  const _AuditBranchSelector();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedId = ref.watch(adminSelectedBranchProvider);
    final branchesAsync = ref.watch(adminBranchesProvider);
    return branchesAsync.when(
      data: (branches) {
        var selectedName = 'All Branches';
        for (final branch in branches) {
          if (branch.id == selectedId) {
            selectedName = branch.name;
            break;
          }
        }
        return PopupMenuButton<String?>(
          tooltip: 'Filter by branch',
          initialValue: selectedId,
          onSelected: (value) => ref.read(adminSelectedBranchProvider.notifier).state = value,
          itemBuilder: (context) => [
            const PopupMenuItem<String?>(
              value: null,
              child: Text('All Branches'),
            ),
            for (final branch in branches)
              PopupMenuItem<String?>(
                value: branch.id,
                child: Text(branch.name),
              ),
          ],
          child: Container(
            height: 52,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.kDivider),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Branch:',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(width: 10),
                Icon(PhosphorIcons.buildings(), color: AppColors.kPrimary, size: 16),
                const SizedBox(width: 8),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 180),
                  child: Text(
                    selectedName,
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                    style: const TextStyle(
                      color: AppColors.kPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Icon(PhosphorIcons.caretDown(), size: 14),
              ],
            ),
          ),
        );
      },
      loading: () => Container(
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.kSurface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.kDivider),
        ),
        child: const Text(
          'Loading branches...',
          style: TextStyle(color: AppColors.kTextSecondary),
        ),
      ),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}
