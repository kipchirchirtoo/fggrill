import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

/// Official A4 Guest Invoice PDF generator for FamousGate Hotels.
Future<void> printBookingInvoicePDF({
  required BuildContext context,
  required String invoiceNumber,
  required String invoiceDate,
  required String dueDate,
  required String clientName,
  String? clientPhone,
  String? clientDetails,
  required List<Map<String, dynamic>> items,
  required double totalAmount,
  required double amountPaid,
  double? balanceDue,
  String? notes,
}) async {
  final pdf = pw.Document();
  pw.MemoryImage? logoImage;
  try {
    final logoBytes =
        await rootBundle.load('assets/frontend_public/fglogo.png');
    logoImage = pw.MemoryImage(logoBytes.buffer.asUint8List());
  } catch (_) {}

  final double grossTotal = totalAmount > 0
      ? totalAmount
      : items.fold(0.0, (sum, item) {
          final q = (item['qty'] as num?)?.toDouble() ?? 1.0;
          final p = (item['unitPrice'] as num?)?.toDouble() ?? 0.0;
          final t = (item['totalAmount'] as num?)?.toDouble() ?? (q * p);
          return sum + t;
        });

  final double vatRate = 0.16;
  final double clRate = 0.02;
  final double scRate = 0.03;
  final double combinedRate = vatRate + clRate + scRate; // 0.21

  final double netSubtotal = grossTotal / (1.0 + combinedRate);
  final double vatAmount = netSubtotal * vatRate;
  final double clAmount = netSubtotal * clRate;
  final double scAmount = netSubtotal * scRate;

  final double paid = amountPaid;
  final double balance =
      balanceDue ?? (grossTotal - paid).clamp(0.0, double.infinity);

  final numFormat = NumberFormat('#,##0.00', 'en_KE');

  pdf.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.symmetric(horizontal: 36, vertical: 28),
      build: (pw.Context ctx) {
        return [
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              if (logoImage != null)
                pw.Image(logoImage, width: 72, height: 50)
              else
                pw.Container(width: 72),
              pw.SizedBox(width: 16),
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('FamousGate Hotels',
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 16)),
                    pw.Text('Bomet, Kenya',
                        style: const pw.TextStyle(
                            fontSize: 10, color: PdfColors.grey700)),
                    pw.Text('Tel: 0706782828',
                        style: const pw.TextStyle(
                            fontSize: 9, color: PdfColors.grey600)),
                    pw.Text('Email: famousgatesbmt@gmail.com',
                        style: const pw.TextStyle(
                            fontSize: 9, color: PdfColors.grey600)),
                    pw.Text('www.famousgatehotels.com',
                        style: pw.TextStyle(
                            fontSize: 9,
                            fontWeight: pw.FontWeight.bold,
                            color: PdfColors.blue800)),
                  ],
                ),
              ),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text('INVOICE',
                      style: pw.TextStyle(
                          fontSize: 22,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColors.grey800)),
                ],
              ),
            ],
          ),
          pw.SizedBox(height: 12),
          pw.Divider(color: PdfColors.grey400, thickness: 0.5),
          pw.SizedBox(height: 10),
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('GUEST / CLIENT:',
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 10)),
                    pw.SizedBox(height: 3),
                    pw.Text(clientName,
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 11)),
                    if (clientPhone != null && clientPhone.isNotEmpty)
                      pw.Text(clientPhone,
                          style: const pw.TextStyle(fontSize: 9)),
                    if (clientDetails != null && clientDetails.isNotEmpty)
                      pw.Text(clientDetails,
                          style: const pw.TextStyle(fontSize: 9)),
                  ],
                ),
              ),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text('Invoice #: $invoiceNumber',
                      style: pw.TextStyle(
                          fontWeight: pw.FontWeight.bold, fontSize: 10)),
                  pw.SizedBox(height: 2),
                  pw.Text('Date: $invoiceDate',
                      style: const pw.TextStyle(fontSize: 9)),
                  pw.Text('Due Date: $dueDate',
                      style: const pw.TextStyle(fontSize: 9)),
                ],
              ),
            ],
          ),
          pw.SizedBox(height: 14),
          pw.Table(
            border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.5),
            children: [
              pw.TableRow(
                decoration: const pw.BoxDecoration(color: PdfColors.grey300),
                children: [
                  _pdfHeaderCell('Description'),
                  _pdfHeaderCell('Qty'),
                  _pdfHeaderCell('Unit Price (KES)'),
                  _pdfHeaderCell('VAT'),
                  _pdfHeaderCell('Total Amount'),
                ],
              ),
              ...items.asMap().entries.map((entry) {
                final idx = entry.key;
                final item = entry.value;
                final desc = item['description']?.toString() ?? 'Item';
                final qty = (item['qty'] as num?)?.toInt() ?? 1;
                final price = (item['unitPrice'] as num?)?.toDouble() ?? 0.0;
                final tot =
                    (item['totalAmount'] as num?)?.toDouble() ?? (qty * price);

                return pw.TableRow(
                  decoration: pw.BoxDecoration(
                    color: idx.isOdd ? PdfColors.grey100 : PdfColors.white,
                  ),
                  children: [
                    _pdfDataCell(desc),
                    _pdfDataCell('$qty'),
                    _pdfDataCell('Ksh ${numFormat.format(price)}'),
                    _pdfDataCell('16%'),
                    _pdfDataCell('Ksh ${numFormat.format(tot)}', isBold: true),
                  ],
                );
              }),
            ],
          ),
          pw.SizedBox(height: 14),
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.end,
            children: [
              pw.SizedBox(
                width: 250,
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    _pdfSummaryRow('Subtotal (Excl. Tax & Levies):',
                        'Ksh ${numFormat.format(netSubtotal)}'),
                    _pdfSummaryRow('VAT Amount (16.00%):',
                        'Ksh ${numFormat.format(vatAmount)}'),
                    _pdfSummaryRow('Catering Levy (CL 2.00%):',
                        'Ksh ${numFormat.format(clAmount)}'),
                    _pdfSummaryRow('Service Charge (SC 3.00%):',
                        'Ksh ${numFormat.format(scAmount)}'),
                    pw.Divider(color: PdfColors.grey400, thickness: 0.5),
                    _pdfSummaryRow('GRAND TOTAL:',
                        'Ksh ${numFormat.format(grossTotal)}',
                        isBold: true, fontSize: 11),
                    _pdfSummaryRow('Total Payment Done:',
                        'Ksh ${numFormat.format(paid)}',
                        color: PdfColors.green800),
                    _pdfSummaryRow('Balance Due:',
                        'Ksh ${numFormat.format(balance)}',
                        isBold: true,
                        color: balance > 0
                            ? PdfColors.red800
                            : PdfColors.green800),
                  ],
                ),
              ),
            ],
          ),
          pw.SizedBox(height: 14),
          if (notes != null && notes.isNotEmpty) ...[
            pw.Text('Notes / Instructions:',
                style:
                    pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
            pw.SizedBox(height: 2),
            pw.Text(notes,
                style: const pw.TextStyle(
                    fontSize: 8, color: PdfColors.grey700)),
          ],
        ];
      },
      footer: (pw.Context ctx) {
        return pw.Container(
          margin: const pw.EdgeInsets.only(top: 10),
          padding: const pw.EdgeInsets.only(top: 6),
          decoration: const pw.BoxDecoration(
            border: pw.Border(
              top: pw.BorderSide(color: PdfColors.grey300, width: 0.5),
            ),
          ),
          child: pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(
                  'FamousGate Hotels - Finance System | www.famousgatehotels.com',
                  style: const pw.TextStyle(
                      fontSize: 7, color: PdfColors.grey600)),
              pw.Text('Page ${ctx.pageNumber} of ${ctx.pagesCount}',
                  style: const pw.TextStyle(
                      fontSize: 7, color: PdfColors.grey600)),
            ],
          ),
        );
      },
    ),
  );

  await Printing.layoutPdf(
    onLayout: (PdfPageFormat format) async => pdf.save(),
    name: 'Invoice_${invoiceNumber.replaceAll('/', '_')}.pdf',
  );
}

pw.Widget pdfHeaderCell(String text, {pw.TextAlign align = pw.TextAlign.left}) {
  return pw.Padding(
    padding: const pw.EdgeInsets.all(5),
    child: pw.Text(text,
        textAlign: align,
        style: pw.TextStyle(
            fontWeight: pw.FontWeight.bold,
            fontSize: 8,
            color: PdfColors.black)),
  );
}

pw.Widget _pdfHeaderCell(String text, {pw.TextAlign align = pw.TextAlign.left}) =>
    pdfHeaderCell(text, align: align);

pw.Widget pdfDataCell(String text, {bool isBold = false}) {
  return pw.Padding(
    padding: const pw.EdgeInsets.all(5),
    child: pw.Text(text,
        style: pw.TextStyle(
            fontSize: 8,
            fontWeight: isBold ? pw.FontWeight.bold : pw.FontWeight.normal)),
  );
}

pw.Widget _pdfDataCell(String text, {bool isBold = false}) =>
    pdfDataCell(text, isBold: isBold);

pw.Widget pdfSummaryRow(String label, String value,
    {bool isBold = false, double fontSize = 9, PdfColor? color}) {
  return pw.Padding(
    padding: const pw.EdgeInsets.symmetric(vertical: 2),
    child: pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      children: [
        pw.Text(label,
            style: pw.TextStyle(
                fontSize: fontSize,
                fontWeight:
                    isBold ? pw.FontWeight.bold : pw.FontWeight.normal)),
        pw.Text(value,
            style: pw.TextStyle(
                fontSize: fontSize,
                fontWeight:
                    isBold ? pw.FontWeight.bold : pw.FontWeight.normal,
                color: color ?? PdfColors.black)),
      ],
    ),
  );
}

pw.Widget _pdfSummaryRow(String label, String value,
        {bool isBold = false, double fontSize = 9, PdfColor? color}) =>
    pdfSummaryRow(label, value,
        isBold: isBold, fontSize: fontSize, color: color);

/// Builds detailed guest-invoice line items from a folio:
///  • one Accommodation line (from the room_charges bucket / booking total), then
///  • one line per itemised Charge-to-Room POS item (outlet · item + amount),
///    taken from the folio's `items` (folio_items) when available.
/// Falls back to the food/beverage/other bucket lumps only when there is no
/// itemised detail, so the lines never double-count the POS charges.
List<Map<String, dynamic>> buildFolioInvoiceItems({
  required Map<String, dynamic> folio,
  required List<Map<String, dynamic>> folioItems,
  List<Map<String, dynamic>> chargeLines = const [],
  String? roomLabel,
  double bookingTotal = 0,
}) {
  double n(dynamic v) =>
      (v is num) ? v.toDouble() : (double.tryParse('${v ?? ''}') ?? 0.0);

  final room = n(folio['room_charges'] ?? folio['roomCharges']);
  final food = n(folio['food_charges'] ?? folio['foodCharges']);
  final bev = n(folio['beverage_charges'] ?? folio['beverageCharges']);
  final other = n(folio['other_charges'] ?? folio['otherCharges']);

  final items = <Map<String, dynamic>>[];

  final roomLine = room > 0 ? room : bookingTotal;
  if (roomLine > 0) {
    final label = (roomLabel != null && roomLabel.trim().isNotEmpty)
        ? ' (${roomLabel.trim()})'
        : '';
    items.add({
      'description': 'Accommodation$label',
      'qty': 1,
      'unitPrice': roomLine,
      'totalAmount': roomLine,
    });
  }

  // Tier 1 — per-ITEM detail (outlet · item) from folio_items (newest posts).
  final detailed = folioItems.where((it) => n(it['amount']) > 0).toList();
  // Tier 2 — per-BILL detail (outlet + bill) from folio_transactions charge
  // lines, for charges posted before per-item capture existed.
  final lines = chargeLines.where((it) => n(it['amount']) > 0).toList();

  if (detailed.isNotEmpty) {
    for (final it in detailed) {
      final amt = n(it['amount']);
      final qty = (it['quantity'] as num?)?.toInt() ?? 1;
      items.add({
        'description':
            (it['description'] ?? it['department'] ?? 'POS Charge').toString(),
        'qty': qty <= 0 ? 1 : qty,
        'unitPrice': it['unit_price'] != null
            ? n(it['unit_price'])
            : (qty > 0 ? amt / qty : amt),
        'totalAmount': amt,
      });
    }
  } else if (lines.isNotEmpty) {
    for (final it in lines) {
      final amt = n(it['amount']);
      items.add({
        'description': (it['description'] ?? 'POS Charge').toString(),
        'qty': 1,
        'unitPrice': amt,
        'totalAmount': amt,
      });
    }
  } else {
    // Tier 3 — bucket lumps (oldest folios with no line detail at all).
    final foodBev = food + bev;
    if (foodBev > 0) {
      items.add({
        'description': 'Food & Beverage (POS Charges)',
        'qty': 1,
        'unitPrice': foodBev,
        'totalAmount': foodBev,
      });
    }
    if (other > 0) {
      items.add({
        'description': 'Other Services / Incidentals',
        'qty': 1,
        'unitPrice': other,
        'totalAmount': other,
      });
    }
  }

  return items;
}
