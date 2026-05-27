import 'dart:io';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

part 'app_database.g.dart';

final appDatabaseProvider = Provider<AppDatabase>((ref) {
  final database = AppDatabase();
  ref.onDispose(database.close);
  return database;
});

@DriftDatabase(
  tables: [
    ProductsCache,
    OfflineSales,
    HeldOrders,
    CachedNotifications,
  ],
  daos: [
    ProductsCacheDao,
    OfflineSalesDao,
    HeldOrdersDao,
    NotificationsDao,
  ],
)
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 1;
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dbFolder = await getApplicationDocumentsDirectory();
    final file = File(p.join(dbFolder.path, 'famous_gates.sqlite'));
    return NativeDatabase.createInBackground(file);
  });
}

@DataClassName('ProductCacheEntry')
class ProductsCache extends Table {
  TextColumn get id => text()();
  TextColumn get name => text()();
  TextColumn get category => text()();
  RealColumn get price => real()();
  TextColumn get unit => text().nullable()();
  BoolColumn get isActive => boolean().withDefault(const Constant(true))();
  IntColumn get lastSynced => integer()();

  @override
  Set<Column> get primaryKey => {id};
}

@DataClassName('OfflineSaleEntry')
class OfflineSales extends Table {
  TextColumn get localId => text()();
  TextColumn get branchId => text()();
  TextColumn get cashierId => text()();
  TextColumn get itemsJson => text()();
  RealColumn get subtotal => real()();
  RealColumn get vatAmount => real()();
  RealColumn get total => real()();
  TextColumn get paymentMethod => text()();
  TextColumn get mpesaRef => text().nullable()();
  TextColumn get roomNumber => text().nullable()();
  IntColumn get createdAt => integer()();
  TextColumn get syncStatus => text().withDefault(const Constant('pending'))();

  @override
  Set<Column> get primaryKey => {localId};
}

@DataClassName('HeldOrderEntry')
class HeldOrders extends Table {
  TextColumn get id => text()();
  TextColumn get label => text().nullable()();
  TextColumn get itemsJson => text()();
  RealColumn get subtotal => real()();
  IntColumn get createdAt => integer()();

  @override
  Set<Column> get primaryKey => {id};
}

@DataClassName('CachedNotificationEntry')
class CachedNotifications extends Table {
  TextColumn get id => text()();
  TextColumn get title => text()();
  TextColumn get body => text()();
  TextColumn get type => text()();
  BoolColumn get isRead => boolean().withDefault(const Constant(false))();
  IntColumn get createdAt => integer()();

  @override
  Set<Column> get primaryKey => {id};
}

@DriftAccessor(tables: [ProductsCache])
class ProductsCacheDao extends DatabaseAccessor<AppDatabase>
    with _$ProductsCacheDaoMixin {
  ProductsCacheDao(super.db);

  Future<void> upsert(ProductCacheEntry entry) {
    return into(productsCache).insertOnConflictUpdate(entry);
  }

  Future<void> upsertAll(List<ProductCacheEntry> entries) async {
    await batch((batch) {
      batch.insertAllOnConflictUpdate(productsCache, entries);
    });
  }

  Future<List<ProductCacheEntry>> getAll() {
    return (select(productsCache)
          ..where((table) => table.isActive.equals(true)))
        .get();
  }

  Future<List<ProductCacheEntry>> getByCategory(String category) {
    return (select(productsCache)
          ..where((table) =>
              table.isActive.equals(true) & table.category.equals(category)))
        .get();
  }

  Future<List<ProductCacheEntry>> search(String query) {
    final pattern = '%${query.trim()}%';
    return (select(productsCache)
          ..where((table) =>
              table.isActive.equals(true) & table.name.like(pattern)))
        .get();
  }

  Future<int> deleteOlderThan(int timestampMs) {
    return (delete(productsCache)
          ..where((table) => table.lastSynced.isSmallerThanValue(timestampMs)))
        .go();
  }
}

@DriftAccessor(tables: [OfflineSales])
class OfflineSalesDao extends DatabaseAccessor<AppDatabase>
    with _$OfflineSalesDaoMixin {
  OfflineSalesDao(super.db);

  Future<void> insertSale(OfflineSaleEntry sale) {
    return into(offlineSales).insertOnConflictUpdate(sale);
  }

  Future<List<OfflineSaleEntry>> getPending() {
    return (select(offlineSales)
          ..where((table) => table.syncStatus.equals('pending')))
        .get();
  }

  Stream<int> watchPendingCount() {
    final query = selectOnly(offlineSales)
      ..addColumns([offlineSales.localId.count()])
      ..where(offlineSales.syncStatus.equals('pending'));
    return query
        .watchSingle()
        .map((row) => row.read(offlineSales.localId.count()) ?? 0);
  }

  Future<void> markSynced(List<String> ids) async {
    if (ids.isEmpty) return;
    await (update(offlineSales)..where((table) => table.localId.isIn(ids)))
        .write(const OfflineSalesCompanion(syncStatus: Value('synced')));
  }

  Future<void> markFailed(List<String> ids) async {
    if (ids.isEmpty) return;
    await (update(offlineSales)..where((table) => table.localId.isIn(ids)))
        .write(const OfflineSalesCompanion(syncStatus: Value('failed')));
  }

  Future<int> deleteByIds(List<String> ids) {
    if (ids.isEmpty) return Future.value(0);
    return (delete(offlineSales)..where((table) => table.localId.isIn(ids)))
        .go();
  }
}

@DriftAccessor(tables: [HeldOrders])
class HeldOrdersDao extends DatabaseAccessor<AppDatabase>
    with _$HeldOrdersDaoMixin {
  HeldOrdersDao(super.db);

  Future<void> insertOrder(HeldOrderEntry order) {
    return into(heldOrders).insertOnConflictUpdate(order);
  }

  Future<List<HeldOrderEntry>> getAll() {
    return (select(heldOrders)
          ..orderBy([(table) => OrderingTerm.desc(table.createdAt)]))
        .get();
  }

  Future<int> deleteById(String id) {
    return (delete(heldOrders)..where((table) => table.id.equals(id))).go();
  }
}

@DriftAccessor(tables: [CachedNotifications])
class NotificationsDao extends DatabaseAccessor<AppDatabase>
    with _$NotificationsDaoMixin {
  NotificationsDao(super.db);

  Future<void> insertNotification(CachedNotificationEntry notification) {
    return into(cachedNotifications).insertOnConflictUpdate(notification);
  }

  Future<List<CachedNotificationEntry>> getUnread() {
    return (select(cachedNotifications)
          ..where((table) => table.isRead.equals(false))
          ..orderBy([(table) => OrderingTerm.desc(table.createdAt)]))
        .get();
  }

  Future<void> markRead(String id) {
    return (update(cachedNotifications)..where((table) => table.id.equals(id)))
        .write(const CachedNotificationsCompanion(isRead: Value(true)));
  }

  Future<int> deleteNotification(String id) {
    return (delete(cachedNotifications)..where((table) => table.id.equals(id)))
        .go();
  }
}
