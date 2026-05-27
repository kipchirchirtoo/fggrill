// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'notification.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AdminNotification _$AdminNotificationFromJson(Map<String, dynamic> json) {
  return _AdminNotification.fromJson(json);
}

/// @nodoc
mixin _$AdminNotification {
  String get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  String get message => throw _privateConstructorUsedError;
  String get type => throw _privateConstructorUsedError;
  bool get isRead => throw _privateConstructorUsedError;
  String get link => throw _privateConstructorUsedError;
  @DateTimeConverter()
  DateTime? get createdAt => throw _privateConstructorUsedError;

  /// Serializes this AdminNotification to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdminNotification
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdminNotificationCopyWith<AdminNotification> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdminNotificationCopyWith<$Res> {
  factory $AdminNotificationCopyWith(
          AdminNotification value, $Res Function(AdminNotification) then) =
      _$AdminNotificationCopyWithImpl<$Res, AdminNotification>;
  @useResult
  $Res call(
      {String id,
      String title,
      String message,
      String type,
      bool isRead,
      String link,
      @DateTimeConverter() DateTime? createdAt});
}

/// @nodoc
class _$AdminNotificationCopyWithImpl<$Res, $Val extends AdminNotification>
    implements $AdminNotificationCopyWith<$Res> {
  _$AdminNotificationCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdminNotification
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? message = null,
    Object? type = null,
    Object? isRead = null,
    Object? link = null,
    Object? createdAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      message: null == message
          ? _value.message
          : message // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      isRead: null == isRead
          ? _value.isRead
          : isRead // ignore: cast_nullable_to_non_nullable
              as bool,
      link: null == link
          ? _value.link
          : link // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: freezed == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AdminNotificationImplCopyWith<$Res>
    implements $AdminNotificationCopyWith<$Res> {
  factory _$$AdminNotificationImplCopyWith(_$AdminNotificationImpl value,
          $Res Function(_$AdminNotificationImpl) then) =
      __$$AdminNotificationImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      String message,
      String type,
      bool isRead,
      String link,
      @DateTimeConverter() DateTime? createdAt});
}

/// @nodoc
class __$$AdminNotificationImplCopyWithImpl<$Res>
    extends _$AdminNotificationCopyWithImpl<$Res, _$AdminNotificationImpl>
    implements _$$AdminNotificationImplCopyWith<$Res> {
  __$$AdminNotificationImplCopyWithImpl(_$AdminNotificationImpl _value,
      $Res Function(_$AdminNotificationImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdminNotification
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? message = null,
    Object? type = null,
    Object? isRead = null,
    Object? link = null,
    Object? createdAt = freezed,
  }) {
    return _then(_$AdminNotificationImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      message: null == message
          ? _value.message
          : message // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      isRead: null == isRead
          ? _value.isRead
          : isRead // ignore: cast_nullable_to_non_nullable
              as bool,
      link: null == link
          ? _value.link
          : link // ignore: cast_nullable_to_non_nullable
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
class _$AdminNotificationImpl implements _AdminNotification {
  const _$AdminNotificationImpl(
      {this.id = '',
      this.title = '',
      this.message = '',
      this.type = 'info',
      this.isRead = false,
      this.link = '',
      @DateTimeConverter() this.createdAt});

  factory _$AdminNotificationImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdminNotificationImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String title;
  @override
  @JsonKey()
  final String message;
  @override
  @JsonKey()
  final String type;
  @override
  @JsonKey()
  final bool isRead;
  @override
  @JsonKey()
  final String link;
  @override
  @DateTimeConverter()
  final DateTime? createdAt;

  @override
  String toString() {
    return 'AdminNotification(id: $id, title: $title, message: $message, type: $type, isRead: $isRead, link: $link, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdminNotificationImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.message, message) || other.message == message) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.isRead, isRead) || other.isRead == isRead) &&
            (identical(other.link, link) || other.link == link) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, id, title, message, type, isRead, link, createdAt);

  /// Create a copy of AdminNotification
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdminNotificationImplCopyWith<_$AdminNotificationImpl> get copyWith =>
      __$$AdminNotificationImplCopyWithImpl<_$AdminNotificationImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdminNotificationImplToJson(
      this,
    );
  }
}

abstract class _AdminNotification implements AdminNotification {
  const factory _AdminNotification(
          {final String id,
          final String title,
          final String message,
          final String type,
          final bool isRead,
          final String link,
          @DateTimeConverter() final DateTime? createdAt}) =
      _$AdminNotificationImpl;

  factory _AdminNotification.fromJson(Map<String, dynamic> json) =
      _$AdminNotificationImpl.fromJson;

  @override
  String get id;
  @override
  String get title;
  @override
  String get message;
  @override
  String get type;
  @override
  bool get isRead;
  @override
  String get link;
  @override
  @DateTimeConverter()
  DateTime? get createdAt;

  /// Create a copy of AdminNotification
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdminNotificationImplCopyWith<_$AdminNotificationImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
