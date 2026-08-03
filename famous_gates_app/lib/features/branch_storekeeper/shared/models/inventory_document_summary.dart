class InventoryDocumentSummary {
  const InventoryDocumentSummary({
    required this.documentId,
    required this.documentNumber,
    required this.documentType,
    required this.postingStatus,
    this.postedAt,
    this.reversalOfDocumentId,
  });

  final String documentId;
  final String documentNumber;
  final String documentType;
  final String postingStatus;
  final String? postedAt;
  final String? reversalOfDocumentId;

  factory InventoryDocumentSummary.fromMap(Map<String, dynamic> map) {
    return InventoryDocumentSummary(
      documentId: '${map['document_id'] ?? map['id'] ?? ''}',
      documentNumber: '${map['document_number'] ?? ''}',
      documentType: '${map['document_type'] ?? ''}',
      postingStatus: '${map['posting_status'] ?? map['status'] ?? ''}',
      postedAt: map['posted_at']?.toString(),
      reversalOfDocumentId: map['reversal_of_document_id']?.toString(),
    );
  }
}
