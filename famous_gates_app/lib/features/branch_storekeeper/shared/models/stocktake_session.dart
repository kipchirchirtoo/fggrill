class StocktakeSession {
  const StocktakeSession({
    required this.shift,
    required this.stocktakeDate,
    required this.status,
    this.shiftId,
  });

  final String shift;
  final String stocktakeDate;
  final String status;
  final String? shiftId;

  factory StocktakeSession.fromMap(Map<String, dynamic> map) {
    return StocktakeSession(
      shift: '${map['shift'] ?? ''}',
      stocktakeDate: '${map['stocktake_date'] ?? map['date'] ?? ''}',
      status: '${map['status'] ?? ''}',
      shiftId: map['shift_id']?.toString(),
    );
  }
}
