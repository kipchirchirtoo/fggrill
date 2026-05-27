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
    String receiptType = 'CASH RECEIPT',
    String? tableNumber,
    String? roomNumber,
    String? customerName,
    String? staffLabel,
    String? publicCode,
    String? barcodeValue,
  }) async {
    final doc = pw.Document();
    final money = NumberFormat('#,##0.00', 'en_KE');
    final dateStr = DateFormat('MM/dd/yyyy, hh:mm:ss a').format(sale.createdAt);

    final totalAmount = sale.total;
    final baseAmount = totalAmount > 0 ? totalAmount / 1.16 : 0;
    final taxAmount = totalAmount - baseAmount;

    pw.MemoryImage? logoImage;
    try {
      final logoBytes =
          await rootBundle.load('assets/frontend_public/fglogo.png');
      logoImage = pw.MemoryImage(logoBytes.buffer.asUint8List());
    } catch (_) {}

    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.roll80,
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
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text('Description',
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 8)),
                    pw.Text('Price',
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 8)),
                  ]),
              pw.SizedBox(height: 2),
              ...items.map((item) {
                final name = item.name.length > 25
                    ? '${item.name.substring(0, 22)}...'
                    : item.name;
                return pw.Padding(
                  padding: const pw.EdgeInsets.only(bottom: 1),
                  child: pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text('${item.qty}x $name',
                          style: const pw.TextStyle(fontSize: 8)),
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
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Text('TOTAL:',
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 11)),
                    pw.Text('KES ${money.format(totalAmount)}',
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 11)),
                  ]),
              pw.SizedBox(height: 6),
              _infoRow('Payment:', sale.paymentMethod.toUpperCase()),
              _infoRow('Paid:', 'KES ${money.format(totalAmount)}'),
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
                    width: 200,
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
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(label, style: const pw.TextStyle(fontSize: 8)),
          pw.Text(value, style: const pw.TextStyle(fontSize: 8)),
        ],
      ),
    );
  }

  pw.Widget _totalRow(String label, String value, double fontSize) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 1),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(label, style: pw.TextStyle(fontSize: fontSize)),
          pw.Text(value, style: pw.TextStyle(fontSize: fontSize)),
        ],
      ),
    );
  }
}
