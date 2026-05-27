// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'admin_dashboard.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AdminDashboard _$AdminDashboardFromJson(Map<String, dynamic> json) {
  return _AdminDashboard.fromJson(json);
}

/// @nodoc
mixin _$AdminDashboard {
  @JsonKey(name: 'logins_today')
  int get loginsToday => throw _privateConstructorUsedError;
  @JsonKey(name: 'failed_logins')
  int get failedLogins => throw _privateConstructorUsedError;
  @JsonKey(name: 'active_sessions')
  int get activeSessions => throw _privateConstructorUsedError;
  @JsonKey(name: 'total_branches')
  int get totalBranches => throw _privateConstructorUsedError;
  @JsonKey(name: 'total_users')
  int get totalUsers => throw _privateConstructorUsedError;
  @JsonKey(name: 'total_staff')
  int get totalStaff => throw _privateConstructorUsedError;
  @JsonKey(name: 'total_rooms')
  int get totalRooms => throw _privateConstructorUsedError;
  @JsonKey(name: 'occupied_rooms')
  int get occupiedRooms => throw _privateConstructorUsedError;
  @JsonKey(name: 'today_revenue')
  double get todayRevenue => throw _privateConstructorUsedError;
  @JsonKey(name: 'monthly_revenue')
  double get monthlyRevenue => throw _privateConstructorUsedError;
  List<RevenueDataPoint> get revenueTrend => throw _privateConstructorUsedError;
  List<OccupancyDataPoint> get occupancyTrend =>
      throw _privateConstructorUsedError;
  List<RecentActivity> get recentActivity => throw _privateConstructorUsedError;

  /// Serializes this AdminDashboard to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdminDashboard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdminDashboardCopyWith<AdminDashboard> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdminDashboardCopyWith<$Res> {
  factory $AdminDashboardCopyWith(
          AdminDashboard value, $Res Function(AdminDashboard) then) =
      _$AdminDashboardCopyWithImpl<$Res, AdminDashboard>;
  @useResult
  $Res call(
      {@JsonKey(name: 'logins_today') int loginsToday,
      @JsonKey(name: 'failed_logins') int failedLogins,
      @JsonKey(name: 'active_sessions') int activeSessions,
      @JsonKey(name: 'total_branches') int totalBranches,
      @JsonKey(name: 'total_users') int totalUsers,
      @JsonKey(name: 'total_staff') int totalStaff,
      @JsonKey(name: 'total_rooms') int totalRooms,
      @JsonKey(name: 'occupied_rooms') int occupiedRooms,
      @JsonKey(name: 'today_revenue') double todayRevenue,
      @JsonKey(name: 'monthly_revenue') double monthlyRevenue,
      List<RevenueDataPoint> revenueTrend,
      List<OccupancyDataPoint> occupancyTrend,
      List<RecentActivity> recentActivity});
}

/// @nodoc
class _$AdminDashboardCopyWithImpl<$Res, $Val extends AdminDashboard>
    implements $AdminDashboardCopyWith<$Res> {
  _$AdminDashboardCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdminDashboard
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? loginsToday = null,
    Object? failedLogins = null,
    Object? activeSessions = null,
    Object? totalBranches = null,
    Object? totalUsers = null,
    Object? totalStaff = null,
    Object? totalRooms = null,
    Object? occupiedRooms = null,
    Object? todayRevenue = null,
    Object? monthlyRevenue = null,
    Object? revenueTrend = null,
    Object? occupancyTrend = null,
    Object? recentActivity = null,
  }) {
    return _then(_value.copyWith(
      loginsToday: null == loginsToday
          ? _value.loginsToday
          : loginsToday // ignore: cast_nullable_to_non_nullable
              as int,
      failedLogins: null == failedLogins
          ? _value.failedLogins
          : failedLogins // ignore: cast_nullable_to_non_nullable
              as int,
      activeSessions: null == activeSessions
          ? _value.activeSessions
          : activeSessions // ignore: cast_nullable_to_non_nullable
              as int,
      totalBranches: null == totalBranches
          ? _value.totalBranches
          : totalBranches // ignore: cast_nullable_to_non_nullable
              as int,
      totalUsers: null == totalUsers
          ? _value.totalUsers
          : totalUsers // ignore: cast_nullable_to_non_nullable
              as int,
      totalStaff: null == totalStaff
          ? _value.totalStaff
          : totalStaff // ignore: cast_nullable_to_non_nullable
              as int,
      totalRooms: null == totalRooms
          ? _value.totalRooms
          : totalRooms // ignore: cast_nullable_to_non_nullable
              as int,
      occupiedRooms: null == occupiedRooms
          ? _value.occupiedRooms
          : occupiedRooms // ignore: cast_nullable_to_non_nullable
              as int,
      todayRevenue: null == todayRevenue
          ? _value.todayRevenue
          : todayRevenue // ignore: cast_nullable_to_non_nullable
              as double,
      monthlyRevenue: null == monthlyRevenue
          ? _value.monthlyRevenue
          : monthlyRevenue // ignore: cast_nullable_to_non_nullable
              as double,
      revenueTrend: null == revenueTrend
          ? _value.revenueTrend
          : revenueTrend // ignore: cast_nullable_to_non_nullable
              as List<RevenueDataPoint>,
      occupancyTrend: null == occupancyTrend
          ? _value.occupancyTrend
          : occupancyTrend // ignore: cast_nullable_to_non_nullable
              as List<OccupancyDataPoint>,
      recentActivity: null == recentActivity
          ? _value.recentActivity
          : recentActivity // ignore: cast_nullable_to_non_nullable
              as List<RecentActivity>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AdminDashboardImplCopyWith<$Res>
    implements $AdminDashboardCopyWith<$Res> {
  factory _$$AdminDashboardImplCopyWith(_$AdminDashboardImpl value,
          $Res Function(_$AdminDashboardImpl) then) =
      __$$AdminDashboardImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: 'logins_today') int loginsToday,
      @JsonKey(name: 'failed_logins') int failedLogins,
      @JsonKey(name: 'active_sessions') int activeSessions,
      @JsonKey(name: 'total_branches') int totalBranches,
      @JsonKey(name: 'total_users') int totalUsers,
      @JsonKey(name: 'total_staff') int totalStaff,
      @JsonKey(name: 'total_rooms') int totalRooms,
      @JsonKey(name: 'occupied_rooms') int occupiedRooms,
      @JsonKey(name: 'today_revenue') double todayRevenue,
      @JsonKey(name: 'monthly_revenue') double monthlyRevenue,
      List<RevenueDataPoint> revenueTrend,
      List<OccupancyDataPoint> occupancyTrend,
      List<RecentActivity> recentActivity});
}

/// @nodoc
class __$$AdminDashboardImplCopyWithImpl<$Res>
    extends _$AdminDashboardCopyWithImpl<$Res, _$AdminDashboardImpl>
    implements _$$AdminDashboardImplCopyWith<$Res> {
  __$$AdminDashboardImplCopyWithImpl(
      _$AdminDashboardImpl _value, $Res Function(_$AdminDashboardImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdminDashboard
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? loginsToday = null,
    Object? failedLogins = null,
    Object? activeSessions = null,
    Object? totalBranches = null,
    Object? totalUsers = null,
    Object? totalStaff = null,
    Object? totalRooms = null,
    Object? occupiedRooms = null,
    Object? todayRevenue = null,
    Object? monthlyRevenue = null,
    Object? revenueTrend = null,
    Object? occupancyTrend = null,
    Object? recentActivity = null,
  }) {
    return _then(_$AdminDashboardImpl(
      loginsToday: null == loginsToday
          ? _value.loginsToday
          : loginsToday // ignore: cast_nullable_to_non_nullable
              as int,
      failedLogins: null == failedLogins
          ? _value.failedLogins
          : failedLogins // ignore: cast_nullable_to_non_nullable
              as int,
      activeSessions: null == activeSessions
          ? _value.activeSessions
          : activeSessions // ignore: cast_nullable_to_non_nullable
              as int,
      totalBranches: null == totalBranches
          ? _value.totalBranches
          : totalBranches // ignore: cast_nullable_to_non_nullable
              as int,
      totalUsers: null == totalUsers
          ? _value.totalUsers
          : totalUsers // ignore: cast_nullable_to_non_nullable
              as int,
      totalStaff: null == totalStaff
          ? _value.totalStaff
          : totalStaff // ignore: cast_nullable_to_non_nullable
              as int,
      totalRooms: null == totalRooms
          ? _value.totalRooms
          : totalRooms // ignore: cast_nullable_to_non_nullable
              as int,
      occupiedRooms: null == occupiedRooms
          ? _value.occupiedRooms
          : occupiedRooms // ignore: cast_nullable_to_non_nullable
              as int,
      todayRevenue: null == todayRevenue
          ? _value.todayRevenue
          : todayRevenue // ignore: cast_nullable_to_non_nullable
              as double,
      monthlyRevenue: null == monthlyRevenue
          ? _value.monthlyRevenue
          : monthlyRevenue // ignore: cast_nullable_to_non_nullable
              as double,
      revenueTrend: null == revenueTrend
          ? _value._revenueTrend
          : revenueTrend // ignore: cast_nullable_to_non_nullable
              as List<RevenueDataPoint>,
      occupancyTrend: null == occupancyTrend
          ? _value._occupancyTrend
          : occupancyTrend // ignore: cast_nullable_to_non_nullable
              as List<OccupancyDataPoint>,
      recentActivity: null == recentActivity
          ? _value._recentActivity
          : recentActivity // ignore: cast_nullable_to_non_nullable
              as List<RecentActivity>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AdminDashboardImpl implements _AdminDashboard {
  const _$AdminDashboardImpl(
      {@JsonKey(name: 'logins_today') this.loginsToday = 0,
      @JsonKey(name: 'failed_logins') this.failedLogins = 0,
      @JsonKey(name: 'active_sessions') this.activeSessions = 0,
      @JsonKey(name: 'total_branches') this.totalBranches = 0,
      @JsonKey(name: 'total_users') this.totalUsers = 0,
      @JsonKey(name: 'total_staff') this.totalStaff = 0,
      @JsonKey(name: 'total_rooms') this.totalRooms = 0,
      @JsonKey(name: 'occupied_rooms') this.occupiedRooms = 0,
      @JsonKey(name: 'today_revenue') this.todayRevenue = 0.0,
      @JsonKey(name: 'monthly_revenue') this.monthlyRevenue = 0.0,
      final List<RevenueDataPoint> revenueTrend = const [],
      final List<OccupancyDataPoint> occupancyTrend = const [],
      final List<RecentActivity> recentActivity = const []})
      : _revenueTrend = revenueTrend,
        _occupancyTrend = occupancyTrend,
        _recentActivity = recentActivity;

  factory _$AdminDashboardImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdminDashboardImplFromJson(json);

  @override
  @JsonKey(name: 'logins_today')
  final int loginsToday;
  @override
  @JsonKey(name: 'failed_logins')
  final int failedLogins;
  @override
  @JsonKey(name: 'active_sessions')
  final int activeSessions;
  @override
  @JsonKey(name: 'total_branches')
  final int totalBranches;
  @override
  @JsonKey(name: 'total_users')
  final int totalUsers;
  @override
  @JsonKey(name: 'total_staff')
  final int totalStaff;
  @override
  @JsonKey(name: 'total_rooms')
  final int totalRooms;
  @override
  @JsonKey(name: 'occupied_rooms')
  final int occupiedRooms;
  @override
  @JsonKey(name: 'today_revenue')
  final double todayRevenue;
  @override
  @JsonKey(name: 'monthly_revenue')
  final double monthlyRevenue;
  final List<RevenueDataPoint> _revenueTrend;
  @override
  @JsonKey()
  List<RevenueDataPoint> get revenueTrend {
    if (_revenueTrend is EqualUnmodifiableListView) return _revenueTrend;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_revenueTrend);
  }

  final List<OccupancyDataPoint> _occupancyTrend;
  @override
  @JsonKey()
  List<OccupancyDataPoint> get occupancyTrend {
    if (_occupancyTrend is EqualUnmodifiableListView) return _occupancyTrend;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_occupancyTrend);
  }

  final List<RecentActivity> _recentActivity;
  @override
  @JsonKey()
  List<RecentActivity> get recentActivity {
    if (_recentActivity is EqualUnmodifiableListView) return _recentActivity;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_recentActivity);
  }

  @override
  String toString() {
    return 'AdminDashboard(loginsToday: $loginsToday, failedLogins: $failedLogins, activeSessions: $activeSessions, totalBranches: $totalBranches, totalUsers: $totalUsers, totalStaff: $totalStaff, totalRooms: $totalRooms, occupiedRooms: $occupiedRooms, todayRevenue: $todayRevenue, monthlyRevenue: $monthlyRevenue, revenueTrend: $revenueTrend, occupancyTrend: $occupancyTrend, recentActivity: $recentActivity)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdminDashboardImpl &&
            (identical(other.loginsToday, loginsToday) ||
                other.loginsToday == loginsToday) &&
            (identical(other.failedLogins, failedLogins) ||
                other.failedLogins == failedLogins) &&
            (identical(other.activeSessions, activeSessions) ||
                other.activeSessions == activeSessions) &&
            (identical(other.totalBranches, totalBranches) ||
                other.totalBranches == totalBranches) &&
            (identical(other.totalUsers, totalUsers) ||
                other.totalUsers == totalUsers) &&
            (identical(other.totalStaff, totalStaff) ||
                other.totalStaff == totalStaff) &&
            (identical(other.totalRooms, totalRooms) ||
                other.totalRooms == totalRooms) &&
            (identical(other.occupiedRooms, occupiedRooms) ||
                other.occupiedRooms == occupiedRooms) &&
            (identical(other.todayRevenue, todayRevenue) ||
                other.todayRevenue == todayRevenue) &&
            (identical(other.monthlyRevenue, monthlyRevenue) ||
                other.monthlyRevenue == monthlyRevenue) &&
            const DeepCollectionEquality()
                .equals(other._revenueTrend, _revenueTrend) &&
            const DeepCollectionEquality()
                .equals(other._occupancyTrend, _occupancyTrend) &&
            const DeepCollectionEquality()
                .equals(other._recentActivity, _recentActivity));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      loginsToday,
      failedLogins,
      activeSessions,
      totalBranches,
      totalUsers,
      totalStaff,
      totalRooms,
      occupiedRooms,
      todayRevenue,
      monthlyRevenue,
      const DeepCollectionEquality().hash(_revenueTrend),
      const DeepCollectionEquality().hash(_occupancyTrend),
      const DeepCollectionEquality().hash(_recentActivity));

  /// Create a copy of AdminDashboard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdminDashboardImplCopyWith<_$AdminDashboardImpl> get copyWith =>
      __$$AdminDashboardImplCopyWithImpl<_$AdminDashboardImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdminDashboardImplToJson(
      this,
    );
  }
}

abstract class _AdminDashboard implements AdminDashboard {
  const factory _AdminDashboard(
      {@JsonKey(name: 'logins_today') final int loginsToday,
      @JsonKey(name: 'failed_logins') final int failedLogins,
      @JsonKey(name: 'active_sessions') final int activeSessions,
      @JsonKey(name: 'total_branches') final int totalBranches,
      @JsonKey(name: 'total_users') final int totalUsers,
      @JsonKey(name: 'total_staff') final int totalStaff,
      @JsonKey(name: 'total_rooms') final int totalRooms,
      @JsonKey(name: 'occupied_rooms') final int occupiedRooms,
      @JsonKey(name: 'today_revenue') final double todayRevenue,
      @JsonKey(name: 'monthly_revenue') final double monthlyRevenue,
      final List<RevenueDataPoint> revenueTrend,
      final List<OccupancyDataPoint> occupancyTrend,
      final List<RecentActivity> recentActivity}) = _$AdminDashboardImpl;

  factory _AdminDashboard.fromJson(Map<String, dynamic> json) =
      _$AdminDashboardImpl.fromJson;

  @override
  @JsonKey(name: 'logins_today')
  int get loginsToday;
  @override
  @JsonKey(name: 'failed_logins')
  int get failedLogins;
  @override
  @JsonKey(name: 'active_sessions')
  int get activeSessions;
  @override
  @JsonKey(name: 'total_branches')
  int get totalBranches;
  @override
  @JsonKey(name: 'total_users')
  int get totalUsers;
  @override
  @JsonKey(name: 'total_staff')
  int get totalStaff;
  @override
  @JsonKey(name: 'total_rooms')
  int get totalRooms;
  @override
  @JsonKey(name: 'occupied_rooms')
  int get occupiedRooms;
  @override
  @JsonKey(name: 'today_revenue')
  double get todayRevenue;
  @override
  @JsonKey(name: 'monthly_revenue')
  double get monthlyRevenue;
  @override
  List<RevenueDataPoint> get revenueTrend;
  @override
  List<OccupancyDataPoint> get occupancyTrend;
  @override
  List<RecentActivity> get recentActivity;

  /// Create a copy of AdminDashboard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdminDashboardImplCopyWith<_$AdminDashboardImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

RevenueDataPoint _$RevenueDataPointFromJson(Map<String, dynamic> json) {
  return _RevenueDataPoint.fromJson(json);
}

/// @nodoc
mixin _$RevenueDataPoint {
  String get label => throw _privateConstructorUsedError;
  double get revenue => throw _privateConstructorUsedError;

  /// Serializes this RevenueDataPoint to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of RevenueDataPoint
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $RevenueDataPointCopyWith<RevenueDataPoint> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $RevenueDataPointCopyWith<$Res> {
  factory $RevenueDataPointCopyWith(
          RevenueDataPoint value, $Res Function(RevenueDataPoint) then) =
      _$RevenueDataPointCopyWithImpl<$Res, RevenueDataPoint>;
  @useResult
  $Res call({String label, double revenue});
}

/// @nodoc
class _$RevenueDataPointCopyWithImpl<$Res, $Val extends RevenueDataPoint>
    implements $RevenueDataPointCopyWith<$Res> {
  _$RevenueDataPointCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of RevenueDataPoint
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? label = null,
    Object? revenue = null,
  }) {
    return _then(_value.copyWith(
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      revenue: null == revenue
          ? _value.revenue
          : revenue // ignore: cast_nullable_to_non_nullable
              as double,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$RevenueDataPointImplCopyWith<$Res>
    implements $RevenueDataPointCopyWith<$Res> {
  factory _$$RevenueDataPointImplCopyWith(_$RevenueDataPointImpl value,
          $Res Function(_$RevenueDataPointImpl) then) =
      __$$RevenueDataPointImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String label, double revenue});
}

/// @nodoc
class __$$RevenueDataPointImplCopyWithImpl<$Res>
    extends _$RevenueDataPointCopyWithImpl<$Res, _$RevenueDataPointImpl>
    implements _$$RevenueDataPointImplCopyWith<$Res> {
  __$$RevenueDataPointImplCopyWithImpl(_$RevenueDataPointImpl _value,
      $Res Function(_$RevenueDataPointImpl) _then)
      : super(_value, _then);

  /// Create a copy of RevenueDataPoint
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? label = null,
    Object? revenue = null,
  }) {
    return _then(_$RevenueDataPointImpl(
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      revenue: null == revenue
          ? _value.revenue
          : revenue // ignore: cast_nullable_to_non_nullable
              as double,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$RevenueDataPointImpl implements _RevenueDataPoint {
  const _$RevenueDataPointImpl({this.label = '', this.revenue = 0.0});

  factory _$RevenueDataPointImpl.fromJson(Map<String, dynamic> json) =>
      _$$RevenueDataPointImplFromJson(json);

  @override
  @JsonKey()
  final String label;
  @override
  @JsonKey()
  final double revenue;

  @override
  String toString() {
    return 'RevenueDataPoint(label: $label, revenue: $revenue)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$RevenueDataPointImpl &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.revenue, revenue) || other.revenue == revenue));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, label, revenue);

  /// Create a copy of RevenueDataPoint
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$RevenueDataPointImplCopyWith<_$RevenueDataPointImpl> get copyWith =>
      __$$RevenueDataPointImplCopyWithImpl<_$RevenueDataPointImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$RevenueDataPointImplToJson(
      this,
    );
  }
}

abstract class _RevenueDataPoint implements RevenueDataPoint {
  const factory _RevenueDataPoint({final String label, final double revenue}) =
      _$RevenueDataPointImpl;

  factory _RevenueDataPoint.fromJson(Map<String, dynamic> json) =
      _$RevenueDataPointImpl.fromJson;

  @override
  String get label;
  @override
  double get revenue;

  /// Create a copy of RevenueDataPoint
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$RevenueDataPointImplCopyWith<_$RevenueDataPointImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

OccupancyDataPoint _$OccupancyDataPointFromJson(Map<String, dynamic> json) {
  return _OccupancyDataPoint.fromJson(json);
}

/// @nodoc
mixin _$OccupancyDataPoint {
  String get label => throw _privateConstructorUsedError;
  double get occupancy => throw _privateConstructorUsedError;

  /// Serializes this OccupancyDataPoint to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of OccupancyDataPoint
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $OccupancyDataPointCopyWith<OccupancyDataPoint> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $OccupancyDataPointCopyWith<$Res> {
  factory $OccupancyDataPointCopyWith(
          OccupancyDataPoint value, $Res Function(OccupancyDataPoint) then) =
      _$OccupancyDataPointCopyWithImpl<$Res, OccupancyDataPoint>;
  @useResult
  $Res call({String label, double occupancy});
}

/// @nodoc
class _$OccupancyDataPointCopyWithImpl<$Res, $Val extends OccupancyDataPoint>
    implements $OccupancyDataPointCopyWith<$Res> {
  _$OccupancyDataPointCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of OccupancyDataPoint
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? label = null,
    Object? occupancy = null,
  }) {
    return _then(_value.copyWith(
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      occupancy: null == occupancy
          ? _value.occupancy
          : occupancy // ignore: cast_nullable_to_non_nullable
              as double,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$OccupancyDataPointImplCopyWith<$Res>
    implements $OccupancyDataPointCopyWith<$Res> {
  factory _$$OccupancyDataPointImplCopyWith(_$OccupancyDataPointImpl value,
          $Res Function(_$OccupancyDataPointImpl) then) =
      __$$OccupancyDataPointImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String label, double occupancy});
}

/// @nodoc
class __$$OccupancyDataPointImplCopyWithImpl<$Res>
    extends _$OccupancyDataPointCopyWithImpl<$Res, _$OccupancyDataPointImpl>
    implements _$$OccupancyDataPointImplCopyWith<$Res> {
  __$$OccupancyDataPointImplCopyWithImpl(_$OccupancyDataPointImpl _value,
      $Res Function(_$OccupancyDataPointImpl) _then)
      : super(_value, _then);

  /// Create a copy of OccupancyDataPoint
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? label = null,
    Object? occupancy = null,
  }) {
    return _then(_$OccupancyDataPointImpl(
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      occupancy: null == occupancy
          ? _value.occupancy
          : occupancy // ignore: cast_nullable_to_non_nullable
              as double,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$OccupancyDataPointImpl implements _OccupancyDataPoint {
  const _$OccupancyDataPointImpl({this.label = '', this.occupancy = 0.0});

  factory _$OccupancyDataPointImpl.fromJson(Map<String, dynamic> json) =>
      _$$OccupancyDataPointImplFromJson(json);

  @override
  @JsonKey()
  final String label;
  @override
  @JsonKey()
  final double occupancy;

  @override
  String toString() {
    return 'OccupancyDataPoint(label: $label, occupancy: $occupancy)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$OccupancyDataPointImpl &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.occupancy, occupancy) ||
                other.occupancy == occupancy));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, label, occupancy);

  /// Create a copy of OccupancyDataPoint
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$OccupancyDataPointImplCopyWith<_$OccupancyDataPointImpl> get copyWith =>
      __$$OccupancyDataPointImplCopyWithImpl<_$OccupancyDataPointImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$OccupancyDataPointImplToJson(
      this,
    );
  }
}

abstract class _OccupancyDataPoint implements OccupancyDataPoint {
  const factory _OccupancyDataPoint(
      {final String label, final double occupancy}) = _$OccupancyDataPointImpl;

  factory _OccupancyDataPoint.fromJson(Map<String, dynamic> json) =
      _$OccupancyDataPointImpl.fromJson;

  @override
  String get label;
  @override
  double get occupancy;

  /// Create a copy of OccupancyDataPoint
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$OccupancyDataPointImplCopyWith<_$OccupancyDataPointImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

RecentActivity _$RecentActivityFromJson(Map<String, dynamic> json) {
  return _RecentActivity.fromJson(json);
}

/// @nodoc
mixin _$RecentActivity {
  String get id => throw _privateConstructorUsedError;
  String get action => throw _privateConstructorUsedError;
  String get description => throw _privateConstructorUsedError;
  String get userName => throw _privateConstructorUsedError;
  String get type => throw _privateConstructorUsedError;
  @DateTimeConverter()
  DateTime? get createdAt => throw _privateConstructorUsedError;

  /// Serializes this RecentActivity to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of RecentActivity
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $RecentActivityCopyWith<RecentActivity> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $RecentActivityCopyWith<$Res> {
  factory $RecentActivityCopyWith(
          RecentActivity value, $Res Function(RecentActivity) then) =
      _$RecentActivityCopyWithImpl<$Res, RecentActivity>;
  @useResult
  $Res call(
      {String id,
      String action,
      String description,
      String userName,
      String type,
      @DateTimeConverter() DateTime? createdAt});
}

/// @nodoc
class _$RecentActivityCopyWithImpl<$Res, $Val extends RecentActivity>
    implements $RecentActivityCopyWith<$Res> {
  _$RecentActivityCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of RecentActivity
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? action = null,
    Object? description = null,
    Object? userName = null,
    Object? type = null,
    Object? createdAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      action: null == action
          ? _value.action
          : action // ignore: cast_nullable_to_non_nullable
              as String,
      description: null == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String,
      userName: null == userName
          ? _value.userName
          : userName // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$RecentActivityImplCopyWith<$Res>
    implements $RecentActivityCopyWith<$Res> {
  factory _$$RecentActivityImplCopyWith(_$RecentActivityImpl value,
          $Res Function(_$RecentActivityImpl) then) =
      __$$RecentActivityImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String action,
      String description,
      String userName,
      String type,
      @DateTimeConverter() DateTime? createdAt});
}

/// @nodoc
class __$$RecentActivityImplCopyWithImpl<$Res>
    extends _$RecentActivityCopyWithImpl<$Res, _$RecentActivityImpl>
    implements _$$RecentActivityImplCopyWith<$Res> {
  __$$RecentActivityImplCopyWithImpl(
      _$RecentActivityImpl _value, $Res Function(_$RecentActivityImpl) _then)
      : super(_value, _then);

  /// Create a copy of RecentActivity
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? action = null,
    Object? description = null,
    Object? userName = null,
    Object? type = null,
    Object? createdAt = freezed,
  }) {
    return _then(_$RecentActivityImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      action: null == action
          ? _value.action
          : action // ignore: cast_nullable_to_non_nullable
              as String,
      description: null == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String,
      userName: null == userName
          ? _value.userName
          : userName // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$RecentActivityImpl implements _RecentActivity {
  const _$RecentActivityImpl(
      {this.id = '',
      this.action = '',
      this.description = '',
      this.userName = '',
      this.type = 'info',
      @DateTimeConverter() this.createdAt});

  factory _$RecentActivityImpl.fromJson(Map<String, dynamic> json) =>
      _$$RecentActivityImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String action;
  @override
  @JsonKey()
  final String description;
  @override
  @JsonKey()
  final String userName;
  @override
  @JsonKey()
  final String type;
  @override
  @DateTimeConverter()
  final DateTime? createdAt;

  @override
  String toString() {
    return 'RecentActivity(id: $id, action: $action, description: $description, userName: $userName, type: $type, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$RecentActivityImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.action, action) || other.action == action) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.userName, userName) ||
                other.userName == userName) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, id, action, description, userName, type, createdAt);

  /// Create a copy of RecentActivity
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$RecentActivityImplCopyWith<_$RecentActivityImpl> get copyWith =>
      __$$RecentActivityImplCopyWithImpl<_$RecentActivityImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$RecentActivityImplToJson(
      this,
    );
  }
}

abstract class _RecentActivity implements RecentActivity {
  const factory _RecentActivity(
      {final String id,
      final String action,
      final String description,
      final String userName,
      final String type,
      @DateTimeConverter() final DateTime? createdAt}) = _$RecentActivityImpl;

  factory _RecentActivity.fromJson(Map<String, dynamic> json) =
      _$RecentActivityImpl.fromJson;

  @override
  String get id;
  @override
  String get action;
  @override
  String get description;
  @override
  String get userName;
  @override
  String get type;
  @override
  @DateTimeConverter()
  DateTime? get createdAt;

  /// Create a copy of RecentActivity
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$RecentActivityImplCopyWith<_$RecentActivityImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
