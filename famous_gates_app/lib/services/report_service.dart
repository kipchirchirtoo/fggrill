import 'package:flutter/services.dart' show rootBundle;
import 'package:printing/printing.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';

class ReportService {
  final money = NumberFormat('#,##0.00', 'en_KE');
  final numFormat = NumberFormat('#,##0', 'en_KE');

  Future<void> generateAndPrint({
    required String title,
    required String subtitle,
    required List<ReportSection> sections,
    String? dateRange,
    String? branch,
  }) async {
    final doc = pw.Document();

    pw.MemoryImage? logoImage;
    try {
      final logoBytes =
          await rootBundle.load('assets/frontend_public/fglogo.png');
      logoImage = pw.MemoryImage(logoBytes.buffer.asUint8List());
    } catch (_) {}

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.symmetric(horizontal: 48, vertical: 36),
        build: (ctx) => [
          _buildHeader(title, subtitle, dateRange, branch, logoImage),
          ...sections.expand((s) => [
                if (s.title != null) _buildSectionHeader(s.title!),
                if (s.description != null)
                  pw.Padding(
                    padding: const pw.EdgeInsets.only(bottom: 12),
                    child: pw.Text(s.description!,
                        style: const pw.TextStyle(
                            fontSize: 10, color: PdfColors.grey700)),
                  ),
                if (s.tableHeaders != null && s.tableRows != null)
                  _buildTable(s.tableHeaders!, s.tableRows!, s.columnWidths),
                if (s.totalLabel != null)
                  pw.Padding(
                    padding: const pw.EdgeInsets.only(top: 6, bottom: 16),
                    child: pw.Row(
                      mainAxisAlignment: pw.MainAxisAlignment.end,
                      children: [
                        pw.Text('${s.totalLabel}:  ',
                            style: pw.TextStyle(
                                fontWeight: pw.FontWeight.bold, fontSize: 11)),
                        pw.Text(s.totalValue ?? '',
                            style: pw.TextStyle(
                                fontWeight: pw.FontWeight.bold, fontSize: 11)),
                      ],
                    ),
                  )
                else
                  pw.SizedBox(height: 12),
              ]),
        ],
        footer: (ctx) => _buildFooter(ctx),
      ),
    );

    await Printing.layoutPdf(
        onLayout: (PdfPageFormat format) async => doc.save());
  }

  pw.Widget _buildHeader(
    String title,
    String subtitle,
    String? dateRange,
    String? branch,
    pw.MemoryImage? logo,
  ) {
    return pw.Column(children: [
      pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          if (logo != null)
            pw.Image(logo, width: 72, height: 50)
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
                pw.Text(
                    'Tel: +254 706 782 828 | Email: info@famousgatehotels.com | Web: www.famousgatehotels.com',
                    style: const pw.TextStyle(
                        fontSize: 9, color: PdfColors.grey600)),
              ],
            ),
          ),
        ],
      ),
      pw.SizedBox(height: 12),
      pw.Container(
        width: double.infinity,
        padding: const pw.EdgeInsets.all(12),
        decoration: const pw.BoxDecoration(
          color: PdfColors.grey200,
          borderRadius: pw.BorderRadius.all(pw.Radius.circular(4)),
        ),
        child: pw.Column(children: [
          pw.Text(title,
              style:
                  pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 18)),
          pw.SizedBox(height: 4),
          pw.Text(subtitle,
              style:
                  const pw.TextStyle(fontSize: 11, color: PdfColors.grey700)),
          if (dateRange != null || branch != null) pw.SizedBox(height: 4),
          if (dateRange != null)
            pw.Text('Period: $dateRange',
                style:
                    const pw.TextStyle(fontSize: 10, color: PdfColors.grey600)),
          if (branch != null)
            pw.Text('Branch: $branch',
                style:
                    const pw.TextStyle(fontSize: 10, color: PdfColors.grey600)),
        ]),
      ),
      pw.SizedBox(height: 16),
    ]);
  }

  pw.Widget _buildSectionHeader(String title) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 8),
      child: pw.Text(title,
          style: pw.TextStyle(
              fontWeight: pw.FontWeight.bold,
              fontSize: 13,
              color: PdfColors.grey800)),
    );
  }

  pw.Widget _buildTable(
    List<String> headers,
    List<List<String>> rows,
    List<double>? columnWidths,
  ) {
    final headerRow = headers
        .map((h) => pw.Text(h,
            style: pw.TextStyle(
                fontWeight: pw.FontWeight.bold,
                fontSize: 9,
                color: PdfColors.black)))
        .toList();

    final dataRows = rows
        .map((row) => row
            .map(
                (cell) => pw.Text(cell, style: const pw.TextStyle(fontSize: 9)))
            .toList())
        .toList();

    return pw.Table(
      border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.5),
      columnWidths: columnWidths != null
          ? {
              for (var i = 0; i < columnWidths.length; i++)
                i: pw.FixedColumnWidth(columnWidths[i])
            }
          : null,
      children: [
        pw.TableRow(
          decoration: const pw.BoxDecoration(color: PdfColors.grey300),
          children: headerRow,
        ),
        ...dataRows.asMap().entries.map((entry) {
          final index = entry.key;
          final row = entry.value;
          return pw.TableRow(
            decoration: pw.BoxDecoration(
              color: index.isOdd ? PdfColors.grey100 : PdfColors.white,
            ),
            children: row,
          );
        }),
      ],
    );
  }

  pw.Widget _buildFooter(pw.Context ctx) {
    return pw.Container(
      margin: const pw.EdgeInsets.only(top: 12),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(
              'FamousGate Hotels | Confidential | Generated: ${DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now())}',
              style: const pw.TextStyle(fontSize: 7, color: PdfColors.grey600)),
          pw.Text('Page ${ctx.pageNumber}',
              style: const pw.TextStyle(fontSize: 7, color: PdfColors.grey600)),
        ],
      ),
    );
  }
}

class ReportSection {
  final String? title;
  final String? description;
  final List<String>? tableHeaders;
  final List<List<String>>? tableRows;
  final List<double>? columnWidths;
  final String? totalLabel;
  final String? totalValue;

  const ReportSection({
    this.title,
    this.description,
    this.tableHeaders,
    this.tableRows,
    this.columnWidths,
    this.totalLabel,
    this.totalValue,
  });
}
