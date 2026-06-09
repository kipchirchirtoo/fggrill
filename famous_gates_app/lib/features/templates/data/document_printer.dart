import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../services/print_service.dart';
import '../../pos/domain/models.dart';
import '../domain/template_providers.dart';
import 'template_print_renderer.dart';

Future<void> printCustomerDocument(
  WidgetRef ref, {
  required String templateKey,
  required String fallbackTitle,
  String? branchId,
  String? outletId,
  required SaleResult sale,
  required List<CartItem> items,
  required String branchName,
  String? tableNumber,
  String? roomNumber,
  String? customerName,
  String? staffLabel,
  String? publicCode,
  String? barcodeValue,
}) async {
  final doc = await resolveDocumentCached(
    ref,
    templateKey,
    branchId: _clean(branchId),
    outletId: _clean(outletId),
  );
  final sections = doc?.sections ?? const [];
  if (sections.isNotEmpty) {
    final data = _templateData(
      sale: sale,
      items: items,
      branchName: branchName,
      tillNumber: doc?.tillNumber,
      tableNumber: tableNumber,
      roomNumber: roomNumber,
      customerName: customerName,
      staffLabel: staffLabel,
      publicCode: publicCode,
      barcodeValue: barcodeValue,
    );
    await TemplatePrintRenderer().printThermal(sections, data);
    return;
  }

  await PrintService().printReceipt(
    sale,
    items,
    branchName,
    receiptType: fallbackTitle,
    tableNumber: tableNumber,
    roomNumber: roomNumber,
    customerName: customerName,
    staffLabel: staffLabel,
    publicCode: publicCode,
    barcodeValue: barcodeValue,
    tillNumber: doc?.tillNumber,
  );
}

TemplatePrintData _templateData({
  required SaleResult sale,
  required List<CartItem> items,
  required String branchName,
  String? tillNumber,
  String? tableNumber,
  String? roomNumber,
  String? customerName,
  String? staffLabel,
  String? publicCode,
  String? barcodeValue,
}) {
  final money = NumberFormat('#,##0.00', 'en_KE');
  final date = DateFormat('MM/dd/yyyy, hh:mm:ss a').format(sale.createdAt);
  final total = sale.total;
  final subtotal = total > 0 ? total / 1.16 : 0;
  final tax = total - subtotal;
  final method = sale.paymentMethod.trim();
  final isPending = ['pending', 'unpaid'].contains(method.toLowerCase().trim());
  final paid = isPending ? 0 : total;
  final code = _clean(publicCode);
  final receiptNumber = _clean(sale.receiptNumber) ?? '';
  final resolvedCustomer = _clean(customerName);
  final resolvedTable = _clean(tableNumber);
  final resolvedRoom = _clean(roomNumber);
  final resolvedStaffLabel = _clean(staffLabel) ?? 'Cashier';
  final resolvedStaffName = _clean(sale.cashierName);

  return TemplatePrintData(
    values: {
      'company_name': 'FamousGate Hotels',
      'branch_name': branchName,
      'company_address': 'Bomet, Kenya',
      'company_phone': '+254 706 782 828',
      'company_email': 'info@famousgatehotels.com',
      'till_number': _clean(tillNumber) ?? '',
      'receipt_number': receiptNumber,
      'public_code': code ?? '',
      'date': date,
      'customer_name': resolvedCustomer ?? '',
      'table_number': resolvedTable ?? '',
      'room_number': resolvedRoom ?? '',
      'staff_label': resolvedStaffLabel,
      'staff_name': resolvedStaffName ?? '',
      'payment_method': method.toUpperCase(),
      'subtotal': 'KES ${money.format(subtotal)}',
      'tax': 'KES ${money.format(tax)}',
      'total': 'KES ${money.format(total)}',
      'paid': 'KES ${money.format(paid)}',
    },
    items: items
        .map((item) => TemplateLineItem(
              name: item.name,
              qty: item.qty,
              lineTotal: item.lineTotal,
            ))
        .toList(),
    subtotal: subtotal,
    tax: tax,
    total: total,
    kvRows: [
      if (receiptNumber.isNotEmpty) MapEntry('Receipt #:', receiptNumber),
      MapEntry('Date:', date),
      if (resolvedTable != null) MapEntry('Table:', resolvedTable),
      if (resolvedRoom != null) MapEntry('Room:', resolvedRoom),
      if (resolvedCustomer != null) MapEntry('Customer:', resolvedCustomer),
      if (resolvedStaffName != null)
        MapEntry('$resolvedStaffLabel:', resolvedStaffName),
    ],
    barcodeValue: _clean(barcodeValue) ?? code ?? receiptNumber,
    code: code,
  );
}

String? _clean(String? value) {
  final text = value?.trim() ?? '';
  if (text.isEmpty || text.toLowerCase() == 'null') return null;
  return text;
}
