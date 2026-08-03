import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/branch_storekeeper_repository.dart';
import '../../shared/models/inventory_balance_view.dart';

final storeInventoryRepositoryProvider =
    Provider<StoreInventoryRepository>((ref) {
  return StoreInventoryRepository(ref.read(branchStorekeeperRepositoryProvider));
});

class StoreInventoryRepository {
  StoreInventoryRepository(this._legacy);

  final BranchStorekeeperRepository _legacy;

  Future<List<InventoryBalanceView>> branchInventory({
    String? search,
    String? category,
  }) async {
    final rows = await _legacy.branchStock(search: search, category: category);
    return rows.map(InventoryBalanceView.fromMap).toList();
  }
}
