import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/branch_storekeeper_repository.dart';
import '../../shared/models/posting_result.dart';

final storeReceivingRepositoryProvider =
    Provider<StoreReceivingRepository>((ref) {
  return StoreReceivingRepository(ref.read(branchStorekeeperRepositoryProvider));
});

class StoreReceivingRepository {
  StoreReceivingRepository(this._legacy);

  final BranchStorekeeperRepository _legacy;

  Future<PostingResult> receiveFromSupplier(Map<String, dynamic> data) async {
    final response = await _legacy.receiveFromSupplier(data);
    return PostingResult.fromMap(Map<String, dynamic>.from(response));
  }
}
