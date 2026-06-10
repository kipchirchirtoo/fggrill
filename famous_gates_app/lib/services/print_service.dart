import 'package:flutter/services.dart' show rootBundle;
import 'package:printing/printing.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';
import '../features/pos/domain/models.dart';

class PrintService {
  final String companyName = 'FamousGate Hotels';
  final String companyAddress = 'Bomet, Kenya';
  final String companyPhone = '+254 706 782 828';
  final String companyEmail = 'info@famousgatehotels.com';

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
  }) async {
    final doc = pw.Document();
    final money = NumberFormat('#,##0.00', 'en_KE');
    final dateStr = DateFormat('MM/dd/yyyy, hh:mm:ss a').format(sale.createdAt);

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

    // 80mm thermal roll. Use generous side margins so content always sits
    // within the printer's guaranteed printable area (~72mm) — prevents the
    // right-edge character clipping seen on physical thermal printers.
    const receiptFormat = PdfPageFormat(
      80 * PdfPageFormat.mm,
      double.infinity,
      marginLeft: 5 * PdfPageFormat.mm,
      marginRight: 5 * PdfPageFormat.mm,
      marginTop: 5 * PdfPageFormat.mm,
      marginBottom: 5 * PdfPageFormat.mm,
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
              if (tillNumber != null && tillNumber.trim().isNotEmpty)
                pw.Text('Till No: ${tillNumber.trim()}',
                    style: pw.TextStyle(
                        fontWeight: pw.FontWeight.bold, fontSize: 9)),
              pw.SizedBox(height: 4),
              pw.Text(receiptType.toUpperCase(),
                  style: pw.TextStyle(
                      fontWeight: pw.FontWeight.bold, fontSize: 11)),
              pw.SizedBox(height: 4),
              if (publicCode != null && publicCode.trim().isNotEmpty) ...[
                pw.Container(
                  width: double.infinity,
                  padding:
                      const pw.EdgeInsets.symmetric(vertical: 4, horizontal: 6),
                  decoration: pw.BoxDecoration(
                    border: pw.Border.all(width: 0.8),
                  ),
                  child: pw.Column(
                    children: [
                      pw.Text('PAYMENT LOOKUP CODE',
                          style: pw.TextStyle(
                              fontWeight: pw.FontWeight.bold, fontSize: 7)),
                      pw.SizedBox(height: 2),
                      pw.Text(publicCode.trim().toUpperCase(),
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
                      pw.Text('KES ${money.format(item.lineTotal)}',
                          style: const pw.TextStyle(fontSize: 8)),
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
                    pw.Text('KES ${money.format(totalAmount)}',
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 11)),
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
                    // Keep within the ~70mm usable width of an 80mm roll
                    width: 60 * PdfPageFormat.mm,
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

    await Printing.layoutPdf(
        onLayout: (PdfPageFormat format) async => doc.save());
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
        .format(createdAt ?? DateTime.now());
    final code = (creditNumber ?? '').trim();

    pw.MemoryImage? logoImage;
    try {
      final logoBytes =
          await rootBundle.load('assets/frontend_public/fglogo.png');
      logoImage = pw.MemoryImage(logoBytes.buffer.asUint8List());
    } catch (_) {}

    const receiptFormat = PdfPageFormat(
      80 * PdfPageFormat.mm,
      double.infinity,
      marginLeft: 5 * PdfPageFormat.mm,
      marginRight: 5 * PdfPageFormat.mm,
      marginTop: 5 * PdfPageFormat.mm,
      marginBottom: 5 * PdfPageFormat.mm,
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
                            pw.Text('KES ${money.format(item.lineTotal)}',
                                style: const pw.TextStyle(fontSize: 8)),
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
                    width: 60 * PdfPageFormat.mm,
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

    await Printing.layoutPdf(
        onLayout: (PdfPageFormat format) async => doc.save());
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
    final dateStr =
        DateFormat('MM/dd/yyyy, hh:mm:ss a').format(voidedAt ?? DateTime.now());

    pw.MemoryImage? logoImage;
    try {
      final logoBytes =
          await rootBundle.load('assets/frontend_public/fglogo.png');
      logoImage = pw.MemoryImage(logoBytes.buffer.asUint8List());
    } catch (_) {}

    const receiptFormat = PdfPageFormat(
      80 * PdfPageFormat.mm,
      double.infinity,
      marginLeft: 5 * PdfPageFormat.mm,
      marginRight: 5 * PdfPageFormat.mm,
      marginTop: 5 * PdfPageFormat.mm,
      marginBottom: 5 * PdfPageFormat.mm,
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
                        pw.Text('KES ${money.format(item.lineTotal)}',
                            style: const pw.TextStyle(fontSize: 8)),
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
                    width: 60 * PdfPageFormat.mm,
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

    await Printing.layoutPdf(
        onLayout: (PdfPageFormat format) async => doc.save());
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
          pw.Text(value, style: const pw.TextStyle(fontSize: 8)),
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
          pw.Text(value, style: pw.TextStyle(fontSize: fontSize)),
        ],
      ),
    );
  }
}
