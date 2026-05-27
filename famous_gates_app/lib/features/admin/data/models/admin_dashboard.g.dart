// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_dashboard.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AdminDashboardImpl _$$AdminDashboardImplFromJson(Map<String, dynamic> json) =>
    _$AdminDashboardImpl(
      loginsToday: (json['logins_today'] as num?)?.toInt() ?? 0,
      failedLogins: (json['failed_logins'] as num?)?.toInt() ?? 0,
      activeSessions: (json['active_sessions'] as num?)?.toInt() ?? 0,
      totalBranches: (json['total_branches'] as num?)?.toInt() ?? 0,
      totalUsers: (json['total_users'] as num?)?.toInt() ?? 0,
      totalStaff: (json['total_staff'] as num?)?.toInt() ?? 0,
      totalRooms: (json['total_rooms'] as num?)?.toInt() ?? 0,
      occupiedRooms: (json['occupied_rooms'] as num?)?.toInt() ?? 0,
      todayRevenue: (json['today_revenue'] as num?)?.toDouble() ?? 0.0,
      monthlyRevenue: (json['monthly_revenue'] as num?)?.toDouble() ?? 0.0,
      revenueTrend: (json['revenueTrend'] as List<dynamic>?)
              ?.map((e) => RevenueDataPoint.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      occupancyTrend: (json['occupancyTrend'] as List<dynamic>?)
              ?.map(
                  (e) => OccupancyDataPoint.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      recentActivity: (json['recentActivity'] as List<dynamic>?)
              ?.map((e) => RecentActivity.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );

Map<String, dynamic> _$$AdminDashboardImplToJson(
        _$AdminDashboardImpl instance) =>
    <String, dynamic>{
      'logins_today': instance.loginsToday,
      'failed_logins': instance.failedLogins,
      'active_sessions': instance.activeSessions,
      'total_branches': instance.totalBranches,
      'total_users': instance.totalUsers,
      'total_staff': instance.totalStaff,
      'total_rooms': instance.totalRooms,
      'occupied_rooms': instance.occupiedRooms,
      'today_revenue': instance.todayRevenue,
      'monthly_revenue': instance.monthlyRevenue,
      'revenueTrend': instance.revenueTrend,
      'occupancyTrend': instance.occupancyTrend,
      'recentActivity': instance.recentActivity,
    };

_$RevenueDataPointImpl _$$RevenueDataPointImplFromJson(
        Map<String, dynamic> json) =>
    _$RevenueDataPointImpl(
      label: json['label'] as String? ?? '',
      revenue: (json['revenue'] as num?)?.toDouble() ?? 0.0,
    );

Map<String, dynamic> _$$RevenueDataPointImplToJson(
        _$RevenueDataPointImpl instance) =>
    <String, dynamic>{
      'label': instance.label,
      'revenue': instance.revenue,
    };

_$OccupancyDataPointImpl _$$OccupancyDataPointImplFromJson(
        Map<String, dynamic> json) =>
    _$OccupancyDataPointImpl(
      label: json['label'] as String? ?? '',
      occupancy: (json['occupancy'] as num?)?.toDouble() ?? 0.0,
    );

Map<String, dynamic> _$$OccupancyDataPointImplToJson(
        _$OccupancyDataPointImpl instance) =>
    <String, dynamic>{
      'label': instance.label,
      'occupancy': instance.occupancy,
    };

_$RecentActivityImpl _$$RecentActivityImplFromJson(Map<String, dynamic> json) =>
    _$RecentActivityImpl(
      id: json['id'] as String? ?? '',
      action: json['action'] as String? ?? '',
      description: json['description'] as String? ?? '',
      userName: json['userName'] as String? ?? '',
      type: json['type'] as String? ?? 'info',
      createdAt:
          const DateTimeConverter().fromJson(json['createdAt'] as String?),
    );

Map<String, dynamic> _$$RecentActivityImplToJson(
        _$RecentActivityImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'action': instance.action,
      'description': instance.description,
      'userName': instance.userName,
      'type': instance.type,
      'createdAt': const DateTimeConverter().toJson(instance.createdAt),
    };
