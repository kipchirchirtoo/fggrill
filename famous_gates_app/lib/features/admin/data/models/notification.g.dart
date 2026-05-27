// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AdminNotificationImpl _$$AdminNotificationImplFromJson(
        Map<String, dynamic> json) =>
    _$AdminNotificationImpl(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      message: json['message'] as String? ?? '',
      type: json['type'] as String? ?? 'info',
      isRead: json['isRead'] as bool? ?? false,
      link: json['link'] as String? ?? '',
      createdAt:
          const DateTimeConverter().fromJson(json['createdAt'] as String?),
    );

Map<String, dynamic> _$$AdminNotificationImplToJson(
        _$AdminNotificationImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'message': instance.message,
      'type': instance.type,
      'isRead': instance.isRead,
      'link': instance.link,
      'createdAt': const DateTimeConverter().toJson(instance.createdAt),
    };
