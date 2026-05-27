// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ai_analytics.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AiAnalyticsImpl _$$AiAnalyticsImplFromJson(Map<String, dynamic> json) =>
    _$AiAnalyticsImpl(
      demandForecast: (json['demandForecast'] as List<dynamic>?)
              ?.map((e) => ForecastPoint.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      revenueForecast: (json['revenueForecast'] as List<dynamic>?)
              ?.map((e) => ForecastPoint.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      insights: (json['insights'] as List<dynamic>?)
              ?.map((e) => AnalyticsInsight.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      anomalies: (json['anomalies'] as List<dynamic>?)
              ?.map((e) => AnomalyItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      branchComparisons: (json['branchComparisons'] as List<dynamic>?)
              ?.map((e) => BranchComparison.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );

Map<String, dynamic> _$$AiAnalyticsImplToJson(_$AiAnalyticsImpl instance) =>
    <String, dynamic>{
      'demandForecast': instance.demandForecast,
      'revenueForecast': instance.revenueForecast,
      'insights': instance.insights,
      'anomalies': instance.anomalies,
      'branchComparisons': instance.branchComparisons,
    };

_$ForecastPointImpl _$$ForecastPointImplFromJson(Map<String, dynamic> json) =>
    _$ForecastPointImpl(
      label: json['label'] as String? ?? '',
      value: (json['value'] as num?)?.toDouble() ?? 0.0,
      upperBound: (json['upperBound'] as num?)?.toDouble() ?? 0.0,
      lowerBound: (json['lowerBound'] as num?)?.toDouble() ?? 0.0,
    );

Map<String, dynamic> _$$ForecastPointImplToJson(_$ForecastPointImpl instance) =>
    <String, dynamic>{
      'label': instance.label,
      'value': instance.value,
      'upperBound': instance.upperBound,
      'lowerBound': instance.lowerBound,
    };

_$AnalyticsInsightImpl _$$AnalyticsInsightImplFromJson(
        Map<String, dynamic> json) =>
    _$AnalyticsInsightImpl(
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      type: json['type'] as String? ?? 'info',
      impact: (json['impact'] as num?)?.toDouble() ?? 0.0,
    );

Map<String, dynamic> _$$AnalyticsInsightImplToJson(
        _$AnalyticsInsightImpl instance) =>
    <String, dynamic>{
      'title': instance.title,
      'description': instance.description,
      'type': instance.type,
      'impact': instance.impact,
    };

_$AnomalyItemImpl _$$AnomalyItemImplFromJson(Map<String, dynamic> json) =>
    _$AnomalyItemImpl(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      severity: json['severity'] as String? ?? 'medium',
      category: json['category'] as String? ?? '',
      detectedAt:
          const DateTimeConverter().fromJson(json['detectedAt'] as String?),
    );

Map<String, dynamic> _$$AnomalyItemImplToJson(_$AnomalyItemImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'description': instance.description,
      'severity': instance.severity,
      'category': instance.category,
      'detectedAt': const DateTimeConverter().toJson(instance.detectedAt),
    };

_$BranchComparisonImpl _$$BranchComparisonImplFromJson(
        Map<String, dynamic> json) =>
    _$BranchComparisonImpl(
      branchName: json['branchName'] as String? ?? '',
      revenue: (json['revenue'] as num?)?.toDouble() ?? 0.0,
      occupancy: (json['occupancy'] as num?)?.toDouble() ?? 0.0,
      satisfaction: (json['satisfaction'] as num?)?.toDouble() ?? 0.0,
    );

Map<String, dynamic> _$$BranchComparisonImplToJson(
        _$BranchComparisonImpl instance) =>
    <String, dynamic>{
      'branchName': instance.branchName,
      'revenue': instance.revenue,
      'occupancy': instance.occupancy,
      'satisfaction': instance.satisfaction,
    };
