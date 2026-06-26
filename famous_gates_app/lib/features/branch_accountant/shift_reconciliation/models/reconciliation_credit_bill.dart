class ReconciliationCreditBill {
  final String id;
  final String? creditNumber;
  final String staffName;
  final String? employeeId;
  final String? department;
  final double amount;
  final double balance;
  final String status;
  final DateTime createdAt;

  ReconciliationCreditBill({
    required this.id,
    this.creditNumber,
    required this.staffName,
    this.employeeId,
    this.department,
    required this.amount,
    required this.balance,
    required this.status,
    required this.createdAt,
  });

  factory ReconciliationCreditBill.fromJson(Map<String, dynamic> json) {
    return ReconciliationCreditBill(
      id: json['id'] ?? '',
      creditNumber: json['credit_number'],
      staffName: json['staff_name'] ?? 'Staff',
      employeeId: json['employee_id'],
      department: json['department'],
      amount: (json['amount'] ?? 0).toDouble(),
      balance: (json['balance'] ?? 0).toDouble(),
      status: json['status'] ?? 'active',
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : DateTime.now(),
    );
  }
}
