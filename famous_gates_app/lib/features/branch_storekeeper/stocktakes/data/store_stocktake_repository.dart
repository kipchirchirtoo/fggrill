import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/branch_storekeeper_repository.dart';
import '../../shared/models/stocktake_session.dart';

final storeStocktakeRepositoryProvider =
    Provider<StoreStocktakeRepository>((ref) {
  return StoreStocktakeRepository(ref.read(branchStorekeeperRepositoryProvider));
});

class StoreStocktakeRepository {
  StoreStocktakeRepository(this._legacy);

  final BranchStorekeeperRepository _legacy;

  Future<Map<String, dynamic>> barStocktakeRecords({
    String? barLocation,
    String? date,
  }) {
    return _legacy.barStocktakeRecords(barLocation: barLocation, date: date);
  }

  Future<List<Map<String, dynamic>>> posOutlets({
    String? outletType,
  }) {
    return _legacy.posOutlets(outletType: outletType);
  }

  Future<Map<String, dynamic>> kitchenStocktake({
    required String date,
    required String shift,
  }) {
    return _legacy.kitchenStocktake(date: date, shift: shift);
  }

  Future<Map<String, dynamic>> saveKitchenStocktake({
    required String date,
    required String shift,
    required List<Map<String, dynamic>> items,
    String? dispenserName,
    List<String>? chepsOnDuty,
    String? confirmationName,
    bool submit = false,
  }) {
    return _legacy.saveKitchenStocktake(
      date: date,
      shift: shift,
      items: items,
      dispenserName: dispenserName,
      chepsOnDuty: chepsOnDuty,
      confirmationName: confirmationName,
      submit: submit,
    );
  }

  Future<Map<String, dynamic>> storeStocktakeRecords({String? status, String? date}) {
    return _legacy.storeStocktakeRecords(status: status, date: date);
  }

  Future<Map<String, dynamic>> submitBarStocktake({
    required String barLocation,
    required List<Map<String, dynamic>> items,
    String? stocktakeDate,
    String? shiftId,
  }) {
    return _legacy.submitBarStocktake(
      barLocation: barLocation,
      items: items,
      stocktakeDate: stocktakeDate,
      shiftId: shiftId,
    );
  }

  Future<Map<String, dynamic>> submitStoreStocktake({
    required List<Map<String, dynamic>> items,
    String? stocktakeDate,
    String? shiftId,
  }) {
    return _legacy.submitStoreStocktake(
      items: items,
      stocktakeDate: stocktakeDate,
      shiftId: shiftId,
    );
  }

  StocktakeSession toSession(Map<String, dynamic> map) =>
      StocktakeSession.fromMap(map);
}
