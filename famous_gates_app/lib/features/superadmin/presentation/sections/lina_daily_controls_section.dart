import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../lina_daily_controls/presentation/daily_controls_lina_page.dart';
import '../../domain/superadmin_providers.dart';

/// Superadmin host for Daily Controls (Lina): loads the branch list, then
/// embeds the shared page in central mode (branch dropdown enabled).
class LinaDailyControlsSection extends ConsumerWidget {
  const LinaDailyControlsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final branchesAsync = ref.watch(allBranchesProvider);
    return branchesAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('Could not load branches: $e', textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => ref.invalidate(allBranchesProvider),
              child: const Text('Try again'),
            ),
          ],
        ),
      ),
      data: (data) {
        final branches = ((data['data'] as List<dynamic>?) ?? [])
            .whereType<Map>()
            .map((b) {
              final id = (b['id'] as num?)?.toInt();
              final name = '${b['name'] ?? ''}';
              return id == null ? null : (id, name);
            })
            .whereType<(int, String)>()
            .toList()
          ..sort((a, b) => a.$1.compareTo(b.$1));
        return DailyControlsLinaPage(
          allowBranchSelection: true,
          branches: branches,
        );
      },
    );
  }
}
