import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/repository.dart';
import '../models/shift_reconciliation_model.dart';

class ShiftReconciliationState {
  final AsyncValue<ShiftReconciliationModel> shiftData;
  final double actualCash;
  final String varianceReason;
  final String varianceExplanation;
  final String reconciliationNotes;
  final bool isSaving;
  final bool isSubmitting;
  final String? errorMessage;

  ShiftReconciliationState({
    required this.shiftData,
    required this.actualCash,
    required this.varianceReason,
    required this.varianceExplanation,
    required this.reconciliationNotes,
    this.isSaving = false,
    this.isSubmitting = false,
    this.errorMessage,
  });

  ShiftReconciliationState copyWith({
    AsyncValue<ShiftReconciliationModel>? shiftData,
    double? actualCash,
    String? varianceReason,
    String? varianceExplanation,
    String? reconciliationNotes,
    bool? isSaving,
    bool? isSubmitting,
    String? errorMessage,
  }) {
    return ShiftReconciliationState(
      shiftData: shiftData ?? this.shiftData,
      actualCash: actualCash ?? this.actualCash,
      varianceReason: varianceReason ?? this.varianceReason,
      varianceExplanation: varianceExplanation ?? this.varianceExplanation,
      reconciliationNotes: reconciliationNotes ?? this.reconciliationNotes,
      isSaving: isSaving ?? this.isSaving,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}

class ShiftReconciliationNotifier extends StateNotifier<ShiftReconciliationState> {
  final BranchAccountantRepository _repository;
  final String _shiftId;
  Timer? _autoSaveTimer;

  ShiftReconciliationNotifier(this._repository, this._shiftId)
      : super(ShiftReconciliationState(
          shiftData: const AsyncValue.loading(),
          actualCash: 0,
          varianceReason: 'Counting Error',
          varianceExplanation: '',
          reconciliationNotes: '',
        )) {
    load();
    _startAutoSaveTimer();
  }

  @override
  void dispose() {
    _autoSaveTimer?.cancel();
    super.dispose();
  }

  Future<void> load() async {
    state = state.copyWith(shiftData: const AsyncValue.loading());
    try {
      final logData = await _repository.getShiftLog(_shiftId);
      Map<String, dynamic> reconData = {};
      try {
        reconData = await _repository.getShiftReconciliation(_shiftId);
      } catch (_) {
        // If clearances reconciliation fails/empty, continue with shift log only
      }

      final model = ShiftReconciliationModel.fromJson({
        ...logData,
        'shift_reconciliation_details': reconData,
      });

      // Try to read actual cash from saved collections
      double prefilledActual = model.closingFloat;
      if (reconData.isNotEmpty && reconData['actual_collections'] != null) {
        final collections = reconData['actual_collections'] as List;
        final cashRecon = collections.firstWhere(
          (c) => c['payment_method'] == 'cash',
          orElse: () => null,
        );
        if (cashRecon != null) {
          prefilledActual = (cashRecon['actual_amount'] ?? 0).toDouble();
        }
      }

      state = state.copyWith(
        shiftData: AsyncValue.data(model),
        actualCash: prefilledActual,
        reconciliationNotes: model.reconciliationNotes ?? '',
      );
    } catch (e, stack) {
      state = state.copyWith(shiftData: AsyncValue.error(e, stack));
    }
  }

  void updateActualCash(double amount) {
    state = state.copyWith(actualCash: amount);
  }

  void updateVarianceReason(String reason) {
    state = state.copyWith(varianceReason: reason);
  }

  void updateVarianceExplanation(String explanation) {
    state = state.copyWith(varianceExplanation: explanation);
  }

  void updateReconciliationNotes(String notes) {
    state = state.copyWith(reconciliationNotes: notes);
  }

  void _startAutoSaveTimer() {
    _autoSaveTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      saveDraft();
    });
  }

  Future<void> saveDraft() async {
    if (state.isSaving || state.shiftData.valueOrNull == null) return;
    state = state.copyWith(isSaving: true);
    try {
      final model = state.shiftData.value!;
      // Silently save cash collections on backend if they are updated
      await _repository.addShiftActualCollection(
        _shiftId,
        paymentMethod: 'cash',
        systemAmount: model.expectedClosingFloat,
        actualAmount: state.actualCash,
      );
      state = state.copyWith(isSaving: false, errorMessage: null);
    } catch (e) {
      state = state.copyWith(isSaving: false);
    }
  }

  Future<bool> submitReconciliation() async {
    state = state.copyWith(isSubmitting: true, errorMessage: null);
    try {
      final model = state.shiftData.valueOrNull;
      if (model == null) throw Exception('No shift data loaded');

      final expected = model.expectedClosingFloat;
      final actual = state.actualCash;
      final variance = actual - expected;

      // Validation
      if (variance != 0) {
        if (state.varianceExplanation.trim().length < 30) {
          throw Exception('Variance explanation must be at least 30 characters.');
        }
      }

      // Save collections
      await _repository.addShiftActualCollection(
        _shiftId,
        paymentMethod: 'cash',
        systemAmount: expected,
        actualAmount: actual,
      );

      // Reconcile shift log
      final fullNotes = variance != 0
          ? 'Variance Explanation: [${state.varianceReason}] ${state.varianceExplanation.trim()}'
          : 'Reconciliation balanced.';

      await _repository.reconcileShift(_shiftId, fullNotes);
      state = state.copyWith(isSubmitting: false);
      return true;
    } catch (e) {
      state = state.copyWith(isSubmitting: false, errorMessage: e.toString());
      return false;
    }
  }

  Future<bool> approveReconciliation() async {
    state = state.copyWith(isSubmitting: true, errorMessage: null);
    try {
      await _repository.approveClearance(_shiftId, notes: state.reconciliationNotes.trim());
      state = state.copyWith(isSubmitting: false);
      return true;
    } catch (e) {
      state = state.copyWith(isSubmitting: false, errorMessage: e.toString());
      return false;
    }
  }

  Future<bool> rejectReconciliation(String reason) async {
    state = state.copyWith(isSubmitting: true, errorMessage: null);
    try {
      await _repository.flagClearance(
        _shiftId,
        reason: reason,
        notes: state.reconciliationNotes.trim(),
      );
      state = state.copyWith(isSubmitting: false);
      return true;
    } catch (e) {
      state = state.copyWith(isSubmitting: false, errorMessage: e.toString());
      return false;
    }
  }
}

final shiftReconciliationProvider = StateNotifierProvider.family<
    ShiftReconciliationNotifier, ShiftReconciliationState, String>((ref, shiftId) {
  final repo = ref.watch(branchAccountantRepositoryProvider);
  return ShiftReconciliationNotifier(repo, shiftId);
});
