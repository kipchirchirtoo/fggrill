import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';
import '../../../core/services/silent_printer.dart';
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
    this.showVat = true,
    this.cateringLevy = 0,
    this.serviceCharge = 0,
    this.noticeText,
    this.duplicateLabel,
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
  // Controls the whole SUBTOTAL/VAT/CL/SC breakdown block on the 'totals'
  // section. False on the customer bill (shows only TOTAL); true on the
  // customer receipt (shows the full inclusive breakdown).
  final bool showVat;
  final num cateringLevy; // CL 2% — all-inclusive, does not change the total
  final num serviceCharge; // SC 3% — all-inclusive, does not change the total
  final String? noticeText; // auto-injected notice (e.g. "collect ETR receipt")
  final String? duplicateLabel;
}

class TemplateLineItem {
  TemplateLineItem(
      {required this.name, required this.qty, required this.lineTotal});
  final String name;
  final int qty;
  final num lineTotal;
}

class TemplatePrintRenderer {
  static const double _paperWidthMm = 80;
  static const double _safeMarginMm = 2;
  static const double _barcodeWidthMm = 60;
  static const double _priceColumnMm = 29;

  final _money = NumberFormat('#,##0.00', 'en_KE');

  // The receipt logo never changes at runtime — decode it once and reuse the
  // same MemoryImage for every print instead of re-reading the asset each time.
  static pw.MemoryImage? _cachedLogo;
  static bool _logoResolved = false;

  static Future<pw.MemoryImage?> _resolveLogo() async {
    if (_logoResolved) return _cachedLogo;
    try {
      final bytes = await rootBundle.load('assets/frontend_public/fglogo.png');
      _cachedLogo = pw.MemoryImage(bytes.buffer.asUint8List());
    } catch (_) {
      _cachedLogo = null;
    }
    _logoResolved = true;
    return _cachedLogo;
  }

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

    final logo = await _resolveLogo();

    const fmt = PdfPageFormat(
      _paperWidthMm * PdfPageFormat.mm,
      double.infinity,
      marginLeft: _safeMarginMm * PdfPageFormat.mm,
      marginRight: _safeMarginMm * PdfPageFormat.mm,
      marginTop: _safeMarginMm * PdfPageFormat.mm,
      marginBottom: _safeMarginMm * PdfPageFormat.mm,
    );

    doc.addPage(pw.Page(
      pageFormat: fmt,
      build: (context) {
        final widgets = <pw.Widget>[];
        for (final s in _thermalOrder(sections, data)) {
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

    await SilentPrinter.print(
      onLayout: (f) async => doc.save(),
      format: fmt,
    );
  }

  List<TemplateSection> _thermalOrder(
      List<TemplateSection> sections, TemplatePrintData data) {
    TemplateSection? till;
    final ordered = <TemplateSection>[];
    final hasPhone = sections.any((s) =>
        s.visible != false &&
        ((s.content ?? '').contains('{{company_phone}}') ||
            (s.content ?? '').toLowerCase().contains('tel:')));
    final hasEmail = sections.any((s) =>
        s.visible != false &&
        ((s.content ?? '').contains('{{company_email}}') ||
            (s.content ?? '').toLowerCase().contains('email:')));
    final shouldInjectPhone =
        !hasPhone && (data.values['company_phone'] ?? '').isNotEmpty;
    final shouldInjectEmailAfterPhone = hasPhone &&
        !hasEmail &&
        (data.values['company_email'] ?? '').isNotEmpty;
    final shouldInjectFullContact = shouldInjectPhone &&
        !hasEmail &&
        (data.values['company_email'] ?? '').isNotEmpty;
    var contactInjected = false;

    for (final section in sections) {
      if (_isTillSection(section)) {
        if (section.visible && till == null) till = section;
        continue;
      }
      ordered.add(section);
      if (!contactInjected &&
          shouldInjectFullContact &&
          _isHeaderAnchorSection(section)) {
        ordered.add(_autoPhoneSection());
        ordered.add(_autoEmailSection());
        contactInjected = true;
      } else if (!contactInjected &&
          shouldInjectPhone &&
          _isHeaderAnchorSection(section)) {
        ordered.add(_autoPhoneSection());
        contactInjected = true;
      } else if (!contactInjected &&
          shouldInjectEmailAfterPhone &&
          _isPhoneSection(section)) {
        ordered.add(_autoEmailSection());
        contactInjected = true;
      }
    }

    if (shouldInjectPhone && !ordered.any(_isPhoneSection)) {
      ordered.insert(0, _autoPhoneSection());
      if (!hasEmail && (data.values['company_email'] ?? '').isNotEmpty) {
        ordered.insert(1, _autoEmailSection());
      }
    } else if (shouldInjectEmailAfterPhone &&
        !ordered.any((s) => (s.content ?? '').contains('{{company_email}}'))) {
      final phoneIndex = ordered.indexWhere(_isPhoneSection);
      if (phoneIndex >= 0) {
        ordered.insert(phoneIndex + 1, _autoEmailSection());
      } else {
        ordered.add(_autoEmailSection());
      }
    }

    final codeBox = _autoCodeBoxSection(data, ordered);
    if (codeBox != null) {
      final insertAfter = ordered.indexWhere((s) =>
          s.visible != false &&
          (s.type == 'title' ||
              s.id == 'title' ||
              (s.content ?? '').contains('{{receipt_number}}')));
      ordered.insert(insertAfter >= 0 ? insertAfter + 1 : 0, codeBox);
    }

    final duplicateBadge = _duplicateBadgeSection(data, ordered);
    if (duplicateBadge != null) {
      final insertAfter = ordered.indexWhere((s) =>
          s.visible != false &&
          (s.type == 'title' ||
              s.id == 'title' ||
              s.type == 'code_box' ||
              (s.content ?? '').contains('{{receipt_number}}')));
      ordered.insert(insertAfter >= 0 ? insertAfter + 1 : 0, duplicateBadge);
    }

    final etrNotice = _etrNoticeSection(data, ordered);

    if (till == null && etrNotice == null) return ordered;

    final result = <TemplateSection>[];
    var inserted = false;
    for (final section in ordered) {
      result.add(section);
      if (!inserted && _isThankYouSection(section)) {
        if (etrNotice != null) result.add(etrNotice);
        if (till != null) result.add(_tillComplianceSection(till));
        inserted = true;
      }
    }

    if (!inserted) {
      if (etrNotice != null) result.add(etrNotice);
      if (till != null) result.add(_tillComplianceSection(till));
    }
    return result;
  }

  TemplateSection? _etrNoticeSection(
      TemplatePrintData data, List<TemplateSection> ordered) {
    final text = (data.noticeText ?? '').trim();
    if (text.isEmpty) return null;
    final alreadyPresent =
        ordered.any((s) => (s.content ?? '').toLowerCase().contains('etr'));
    if (alreadyPresent) return null;
    return TemplateSection(
      id: 'collect_receipt_notice',
      type: 'notice',
      content: text,
      visible: true,
    );
  }

  TemplateSection? _autoCodeBoxSection(
      TemplatePrintData data, List<TemplateSection> ordered) {
    final code = (data.code ?? '').trim();
    if (code.isEmpty) return null;
    final alreadyPresent = ordered.any((s) {
      final content = (s.content ?? '').toLowerCase();
      return s.visible != false &&
          (s.type == 'code_box' ||
              content.contains('{{public_code}}') ||
              content.contains('{{verification_code}}'));
    });
    if (alreadyPresent) return null;
    return TemplateSection(
      id: 'bill_verification_code_auto',
      type: 'code_box',
      label: 'BILL VERIFICATION CODE',
      visible: true,
    );
  }

  TemplateSection? _duplicateBadgeSection(
      TemplatePrintData data, List<TemplateSection> ordered) {
    final text = (data.duplicateLabel ?? '').trim();
    if (text.isEmpty) return null;
    final alreadyPresent = ordered.any((s) =>
        s.visible != false &&
        (s.id == 'duplicate_badge_auto' ||
            (s.content ?? '').toLowerCase().contains(text.toLowerCase())));
    if (alreadyPresent) return null;
    return TemplateSection(
      id: 'duplicate_badge_auto',
      type: 'duplicate_badge',
      content: text,
      visible: true,
      align: 'center',
      bold: true,
      size: 11,
    );
  }

  bool _isTillSection(TemplateSection s) {
    final content = (s.content ?? '').toLowerCase();
    return s.id == 'till' ||
        s.id == 'till_compliance' ||
        content.contains('{{till_number}}');
  }

  bool _isPhoneSection(TemplateSection s) {
    final content = (s.content ?? '').toLowerCase();
    return s.visible != false &&
        (s.id == 'phone' ||
            content.contains('{{company_phone}}') ||
            content.contains('tel:'));
  }

  bool _isHeaderAnchorSection(TemplateSection s) {
    return s.visible != false &&
        (s.id == 'branch' ||
            s.id == 'company' ||
            (s.content ?? '').contains('{{branch_name}}') ||
            (s.content ?? '').contains('{{company_name}}'));
  }

  TemplateSection _autoPhoneSection() => TemplateSection(
        id: 'company_phone_auto',
        type: 'text',
        content: 'Tel: {{company_phone}}',
        visible: true,
        align: 'center',
        size: 8,
      );

  TemplateSection _autoEmailSection() => TemplateSection(
        id: 'company_email_auto',
        type: 'text',
        content: 'Email: {{company_email}}',
        visible: true,
        align: 'center',
        size: 8,
      );

  bool _isThankYouSection(TemplateSection s) {
    final content = (s.content ?? '').toLowerCase();
    return content.contains('thank you');
  }

  TemplateSection _tillComplianceSection(TemplateSection source) {
    return TemplateSection(
      id: 'till_compliance',
      type: 'text',
      content: source.content,
      visible: source.visible,
      align: 'center',
      bold: true,
      size: source.size == null || source.size! < 12 ? 13.0 : source.size!,
    );
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
        if (s.id == 'till_compliance') {
          return _renderTillCompliance(data);
        }
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
            pw.Text(s.label ?? 'BILL VERIFICATION CODE',
                style:
                    pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 7)),
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
                    padding: const pw.EdgeInsets.only(bottom: 2),
                    child: pw.Row(
                      crossAxisAlignment: pw.CrossAxisAlignment.center,
                      children: [
                        pw.Expanded(
                            child: pw.Text(e.key,
                                style: const pw.TextStyle(fontSize: 8))),
                        pw.SizedBox(width: 4),
                        pw.Flexible(
                          child: pw.Text(e.value,
                              textAlign: pw.TextAlign.right,
                              maxLines: 2,
                              style: const pw.TextStyle(fontSize: 8)),
                        ),
                      ],
                    ),
                  ))
              .toList(),
        ));

      case 'items':
        if (data.items.isEmpty) return null;
        return pad(pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.stretch,
          children: [
            // Header row
            pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              children: [
                pw.Expanded(
                    child: pw.Text('Description',
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 8))),
                pw.SizedBox(width: 4),
                pw.Flexible(
                  child: pw.Text('Price',
                      textAlign: pw.TextAlign.right,
                      style: pw.TextStyle(
                          fontWeight: pw.FontWeight.bold, fontSize: 8)),
                ),
              ],
            ),
            pw.Divider(height: 4, thickness: 0.4),
            ...data.items.map((it) => pw.Padding(
                  padding: const pw.EdgeInsets.only(bottom: 3),
                  child: pw.Row(
                    crossAxisAlignment: pw.CrossAxisAlignment.center,
                    children: [
                      pw.Expanded(
                          child: pw.Text('${it.qty}x ${it.name}',
                              maxLines: 3,
                              style: const pw.TextStyle(fontSize: 8))),
                      pw.SizedBox(width: 4),
                      pw.Flexible(
                        child: pw.Text(
                          'KES ${_money.format(it.lineTotal)}',
                          textAlign: pw.TextAlign.right,
                          style: const pw.TextStyle(fontSize: 8),
                        ),
                      ),
                    ],
                  ),
                )),
          ],
        ));

      case 'totals':
        // The Customer Bill shows only the TOTAL — no SUBTOTAL/VAT/CL/SC
        // breakdown at all. The Customer Receipt (post-payment, with ETR)
        // is the only document that itemizes the inclusive breakdown.
        return pad(pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.stretch,
          children: [
            if (data.showVat) ...[
              _totalRow('SUBTOTAL', 'KES ${_money.format(data.subtotal)}', 9),
              _totalRow('VAT (16% incl.)', 'KES ${_money.format(data.tax)}', 9),
              if (data.cateringLevy > 0)
                _totalRow('CL (2% incl.)',
                    'KES ${_money.format(data.cateringLevy)}', 9),
              if (data.serviceCharge > 0)
                _totalRow('SC (3% incl.)',
                    'KES ${_money.format(data.serviceCharge)}', 9),
            ],
            pw.SizedBox(height: 2),
            pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              children: [
                pw.Expanded(
                    child: pw.Text('TOTAL:',
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 11))),
                pw.SizedBox(width: 4),
                pw.Flexible(
                  child: pw.Text('KES ${_money.format(data.total)}',
                      textAlign: pw.TextAlign.right,
                      style: pw.TextStyle(
                          fontWeight: pw.FontWeight.bold, fontSize: 11)),
                ),
              ],
            ),
          ],
        ));

      case 'staff_box':
        final name = data.staff['name'] ?? v['staff_name'] ?? '';
        if (name.isEmpty) return null;
        return pad(pw.Container(
          width: double.infinity,
          padding: const pw.EdgeInsets.symmetric(vertical: 4, horizontal: 6),
          decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.6)),
          child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text('STAFF',
                    style: pw.TextStyle(
                        fontWeight: pw.FontWeight.bold, fontSize: 7)),
                pw.Text(name,
                    style: pw.TextStyle(
                        fontWeight: pw.FontWeight.bold, fontSize: 12)),
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

      case 'duplicate_badge':
        final text = _subst(s.content, v);
        if (text.isEmpty) return null;
        return pad(pw.Container(
          width: double.infinity,
          padding: const pw.EdgeInsets.symmetric(vertical: 5, horizontal: 6),
          decoration: pw.BoxDecoration(
            border: pw.Border.all(width: 1),
            color: PdfColors.grey300,
          ),
          child: pw.Text(
            text.toUpperCase(),
            textAlign: pw.TextAlign.center,
            style: pw.TextStyle(
              fontSize: 11,
              fontWeight: pw.FontWeight.bold,
            ),
          ),
        ));

      case 'barcode':
        final bc = (data.barcodeValue ?? data.code ?? '').trim();
        if (bc.isEmpty) return null;
        return pad(pw.Column(children: [
          pw.BarcodeWidget(
            data: bc.toUpperCase(),
            barcode: pw.Barcode.code128(),
            width: _barcodeWidthMm * PdfPageFormat.mm,
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
      padding: const pw.EdgeInsets.only(bottom: 2),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.center,
        children: [
          pw.Expanded(
              child: pw.Text(label, style: pw.TextStyle(fontSize: fontSize))),
          pw.SizedBox(width: 4),
          pw.Flexible(
            child: pw.Text(value,
                textAlign: pw.TextAlign.right,
                style: pw.TextStyle(fontSize: fontSize)),
          ),
        ],
      ),
    );
  }

  pw.Widget? _renderTillCompliance(TemplatePrintData data) {
    final till = (data.values['till_number'] ?? '').trim();
    if (till.isEmpty) return null;
    return pw.Padding(
      padding: const pw.EdgeInsets.only(top: 2, bottom: 4),
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
          pw.Text(till.toUpperCase(),
              textAlign: pw.TextAlign.center,
              style:
                  pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
        ]),
      ),
    );
  }
}
