import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/branch_storekeeper_repository.dart';

final storeTransferRepositoryProvider =
    Provider<StoreTransferRepository>((ref) {
  return StoreTransferRepository(ref.read(branchStorekeeperRepositoryProvider));
});

class StoreTransferRepository {
  StoreTransferRepository(this._legacy);

  final BranchStorekeeperRepository _legacy;

  Future<List<Map<String, dynamic>>> incomingTransfers() =>
      _legacy.getIncomingTransfers();

  Future<List<Map<String, dynamic>>> outgoingTransfers() =>
      _legacy.getOutgoingTransfers();
}
