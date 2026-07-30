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

class AdminRatePlan {
  final String id;
  final String name;
  final String description;
  final String rateType; // FIXED, PERCENTAGE
  final double multiplier;
  final double fixedAmount;
  final int minNights;
  final bool refundable;
  final bool active;

  AdminRatePlan({
    required this.id,
    required this.name,
    required this.description,
    required this.rateType,
    required this.multiplier,
    required this.fixedAmount,
    required this.minNights,
    required this.refundable,
    required this.active,
  });

  factory AdminRatePlan.fromJson(Map<String, dynamic> json) {
    return AdminRatePlan(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      rateType: json['rate_type']?.toString() ?? 'FIXED',
      multiplier: double.tryParse(json['multiplier']?.toString() ?? '1') ?? 1.0,
      fixedAmount: double.tryParse(json['fixed_amount']?.toString() ?? '0') ?? 0.0,
      minNights: int.tryParse(json['min_nights']?.toString() ?? '1') ?? 1,
      refundable: json['refundable'] ?? true,
      active: json['active'] ?? true,
    );
  }
}
