import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/branch_storekeeper_repository.dart';

final storeOverviewRepositoryProvider =
    Provider<StoreOverviewRepository>((ref) {
  return StoreOverviewRepository(ref.read(branchStorekeeperRepositoryProvider));
});

class StoreOverviewRepository {
  StoreOverviewRepository(this._legacy);

  final BranchStorekeeperRepository _legacy;

  Future<Map<String, dynamic>> dashboard() => _legacy.dashboard();
}
