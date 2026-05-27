import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../../core/database/app_database.dart';
import '../domain/models.dart';

final heldOrdersRepositoryProvider = Provider<HeldOrdersRepository>((ref) {
  return HeldOrdersRepository(ref.read(appDatabaseProvider).heldOrdersDao);
});

class HeldOrdersRepository {
  HeldOrdersRepository(this._dao);

  final HeldOrdersDao _dao;
  final _uuid = const Uuid();

  Future<void> holdOrder(String label, List<CartItem> items, double subtotal) {
    return _dao.insertOrder(
      HeldOrderEntry(
        id: _uuid.v4(),
        label: label,
        itemsJson: jsonEncode(items.map((item) => item.toJson()).toList()),
        subtotal: subtotal,
        createdAt: DateTime.now().millisecondsSinceEpoch,
      ),
    );
  }

  Future<List<HeldOrder>> getHeldOrders() async {
    final rows = await _dao.getAll();
    return rows.map((row) {
      final rawItems = jsonDecode(row.itemsJson) as List;
      return HeldOrder(
        id: row.id,
        label: row.label,
        items: rawItems
            .whereType<Map>()
            .map((json) => CartItem.fromJson(Map<String, dynamic>.from(json)))
            .toList(),
        subtotal: row.subtotal,
        createdAt: DateTime.fromMillisecondsSinceEpoch(row.createdAt),
      );
    }).toList();
  }

  Future<void> deleteHeldOrder(String id) async {
    await _dao.deleteById(id);
  }
}
