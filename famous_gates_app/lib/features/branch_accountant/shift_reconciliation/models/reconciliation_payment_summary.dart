class ReconciliationPaymentSummary {
  final String method;
  final double amount;
  final int count;

  ReconciliationPaymentSummary({
    required this.method,
    required this.amount,
    required this.count,
  });

  factory ReconciliationPaymentSummary.fromJson(Map<String, dynamic> json) {
    return ReconciliationPaymentSummary(
      method: json['method'] ?? json['payment_method'] ?? '',
      amount: (json['amount'] ?? 0).toDouble(),
      count: json['count'] ?? 0,
    );
  }
}
