// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'vehicle.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AdminVehicle _$AdminVehicleFromJson(Map<String, dynamic> json) {
  return _AdminVehicle.fromJson(json);
}

/// @nodoc
mixin _$AdminVehicle {
  String get id => throw _privateConstructorUsedError;
  String get registration => throw _privateConstructorUsedError;
  String get model => throw _privateConstructorUsedError;
  String get make => throw _privateConstructorUsedError;
  String get color => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  String get driverName => throw _privateConstructorUsedError;
  String get driverPhone => throw _privateConstructorUsedError;
  String get insuranceProvider => throw _privateConstructorUsedError;
  @DateTimeConverter()
  DateTime? get insuranceExpiry => throw _privateConstructorUsedError;
  @DateTimeConverter()
  DateTime? get lastService => throw _privateConstructorUsedError;
  @DateTimeConverter()
  DateTime? get nextService => throw _privateConstructorUsedError;

  /// Serializes this AdminVehicle to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdminVehicle
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdminVehicleCopyWith<AdminVehicle> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdminVehicleCopyWith<$Res> {
  factory $AdminVehicleCopyWith(
          AdminVehicle value, $Res Function(AdminVehicle) then) =
      _$AdminVehicleCopyWithImpl<$Res, AdminVehicle>;
  @useResult
  $Res call(
      {String id,
      String registration,
      String model,
      String make,
      String color,
      String status,
      String driverName,
      String driverPhone,
      String insuranceProvider,
      @DateTimeConverter() DateTime? insuranceExpiry,
      @DateTimeConverter() DateTime? lastService,
      @DateTimeConverter() DateTime? nextService});
}

/// @nodoc
class _$AdminVehicleCopyWithImpl<$Res, $Val extends AdminVehicle>
    implements $AdminVehicleCopyWith<$Res> {
  _$AdminVehicleCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdminVehicle
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? registration = null,
    Object? model = null,
    Object? make = null,
    Object? color = null,
    Object? status = null,
    Object? driverName = null,
    Object? driverPhone = null,
    Object? insuranceProvider = null,
    Object? insuranceExpiry = freezed,
    Object? lastService = freezed,
    Object? nextService = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      registration: null == registration
          ? _value.registration
          : registration // ignore: cast_nullable_to_non_nullable
              as String,
      model: null == model
          ? _value.model
          : model // ignore: cast_nullable_to_non_nullable
              as String,
      make: null == make
          ? _value.make
          : make // ignore: cast_nullable_to_non_nullable
              as String,
      color: null == color
          ? _value.color
          : color // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      driverName: null == driverName
          ? _value.driverName
          : driverName // ignore: cast_nullable_to_non_nullable
              as String,
      driverPhone: null == driverPhone
          ? _value.driverPhone
          : driverPhone // ignore: cast_nullable_to_non_nullable
              as String,
      insuranceProvider: null == insuranceProvider
          ? _value.insuranceProvider
          : insuranceProvider // ignore: cast_nullable_to_non_nullable
              as String,
      insuranceExpiry: freezed == insuranceExpiry
          ? _value.insuranceExpiry
          : insuranceExpiry // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      lastService: freezed == lastService
          ? _value.lastService
          : lastService // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      nextService: freezed == nextService
          ? _value.nextService
          : nextService // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AdminVehicleImplCopyWith<$Res>
    implements $AdminVehicleCopyWith<$Res> {
  factory _$$AdminVehicleImplCopyWith(
          _$AdminVehicleImpl value, $Res Function(_$AdminVehicleImpl) then) =
      __$$AdminVehicleImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String registration,
      String model,
      String make,
      String color,
      String status,
      String driverName,
      String driverPhone,
      String insuranceProvider,
      @DateTimeConverter() DateTime? insuranceExpiry,
      @DateTimeConverter() DateTime? lastService,
      @DateTimeConverter() DateTime? nextService});
}

/// @nodoc
class __$$AdminVehicleImplCopyWithImpl<$Res>
    extends _$AdminVehicleCopyWithImpl<$Res, _$AdminVehicleImpl>
    implements _$$AdminVehicleImplCopyWith<$Res> {
  __$$AdminVehicleImplCopyWithImpl(
      _$AdminVehicleImpl _value, $Res Function(_$AdminVehicleImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdminVehicle
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? registration = null,
    Object? model = null,
    Object? make = null,
    Object? color = null,
    Object? status = null,
    Object? driverName = null,
    Object? driverPhone = null,
    Object? insuranceProvider = null,
    Object? insuranceExpiry = freezed,
    Object? lastService = freezed,
    Object? nextService = freezed,
  }) {
    return _then(_$AdminVehicleImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      registration: null == registration
          ? _value.registration
          : registration // ignore: cast_nullable_to_non_nullable
              as String,
      model: null == model
          ? _value.model
          : model // ignore: cast_nullable_to_non_nullable
              as String,
      make: null == make
          ? _value.make
          : make // ignore: cast_nullable_to_non_nullable
              as String,
      color: null == color
          ? _value.color
          : color // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      driverName: null == driverName
          ? _value.driverName
          : driverName // ignore: cast_nullable_to_non_nullable
              as String,
      driverPhone: null == driverPhone
          ? _value.driverPhone
          : driverPhone // ignore: cast_nullable_to_non_nullable
              as String,
      insuranceProvider: null == insuranceProvider
          ? _value.insuranceProvider
          : insuranceProvider // ignore: cast_nullable_to_non_nullable
              as String,
      insuranceExpiry: freezed == insuranceExpiry
          ? _value.insuranceExpiry
          : insuranceExpiry // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      lastService: freezed == lastService
          ? _value.lastService
          : lastService // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      nextService: freezed == nextService
          ? _value.nextService
          : nextService // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AdminVehicleImpl implements _AdminVehicle {
  const _$AdminVehicleImpl(
      {this.id = '',
      this.registration = '',
      this.model = '',
      this.make = '',
      this.color = '',
      this.status = 'Available',
      this.driverName = '',
      this.driverPhone = '',
      this.insuranceProvider = '',
      @DateTimeConverter() this.insuranceExpiry,
      @DateTimeConverter() this.lastService,
      @DateTimeConverter() this.nextService});

  factory _$AdminVehicleImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdminVehicleImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String registration;
  @override
  @JsonKey()
  final String model;
  @override
  @JsonKey()
  final String make;
  @override
  @JsonKey()
  final String color;
  @override
  @JsonKey()
  final String status;
  @override
  @JsonKey()
  final String driverName;
  @override
  @JsonKey()
  final String driverPhone;
  @override
  @JsonKey()
  final String insuranceProvider;
  @override
  @DateTimeConverter()
  final DateTime? insuranceExpiry;
  @override
  @DateTimeConverter()
  final DateTime? lastService;
  @override
  @DateTimeConverter()
  final DateTime? nextService;

  @override
  String toString() {
    return 'AdminVehicle(id: $id, registration: $registration, model: $model, make: $make, color: $color, status: $status, driverName: $driverName, driverPhone: $driverPhone, insuranceProvider: $insuranceProvider, insuranceExpiry: $insuranceExpiry, lastService: $lastService, nextService: $nextService)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdminVehicleImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.registration, registration) ||
                other.registration == registration) &&
            (identical(other.model, model) || other.model == model) &&
            (identical(other.make, make) || other.make == make) &&
            (identical(other.color, color) || other.color == color) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.driverName, driverName) ||
                other.driverName == driverName) &&
            (identical(other.driverPhone, driverPhone) ||
                other.driverPhone == driverPhone) &&
            (identical(other.insuranceProvider, insuranceProvider) ||
                other.insuranceProvider == insuranceProvider) &&
            (identical(other.insuranceExpiry, insuranceExpiry) ||
                other.insuranceExpiry == insuranceExpiry) &&
            (identical(other.lastService, lastService) ||
                other.lastService == lastService) &&
            (identical(other.nextService, nextService) ||
                other.nextService == nextService));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      registration,
      model,
      make,
      color,
      status,
      driverName,
      driverPhone,
      insuranceProvider,
      insuranceExpiry,
      lastService,
      nextService);

  /// Create a copy of AdminVehicle
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdminVehicleImplCopyWith<_$AdminVehicleImpl> get copyWith =>
      __$$AdminVehicleImplCopyWithImpl<_$AdminVehicleImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdminVehicleImplToJson(
      this,
    );
  }
}

abstract class _AdminVehicle implements AdminVehicle {
  const factory _AdminVehicle(
      {final String id,
      final String registration,
      final String model,
      final String make,
      final String color,
      final String status,
      final String driverName,
      final String driverPhone,
      final String insuranceProvider,
      @DateTimeConverter() final DateTime? insuranceExpiry,
      @DateTimeConverter() final DateTime? lastService,
      @DateTimeConverter() final DateTime? nextService}) = _$AdminVehicleImpl;

  factory _AdminVehicle.fromJson(Map<String, dynamic> json) =
      _$AdminVehicleImpl.fromJson;

  @override
  String get id;
  @override
  String get registration;
  @override
  String get model;
  @override
  String get make;
  @override
  String get color;
  @override
  String get status;
  @override
  String get driverName;
  @override
  String get driverPhone;
  @override
  String get insuranceProvider;
  @override
  @DateTimeConverter()
  DateTime? get insuranceExpiry;
  @override
  @DateTimeConverter()
  DateTime? get lastService;
  @override
  @DateTimeConverter()
  DateTime? get nextService;

  /// Create a copy of AdminVehicle
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdminVehicleImplCopyWith<_$AdminVehicleImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
