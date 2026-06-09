import 'package:flutter/services.dart' show rootBundle;
import 'package:printing/printing.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';
import '../domain/template_models.dart';

/// Data context supplied to a template at print time. Placeholders in section
/// text are substituted from [values]; structural sections (items, totals,
/// code box, barcode, staff box) use the typed fields.
class TemplatePrintData {
  TemplatePrintData({
    required this.values,
    this.items = const [],
    this.subtotal = 0,
    this.tax = 0,
    this.total = 0,
    this.kvRows = const [],
    this.staff = const {},
    this.barcodeValue,
    this.code,
  });

  final Map<String, String> values; // placeholder token (without braces) → text
  final List<TemplateLineItem> items;
  final num subtotal;
  final num tax;
  final num total;
  final List<MapEntry<String, String>> kvRows;
  final Map<String, String> staff; // name, employee_id, department
  final String? barcodeValue;
  final String? code;
}

class TemplateLineItem {
  TemplateLineItem({required this.name, required this.qty, required this.lineTotal});
  final String name;
  final int qty;
  final num lineTotal;
}

class TemplatePrintRenderer {
  final _money = NumberFormat('#,##0.00', 'en_KE');

  String _subst(String? text, Map<String, String> values) {
    if (text == null) return '';
    var out = text;
    values.forEach((k, v) {
      out = out.replaceAll('{{$k}}', v);
    });
    // Strip any leftover unfilled placeholders.
    out = out.replaceAll(RegExp(r'\{\{[a-z_]+\}\}'), '');
    return out.trim();
  }

  pw.TextAlign _ta(String align) {
    switch (align) {
      case 'center':
        return pw.TextAlign.center;
      case 'right':
        return pw.TextAlign.right;
      default:
        return pw.TextAlign.left;
    }
  }

  Future<void> printThermal(
      List<TemplateSection> sections, TemplatePrintData data) async {
    final doc = pw.Document();

    pw.MemoryImage? logo;
    try {
      final bytes = await rootBundle.load('assets/frontend_public/fglogo.png');
      logo = pw.MemoryImage(bytes.buffer.asUint8List());
    } catch (_) {}

    const fmt = PdfPageFormat(
      80 * PdfPageFormat.mm,
      double.infinity,
      marginLeft: 5 * PdfPageFormat.mm,
      marginRight: 5 * PdfPageFormat.mm,
      marginTop: 5 * PdfPageFormat.mm,
      marginBottom: 5 * PdfPageFormat.mm,
    );

    doc.addPage(pw.Page(
      pageFormat: fmt,
      build: (context) {
        final widgets = <pw.Widget>[];
        for (final s in sections) {
          if (s.visible == false) continue;
          final w = _renderSection(s, data, logo);
          if (w != null) widgets.add(w);
        }
        return pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.stretch,
          children: widgets,
        );
      },
    ));

    await Printing.layoutPdf(onLayout: (f) async => doc.save());
  }

  pw.Widget? _renderSection(
      TemplateSection s, TemplatePrintData data, pw.MemoryImage? logo) {
    final v = data.values;
    final size = s.size ?? 8.0;
    final style = pw.TextStyle(
      fontSize: size,
      fontWeight: s.bold ? pw.FontWeight.bold : pw.FontWeight.normal,
    );

    pw.Widget pad(pw.Widget child) =>
        pw.Padding(padding: const pw.EdgeInsets.only(bottom: 3), child: child);

    switch (s.type) {
      case 'logo':
        if (logo == null) return null;
        return pad(pw.Center(
          child: pw.Image(logo,
              width: 24 * PdfPageFormat.mm, height: 24 * PdfPageFormat.mm),
        ));

      case 'header':
      case 'title':
      case 'text':
      case 'footer':
        final text = _subst(s.content, v);
        if (text.isEmpty) return null;
        return pad(pw.Container(
          width: double.infinity,
          alignment: s.align == 'center'
              ? pw.Alignment.center
              : s.align == 'right'
                  ? pw.Alignment.centerRight
                  : pw.Alignment.centerLeft,
          child: pw.Text(text, textAlign: _ta(s.align), style: style),
        ));

      case 'divider':
        return pw.Padding(
          padding: const pw.EdgeInsets.symmetric(vertical: 2),
          child: pw.Divider(height: 1, thickness: 0.5),
        );

      case 'code_box':
        final code = (data.code ?? _subst(s.content, v)).trim();
        if (code.isEmpty) return null;
        return pad(pw.Container(
          width: double.infinity,
          padding: const pw.EdgeInsets.symmetric(vertical: 4, horizontal: 6),
          decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.8)),
          child: pw.Column(children: [
            pw.Text(s.label ?? 'CODE',
                style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 7)),
            pw.SizedBox(height: 2),
            pw.Text(code.toUpperCase(),
                style:
                    pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 18)),
          ]),
        ));

      case 'kv':
        if (data.kvRows.isEmpty) return null;
        return pad(pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.stretch,
          children: data.kvRows
              .map((e) => pw.Padding(
                    padding: const pw.EdgeInsets.only(bottom: 1),
                    child: pw.Row(children: [
                      pw.Expanded(
                          child: pw.Text(e.key,
                              style: const pw.TextStyle(fontSize: 8))),
                      pw.SizedBox(width: 6),
                      pw.Text(e.value, style: const pw.TextStyle(fontSize: 8)),
                    ]),
                  ))
              .toList(),
        ));

      case 'items':
        if (data.items.isEmpty) return null;
        return pad(pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.stretch,
          children: [
            pw.Row(children: [
              pw.Expanded(
                  child: pw.Text('Description',
                      style:
                          pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8))),
              pw.Text('Price',
                  style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8)),
            ]),
            pw.SizedBox(height: 2),
            ...data.items.map((it) => pw.Padding(
                  padding: const pw.EdgeInsets.only(bottom: 1),
                  child: pw.Row(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Expanded(
                            child: pw.Text('${it.qty}x ${it.name}',
                                maxLines: 2,
                                style: const pw.TextStyle(fontSize: 8))),
                        pw.SizedBox(width: 6),
                        pw.Text('KES ${_money.format(it.lineTotal)}',
                            style: const pw.TextStyle(fontSize: 8)),
                      ]),
                )),
          ],
        ));

      case 'totals':
        return pad(pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.stretch,
          children: [
            _totalRow('SUBTOTAL', 'KES ${_money.format(data.subtotal)}', 9),
            _totalRow('TAX (16% incl.)', 'KES ${_money.format(data.tax)}', 9),
            pw.SizedBox(height: 2),
            pw.Row(children: [
              pw.Expanded(
                  child: pw.Text('TOTAL:',
                      style: pw.TextStyle(
                          fontWeight: pw.FontWeight.bold, fontSize: 11))),
              pw.SizedBox(width: 6),
              pw.Text('KES ${_money.format(data.total)}',
                  style:
                      pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11)),
            ]),
          ],
        ));

      case 'staff_box':
        final name = data.staff['name'] ?? v['staff_name'] ?? '';
        if (name.isEmpty) return null;
        return pad(pw.Container(
          width: double.infinity,
          padding: const pw.EdgeInsets.symmetric(vertical: 4, horizontal: 6),
          decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.6)),
          child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Text('STAFF',
                style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 7)),
            pw.Text(name,
                style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 12)),
            if ((data.staff['employee_id'] ?? '').isNotEmpty)
              pw.Text('Employee ID: ${data.staff['employee_id']}',
                  style: const pw.TextStyle(fontSize: 8)),
            if ((data.staff['department'] ?? '').isNotEmpty)
              pw.Text('Department: ${data.staff['department']}',
                  style: const pw.TextStyle(fontSize: 8)),
          ]),
        ));

      case 'notice':
        final text = _subst(s.content, v);
        if (text.isEmpty) return null;
        return pad(pw.Container(
          width: double.infinity,
          padding: const pw.EdgeInsets.symmetric(vertical: 5, horizontal: 6),
          decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.8)),
          child: pw.Text(text, style: const pw.TextStyle(fontSize: 8)),
        ));

      case 'barcode':
        final bc = (data.barcodeValue ?? data.code ?? '').trim();
        if (bc.isEmpty) return null;
        return pad(pw.Column(children: [
          pw.BarcodeWidget(
            data: bc.toUpperCase(),
            barcode: pw.Barcode.code128(),
            width: 60 * PdfPageFormat.mm,
            height: 28,
            drawText: false,
          ),
          pw.Text(bc.toUpperCase(), style: const pw.TextStyle(fontSize: 7)),
        ]));

      default:
        return null;
    }
  }

  pw.Widget _totalRow(String label, String value, double fontSize) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 1),
      child: pw.Row(children: [
        pw.Expanded(
            child: pw.Text(label, style: pw.TextStyle(fontSize: fontSize))),
        pw.SizedBox(width: 6),
        pw.Text(value, style: pw.TextStyle(fontSize: fontSize)),
      ]),
    );
  }
}
