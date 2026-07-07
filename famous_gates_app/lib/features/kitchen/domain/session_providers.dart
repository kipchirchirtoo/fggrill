import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';
import 'session_models.dart';

final activeKitchenShiftProvider =
    StateNotifierProvider<ActiveShiftNotifier, AsyncValue<KitchenShift?>>((ref) {
  return ActiveShiftNotifier(ref.read(kitchenRepositoryProvider));
});

class ActiveShiftNotifier extends StateNotifier<AsyncValue<KitchenShift?>> {
  final KitchenRepository _repo;

  ActiveShiftNotifier(this._repo) : super(const AsyncValue.loading()) {
    refresh();
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    try {
      final active = await _repo.getActiveShift();
      state = AsyncValue.data(active);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<KitchenShift> openShift({
    required String shiftType,
    required List<String> assignedChefIds,
    String? subShiftType,
    String? department,
  }) async {
    final shift = await _repo.openShift(
      shiftType: shiftType,
      assignedChefIds: assignedChefIds,
      subShiftType: subShiftType,
      department: department,
    );
    state = AsyncValue.data(shift);
    return shift;
  }

  void clearActiveShift() {
    state = const AsyncValue.data(null);
  }
}

final shiftConfigProvider = FutureProvider.autoDispose<KitchenShiftConfig>((ref) async {
  final repo = ref.read(kitchenRepositoryProvider);
  return repo.getActiveShiftConfig();
});

final recipesListProvider = FutureProvider.autoDispose<List<KitchenProductionRecipe>>((ref) async {
  final repo = ref.read(kitchenRepositoryProvider);
  return repo.getRecipesList();
});

final shiftAdditionsProvider =
    FutureProvider.family.autoDispose<List<KitchenShiftAddition>, String>((ref, shiftId) async {
  final repo = ref.read(kitchenRepositoryProvider);
  return repo.getShiftAdditions(shiftId);
});

final shiftDetailsProvider =
    FutureProvider.family.autoDispose<Map<String, dynamic>, String>((ref, shiftId) async {
  final repo = ref.read(kitchenRepositoryProvider);
  return repo.getShiftDetails(shiftId);
});

final staffProfilesProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.read(kitchenRepositoryProvider);
  return repo.getStaffProfiles();
});
