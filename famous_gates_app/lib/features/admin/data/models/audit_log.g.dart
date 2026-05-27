// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'audit_log.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AdminAuditLogImpl _$$AdminAuditLogImplFromJson(Map<String, dynamic> json) =>
    _$AdminAuditLogImpl(
      id: json['id'] as String? ?? '',
      action: json['action'] as String? ?? '',
      category: json['category'] as String? ?? '',
      description: json['description'] as String? ?? '',
      severity: json['severity'] as String? ?? 'info',
      userName: json['userName'] as String? ?? '',
      email: json['email'] as String? ?? '',
      branchName: json['branchName'] as String? ?? '',
      ipAddress: json['ipAddress'] as String? ?? '',
      userAgent: json['userAgent'] as String? ?? '',
      createdAt:
          const DateTimeConverter().fromJson(json['createdAt'] as String?),
    );

Map<String, dynamic> _$$AdminAuditLogImplToJson(_$AdminAuditLogImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'action': instance.action,
      'category': instance.category,
      'description': instance.description,
      'severity': instance.severity,
      'userName': instance.userName,
      'email': instance.email,
      'branchName': instance.branchName,
      'ipAddress': instance.ipAddress,
      'userAgent': instance.userAgent,
      'createdAt': const DateTimeConverter().toJson(instance.createdAt),
    };
