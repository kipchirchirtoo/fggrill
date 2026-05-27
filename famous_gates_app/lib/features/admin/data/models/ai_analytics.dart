import 'package:freezed_annotation/freezed_annotation.dart';
part 'ai_analytics.freezed.dart';
part 'ai_analytics.g.dart';

@freezed
class AiAnalytics with _$AiAnalytics {
  const factory AiAnalytics({
    @Default([]) List<ForecastPoint> demandForecast,
    @Default([]) List<ForecastPoint> revenueForecast,
    @Default([]) List<AnalyticsInsight> insights,
    @Default([]) List<AnomalyItem> anomalies,
    @Default([]) List<BranchComparison> branchComparisons,
  }) = _AiAnalytics;

  factory AiAnalytics.fromJson(Map<String, dynamic> json) =>
      _$AiAnalyticsFromJson(json);
}

@freezed
class ForecastPoint with _$ForecastPoint {
  const factory ForecastPoint({
    @Default('') String label,
    @Default(0.0) double value,
    @Default(0.0) double upperBound,
    @Default(0.0) double lowerBound,
  }) = _ForecastPoint;

  factory ForecastPoint.fromJson(Map<String, dynamic> json) =>
      _$ForecastPointFromJson(json);
}

@freezed
class AnalyticsInsight with _$AnalyticsInsight {
  const factory AnalyticsInsight({
    @Default('') String title,
    @Default('') String description,
    @Default('info') String type,
    @Default(0.0) double impact,
  }) = _AnalyticsInsight;

  factory AnalyticsInsight.fromJson(Map<String, dynamic> json) =>
      _$AnalyticsInsightFromJson(json);
}

@freezed
class AnomalyItem with _$AnomalyItem {
  const factory AnomalyItem({
    @Default('') String id,
    @Default('') String title,
    @Default('') String description,
    @Default('medium') String severity,
    @Default('') String category,
    @DateTimeConverter() DateTime? detectedAt,
  }) = _AnomalyItem;

  factory AnomalyItem.fromJson(Map<String, dynamic> json) =>
      _$AnomalyItemFromJson(json);
}

@freezed
class BranchComparison with _$BranchComparison {
  const factory BranchComparison({
    @Default('') String branchName,
    @Default(0.0) double revenue,
    @Default(0.0) double occupancy,
    @Default(0.0) double satisfaction,
  }) = _BranchComparison;

  factory BranchComparison.fromJson(Map<String, dynamic> json) =>
      _$BranchComparisonFromJson(json);
}

class DateTimeConverter implements JsonConverter<DateTime?, String?> {
  const DateTimeConverter();

  @override
  DateTime? fromJson(String? json) =>
      json == null ? null : DateTime.tryParse(json);

  @override
  String? toJson(DateTime? object) => object?.toIso8601String();
}
