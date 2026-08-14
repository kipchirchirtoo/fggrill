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
  num? amountTendered,
  num? changeGiven,
  String? duplicateLabel,
  List<MapEntry<String, String>>? extraKvRows,
}) async {
  final branding = _customerDocumentBranding(
    branchId: branchId,
    branchName: branchName,
  );
  final doc = await resolveDocumentCached(
    ref,
    templateKey,
    branchId: _clean(branchId),
    outletId: _clean(outletId),
  );
  final sections = doc?.sections ?? const [];
  if (sections.isNotEmpty) {
    final isCustomerBill = templateKey == 'customer_bill';
    final isRoomCharge = templateKey == 'room_charge';
    final data = _templateData(
      sale: sale,
      items: items,
      branchName: branding.branchName,
      companyName: branding.companyName,
      tillNumber: doc?.tillNumber,
      tableNumber: tableNumber,
      roomNumber: roomNumber,
      customerName: customerName,
      staffLabel: staffLabel,
      publicCode: publicCode,
      barcodeValue: barcodeValue,
      amountTendered: amountTendered,
      changeGiven: changeGiven,
      showVat: !isCustomerBill,
      noticeText: isCustomerBill
          ? 'Collect Official Receipt with ETR at the Cashier'
          : (isRoomCharge ? 'Posted to Guest Room Folio' : null),
      duplicateLabel: duplicateLabel,
      extraKvRows: extraKvRows ?? const [],
    );
    await TemplatePrintRenderer().printThermal(sections, data);
    return;
  }

  await PrintService().printReceipt(
    sale,
    items,
    branding.branchName,
    receiptType: fallbackTitle,
    companyNameOverride: branding.companyName,
    tableNumber: tableNumber,
    roomNumber: roomNumber,
    customerName: customerName,
    staffLabel: staffLabel,
    publicCode: publicCode,
    barcodeValue: barcodeValue,
    amountTendered: amountTendered,
    changeGiven: changeGiven,
    tillNumber: doc?.tillNumber,
    duplicateLabel: duplicateLabel,
  );
}

Future<void> printCreditBillDocument(
  WidgetRef ref, {
  String? branchId,
  String? outletId,
  required String branchName,
  required String staffName,
  required num amount,
  required List<CartItem> items,
  String? creditNumber,
  String? employeeId,
  String? department,
  String? cashierName,
  String? sourceReference,
  DateTime? createdAt,
}) async {
  final doc = await resolveDocumentCached(
    ref,
    'credit_bill',
    branchId: _clean(branchId),
    outletId: _clean(outletId),
  );
  final sections = doc?.sections ?? const [];
  if (sections.isNotEmpty) {
    final sale = SaleResult(
      transactionId: _clean(creditNumber) ?? DateTime.now().toString(),
      createdAt: createdAt ?? DateTime.now(),
      receiptNumber: _clean(sourceReference) ?? _clean(creditNumber),
      cashierName: cashierName,
      total: amount.toDouble(),
      paymentMethod: 'credit_bill',
    );
    final data = _templateData(
      sale: sale,
      items: items,
      branchName: branchName,
      tillNumber: doc?.tillNumber,
      customerName: staffName,
      staffLabel: 'Issued by',
      publicCode: creditNumber,
      barcodeValue: creditNumber,
      extraValues: {
        'staff_name': staffName,
        'customer_name': staffName,
        'payment_method': 'CREDIT BILL',
      },
      extraKvRows: [
        MapEntry(
            'Bill Ref:', _clean(sourceReference) ?? _clean(creditNumber) ?? ''),
        if (_clean(cashierName) != null)
          MapEntry('Issued by:', cashierName!.trim()),
      ],
      staff: {
        'name': staffName,
        if (_clean(employeeId) != null) 'employee_id': employeeId!.trim(),
        if (_clean(department) != null) 'department': department!.trim(),
      },
    );
    await TemplatePrintRenderer().printThermal(sections, data);
    return;
  }

  await PrintService().printCreditBillReceipt(
    branchName: branchName,
    staffName: staffName,
    amount: amount,
    items: items,
    creditNumber: creditNumber,
    employeeId: employeeId,
    department: department,
    cashierName: cashierName,
    sourceReference: sourceReference,
    createdAt: createdAt,
  );
}

Future<void> printVoidOrderDocument(
  WidgetRef ref, {
  String? branchId,
  String? outletId,
  required String branchName,
  required String orderNumber,
  required List<CartItem> items,
  required num total,
  String? publicCode,
  String? customerName,
  String? stationName,
  String? waiterName,
  String? voidReason,
  String? printedBy,
  DateTime? voidedAt,
}) async {
  final doc = await resolveDocumentCached(
    ref,
    'void_order',
    branchId: _clean(branchId),
    outletId: _clean(outletId),
  );
  final sections = doc?.sections ?? const [];
  if (sections.isNotEmpty) {
    final sale = SaleResult(
      transactionId: orderNumber,
      createdAt: voidedAt ?? DateTime.now(),
      receiptNumber: orderNumber,
      cashierName: waiterName,
      total: total.toDouble(),
      paymentMethod: 'voided',
    );
    final data = _templateData(
      sale: sale,
      items: items,
      branchName: branchName,
      tillNumber: doc?.tillNumber,
      customerName: customerName,
      staffLabel: 'Waiter',
      publicCode: publicCode,
      barcodeValue: publicCode,
      extraValues: {
        'station_name': _clean(stationName) ?? '',
        'waiter_name': _clean(waiterName) ?? '',
        'void_reason': _clean(voidReason) ?? '',
        'voided_at': _dateString(voidedAt ?? DateTime.now()),
        'printed_by': _clean(printedBy) ?? '',
        'payment_method': 'VOIDED',
      },
      extraKvRows: [
        MapEntry('Voided:', _dateString(voidedAt ?? DateTime.now())),
        if (_clean(stationName) != null)
          MapEntry('Station:', stationName!.trim()),
        if (_clean(waiterName) != null) MapEntry('Waiter:', waiterName!.trim()),
        if (_clean(printedBy) != null)
          MapEntry('Printed by:', printedBy!.trim()),
      ],
    );
    await TemplatePrintRenderer().printThermal(sections, data);
    return;
  }

  await PrintService().printVoidOrderReceipt(
    branchName: branchName,
    orderNumber: orderNumber,
    items: items,
    total: total,
    publicCode: publicCode,
    customerName: customerName,
    stationName: stationName,
    waiterName: waiterName,
    voidReason: voidReason,
    printedBy: printedBy,
    voidedAt: voidedAt,
  );
}

TemplatePrintData _templateData({
  required SaleResult sale,
  required List<CartItem> items,
  required String branchName,
  String companyName = 'FamousGate Hotels',
  String? tillNumber,
  String? tableNumber,
  String? roomNumber,
  String? customerName,
  String? staffLabel,
  String? publicCode,
  String? barcodeValue,
  num? amountTendered,
  num? changeGiven,
  bool showVat = true,
  String? noticeText,
  String? duplicateLabel,
  Map<String, String> extraValues = const {},
  List<MapEntry<String, String>> extraKvRows = const [],
  Map<String, String> staff = const {},
}) {
  final money = NumberFormat('#,##0.00', 'en_KE');
  final date = _dateString(sale.createdAt);
  final total = sale.total;

  // Price is all-inclusive of VAT 16%, Catering Levy (CL) 2% and Service
  // Charge (SC) 3% — these are disclosed as a breakdown of the unchanged
  // total, never added on top of or subtracted from it.
  const vatRate = 0.16, clRate = 0.02, scRate = 0.03;
  final base = total > 0 ? total / (1 + vatRate + clRate + scRate) : 0;
  final vatAmount = base * vatRate;
  final cateringLevy = base * clRate;
  final serviceCharge = base * scRate;
  // When VAT isn't itemized (customer bill), fold it back into the subtotal
  // line so SUBTOTAL + CL + SC + TOTAL still reconciles exactly.
  final subtotal = showVat ? base : base + vatAmount;
  final tax = vatAmount;
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
  final tendered = amountTendered ?? 0;
  final change = changeGiven ?? 0;
  final drawerCash = tendered > 0 ? tendered - change : 0;

  return TemplatePrintData(
    values: {
      'company_name': companyName,
      'branch_name': branchName,
      'company_address': 'Bomet, Kenya',
      'company_phone': '+254 706 782 828',
      'company_email': 'famousgateshotelsbmt@gmail.com',
      'till_number': _clean(tillNumber) ?? '',
      'receipt_number': receiptNumber,
      'public_code': code ?? '',
      'verification_code': code ?? '',
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
      'amount_tendered': tendered > 0 ? 'KES ${money.format(tendered)}' : '',
      'change_given': change > 0 ? 'KES ${money.format(change)}' : '',
      'drawer_cash': drawerCash > 0 ? 'KES ${money.format(drawerCash)}' : '',
      ...extraValues,
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
      if (code != null) MapEntry('Bill code:', code),
      MapEntry(
        duplicateLabel != null && duplicateLabel.trim().isNotEmpty
            ? 'Date:'
            : 'Printed:',
        date,
      ),
      if (resolvedTable != null && resolvedTable.trim().isNotEmpty)
        MapEntry('Table:', resolvedTable),
      if (resolvedRoom != null && resolvedRoom.trim().isNotEmpty)
        MapEntry('Room:', resolvedRoom),
      if (resolvedCustomer != null &&
          resolvedCustomer.trim().isNotEmpty &&
          resolvedCustomer.trim().toLowerCase() != 'walk-in')
        MapEntry('Customer:', resolvedCustomer),
      if (resolvedStaffName != null)
        MapEntry('$resolvedStaffLabel:', resolvedStaffName),
      if (tendered > 0)
        MapEntry('Cash tendered:', 'KES ${money.format(tendered)}'),
      if (change > 0) MapEntry('Change given:', 'KES ${money.format(change)}'),
      if (drawerCash > 0)
        MapEntry('Drawer cash in:', 'KES ${money.format(drawerCash)}'),
      ...extraKvRows.where((row) => row.value.trim().isNotEmpty),
    ],
    staff: staff,
    barcodeValue: _clean(barcodeValue) ?? code ?? receiptNumber,
    code: code,
    showVat: showVat,
    cateringLevy: cateringLevy,
    serviceCharge: serviceCharge,
    noticeText: noticeText,
    duplicateLabel: _clean(duplicateLabel),
  );
}

class _CustomerDocumentBranding {
  const _CustomerDocumentBranding({
    required this.companyName,
    required this.branchName,
  });

  final String companyName;
  final String branchName;
}

_CustomerDocumentBranding _customerDocumentBranding({
  required String? branchId,
  required String branchName,
}) {
  final normalizedBranchId = _clean(branchId);
  final normalizedBranchName = branchName.trim().toLowerCase();
  final isSotik = normalizedBranchId == '4' ||
      normalizedBranchName == 'sotik' ||
      normalizedBranchName.contains('sotik ');

  if (isSotik) {
    return const _CustomerDocumentBranding(
      companyName: 'KLUB DIAMOND',
      branchName: '',
    );
  }

  return _CustomerDocumentBranding(
    companyName: 'FamousGate Hotels',
    branchName: branchName,
  );
}

// Africa/Nairobi is a fixed UTC+3 offset with no DST, so receipts always
// show Kenyan time regardless of the printing device's own timezone/clock.
DateTime _toKenyaTime(DateTime value) =>
    value.toUtc().add(const Duration(hours: 3));

String _dateString(DateTime value) =>
    DateFormat('MM/dd/yyyy, hh:mm:ss a').format(_toKenyaTime(value));

String? _clean(String? value) {
  final text = value?.trim() ?? '';
  if (text.isEmpty || text.toLowerCase() == 'null') return null;
  return text;
}
