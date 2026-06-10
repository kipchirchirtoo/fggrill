import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';
import '../data/menu_pricing_repository.dart';

final menuPricingRepositoryProvider = Provider<MenuPricingRepository>((ref) {
  return MenuPricingRepository(ref.read(dioProvider));
});

/// (branchId, type) where type is 'restaurant' | 'bar' | null (all).
typedef BranchPricingArgs = ({int branchId, String? type});

final branchPricingProvider = FutureProvider.autoDispose
    .family<BranchPricingResult, BranchPricingArgs>((ref, args) async {
  return ref
      .read(menuPricingRepositoryProvider)
      .getBranchPricing(args.branchId, type: args.type);
});
