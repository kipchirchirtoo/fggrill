import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/powersync/powersync_service.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../domain/models.dart';

final productRepositoryProvider = Provider<ProductRepository>((ref) {
  return ProductRepository(ref);
});

class ProductRepository {
  ProductRepository(this._ref);

  final Ref _ref;

  Future<List<Product>> getProducts({String? category}) async {
    final powerSync = _ref.read(powerSyncServiceProvider);
    final storage = _ref.read(secureStorageProvider);
    final branchIdStr = await storage.read(key: AuthRepository.branchIdKey);
    final branchId = int.tryParse(branchIdStr ?? '');

    var query =
        'SELECT id, name, category, selling_price AS price, unit, is_active FROM pos_outlet_items WHERE is_active = 1';
    final args = <Object?>[];

    if (branchId != null) {
      query += ' AND branch_id = ?';
      args.add(branchId);
    }

    if (category != null && category.isNotEmpty) {
      query += ' AND category = ?';
      args.add(category);
    }

    query += ' ORDER BY name ASC';

    try {
      final rows = await powerSync.getAll(query, args);
      return rows.map((row) => Product.fromJson(row)).toList();
    } catch (_) {
      return [];
    }
  }

  /// Live reactive stream of products — updates whenever PowerSync syncs
  /// new items from Supabase. Use this in StreamProvider for zero-latency UI.
  Stream<List<Product>> watchProducts({String? category}) async* {
    final powerSync = _ref.read(powerSyncServiceProvider);
    final storage = _ref.read(secureStorageProvider);
    final branchIdStr = await storage.read(key: AuthRepository.branchIdKey);
    final branchId = int.tryParse(branchIdStr ?? '');

    var query =
        'SELECT id, name, category, selling_price AS price, unit, is_active FROM pos_outlet_items WHERE is_active = 1';
    final args = <Object?>[];

    if (branchId != null) {
      query += ' AND branch_id = ?';
      args.add(branchId);
    }

    if (category != null && category.isNotEmpty) {
      query += ' AND category = ?';
      args.add(category);
    }

    query += ' ORDER BY name ASC';

    yield* powerSync.watchAll(query, args).map(
          (rows) => rows.map((row) => Product.fromJson(row)).toList(),
        );
  }
}
