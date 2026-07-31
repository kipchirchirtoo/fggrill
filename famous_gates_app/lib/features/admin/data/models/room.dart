import 'package:freezed_annotation/freezed_annotation.dart';
part 'room.freezed.dart';
part 'room.g.dart';

@freezed
class AdminRoom with _$AdminRoom {
  const factory AdminRoom({
    @Default('') String id,
    @Default('') String roomNumber,
    @Default('') String type,
    @Default('') String roomTypeId,
    @Default('') String branchId,
    @Default('') String branchName,
    @Default(0) int floor,
    @Default('') String building,
    @Default(0.0) double price,
    @Default('available') String status,
    @Default('') String description,
    @Default([]) List<String> amenities,
    @Default(2) int capacity,
    @Default(false) bool isSmoking,
    @Default(true) bool isActive,
    @Default('') String imageUrl,
  }) = _AdminRoom;

  factory AdminRoom.fromJson(Map<String, dynamic> json) =>
      _$AdminRoomFromJson(json);
}

class AdminRoomType {
  final String id;
  final String name;
  final String description;
  final double basePrice;
  final int capacity;
  final List<String> amenities;
  final bool isActive;

  AdminRoomType({
    required this.id,
    required this.name,
    required this.description,
    required this.basePrice,
    required this.capacity,
    required this.amenities,
    required this.isActive,
  });

  factory AdminRoomType.fromJson(Map<String, dynamic> json) {
    return AdminRoomType(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      basePrice: double.tryParse(json['base_price']?.toString() ?? '0') ?? 0.0,
      capacity: int.tryParse(json['capacity']?.toString() ?? '2') ?? 2,
      amenities: (json['amenities'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      isActive: json['is_active'] ?? true,
    );
  }
}

/// A sellable ROOM PACKAGE = room type + meal plan + nightly rate + extra-pax
/// pricing + validity, scoped to a branch (or global when branchId is null).
class AdminRatePlan {
  final String id;
  final int? branchId;
  final String code;
  final String name;
  final String description;
  final String? roomTypeId;
  final String? roomTypeName;
  final String? mealPlanId;
  final String? mealPlanName;
  final double ratePerNight;
  final double extraAdultCharge;
  final double extraChildCharge;
  final double extraBedCharge;
  final int? maxOccupancy;
  final int minStay;
  final int? maxStay;
  final String? validFrom;
  final String? validTo;
  final bool isDefaultForReception;
  final bool isActive;

  AdminRatePlan({
    required this.id,
    this.branchId,
    required this.code,
    required this.name,
    required this.description,
    this.roomTypeId,
    this.roomTypeName,
    this.mealPlanId,
    this.mealPlanName,
    required this.ratePerNight,
    required this.extraAdultCharge,
    required this.extraChildCharge,
    required this.extraBedCharge,
    this.maxOccupancy,
    required this.minStay,
    this.maxStay,
    this.validFrom,
    this.validTo,
    required this.isDefaultForReception,
    required this.isActive,
  });

  bool get isGlobal => branchId == null;

  String get validityLabel {
    if (validFrom == null && validTo == null) return 'Always valid';
    final from = validFrom?.split('T').first ?? '…';
    final to = validTo?.split('T').first ?? '…';
    return '$from → $to';
  }

  factory AdminRatePlan.fromJson(Map<String, dynamic> json) {
    double d(dynamic v) =>
        v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0.0;
    int? i(dynamic v) => v == null ? null : int.tryParse('$v');
    bool b(dynamic v, [bool def = false]) => v is bool
        ? v
        : (v is String ? ['true', '1', 'yes'].contains(v.toLowerCase()) : def);
    String? s(dynamic v) => v == null ? null : v.toString();

    return AdminRatePlan(
      id: json['id']?.toString() ?? '',
      branchId: i(json['branchId'] ?? json['branch_id']),
      code: json['code']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      roomTypeId: s(json['roomTypeId'] ?? json['room_type_id']),
      roomTypeName: s(json['roomTypeName'] ?? json['room_type_name']),
      mealPlanId: s(json['mealPlanId'] ?? json['meal_plan_id']),
      mealPlanName: s(json['mealPlanName'] ?? json['meal_plan_name']),
      ratePerNight: d(json['ratePerNight'] ?? json['rate_per_night']),
      extraAdultCharge: d(json['extraAdultCharge'] ?? json['extra_adult_charge']),
      extraChildCharge: d(json['extraChildCharge'] ?? json['extra_child_charge']),
      extraBedCharge: d(json['extraBedCharge'] ?? json['extra_bed_charge']),
      maxOccupancy: i(json['maxOccupancy'] ?? json['max_occupancy']),
      minStay: i(json['minStay'] ?? json['min_stay']) ?? 1,
      maxStay: i(json['maxStay'] ?? json['max_stay']),
      validFrom: s(json['validFrom'] ?? json['valid_from']),
      validTo: s(json['validTo'] ?? json['valid_to']),
      isDefaultForReception:
          b(json['isDefaultForReception'] ?? json['is_default_for_reception']),
      isActive: b(json['isActive'] ?? json['active'] ?? json['is_active'], true),
    );
  }
}

class AdminMealPlan {
  final String id;
  final int? branchId; // null = global (all branches)
  final String code;
  final String name;
  final String description;
  final bool includesBreakfast;
  final bool includesLunch;
  final bool includesDinner;
  final bool includesSnacks;
  final bool includesDrinks;
  final double adultDailyPrice;
  final double childDailyPrice;
  final double infantDailyPrice;
  final bool includedInRoomRate;
  final bool isDefault;
  final bool isActive;

  AdminMealPlan({
    required this.id,
    this.branchId,
    required this.code,
    required this.name,
    required this.description,
    required this.includesBreakfast,
    required this.includesLunch,
    required this.includesDinner,
    required this.includesSnacks,
    required this.includesDrinks,
    required this.adultDailyPrice,
    required this.childDailyPrice,
    required this.infantDailyPrice,
    required this.includedInRoomRate,
    required this.isDefault,
    required this.isActive,
  });

  static bool _b(dynamic v, [bool d = false]) {
    if (v is bool) return v;
    if (v is String) return ['true', '1', 'yes'].contains(v.toLowerCase());
    return d;
  }

  static double _d(dynamic v) =>
      v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0.0;

  static int? _branch(dynamic v) => v == null ? null : int.tryParse('$v');

  bool get isGlobal => branchId == null;

  List<String> get includedMeals => [
        if (includesBreakfast) 'Breakfast',
        if (includesLunch) 'Lunch',
        if (includesDinner) 'Dinner',
        if (includesSnacks) 'Snacks',
        if (includesDrinks) 'Drinks',
      ];

  factory AdminMealPlan.fromJson(Map<String, dynamic> json) {
    return AdminMealPlan(
      id: json['id']?.toString() ?? '',
      branchId: _branch(json['branchId'] ?? json['branch_id']),
      code: json['code']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      includesBreakfast: _b(json['includesBreakfast'] ?? json['includes_breakfast']),
      includesLunch: _b(json['includesLunch'] ?? json['includes_lunch']),
      includesDinner: _b(json['includesDinner'] ?? json['includes_dinner']),
      includesSnacks: _b(json['includesSnacks'] ?? json['includes_snacks']),
      includesDrinks: _b(json['includesDrinks'] ?? json['includes_drinks']),
      adultDailyPrice: _d(json['adultDailyPrice'] ?? json['adult_daily_price']),
      childDailyPrice: _d(json['childDailyPrice'] ?? json['child_daily_price']),
      infantDailyPrice: _d(json['infantDailyPrice'] ?? json['infant_daily_price']),
      includedInRoomRate: _b(json['includedInRoomRate'] ?? json['included_in_room_rate'], true),
      isDefault: _b(json['isDefault'] ?? json['is_default']),
      isActive: _b(json['isActive'] ?? json['is_active'], true),
    );
  }
}
