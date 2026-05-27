// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'ai_analytics.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AiAnalytics _$AiAnalyticsFromJson(Map<String, dynamic> json) {
  return _AiAnalytics.fromJson(json);
}

/// @nodoc
mixin _$AiAnalytics {
  List<ForecastPoint> get demandForecast => throw _privateConstructorUsedError;
  List<ForecastPoint> get revenueForecast => throw _privateConstructorUsedError;
  List<AnalyticsInsight> get insights => throw _privateConstructorUsedError;
  List<AnomalyItem> get anomalies => throw _privateConstructorUsedError;
  List<BranchComparison> get branchComparisons =>
      throw _privateConstructorUsedError;

  /// Serializes this AiAnalytics to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AiAnalytics
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AiAnalyticsCopyWith<AiAnalytics> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AiAnalyticsCopyWith<$Res> {
  factory $AiAnalyticsCopyWith(
          AiAnalytics value, $Res Function(AiAnalytics) then) =
      _$AiAnalyticsCopyWithImpl<$Res, AiAnalytics>;
  @useResult
  $Res call(
      {List<ForecastPoint> demandForecast,
      List<ForecastPoint> revenueForecast,
      List<AnalyticsInsight> insights,
      List<AnomalyItem> anomalies,
      List<BranchComparison> branchComparisons});
}

/// @nodoc
class _$AiAnalyticsCopyWithImpl<$Res, $Val extends AiAnalytics>
    implements $AiAnalyticsCopyWith<$Res> {
  _$AiAnalyticsCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AiAnalytics
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? demandForecast = null,
    Object? revenueForecast = null,
    Object? insights = null,
    Object? anomalies = null,
    Object? branchComparisons = null,
  }) {
    return _then(_value.copyWith(
      demandForecast: null == demandForecast
          ? _value.demandForecast
          : demandForecast // ignore: cast_nullable_to_non_nullable
              as List<ForecastPoint>,
      revenueForecast: null == revenueForecast
          ? _value.revenueForecast
          : revenueForecast // ignore: cast_nullable_to_non_nullable
              as List<ForecastPoint>,
      insights: null == insights
          ? _value.insights
          : insights // ignore: cast_nullable_to_non_nullable
              as List<AnalyticsInsight>,
      anomalies: null == anomalies
          ? _value.anomalies
          : anomalies // ignore: cast_nullable_to_non_nullable
              as List<AnomalyItem>,
      branchComparisons: null == branchComparisons
          ? _value.branchComparisons
          : branchComparisons // ignore: cast_nullable_to_non_nullable
              as List<BranchComparison>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AiAnalyticsImplCopyWith<$Res>
    implements $AiAnalyticsCopyWith<$Res> {
  factory _$$AiAnalyticsImplCopyWith(
          _$AiAnalyticsImpl value, $Res Function(_$AiAnalyticsImpl) then) =
      __$$AiAnalyticsImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {List<ForecastPoint> demandForecast,
      List<ForecastPoint> revenueForecast,
      List<AnalyticsInsight> insights,
      List<AnomalyItem> anomalies,
      List<BranchComparison> branchComparisons});
}

/// @nodoc
class __$$AiAnalyticsImplCopyWithImpl<$Res>
    extends _$AiAnalyticsCopyWithImpl<$Res, _$AiAnalyticsImpl>
    implements _$$AiAnalyticsImplCopyWith<$Res> {
  __$$AiAnalyticsImplCopyWithImpl(
      _$AiAnalyticsImpl _value, $Res Function(_$AiAnalyticsImpl) _then)
      : super(_value, _then);

  /// Create a copy of AiAnalytics
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? demandForecast = null,
    Object? revenueForecast = null,
    Object? insights = null,
    Object? anomalies = null,
    Object? branchComparisons = null,
  }) {
    return _then(_$AiAnalyticsImpl(
      demandForecast: null == demandForecast
          ? _value._demandForecast
          : demandForecast // ignore: cast_nullable_to_non_nullable
              as List<ForecastPoint>,
      revenueForecast: null == revenueForecast
          ? _value._revenueForecast
          : revenueForecast // ignore: cast_nullable_to_non_nullable
              as List<ForecastPoint>,
      insights: null == insights
          ? _value._insights
          : insights // ignore: cast_nullable_to_non_nullable
              as List<AnalyticsInsight>,
      anomalies: null == anomalies
          ? _value._anomalies
          : anomalies // ignore: cast_nullable_to_non_nullable
              as List<AnomalyItem>,
      branchComparisons: null == branchComparisons
          ? _value._branchComparisons
          : branchComparisons // ignore: cast_nullable_to_non_nullable
              as List<BranchComparison>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AiAnalyticsImpl implements _AiAnalytics {
  const _$AiAnalyticsImpl(
      {final List<ForecastPoint> demandForecast = const [],
      final List<ForecastPoint> revenueForecast = const [],
      final List<AnalyticsInsight> insights = const [],
      final List<AnomalyItem> anomalies = const [],
      final List<BranchComparison> branchComparisons = const []})
      : _demandForecast = demandForecast,
        _revenueForecast = revenueForecast,
        _insights = insights,
        _anomalies = anomalies,
        _branchComparisons = branchComparisons;

  factory _$AiAnalyticsImpl.fromJson(Map<String, dynamic> json) =>
      _$$AiAnalyticsImplFromJson(json);

  final List<ForecastPoint> _demandForecast;
  @override
  @JsonKey()
  List<ForecastPoint> get demandForecast {
    if (_demandForecast is EqualUnmodifiableListView) return _demandForecast;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_demandForecast);
  }

  final List<ForecastPoint> _revenueForecast;
  @override
  @JsonKey()
  List<ForecastPoint> get revenueForecast {
    if (_revenueForecast is EqualUnmodifiableListView) return _revenueForecast;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_revenueForecast);
  }

  final List<AnalyticsInsight> _insights;
  @override
  @JsonKey()
  List<AnalyticsInsight> get insights {
    if (_insights is EqualUnmodifiableListView) return _insights;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_insights);
  }

  final List<AnomalyItem> _anomalies;
  @override
  @JsonKey()
  List<AnomalyItem> get anomalies {
    if (_anomalies is EqualUnmodifiableListView) return _anomalies;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_anomalies);
  }

  final List<BranchComparison> _branchComparisons;
  @override
  @JsonKey()
  List<BranchComparison> get branchComparisons {
    if (_branchComparisons is EqualUnmodifiableListView)
      return _branchComparisons;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_branchComparisons);
  }

  @override
  String toString() {
    return 'AiAnalytics(demandForecast: $demandForecast, revenueForecast: $revenueForecast, insights: $insights, anomalies: $anomalies, branchComparisons: $branchComparisons)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AiAnalyticsImpl &&
            const DeepCollectionEquality()
                .equals(other._demandForecast, _demandForecast) &&
            const DeepCollectionEquality()
                .equals(other._revenueForecast, _revenueForecast) &&
            const DeepCollectionEquality().equals(other._insights, _insights) &&
            const DeepCollectionEquality()
                .equals(other._anomalies, _anomalies) &&
            const DeepCollectionEquality()
                .equals(other._branchComparisons, _branchComparisons));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      const DeepCollectionEquality().hash(_demandForecast),
      const DeepCollectionEquality().hash(_revenueForecast),
      const DeepCollectionEquality().hash(_insights),
      const DeepCollectionEquality().hash(_anomalies),
      const DeepCollectionEquality().hash(_branchComparisons));

  /// Create a copy of AiAnalytics
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AiAnalyticsImplCopyWith<_$AiAnalyticsImpl> get copyWith =>
      __$$AiAnalyticsImplCopyWithImpl<_$AiAnalyticsImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AiAnalyticsImplToJson(
      this,
    );
  }
}

abstract class _AiAnalytics implements AiAnalytics {
  const factory _AiAnalytics(
      {final List<ForecastPoint> demandForecast,
      final List<ForecastPoint> revenueForecast,
      final List<AnalyticsInsight> insights,
      final List<AnomalyItem> anomalies,
      final List<BranchComparison> branchComparisons}) = _$AiAnalyticsImpl;

  factory _AiAnalytics.fromJson(Map<String, dynamic> json) =
      _$AiAnalyticsImpl.fromJson;

  @override
  List<ForecastPoint> get demandForecast;
  @override
  List<ForecastPoint> get revenueForecast;
  @override
  List<AnalyticsInsight> get insights;
  @override
  List<AnomalyItem> get anomalies;
  @override
  List<BranchComparison> get branchComparisons;

  /// Create a copy of AiAnalytics
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AiAnalyticsImplCopyWith<_$AiAnalyticsImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

ForecastPoint _$ForecastPointFromJson(Map<String, dynamic> json) {
  return _ForecastPoint.fromJson(json);
}

/// @nodoc
mixin _$ForecastPoint {
  String get label => throw _privateConstructorUsedError;
  double get value => throw _privateConstructorUsedError;
  double get upperBound => throw _privateConstructorUsedError;
  double get lowerBound => throw _privateConstructorUsedError;

  /// Serializes this ForecastPoint to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ForecastPoint
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ForecastPointCopyWith<ForecastPoint> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ForecastPointCopyWith<$Res> {
  factory $ForecastPointCopyWith(
          ForecastPoint value, $Res Function(ForecastPoint) then) =
      _$ForecastPointCopyWithImpl<$Res, ForecastPoint>;
  @useResult
  $Res call({String label, double value, double upperBound, double lowerBound});
}

/// @nodoc
class _$ForecastPointCopyWithImpl<$Res, $Val extends ForecastPoint>
    implements $ForecastPointCopyWith<$Res> {
  _$ForecastPointCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ForecastPoint
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? label = null,
    Object? value = null,
    Object? upperBound = null,
    Object? lowerBound = null,
  }) {
    return _then(_value.copyWith(
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      value: null == value
          ? _value.value
          : value // ignore: cast_nullable_to_non_nullable
              as double,
      upperBound: null == upperBound
          ? _value.upperBound
          : upperBound // ignore: cast_nullable_to_non_nullable
              as double,
      lowerBound: null == lowerBound
          ? _value.lowerBound
          : lowerBound // ignore: cast_nullable_to_non_nullable
              as double,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ForecastPointImplCopyWith<$Res>
    implements $ForecastPointCopyWith<$Res> {
  factory _$$ForecastPointImplCopyWith(
          _$ForecastPointImpl value, $Res Function(_$ForecastPointImpl) then) =
      __$$ForecastPointImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String label, double value, double upperBound, double lowerBound});
}

/// @nodoc
class __$$ForecastPointImplCopyWithImpl<$Res>
    extends _$ForecastPointCopyWithImpl<$Res, _$ForecastPointImpl>
    implements _$$ForecastPointImplCopyWith<$Res> {
  __$$ForecastPointImplCopyWithImpl(
      _$ForecastPointImpl _value, $Res Function(_$ForecastPointImpl) _then)
      : super(_value, _then);

  /// Create a copy of ForecastPoint
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? label = null,
    Object? value = null,
    Object? upperBound = null,
    Object? lowerBound = null,
  }) {
    return _then(_$ForecastPointImpl(
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      value: null == value
          ? _value.value
          : value // ignore: cast_nullable_to_non_nullable
              as double,
      upperBound: null == upperBound
          ? _value.upperBound
          : upperBound // ignore: cast_nullable_to_non_nullable
              as double,
      lowerBound: null == lowerBound
          ? _value.lowerBound
          : lowerBound // ignore: cast_nullable_to_non_nullable
              as double,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ForecastPointImpl implements _ForecastPoint {
  const _$ForecastPointImpl(
      {this.label = '',
      this.value = 0.0,
      this.upperBound = 0.0,
      this.lowerBound = 0.0});

  factory _$ForecastPointImpl.fromJson(Map<String, dynamic> json) =>
      _$$ForecastPointImplFromJson(json);

  @override
  @JsonKey()
  final String label;
  @override
  @JsonKey()
  final double value;
  @override
  @JsonKey()
  final double upperBound;
  @override
  @JsonKey()
  final double lowerBound;

  @override
  String toString() {
    return 'ForecastPoint(label: $label, value: $value, upperBound: $upperBound, lowerBound: $lowerBound)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ForecastPointImpl &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.value, value) || other.value == value) &&
            (identical(other.upperBound, upperBound) ||
                other.upperBound == upperBound) &&
            (identical(other.lowerBound, lowerBound) ||
                other.lowerBound == lowerBound));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, label, value, upperBound, lowerBound);

  /// Create a copy of ForecastPoint
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ForecastPointImplCopyWith<_$ForecastPointImpl> get copyWith =>
      __$$ForecastPointImplCopyWithImpl<_$ForecastPointImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ForecastPointImplToJson(
      this,
    );
  }
}

abstract class _ForecastPoint implements ForecastPoint {
  const factory _ForecastPoint(
      {final String label,
      final double value,
      final double upperBound,
      final double lowerBound}) = _$ForecastPointImpl;

  factory _ForecastPoint.fromJson(Map<String, dynamic> json) =
      _$ForecastPointImpl.fromJson;

  @override
  String get label;
  @override
  double get value;
  @override
  double get upperBound;
  @override
  double get lowerBound;

  /// Create a copy of ForecastPoint
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ForecastPointImplCopyWith<_$ForecastPointImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AnalyticsInsight _$AnalyticsInsightFromJson(Map<String, dynamic> json) {
  return _AnalyticsInsight.fromJson(json);
}

/// @nodoc
mixin _$AnalyticsInsight {
  String get title => throw _privateConstructorUsedError;
  String get description => throw _privateConstructorUsedError;
  String get type => throw _privateConstructorUsedError;
  double get impact => throw _privateConstructorUsedError;

  /// Serializes this AnalyticsInsight to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AnalyticsInsight
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AnalyticsInsightCopyWith<AnalyticsInsight> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AnalyticsInsightCopyWith<$Res> {
  factory $AnalyticsInsightCopyWith(
          AnalyticsInsight value, $Res Function(AnalyticsInsight) then) =
      _$AnalyticsInsightCopyWithImpl<$Res, AnalyticsInsight>;
  @useResult
  $Res call({String title, String description, String type, double impact});
}

/// @nodoc
class _$AnalyticsInsightCopyWithImpl<$Res, $Val extends AnalyticsInsight>
    implements $AnalyticsInsightCopyWith<$Res> {
  _$AnalyticsInsightCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AnalyticsInsight
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? title = null,
    Object? description = null,
    Object? type = null,
    Object? impact = null,
  }) {
    return _then(_value.copyWith(
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      description: null == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      impact: null == impact
          ? _value.impact
          : impact // ignore: cast_nullable_to_non_nullable
              as double,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AnalyticsInsightImplCopyWith<$Res>
    implements $AnalyticsInsightCopyWith<$Res> {
  factory _$$AnalyticsInsightImplCopyWith(_$AnalyticsInsightImpl value,
          $Res Function(_$AnalyticsInsightImpl) then) =
      __$$AnalyticsInsightImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String title, String description, String type, double impact});
}

/// @nodoc
class __$$AnalyticsInsightImplCopyWithImpl<$Res>
    extends _$AnalyticsInsightCopyWithImpl<$Res, _$AnalyticsInsightImpl>
    implements _$$AnalyticsInsightImplCopyWith<$Res> {
  __$$AnalyticsInsightImplCopyWithImpl(_$AnalyticsInsightImpl _value,
      $Res Function(_$AnalyticsInsightImpl) _then)
      : super(_value, _then);

  /// Create a copy of AnalyticsInsight
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? title = null,
    Object? description = null,
    Object? type = null,
    Object? impact = null,
  }) {
    return _then(_$AnalyticsInsightImpl(
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      description: null == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      impact: null == impact
          ? _value.impact
          : impact // ignore: cast_nullable_to_non_nullable
              as double,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AnalyticsInsightImpl implements _AnalyticsInsight {
  const _$AnalyticsInsightImpl(
      {this.title = '',
      this.description = '',
      this.type = 'info',
      this.impact = 0.0});

  factory _$AnalyticsInsightImpl.fromJson(Map<String, dynamic> json) =>
      _$$AnalyticsInsightImplFromJson(json);

  @override
  @JsonKey()
  final String title;
  @override
  @JsonKey()
  final String description;
  @override
  @JsonKey()
  final String type;
  @override
  @JsonKey()
  final double impact;

  @override
  String toString() {
    return 'AnalyticsInsight(title: $title, description: $description, type: $type, impact: $impact)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AnalyticsInsightImpl &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.impact, impact) || other.impact == impact));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, title, description, type, impact);

  /// Create a copy of AnalyticsInsight
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AnalyticsInsightImplCopyWith<_$AnalyticsInsightImpl> get copyWith =>
      __$$AnalyticsInsightImplCopyWithImpl<_$AnalyticsInsightImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AnalyticsInsightImplToJson(
      this,
    );
  }
}

abstract class _AnalyticsInsight implements AnalyticsInsight {
  const factory _AnalyticsInsight(
      {final String title,
      final String description,
      final String type,
      final double impact}) = _$AnalyticsInsightImpl;

  factory _AnalyticsInsight.fromJson(Map<String, dynamic> json) =
      _$AnalyticsInsightImpl.fromJson;

  @override
  String get title;
  @override
  String get description;
  @override
  String get type;
  @override
  double get impact;

  /// Create a copy of AnalyticsInsight
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AnalyticsInsightImplCopyWith<_$AnalyticsInsightImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

AnomalyItem _$AnomalyItemFromJson(Map<String, dynamic> json) {
  return _AnomalyItem.fromJson(json);
}

/// @nodoc
mixin _$AnomalyItem {
  String get id => throw _privateConstructorUsedError;
  String get title => throw _privateConstructorUsedError;
  String get description => throw _privateConstructorUsedError;
  String get severity => throw _privateConstructorUsedError;
  String get category => throw _privateConstructorUsedError;
  @DateTimeConverter()
  DateTime? get detectedAt => throw _privateConstructorUsedError;

  /// Serializes this AnomalyItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AnomalyItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AnomalyItemCopyWith<AnomalyItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AnomalyItemCopyWith<$Res> {
  factory $AnomalyItemCopyWith(
          AnomalyItem value, $Res Function(AnomalyItem) then) =
      _$AnomalyItemCopyWithImpl<$Res, AnomalyItem>;
  @useResult
  $Res call(
      {String id,
      String title,
      String description,
      String severity,
      String category,
      @DateTimeConverter() DateTime? detectedAt});
}

/// @nodoc
class _$AnomalyItemCopyWithImpl<$Res, $Val extends AnomalyItem>
    implements $AnomalyItemCopyWith<$Res> {
  _$AnomalyItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AnomalyItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? description = null,
    Object? severity = null,
    Object? category = null,
    Object? detectedAt = freezed,
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
      description: null == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String,
      severity: null == severity
          ? _value.severity
          : severity // ignore: cast_nullable_to_non_nullable
              as String,
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as String,
      detectedAt: freezed == detectedAt
          ? _value.detectedAt
          : detectedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AnomalyItemImplCopyWith<$Res>
    implements $AnomalyItemCopyWith<$Res> {
  factory _$$AnomalyItemImplCopyWith(
          _$AnomalyItemImpl value, $Res Function(_$AnomalyItemImpl) then) =
      __$$AnomalyItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String title,
      String description,
      String severity,
      String category,
      @DateTimeConverter() DateTime? detectedAt});
}

/// @nodoc
class __$$AnomalyItemImplCopyWithImpl<$Res>
    extends _$AnomalyItemCopyWithImpl<$Res, _$AnomalyItemImpl>
    implements _$$AnomalyItemImplCopyWith<$Res> {
  __$$AnomalyItemImplCopyWithImpl(
      _$AnomalyItemImpl _value, $Res Function(_$AnomalyItemImpl) _then)
      : super(_value, _then);

  /// Create a copy of AnomalyItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? title = null,
    Object? description = null,
    Object? severity = null,
    Object? category = null,
    Object? detectedAt = freezed,
  }) {
    return _then(_$AnomalyItemImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      description: null == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String,
      severity: null == severity
          ? _value.severity
          : severity // ignore: cast_nullable_to_non_nullable
              as String,
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as String,
      detectedAt: freezed == detectedAt
          ? _value.detectedAt
          : detectedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AnomalyItemImpl implements _AnomalyItem {
  const _$AnomalyItemImpl(
      {this.id = '',
      this.title = '',
      this.description = '',
      this.severity = 'medium',
      this.category = '',
      @DateTimeConverter() this.detectedAt});

  factory _$AnomalyItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$AnomalyItemImplFromJson(json);

  @override
  @JsonKey()
  final String id;
  @override
  @JsonKey()
  final String title;
  @override
  @JsonKey()
  final String description;
  @override
  @JsonKey()
  final String severity;
  @override
  @JsonKey()
  final String category;
  @override
  @DateTimeConverter()
  final DateTime? detectedAt;

  @override
  String toString() {
    return 'AnomalyItem(id: $id, title: $title, description: $description, severity: $severity, category: $category, detectedAt: $detectedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AnomalyItemImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.severity, severity) ||
                other.severity == severity) &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.detectedAt, detectedAt) ||
                other.detectedAt == detectedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, id, title, description, severity, category, detectedAt);

  /// Create a copy of AnomalyItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AnomalyItemImplCopyWith<_$AnomalyItemImpl> get copyWith =>
      __$$AnomalyItemImplCopyWithImpl<_$AnomalyItemImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AnomalyItemImplToJson(
      this,
    );
  }
}

abstract class _AnomalyItem implements AnomalyItem {
  const factory _AnomalyItem(
      {final String id,
      final String title,
      final String description,
      final String severity,
      final String category,
      @DateTimeConverter() final DateTime? detectedAt}) = _$AnomalyItemImpl;

  factory _AnomalyItem.fromJson(Map<String, dynamic> json) =
      _$AnomalyItemImpl.fromJson;

  @override
  String get id;
  @override
  String get title;
  @override
  String get description;
  @override
  String get severity;
  @override
  String get category;
  @override
  @DateTimeConverter()
  DateTime? get detectedAt;

  /// Create a copy of AnomalyItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AnomalyItemImplCopyWith<_$AnomalyItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

BranchComparison _$BranchComparisonFromJson(Map<String, dynamic> json) {
  return _BranchComparison.fromJson(json);
}

/// @nodoc
mixin _$BranchComparison {
  String get branchName => throw _privateConstructorUsedError;
  double get revenue => throw _privateConstructorUsedError;
  double get occupancy => throw _privateConstructorUsedError;
  double get satisfaction => throw _privateConstructorUsedError;

  /// Serializes this BranchComparison to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of BranchComparison
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $BranchComparisonCopyWith<BranchComparison> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $BranchComparisonCopyWith<$Res> {
  factory $BranchComparisonCopyWith(
          BranchComparison value, $Res Function(BranchComparison) then) =
      _$BranchComparisonCopyWithImpl<$Res, BranchComparison>;
  @useResult
  $Res call(
      {String branchName,
      double revenue,
      double occupancy,
      double satisfaction});
}

/// @nodoc
class _$BranchComparisonCopyWithImpl<$Res, $Val extends BranchComparison>
    implements $BranchComparisonCopyWith<$Res> {
  _$BranchComparisonCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of BranchComparison
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? branchName = null,
    Object? revenue = null,
    Object? occupancy = null,
    Object? satisfaction = null,
  }) {
    return _then(_value.copyWith(
      branchName: null == branchName
          ? _value.branchName
          : branchName // ignore: cast_nullable_to_non_nullable
              as String,
      revenue: null == revenue
          ? _value.revenue
          : revenue // ignore: cast_nullable_to_non_nullable
              as double,
      occupancy: null == occupancy
          ? _value.occupancy
          : occupancy // ignore: cast_nullable_to_non_nullable
              as double,
      satisfaction: null == satisfaction
          ? _value.satisfaction
          : satisfaction // ignore: cast_nullable_to_non_nullable
              as double,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$BranchComparisonImplCopyWith<$Res>
    implements $BranchComparisonCopyWith<$Res> {
  factory _$$BranchComparisonImplCopyWith(_$BranchComparisonImpl value,
          $Res Function(_$BranchComparisonImpl) then) =
      __$$BranchComparisonImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String branchName,
      double revenue,
      double occupancy,
      double satisfaction});
}

/// @nodoc
class __$$BranchComparisonImplCopyWithImpl<$Res>
    extends _$BranchComparisonCopyWithImpl<$Res, _$BranchComparisonImpl>
    implements _$$BranchComparisonImplCopyWith<$Res> {
  __$$BranchComparisonImplCopyWithImpl(_$BranchComparisonImpl _value,
      $Res Function(_$BranchComparisonImpl) _then)
      : super(_value, _then);

  /// Create a copy of BranchComparison
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? branchName = null,
    Object? revenue = null,
    Object? occupancy = null,
    Object? satisfaction = null,
  }) {
    return _then(_$BranchComparisonImpl(
      branchName: null == branchName
          ? _value.branchName
          : branchName // ignore: cast_nullable_to_non_nullable
              as String,
      revenue: null == revenue
          ? _value.revenue
          : revenue // ignore: cast_nullable_to_non_nullable
              as double,
      occupancy: null == occupancy
          ? _value.occupancy
          : occupancy // ignore: cast_nullable_to_non_nullable
              as double,
      satisfaction: null == satisfaction
          ? _value.satisfaction
          : satisfaction // ignore: cast_nullable_to_non_nullable
              as double,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$BranchComparisonImpl implements _BranchComparison {
  const _$BranchComparisonImpl(
      {this.branchName = '',
      this.revenue = 0.0,
      this.occupancy = 0.0,
      this.satisfaction = 0.0});

  factory _$BranchComparisonImpl.fromJson(Map<String, dynamic> json) =>
      _$$BranchComparisonImplFromJson(json);

  @override
  @JsonKey()
  final String branchName;
  @override
  @JsonKey()
  final double revenue;
  @override
  @JsonKey()
  final double occupancy;
  @override
  @JsonKey()
  final double satisfaction;

  @override
  String toString() {
    return 'BranchComparison(branchName: $branchName, revenue: $revenue, occupancy: $occupancy, satisfaction: $satisfaction)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BranchComparisonImpl &&
            (identical(other.branchName, branchName) ||
                other.branchName == branchName) &&
            (identical(other.revenue, revenue) || other.revenue == revenue) &&
            (identical(other.occupancy, occupancy) ||
                other.occupancy == occupancy) &&
            (identical(other.satisfaction, satisfaction) ||
                other.satisfaction == satisfaction));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, branchName, revenue, occupancy, satisfaction);

  /// Create a copy of BranchComparison
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BranchComparisonImplCopyWith<_$BranchComparisonImpl> get copyWith =>
      __$$BranchComparisonImplCopyWithImpl<_$BranchComparisonImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$BranchComparisonImplToJson(
      this,
    );
  }
}

abstract class _BranchComparison implements BranchComparison {
  const factory _BranchComparison(
      {final String branchName,
      final double revenue,
      final double occupancy,
      final double satisfaction}) = _$BranchComparisonImpl;

  factory _BranchComparison.fromJson(Map<String, dynamic> json) =
      _$BranchComparisonImpl.fromJson;

  @override
  String get branchName;
  @override
  double get revenue;
  @override
  double get occupancy;
  @override
  double get satisfaction;

  /// Create a copy of BranchComparison
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BranchComparisonImplCopyWith<_$BranchComparisonImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
