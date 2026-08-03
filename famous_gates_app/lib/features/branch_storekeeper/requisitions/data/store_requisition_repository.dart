import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/branch_storekeeper_repository.dart';

final storeRequisitionRepositoryProvider =
    Provider<StoreRequisitionRepository>((ref) {
  return StoreRequisitionRepository(
    ref.read(branchStorekeeperRepositoryProvider),
  );
});

class StoreRequisitionRepository {
  StoreRequisitionRepository(this._legacy);

  final BranchStorekeeperRepository _legacy;

  Future<void> createStockRequest(Map<String, dynamic> data) {
    return _legacy.createStockRequest(data);
  }

  Future<List<Map<String, dynamic>>> masterCatalog({int limit = 500}) {
    return _legacy.masterCatalog(limit: limit);
  }

  Future<List<Map<String, dynamic>>> stockRequests({String? status}) {
    return _legacy.stockRequests(status: status);
  }
}
