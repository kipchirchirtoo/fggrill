class InventoryExceptionView {
  const InventoryExceptionView({
    required this.code,
    required this.message,
    required this.status,
    this.documentId,
    this.severity,
  });

  final String code;
  final String message;
  final String status;
  final String? documentId;
  final String? severity;

  factory InventoryExceptionView.fromMap(Map<String, dynamic> map) {
    return InventoryExceptionView(
      code: '${map['exception_code'] ?? map['code'] ?? ''}',
      message: '${map['message'] ?? ''}',
      status: '${map['status'] ?? ''}',
      documentId: map['document_id']?.toString(),
      severity: map['severity']?.toString(),
    );
  }
}
