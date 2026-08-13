import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

/// Fixed company details for the Famous Gates branch invoice letterhead.
const String kFgCompanyName = 'FAMOUS GATES LIMITED';
const String kFgPoBox = 'P.O. BOX 577-20200, KERICHO';
const String kFgTel = '0706782828';
const String kFgPin = 'PO51442741W';
const String kFgEmail = 'famousgatesbmt@gmail.com';
const String kFgTagline = 'YOUR ULTIMATE COMFORT';
// Bank details (invoice footer).
const String kFgBankAccName = 'FAMOUS GATES LIMITED';
const String kFgBankAccNo = '2041305757';
const String kFgBankName = 'ABSA';
const String kFgBankBranch = 'BOMET';

/// The built-in PDF fonts (WinAnsi) lack glyphs for several punctuation marks,
/// which print as a "tofu" box. Swap them for ASCII-safe equivalents.
String _safe(String? value) {
  if (value == null || value.isEmpty) return '';
  return value
      .replaceAll('•', '-')
      .replaceAll('–', '-')
      .replaceAll('—', '-')
      .replaceAll('…', '...')
      .replaceAll('‘', "'")
      .replaceAll('’', "'")
      .replaceAll('“', '"')
      .replaceAll('”', '"');
}

/// A branch invoice line item: { description, qty, unitPrice }.
double _n(dynamic v) =>
    (v is num) ? v.toDouble() : (double.tryParse('${v ?? ''}') ?? 0.0);

/// Generate + print the official Famous Gates branch invoice.
Future<void> generateBranchInvoicePdf({
  required BuildContext context,
  required String branchName,
  required String invoiceNumber,
  required String invoiceDate,
  String? dueDate,
  required String clientName,
  String? clientPhone,
  String? clientAddress,
  required List<Map<String, dynamic>> items,
  double vatRate = 0.16,
  bool applyVat = true,
  double amountPaid = 0,
  String? notes,
}) async {
  final pdf = pw.Document();
  pw.MemoryImage? logo;
  try {
    final bytes = await rootBundle.load('assets/frontend_public/fglogo.png');
    logo = pw.MemoryImage(bytes.buffer.asUint8List());
  } catch (_) {}

  final money = NumberFormat('#,##0.00', 'en_KE');

  final subtotal = items.fold<double>(0, (sum, it) {
    final qty = _n(it['qty']);
    final price = _n(it['unitPrice']);
    final amount = it['amount'] != null ? _n(it['amount']) : qty * price;
    return sum + amount;
  });
  final vat = applyVat ? subtotal * vatRate : 0.0;
  final total = subtotal + vat;
  final balance = (total - amountPaid).clamp(0.0, double.infinity);

  const navy = PdfColor.fromInt(0xFF0D2C54);
  const grey = PdfColors.grey700;

  pdf.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.fromLTRB(36, 30, 36, 28),
      build: (ctx) => [
        // ── Letterhead ─────────────────────────────────────────────────────
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            if (logo != null)
              pw.Padding(
                padding: const pw.EdgeInsets.only(right: 14),
                child: pw.Image(logo, width: 74, height: 74),
              ),
            pw.Expanded(
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(kFgCompanyName,
                      style: pw.TextStyle(
                          fontWeight: pw.FontWeight.bold,
                          fontSize: 17,
                          color: navy)),
                  if (_safe(branchName).isNotEmpty)
                    pw.Text(_safe(branchName).toUpperCase(),
                        style: pw.TextStyle(
                            fontSize: 11,
                            fontWeight: pw.FontWeight.bold,
                            color: grey)),
                  pw.SizedBox(height: 2),
                  pw.Text(kFgPoBox,
                      style: const pw.TextStyle(fontSize: 9, color: grey)),
                  pw.Text('Tel: $kFgTel   |   PIN No: $kFgPin',
                      style: const pw.TextStyle(fontSize: 9, color: grey)),
                  pw.Text('Email: $kFgEmail',
                      style: const pw.TextStyle(fontSize: 9, color: grey)),
                ],
              ),
            ),
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.end,
              children: [
                pw.Text('INVOICE',
                    style: pw.TextStyle(
                        fontSize: 24,
                        fontWeight: pw.FontWeight.bold,
                        color: navy)),
                pw.SizedBox(height: 6),
                pw.Text('Invoice No: ${_safe(invoiceNumber)}',
                    style: pw.TextStyle(
                        fontSize: 10, fontWeight: pw.FontWeight.bold)),
                pw.Text('Date: ${_safe(invoiceDate)}',
                    style: const pw.TextStyle(fontSize: 9)),
                if (_safe(dueDate).isNotEmpty)
                  pw.Text('Due Date: ${_safe(dueDate)}',
                      style: const pw.TextStyle(fontSize: 9)),
              ],
            ),
          ],
        ),
        pw.SizedBox(height: 10),
        pw.Container(height: 2.5, color: navy),
        pw.SizedBox(height: 12),

        // ── Bill To ────────────────────────────────────────────────────────
        pw.Text('BILL TO:',
            style: pw.TextStyle(
                fontWeight: pw.FontWeight.bold, fontSize: 10, color: navy)),
        pw.SizedBox(height: 3),
        pw.Text(_safe(clientName),
            style:
                pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 12)),
        if (_safe(clientPhone).isNotEmpty)
          pw.Text(_safe(clientPhone), style: const pw.TextStyle(fontSize: 9)),
        if (_safe(clientAddress).isNotEmpty)
          pw.Text(_safe(clientAddress),
              style: const pw.TextStyle(fontSize: 9)),
        pw.SizedBox(height: 14),

        // ── Items table ────────────────────────────────────────────────────
        pw.Table(
          border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.5),
          columnWidths: {
            0: const pw.FlexColumnWidth(5),
            1: const pw.FlexColumnWidth(1.2),
            2: const pw.FlexColumnWidth(2),
            3: const pw.FlexColumnWidth(2),
          },
          children: [
            pw.TableRow(
              decoration: const pw.BoxDecoration(color: navy),
              children: [
                _cell('Description', header: true),
                _cell('Qty', header: true, align: pw.TextAlign.center),
                _cell('Unit Price (Ksh)',
                    header: true, align: pw.TextAlign.right),
                _cell('Amount (Ksh)', header: true, align: pw.TextAlign.right),
              ],
            ),
            ...items.asMap().entries.map((e) {
              final it = e.value;
              final qty = _n(it['qty']);
              final price = _n(it['unitPrice']);
              final amount =
                  it['amount'] != null ? _n(it['amount']) : qty * price;
              return pw.TableRow(
                decoration: pw.BoxDecoration(
                    color: e.key.isOdd ? PdfColors.grey100 : PdfColors.white),
                children: [
                  _cell(_safe('${it['description'] ?? 'Item'}')),
                  _cell(qty.toStringAsFixed(qty.truncateToDouble() == qty ? 0 : 2),
                      align: pw.TextAlign.center),
                  _cell(money.format(price), align: pw.TextAlign.right),
                  _cell(money.format(amount),
                      align: pw.TextAlign.right, bold: true),
                ],
              );
            }),
          ],
        ),
        pw.SizedBox(height: 12),

        // ── Totals ─────────────────────────────────────────────────────────
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.end,
          children: [
            pw.SizedBox(
              width: 240,
              child: pw.Column(
                children: [
                  _summary('Subtotal:', 'Ksh ${money.format(subtotal)}'),
                  if (applyVat)
                    _summary(
                        'VAT (${(vatRate * 100).toStringAsFixed(0)}%):',
                        'Ksh ${money.format(vat)}'),
                  pw.Divider(color: PdfColors.grey400, thickness: 0.5),
                  _summary('TOTAL:', 'Ksh ${money.format(total)}',
                      bold: true, fontSize: 12, color: navy),
                  if (amountPaid > 0) ...[
                    _summary('Amount Paid:', 'Ksh ${money.format(amountPaid)}',
                        color: PdfColors.green800),
                    _summary('Balance Due:', 'Ksh ${money.format(balance)}',
                        bold: true,
                        color:
                            balance > 0 ? PdfColors.red800 : PdfColors.green800),
                  ],
                ],
              ),
            ),
          ],
        ),

        if (_safe(notes).isNotEmpty) ...[
          pw.SizedBox(height: 14),
          pw.Text('Notes / Terms:',
              style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
          pw.SizedBox(height: 2),
          pw.Text(_safe(notes),
              style: const pw.TextStyle(fontSize: 8, color: grey)),
        ],

        pw.SizedBox(height: 22),

        // ── Bank details + tagline ─────────────────────────────────────────
        pw.Container(
          padding: const pw.EdgeInsets.all(10),
          decoration: pw.BoxDecoration(
            color: PdfColors.grey100,
            border: pw.Border.all(color: PdfColors.grey400, width: 0.5),
          ),
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text('BANK DETAILS',
                  style: pw.TextStyle(
                      fontWeight: pw.FontWeight.bold,
                      fontSize: 10,
                      color: navy)),
              pw.SizedBox(height: 4),
              pw.Row(children: [
                pw.Expanded(
                    child: _bank('A/C NAME', kFgBankAccName)),
                pw.Expanded(child: _bank('A/C NO', kFgBankAccNo)),
              ]),
              pw.SizedBox(height: 2),
              pw.Row(children: [
                pw.Expanded(child: _bank('BANK', kFgBankName)),
                pw.Expanded(child: _bank('BRANCH', kFgBankBranch)),
              ]),
            ],
          ),
        ),
        pw.SizedBox(height: 12),
        pw.Center(
          child: pw.Text(kFgTagline,
              style: pw.TextStyle(
                  fontSize: 12,
                  fontWeight: pw.FontWeight.bold,
                  color: navy,
                  letterSpacing: 1.5)),
        ),
      ],
    ),
  );

  await Printing.layoutPdf(
    onLayout: (format) async => pdf.save(),
    name: 'Invoice_${invoiceNumber.replaceAll('/', '_')}.pdf',
  );
}

pw.Widget _cell(String text,
    {bool header = false,
    bool bold = false,
    pw.TextAlign align = pw.TextAlign.left}) {
  return pw.Padding(
    padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 5),
    child: pw.Text(text,
        textAlign: align,
        style: pw.TextStyle(
          fontSize: header ? 9 : 9,
          fontWeight:
              header || bold ? pw.FontWeight.bold : pw.FontWeight.normal,
          color: header ? PdfColors.white : PdfColors.black,
        )),
  );
}

pw.Widget _summary(String label, String value,
    {bool bold = false, double fontSize = 9, PdfColor? color}) {
  return pw.Padding(
    padding: const pw.EdgeInsets.symmetric(vertical: 2),
    child: pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      children: [
        pw.Text(label,
            style: pw.TextStyle(
                fontSize: fontSize,
                fontWeight:
                    bold ? pw.FontWeight.bold : pw.FontWeight.normal)),
        pw.Text(value,
            style: pw.TextStyle(
                fontSize: fontSize,
                fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal,
                color: color ?? PdfColors.black)),
      ],
    ),
  );
}

pw.Widget _bank(String label, String value) {
  return pw.RichText(
    text: pw.TextSpan(children: [
      pw.TextSpan(
          text: '$label: ',
          style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700)),
      pw.TextSpan(
          text: value,
          style:
              pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
    ]),
  );
}
