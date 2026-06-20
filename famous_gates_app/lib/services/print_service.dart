import 'package:flutter/foundation.dart' show debugPrint;
import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../core/services/silent_printer.dart';
import '../features/pos/domain/models.dart';

// Africa/Nairobi is a fixed UTC+3 offset with no DST, so receipts always
// show Kenyan time regardless of the printing device's own timezone/clock.
DateTime _toKenyaTime(DateTime value) =>
    value.toUtc().add(const Duration(hours: 3));

// Main Bar / Executive Bar captain orders must say so on the ticket instead
// of the generic "KITCHEN ORDER" heading, since they're handed to that
// outlet's own cashier/bar, not the kitchen.
String _captainOrderLabel(String? outletType, {required bool isRecall}) {
  final base = switch (outletType) {
    'main_bar' => 'MAIN BAR ORDER',
    'executive_bar' => 'EXECUTIVE BAR ORDER',
    _ => 'CAPTAIN ORDER',
  };
  return isRecall ? 'RECALLED $base' : base;
}

class PrintService {
  static const double _paperWidthMm = 80;
  static const double _safeMarginMm = 2;
  static const double _barcodeWidthMm = 60;

  final String companyName = 'FamousGate Hotels';
  final String companyAddress = 'Bomet, Kenya';
  final String companyPhone = '+254 706 782 828';
  final String companyEmail = 'info@famousgatehotels.com';
  
  // Python service URL for direct printing (no dialogs!). Deliberately
  // defaults to localhost: this call is meant to hit a local print agent
  // running on the same machine as a USB/LAN-connected thermal printer,
  // which the cloud backend/python service can never reach directly.
  // Platform.environment only sees real OS environment variables, not
  // --dart-define build flags, so String.fromEnvironment is the only way
  // to make this overridable per build.
  final String pythonServiceUrl = const String.fromEnvironment(
    'PYTHON_SERVICE_LOCAL_URL',
    defaultValue: 'http://localhost:5001',
  );

  /// Print directly via Python thermal printer service (NO DIALOG!)
  Future<bool> _printViaPythonService(Map<String, dynamic> receiptData) async {
    try {
      final response = await http.post(
        Uri.parse('$pythonServiceUrl/api/receipts/printer/print'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(receiptData),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final result = json.decode(response.body);
        if (result['success'] == true) return true;
        debugPrint(
            'Python print service ($pythonServiceUrl) reported failure: ${result['error']}');
        return false;
      }
      debugPrint(
          'Python print service ($pythonServiceUrl) returned HTTP ${response.statusCode}: ${response.body}');
      return false;
    } catch (e) {
      debugPrint('Python print service ($pythonServiceUrl) unreachable: $e');
      return false;
    }
  }

  Future<void> printReceipt(
    SaleResult sale,
    List<CartItem> items,
    String branchName, {
    String receiptType = 'CUSTOMER RECEIPT',
    String? tableNumber,
    String? roomNumber,
    String? customerName,
    String? staffLabel,
    String? publicCode,
    String? barcodeValue,
    num? amountTendered,
    num? changeGiven,
    String? tillNumber,
    String? duplicateLabel,
  }) async {
    final billCode = (publicCode ?? '').trim();
    // Try Python service first (NO DIALOG!)
    try {
      final receiptData = {
        'receipt_type': receiptType,
        'receipt_number': sale.receiptNumber,
        'short_code': publicCode,
        'verification_code': billCode,
        'public_code': billCode,
        'barcode_value': barcodeValue ?? publicCode ?? sale.receiptNumber,
        'lookup_code': publicCode,
        'customer_name': customerName,
        'table_number': tableNumber,
        'room_number': roomNumber,
        'cashier_name': sale.cashierName,
        'items': items.map((item) => {
          'name': item.name,
          'quantity': item.qty,
          'unit_price': item.unitPrice,
          'total_price': item.lineTotal,
        }).toList(),
        'total_amount': sale.total,
        'subtotal': sale.total / 1.16,
        'date': DateFormat('MM/dd/yyyy, hh:mm:ss a').format(_toKenyaTime(sale.createdAt)),
        'payment_method': sale.paymentMethod,
        'till_number': tillNumber,
        'duplicate_label': duplicateLabel,
      };

      final success = await _printViaPythonService(receiptData);
      if (success) {
        debugPrint('✅ Receipt printed via Python service (no dialog)');
        return; // Success - exit early
      }
      debugPrint('⚠️ Python service print failed, falling back to Flutter PDF');
    } catch (e) {
      debugPrint('⚠️ Python service unavailable: $e, using Flutter PDF fallback');
    }

    // FALLBACK: Use Flutter PDF printing (may show dialog on some systems)
    final doc = pw.Document();
    final money = NumberFormat('#,##0.00', 'en_KE');
    final dateStr = DateFormat('MM/dd/yyyy, hh:mm:ss a').format(_toKenyaTime(sale.createdAt));

    final totalAmount = sale.total;
    final baseAmount = totalAmount > 0 ? totalAmount / 1.16 : 0;
    final taxAmount = totalAmount - baseAmount;
    final tenderedAmount = amountTendered ?? 0;
    final changeAmount = changeGiven ?? 0;
    final drawerCashIn = tenderedAmount > 0 ? tenderedAmount - changeAmount : 0;
    final isPendingPayment =
        ['pending', 'unpaid'].contains(sale.paymentMethod.trim().toLowerCase());

    pw.MemoryImage? logoImage;
    try {
      final logoBytes =
          await rootBundle.load('assets/frontend_public/fglogo.png');
      logoImage = pw.MemoryImage(logoBytes.buffer.asUint8List());
    } catch (_) {}

    // 79-80mm thermal roll with a 76mm printable area. Keep symmetrical
    // 2mm margins so the printer gets the correct roll size without clipping.
    const receiptFormat = PdfPageFormat(
      _paperWidthMm * PdfPageFormat.mm,
      double.infinity,
      marginLeft: _safeMarginMm * PdfPageFormat.mm,
      marginRight: _safeMarginMm * PdfPageFormat.mm,
      marginTop: _safeMarginMm * PdfPageFormat.mm,
      marginBottom: _safeMarginMm * PdfPageFormat.mm,
    );
    doc.addPage(
      pw.Page(
        pageFormat: receiptFormat,
        build: (pw.Context context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.center,
            children: [
              if (logoImage != null)
                pw.Padding(
                  padding: const pw.EdgeInsets.only(bottom: 4),
                  child: pw.Image(logoImage,
                      width: 24 * PdfPageFormat.mm,
                      height: 24 * PdfPageFormat.mm),
                ),
              pw.Text(companyName,
                  style: pw.TextStyle(
                      fontWeight: pw.FontWeight.bold, fontSize: 14)),
              pw.SizedBox(height: 2),
              pw.Text(companyAddress, style: const pw.TextStyle(fontSize: 8)),
              pw.Text('Tel: $companyPhone',
                  style: const pw.TextStyle(fontSize: 8)),
              pw.SizedBox(height: 4),
              pw.Text(receiptType.toUpperCase(),
                  style: pw.TextStyle(
                      fontWeight: pw.FontWeight.bold, fontSize: 11)),
              pw.SizedBox(height: 4),
              if ((duplicateLabel ?? '').trim().isNotEmpty) ...[
                pw.Container(
                  width: double.infinity,
                  padding:
                      const pw.EdgeInsets.symmetric(vertical: 5, horizontal: 6),
                  decoration: pw.BoxDecoration(
                    border: pw.Border.all(width: 1),
                    color: PdfColors.grey300,
                  ),
                  child: pw.Text(
                    duplicateLabel!.trim().toUpperCase(),
                    textAlign: pw.TextAlign.center,
                    style: pw.TextStyle(
                      fontWeight: pw.FontWeight.bold,
                      fontSize: 11,
                    ),
                  ),
                ),
                pw.SizedBox(height: 4),
              ],
              if (billCode.isNotEmpty) ...[
                pw.Container(
                  width: double.infinity,
                  padding:
                      const pw.EdgeInsets.symmetric(vertical: 4, horizontal: 6),
                  decoration: pw.BoxDecoration(
                    border: pw.Border.all(width: 0.8),
                  ),
                  child: pw.Column(
                    children: [
                      pw.Text('BILL VERIFICATION CODE',
                          style: pw.TextStyle(
                              fontWeight: pw.FontWeight.bold, fontSize: 7)),
                      pw.SizedBox(height: 2),
                      pw.Text(billCode.toUpperCase(),
                          style: pw.TextStyle(
                              fontWeight: pw.FontWeight.bold, fontSize: 18)),
                    ],
                  ),
                ),
                pw.SizedBox(height: 4),
              ],
              _dashedLine(context),
              pw.SizedBox(height: 4),
              _infoRow('Receipt #:', sale.receiptNumber ?? ''),
              if (billCode.isNotEmpty) _infoRow('Bill code:', billCode.toUpperCase()),
              _infoRow('Date:', dateStr),
              if (tableNumber != null) _infoRow('Table:', tableNumber),
              if (roomNumber != null) _infoRow('Room:', roomNumber),
              if (customerName != null) _infoRow('Customer:', customerName),
              if (sale.cashierName != null)
                _infoRow('${staffLabel ?? 'Cashier'}:', sale.cashierName!),
              pw.SizedBox(height: 4),
              _dashedLine(context),
              pw.SizedBox(height: 4),
              pw.Row(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Expanded(
                      child: pw.Text('Description',
                          style: pw.TextStyle(
                              fontWeight: pw.FontWeight.bold, fontSize: 8)),
                    ),
                    pw.Text('Price',
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 8)),
                  ]),
              pw.SizedBox(height: 2),
              ...items.map((item) {
                return pw.Padding(
                  padding: const pw.EdgeInsets.only(bottom: 1),
                  child: pw.Row(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Expanded(
                        child: pw.Text('${item.qty}x ${item.name}',
                            maxLines: 2,
                            style: const pw.TextStyle(fontSize: 8)),
                      ),
                      pw.SizedBox(width: 6),
                      pw.Flexible(
                        child: pw.Text('KES ${money.format(item.lineTotal)}',
                            textAlign: pw.TextAlign.right,
                            style: const pw.TextStyle(fontSize: 8)),
                      ),
                    ],
                  ),
                );
              }),
              pw.SizedBox(height: 4),
              _dashedLine(context),
              pw.SizedBox(height: 4),
              _totalRow('SUBTOTAL', 'KES ${money.format(baseAmount)}', 9),
              _totalRow('TAX (16% incl.)', 'KES ${money.format(taxAmount)}', 9),
              pw.SizedBox(height: 2),
              pw.Row(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Expanded(
                      child: pw.Text('TOTAL:',
                          style: pw.TextStyle(
                              fontWeight: pw.FontWeight.bold, fontSize: 11)),
                    ),
                    pw.SizedBox(width: 6),
                    pw.Flexible(
                      child: pw.Text('KES ${money.format(totalAmount)}',
                          textAlign: pw.TextAlign.right,
                          style: pw.TextStyle(
                              fontWeight: pw.FontWeight.bold, fontSize: 11)),
                    ),
                  ]),
              pw.SizedBox(height: 6),
              _infoRow('Payment:', sale.paymentMethod.toUpperCase()),
              _infoRow('Paid:',
                  'KES ${money.format(isPendingPayment ? 0 : totalAmount)}'),
              if (tenderedAmount > 0)
                _infoRow(
                    'Cash tendered:', 'KES ${money.format(tenderedAmount)}'),
              if (changeAmount > 0)
                _infoRow('Change given:', 'KES ${money.format(changeAmount)}'),
              if (drawerCashIn > 0)
                _infoRow(
                    'Drawer cash in:', 'KES ${money.format(drawerCashIn)}'),
              pw.SizedBox(height: 6),
              _dashedLine(context),
              pw.SizedBox(height: 6),
              pw.Text('THANK YOU!',
                  style: pw.TextStyle(
                      fontWeight: pw.FontWeight.bold, fontSize: 10)),
              if (tillNumber != null && tillNumber.trim().isNotEmpty)
                _tillComplianceBlock(tillNumber.trim()),
              pw.Text('Please come again',
                  style: const pw.TextStyle(fontSize: 7)),
              pw.Text(companyEmail, style: const pw.TextStyle(fontSize: 7)),
              pw.SizedBox(height: 10),
              if ((barcodeValue != null && barcodeValue.trim().isNotEmpty) ||
                  (sale.receiptNumber != null &&
                      sale.receiptNumber!.isNotEmpty))
                pw.Column(children: [
                  pw.BarcodeWidget(
                    data:
                        (barcodeValue != null && barcodeValue.trim().isNotEmpty)
                            ? barcodeValue.trim().toUpperCase()
                            : sale.receiptNumber!,
                    barcode: pw.Barcode.code128(),
                    width: _barcodeWidthMm * PdfPageFormat.mm,
                    height: 28,
                    drawText: false,
                  ),
                  pw.Text(
                      (barcodeValue != null && barcodeValue.trim().isNotEmpty)
                          ? barcodeValue.trim().toUpperCase()
                          : sale.receiptNumber!,
                      style: const pw.TextStyle(fontSize: 7)),
                ]),
              pw.SizedBox(height: 6),
              pw.Text('System managed and made by Hirall',
                  style: pw.TextStyle(
                      fontSize: 7, fontWeight: pw.FontWeight.bold)),
              pw.Text('+254 710 944 249 | admin@hirall.com',
                  style: const pw.TextStyle(fontSize: 6)),
            ],
          );
        },
      ),
    );

    // Direct print without dialog - resolves a real printer first instead
    // of an invalid blank-url placeholder (which forced the OS dialog).
    await SilentPrinter.print(
      onLayout: (PdfPageFormat format) async => doc.save(),
      format: receiptFormat,
    );
  }

  /// Print a captain order for kitchen preparation
  /// This is a simplified kitchen ticket focused on order fulfillment, not payment
  Future<void> printCaptainOrder({
    required SaleResult sale,
    required List<CartItem> items,
    required String branchName,
    required String orderNumber,
    String? shortCode,
    String? tableNumber,
    String? roomNumber,
    String? customerName,
    String? waiterName,
    String? orderType,
    bool isRecall = false,
    String? outletType,
  }) async {
    final label = _captainOrderLabel(outletType, isRecall: isRecall);
    // Try Python service first (NO DIALOG!)
    try {
      final receiptData = {
        'receipt_type': label,
        'is_captain_order': true,
        'is_recall': isRecall,
        'outlet_type': outletType,
        'order_number': orderNumber,
        'short_code': shortCode,
        'barcode_value': shortCode ?? orderNumber,
        'lookup_code': shortCode,
        'customer_name': customerName ?? 'Walk-in',
        'table_number': tableNumber,
        'room_number': roomNumber,
        'waiter_name': waiterName,
        'order_type': orderType ?? 'dine_in',
        'items': items.map((item) => {
          'name': item.name,
          'quantity': item.qty,
          'unit_price': item.unitPrice,
          'line_total': item.lineTotal,
        }).toList(),
        'total_amount': sale.total,
        'date': DateFormat('MM/dd/yyyy, hh:mm:ss a').format(_toKenyaTime(sale.createdAt)),
      };

      final success = await _printViaPythonService(receiptData);
      if (success) {
        debugPrint('✅ Captain order printed via Python service (no dialog)');
        return; // Success - exit early
      }
      debugPrint('⚠️ Python service print failed for captain order, falling back to Flutter PDF');
    } catch (e) {
      debugPrint('⚠️ Python service unavailable for captain order: $e, using Flutter PDF fallback');
    }

    // FALLBACK: Use Flutter PDF printing (may show dialog on some systems).
    // Kept deliberately bare — no logo, no boxes/borders, no barcode — this
    // is a kitchen ticket meant to be glanced at and torn off, not a bill.
    final doc = pw.Document();
    final dateStr = DateFormat('MM/dd/yyyy, hh:mm:ss a').format(_toKenyaTime(sale.createdAt));
    final code = (shortCode ?? orderNumber).trim();

    // Table/room (when set) ride along on the Type line instead of getting
    // their own row, so the order-info block stays exactly five lines.
    final typeValue = [
      if (orderType != null && orderType.trim().isNotEmpty)
        orderType.trim().toUpperCase()
      else
        'DINE IN',
      if (tableNumber != null && tableNumber.trim().isNotEmpty)
        'TABLE ${tableNumber.trim()}',
      if (roomNumber != null && roomNumber.trim().isNotEmpty)
        'ROOM ${roomNumber.trim()}',
    ].join(' - ');

    const receiptFormat = PdfPageFormat(
      _paperWidthMm * PdfPageFormat.mm,
      double.infinity,
      marginLeft: _safeMarginMm * PdfPageFormat.mm,
      marginRight: _safeMarginMm * PdfPageFormat.mm,
      marginTop: _safeMarginMm * PdfPageFormat.mm,
      marginBottom: _safeMarginMm * PdfPageFormat.mm,
    );

    doc.addPage(
      pw.Page(
        pageFormat: receiptFormat,
        build: (context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.center,
            children: [
              pw.Text(isRecall ? 'RECALLED $label' : label,
                  style: pw.TextStyle(
                      fontWeight: pw.FontWeight.bold, fontSize: 13)),
              pw.SizedBox(height: 3),
              pw.Text('ORDER CODE',
                  style: pw.TextStyle(
                      fontWeight: pw.FontWeight.bold, fontSize: 7)),
              pw.Text(code.toUpperCase(),
                  style: pw.TextStyle(
                      fontWeight: pw.FontWeight.bold, fontSize: 18)),
              pw.SizedBox(height: 3),
              _dashedLine(context),
              _infoRow('Order #:', orderNumber),
              _infoRow('Time:', dateStr),
              _infoRow('Type:', typeValue),
              if (customerName != null && customerName.trim().isNotEmpty)
                _infoRow('Customer:', customerName.trim()),
              if (waiterName != null && waiterName.trim().isNotEmpty)
                _infoRow('Waiter:', waiterName.trim()),
              _dashedLine(context),
              pw.Text(
                  isRecall ? 'RECALLED ITEMS TO PREPARE' : 'ITEMS TO PREPARE',
                  style: pw.TextStyle(
                      fontWeight: pw.FontWeight.bold, fontSize: 9)),
              pw.SizedBox(height: 3),
              ...items.map((item) {
                // Extract notes if embedded in name with [notes] format
                final namePattern = RegExp(r'^(.*?)\s*\[(.*?)\]$');
                final match = namePattern.firstMatch(item.name);
                final itemName = match?.group(1)?.trim() ?? item.name;
                final itemNotes = match?.group(2)?.trim();

                return pw.Padding(
                  padding: const pw.EdgeInsets.only(bottom: 2),
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('${item.qty}x $itemName',
                          style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold,
                            fontSize: 10,
                          )),
                      if (itemNotes != null && itemNotes.isNotEmpty)
                        pw.Text('   NOTE: $itemNotes',
                            style: const pw.TextStyle(fontSize: 8)),
                    ],
                  ),
                );
              }),
            ],
          );
        },
      ),
    );

    // Direct print without dialog - resolves a real printer first instead
    // of an invalid blank-url placeholder (which forced the OS dialog).
    await SilentPrinter.print(
      onLayout: (PdfPageFormat format) async => doc.save(),
      format: receiptFormat,
    );
  }

  /// Dedicated receipt for a STAFF CREDIT BILL. Unlike a payment receipt this
  /// records an unpaid credit owed by a named staff member, and states the
  /// settlement route: paid to the Branch Accountant OR deducted from payroll.
  Future<void> printCreditBillReceipt({
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
    final doc = pw.Document();
    final money = NumberFormat('#,##0.00', 'en_KE');
    final dateStr = DateFormat('MM/dd/yyyy, hh:mm:ss a')
        .format(_toKenyaTime(createdAt ?? DateTime.now()));
    final code = (creditNumber ?? '').trim();

    pw.MemoryImage? logoImage;
    try {
      final logoBytes =
          await rootBundle.load('assets/frontend_public/fglogo.png');
      logoImage = pw.MemoryImage(logoBytes.buffer.asUint8List());
    } catch (_) {}

    const receiptFormat = PdfPageFormat(
      _paperWidthMm * PdfPageFormat.mm,
      double.infinity,
      marginLeft: _safeMarginMm * PdfPageFormat.mm,
      marginRight: _safeMarginMm * PdfPageFormat.mm,
      marginTop: _safeMarginMm * PdfPageFormat.mm,
      marginBottom: _safeMarginMm * PdfPageFormat.mm,
    );

    doc.addPage(
      pw.Page(
        pageFormat: receiptFormat,
        build: (context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.center,
            children: [
              if (logoImage != null)
                pw.Padding(
                  padding: const pw.EdgeInsets.only(bottom: 4),
                  child: pw.Image(logoImage,
                      width: 24 * PdfPageFormat.mm,
                      height: 24 * PdfPageFormat.mm),
                ),
              pw.Text(companyName,
                  style: pw.TextStyle(
                      fontWeight: pw.FontWeight.bold, fontSize: 14)),
              pw.SizedBox(height: 2),
              pw.Text(branchName.isEmpty ? companyAddress : branchName,
                  style: const pw.TextStyle(fontSize: 8)),
              pw.Text('Tel: $companyPhone',
                  style: const pw.TextStyle(fontSize: 8)),
              pw.SizedBox(height: 4),
              pw.Text('STAFF CREDIT BILL',
                  style: pw.TextStyle(
                      fontWeight: pw.FontWeight.bold, fontSize: 12)),
              pw.SizedBox(height: 4),
              if (code.isNotEmpty) ...[
                pw.Container(
                  width: double.infinity,
                  padding:
                      const pw.EdgeInsets.symmetric(vertical: 4, horizontal: 6),
                  decoration:
                      pw.BoxDecoration(border: pw.Border.all(width: 0.8)),
                  child: pw.Column(children: [
                    pw.Text('CREDIT BILL CODE',
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 7)),
                    pw.SizedBox(height: 2),
                    pw.Text(code.toUpperCase(),
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 18)),
                  ]),
                ),
                pw.SizedBox(height: 4),
              ],
              _dashedLine(context),
              pw.SizedBox(height: 4),
              // Staff identity — the credit is owed by this person.
              pw.Container(
                width: double.infinity,
                padding:
                    const pw.EdgeInsets.symmetric(vertical: 4, horizontal: 6),
                decoration: pw.BoxDecoration(
                  border: pw.Border.all(width: 0.6),
                ),
                child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('STAFF',
                          style: pw.TextStyle(
                              fontWeight: pw.FontWeight.bold, fontSize: 7)),
                      pw.Text(staffName,
                          style: pw.TextStyle(
                              fontWeight: pw.FontWeight.bold, fontSize: 12)),
                      if ((employeeId ?? '').isNotEmpty)
                        pw.Text('Employee ID: $employeeId',
                            style: const pw.TextStyle(fontSize: 8)),
                      if ((department ?? '').isNotEmpty)
                        pw.Text('Department: $department',
                            style: const pw.TextStyle(fontSize: 8)),
                    ]),
              ),
              pw.SizedBox(height: 4),
              _infoRow('Date:', dateStr),
              if ((sourceReference ?? '').isNotEmpty)
                _infoRow('Bill Ref:', sourceReference!),
              if ((cashierName ?? '').isNotEmpty)
                _infoRow('Issued by:', cashierName!),
              pw.SizedBox(height: 4),
              _dashedLine(context),
              pw.SizedBox(height: 4),
              if (items.isNotEmpty) ...[
                ...items.map((item) => pw.Padding(
                      padding: const pw.EdgeInsets.only(bottom: 1),
                      child: pw.Row(
                          crossAxisAlignment: pw.CrossAxisAlignment.start,
                          children: [
                            pw.Expanded(
                              child: pw.Text('${item.qty}x ${item.name}',
                                  maxLines: 2,
                                  style: const pw.TextStyle(fontSize: 8)),
                            ),
                            pw.SizedBox(width: 6),
                            pw.Flexible(
                              child: pw.Text(
                                  'KES ${money.format(item.lineTotal)}',
                                  textAlign: pw.TextAlign.right,
                                  style: const pw.TextStyle(fontSize: 8)),
                            ),
                          ]),
                    )),
                pw.SizedBox(height: 4),
                _dashedLine(context),
                pw.SizedBox(height: 4),
              ],
              pw.Row(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Expanded(
                      child: pw.Text('CREDIT AMOUNT:',
                          style: pw.TextStyle(
                              fontWeight: pw.FontWeight.bold, fontSize: 11)),
                    ),
                    pw.SizedBox(width: 6),
                    pw.Text('KES ${money.format(amount)}',
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 11)),
                  ]),
              pw.SizedBox(height: 6),
              // Settlement notice — the credit-bill flow.
              pw.Container(
                width: double.infinity,
                padding:
                    const pw.EdgeInsets.symmetric(vertical: 5, horizontal: 6),
                decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.8)),
                child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('** UNPAID CREDIT - NOT A PAYMENT **',
                          style: pw.TextStyle(
                              fontWeight: pw.FontWeight.bold, fontSize: 8)),
                      pw.SizedBox(height: 2),
                      pw.Text(
                          'Settle with the Branch Accountant (cash/M-Pesa) '
                          'OR have it deducted from your payroll.',
                          style: const pw.TextStyle(fontSize: 8)),
                    ]),
              ),
              pw.SizedBox(height: 8),
              if (code.isNotEmpty)
                pw.Column(children: [
                  pw.BarcodeWidget(
                    data: code.toUpperCase(),
                    barcode: pw.Barcode.code128(),
                    width: _barcodeWidthMm * PdfPageFormat.mm,
                    height: 28,
                    drawText: false,
                  ),
                  pw.Text(code.toUpperCase(),
                      style: const pw.TextStyle(fontSize: 7)),
                ]),
              pw.SizedBox(height: 6),
              pw.Text('System managed and made by Hirall',
                  style: pw.TextStyle(
                      fontSize: 7, fontWeight: pw.FontWeight.bold)),
              pw.Text('+254 710 944 249 | admin@hirall.com',
                  style: const pw.TextStyle(fontSize: 6)),
            ],
          );
        },
      ),
    );

    // Direct print without dialog - resolves a real printer first instead
    // of an invalid blank-url placeholder (which forced the OS dialog).
    await SilentPrinter.print(
      onLayout: (PdfPageFormat format) async => doc.save(),
      format: receiptFormat,
    );
  }

  Future<void> printVoidOrderReceipt({
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
    final doc = pw.Document();
    final money = NumberFormat('#,##0.00', 'en_KE');
    final dateStr = DateFormat('MM/dd/yyyy, hh:mm:ss a')
        .format(_toKenyaTime(voidedAt ?? DateTime.now()));

    pw.MemoryImage? logoImage;
    try {
      final logoBytes =
          await rootBundle.load('assets/frontend_public/fglogo.png');
      logoImage = pw.MemoryImage(logoBytes.buffer.asUint8List());
    } catch (_) {}

    const receiptFormat = PdfPageFormat(
      _paperWidthMm * PdfPageFormat.mm,
      double.infinity,
      marginLeft: _safeMarginMm * PdfPageFormat.mm,
      marginRight: _safeMarginMm * PdfPageFormat.mm,
      marginTop: _safeMarginMm * PdfPageFormat.mm,
      marginBottom: _safeMarginMm * PdfPageFormat.mm,
    );

    doc.addPage(
      pw.Page(
        pageFormat: receiptFormat,
        build: (context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.center,
            children: [
              if (logoImage != null)
                pw.Padding(
                  padding: const pw.EdgeInsets.only(bottom: 4),
                  child: pw.Image(logoImage,
                      width: 24 * PdfPageFormat.mm,
                      height: 24 * PdfPageFormat.mm),
                ),
              pw.Text(companyName,
                  style: pw.TextStyle(
                      fontWeight: pw.FontWeight.bold, fontSize: 14)),
              pw.SizedBox(height: 2),
              pw.Text(branchName.isEmpty ? companyAddress : branchName,
                  style: const pw.TextStyle(fontSize: 8)),
              pw.Text('Tel: $companyPhone',
                  style: const pw.TextStyle(fontSize: 8)),
              pw.SizedBox(height: 4),
              pw.Text('VOIDED CAPTAIN ORDER',
                  style: pw.TextStyle(
                      fontWeight: pw.FontWeight.bold, fontSize: 12)),
              pw.SizedBox(height: 4),
              if ((publicCode ?? '').trim().isNotEmpty) ...[
                pw.Container(
                  width: double.infinity,
                  padding:
                      const pw.EdgeInsets.symmetric(vertical: 4, horizontal: 6),
                  decoration:
                      pw.BoxDecoration(border: pw.Border.all(width: 0.8)),
                  child: pw.Column(children: [
                    pw.Text('ORDER CODE',
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 7)),
                    pw.SizedBox(height: 2),
                    pw.Text(publicCode!.trim().toUpperCase(),
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 18)),
                  ]),
                ),
                pw.SizedBox(height: 4),
              ],
              _dashedLine(context),
              pw.SizedBox(height: 4),
              _infoRow('Order #:', orderNumber),
              _infoRow('Voided:', dateStr),
              if ((stationName ?? '').trim().isNotEmpty)
                _infoRow('Station:', stationName!.trim()),
              if ((customerName ?? '').trim().isNotEmpty)
                _infoRow('Customer:', customerName!.trim()),
              if ((waiterName ?? '').trim().isNotEmpty)
                _infoRow('Waiter:', waiterName!.trim()),
              if ((printedBy ?? '').trim().isNotEmpty)
                _infoRow('Printed by:', printedBy!.trim()),
              pw.SizedBox(height: 4),
              _dashedLine(context),
              pw.SizedBox(height: 4),
              ...items.map((item) => pw.Padding(
                    padding: const pw.EdgeInsets.only(bottom: 1),
                    child: pw.Row(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Expanded(
                          child: pw.Text('${item.qty}x ${item.name}',
                              maxLines: 2,
                              style: const pw.TextStyle(fontSize: 8)),
                        ),
                        pw.SizedBox(width: 6),
                        pw.Flexible(
                          child: pw.Text('KES ${money.format(item.lineTotal)}',
                              textAlign: pw.TextAlign.right,
                              style: const pw.TextStyle(fontSize: 8)),
                        ),
                      ],
                    ),
                  )),
              pw.SizedBox(height: 4),
              _dashedLine(context),
              pw.SizedBox(height: 4),
              _totalRow('VOIDED VALUE', 'KES ${money.format(total)}', 11),
              pw.SizedBox(height: 6),
              pw.Container(
                width: double.infinity,
                padding:
                    const pw.EdgeInsets.symmetric(vertical: 5, horizontal: 6),
                decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.8)),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('NOT PAYABLE - NOT AN UNPAID BILL',
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 8)),
                    if ((voidReason ?? '').trim().isNotEmpty) ...[
                      pw.SizedBox(height: 2),
                      pw.Text('Reason: ${voidReason!.trim()}',
                          style: const pw.TextStyle(fontSize: 8)),
                    ],
                  ],
                ),
              ),
              pw.SizedBox(height: 8),
              if ((publicCode ?? '').trim().isNotEmpty)
                pw.Column(children: [
                  pw.BarcodeWidget(
                    data: publicCode!.trim().toUpperCase(),
                    barcode: pw.Barcode.code128(),
                    width: _barcodeWidthMm * PdfPageFormat.mm,
                    height: 28,
                    drawText: false,
                  ),
                  pw.Text(publicCode.trim().toUpperCase(),
                      style: const pw.TextStyle(fontSize: 7)),
                ]),
              pw.SizedBox(height: 6),
              pw.Text('System managed and made by Hirall',
                  style: pw.TextStyle(
                      fontSize: 7, fontWeight: pw.FontWeight.bold)),
              pw.Text('+254 710 944 249 | admin@hirall.com',
                  style: const pw.TextStyle(fontSize: 6)),
            ],
          );
        },
      ),
    );

    // Direct print without dialog - resolves a real printer first instead
    // of an invalid blank-url placeholder (which forced the OS dialog).
    await SilentPrinter.print(
      onLayout: (PdfPageFormat format) async => doc.save(),
      format: receiptFormat,
    );
  }

  pw.Widget _dashedLine(pw.Context context) {
    return pw.Container(
      width: double.infinity,
      child: pw.Divider(),
    );
  }

  pw.Widget _infoRow(String label, String value) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 1),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Expanded(
              child: pw.Text(label, style: const pw.TextStyle(fontSize: 8))),
          pw.SizedBox(width: 6),
          pw.Flexible(
            child: pw.Text(value,
                textAlign: pw.TextAlign.right,
                maxLines: 2,
                style: const pw.TextStyle(fontSize: 8)),
          ),
        ],
      ),
    );
  }

  pw.Widget _totalRow(String label, String value, double fontSize) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 1),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Expanded(
              child: pw.Text(label, style: pw.TextStyle(fontSize: fontSize))),
          pw.SizedBox(width: 6),
          pw.Flexible(
            child: pw.Text(value,
                textAlign: pw.TextAlign.right,
                style: pw.TextStyle(fontSize: fontSize)),
          ),
        ],
      ),
    );
  }

  pw.Widget _tillComplianceBlock(String tillNumber) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(top: 3, bottom: 4),
      child: pw.Container(
        width: double.infinity,
        padding: const pw.EdgeInsets.symmetric(vertical: 4),
        decoration: const pw.BoxDecoration(
          border: pw.Border(
            top: pw.BorderSide(width: 0.7),
            bottom: pw.BorderSide(width: 0.7),
          ),
        ),
        child: pw.Column(children: [
          pw.Text('TILL NUMBER',
              textAlign: pw.TextAlign.center,
              style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 1),
          pw.Text(tillNumber.toUpperCase(),
              textAlign: pw.TextAlign.center,
              style:
                  pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
        ]),
      ),
    );
  }
}
