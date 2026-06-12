import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

final RegExp readableUuidPattern = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  caseSensitive: false,
);

String readableRecordLabel(String key) {
  const overrides = {
    'id': 'Reference',
    'uuid': 'Reference',
    'created_at': 'Created',
    'updated_at': 'Last Updated',
    'deleted_at': 'Deleted',
    'count_date': 'Stock Take Date',
    'entry_date': 'Entry Date',
    'request_date': 'Request Date',
    'payment_date': 'Payment Date',
    'pay_period': 'Pay Period',
    'item_sku': 'Item',
    'sku': 'Item Code',
    'item_id': 'Item',
    'item_name': 'Item Name',
    'menu_item_id': 'Menu Item',
    'menu_item_name': 'Menu Item',
    'room_id': 'Room',
    'room_number': 'Room',
    'room_type_id': 'Room Type',
    'room_type': 'Room Type',
    'guest_id': 'Guest',
    'guest_name': 'Guest',
    'staff_name': 'Staff',
    'waiter_id': 'Waiter',
    'waiter_name': 'Waiter',
    'cashier_id': 'Cashier',
    'cashier_name': 'Cashier',
    'category_id': 'Category',
    'category_name': 'Category',
    'unit_of_measure': 'Unit',
    'quantity_requested': 'Requested Quantity',
    'requested_quantity': 'Requested Quantity',
    'quantity_approved': 'Approved Quantity',
    'approved_quantity': 'Approved Quantity',
    'quantity_received': 'Received Quantity',
    'current_stock': 'Current Stock',
    'opening_stock': 'Opening Stock',
    'closing_stock': 'Closing Stock',
    'system_quantity': 'System Quantity',
    'physical_quantity': 'Counted Quantity',
    'variance_percentage': 'Variance %',
    'variance_severity': 'Variance Level',
    'total_variance_value': 'Variance Value',
    'unit_cost': 'Unit Cost',
    'cost_price': 'Cost Price',
    'selling_price': 'Selling Price',
    'total_amount': 'Total Amount',
    'grand_total': 'Grand Total',
    'net_salary': 'Net Salary',
    'gross_salary': 'Gross Salary',
    'expected_cash': 'Expected Cash',
    'actual_cash': 'Actual Cash',
    'payment_method': 'Payment Method',
    'payment_status': 'Payment Status',
    'approval_status': 'Approval Status',
    'workflow_status': 'Workflow Status',
    'count_type': 'Stock Take Type',
    'store_type': 'Store Area',
    'request_number': 'Request Number',
    'po_number': 'Purchase Order',
    'grn_number': 'Goods Received Note',
    'invoice_number': 'Invoice Number',
    'receipt_number': 'Receipt Number',
    'order_number': 'Order Number',
    'booking_reference': 'Booking Reference',
    'confirmation_number': 'Confirmation Number',
    'count_number': 'Stock Take Number',
    'take_number': 'Stock Take Number',
    'request_id': 'Request',
    'branch_id': 'Branch',
    'requesting_branch_id': 'Requesting Branch',
    'from_branch_id': 'From Branch',
    'to_branch_id': 'To Branch',
    'reviewed_by': 'Reviewed By',
    'reviewed_by_id': 'Reviewed By',
    'approved_by': 'Approved By',
    'approved_by_id': 'Approved By',
    'auditor_id': 'Auditor',
    'created_by': 'Created By',
    'created_by_id': 'Created By',
    'requested_by': 'Requested By',
    'requested_by_id': 'Requested By',
    'requested_by_user': 'Requested By',
    'reviewed_by_user': 'Reviewed By',
    'requesting_branch': 'Requesting Branch',
  };
  return overrides[key] ??
      key
          .replaceAll('_', ' ')
          .split(' ')
          .where((part) => part.isNotEmpty)
          .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
          .join(' ');
}

String readableStatus(dynamic value) {
  final raw = '$value'.trim();
  if (raw.isEmpty || raw == 'null') return '—';
  return raw
      .replaceAll('_', ' ')
      .toLowerCase()
      .split(' ')
      .where((part) => part.isNotEmpty)
      .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
      .join(' ');
}

String readableDateTime(dynamic value) {
  final parsed = DateTime.tryParse('$value');
  if (parsed == null) return '$value';
  final local = parsed.toLocal();
  final date =
      '${local.day.toString().padLeft(2, '0')}/${local.month.toString().padLeft(2, '0')}/${local.year}';
  final time =
      '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  return '$date $time';
}

String readableBoolean(dynamic value) {
  if (value == true) return 'Yes';
  if (value == false) return 'No';
  final text = '$value'.trim().toLowerCase();
  if (text == 'true' || text == '1') return 'Yes';
  if (text == 'false' || text == '0') return 'No';
  return '$value';
}

String? readableMapName(Map<dynamic, dynamic> value) {
  final firstName = '${value['first_name'] ?? ''}'.trim();
  final lastName = '${value['last_name'] ?? ''}'.trim();
  final fullName =
      '${value['full_name'] ?? value['guest_name'] ?? value['staff_name'] ?? value['waiter_name'] ?? value['cashier_name'] ?? value['name'] ?? ''}'
          .trim();
  final joinedName = '$firstName $lastName'.trim();
  final email = '${value['email'] ?? ''}'.trim();
  final code = '${value['code'] ?? value['branch_code'] ?? ''}'.trim();
  final room = '${value['room_number'] ?? value['number'] ?? ''}'.trim();
  final title = '${value['title'] ?? value['description'] ?? ''}'.trim();
  final number =
      '${value['request_number'] ?? value['po_number'] ?? value['invoice_number'] ?? value['grn_number'] ?? value['order_number'] ?? value['booking_reference'] ?? value['confirmation_number'] ?? value['sku'] ?? value['item_sku'] ?? ''}'
          .trim();

  if (joinedName.isNotEmpty) {
    return email.isNotEmpty ? '$joinedName ($email)' : joinedName;
  }
  if (fullName.isNotEmpty) {
    return code.isNotEmpty ? '$fullName ($code)' : fullName;
  }
  if (room.isNotEmpty) return room;
  if (number.isNotEmpty) return number;
  if (title.isNotEmpty) return title;
  if (email.isNotEmpty) return email;
  return null;
}

String readableListValue(List<dynamic> values) {
  if (values.isEmpty) return 'None';
  return values.take(12).map((value) {
    if (value is Map) {
      final name = readableMapName(value) ??
          '${value['item_name'] ?? value['name'] ?? value['description'] ?? value['item_sku'] ?? value['sku'] ?? 'Item'}';
      final quantity = value['quantity_approved'] ??
          value['approved_quantity'] ??
          value['quantity_requested'] ??
          value['requested_quantity'] ??
          value['quantity'] ??
          value['qty'];
      final unit = value['unit'] ?? value['unit_of_measure'] ?? '';
      final quantityText = quantity == null || '$quantity'.trim().isEmpty
          ? ''
          : ' — Qty $quantity${'$unit'.trim().isNotEmpty ? ' $unit' : ''}';
      return '• $name$quantityText';
    }
    return '• $value';
  }).join('\n');
}

String? readableRelatedValue(Map<String, dynamic> row, String key) {
  final base = key.endsWith('_id') ? key.substring(0, key.length - 3) : key;
  final relatedKeys = <String>[
    if (key == 'branch_id') 'branch',
    if (key == 'branch_id' || key == 'requesting_branch_id')
      'requesting_branch',
    if (key == 'from_branch_id') 'from_branch',
    if (key == 'to_branch_id') 'to_branch',
    if (key == 'reviewed_by' || key == 'reviewed_by_id') 'reviewed_by_user',
    if (key == 'approved_by' || key == 'approved_by_id') 'approved_by_user',
    if (key == 'created_by' || key == 'created_by_id') 'created_by_user',
    if (key == 'requested_by' || key == 'requested_by_id') 'requested_by_user',
    if (key == 'auditor_id') 'auditor',
    if (key == 'auditor_id') 'reviewed_by_user',
    if (key == 'cashier_id') 'cashier',
    if (key == 'cashier_id') 'cashier_user',
    if (key == 'waiter_id') 'waiter',
    if (key == 'waiter_id') 'waiter_user',
    if (key == 'guest_id') 'guest',
    if (key == 'room_id') 'room',
    if (key == 'room_type_id') 'room_type',
    if (key == 'item_id') 'item',
    if (key == 'item_id') 'inventory_item',
    if (key == 'item_id') 'stock_item',
    if (key == 'item_id') 'menu_item',
    if (key == 'menu_item_id') 'menu_item',
    if (key == 'category_id') 'category',
    if (key == 'staff_id' || key == 'employee_id') 'staff',
    if (key == 'staff_id' || key == 'employee_id') 'employee',
    if (key == 'user_id') 'user',
    '${base}_user',
    base,
    '${base}_name',
  ];

  for (final relatedKey in relatedKeys) {
    final related = row[relatedKey];
    if (related is Map) {
      final name = readableMapName(related);
      if (name != null && name.isNotEmpty) return name;
    } else if (related != null &&
        '$related'.trim().isNotEmpty &&
        '$related' != 'null' &&
        !readableUuidPattern.hasMatch('$related')) {
      return '$related';
    }
  }
  return null;
}

String readableRecordValue(
    Map<String, dynamic> row, String key, dynamic value) {
  final related = readableRelatedValue(row, key);
  if (related != null) return related;

  if (value is Map) {
    return readableMapName(value) ?? 'Linked record';
  }
  if (value is List) return readableListValue(value);
  if (value is bool || '$value' == 'true' || '$value' == 'false') {
    return readableBoolean(value);
  }
  if (key.endsWith('_at') ||
      key.endsWith('_date') ||
      key == 'date' ||
      key == 'created_at' ||
      key == 'updated_at') {
    return readableDateTime(value);
  }
  if (key == 'status' ||
      key.endsWith('_status') ||
      key == 'count_type' ||
      key == 'store_type') {
    return readableStatus(value);
  }

  final text = '$value'.trim();
  if (text.isEmpty || text == 'null') return '—';
  if (readableUuidPattern.hasMatch(text)) return 'Linked record';
  return text;
}

bool shouldShowReadableRecordEntry(
    Map<String, dynamic> row, MapEntry<String, dynamic> entry) {
  final value = entry.value;
  if (entry.key.startsWith('_')) return false;
  if (value == null || '$value'.trim().isEmpty || '$value' == 'null') {
    return false;
  }
  if (entry.key.endsWith('_id') ||
      entry.key == 'reviewed_by' ||
      entry.key == 'approved_by' ||
      entry.key == 'created_by' ||
      entry.key == 'requested_by' ||
      entry.key == 'assigned_to' ||
      entry.key == 'reported_by') {
    return readableRelatedValue(row, entry.key) != null ||
        !readableUuidPattern.hasMatch('$value');
  }
  return true;
}

List<MapEntry<String, dynamic>> readableRecordEntries(
  Map<String, dynamic> row, {
  int limit = 80,
}) {
  const hiddenKeys = {
    'password',
    'password_hash',
    'token',
    'access_token',
    'refresh_token',
    'supabase_uid',
    'service_role_key',
  };
  return row.entries
      .where((entry) => !hiddenKeys.contains(entry.key.toLowerCase()))
      .where((entry) => shouldShowReadableRecordEntry(row, entry))
      .take(limit)
      .toList();
}

class ReadableRecordDetails extends StatelessWidget {
  const ReadableRecordDetails({
    super.key,
    required this.record,
    this.limit = 40,
    this.labelWidth = 160,
  });

  final Map<String, dynamic> record;
  final int limit;
  final double labelWidth;

  @override
  Widget build(BuildContext context) {
    final entries = readableRecordEntries(record, limit: limit);

    if (entries.isEmpty) {
      return const Text(
        'No details available',
        style: TextStyle(color: AppColors.kTextSecondary),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: entries
          .map(
            (entry) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: labelWidth,
                    child: Text(
                      readableRecordLabel(entry.key).toUpperCase(),
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.kTextSecondary,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      readableRecordValue(record, entry.key, entry.value),
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}
