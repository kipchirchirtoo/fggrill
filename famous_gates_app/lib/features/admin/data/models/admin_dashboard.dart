// ignore_for_file: invalid_annotation_target

import 'package:freezed_annotation/freezed_annotation.dart';
part 'admin_dashboard.freezed.dart';
part 'admin_dashboard.g.dart';

@freezed
class AdminDashboard with _$AdminDashboard {
  const factory AdminDashboard({
    @JsonKey(name: 'logins_today') @Default(0) int loginsToday,
    @JsonKey(name: 'failed_logins') @Default(0) int failedLogins,
    @JsonKey(name: 'active_sessions') @Default(0) int activeSessions,
    @JsonKey(name: 'total_branches') @Default(0) int totalBranches,
    @JsonKey(name: 'total_users') @Default(0) int totalUsers,
    @JsonKey(name: 'total_staff') @Default(0) int totalStaff,
    @JsonKey(name: 'total_rooms') @Default(0) int totalRooms,
    @JsonKey(name: 'occupied_rooms') @Default(0) int occupiedRooms,
    @JsonKey(name: 'today_revenue') @Default(0.0) double todayRevenue,
    @JsonKey(name: 'monthly_revenue') @Default(0.0) double monthlyRevenue,
    @Default([]) List<RevenueDataPoint> revenueTrend,
    @Default([]) List<OccupancyDataPoint> occupancyTrend,
    @Default([]) List<RecentActivity> recentActivity,
  }) = _AdminDashboard;

  factory AdminDashboard.fromJson(Map<String, dynamic> json) =>
      _$AdminDashboardFromJson(json);
}

@freezed
class RevenueDataPoint with _$RevenueDataPoint {
  const factory RevenueDataPoint({
    @Default('') String label,
    @Default(0.0) double revenue,
  }) = _RevenueDataPoint;

  factory RevenueDataPoint.fromJson(Map<String, dynamic> json) =>
      _$RevenueDataPointFromJson(json);
}

@freezed
class OccupancyDataPoint with _$OccupancyDataPoint {
  const factory OccupancyDataPoint({
    @Default('') String label,
    @Default(0.0) double occupancy,
  }) = _OccupancyDataPoint;

  factory OccupancyDataPoint.fromJson(Map<String, dynamic> json) =>
      _$OccupancyDataPointFromJson(json);
}

@freezed
class RecentActivity with _$RecentActivity {
  const factory RecentActivity({
    @Default('') String id,
    @Default('') String action,
    @Default('') String description,
    @Default('') String userName,
    @Default('info') String type,
    @DateTimeConverter() DateTime? createdAt,
  }) = _RecentActivity;

  factory RecentActivity.fromJson(Map<String, dynamic> json) =>
      _$RecentActivityFromJson(json);
}

class DateTimeConverter implements JsonConverter<DateTime?, String?> {
  const DateTimeConverter();

  @override
  DateTime? fromJson(String? json) =>
      json == null ? null : DateTime.tryParse(json);

  @override
  String? toJson(DateTime? object) => object?.toIso8601String();
}
