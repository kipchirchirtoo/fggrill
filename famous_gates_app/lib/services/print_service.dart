import 'package:printing/printing.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

class PrintService {
  Future<void> printReceipt(Map<String, dynamic> orderData) async {
    final doc = pw.Document();

    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.roll80,
        build: (pw.Context context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.center,
            children: [
              pw.Text('FAMOUS GATES HOTEL', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 16)),
              pw.Text('Receipt #: ${orderData['receipt_no']}', style: const pw.TextStyle(fontSize: 10)),
              pw.Divider(),
              // Items list would go here
              pw.Text('TOTAL: KES ${orderData['total']}', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 14)),
              pw.Divider(),
              pw.Text('Thank you!', style: const pw.TextStyle(fontSize: 10)),
            ],
          );
        },
      ),
    );

    await Printing.layoutPdf(onLayout: (PdfPageFormat format) async => doc.save());
  }
}
