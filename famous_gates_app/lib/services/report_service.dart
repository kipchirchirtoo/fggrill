import 'package:flutter/services.dart' show rootBundle;
import 'package:printing/printing.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';

class ReportKpi {
  final String label;
  final String value;
  final String? subtitle;

  const ReportKpi({
    required this.label,
    required this.value,
    this.subtitle,
  });
}

class ReportService {
  final money = NumberFormat('#,##0.00', 'en_KE');
  final numFormat = NumberFormat('#,##0', 'en_KE');

  // Famous Gates Brand Colors
  static const primaryNavy = PdfColor.fromInt(0xFF0D2C54);
  static const secondaryNavy = PdfColor.fromInt(0xFF173D5F);
  static const accentGold = PdfColor.fromInt(0xFFD4AF37);
  static const softBg = PdfColor.fromInt(0xFFF8F9FA);
  static const borderGrey = PdfColor.fromInt(0xFFD0D5DD);
  static const textDark = PdfColor.fromInt(0xFF1D2939);
  static const textMuted = PdfColor.fromInt(0xFF667085);
  static const warningBg = PdfColor.fromInt(0xFFFEF3F2);
  static const warningText = PdfColor.fromInt(0xFFB42318);

  Future<pw.MemoryImage?> _loadBrandLogo() async {
    try {
      final logoBytes =
          await rootBundle.load('assets/frontend_public/fglogo.png');
      return pw.MemoryImage(logoBytes.buffer.asUint8List());
    } catch (_) {
      try {
        final logoBytes =
            await rootBundle.load('assets/frontend_public/logo.png');
        return pw.MemoryImage(logoBytes.buffer.asUint8List());
      } catch (_) {
        return null;
      }
    }
  }

  /// Generates a standard Famous Gates branded multi-section report
  Future<void> generateAndPrint({
    required String title,
    required String subtitle,
    required List<ReportSection> sections,
    String? dateRange,
    String? branch,
    List<ReportKpi>? kpis,
    String? preparedBy,
    bool showSignatures = true,
  }) async {
    final doc = pw.Document();
    final logoImage = await _loadBrandLogo();

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        maxPages: 10000,
        margin: const pw.EdgeInsets.symmetric(horizontal: 36, vertical: 30),
        build: (ctx) => [
          _buildBrandedHeader(
            title: title,
            subtitle: subtitle,
            dateRange: dateRange,
            branch: branch,
            logo: logoImage,
          ),
          if (kpis != null && kpis.isNotEmpty) ...[
            _buildKpiRow(kpis),
            pw.SizedBox(height: 14),
          ],
          ...sections.expand((s) => [
                if (s.title != null) _buildSectionHeader(s.title!),
                if (s.description != null)
                  pw.Padding(
                    padding: const pw.EdgeInsets.only(bottom: 8),
                    child: pw.Text(
                      s.description!,
                      style: const pw.TextStyle(
                        fontSize: 9,
                        color: textMuted,
                      ),
                    ),
                  ),
                if (s.tableHeaders != null && s.tableRows != null)
                  _buildBrandedTable(
                    s.tableHeaders!,
                    s.tableRows!,
                    s.columnWidths,
                    s.cellAlignments,
                  ),
                if (s.totalLabel != null)
                  pw.Container(
                    margin: const pw.EdgeInsets.only(top: 6, bottom: 14),
                    padding: const pw.EdgeInsets.symmetric(
                        horizontal: 10, vertical: 6),
                    decoration: const pw.BoxDecoration(
                      color: softBg,
                      border: pw.Border(
                        left: pw.BorderSide(color: primaryNavy, width: 3),
                      ),
                    ),
                    child: pw.Row(
                      mainAxisAlignment: pw.MainAxisAlignment.end,
                      children: [
                        pw.Text(
                          '${s.totalLabel}: ',
                          style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold,
                            fontSize: 10,
                            color: primaryNavy,
                          ),
                        ),
                        pw.Text(
                          s.totalValue ?? '',
                          style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold,
                            fontSize: 11,
                            color: primaryNavy,
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  pw.SizedBox(height: 12),
              ]),
          if (showSignatures) _buildSignatoryBlock(preparedBy: preparedBy),
        ],
        footer: (ctx) => _buildBrandedFooter(ctx),
      ),
    );

    await Printing.layoutPdf(
      onLayout: (PdfPageFormat format) async => doc.save(),
    );
  }

  /// Specialized generator for Central Storekeeper inventory exports (Foodstuffs, Bar, Stationery, Master Inventory)
  Future<void> generateCentralStoreInventoryReport({
    required String title,
    required String subtitle,
    required List<Map<String, dynamic>> items,
    Map<String, dynamic> valuation = const {},
    String? selectedCategory,
    String? searchQuery,
    String? storeType,
    String? preparedBy,
  }) async {
    final doc = pw.Document();
    final logoImage = await _loadBrandLogo();

    // ── Compute Metrics ──────────────────────────────────────────────────────
    final totalItemsCount = items.length;
    var lowStockCount = 0;
    double calculatedTotalValue = 0.0;

    for (final item in items) {
      final qty = _asNum(item['quantity'] ?? item['available_quantity']);
      final reorder = _asNum(item['reorder_level'] ?? item['minimum_stock']);
      final cost = _asNum(
        item['cost_price'] ??
            item['retail_price'] ??
            item['unit_cost'] ??
            item['last_purchase_price'],
      );

      if (qty <= (reorder > 0 ? reorder : 10)) {
        lowStockCount++;
      }
      calculatedTotalValue += (qty * cost);
    }

    final valuationTotal = _asNum(
      valuation['grand_valuation'] ??
          valuation['grandValuation'] ??
          valuation['total_value'] ??
          valuation['stock_value'] ??
          valuation['totalValue'],
    );
    final finalTotalValue =
        valuationTotal > 0 ? valuationTotal : calculatedTotalValue;

    // ── Build KPIs ──────────────────────────────────────────────────────────
    final kpis = <ReportKpi>[
      ReportKpi(
        label: 'TOTAL ITEMS',
        value: numFormat.format(totalItemsCount),
        subtitle: selectedCategory != null
            ? 'Category: $selectedCategory'
            : 'All Store Items',
      ),
      ReportKpi(
        label: 'LOW STOCK ALERT',
        value: numFormat.format(lowStockCount),
        subtitle: 'Items at or below reorder level',
      ),
      ReportKpi(
        label: 'TOTAL STOCK VALUATION',
        value: 'KES ${money.format(finalTotalValue)}',
        subtitle: 'Based on current unit cost',
      ),
    ];

    // ── Group Items by Category ─────────────────────────────────────────────
    final groups = <String, List<Map<String, dynamic>>>{};
    for (final item in items) {
      final catRaw =
          '${item['category'] ?? item['item_category'] ?? 'OTHER'}'
              .trim()
              .toUpperCase();
      final cat = catRaw.isEmpty ? 'OTHER' : catRaw;
      groups.putIfAbsent(cat, () => []).add(item);
    }

    final sortedCategoryKeys = groups.keys.toList()..sort();

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        maxPages: 10000,
        margin: const pw.EdgeInsets.symmetric(horizontal: 32, vertical: 28),
        build: (ctx) {
          final content = <pw.Widget>[
            _buildBrandedHeader(
              title: title.toUpperCase(),
              subtitle: subtitle,
              branch: 'Central Store Warehouse',
              logo: logoImage,
            ),
            _buildKpiRow(kpis),
            pw.SizedBox(height: 12),
          ];

          var overallIndex = 1;

          for (final catKey in sortedCategoryKeys) {
            final catItems = groups[catKey]!;
            var catTotalValue = 0.0;

            final tableRows = <List<String>>[];
            final isLowStockList = <bool>[];

            for (final item in catItems) {
              final sku =
                  '${item['sku'] ?? item['item_sku'] ?? '—'}'.trim();
              final name =
                  '${item['item_name'] ?? item['name'] ?? item['description'] ?? sku}'
                      .trim();
              final uom =
                  '${item['unit_of_measure'] ?? item['unit'] ?? 'units'}'
                      .trim();
              final qty =
                  _asNum(item['quantity'] ?? item['available_quantity']);
              final cost = _asNum(
                item['cost_price'] ??
                    item['retail_price'] ??
                    item['unit_cost'] ??
                    item['last_purchase_price'],
              );
              final reorder =
                  _asNum(item['reorder_level'] ?? item['minimum_stock']);
              final lineTotal = qty * cost;
              catTotalValue += lineTotal;

              final isLow = qty <= (reorder > 0 ? reorder : 10);
              isLowStockList.add(isLow);

              tableRows.add([
                '$overallIndex',
                sku,
                name,
                catKey,
                uom,
                qty.toStringAsFixed(qty % 1 == 0 ? 0 : 2),
                cost > 0 ? money.format(cost) : '0.00',
                lineTotal > 0 ? money.format(lineTotal) : '0.00',
              ]);
              overallIndex++;
            }

            // Category Section Header Banner
            content.add(
              pw.Container(
                width: double.infinity,
                margin: const pw.EdgeInsets.only(top: 10, bottom: 4),
                padding: const pw.EdgeInsets.symmetric(
                    horizontal: 8, vertical: 4),
                decoration: const pw.BoxDecoration(
                  color: primaryNavy,
                  borderRadius:
                      pw.BorderRadius.all(pw.Radius.circular(3)),
                ),
                child: pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text(
                      '$catKey  (${catItems.length} items)',
                      style: pw.TextStyle(
                        color: PdfColors.white,
                        fontSize: 9,
                        fontWeight: pw.FontWeight.bold,
                      ),
                    ),
                    pw.Text(
                      'Subtotal: KES ${money.format(catTotalValue)}',
                      style: pw.TextStyle(
                        color: PdfColors.white,
                        fontSize: 8.5,
                        fontWeight: pw.FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            );

            // Category Table
            content.add(
              _buildInventoryTable(tableRows, isLowStockList),
            );
          }

          // Grand Total Valuation Box
          content.add(
            pw.Container(
              margin: const pw.EdgeInsets.only(top: 14, bottom: 16),
              padding: const pw.EdgeInsets.symmetric(
                  horizontal: 12, vertical: 8),
              decoration: pw.BoxDecoration(
                color: softBg,
                borderRadius:
                    const pw.BorderRadius.all(pw.Radius.circular(4)),
                border: pw.Border.all(color: borderGrey, width: 0.8),
              ),
              child: pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text(
                    'GRAND TOTAL INVENTORY VALUATION (${items.length} Items):',
                    style: pw.TextStyle(
                      fontWeight: pw.FontWeight.bold,
                      fontSize: 10,
                      color: primaryNavy,
                    ),
                  ),
                  pw.Text(
                    'KES ${money.format(finalTotalValue)}',
                    style: pw.TextStyle(
                      fontWeight: pw.FontWeight.bold,
                      fontSize: 12,
                      color: primaryNavy,
                    ),
                  ),
                ],
              ),
            ),
          );

          // Signatory Verification Block
          content.add(_buildSignatoryBlock(preparedBy: preparedBy));

          return content;
        },
        footer: (ctx) => _buildBrandedFooter(ctx),
      ),
    );

    await Printing.layoutPdf(
      onLayout: (PdfPageFormat format) async => doc.save(),
    );
  }

  /// Generates a Famous Gates branded Kitchen Stocktake Report
  Future<void> generateKitchenStocktakeReport({
    required String branchName,
    required String date,
    required String shift,
    required String status,
    required List<Map<String, dynamic>> items,
    String? dispenserName,
    String? confirmationName,
    List<String>? chefsOnDuty,
    String? preparedBy,
  }) async {
    final doc = pw.Document();
    final logoImage = await _loadBrandLogo();

    final isLocked = status.toLowerCase() == 'submitted' ||
        status.toLowerCase() == 'reviewed' ||
        status.toLowerCase() == 'approved' ||
        status.toLowerCase() == 'posted';

    int countedCount = 0;
    int varianceCount = 0;

    for (final item in items) {
      final closing = _asNum(item['closing_qty'] ?? item['physical_qty']);
      final expected = _asNum(item['expected_qty'] ?? item['book_qty'] ?? item['opening_qty']);
      final variance = closing - expected;
      if (closing > 0 || item['closing_qty'] != null) {
        countedCount++;
      }
      if (variance != 0 && (closing > 0 || isLocked)) {
        varianceCount++;
      }
    }

    final kpis = [
      ReportKpi(
        label: 'TOTAL ITEMS',
        value: '${items.length}',
        subtitle: 'Kitchen Catalog',
      ),
      ReportKpi(
        label: 'COUNTED LINES',
        value: '$countedCount',
        subtitle: '${items.length - countedCount} Pending',
      ),
      ReportKpi(
        label: 'VARIANCES',
        value: '$varianceCount',
        subtitle: varianceCount == 0 ? 'Balanced' : 'Requires Review',
      ),
      ReportKpi(
        label: 'STATUS',
        value: status.toUpperCase(),
        subtitle: 'Shift $shift',
      ),
    ];

    final chefsStr = chefsOnDuty != null && chefsOnDuty.isNotEmpty
        ? chefsOnDuty.join(', ')
        : '—';
    final dispenserStr = dispenserName != null && dispenserName.isNotEmpty
        ? dispenserName
        : '—';
    final confirmStr = confirmationName != null && confirmationName.isNotEmpty
        ? confirmationName
        : '—';

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        maxPages: 10000,
        margin: const pw.EdgeInsets.symmetric(horizontal: 32, vertical: 26),
        build: (ctx) {
          final content = <pw.Widget>[];

          // Branded Header
          content.add(
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Row(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    if (logoImage != null)
                      pw.Padding(
                        padding: const pw.EdgeInsets.only(right: 12),
                        child: pw.Image(logoImage, width: 62, height: 62),
                      )
                    else
                      pw.Container(
                        width: 50,
                        height: 50,
                        margin: const pw.EdgeInsets.only(right: 12),
                        decoration: const pw.BoxDecoration(
                          color: primaryNavy,
                          borderRadius: pw.BorderRadius.all(pw.Radius.circular(6)),
                        ),
                        child: pw.Center(
                          child: pw.Text(
                            'FG',
                            style: pw.TextStyle(
                              color: PdfColors.white,
                              fontSize: 20,
                              fontWeight: pw.FontWeight.bold,
                            ),
                          ),
                        ),
                      ),
                    pw.Expanded(
                      child: pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Text(
                            'FAMOUS GATES HOTELS',
                            style: pw.TextStyle(
                              fontWeight: pw.FontWeight.bold,
                              fontSize: 15,
                              color: primaryNavy,
                            ),
                          ),
                          pw.Text(
                            branchName.toUpperCase(),
                            style: pw.TextStyle(
                              fontSize: 10,
                              fontWeight: pw.FontWeight.bold,
                              color: accentGold,
                            ),
                          ),
                          pw.Text(
                            'KITCHEN DEPARTMENT | DAILY STOCKTAKE & CONSUMPTION AUDIT',
                            style: const pw.TextStyle(
                              fontSize: 8,
                              color: textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    pw.Container(
                      padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: pw.BoxDecoration(
                        color: softBg,
                        borderRadius: const pw.BorderRadius.all(pw.Radius.circular(4)),
                        border: pw.Border.all(color: borderGrey, width: 0.8),
                      ),
                      child: pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.end,
                        children: [
                          pw.Text(
                            'KITCHEN STOCKTAKE',
                            style: pw.TextStyle(
                              fontSize: 9,
                              fontWeight: pw.FontWeight.bold,
                              color: primaryNavy,
                            ),
                          ),
                          pw.SizedBox(height: 2),
                          pw.Text(
                            'Date: $date',
                            style: const pw.TextStyle(
                              fontSize: 8,
                              color: textDark,
                            ),
                          ),
                          pw.Text(
                            'Shift: $shift  |  Status: ${status.toUpperCase()}',
                            style: pw.TextStyle(
                              fontSize: 7.5,
                              fontWeight: pw.FontWeight.bold,
                              color: textMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                pw.SizedBox(height: 8),
                pw.Row(
                  children: [
                    pw.Expanded(
                      flex: 3,
                      child: pw.Container(height: 2.5, color: primaryNavy),
                    ),
                    pw.Expanded(
                      flex: 1,
                      child: pw.Container(height: 2.5, color: accentGold),
                    ),
                  ],
                ),
                pw.SizedBox(height: 8),
              ],
            ),
          );

          // KPI summary
          content.add(_buildKpiRow(kpis));
          content.add(pw.SizedBox(height: 10));

          // Staff on duty banner
          content.add(
            pw.Container(
              margin: const pw.EdgeInsets.only(bottom: 10),
              padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: pw.BoxDecoration(
                color: softBg,
                borderRadius: const pw.BorderRadius.all(pw.Radius.circular(4)),
                border: pw.Border.all(color: borderGrey, width: 0.5),
              ),
              child: pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text(
                    'Dispenser: $dispenserStr',
                    style: const pw.TextStyle(fontSize: 8, color: textDark),
                  ),
                  pw.Text(
                    'Chefs on Duty: $chefsStr',
                    style: const pw.TextStyle(fontSize: 8, color: textDark),
                  ),
                  pw.Text(
                    'Confirmation: $confirmStr',
                    style: const pw.TextStyle(fontSize: 8, color: textDark),
                  ),
                ],
              ),
            ),
          );

          // Table of Items
          final tableHeaders = [
            '#',
            'ITEM NAME',
            'UNIT',
            'PHYSICAL COUNT',
            'EXPECTED',
            'VARIANCE',
            'STATUS / NOTES',
          ];

          final tableRows = items.asMap().entries.map((entry) {
            final idx = entry.key + 1;
            final item = entry.value;
            final name = (item['item_name'] ?? item['name'] ?? 'Item').toString();
            final unit = (item['unit'] ?? item['unit_of_measure'] ?? 'units').toString();
            final closing = _asNum(item['closing_qty'] ?? item['physical_qty']);
            final expected = _asNum(item['expected_qty'] ?? item['book_qty'] ?? item['opening_qty']);
            final variance = closing - expected;
            final closingStr = closing > 0 || item['closing_qty'] != null
                ? (closing == closing.roundToDouble() ? closing.toInt().toString() : closing.toStringAsFixed(2))
                : '—';
            final expectedStr = expected == expected.roundToDouble()
                ? expected.toInt().toString()
                : expected.toStringAsFixed(2);
            final varianceStr = variance == 0
                ? '0'
                : (variance > 0
                    ? '+${variance == variance.roundToDouble() ? variance.toInt().toString() : variance.toStringAsFixed(2)}'
                    : (variance == variance.roundToDouble() ? variance.toInt().toString() : variance.toStringAsFixed(2)));

            final notes = (item['notes'] ?? item['comment'] ?? (variance != 0 ? 'Variance detected' : 'OK')).toString();

            return [
              '$idx',
              name,
              unit,
              closingStr,
              expectedStr,
              varianceStr,
              notes,
            ];
          }).toList();

          content.add(
            pw.TableHelper.fromTextArray(
              border: pw.TableBorder.all(color: borderGrey, width: 0.5),
              headers: tableHeaders,
              data: tableRows,
              headerStyle: pw.TextStyle(
                color: PdfColors.white,
                fontWeight: pw.FontWeight.bold,
                fontSize: 7.5,
              ),
              headerDecoration: const pw.BoxDecoration(color: secondaryNavy),
              cellStyle: const pw.TextStyle(fontSize: 7.5, color: textDark),
              cellHeight: 18,
              cellPadding: const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 2.5),
              columnWidths: {
                0: const pw.FixedColumnWidth(22),
                1: const pw.FlexColumnWidth(3.5),
                2: const pw.FlexColumnWidth(1.2),
                3: const pw.FlexColumnWidth(1.6),
                4: const pw.FlexColumnWidth(1.4),
                5: const pw.FlexColumnWidth(1.4),
                6: const pw.FlexColumnWidth(2.0),
              },
              cellAlignments: {
                0: pw.Alignment.centerLeft,
                1: pw.Alignment.centerLeft,
                2: pw.Alignment.center,
                3: pw.Alignment.centerRight,
                4: pw.Alignment.centerRight,
                5: pw.Alignment.centerRight,
                6: pw.Alignment.centerLeft,
              },
            ),
          );

          content.add(pw.SizedBox(height: 16));

          // Kitchen Signatures Block (Dispenser, Head Chef, Internal Auditor)
          content.add(
            pw.Container(
              margin: const pw.EdgeInsets.only(top: 8),
              child: pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  _buildSignatureBox(
                    title: 'COUNTED BY (DISPENSER)',
                    name: dispenserStr != '—' ? dispenserStr : (preparedBy ?? 'Storekeeper / Dispenser'),
                    designation: 'Kitchen Stores Issuance',
                  ),
                  _buildSignatureBox(
                    title: 'CONFIRMED BY (HEAD CHEF)',
                    name: chefsStr != '—' ? chefsStr.split(',').first.trim() : 'Head Chef on Duty',
                    designation: 'Kitchen Operations',
                  ),
                  _buildSignatureBox(
                    title: 'VERIFIED BY (AUDITOR)',
                    name: 'Branch Auditor',
                    designation: 'Audit & Compliance',
                  ),
                ],
              ),
            ),
          );

          return content;
        },
        footer: (ctx) => _buildBrandedFooter(ctx),
      ),
    );

    await Printing.layoutPdf(
      onLayout: (PdfPageFormat format) async => doc.save(),
      name: 'Kitchen_Stocktake_${date}_Shift_$shift.pdf',
    );
  }

  // ── Header Component ───────────────────────────────────────────────────────
  pw.Widget _buildBrandedHeader({
    required String title,
    required String subtitle,
    String? dateRange,
    String? branch,
    String? headerCategory,
    pw.MemoryImage? logo,
  }) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            if (logo != null)
              pw.Padding(
                padding: const pw.EdgeInsets.only(right: 14),
                child: pw.Image(logo, width: 68, height: 68),
              )
            else
              pw.Container(
                width: 54,
                height: 54,
                margin: const pw.EdgeInsets.only(right: 12),
                decoration: const pw.BoxDecoration(
                  color: primaryNavy,
                  borderRadius:
                      pw.BorderRadius.all(pw.Radius.circular(6)),
                ),
                child: pw.Center(
                  child: pw.Text(
                    'FG',
                    style: pw.TextStyle(
                      color: PdfColors.white,
                      fontSize: 22,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                ),
              ),
            pw.Expanded(
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    'FAMOUS GATES HOTELS',
                    style: pw.TextStyle(
                      fontWeight: pw.FontWeight.bold,
                      fontSize: 16,
                      color: primaryNavy,
                    ),
                  ),
                  pw.Text(
                    'FAMOUS GATE HOTELS MANAGEMENT & AUDIT SYSTEM',
                    style: pw.TextStyle(
                      fontSize: 9,
                      fontWeight: pw.FontWeight.bold,
                      color: textMuted,
                    ),
                  ),
                  pw.SizedBox(height: 2),
                  pw.Text(
                    'Bomet, Kenya  |  P.O. Box 244-20400',
                    style: const pw.TextStyle(
                      fontSize: 8,
                      color: textMuted,
                    ),
                  ),
                  pw.Text(
                    'Tel: +254 706 782 828  |  Email: info@famousgatehotels.com  |  Web: www.famousgatehotels.com',
                    style: const pw.TextStyle(
                      fontSize: 8,
                      color: textMuted,
                    ),
                  ),
                ],
              ),
            ),
            pw.Container(
              padding: const pw.EdgeInsets.symmetric(
                  horizontal: 10, vertical: 6),
              decoration: pw.BoxDecoration(
                color: softBg,
                borderRadius:
                    const pw.BorderRadius.all(pw.Radius.circular(4)),
                border: pw.Border.all(color: borderGrey, width: 0.8),
              ),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text(
                    headerCategory ?? 'OFFICIAL AUDIT REPORT',
                    style: pw.TextStyle(
                      fontSize: 9,
                      fontWeight: pw.FontWeight.bold,
                      color: primaryNavy,
                    ),
                  ),
                  pw.SizedBox(height: 2),
                  pw.Text(
                    'Date: ${DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now())}',
                    style: const pw.TextStyle(
                      fontSize: 8,
                      color: textDark,
                    ),
                  ),
                  if (branch != null)
                    pw.Text(
                      'Store: $branch',
                      style: pw.TextStyle(
                        fontSize: 8,
                        fontWeight: pw.FontWeight.bold,
                        color: textMuted,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
        pw.SizedBox(height: 8),
        // Decorative Dual-Color Divider Line
        pw.Row(
          children: [
            pw.Expanded(
              flex: 3,
              child: pw.Container(height: 2.5, color: primaryNavy),
            ),
            pw.Expanded(
              flex: 1,
              child: pw.Container(height: 2.5, color: accentGold),
            ),
          ],
        ),
        pw.SizedBox(height: 10),
        // Document Subtitle Banner
        pw.Container(
          width: double.infinity,
          padding: const pw.EdgeInsets.symmetric(
              horizontal: 10, vertical: 6),
          decoration: const pw.BoxDecoration(
            color: softBg,
            borderRadius:
                pw.BorderRadius.all(pw.Radius.circular(4)),
          ),
          child: pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(
                title,
                style: pw.TextStyle(
                  fontWeight: pw.FontWeight.bold,
                  fontSize: 12,
                  color: primaryNavy,
                ),
              ),
              pw.Text(
                subtitle,
                style: const pw.TextStyle(
                  fontSize: 9,
                  color: textMuted,
                ),
              ),
            ],
          ),
        ),
        pw.SizedBox(height: 10),
      ],
    );
  }

  // ── KPI Summary Tiles ──────────────────────────────────────────────────────
  pw.Widget _buildKpiRow(List<ReportKpi> kpis) {
    return pw.Row(
      children: kpis.map((kpi) {
        return pw.Expanded(
          child: pw.Container(
            margin: const pw.EdgeInsets.only(right: 6),
            padding: const pw.EdgeInsets.all(8),
            decoration: pw.BoxDecoration(
              color: PdfColors.white,
              borderRadius:
                  const pw.BorderRadius.all(pw.Radius.circular(4)),
              border: pw.Border.all(color: borderGrey, width: 0.8),
            ),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  kpi.label.toUpperCase(),
                  style: const pw.TextStyle(
                    fontSize: 7.5,
                    color: textMuted,
                  ),
                ),
                pw.SizedBox(height: 3),
                pw.Text(
                  kpi.value,
                  style: pw.TextStyle(
                    fontSize: 12,
                    fontWeight: pw.FontWeight.bold,
                    color: primaryNavy,
                  ),
                ),
                if (kpi.subtitle != null) ...[
                  pw.SizedBox(height: 2),
                  pw.Text(
                    kpi.subtitle!,
                    style: const pw.TextStyle(
                      fontSize: 7,
                      color: textMuted,
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  // ── Inventory Table Builder ───────────────────────────────────────────────
  pw.Widget _buildInventoryTable(
    List<List<String>> rows,
    List<bool> isLowStockList,
  ) {
    return pw.TableHelper.fromTextArray(
      border: pw.TableBorder.all(color: borderGrey, width: 0.5),
      headers: const [
        '#',
        'SKU',
        'ITEM NAME & DESCRIPTION',
        'CATEGORY',
        'UOM',
        'STOCK QTY',
        'COST (KES)',
        'VALUATION (KES)',
      ],
      data: rows,
      headerStyle: pw.TextStyle(
        color: PdfColors.white,
        fontWeight: pw.FontWeight.bold,
        fontSize: 7.5,
      ),
      headerDecoration: const pw.BoxDecoration(color: secondaryNavy),
      cellStyle: const pw.TextStyle(fontSize: 7.5, color: textDark),
      cellHeight: 18,
      cellPadding:
          const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 2.5),
      columnWidths: {
        0: const pw.FixedColumnWidth(20),
        1: const pw.FlexColumnWidth(1.8),
        2: const pw.FlexColumnWidth(3.8),
        3: const pw.FlexColumnWidth(1.8),
        4: const pw.FlexColumnWidth(1.0),
        5: const pw.FlexColumnWidth(1.4),
        6: const pw.FlexColumnWidth(1.6),
        7: const pw.FlexColumnWidth(1.8),
      },
      cellAlignments: {
        0: pw.Alignment.centerLeft,
        1: pw.Alignment.centerLeft,
        2: pw.Alignment.centerLeft,
        3: pw.Alignment.centerLeft,
        4: pw.Alignment.center,
        5: pw.Alignment.centerRight,
        6: pw.Alignment.centerRight,
        7: pw.Alignment.centerRight,
      },
    );
  }

  // ── Branded Generic Table ──────────────────────────────────────────────────
  pw.Widget _buildBrandedTable(
    List<String> headers,
    List<List<String>> rows,
    List<double>? columnWidths,
    Map<int, pw.Alignment>? cellAlignments,
  ) {
    final headerWidgets = headers
        .map(
          (h) => pw.Padding(
            padding:
                const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 4),
            child: pw.Text(
              h,
              style: pw.TextStyle(
                fontWeight: pw.FontWeight.bold,
                fontSize: 8,
                color: PdfColors.white,
              ),
            ),
          ),
        )
        .toList();

    final dataRows = rows.asMap().entries.map((entry) {
      final index = entry.key;
      final row = entry.value;
      return pw.TableRow(
        decoration: pw.BoxDecoration(
          color: index.isOdd ? softBg : PdfColors.white,
        ),
        children: row.asMap().entries.map((cellEntry) {
          final colIdx = cellEntry.key;
          final cellText = cellEntry.value;
          final align = cellAlignments?[colIdx] ?? pw.Alignment.centerLeft;
          return pw.Container(
            alignment: align,
            padding:
                const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 3.5),
            child: pw.Text(
              cellText,
              style: const pw.TextStyle(fontSize: 8, color: textDark),
            ),
          );
        }).toList(),
      );
    }).toList();

    return pw.Table(
      border: pw.TableBorder.all(color: borderGrey, width: 0.5),
      columnWidths: columnWidths != null
          ? {
              for (var i = 0; i < columnWidths.length; i++)
                i: pw.FixedColumnWidth(columnWidths[i])
            }
          : null,
      children: [
        pw.TableRow(
          decoration: const pw.BoxDecoration(color: secondaryNavy),
          children: headerWidgets,
        ),
        ...dataRows,
      ],
    );
  }

  pw.Widget _buildSectionHeader(String title) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(top: 8, bottom: 6),
      child: pw.Text(
        title,
        style: pw.TextStyle(
          fontWeight: pw.FontWeight.bold,
          fontSize: 11,
          color: primaryNavy,
        ),
      ),
    );
  }

  // ── Signatory Block ────────────────────────────────────────────────────────
  pw.Widget _buildSignatoryBlock({String? preparedBy}) {
    return pw.Container(
      margin: const pw.EdgeInsets.only(top: 20),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          _buildSignatureBox(
            title: 'PREPARED BY',
            name: preparedBy?.isNotEmpty == true
                ? preparedBy!
                : 'Central Storekeeper',
            designation: 'Central Storekeeper',
          ),
          _buildSignatureBox(
            title: 'VERIFIED BY',
            name: 'Internal Auditor',
            designation: 'Audit & Compliance',
          ),
          _buildSignatureBox(
            title: 'APPROVED BY',
            name: 'General Manager / Director',
            designation: 'Management Authorization',
          ),
        ],
      ),
    );
  }

  pw.Widget _buildSignatureBox({
    required String title,
    required String name,
    required String designation,
  }) {
    return pw.Container(
      width: 155,
      padding: const pw.EdgeInsets.all(8),
      decoration: pw.BoxDecoration(
        color: softBg,
        borderRadius: const pw.BorderRadius.all(pw.Radius.circular(4)),
        border: pw.Border.all(color: borderGrey, width: 0.8),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            title,
            style: pw.TextStyle(
              fontSize: 7.5,
              fontWeight: pw.FontWeight.bold,
              color: primaryNavy,
            ),
          ),
          pw.SizedBox(height: 14),
          pw.Container(
            height: 0.8,
            color: textMuted,
          ),
          pw.SizedBox(height: 3),
          pw.Text(
            name,
            style: pw.TextStyle(
              fontSize: 7.5,
              fontWeight: pw.FontWeight.bold,
              color: textDark,
            ),
          ),
          pw.Text(
            designation,
            style: const pw.TextStyle(
              fontSize: 6.5,
              color: textMuted,
            ),
          ),
          pw.Text(
            'Date: ........................',
            style: const pw.TextStyle(
              fontSize: 6.5,
              color: textMuted,
            ),
          ),
        ],
      ),
    );
  }

  // ── Specialized Void Audit & Approvals PDF Report ────────────────────────
  Future<void> generateVoidReportPdf({
    required String title,
    required String subtitle,
    required List<dynamic> voidRecords,
    String? branch,
    String? dateRange,
    String? statusFilter,
    String? preparedBy,
  }) async {
    final doc = pw.Document();
    final logoImage = await _loadBrandLogo();

    final totalCount = voidRecords.length;
    double totalAmount = 0.0;
    int approvedCount = 0;
    double approvedAmount = 0.0;
    int rejectedCount = 0;
    int pendingCount = 0;

    final tableRows = <List<String>>[];

    for (var i = 0; i < voidRecords.length; i++) {
      final r = voidRecords[i];
      String billNo = '-';
      String dateStr = '-';
      String serverName = '-';
      String itemName = '-';
      String qtyStr = '1';
      double amount = 0.0;
      String reason = '-';
      String kitchenInfo = '-';
      String cashierInfo = '-';
      String managerInfo = '-';
      String status = 'pending';

      try {
        final dynamic raw = r;
        if (raw.runtimeType.toString().contains('ItemVoidRequest')) {
          billNo = raw.orderNumber ?? raw.orderId ?? '-';
          if (raw.createdAt != null) {
            dateStr = DateFormat('yyyy-MM-dd HH:mm').format(raw.createdAt!.toLocal());
          }
          serverName = raw.requestedByName ?? raw.requestedBy ?? '-';
          itemName = (raw.itemName != null && raw.itemName.toString().trim().isNotEmpty) ? raw.itemName.toString().trim() : '-';
          if (itemName == '-' || itemName.toLowerCase() == 'pos bill') {
            if (raw.note != null && raw.note.toString().trim().isNotEmpty) {
              itemName = raw.note.toString().trim();
            }
          }
          final qty = _asNum(raw.qtyToVoid);
          qtyStr = qty.toStringAsFixed(qty % 1 == 0 ? 0 : 2);
          amount = _asNum(raw.amount);
          reason = (raw.reason != null && raw.reason.toString().isNotEmpty)
              ? raw.reason.toString()
              : (raw.reasonCategory?.toString() ?? '-');
          status = raw.status?.toString() ?? 'pending';

          // Kitchen timeline
          if (raw.kitchenAcknowledgedAt != null) {
            final kTime = DateFormat('MM-dd HH:mm').format(raw.kitchenAcknowledgedAt!.toLocal());
            final kStaff = raw.kitchenName ?? 'Kitchen';
            final kAct = raw.isKitchenDeclined == true ? 'Declined' : 'Ack';
            kitchenInfo = '$kAct by $kStaff\n$kTime';
          } else {
            kitchenInfo = '-';
          }

          // Cashier timeline
          if (raw.cashierAcknowledgedAt != null) {
            final cTime = DateFormat('MM-dd HH:mm').format(raw.cashierAcknowledgedAt!.toLocal());
            final cStaff = raw.cashierName ?? 'Cashier';
            final cAct = raw.isCashierDeclined == true ? 'Declined' : 'Ack';
            cashierInfo = '$cAct by $cStaff\n$cTime';
          } else {
            cashierInfo = '-';
          }

          // Manager / Accountant timeline
          if (raw.managerReviewedAt != null) {
            final mTime = DateFormat('MM-dd HH:mm').format(raw.managerReviewedAt!.toLocal());
            final mStaff = raw.managerName ?? 'Manager';
            final mStatus = raw.isApproved == true ? 'Approved' : (raw.isRejected == true ? 'Rejected' : status);
            managerInfo = '$mStatus by $mStaff\n$mTime';
          } else if (raw.isApproved == true) {
            managerInfo = 'Approved';
          } else if (raw.isRejected == true) {
            managerInfo = 'Rejected${raw.rejectionReason != null && raw.rejectionReason.toString().isNotEmpty ? ' (${raw.rejectionReason})' : ''}';
          } else {
            managerInfo = status.toUpperCase();
          }
        } else if (r is Map) {
          final map = Map<String, dynamic>.from(r);
          billNo = '${map['order_number'] ?? map['bill_number'] ?? map['order_id'] ?? '-'}';
          final rawCreated = map['created_at'];
          if (rawCreated != null) {
            final dt = DateTime.tryParse('$rawCreated');
            if (dt != null) dateStr = DateFormat('yyyy-MM-dd HH:mm').format(dt.toLocal());
          }
          serverName = '${map['requested_by_name'] ?? map['requested_by'] ?? '-'}';

          // Extract all items from void_items or items array for whole bill voids
          final rawItems = map['void_items'] ?? map['items'] ?? map['items_voided'] ?? map['order_items'];
          if (rawItems is List && rawItems.isNotEmpty) {
            double totalQty = 0;
            final itemLines = <String>[];
            for (final it in rawItems) {
              if (it is Map) {
                final itMap = Map<String, dynamic>.from(it);
                final q = _asNum(itMap['quantity'] ?? itMap['qty'] ?? 1);
                totalQty += q;
                final qStr = q.toStringAsFixed(q % 1 == 0 ? 0 : 2);
                final name = '${itMap['name'] ?? itMap['item_name'] ?? itMap['title'] ?? 'Item'}'.trim();
                itemLines.add('$qStr x $name');
              } else if (it != null && it.toString().trim().isNotEmpty) {
                itemLines.add(it.toString().trim());
              }
            }

            if (itemLines.isNotEmpty) {
              if (itemLines.length <= 3) {
                itemName = itemLines.join('\n');
              } else {
                itemName = itemLines.join(', ');
              }
              if (totalQty > 0) {
                qtyStr = totalQty.toStringAsFixed(totalQty % 1 == 0 ? 0 : 2);
              } else {
                qtyStr = '${itemLines.length}';
              }
            }
          } else {
            final explicitName = map['item_name'] ?? map['title'];
            if (explicitName != null &&
                explicitName.toString().trim().isNotEmpty &&
                explicitName.toString().trim().toLowerCase() != 'pos bill') {
              itemName = explicitName.toString().trim();
            } else {
              itemName = 'Whole Bill (${billNo != '-' ? billNo : 'POS Order'})';
            }
            final q = _asNum(map['qty_to_void'] ?? 1);
            qtyStr = q.toStringAsFixed(q % 1 == 0 ? 0 : 2);
          }

          amount = _asNum(map['total_amount'] ?? map['amount'] ?? (map['qty_to_void'] != null ? _asNum(map['qty_to_void']) * _asNum(map['unit_price']) : 0.0));
          reason = '${map['reason'] ?? map['reason_category'] ?? '-'}';
          status = '${map['status'] ?? 'pending'}';

          // Kitchen
          final kTimeRaw = map['kitchen_acknowledged_at'];
          if (kTimeRaw != null) {
            final dt = DateTime.tryParse('$kTimeRaw');
            final kTime = dt != null ? DateFormat('MM-dd HH:mm').format(dt.toLocal()) : '$kTimeRaw';
            final kStaff = map['kitchen_name'] ?? 'Kitchen';
            kitchenInfo = 'Ack by $kStaff\n$kTime';
          } else {
            kitchenInfo = '-';
          }

          // Cashier
          final cTimeRaw = map['cashier_acknowledged_at'];
          if (cTimeRaw != null) {
            final dt = DateTime.tryParse('$cTimeRaw');
            final cTime = dt != null ? DateFormat('MM-dd HH:mm').format(dt.toLocal()) : '$cTimeRaw';
            final cStaff = map['cashier_name'] ?? 'Cashier';
            cashierInfo = 'Ack by $cStaff\n$cTime';
          } else {
            cashierInfo = '-';
          }

          // Manager
          final mTimeRaw = map['manager_reviewed_at'] ?? map['reviewed_at'];
          if (mTimeRaw != null) {
            final dt = DateTime.tryParse('$mTimeRaw');
            final mTime = dt != null ? DateFormat('MM-dd HH:mm').format(dt.toLocal()) : '$mTimeRaw';
            final mStaff = map['manager_name'] ?? map['reviewed_by_name'] ?? 'Manager';
            managerInfo = '${status.toUpperCase()} by $mStaff\n$mTime';
          } else {
            managerInfo = status.toUpperCase();
          }
        }
      } catch (_) {}

      totalAmount += amount;
      if (status == 'approved') {
        approvedCount++;
        approvedAmount += amount;
      } else if (status.contains('reject') || status.contains('decline')) {
        rejectedCount++;
      } else {
        pendingCount++;
      }

      tableRows.add([
        '${i + 1}',
        _cleanText(billNo),
        _cleanText(dateStr),
        _cleanText(serverName),
        _cleanText(itemName),
        qtyStr,
        amount > 0 ? money.format(amount) : '0.00',
        _cleanText(reason),
        _cleanText(kitchenInfo),
        _cleanText(cashierInfo),
        _cleanText(managerInfo),
      ]);
    }

    final kpis = [
      ReportKpi(
        label: 'TOTAL VOIDS',
        value: numFormat.format(totalCount),
        subtitle: 'All void requests',
      ),
      ReportKpi(
        label: 'TOTAL VALUE',
        value: 'KES ${money.format(totalAmount)}',
        subtitle: 'Gross void sum',
      ),
      ReportKpi(
        label: 'APPROVED',
        value: numFormat.format(approvedCount),
        subtitle: 'KES ${money.format(approvedAmount)}',
      ),
      ReportKpi(
        label: 'REJECTED / DECLINED',
        value: numFormat.format(rejectedCount),
        subtitle: 'Blocked voids',
      ),
      ReportKpi(
        label: 'PENDING / IN REVIEW',
        value: numFormat.format(pendingCount),
        subtitle: 'Awaiting action',
      ),
    ];

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4.landscape,
        maxPages: 10000,
        margin: const pw.EdgeInsets.symmetric(horizontal: 24, vertical: 22),
        build: (ctx) => [
          _buildBrandedHeader(
            title: _cleanText(title.toUpperCase()),
            subtitle: _cleanText(subtitle),
            branch: _cleanText(branch ?? 'Famous Gates Hotel & Grill'),
            dateRange: dateRange != null ? _cleanText(dateRange) : null,
            headerCategory: 'VOID AUDIT REPORT',
            logo: logoImage,
          ),
          _buildKpiRow(kpis),
          pw.SizedBox(height: 10),
          pw.TableHelper.fromTextArray(
            border: pw.TableBorder.all(color: borderGrey, width: 0.5),
            headers: const [
              '#',
              'BILL #',
              'DATE & TIME',
              'SERVER / WAITER',
              'ITEM VOIDED',
              'QTY',
              'AMOUNT (KES)',
              'REASON',
              'KITCHEN APPROVAL',
              'CASHIER APPROVAL',
              'FINAL STATUS',
            ],
            data: tableRows,
            headerStyle: pw.TextStyle(
              color: PdfColors.white,
              fontWeight: pw.FontWeight.bold,
              fontSize: 7,
            ),
            headerDecoration: const pw.BoxDecoration(color: secondaryNavy),
            cellStyle: const pw.TextStyle(fontSize: 7, color: textDark),
            cellHeight: 18,
            cellPadding: const pw.EdgeInsets.symmetric(horizontal: 3, vertical: 2.5),
            columnWidths: {
              0: const pw.FixedColumnWidth(16),
              1: const pw.FlexColumnWidth(1.3),
              2: const pw.FlexColumnWidth(1.3),
              3: const pw.FlexColumnWidth(1.5),
              4: const pw.FlexColumnWidth(2.0),
              5: const pw.FixedColumnWidth(22),
              6: const pw.FlexColumnWidth(1.3),
              7: const pw.FlexColumnWidth(1.5),
              8: const pw.FlexColumnWidth(1.5),
              9: const pw.FlexColumnWidth(1.5),
              10: const pw.FlexColumnWidth(1.4),
            },
            cellAlignments: {
              0: pw.Alignment.centerLeft,
              1: pw.Alignment.centerLeft,
              2: pw.Alignment.centerLeft,
              3: pw.Alignment.centerLeft,
              4: pw.Alignment.centerLeft,
              5: pw.Alignment.center,
              6: pw.Alignment.centerRight,
              7: pw.Alignment.centerLeft,
              8: pw.Alignment.centerLeft,
              9: pw.Alignment.centerLeft,
              10: pw.Alignment.centerLeft,
            },
          ),
          pw.SizedBox(height: 6),
          pw.Container(
            padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: const pw.BoxDecoration(
              color: softBg,
              border: pw.Border(left: pw.BorderSide(color: primaryNavy, width: 3)),
            ),
            child: pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text(
                  'TOTAL VOIDED VALUE ($totalCount ITEMS):',
                  style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8.5, color: primaryNavy),
                ),
                pw.Text(
                  'KES ${money.format(totalAmount)}',
                  style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9.5, color: primaryNavy),
                ),
              ],
            ),
          ),
          pw.SizedBox(height: 10),
          _buildSignatoryBlock(preparedBy: preparedBy),
        ],
        footer: (ctx) => _buildBrandedFooter(ctx),
      ),
    );

    await Printing.layoutPdf(
      onLayout: (PdfPageFormat format) async => doc.save(),
    );
  }

  // ── Footer Component ───────────────────────────────────────────────────────
  pw.Widget _buildBrandedFooter(pw.Context ctx) {
    return pw.Container(
      margin: const pw.EdgeInsets.only(top: 10),
      padding: const pw.EdgeInsets.only(top: 4),
      decoration: const pw.BoxDecoration(
        border: pw.Border(
          top: pw.BorderSide(color: borderGrey, width: 0.5),
        ),
      ),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(
            'FamousGate Hotels Management System  |  Central Store Console  |  Confidential',
            style: const pw.TextStyle(fontSize: 7, color: textMuted),
          ),
          pw.Text(
            'Page ${ctx.pageNumber} of ${ctx.pagesCount}',
            style: const pw.TextStyle(fontSize: 7, color: textMuted),
          ),
        ],
      ),
    );
  }

  String _cleanText(String text) {
    return text
        .replaceAll('•', '|')
        .replaceAll('—', '-')
        .replaceAll('–', '-')
        .replaceAll('…', '...')
        .replaceAll('“', '"')
        .replaceAll('”', '"')
        .replaceAll('’', "'")
        .replaceAll('‘', "'");
  }

  double _asNum(dynamic v) {
    if (v == null) return 0.0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0.0;
  }
}

class ReportSection {
  final String? title;
  final String? description;
  final List<String>? tableHeaders;
  final List<List<String>>? tableRows;
  final List<double>? columnWidths;
  final Map<int, pw.Alignment>? cellAlignments;
  final String? totalLabel;
  final String? totalValue;

  const ReportSection({
    this.title,
    this.description,
    this.tableHeaders,
    this.tableRows,
    this.columnWidths,
    this.cellAlignments,
    this.totalLabel,
    this.totalValue,
  });
}
