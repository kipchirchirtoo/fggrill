import 'package:freezed_annotation/freezed_annotation.dart';
part 'room.freezed.dart';
part 'room.g.dart';

@freezed
class AdminRoom with _$AdminRoom {
  const factory AdminRoom({
    @Default('') String id,
    @Default('') String roomNumber,
    @Default('') String type,
    @Default('') String branchId,
    @Default('') String branchName,
    @Default(0) int floor,
    @Default(0.0) double price,
    @Default('available') String status,
    @Default('') String description,
    @Default([]) List<String> amenities,
    @Default(2) int capacity,
    @Default(false) bool isSmoking,
  }) = _AdminRoom;

  factory AdminRoom.fromJson(Map<String, dynamic> json) =>
      _$AdminRoomFromJson(json);
}
