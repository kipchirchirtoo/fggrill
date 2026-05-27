// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'supplier.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AdminSupplierImpl _$$AdminSupplierImplFromJson(Map<String, dynamic> json) =>
    _$AdminSupplierImpl(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      contactPerson: json['contactPerson'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      email: json['email'] as String? ?? '',
      address: json['address'] as String? ?? '',
      paymentTerms: json['paymentTerms'] as String? ?? '',
      bankName: json['bankName'] as String? ?? '',
      bankAccount: json['bankAccount'] as String? ?? '',
      bankCode: json['bankCode'] as String? ?? '',
      balance: (json['balance'] as num?)?.toDouble() ?? 0.0,
      itemCount: (json['itemCount'] as num?)?.toInt() ?? 0,
      status: json['status'] as String? ?? 'active',
    );

Map<String, dynamic> _$$AdminSupplierImplToJson(_$AdminSupplierImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'contactPerson': instance.contactPerson,
      'phone': instance.phone,
      'email': instance.email,
      'address': instance.address,
      'paymentTerms': instance.paymentTerms,
      'bankName': instance.bankName,
      'bankAccount': instance.bankAccount,
      'bankCode': instance.bankCode,
      'balance': instance.balance,
      'itemCount': instance.itemCount,
      'status': instance.status,
    };
