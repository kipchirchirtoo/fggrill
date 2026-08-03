import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/branch_storekeeper_repository.dart';

final storeReportsRepositoryProvider = Provider<StoreReportsRepository>((ref) {
  return StoreReportsRepository(ref.read(branchStorekeeperRepositoryProvider));
});

class StoreReportsRepository {
  StoreReportsRepository(this._legacy);

  final BranchStorekeeperRepository _legacy;

  Future<Map<String, dynamic>> inventoryAnalytics({
    String? startDate,
    String? endDate,
  }) =>
      _legacy.enterpriseInventoryAnalytics(
        startDate: startDate,
        endDate: endDate,
      );
}
