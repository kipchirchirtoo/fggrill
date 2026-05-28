// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $ProductsCacheTable extends ProductsCache
    with TableInfo<$ProductsCacheTable, ProductCacheEntry> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ProductsCacheTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
      'name', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _categoryMeta =
      const VerificationMeta('category');
  @override
  late final GeneratedColumn<String> category = GeneratedColumn<String>(
      'category', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _priceMeta = const VerificationMeta('price');
  @override
  late final GeneratedColumn<double> price = GeneratedColumn<double>(
      'price', aliasedName, false,
      type: DriftSqlType.double, requiredDuringInsert: true);
  static const VerificationMeta _unitMeta = const VerificationMeta('unit');
  @override
  late final GeneratedColumn<String> unit = GeneratedColumn<String>(
      'unit', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _isActiveMeta =
      const VerificationMeta('isActive');
  @override
  late final GeneratedColumn<bool> isActive = GeneratedColumn<bool>(
      'is_active', aliasedName, false,
      type: DriftSqlType.bool,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('CHECK ("is_active" IN (0, 1))'),
      defaultValue: const Constant(true));
  static const VerificationMeta _lastSyncedMeta =
      const VerificationMeta('lastSynced');
  @override
  late final GeneratedColumn<int> lastSynced = GeneratedColumn<int>(
      'last_synced', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns =>
      [id, name, category, price, unit, isActive, lastSynced];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'products_cache';
  @override
  VerificationContext validateIntegrity(Insertable<ProductCacheEntry> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
          _nameMeta, name.isAcceptableOrUnknown(data['name']!, _nameMeta));
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('category')) {
      context.handle(_categoryMeta,
          category.isAcceptableOrUnknown(data['category']!, _categoryMeta));
    } else if (isInserting) {
      context.missing(_categoryMeta);
    }
    if (data.containsKey('price')) {
      context.handle(
          _priceMeta, price.isAcceptableOrUnknown(data['price']!, _priceMeta));
    } else if (isInserting) {
      context.missing(_priceMeta);
    }
    if (data.containsKey('unit')) {
      context.handle(
          _unitMeta, unit.isAcceptableOrUnknown(data['unit']!, _unitMeta));
    }
    if (data.containsKey('is_active')) {
      context.handle(_isActiveMeta,
          isActive.isAcceptableOrUnknown(data['is_active']!, _isActiveMeta));
    }
    if (data.containsKey('last_synced')) {
      context.handle(
          _lastSyncedMeta,
          lastSynced.isAcceptableOrUnknown(
              data['last_synced']!, _lastSyncedMeta));
    } else if (isInserting) {
      context.missing(_lastSyncedMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  ProductCacheEntry map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ProductCacheEntry(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      name: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}name'])!,
      category: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}category'])!,
      price: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}price'])!,
      unit: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}unit']),
      isActive: attachedDatabase.typeMapping
          .read(DriftSqlType.bool, data['${effectivePrefix}is_active'])!,
      lastSynced: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}last_synced'])!,
    );
  }

  @override
  $ProductsCacheTable createAlias(String alias) {
    return $ProductsCacheTable(attachedDatabase, alias);
  }
}

class ProductCacheEntry extends DataClass
    implements Insertable<ProductCacheEntry> {
  final String id;
  final String name;
  final String category;
  final double price;
  final String? unit;
  final bool isActive;
  final int lastSynced;
  const ProductCacheEntry(
      {required this.id,
      required this.name,
      required this.category,
      required this.price,
      this.unit,
      required this.isActive,
      required this.lastSynced});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['name'] = Variable<String>(name);
    map['category'] = Variable<String>(category);
    map['price'] = Variable<double>(price);
    if (!nullToAbsent || unit != null) {
      map['unit'] = Variable<String>(unit);
    }
    map['is_active'] = Variable<bool>(isActive);
    map['last_synced'] = Variable<int>(lastSynced);
    return map;
  }

  ProductsCacheCompanion toCompanion(bool nullToAbsent) {
    return ProductsCacheCompanion(
      id: Value(id),
      name: Value(name),
      category: Value(category),
      price: Value(price),
      unit: unit == null && nullToAbsent ? const Value.absent() : Value(unit),
      isActive: Value(isActive),
      lastSynced: Value(lastSynced),
    );
  }

  factory ProductCacheEntry.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ProductCacheEntry(
      id: serializer.fromJson<String>(json['id']),
      name: serializer.fromJson<String>(json['name']),
      category: serializer.fromJson<String>(json['category']),
      price: serializer.fromJson<double>(json['price']),
      unit: serializer.fromJson<String?>(json['unit']),
      isActive: serializer.fromJson<bool>(json['isActive']),
      lastSynced: serializer.fromJson<int>(json['lastSynced']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'name': serializer.toJson<String>(name),
      'category': serializer.toJson<String>(category),
      'price': serializer.toJson<double>(price),
      'unit': serializer.toJson<String?>(unit),
      'isActive': serializer.toJson<bool>(isActive),
      'lastSynced': serializer.toJson<int>(lastSynced),
    };
  }

  ProductCacheEntry copyWith(
          {String? id,
          String? name,
          String? category,
          double? price,
          Value<String?> unit = const Value.absent(),
          bool? isActive,
          int? lastSynced}) =>
      ProductCacheEntry(
        id: id ?? this.id,
        name: name ?? this.name,
        category: category ?? this.category,
        price: price ?? this.price,
        unit: unit.present ? unit.value : this.unit,
        isActive: isActive ?? this.isActive,
        lastSynced: lastSynced ?? this.lastSynced,
      );
  ProductCacheEntry copyWithCompanion(ProductsCacheCompanion data) {
    return ProductCacheEntry(
      id: data.id.present ? data.id.value : this.id,
      name: data.name.present ? data.name.value : this.name,
      category: data.category.present ? data.category.value : this.category,
      price: data.price.present ? data.price.value : this.price,
      unit: data.unit.present ? data.unit.value : this.unit,
      isActive: data.isActive.present ? data.isActive.value : this.isActive,
      lastSynced:
          data.lastSynced.present ? data.lastSynced.value : this.lastSynced,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ProductCacheEntry(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('category: $category, ')
          ..write('price: $price, ')
          ..write('unit: $unit, ')
          ..write('isActive: $isActive, ')
          ..write('lastSynced: $lastSynced')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, name, category, price, unit, isActive, lastSynced);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ProductCacheEntry &&
          other.id == this.id &&
          other.name == this.name &&
          other.category == this.category &&
          other.price == this.price &&
          other.unit == this.unit &&
          other.isActive == this.isActive &&
          other.lastSynced == this.lastSynced);
}

class ProductsCacheCompanion extends UpdateCompanion<ProductCacheEntry> {
  final Value<String> id;
  final Value<String> name;
  final Value<String> category;
  final Value<double> price;
  final Value<String?> unit;
  final Value<bool> isActive;
  final Value<int> lastSynced;
  final Value<int> rowid;
  const ProductsCacheCompanion({
    this.id = const Value.absent(),
    this.name = const Value.absent(),
    this.category = const Value.absent(),
    this.price = const Value.absent(),
    this.unit = const Value.absent(),
    this.isActive = const Value.absent(),
    this.lastSynced = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ProductsCacheCompanion.insert({
    required String id,
    required String name,
    required String category,
    required double price,
    this.unit = const Value.absent(),
    this.isActive = const Value.absent(),
    required int lastSynced,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        name = Value(name),
        category = Value(category),
        price = Value(price),
        lastSynced = Value(lastSynced);
  static Insertable<ProductCacheEntry> custom({
    Expression<String>? id,
    Expression<String>? name,
    Expression<String>? category,
    Expression<double>? price,
    Expression<String>? unit,
    Expression<bool>? isActive,
    Expression<int>? lastSynced,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (name != null) 'name': name,
      if (category != null) 'category': category,
      if (price != null) 'price': price,
      if (unit != null) 'unit': unit,
      if (isActive != null) 'is_active': isActive,
      if (lastSynced != null) 'last_synced': lastSynced,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ProductsCacheCompanion copyWith(
      {Value<String>? id,
      Value<String>? name,
      Value<String>? category,
      Value<double>? price,
      Value<String?>? unit,
      Value<bool>? isActive,
      Value<int>? lastSynced,
      Value<int>? rowid}) {
    return ProductsCacheCompanion(
      id: id ?? this.id,
      name: name ?? this.name,
      category: category ?? this.category,
      price: price ?? this.price,
      unit: unit ?? this.unit,
      isActive: isActive ?? this.isActive,
      lastSynced: lastSynced ?? this.lastSynced,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (category.present) {
      map['category'] = Variable<String>(category.value);
    }
    if (price.present) {
      map['price'] = Variable<double>(price.value);
    }
    if (unit.present) {
      map['unit'] = Variable<String>(unit.value);
    }
    if (isActive.present) {
      map['is_active'] = Variable<bool>(isActive.value);
    }
    if (lastSynced.present) {
      map['last_synced'] = Variable<int>(lastSynced.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ProductsCacheCompanion(')
          ..write('id: $id, ')
          ..write('name: $name, ')
          ..write('category: $category, ')
          ..write('price: $price, ')
          ..write('unit: $unit, ')
          ..write('isActive: $isActive, ')
          ..write('lastSynced: $lastSynced, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $OfflineSalesTable extends OfflineSales
    with TableInfo<$OfflineSalesTable, OfflineSaleEntry> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OfflineSalesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _localIdMeta =
      const VerificationMeta('localId');
  @override
  late final GeneratedColumn<String> localId = GeneratedColumn<String>(
      'local_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _branchIdMeta =
      const VerificationMeta('branchId');
  @override
  late final GeneratedColumn<String> branchId = GeneratedColumn<String>(
      'branch_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _cashierIdMeta =
      const VerificationMeta('cashierId');
  @override
  late final GeneratedColumn<String> cashierId = GeneratedColumn<String>(
      'cashier_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _itemsJsonMeta =
      const VerificationMeta('itemsJson');
  @override
  late final GeneratedColumn<String> itemsJson = GeneratedColumn<String>(
      'items_json', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _subtotalMeta =
      const VerificationMeta('subtotal');
  @override
  late final GeneratedColumn<double> subtotal = GeneratedColumn<double>(
      'subtotal', aliasedName, false,
      type: DriftSqlType.double, requiredDuringInsert: true);
  static const VerificationMeta _vatAmountMeta =
      const VerificationMeta('vatAmount');
  @override
  late final GeneratedColumn<double> vatAmount = GeneratedColumn<double>(
      'vat_amount', aliasedName, false,
      type: DriftSqlType.double, requiredDuringInsert: true);
  static const VerificationMeta _totalMeta = const VerificationMeta('total');
  @override
  late final GeneratedColumn<double> total = GeneratedColumn<double>(
      'total', aliasedName, false,
      type: DriftSqlType.double, requiredDuringInsert: true);
  static const VerificationMeta _paymentMethodMeta =
      const VerificationMeta('paymentMethod');
  @override
  late final GeneratedColumn<String> paymentMethod = GeneratedColumn<String>(
      'payment_method', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _mpesaRefMeta =
      const VerificationMeta('mpesaRef');
  @override
  late final GeneratedColumn<String> mpesaRef = GeneratedColumn<String>(
      'mpesa_ref', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _roomNumberMeta =
      const VerificationMeta('roomNumber');
  @override
  late final GeneratedColumn<String> roomNumber = GeneratedColumn<String>(
      'room_number', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<int> createdAt = GeneratedColumn<int>(
      'created_at', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _syncStatusMeta =
      const VerificationMeta('syncStatus');
  @override
  late final GeneratedColumn<String> syncStatus = GeneratedColumn<String>(
      'sync_status', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant('pending'));
  @override
  List<GeneratedColumn> get $columns => [
        localId,
        branchId,
        cashierId,
        itemsJson,
        subtotal,
        vatAmount,
        total,
        paymentMethod,
        mpesaRef,
        roomNumber,
        createdAt,
        syncStatus
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'offline_sales';
  @override
  VerificationContext validateIntegrity(Insertable<OfflineSaleEntry> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('local_id')) {
      context.handle(_localIdMeta,
          localId.isAcceptableOrUnknown(data['local_id']!, _localIdMeta));
    } else if (isInserting) {
      context.missing(_localIdMeta);
    }
    if (data.containsKey('branch_id')) {
      context.handle(_branchIdMeta,
          branchId.isAcceptableOrUnknown(data['branch_id']!, _branchIdMeta));
    } else if (isInserting) {
      context.missing(_branchIdMeta);
    }
    if (data.containsKey('cashier_id')) {
      context.handle(_cashierIdMeta,
          cashierId.isAcceptableOrUnknown(data['cashier_id']!, _cashierIdMeta));
    } else if (isInserting) {
      context.missing(_cashierIdMeta);
    }
    if (data.containsKey('items_json')) {
      context.handle(_itemsJsonMeta,
          itemsJson.isAcceptableOrUnknown(data['items_json']!, _itemsJsonMeta));
    } else if (isInserting) {
      context.missing(_itemsJsonMeta);
    }
    if (data.containsKey('subtotal')) {
      context.handle(_subtotalMeta,
          subtotal.isAcceptableOrUnknown(data['subtotal']!, _subtotalMeta));
    } else if (isInserting) {
      context.missing(_subtotalMeta);
    }
    if (data.containsKey('vat_amount')) {
      context.handle(_vatAmountMeta,
          vatAmount.isAcceptableOrUnknown(data['vat_amount']!, _vatAmountMeta));
    } else if (isInserting) {
      context.missing(_vatAmountMeta);
    }
    if (data.containsKey('total')) {
      context.handle(
          _totalMeta, total.isAcceptableOrUnknown(data['total']!, _totalMeta));
    } else if (isInserting) {
      context.missing(_totalMeta);
    }
    if (data.containsKey('payment_method')) {
      context.handle(
          _paymentMethodMeta,
          paymentMethod.isAcceptableOrUnknown(
              data['payment_method']!, _paymentMethodMeta));
    } else if (isInserting) {
      context.missing(_paymentMethodMeta);
    }
    if (data.containsKey('mpesa_ref')) {
      context.handle(_mpesaRefMeta,
          mpesaRef.isAcceptableOrUnknown(data['mpesa_ref']!, _mpesaRefMeta));
    }
    if (data.containsKey('room_number')) {
      context.handle(
          _roomNumberMeta,
          roomNumber.isAcceptableOrUnknown(
              data['room_number']!, _roomNumberMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('sync_status')) {
      context.handle(
          _syncStatusMeta,
          syncStatus.isAcceptableOrUnknown(
              data['sync_status']!, _syncStatusMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {localId};
  @override
  OfflineSaleEntry map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return OfflineSaleEntry(
      localId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}local_id'])!,
      branchId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}branch_id'])!,
      cashierId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}cashier_id'])!,
      itemsJson: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}items_json'])!,
      subtotal: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}subtotal'])!,
      vatAmount: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}vat_amount'])!,
      total: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}total'])!,
      paymentMethod: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}payment_method'])!,
      mpesaRef: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}mpesa_ref']),
      roomNumber: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}room_number']),
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}created_at'])!,
      syncStatus: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}sync_status'])!,
    );
  }

  @override
  $OfflineSalesTable createAlias(String alias) {
    return $OfflineSalesTable(attachedDatabase, alias);
  }
}

class OfflineSaleEntry extends DataClass
    implements Insertable<OfflineSaleEntry> {
  final String localId;
  final String branchId;
  final String cashierId;
  final String itemsJson;
  final double subtotal;
  final double vatAmount;
  final double total;
  final String paymentMethod;
  final String? mpesaRef;
  final String? roomNumber;
  final int createdAt;
  final String syncStatus;
  const OfflineSaleEntry(
      {required this.localId,
      required this.branchId,
      required this.cashierId,
      required this.itemsJson,
      required this.subtotal,
      required this.vatAmount,
      required this.total,
      required this.paymentMethod,
      this.mpesaRef,
      this.roomNumber,
      required this.createdAt,
      required this.syncStatus});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['local_id'] = Variable<String>(localId);
    map['branch_id'] = Variable<String>(branchId);
    map['cashier_id'] = Variable<String>(cashierId);
    map['items_json'] = Variable<String>(itemsJson);
    map['subtotal'] = Variable<double>(subtotal);
    map['vat_amount'] = Variable<double>(vatAmount);
    map['total'] = Variable<double>(total);
    map['payment_method'] = Variable<String>(paymentMethod);
    if (!nullToAbsent || mpesaRef != null) {
      map['mpesa_ref'] = Variable<String>(mpesaRef);
    }
    if (!nullToAbsent || roomNumber != null) {
      map['room_number'] = Variable<String>(roomNumber);
    }
    map['created_at'] = Variable<int>(createdAt);
    map['sync_status'] = Variable<String>(syncStatus);
    return map;
  }

  OfflineSalesCompanion toCompanion(bool nullToAbsent) {
    return OfflineSalesCompanion(
      localId: Value(localId),
      branchId: Value(branchId),
      cashierId: Value(cashierId),
      itemsJson: Value(itemsJson),
      subtotal: Value(subtotal),
      vatAmount: Value(vatAmount),
      total: Value(total),
      paymentMethod: Value(paymentMethod),
      mpesaRef: mpesaRef == null && nullToAbsent
          ? const Value.absent()
          : Value(mpesaRef),
      roomNumber: roomNumber == null && nullToAbsent
          ? const Value.absent()
          : Value(roomNumber),
      createdAt: Value(createdAt),
      syncStatus: Value(syncStatus),
    );
  }

  factory OfflineSaleEntry.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return OfflineSaleEntry(
      localId: serializer.fromJson<String>(json['localId']),
      branchId: serializer.fromJson<String>(json['branchId']),
      cashierId: serializer.fromJson<String>(json['cashierId']),
      itemsJson: serializer.fromJson<String>(json['itemsJson']),
      subtotal: serializer.fromJson<double>(json['subtotal']),
      vatAmount: serializer.fromJson<double>(json['vatAmount']),
      total: serializer.fromJson<double>(json['total']),
      paymentMethod: serializer.fromJson<String>(json['paymentMethod']),
      mpesaRef: serializer.fromJson<String?>(json['mpesaRef']),
      roomNumber: serializer.fromJson<String?>(json['roomNumber']),
      createdAt: serializer.fromJson<int>(json['createdAt']),
      syncStatus: serializer.fromJson<String>(json['syncStatus']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'localId': serializer.toJson<String>(localId),
      'branchId': serializer.toJson<String>(branchId),
      'cashierId': serializer.toJson<String>(cashierId),
      'itemsJson': serializer.toJson<String>(itemsJson),
      'subtotal': serializer.toJson<double>(subtotal),
      'vatAmount': serializer.toJson<double>(vatAmount),
      'total': serializer.toJson<double>(total),
      'paymentMethod': serializer.toJson<String>(paymentMethod),
      'mpesaRef': serializer.toJson<String?>(mpesaRef),
      'roomNumber': serializer.toJson<String?>(roomNumber),
      'createdAt': serializer.toJson<int>(createdAt),
      'syncStatus': serializer.toJson<String>(syncStatus),
    };
  }

  OfflineSaleEntry copyWith(
          {String? localId,
          String? branchId,
          String? cashierId,
          String? itemsJson,
          double? subtotal,
          double? vatAmount,
          double? total,
          String? paymentMethod,
          Value<String?> mpesaRef = const Value.absent(),
          Value<String?> roomNumber = const Value.absent(),
          int? createdAt,
          String? syncStatus}) =>
      OfflineSaleEntry(
        localId: localId ?? this.localId,
        branchId: branchId ?? this.branchId,
        cashierId: cashierId ?? this.cashierId,
        itemsJson: itemsJson ?? this.itemsJson,
        subtotal: subtotal ?? this.subtotal,
        vatAmount: vatAmount ?? this.vatAmount,
        total: total ?? this.total,
        paymentMethod: paymentMethod ?? this.paymentMethod,
        mpesaRef: mpesaRef.present ? mpesaRef.value : this.mpesaRef,
        roomNumber: roomNumber.present ? roomNumber.value : this.roomNumber,
        createdAt: createdAt ?? this.createdAt,
        syncStatus: syncStatus ?? this.syncStatus,
      );
  OfflineSaleEntry copyWithCompanion(OfflineSalesCompanion data) {
    return OfflineSaleEntry(
      localId: data.localId.present ? data.localId.value : this.localId,
      branchId: data.branchId.present ? data.branchId.value : this.branchId,
      cashierId: data.cashierId.present ? data.cashierId.value : this.cashierId,
      itemsJson: data.itemsJson.present ? data.itemsJson.value : this.itemsJson,
      subtotal: data.subtotal.present ? data.subtotal.value : this.subtotal,
      vatAmount: data.vatAmount.present ? data.vatAmount.value : this.vatAmount,
      total: data.total.present ? data.total.value : this.total,
      paymentMethod: data.paymentMethod.present
          ? data.paymentMethod.value
          : this.paymentMethod,
      mpesaRef: data.mpesaRef.present ? data.mpesaRef.value : this.mpesaRef,
      roomNumber:
          data.roomNumber.present ? data.roomNumber.value : this.roomNumber,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      syncStatus:
          data.syncStatus.present ? data.syncStatus.value : this.syncStatus,
    );
  }

  @override
  String toString() {
    return (StringBuffer('OfflineSaleEntry(')
          ..write('localId: $localId, ')
          ..write('branchId: $branchId, ')
          ..write('cashierId: $cashierId, ')
          ..write('itemsJson: $itemsJson, ')
          ..write('subtotal: $subtotal, ')
          ..write('vatAmount: $vatAmount, ')
          ..write('total: $total, ')
          ..write('paymentMethod: $paymentMethod, ')
          ..write('mpesaRef: $mpesaRef, ')
          ..write('roomNumber: $roomNumber, ')
          ..write('createdAt: $createdAt, ')
          ..write('syncStatus: $syncStatus')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      localId,
      branchId,
      cashierId,
      itemsJson,
      subtotal,
      vatAmount,
      total,
      paymentMethod,
      mpesaRef,
      roomNumber,
      createdAt,
      syncStatus);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OfflineSaleEntry &&
          other.localId == this.localId &&
          other.branchId == this.branchId &&
          other.cashierId == this.cashierId &&
          other.itemsJson == this.itemsJson &&
          other.subtotal == this.subtotal &&
          other.vatAmount == this.vatAmount &&
          other.total == this.total &&
          other.paymentMethod == this.paymentMethod &&
          other.mpesaRef == this.mpesaRef &&
          other.roomNumber == this.roomNumber &&
          other.createdAt == this.createdAt &&
          other.syncStatus == this.syncStatus);
}

class OfflineSalesCompanion extends UpdateCompanion<OfflineSaleEntry> {
  final Value<String> localId;
  final Value<String> branchId;
  final Value<String> cashierId;
  final Value<String> itemsJson;
  final Value<double> subtotal;
  final Value<double> vatAmount;
  final Value<double> total;
  final Value<String> paymentMethod;
  final Value<String?> mpesaRef;
  final Value<String?> roomNumber;
  final Value<int> createdAt;
  final Value<String> syncStatus;
  final Value<int> rowid;
  const OfflineSalesCompanion({
    this.localId = const Value.absent(),
    this.branchId = const Value.absent(),
    this.cashierId = const Value.absent(),
    this.itemsJson = const Value.absent(),
    this.subtotal = const Value.absent(),
    this.vatAmount = const Value.absent(),
    this.total = const Value.absent(),
    this.paymentMethod = const Value.absent(),
    this.mpesaRef = const Value.absent(),
    this.roomNumber = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.syncStatus = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  OfflineSalesCompanion.insert({
    required String localId,
    required String branchId,
    required String cashierId,
    required String itemsJson,
    required double subtotal,
    required double vatAmount,
    required double total,
    required String paymentMethod,
    this.mpesaRef = const Value.absent(),
    this.roomNumber = const Value.absent(),
    required int createdAt,
    this.syncStatus = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : localId = Value(localId),
        branchId = Value(branchId),
        cashierId = Value(cashierId),
        itemsJson = Value(itemsJson),
        subtotal = Value(subtotal),
        vatAmount = Value(vatAmount),
        total = Value(total),
        paymentMethod = Value(paymentMethod),
        createdAt = Value(createdAt);
  static Insertable<OfflineSaleEntry> custom({
    Expression<String>? localId,
    Expression<String>? branchId,
    Expression<String>? cashierId,
    Expression<String>? itemsJson,
    Expression<double>? subtotal,
    Expression<double>? vatAmount,
    Expression<double>? total,
    Expression<String>? paymentMethod,
    Expression<String>? mpesaRef,
    Expression<String>? roomNumber,
    Expression<int>? createdAt,
    Expression<String>? syncStatus,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (localId != null) 'local_id': localId,
      if (branchId != null) 'branch_id': branchId,
      if (cashierId != null) 'cashier_id': cashierId,
      if (itemsJson != null) 'items_json': itemsJson,
      if (subtotal != null) 'subtotal': subtotal,
      if (vatAmount != null) 'vat_amount': vatAmount,
      if (total != null) 'total': total,
      if (paymentMethod != null) 'payment_method': paymentMethod,
      if (mpesaRef != null) 'mpesa_ref': mpesaRef,
      if (roomNumber != null) 'room_number': roomNumber,
      if (createdAt != null) 'created_at': createdAt,
      if (syncStatus != null) 'sync_status': syncStatus,
      if (rowid != null) 'rowid': rowid,
    });
  }

  OfflineSalesCompanion copyWith(
      {Value<String>? localId,
      Value<String>? branchId,
      Value<String>? cashierId,
      Value<String>? itemsJson,
      Value<double>? subtotal,
      Value<double>? vatAmount,
      Value<double>? total,
      Value<String>? paymentMethod,
      Value<String?>? mpesaRef,
      Value<String?>? roomNumber,
      Value<int>? createdAt,
      Value<String>? syncStatus,
      Value<int>? rowid}) {
    return OfflineSalesCompanion(
      localId: localId ?? this.localId,
      branchId: branchId ?? this.branchId,
      cashierId: cashierId ?? this.cashierId,
      itemsJson: itemsJson ?? this.itemsJson,
      subtotal: subtotal ?? this.subtotal,
      vatAmount: vatAmount ?? this.vatAmount,
      total: total ?? this.total,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      mpesaRef: mpesaRef ?? this.mpesaRef,
      roomNumber: roomNumber ?? this.roomNumber,
      createdAt: createdAt ?? this.createdAt,
      syncStatus: syncStatus ?? this.syncStatus,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (localId.present) {
      map['local_id'] = Variable<String>(localId.value);
    }
    if (branchId.present) {
      map['branch_id'] = Variable<String>(branchId.value);
    }
    if (cashierId.present) {
      map['cashier_id'] = Variable<String>(cashierId.value);
    }
    if (itemsJson.present) {
      map['items_json'] = Variable<String>(itemsJson.value);
    }
    if (subtotal.present) {
      map['subtotal'] = Variable<double>(subtotal.value);
    }
    if (vatAmount.present) {
      map['vat_amount'] = Variable<double>(vatAmount.value);
    }
    if (total.present) {
      map['total'] = Variable<double>(total.value);
    }
    if (paymentMethod.present) {
      map['payment_method'] = Variable<String>(paymentMethod.value);
    }
    if (mpesaRef.present) {
      map['mpesa_ref'] = Variable<String>(mpesaRef.value);
    }
    if (roomNumber.present) {
      map['room_number'] = Variable<String>(roomNumber.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<int>(createdAt.value);
    }
    if (syncStatus.present) {
      map['sync_status'] = Variable<String>(syncStatus.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OfflineSalesCompanion(')
          ..write('localId: $localId, ')
          ..write('branchId: $branchId, ')
          ..write('cashierId: $cashierId, ')
          ..write('itemsJson: $itemsJson, ')
          ..write('subtotal: $subtotal, ')
          ..write('vatAmount: $vatAmount, ')
          ..write('total: $total, ')
          ..write('paymentMethod: $paymentMethod, ')
          ..write('mpesaRef: $mpesaRef, ')
          ..write('roomNumber: $roomNumber, ')
          ..write('createdAt: $createdAt, ')
          ..write('syncStatus: $syncStatus, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $HeldOrdersTable extends HeldOrders
    with TableInfo<$HeldOrdersTable, HeldOrderEntry> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $HeldOrdersTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _labelMeta = const VerificationMeta('label');
  @override
  late final GeneratedColumn<String> label = GeneratedColumn<String>(
      'label', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _itemsJsonMeta =
      const VerificationMeta('itemsJson');
  @override
  late final GeneratedColumn<String> itemsJson = GeneratedColumn<String>(
      'items_json', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _subtotalMeta =
      const VerificationMeta('subtotal');
  @override
  late final GeneratedColumn<double> subtotal = GeneratedColumn<double>(
      'subtotal', aliasedName, false,
      type: DriftSqlType.double, requiredDuringInsert: true);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<int> createdAt = GeneratedColumn<int>(
      'created_at', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns =>
      [id, label, itemsJson, subtotal, createdAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'held_orders';
  @override
  VerificationContext validateIntegrity(Insertable<HeldOrderEntry> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('label')) {
      context.handle(
          _labelMeta, label.isAcceptableOrUnknown(data['label']!, _labelMeta));
    }
    if (data.containsKey('items_json')) {
      context.handle(_itemsJsonMeta,
          itemsJson.isAcceptableOrUnknown(data['items_json']!, _itemsJsonMeta));
    } else if (isInserting) {
      context.missing(_itemsJsonMeta);
    }
    if (data.containsKey('subtotal')) {
      context.handle(_subtotalMeta,
          subtotal.isAcceptableOrUnknown(data['subtotal']!, _subtotalMeta));
    } else if (isInserting) {
      context.missing(_subtotalMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  HeldOrderEntry map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return HeldOrderEntry(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      label: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}label']),
      itemsJson: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}items_json'])!,
      subtotal: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}subtotal'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}created_at'])!,
    );
  }

  @override
  $HeldOrdersTable createAlias(String alias) {
    return $HeldOrdersTable(attachedDatabase, alias);
  }
}

class HeldOrderEntry extends DataClass implements Insertable<HeldOrderEntry> {
  final String id;
  final String? label;
  final String itemsJson;
  final double subtotal;
  final int createdAt;
  const HeldOrderEntry(
      {required this.id,
      this.label,
      required this.itemsJson,
      required this.subtotal,
      required this.createdAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    if (!nullToAbsent || label != null) {
      map['label'] = Variable<String>(label);
    }
    map['items_json'] = Variable<String>(itemsJson);
    map['subtotal'] = Variable<double>(subtotal);
    map['created_at'] = Variable<int>(createdAt);
    return map;
  }

  HeldOrdersCompanion toCompanion(bool nullToAbsent) {
    return HeldOrdersCompanion(
      id: Value(id),
      label:
          label == null && nullToAbsent ? const Value.absent() : Value(label),
      itemsJson: Value(itemsJson),
      subtotal: Value(subtotal),
      createdAt: Value(createdAt),
    );
  }

  factory HeldOrderEntry.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return HeldOrderEntry(
      id: serializer.fromJson<String>(json['id']),
      label: serializer.fromJson<String?>(json['label']),
      itemsJson: serializer.fromJson<String>(json['itemsJson']),
      subtotal: serializer.fromJson<double>(json['subtotal']),
      createdAt: serializer.fromJson<int>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'label': serializer.toJson<String?>(label),
      'itemsJson': serializer.toJson<String>(itemsJson),
      'subtotal': serializer.toJson<double>(subtotal),
      'createdAt': serializer.toJson<int>(createdAt),
    };
  }

  HeldOrderEntry copyWith(
          {String? id,
          Value<String?> label = const Value.absent(),
          String? itemsJson,
          double? subtotal,
          int? createdAt}) =>
      HeldOrderEntry(
        id: id ?? this.id,
        label: label.present ? label.value : this.label,
        itemsJson: itemsJson ?? this.itemsJson,
        subtotal: subtotal ?? this.subtotal,
        createdAt: createdAt ?? this.createdAt,
      );
  HeldOrderEntry copyWithCompanion(HeldOrdersCompanion data) {
    return HeldOrderEntry(
      id: data.id.present ? data.id.value : this.id,
      label: data.label.present ? data.label.value : this.label,
      itemsJson: data.itemsJson.present ? data.itemsJson.value : this.itemsJson,
      subtotal: data.subtotal.present ? data.subtotal.value : this.subtotal,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('HeldOrderEntry(')
          ..write('id: $id, ')
          ..write('label: $label, ')
          ..write('itemsJson: $itemsJson, ')
          ..write('subtotal: $subtotal, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, label, itemsJson, subtotal, createdAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is HeldOrderEntry &&
          other.id == this.id &&
          other.label == this.label &&
          other.itemsJson == this.itemsJson &&
          other.subtotal == this.subtotal &&
          other.createdAt == this.createdAt);
}

class HeldOrdersCompanion extends UpdateCompanion<HeldOrderEntry> {
  final Value<String> id;
  final Value<String?> label;
  final Value<String> itemsJson;
  final Value<double> subtotal;
  final Value<int> createdAt;
  final Value<int> rowid;
  const HeldOrdersCompanion({
    this.id = const Value.absent(),
    this.label = const Value.absent(),
    this.itemsJson = const Value.absent(),
    this.subtotal = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  HeldOrdersCompanion.insert({
    required String id,
    this.label = const Value.absent(),
    required String itemsJson,
    required double subtotal,
    required int createdAt,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        itemsJson = Value(itemsJson),
        subtotal = Value(subtotal),
        createdAt = Value(createdAt);
  static Insertable<HeldOrderEntry> custom({
    Expression<String>? id,
    Expression<String>? label,
    Expression<String>? itemsJson,
    Expression<double>? subtotal,
    Expression<int>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (label != null) 'label': label,
      if (itemsJson != null) 'items_json': itemsJson,
      if (subtotal != null) 'subtotal': subtotal,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  HeldOrdersCompanion copyWith(
      {Value<String>? id,
      Value<String?>? label,
      Value<String>? itemsJson,
      Value<double>? subtotal,
      Value<int>? createdAt,
      Value<int>? rowid}) {
    return HeldOrdersCompanion(
      id: id ?? this.id,
      label: label ?? this.label,
      itemsJson: itemsJson ?? this.itemsJson,
      subtotal: subtotal ?? this.subtotal,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (label.present) {
      map['label'] = Variable<String>(label.value);
    }
    if (itemsJson.present) {
      map['items_json'] = Variable<String>(itemsJson.value);
    }
    if (subtotal.present) {
      map['subtotal'] = Variable<double>(subtotal.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<int>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('HeldOrdersCompanion(')
          ..write('id: $id, ')
          ..write('label: $label, ')
          ..write('itemsJson: $itemsJson, ')
          ..write('subtotal: $subtotal, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CachedNotificationsTable extends CachedNotifications
    with TableInfo<$CachedNotificationsTable, CachedNotificationEntry> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CachedNotificationsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _titleMeta = const VerificationMeta('title');
  @override
  late final GeneratedColumn<String> title = GeneratedColumn<String>(
      'title', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _bodyMeta = const VerificationMeta('body');
  @override
  late final GeneratedColumn<String> body = GeneratedColumn<String>(
      'body', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _typeMeta = const VerificationMeta('type');
  @override
  late final GeneratedColumn<String> type = GeneratedColumn<String>(
      'type', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _isReadMeta = const VerificationMeta('isRead');
  @override
  late final GeneratedColumn<bool> isRead = GeneratedColumn<bool>(
      'is_read', aliasedName, false,
      type: DriftSqlType.bool,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('CHECK ("is_read" IN (0, 1))'),
      defaultValue: const Constant(false));
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<int> createdAt = GeneratedColumn<int>(
      'created_at', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns =>
      [id, title, body, type, isRead, createdAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'cached_notifications';
  @override
  VerificationContext validateIntegrity(
      Insertable<CachedNotificationEntry> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('title')) {
      context.handle(
          _titleMeta, title.isAcceptableOrUnknown(data['title']!, _titleMeta));
    } else if (isInserting) {
      context.missing(_titleMeta);
    }
    if (data.containsKey('body')) {
      context.handle(
          _bodyMeta, body.isAcceptableOrUnknown(data['body']!, _bodyMeta));
    } else if (isInserting) {
      context.missing(_bodyMeta);
    }
    if (data.containsKey('type')) {
      context.handle(
          _typeMeta, type.isAcceptableOrUnknown(data['type']!, _typeMeta));
    } else if (isInserting) {
      context.missing(_typeMeta);
    }
    if (data.containsKey('is_read')) {
      context.handle(_isReadMeta,
          isRead.isAcceptableOrUnknown(data['is_read']!, _isReadMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  CachedNotificationEntry map(Map<String, dynamic> data,
      {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CachedNotificationEntry(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      title: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}title'])!,
      body: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}body'])!,
      type: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}type'])!,
      isRead: attachedDatabase.typeMapping
          .read(DriftSqlType.bool, data['${effectivePrefix}is_read'])!,
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}created_at'])!,
    );
  }

  @override
  $CachedNotificationsTable createAlias(String alias) {
    return $CachedNotificationsTable(attachedDatabase, alias);
  }
}

class CachedNotificationEntry extends DataClass
    implements Insertable<CachedNotificationEntry> {
  final String id;
  final String title;
  final String body;
  final String type;
  final bool isRead;
  final int createdAt;
  const CachedNotificationEntry(
      {required this.id,
      required this.title,
      required this.body,
      required this.type,
      required this.isRead,
      required this.createdAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['title'] = Variable<String>(title);
    map['body'] = Variable<String>(body);
    map['type'] = Variable<String>(type);
    map['is_read'] = Variable<bool>(isRead);
    map['created_at'] = Variable<int>(createdAt);
    return map;
  }

  CachedNotificationsCompanion toCompanion(bool nullToAbsent) {
    return CachedNotificationsCompanion(
      id: Value(id),
      title: Value(title),
      body: Value(body),
      type: Value(type),
      isRead: Value(isRead),
      createdAt: Value(createdAt),
    );
  }

  factory CachedNotificationEntry.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CachedNotificationEntry(
      id: serializer.fromJson<String>(json['id']),
      title: serializer.fromJson<String>(json['title']),
      body: serializer.fromJson<String>(json['body']),
      type: serializer.fromJson<String>(json['type']),
      isRead: serializer.fromJson<bool>(json['isRead']),
      createdAt: serializer.fromJson<int>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'title': serializer.toJson<String>(title),
      'body': serializer.toJson<String>(body),
      'type': serializer.toJson<String>(type),
      'isRead': serializer.toJson<bool>(isRead),
      'createdAt': serializer.toJson<int>(createdAt),
    };
  }

  CachedNotificationEntry copyWith(
          {String? id,
          String? title,
          String? body,
          String? type,
          bool? isRead,
          int? createdAt}) =>
      CachedNotificationEntry(
        id: id ?? this.id,
        title: title ?? this.title,
        body: body ?? this.body,
        type: type ?? this.type,
        isRead: isRead ?? this.isRead,
        createdAt: createdAt ?? this.createdAt,
      );
  CachedNotificationEntry copyWithCompanion(CachedNotificationsCompanion data) {
    return CachedNotificationEntry(
      id: data.id.present ? data.id.value : this.id,
      title: data.title.present ? data.title.value : this.title,
      body: data.body.present ? data.body.value : this.body,
      type: data.type.present ? data.type.value : this.type,
      isRead: data.isRead.present ? data.isRead.value : this.isRead,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CachedNotificationEntry(')
          ..write('id: $id, ')
          ..write('title: $title, ')
          ..write('body: $body, ')
          ..write('type: $type, ')
          ..write('isRead: $isRead, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, title, body, type, isRead, createdAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CachedNotificationEntry &&
          other.id == this.id &&
          other.title == this.title &&
          other.body == this.body &&
          other.type == this.type &&
          other.isRead == this.isRead &&
          other.createdAt == this.createdAt);
}

class CachedNotificationsCompanion
    extends UpdateCompanion<CachedNotificationEntry> {
  final Value<String> id;
  final Value<String> title;
  final Value<String> body;
  final Value<String> type;
  final Value<bool> isRead;
  final Value<int> createdAt;
  final Value<int> rowid;
  const CachedNotificationsCompanion({
    this.id = const Value.absent(),
    this.title = const Value.absent(),
    this.body = const Value.absent(),
    this.type = const Value.absent(),
    this.isRead = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CachedNotificationsCompanion.insert({
    required String id,
    required String title,
    required String body,
    required String type,
    this.isRead = const Value.absent(),
    required int createdAt,
    this.rowid = const Value.absent(),
  })  : id = Value(id),
        title = Value(title),
        body = Value(body),
        type = Value(type),
        createdAt = Value(createdAt);
  static Insertable<CachedNotificationEntry> custom({
    Expression<String>? id,
    Expression<String>? title,
    Expression<String>? body,
    Expression<String>? type,
    Expression<bool>? isRead,
    Expression<int>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (title != null) 'title': title,
      if (body != null) 'body': body,
      if (type != null) 'type': type,
      if (isRead != null) 'is_read': isRead,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CachedNotificationsCompanion copyWith(
      {Value<String>? id,
      Value<String>? title,
      Value<String>? body,
      Value<String>? type,
      Value<bool>? isRead,
      Value<int>? createdAt,
      Value<int>? rowid}) {
    return CachedNotificationsCompanion(
      id: id ?? this.id,
      title: title ?? this.title,
      body: body ?? this.body,
      type: type ?? this.type,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (body.present) {
      map['body'] = Variable<String>(body.value);
    }
    if (type.present) {
      map['type'] = Variable<String>(type.value);
    }
    if (isRead.present) {
      map['is_read'] = Variable<bool>(isRead.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<int>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CachedNotificationsCompanion(')
          ..write('id: $id, ')
          ..write('title: $title, ')
          ..write('body: $body, ')
          ..write('type: $type, ')
          ..write('isRead: $isRead, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ScanSessionsTable extends ScanSessions
    with TableInfo<$ScanSessionsTable, ScanSessionEntry> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ScanSessionsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _localIdMeta =
      const VerificationMeta('localId');
  @override
  late final GeneratedColumn<String> localId = GeneratedColumn<String>(
      'local_id', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _sessionTypeMeta =
      const VerificationMeta('sessionType');
  @override
  late final GeneratedColumn<String> sessionType = GeneratedColumn<String>(
      'session_type', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _sessionRefMeta =
      const VerificationMeta('sessionRef');
  @override
  late final GeneratedColumn<String> sessionRef = GeneratedColumn<String>(
      'session_ref', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _barcodeMeta =
      const VerificationMeta('barcode');
  @override
  late final GeneratedColumn<String> barcode = GeneratedColumn<String>(
      'barcode', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _itemIdMeta = const VerificationMeta('itemId');
  @override
  late final GeneratedColumn<String> itemId = GeneratedColumn<String>(
      'item_id', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _itemSkuMeta =
      const VerificationMeta('itemSku');
  @override
  late final GeneratedColumn<String> itemSku = GeneratedColumn<String>(
      'item_sku', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _itemNameMeta =
      const VerificationMeta('itemName');
  @override
  late final GeneratedColumn<String> itemName = GeneratedColumn<String>(
      'item_name', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _itemUnitMeta =
      const VerificationMeta('itemUnit');
  @override
  late final GeneratedColumn<String> itemUnit = GeneratedColumn<String>(
      'item_unit', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _scannedQuantityMeta =
      const VerificationMeta('scannedQuantity');
  @override
  late final GeneratedColumn<double> scannedQuantity = GeneratedColumn<double>(
      'scanned_quantity', aliasedName, false,
      type: DriftSqlType.double,
      requiredDuringInsert: false,
      defaultValue: const Constant(1.0));
  static const VerificationMeta _systemStockMeta =
      const VerificationMeta('systemStock');
  @override
  late final GeneratedColumn<double> systemStock = GeneratedColumn<double>(
      'system_stock', aliasedName, true,
      type: DriftSqlType.double, requiredDuringInsert: false);
  static const VerificationMeta _scannedAtMeta =
      const VerificationMeta('scannedAt');
  @override
  late final GeneratedColumn<int> scannedAt = GeneratedColumn<int>(
      'scanned_at', aliasedName, false,
      type: DriftSqlType.int, requiredDuringInsert: true);
  static const VerificationMeta _syncedMeta = const VerificationMeta('synced');
  @override
  late final GeneratedColumn<bool> synced = GeneratedColumn<bool>(
      'synced', aliasedName, false,
      type: DriftSqlType.bool,
      requiredDuringInsert: false,
      defaultConstraints:
          GeneratedColumn.constraintIsAlways('CHECK ("synced" IN (0, 1))'),
      defaultValue: const Constant(false));
  @override
  List<GeneratedColumn> get $columns => [
        localId,
        sessionType,
        sessionRef,
        barcode,
        itemId,
        itemSku,
        itemName,
        itemUnit,
        scannedQuantity,
        systemStock,
        scannedAt,
        synced
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'scan_sessions';
  @override
  VerificationContext validateIntegrity(Insertable<ScanSessionEntry> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('local_id')) {
      context.handle(_localIdMeta,
          localId.isAcceptableOrUnknown(data['local_id']!, _localIdMeta));
    } else if (isInserting) {
      context.missing(_localIdMeta);
    }
    if (data.containsKey('session_type')) {
      context.handle(
          _sessionTypeMeta,
          sessionType.isAcceptableOrUnknown(
              data['session_type']!, _sessionTypeMeta));
    } else if (isInserting) {
      context.missing(_sessionTypeMeta);
    }
    if (data.containsKey('session_ref')) {
      context.handle(
          _sessionRefMeta,
          sessionRef.isAcceptableOrUnknown(
              data['session_ref']!, _sessionRefMeta));
    }
    if (data.containsKey('barcode')) {
      context.handle(_barcodeMeta,
          barcode.isAcceptableOrUnknown(data['barcode']!, _barcodeMeta));
    } else if (isInserting) {
      context.missing(_barcodeMeta);
    }
    if (data.containsKey('item_id')) {
      context.handle(_itemIdMeta,
          itemId.isAcceptableOrUnknown(data['item_id']!, _itemIdMeta));
    }
    if (data.containsKey('item_sku')) {
      context.handle(_itemSkuMeta,
          itemSku.isAcceptableOrUnknown(data['item_sku']!, _itemSkuMeta));
    } else if (isInserting) {
      context.missing(_itemSkuMeta);
    }
    if (data.containsKey('item_name')) {
      context.handle(_itemNameMeta,
          itemName.isAcceptableOrUnknown(data['item_name']!, _itemNameMeta));
    } else if (isInserting) {
      context.missing(_itemNameMeta);
    }
    if (data.containsKey('item_unit')) {
      context.handle(_itemUnitMeta,
          itemUnit.isAcceptableOrUnknown(data['item_unit']!, _itemUnitMeta));
    } else if (isInserting) {
      context.missing(_itemUnitMeta);
    }
    if (data.containsKey('scanned_quantity')) {
      context.handle(
          _scannedQuantityMeta,
          scannedQuantity.isAcceptableOrUnknown(
              data['scanned_quantity']!, _scannedQuantityMeta));
    }
    if (data.containsKey('system_stock')) {
      context.handle(
          _systemStockMeta,
          systemStock.isAcceptableOrUnknown(
              data['system_stock']!, _systemStockMeta));
    }
    if (data.containsKey('scanned_at')) {
      context.handle(_scannedAtMeta,
          scannedAt.isAcceptableOrUnknown(data['scanned_at']!, _scannedAtMeta));
    } else if (isInserting) {
      context.missing(_scannedAtMeta);
    }
    if (data.containsKey('synced')) {
      context.handle(_syncedMeta,
          synced.isAcceptableOrUnknown(data['synced']!, _syncedMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {localId};
  @override
  ScanSessionEntry map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ScanSessionEntry(
      localId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}local_id'])!,
      sessionType: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}session_type'])!,
      sessionRef: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}session_ref']),
      barcode: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}barcode'])!,
      itemId: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}item_id']),
      itemSku: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}item_sku'])!,
      itemName: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}item_name'])!,
      itemUnit: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}item_unit'])!,
      scannedQuantity: attachedDatabase.typeMapping.read(
          DriftSqlType.double, data['${effectivePrefix}scanned_quantity'])!,
      systemStock: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}system_stock']),
      scannedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.int, data['${effectivePrefix}scanned_at'])!,
      synced: attachedDatabase.typeMapping
          .read(DriftSqlType.bool, data['${effectivePrefix}synced'])!,
    );
  }

  @override
  $ScanSessionsTable createAlias(String alias) {
    return $ScanSessionsTable(attachedDatabase, alias);
  }
}

class ScanSessionEntry extends DataClass
    implements Insertable<ScanSessionEntry> {
  /// Local UUID assigned at scan time
  final String localId;

  /// 'grn' | 'stock_take' | 'barcode_lookup'
  final String sessionType;

  /// PO id (for grn), stock-take id, etc.
  final String? sessionRef;
  final String barcode;
  final String? itemId;
  final String itemSku;
  final String itemName;
  final String itemUnit;
  final double scannedQuantity;

  /// System stock at time of scan (used for variance in stock takes)
  final double? systemStock;

  /// Unix timestamp ms
  final int scannedAt;
  final bool synced;
  const ScanSessionEntry(
      {required this.localId,
      required this.sessionType,
      this.sessionRef,
      required this.barcode,
      this.itemId,
      required this.itemSku,
      required this.itemName,
      required this.itemUnit,
      required this.scannedQuantity,
      this.systemStock,
      required this.scannedAt,
      required this.synced});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['local_id'] = Variable<String>(localId);
    map['session_type'] = Variable<String>(sessionType);
    if (!nullToAbsent || sessionRef != null) {
      map['session_ref'] = Variable<String>(sessionRef);
    }
    map['barcode'] = Variable<String>(barcode);
    if (!nullToAbsent || itemId != null) {
      map['item_id'] = Variable<String>(itemId);
    }
    map['item_sku'] = Variable<String>(itemSku);
    map['item_name'] = Variable<String>(itemName);
    map['item_unit'] = Variable<String>(itemUnit);
    map['scanned_quantity'] = Variable<double>(scannedQuantity);
    if (!nullToAbsent || systemStock != null) {
      map['system_stock'] = Variable<double>(systemStock);
    }
    map['scanned_at'] = Variable<int>(scannedAt);
    map['synced'] = Variable<bool>(synced);
    return map;
  }

  ScanSessionsCompanion toCompanion(bool nullToAbsent) {
    return ScanSessionsCompanion(
      localId: Value(localId),
      sessionType: Value(sessionType),
      sessionRef: sessionRef == null && nullToAbsent
          ? const Value.absent()
          : Value(sessionRef),
      barcode: Value(barcode),
      itemId:
          itemId == null && nullToAbsent ? const Value.absent() : Value(itemId),
      itemSku: Value(itemSku),
      itemName: Value(itemName),
      itemUnit: Value(itemUnit),
      scannedQuantity: Value(scannedQuantity),
      systemStock: systemStock == null && nullToAbsent
          ? const Value.absent()
          : Value(systemStock),
      scannedAt: Value(scannedAt),
      synced: Value(synced),
    );
  }

  factory ScanSessionEntry.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ScanSessionEntry(
      localId: serializer.fromJson<String>(json['localId']),
      sessionType: serializer.fromJson<String>(json['sessionType']),
      sessionRef: serializer.fromJson<String?>(json['sessionRef']),
      barcode: serializer.fromJson<String>(json['barcode']),
      itemId: serializer.fromJson<String?>(json['itemId']),
      itemSku: serializer.fromJson<String>(json['itemSku']),
      itemName: serializer.fromJson<String>(json['itemName']),
      itemUnit: serializer.fromJson<String>(json['itemUnit']),
      scannedQuantity: serializer.fromJson<double>(json['scannedQuantity']),
      systemStock: serializer.fromJson<double?>(json['systemStock']),
      scannedAt: serializer.fromJson<int>(json['scannedAt']),
      synced: serializer.fromJson<bool>(json['synced']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'localId': serializer.toJson<String>(localId),
      'sessionType': serializer.toJson<String>(sessionType),
      'sessionRef': serializer.toJson<String?>(sessionRef),
      'barcode': serializer.toJson<String>(barcode),
      'itemId': serializer.toJson<String?>(itemId),
      'itemSku': serializer.toJson<String>(itemSku),
      'itemName': serializer.toJson<String>(itemName),
      'itemUnit': serializer.toJson<String>(itemUnit),
      'scannedQuantity': serializer.toJson<double>(scannedQuantity),
      'systemStock': serializer.toJson<double?>(systemStock),
      'scannedAt': serializer.toJson<int>(scannedAt),
      'synced': serializer.toJson<bool>(synced),
    };
  }

  ScanSessionEntry copyWith(
          {String? localId,
          String? sessionType,
          Value<String?> sessionRef = const Value.absent(),
          String? barcode,
          Value<String?> itemId = const Value.absent(),
          String? itemSku,
          String? itemName,
          String? itemUnit,
          double? scannedQuantity,
          Value<double?> systemStock = const Value.absent(),
          int? scannedAt,
          bool? synced}) =>
      ScanSessionEntry(
        localId: localId ?? this.localId,
        sessionType: sessionType ?? this.sessionType,
        sessionRef: sessionRef.present ? sessionRef.value : this.sessionRef,
        barcode: barcode ?? this.barcode,
        itemId: itemId.present ? itemId.value : this.itemId,
        itemSku: itemSku ?? this.itemSku,
        itemName: itemName ?? this.itemName,
        itemUnit: itemUnit ?? this.itemUnit,
        scannedQuantity: scannedQuantity ?? this.scannedQuantity,
        systemStock: systemStock.present ? systemStock.value : this.systemStock,
        scannedAt: scannedAt ?? this.scannedAt,
        synced: synced ?? this.synced,
      );
  ScanSessionEntry copyWithCompanion(ScanSessionsCompanion data) {
    return ScanSessionEntry(
      localId: data.localId.present ? data.localId.value : this.localId,
      sessionType:
          data.sessionType.present ? data.sessionType.value : this.sessionType,
      sessionRef:
          data.sessionRef.present ? data.sessionRef.value : this.sessionRef,
      barcode: data.barcode.present ? data.barcode.value : this.barcode,
      itemId: data.itemId.present ? data.itemId.value : this.itemId,
      itemSku: data.itemSku.present ? data.itemSku.value : this.itemSku,
      itemName: data.itemName.present ? data.itemName.value : this.itemName,
      itemUnit: data.itemUnit.present ? data.itemUnit.value : this.itemUnit,
      scannedQuantity: data.scannedQuantity.present
          ? data.scannedQuantity.value
          : this.scannedQuantity,
      systemStock:
          data.systemStock.present ? data.systemStock.value : this.systemStock,
      scannedAt: data.scannedAt.present ? data.scannedAt.value : this.scannedAt,
      synced: data.synced.present ? data.synced.value : this.synced,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ScanSessionEntry(')
          ..write('localId: $localId, ')
          ..write('sessionType: $sessionType, ')
          ..write('sessionRef: $sessionRef, ')
          ..write('barcode: $barcode, ')
          ..write('itemId: $itemId, ')
          ..write('itemSku: $itemSku, ')
          ..write('itemName: $itemName, ')
          ..write('itemUnit: $itemUnit, ')
          ..write('scannedQuantity: $scannedQuantity, ')
          ..write('systemStock: $systemStock, ')
          ..write('scannedAt: $scannedAt, ')
          ..write('synced: $synced')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      localId,
      sessionType,
      sessionRef,
      barcode,
      itemId,
      itemSku,
      itemName,
      itemUnit,
      scannedQuantity,
      systemStock,
      scannedAt,
      synced);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ScanSessionEntry &&
          other.localId == this.localId &&
          other.sessionType == this.sessionType &&
          other.sessionRef == this.sessionRef &&
          other.barcode == this.barcode &&
          other.itemId == this.itemId &&
          other.itemSku == this.itemSku &&
          other.itemName == this.itemName &&
          other.itemUnit == this.itemUnit &&
          other.scannedQuantity == this.scannedQuantity &&
          other.systemStock == this.systemStock &&
          other.scannedAt == this.scannedAt &&
          other.synced == this.synced);
}

class ScanSessionsCompanion extends UpdateCompanion<ScanSessionEntry> {
  final Value<String> localId;
  final Value<String> sessionType;
  final Value<String?> sessionRef;
  final Value<String> barcode;
  final Value<String?> itemId;
  final Value<String> itemSku;
  final Value<String> itemName;
  final Value<String> itemUnit;
  final Value<double> scannedQuantity;
  final Value<double?> systemStock;
  final Value<int> scannedAt;
  final Value<bool> synced;
  final Value<int> rowid;
  const ScanSessionsCompanion({
    this.localId = const Value.absent(),
    this.sessionType = const Value.absent(),
    this.sessionRef = const Value.absent(),
    this.barcode = const Value.absent(),
    this.itemId = const Value.absent(),
    this.itemSku = const Value.absent(),
    this.itemName = const Value.absent(),
    this.itemUnit = const Value.absent(),
    this.scannedQuantity = const Value.absent(),
    this.systemStock = const Value.absent(),
    this.scannedAt = const Value.absent(),
    this.synced = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ScanSessionsCompanion.insert({
    required String localId,
    required String sessionType,
    this.sessionRef = const Value.absent(),
    required String barcode,
    this.itemId = const Value.absent(),
    required String itemSku,
    required String itemName,
    required String itemUnit,
    this.scannedQuantity = const Value.absent(),
    this.systemStock = const Value.absent(),
    required int scannedAt,
    this.synced = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : localId = Value(localId),
        sessionType = Value(sessionType),
        barcode = Value(barcode),
        itemSku = Value(itemSku),
        itemName = Value(itemName),
        itemUnit = Value(itemUnit),
        scannedAt = Value(scannedAt);
  static Insertable<ScanSessionEntry> custom({
    Expression<String>? localId,
    Expression<String>? sessionType,
    Expression<String>? sessionRef,
    Expression<String>? barcode,
    Expression<String>? itemId,
    Expression<String>? itemSku,
    Expression<String>? itemName,
    Expression<String>? itemUnit,
    Expression<double>? scannedQuantity,
    Expression<double>? systemStock,
    Expression<int>? scannedAt,
    Expression<bool>? synced,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (localId != null) 'local_id': localId,
      if (sessionType != null) 'session_type': sessionType,
      if (sessionRef != null) 'session_ref': sessionRef,
      if (barcode != null) 'barcode': barcode,
      if (itemId != null) 'item_id': itemId,
      if (itemSku != null) 'item_sku': itemSku,
      if (itemName != null) 'item_name': itemName,
      if (itemUnit != null) 'item_unit': itemUnit,
      if (scannedQuantity != null) 'scanned_quantity': scannedQuantity,
      if (systemStock != null) 'system_stock': systemStock,
      if (scannedAt != null) 'scanned_at': scannedAt,
      if (synced != null) 'synced': synced,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ScanSessionsCompanion copyWith(
      {Value<String>? localId,
      Value<String>? sessionType,
      Value<String?>? sessionRef,
      Value<String>? barcode,
      Value<String?>? itemId,
      Value<String>? itemSku,
      Value<String>? itemName,
      Value<String>? itemUnit,
      Value<double>? scannedQuantity,
      Value<double?>? systemStock,
      Value<int>? scannedAt,
      Value<bool>? synced,
      Value<int>? rowid}) {
    return ScanSessionsCompanion(
      localId: localId ?? this.localId,
      sessionType: sessionType ?? this.sessionType,
      sessionRef: sessionRef ?? this.sessionRef,
      barcode: barcode ?? this.barcode,
      itemId: itemId ?? this.itemId,
      itemSku: itemSku ?? this.itemSku,
      itemName: itemName ?? this.itemName,
      itemUnit: itemUnit ?? this.itemUnit,
      scannedQuantity: scannedQuantity ?? this.scannedQuantity,
      systemStock: systemStock ?? this.systemStock,
      scannedAt: scannedAt ?? this.scannedAt,
      synced: synced ?? this.synced,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (localId.present) {
      map['local_id'] = Variable<String>(localId.value);
    }
    if (sessionType.present) {
      map['session_type'] = Variable<String>(sessionType.value);
    }
    if (sessionRef.present) {
      map['session_ref'] = Variable<String>(sessionRef.value);
    }
    if (barcode.present) {
      map['barcode'] = Variable<String>(barcode.value);
    }
    if (itemId.present) {
      map['item_id'] = Variable<String>(itemId.value);
    }
    if (itemSku.present) {
      map['item_sku'] = Variable<String>(itemSku.value);
    }
    if (itemName.present) {
      map['item_name'] = Variable<String>(itemName.value);
    }
    if (itemUnit.present) {
      map['item_unit'] = Variable<String>(itemUnit.value);
    }
    if (scannedQuantity.present) {
      map['scanned_quantity'] = Variable<double>(scannedQuantity.value);
    }
    if (systemStock.present) {
      map['system_stock'] = Variable<double>(systemStock.value);
    }
    if (scannedAt.present) {
      map['scanned_at'] = Variable<int>(scannedAt.value);
    }
    if (synced.present) {
      map['synced'] = Variable<bool>(synced.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ScanSessionsCompanion(')
          ..write('localId: $localId, ')
          ..write('sessionType: $sessionType, ')
          ..write('sessionRef: $sessionRef, ')
          ..write('barcode: $barcode, ')
          ..write('itemId: $itemId, ')
          ..write('itemSku: $itemSku, ')
          ..write('itemName: $itemName, ')
          ..write('itemUnit: $itemUnit, ')
          ..write('scannedQuantity: $scannedQuantity, ')
          ..write('systemStock: $systemStock, ')
          ..write('scannedAt: $scannedAt, ')
          ..write('synced: $synced, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $ProductsCacheTable productsCache = $ProductsCacheTable(this);
  late final $OfflineSalesTable offlineSales = $OfflineSalesTable(this);
  late final $HeldOrdersTable heldOrders = $HeldOrdersTable(this);
  late final $CachedNotificationsTable cachedNotifications =
      $CachedNotificationsTable(this);
  late final $ScanSessionsTable scanSessions = $ScanSessionsTable(this);
  late final ProductsCacheDao productsCacheDao =
      ProductsCacheDao(this as AppDatabase);
  late final OfflineSalesDao offlineSalesDao =
      OfflineSalesDao(this as AppDatabase);
  late final HeldOrdersDao heldOrdersDao = HeldOrdersDao(this as AppDatabase);
  late final NotificationsDao notificationsDao =
      NotificationsDao(this as AppDatabase);
  late final ScanSessionsDao scanSessionsDao =
      ScanSessionsDao(this as AppDatabase);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
        productsCache,
        offlineSales,
        heldOrders,
        cachedNotifications,
        scanSessions
      ];
}

typedef $$ProductsCacheTableCreateCompanionBuilder = ProductsCacheCompanion
    Function({
  required String id,
  required String name,
  required String category,
  required double price,
  Value<String?> unit,
  Value<bool> isActive,
  required int lastSynced,
  Value<int> rowid,
});
typedef $$ProductsCacheTableUpdateCompanionBuilder = ProductsCacheCompanion
    Function({
  Value<String> id,
  Value<String> name,
  Value<String> category,
  Value<double> price,
  Value<String?> unit,
  Value<bool> isActive,
  Value<int> lastSynced,
  Value<int> rowid,
});

class $$ProductsCacheTableFilterComposer
    extends Composer<_$AppDatabase, $ProductsCacheTable> {
  $$ProductsCacheTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get category => $composableBuilder(
      column: $table.category, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get price => $composableBuilder(
      column: $table.price, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get unit => $composableBuilder(
      column: $table.unit, builder: (column) => ColumnFilters(column));

  ColumnFilters<bool> get isActive => $composableBuilder(
      column: $table.isActive, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get lastSynced => $composableBuilder(
      column: $table.lastSynced, builder: (column) => ColumnFilters(column));
}

class $$ProductsCacheTableOrderingComposer
    extends Composer<_$AppDatabase, $ProductsCacheTable> {
  $$ProductsCacheTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get category => $composableBuilder(
      column: $table.category, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get price => $composableBuilder(
      column: $table.price, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get unit => $composableBuilder(
      column: $table.unit, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<bool> get isActive => $composableBuilder(
      column: $table.isActive, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get lastSynced => $composableBuilder(
      column: $table.lastSynced, builder: (column) => ColumnOrderings(column));
}

class $$ProductsCacheTableAnnotationComposer
    extends Composer<_$AppDatabase, $ProductsCacheTable> {
  $$ProductsCacheTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get category =>
      $composableBuilder(column: $table.category, builder: (column) => column);

  GeneratedColumn<double> get price =>
      $composableBuilder(column: $table.price, builder: (column) => column);

  GeneratedColumn<String> get unit =>
      $composableBuilder(column: $table.unit, builder: (column) => column);

  GeneratedColumn<bool> get isActive =>
      $composableBuilder(column: $table.isActive, builder: (column) => column);

  GeneratedColumn<int> get lastSynced => $composableBuilder(
      column: $table.lastSynced, builder: (column) => column);
}

class $$ProductsCacheTableTableManager extends RootTableManager<
    _$AppDatabase,
    $ProductsCacheTable,
    ProductCacheEntry,
    $$ProductsCacheTableFilterComposer,
    $$ProductsCacheTableOrderingComposer,
    $$ProductsCacheTableAnnotationComposer,
    $$ProductsCacheTableCreateCompanionBuilder,
    $$ProductsCacheTableUpdateCompanionBuilder,
    (
      ProductCacheEntry,
      BaseReferences<_$AppDatabase, $ProductsCacheTable, ProductCacheEntry>
    ),
    ProductCacheEntry,
    PrefetchHooks Function()> {
  $$ProductsCacheTableTableManager(_$AppDatabase db, $ProductsCacheTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ProductsCacheTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ProductsCacheTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ProductsCacheTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> name = const Value.absent(),
            Value<String> category = const Value.absent(),
            Value<double> price = const Value.absent(),
            Value<String?> unit = const Value.absent(),
            Value<bool> isActive = const Value.absent(),
            Value<int> lastSynced = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              ProductsCacheCompanion(
            id: id,
            name: name,
            category: category,
            price: price,
            unit: unit,
            isActive: isActive,
            lastSynced: lastSynced,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String name,
            required String category,
            required double price,
            Value<String?> unit = const Value.absent(),
            Value<bool> isActive = const Value.absent(),
            required int lastSynced,
            Value<int> rowid = const Value.absent(),
          }) =>
              ProductsCacheCompanion.insert(
            id: id,
            name: name,
            category: category,
            price: price,
            unit: unit,
            isActive: isActive,
            lastSynced: lastSynced,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$ProductsCacheTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $ProductsCacheTable,
    ProductCacheEntry,
    $$ProductsCacheTableFilterComposer,
    $$ProductsCacheTableOrderingComposer,
    $$ProductsCacheTableAnnotationComposer,
    $$ProductsCacheTableCreateCompanionBuilder,
    $$ProductsCacheTableUpdateCompanionBuilder,
    (
      ProductCacheEntry,
      BaseReferences<_$AppDatabase, $ProductsCacheTable, ProductCacheEntry>
    ),
    ProductCacheEntry,
    PrefetchHooks Function()>;
typedef $$OfflineSalesTableCreateCompanionBuilder = OfflineSalesCompanion
    Function({
  required String localId,
  required String branchId,
  required String cashierId,
  required String itemsJson,
  required double subtotal,
  required double vatAmount,
  required double total,
  required String paymentMethod,
  Value<String?> mpesaRef,
  Value<String?> roomNumber,
  required int createdAt,
  Value<String> syncStatus,
  Value<int> rowid,
});
typedef $$OfflineSalesTableUpdateCompanionBuilder = OfflineSalesCompanion
    Function({
  Value<String> localId,
  Value<String> branchId,
  Value<String> cashierId,
  Value<String> itemsJson,
  Value<double> subtotal,
  Value<double> vatAmount,
  Value<double> total,
  Value<String> paymentMethod,
  Value<String?> mpesaRef,
  Value<String?> roomNumber,
  Value<int> createdAt,
  Value<String> syncStatus,
  Value<int> rowid,
});

class $$OfflineSalesTableFilterComposer
    extends Composer<_$AppDatabase, $OfflineSalesTable> {
  $$OfflineSalesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get localId => $composableBuilder(
      column: $table.localId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get branchId => $composableBuilder(
      column: $table.branchId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get cashierId => $composableBuilder(
      column: $table.cashierId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get itemsJson => $composableBuilder(
      column: $table.itemsJson, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get subtotal => $composableBuilder(
      column: $table.subtotal, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get vatAmount => $composableBuilder(
      column: $table.vatAmount, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get total => $composableBuilder(
      column: $table.total, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get paymentMethod => $composableBuilder(
      column: $table.paymentMethod, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get mpesaRef => $composableBuilder(
      column: $table.mpesaRef, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get roomNumber => $composableBuilder(
      column: $table.roomNumber, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get syncStatus => $composableBuilder(
      column: $table.syncStatus, builder: (column) => ColumnFilters(column));
}

class $$OfflineSalesTableOrderingComposer
    extends Composer<_$AppDatabase, $OfflineSalesTable> {
  $$OfflineSalesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get localId => $composableBuilder(
      column: $table.localId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get branchId => $composableBuilder(
      column: $table.branchId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get cashierId => $composableBuilder(
      column: $table.cashierId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get itemsJson => $composableBuilder(
      column: $table.itemsJson, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get subtotal => $composableBuilder(
      column: $table.subtotal, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get vatAmount => $composableBuilder(
      column: $table.vatAmount, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get total => $composableBuilder(
      column: $table.total, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get paymentMethod => $composableBuilder(
      column: $table.paymentMethod,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get mpesaRef => $composableBuilder(
      column: $table.mpesaRef, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get roomNumber => $composableBuilder(
      column: $table.roomNumber, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get syncStatus => $composableBuilder(
      column: $table.syncStatus, builder: (column) => ColumnOrderings(column));
}

class $$OfflineSalesTableAnnotationComposer
    extends Composer<_$AppDatabase, $OfflineSalesTable> {
  $$OfflineSalesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get localId =>
      $composableBuilder(column: $table.localId, builder: (column) => column);

  GeneratedColumn<String> get branchId =>
      $composableBuilder(column: $table.branchId, builder: (column) => column);

  GeneratedColumn<String> get cashierId =>
      $composableBuilder(column: $table.cashierId, builder: (column) => column);

  GeneratedColumn<String> get itemsJson =>
      $composableBuilder(column: $table.itemsJson, builder: (column) => column);

  GeneratedColumn<double> get subtotal =>
      $composableBuilder(column: $table.subtotal, builder: (column) => column);

  GeneratedColumn<double> get vatAmount =>
      $composableBuilder(column: $table.vatAmount, builder: (column) => column);

  GeneratedColumn<double> get total =>
      $composableBuilder(column: $table.total, builder: (column) => column);

  GeneratedColumn<String> get paymentMethod => $composableBuilder(
      column: $table.paymentMethod, builder: (column) => column);

  GeneratedColumn<String> get mpesaRef =>
      $composableBuilder(column: $table.mpesaRef, builder: (column) => column);

  GeneratedColumn<String> get roomNumber => $composableBuilder(
      column: $table.roomNumber, builder: (column) => column);

  GeneratedColumn<int> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<String> get syncStatus => $composableBuilder(
      column: $table.syncStatus, builder: (column) => column);
}

class $$OfflineSalesTableTableManager extends RootTableManager<
    _$AppDatabase,
    $OfflineSalesTable,
    OfflineSaleEntry,
    $$OfflineSalesTableFilterComposer,
    $$OfflineSalesTableOrderingComposer,
    $$OfflineSalesTableAnnotationComposer,
    $$OfflineSalesTableCreateCompanionBuilder,
    $$OfflineSalesTableUpdateCompanionBuilder,
    (
      OfflineSaleEntry,
      BaseReferences<_$AppDatabase, $OfflineSalesTable, OfflineSaleEntry>
    ),
    OfflineSaleEntry,
    PrefetchHooks Function()> {
  $$OfflineSalesTableTableManager(_$AppDatabase db, $OfflineSalesTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OfflineSalesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$OfflineSalesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OfflineSalesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> localId = const Value.absent(),
            Value<String> branchId = const Value.absent(),
            Value<String> cashierId = const Value.absent(),
            Value<String> itemsJson = const Value.absent(),
            Value<double> subtotal = const Value.absent(),
            Value<double> vatAmount = const Value.absent(),
            Value<double> total = const Value.absent(),
            Value<String> paymentMethod = const Value.absent(),
            Value<String?> mpesaRef = const Value.absent(),
            Value<String?> roomNumber = const Value.absent(),
            Value<int> createdAt = const Value.absent(),
            Value<String> syncStatus = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              OfflineSalesCompanion(
            localId: localId,
            branchId: branchId,
            cashierId: cashierId,
            itemsJson: itemsJson,
            subtotal: subtotal,
            vatAmount: vatAmount,
            total: total,
            paymentMethod: paymentMethod,
            mpesaRef: mpesaRef,
            roomNumber: roomNumber,
            createdAt: createdAt,
            syncStatus: syncStatus,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String localId,
            required String branchId,
            required String cashierId,
            required String itemsJson,
            required double subtotal,
            required double vatAmount,
            required double total,
            required String paymentMethod,
            Value<String?> mpesaRef = const Value.absent(),
            Value<String?> roomNumber = const Value.absent(),
            required int createdAt,
            Value<String> syncStatus = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              OfflineSalesCompanion.insert(
            localId: localId,
            branchId: branchId,
            cashierId: cashierId,
            itemsJson: itemsJson,
            subtotal: subtotal,
            vatAmount: vatAmount,
            total: total,
            paymentMethod: paymentMethod,
            mpesaRef: mpesaRef,
            roomNumber: roomNumber,
            createdAt: createdAt,
            syncStatus: syncStatus,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$OfflineSalesTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $OfflineSalesTable,
    OfflineSaleEntry,
    $$OfflineSalesTableFilterComposer,
    $$OfflineSalesTableOrderingComposer,
    $$OfflineSalesTableAnnotationComposer,
    $$OfflineSalesTableCreateCompanionBuilder,
    $$OfflineSalesTableUpdateCompanionBuilder,
    (
      OfflineSaleEntry,
      BaseReferences<_$AppDatabase, $OfflineSalesTable, OfflineSaleEntry>
    ),
    OfflineSaleEntry,
    PrefetchHooks Function()>;
typedef $$HeldOrdersTableCreateCompanionBuilder = HeldOrdersCompanion Function({
  required String id,
  Value<String?> label,
  required String itemsJson,
  required double subtotal,
  required int createdAt,
  Value<int> rowid,
});
typedef $$HeldOrdersTableUpdateCompanionBuilder = HeldOrdersCompanion Function({
  Value<String> id,
  Value<String?> label,
  Value<String> itemsJson,
  Value<double> subtotal,
  Value<int> createdAt,
  Value<int> rowid,
});

class $$HeldOrdersTableFilterComposer
    extends Composer<_$AppDatabase, $HeldOrdersTable> {
  $$HeldOrdersTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get label => $composableBuilder(
      column: $table.label, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get itemsJson => $composableBuilder(
      column: $table.itemsJson, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get subtotal => $composableBuilder(
      column: $table.subtotal, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));
}

class $$HeldOrdersTableOrderingComposer
    extends Composer<_$AppDatabase, $HeldOrdersTable> {
  $$HeldOrdersTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get label => $composableBuilder(
      column: $table.label, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get itemsJson => $composableBuilder(
      column: $table.itemsJson, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get subtotal => $composableBuilder(
      column: $table.subtotal, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));
}

class $$HeldOrdersTableAnnotationComposer
    extends Composer<_$AppDatabase, $HeldOrdersTable> {
  $$HeldOrdersTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get label =>
      $composableBuilder(column: $table.label, builder: (column) => column);

  GeneratedColumn<String> get itemsJson =>
      $composableBuilder(column: $table.itemsJson, builder: (column) => column);

  GeneratedColumn<double> get subtotal =>
      $composableBuilder(column: $table.subtotal, builder: (column) => column);

  GeneratedColumn<int> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$HeldOrdersTableTableManager extends RootTableManager<
    _$AppDatabase,
    $HeldOrdersTable,
    HeldOrderEntry,
    $$HeldOrdersTableFilterComposer,
    $$HeldOrdersTableOrderingComposer,
    $$HeldOrdersTableAnnotationComposer,
    $$HeldOrdersTableCreateCompanionBuilder,
    $$HeldOrdersTableUpdateCompanionBuilder,
    (
      HeldOrderEntry,
      BaseReferences<_$AppDatabase, $HeldOrdersTable, HeldOrderEntry>
    ),
    HeldOrderEntry,
    PrefetchHooks Function()> {
  $$HeldOrdersTableTableManager(_$AppDatabase db, $HeldOrdersTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$HeldOrdersTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$HeldOrdersTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$HeldOrdersTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String?> label = const Value.absent(),
            Value<String> itemsJson = const Value.absent(),
            Value<double> subtotal = const Value.absent(),
            Value<int> createdAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              HeldOrdersCompanion(
            id: id,
            label: label,
            itemsJson: itemsJson,
            subtotal: subtotal,
            createdAt: createdAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            Value<String?> label = const Value.absent(),
            required String itemsJson,
            required double subtotal,
            required int createdAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              HeldOrdersCompanion.insert(
            id: id,
            label: label,
            itemsJson: itemsJson,
            subtotal: subtotal,
            createdAt: createdAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$HeldOrdersTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $HeldOrdersTable,
    HeldOrderEntry,
    $$HeldOrdersTableFilterComposer,
    $$HeldOrdersTableOrderingComposer,
    $$HeldOrdersTableAnnotationComposer,
    $$HeldOrdersTableCreateCompanionBuilder,
    $$HeldOrdersTableUpdateCompanionBuilder,
    (
      HeldOrderEntry,
      BaseReferences<_$AppDatabase, $HeldOrdersTable, HeldOrderEntry>
    ),
    HeldOrderEntry,
    PrefetchHooks Function()>;
typedef $$CachedNotificationsTableCreateCompanionBuilder
    = CachedNotificationsCompanion Function({
  required String id,
  required String title,
  required String body,
  required String type,
  Value<bool> isRead,
  required int createdAt,
  Value<int> rowid,
});
typedef $$CachedNotificationsTableUpdateCompanionBuilder
    = CachedNotificationsCompanion Function({
  Value<String> id,
  Value<String> title,
  Value<String> body,
  Value<String> type,
  Value<bool> isRead,
  Value<int> createdAt,
  Value<int> rowid,
});

class $$CachedNotificationsTableFilterComposer
    extends Composer<_$AppDatabase, $CachedNotificationsTable> {
  $$CachedNotificationsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get title => $composableBuilder(
      column: $table.title, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get body => $composableBuilder(
      column: $table.body, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get type => $composableBuilder(
      column: $table.type, builder: (column) => ColumnFilters(column));

  ColumnFilters<bool> get isRead => $composableBuilder(
      column: $table.isRead, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));
}

class $$CachedNotificationsTableOrderingComposer
    extends Composer<_$AppDatabase, $CachedNotificationsTable> {
  $$CachedNotificationsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get title => $composableBuilder(
      column: $table.title, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get body => $composableBuilder(
      column: $table.body, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get type => $composableBuilder(
      column: $table.type, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<bool> get isRead => $composableBuilder(
      column: $table.isRead, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));
}

class $$CachedNotificationsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CachedNotificationsTable> {
  $$CachedNotificationsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<String> get body =>
      $composableBuilder(column: $table.body, builder: (column) => column);

  GeneratedColumn<String> get type =>
      $composableBuilder(column: $table.type, builder: (column) => column);

  GeneratedColumn<bool> get isRead =>
      $composableBuilder(column: $table.isRead, builder: (column) => column);

  GeneratedColumn<int> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$CachedNotificationsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $CachedNotificationsTable,
    CachedNotificationEntry,
    $$CachedNotificationsTableFilterComposer,
    $$CachedNotificationsTableOrderingComposer,
    $$CachedNotificationsTableAnnotationComposer,
    $$CachedNotificationsTableCreateCompanionBuilder,
    $$CachedNotificationsTableUpdateCompanionBuilder,
    (
      CachedNotificationEntry,
      BaseReferences<_$AppDatabase, $CachedNotificationsTable,
          CachedNotificationEntry>
    ),
    CachedNotificationEntry,
    PrefetchHooks Function()> {
  $$CachedNotificationsTableTableManager(
      _$AppDatabase db, $CachedNotificationsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CachedNotificationsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CachedNotificationsTableOrderingComposer(
                  $db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CachedNotificationsTableAnnotationComposer(
                  $db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String> title = const Value.absent(),
            Value<String> body = const Value.absent(),
            Value<String> type = const Value.absent(),
            Value<bool> isRead = const Value.absent(),
            Value<int> createdAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              CachedNotificationsCompanion(
            id: id,
            title: title,
            body: body,
            type: type,
            isRead: isRead,
            createdAt: createdAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String id,
            required String title,
            required String body,
            required String type,
            Value<bool> isRead = const Value.absent(),
            required int createdAt,
            Value<int> rowid = const Value.absent(),
          }) =>
              CachedNotificationsCompanion.insert(
            id: id,
            title: title,
            body: body,
            type: type,
            isRead: isRead,
            createdAt: createdAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$CachedNotificationsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $CachedNotificationsTable,
    CachedNotificationEntry,
    $$CachedNotificationsTableFilterComposer,
    $$CachedNotificationsTableOrderingComposer,
    $$CachedNotificationsTableAnnotationComposer,
    $$CachedNotificationsTableCreateCompanionBuilder,
    $$CachedNotificationsTableUpdateCompanionBuilder,
    (
      CachedNotificationEntry,
      BaseReferences<_$AppDatabase, $CachedNotificationsTable,
          CachedNotificationEntry>
    ),
    CachedNotificationEntry,
    PrefetchHooks Function()>;
typedef $$ScanSessionsTableCreateCompanionBuilder = ScanSessionsCompanion
    Function({
  required String localId,
  required String sessionType,
  Value<String?> sessionRef,
  required String barcode,
  Value<String?> itemId,
  required String itemSku,
  required String itemName,
  required String itemUnit,
  Value<double> scannedQuantity,
  Value<double?> systemStock,
  required int scannedAt,
  Value<bool> synced,
  Value<int> rowid,
});
typedef $$ScanSessionsTableUpdateCompanionBuilder = ScanSessionsCompanion
    Function({
  Value<String> localId,
  Value<String> sessionType,
  Value<String?> sessionRef,
  Value<String> barcode,
  Value<String?> itemId,
  Value<String> itemSku,
  Value<String> itemName,
  Value<String> itemUnit,
  Value<double> scannedQuantity,
  Value<double?> systemStock,
  Value<int> scannedAt,
  Value<bool> synced,
  Value<int> rowid,
});

class $$ScanSessionsTableFilterComposer
    extends Composer<_$AppDatabase, $ScanSessionsTable> {
  $$ScanSessionsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get localId => $composableBuilder(
      column: $table.localId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get sessionType => $composableBuilder(
      column: $table.sessionType, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get sessionRef => $composableBuilder(
      column: $table.sessionRef, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get barcode => $composableBuilder(
      column: $table.barcode, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get itemId => $composableBuilder(
      column: $table.itemId, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get itemSku => $composableBuilder(
      column: $table.itemSku, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get itemName => $composableBuilder(
      column: $table.itemName, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get itemUnit => $composableBuilder(
      column: $table.itemUnit, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get scannedQuantity => $composableBuilder(
      column: $table.scannedQuantity,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get systemStock => $composableBuilder(
      column: $table.systemStock, builder: (column) => ColumnFilters(column));

  ColumnFilters<int> get scannedAt => $composableBuilder(
      column: $table.scannedAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<bool> get synced => $composableBuilder(
      column: $table.synced, builder: (column) => ColumnFilters(column));
}

class $$ScanSessionsTableOrderingComposer
    extends Composer<_$AppDatabase, $ScanSessionsTable> {
  $$ScanSessionsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get localId => $composableBuilder(
      column: $table.localId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get sessionType => $composableBuilder(
      column: $table.sessionType, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get sessionRef => $composableBuilder(
      column: $table.sessionRef, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get barcode => $composableBuilder(
      column: $table.barcode, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get itemId => $composableBuilder(
      column: $table.itemId, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get itemSku => $composableBuilder(
      column: $table.itemSku, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get itemName => $composableBuilder(
      column: $table.itemName, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get itemUnit => $composableBuilder(
      column: $table.itemUnit, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get scannedQuantity => $composableBuilder(
      column: $table.scannedQuantity,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get systemStock => $composableBuilder(
      column: $table.systemStock, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<int> get scannedAt => $composableBuilder(
      column: $table.scannedAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<bool> get synced => $composableBuilder(
      column: $table.synced, builder: (column) => ColumnOrderings(column));
}

class $$ScanSessionsTableAnnotationComposer
    extends Composer<_$AppDatabase, $ScanSessionsTable> {
  $$ScanSessionsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get localId =>
      $composableBuilder(column: $table.localId, builder: (column) => column);

  GeneratedColumn<String> get sessionType => $composableBuilder(
      column: $table.sessionType, builder: (column) => column);

  GeneratedColumn<String> get sessionRef => $composableBuilder(
      column: $table.sessionRef, builder: (column) => column);

  GeneratedColumn<String> get barcode =>
      $composableBuilder(column: $table.barcode, builder: (column) => column);

  GeneratedColumn<String> get itemId =>
      $composableBuilder(column: $table.itemId, builder: (column) => column);

  GeneratedColumn<String> get itemSku =>
      $composableBuilder(column: $table.itemSku, builder: (column) => column);

  GeneratedColumn<String> get itemName =>
      $composableBuilder(column: $table.itemName, builder: (column) => column);

  GeneratedColumn<String> get itemUnit =>
      $composableBuilder(column: $table.itemUnit, builder: (column) => column);

  GeneratedColumn<double> get scannedQuantity => $composableBuilder(
      column: $table.scannedQuantity, builder: (column) => column);

  GeneratedColumn<double> get systemStock => $composableBuilder(
      column: $table.systemStock, builder: (column) => column);

  GeneratedColumn<int> get scannedAt =>
      $composableBuilder(column: $table.scannedAt, builder: (column) => column);

  GeneratedColumn<bool> get synced =>
      $composableBuilder(column: $table.synced, builder: (column) => column);
}

class $$ScanSessionsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $ScanSessionsTable,
    ScanSessionEntry,
    $$ScanSessionsTableFilterComposer,
    $$ScanSessionsTableOrderingComposer,
    $$ScanSessionsTableAnnotationComposer,
    $$ScanSessionsTableCreateCompanionBuilder,
    $$ScanSessionsTableUpdateCompanionBuilder,
    (
      ScanSessionEntry,
      BaseReferences<_$AppDatabase, $ScanSessionsTable, ScanSessionEntry>
    ),
    ScanSessionEntry,
    PrefetchHooks Function()> {
  $$ScanSessionsTableTableManager(_$AppDatabase db, $ScanSessionsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ScanSessionsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ScanSessionsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ScanSessionsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> localId = const Value.absent(),
            Value<String> sessionType = const Value.absent(),
            Value<String?> sessionRef = const Value.absent(),
            Value<String> barcode = const Value.absent(),
            Value<String?> itemId = const Value.absent(),
            Value<String> itemSku = const Value.absent(),
            Value<String> itemName = const Value.absent(),
            Value<String> itemUnit = const Value.absent(),
            Value<double> scannedQuantity = const Value.absent(),
            Value<double?> systemStock = const Value.absent(),
            Value<int> scannedAt = const Value.absent(),
            Value<bool> synced = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              ScanSessionsCompanion(
            localId: localId,
            sessionType: sessionType,
            sessionRef: sessionRef,
            barcode: barcode,
            itemId: itemId,
            itemSku: itemSku,
            itemName: itemName,
            itemUnit: itemUnit,
            scannedQuantity: scannedQuantity,
            systemStock: systemStock,
            scannedAt: scannedAt,
            synced: synced,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String localId,
            required String sessionType,
            Value<String?> sessionRef = const Value.absent(),
            required String barcode,
            Value<String?> itemId = const Value.absent(),
            required String itemSku,
            required String itemName,
            required String itemUnit,
            Value<double> scannedQuantity = const Value.absent(),
            Value<double?> systemStock = const Value.absent(),
            required int scannedAt,
            Value<bool> synced = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              ScanSessionsCompanion.insert(
            localId: localId,
            sessionType: sessionType,
            sessionRef: sessionRef,
            barcode: barcode,
            itemId: itemId,
            itemSku: itemSku,
            itemName: itemName,
            itemUnit: itemUnit,
            scannedQuantity: scannedQuantity,
            systemStock: systemStock,
            scannedAt: scannedAt,
            synced: synced,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$ScanSessionsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $ScanSessionsTable,
    ScanSessionEntry,
    $$ScanSessionsTableFilterComposer,
    $$ScanSessionsTableOrderingComposer,
    $$ScanSessionsTableAnnotationComposer,
    $$ScanSessionsTableCreateCompanionBuilder,
    $$ScanSessionsTableUpdateCompanionBuilder,
    (
      ScanSessionEntry,
      BaseReferences<_$AppDatabase, $ScanSessionsTable, ScanSessionEntry>
    ),
    ScanSessionEntry,
    PrefetchHooks Function()>;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$ProductsCacheTableTableManager get productsCache =>
      $$ProductsCacheTableTableManager(_db, _db.productsCache);
  $$OfflineSalesTableTableManager get offlineSales =>
      $$OfflineSalesTableTableManager(_db, _db.offlineSales);
  $$HeldOrdersTableTableManager get heldOrders =>
      $$HeldOrdersTableTableManager(_db, _db.heldOrders);
  $$CachedNotificationsTableTableManager get cachedNotifications =>
      $$CachedNotificationsTableTableManager(_db, _db.cachedNotifications);
  $$ScanSessionsTableTableManager get scanSessions =>
      $$ScanSessionsTableTableManager(_db, _db.scanSessions);
}

mixin _$ProductsCacheDaoMixin on DatabaseAccessor<AppDatabase> {
  $ProductsCacheTable get productsCache => attachedDatabase.productsCache;
}
mixin _$OfflineSalesDaoMixin on DatabaseAccessor<AppDatabase> {
  $OfflineSalesTable get offlineSales => attachedDatabase.offlineSales;
}
mixin _$HeldOrdersDaoMixin on DatabaseAccessor<AppDatabase> {
  $HeldOrdersTable get heldOrders => attachedDatabase.heldOrders;
}
mixin _$NotificationsDaoMixin on DatabaseAccessor<AppDatabase> {
  $CachedNotificationsTable get cachedNotifications =>
      attachedDatabase.cachedNotifications;
}
mixin _$ScanSessionsDaoMixin on DatabaseAccessor<AppDatabase> {
  $ScanSessionsTable get scanSessions => attachedDatabase.scanSessions;
}
