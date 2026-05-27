// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'audit_log.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AdminAuditLog _$AdminAuditLogFromJson(Map<String, dynamic> json) {
  return _AdminAuditLog.fromJson(json);
}

/// @nodoc
mixin _$AdminAuditLog {
  String get id => throw _privateConstructorUsedError;
  String get action => throw _privateConstructorUsedError;
  String get category => throw _privateConstructorUsedError;
  String get description => throw _privateConstructorUsedError;
  String get severity => throw _privateConstructorUsedError;
  String get userName => throw _privateConstructorUsedError;
  String get email => throw _privateConstructorUsedError;
  String get branchName => throw _privateConstructorUsedError;
  String get ipAddress => throw _privateConstructorUsedError;
  String get userAgent => throw _privateConstructorUsedError;
  @DateTimeConverter()
  DateTime? get createdAt => throw _privateConstructorUsedError;

  /// Serializes this AdminAuditLog to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdminAuditLog
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdminAuditLogCopyWith<AdminAuditLog> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdminAuditLogCopyWith<$Res> {
  factory $AdminAuditLogCopyWith(
          AdminAuditLog value, $Res Function(AdminAuditLog) then) =
      _$AdminAuditLogCopyWithImpl<$Res, AdminAuditLog>;
  @useResult
  $Res call(
      {String id,
      String action,
      String category,
      String description,
      String severity,
      String userName,
      String email,
      String branchName,
      String ipAddress,
      String userAgent,
      @DateTimeConverter() DateTime? createdAt});
}

/// @nodoc
class _$AdminAuditLogCopyWithImpl<$Res, $Val extends AdminAuditLog>
    implements $AdminAuditLogCopyWith<$Res> {
  _$AdminAuditLogCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdminAuditLog
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? action = null,
    Object? category = null,
    Object? description = null,
    Object? severity = null,
    Object? userName = null,
    Object? email = null,
    Object? branchName = null,
    Object? ipAddress = null,
    Object? userAgent = null,
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
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as String,
      description: null == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String,
      severity: null == severity
          ? _value.severity
          : severity // ignore: cast_nullable_to_non_nullable
              as String,
      userName: null == userName
          ? _value.userName
          : userName // ignore: cast_nullable_to_non_nullable
              as String,
      email: null == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String,
      branchName: null == branchName
          ? _value.branchName
          : branchName // ignore: cast_nullable_to_non_nullable
              as String,
      ipAddress: null == ipAddress
          ? _value.ipAddress
          : ipAddress // ignore: cast_nullable_to_non_nullable
              as String,
      userAgent: null == userAgent
          ? _value.userAgent
          : userAgent // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AdminAuditLogImplCopyWith<$Res>
    implements $AdminAuditLogCopyWith<$Res> {
  factory _$$AdminAuditLogImplCopyWith(
          _$AdminAuditLogImpl value, $Res Function(_$AdminAuditLogImpl) then) =
      __$$AdminAuditLogImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String action,
      String category,
      String description,
      String severity,
      String userName,
      String email,
      String branchName,
      String ipAddress,
      String userAgent,
      @DateTimeConverter() DateTime? createdAt});
}

/// @nodoc
class __$$AdminAuditLogImplCopyWithImpl<$Res>
    extends _$AdminAuditLogCopyWithImpl<$Res, _$AdminAuditLogImpl>
    implements _$$AdminAuditLogImplCopyWith<$Res> {
  __$$AdminAuditLogImplCopyWithImpl(
      _$AdminAuditLogImpl _value, $Res Function(_$AdminAuditLogImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdminAuditLog
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? action = null,
    Object? category = null,
    Object? description = null,
    Object? severity = null,
    Object? userName = null,
    Object? email = null,
    Object? branchName = null,
    Object? ipAddress = null,
    Object? userAgent = null,
    Object? createdAt = freezed,
  }) {
    return _then(_$AdminAuditLogImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      action: null == action
          ? _value.action
          : action // ignore: cast_nullable_to_non_nullable
              as String,
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as String,
      description: null == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String,
      severity: null == severity
          ? _value.severity
          : severity // ignore: cast_nullable_to_non_nullable
              as String,
      userName: null == userName
          ? _value.userName
          : userName // ignore: cast_nullable_to_non_nullable
              as String,
      email: null == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String,
      branchName: null == branchName
          ? _value.branchName
          : branchName // ignore: cast_nullable_to_non_nullable
              as String,
      ipAddress: null == ipAddress
          ? _value.ipAddress
          : ipAddress // ignore: cast_nullable_to_non_nullable
              as String,
      userAgent: null == userAgent
          ? _value.userAgent
          : userAgent // ignore: cast_nullable_to_non_nullable
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
class _$AdminAuditLogImpl implements _AdminAuditLog {
  const _$AdminAuditLogImpl(
      {this.id = '',
      this.action = '',
      this.category = '',
      this.description = '',
      this.severity = 'info',
      this.userName = '',
      this.email = '',
      this.branchName = '',
      this.ipAddress = '',
      this.userAgent = '',
      @DateTimeConverter() this.createdAt});

  factory _$AdminAuditLogImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdminAuditLogImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String action;
  @override
  @JsonKey()
  final String category;
  @override
  @JsonKey()
  final String description;
  @override
  @JsonKey()
  final String severity;
  @override
  @JsonKey()
  final String userName;
  @override
  @JsonKey()
  final String email;
  @override
  @JsonKey()
  final String branchName;
  @override
  @JsonKey()
  final String ipAddress;
  @override
  @JsonKey()
  final String userAgent;
  @override
  @DateTimeConverter()
  final DateTime? createdAt;

  @override
  String toString() {
    return 'AdminAuditLog(id: $id, action: $action, category: $category, description: $description, severity: $severity, userName: $userName, email: $email, branchName: $branchName, ipAddress: $ipAddress, userAgent: $userAgent, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdminAuditLogImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.action, action) || other.action == action) &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.severity, severity) ||
                other.severity == severity) &&
            (identical(other.userName, userName) ||
                other.userName == userName) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.branchName, branchName) ||
                other.branchName == branchName) &&
            (identical(other.ipAddress, ipAddress) ||
                other.ipAddress == ipAddress) &&
            (identical(other.userAgent, userAgent) ||
                other.userAgent == userAgent) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      action,
      category,
      description,
      severity,
      userName,
      email,
      branchName,
      ipAddress,
      userAgent,
      createdAt);

  /// Create a copy of AdminAuditLog
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdminAuditLogImplCopyWith<_$AdminAuditLogImpl> get copyWith =>
      __$$AdminAuditLogImplCopyWithImpl<_$AdminAuditLogImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdminAuditLogImplToJson(
      this,
    );
  }
}

abstract class _AdminAuditLog implements AdminAuditLog {
  const factory _AdminAuditLog(
      {final String id,
      final String action,
      final String category,
      final String description,
      final String severity,
      final String userName,
      final String email,
      final String branchName,
      final String ipAddress,
      final String userAgent,
      @DateTimeConverter() final DateTime? createdAt}) = _$AdminAuditLogImpl;

  factory _AdminAuditLog.fromJson(Map<String, dynamic> json) =
      _$AdminAuditLogImpl.fromJson;

  @override
  String get id;
  @override
  String get action;
  @override
  String get category;
  @override
  String get description;
  @override
  String get severity;
  @override
  String get userName;
  @override
  String get email;
  @override
  String get branchName;
  @override
  String get ipAddress;
  @override
  String get userAgent;
  @override
  @DateTimeConverter()
  DateTime? get createdAt;

  /// Create a copy of AdminAuditLog
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdminAuditLogImplCopyWith<_$AdminAuditLogImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
