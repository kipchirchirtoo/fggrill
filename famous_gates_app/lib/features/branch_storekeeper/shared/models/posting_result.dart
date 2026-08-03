import 'inventory_document_line.dart';
import 'inventory_document_summary.dart';

class PostingResult {
  const PostingResult({
    required this.document,
    required this.lines,
    this.idempotentReplay = false,
  });

  final InventoryDocumentSummary document;
  final List<InventoryDocumentLine> lines;
  final bool idempotentReplay;

  factory PostingResult.fromMap(Map<String, dynamic> map) {
    final docMap = Map<String, dynamic>.from(
      (map['document'] as Map?) ?? map,
    );
    final lineList = ((map['lines'] as List?) ?? const [])
        .whereType<Map>()
        .map((row) => InventoryDocumentLine.fromMap(Map<String, dynamic>.from(row)))
        .toList();
    return PostingResult(
      document: InventoryDocumentSummary.fromMap(docMap),
      lines: lineList,
      idempotentReplay: map['idempotentReplay'] == true ||
          map['idempotent_replay'] == true,
    );
  }
}
