import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/branch_storekeeper_repository.dart';

final storeExceptionRepositoryProvider =
    Provider<StoreExceptionRepository>((ref) {
  return StoreExceptionRepository(ref.read(branchStorekeeperRepositoryProvider));
});

class StoreExceptionRepository {
  StoreExceptionRepository(this._legacy);

  final BranchStorekeeperRepository _legacy;

  Future<List<Map<String, dynamic>>> branchStaff() => _legacy.branchStaff();

  Future<int?> currentBranchId() => _legacy.currentBranchId();

  Future<List<Map<String, dynamic>>> spoilageCandidates(String area) =>
      _legacy.spoilageCandidates(area);

  Future<Map<String, dynamic>> recordBranchSpoilage({
    required String area,
    required String itemId,
    required num quantity,
    required String reason,
    String? unit,
    String? notes,
    String? barLocation,
    String? shift,
    String? kitchenShiftId,
    String? spoilageDate,
    String? responsibleStaffId,
    bool chargeToStaff = false,
  }) {
    return _legacy.recordBranchSpoilage(
      area: area,
      itemId: itemId,
      quantity: quantity,
      reason: reason,
      unit: unit,
      notes: notes,
      barLocation: barLocation,
      shift: shift,
      kitchenShiftId: kitchenShiftId,
      spoilageDate: spoilageDate,
      responsibleStaffId: responsibleStaffId,
      chargeToStaff: chargeToStaff,
    );
  }
}
