import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/branch_health_repository.dart';
import 'branch_health_models.dart';

/// Loads the (server-cached) health check on first watch; `forceRefresh()`
/// triggers a fresh run via the rate-limited refresh endpoint.
///
/// Family key = branch id; `null` means the signed-in user's own branch.
/// Central roles (superadmin, director, GM) pass explicit branch ids.
final branchHealthProvider = AsyncNotifierProvider.family<BranchHealthNotifier,
    BranchHealthResult, int?>(BranchHealthNotifier.new);

class BranchHealthNotifier extends FamilyAsyncNotifier<BranchHealthResult, int?> {
  @override
  Future<BranchHealthResult> build(int? arg) {
    return ref
        .read(branchHealthRepositoryProvider)
        .fetchHealthCheck(branchId: arg);
  }

  Future<void> forceRefresh() async {
    state = const AsyncLoading<BranchHealthResult>().copyWithPrevious(state);
    state = await AsyncValue.guard(() => ref
        .read(branchHealthRepositoryProvider)
        .refreshHealthCheck(branchId: arg));
  }
}

/// All-branch deterministic overview, worst score first (central roles only).
final fleetHealthProvider =
    FutureProvider.autoDispose<List<FleetBranchHealth>>((ref) {
  return ref.read(branchHealthRepositoryProvider).fetchFleetHealth();
});
