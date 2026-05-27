class FinanceOverview {
  final double totalRevenue;
  final double totalExpenses;
  final double netProfit;
  final int pendingInvoices;
  final int unpaidBills;
  final double cashBalance;

  const FinanceOverview({
    this.totalRevenue = 0,
    this.totalExpenses = 0,
    this.netProfit = 0,
    this.pendingInvoices = 0,
    this.unpaidBills = 0,
    this.cashBalance = 0,
  });

  factory FinanceOverview.fromJson(Map<String, dynamic> json) {
    return FinanceOverview(
      totalRevenue: (json['total_revenue'] ?? json['revenue'] ?? 0).toDouble(),
      totalExpenses:
          (json['total_expenses'] ?? json['expenses'] ?? 0).toDouble(),
      netProfit: (json['net_profit'] ?? json['profit'] ?? 0).toDouble(),
      pendingInvoices:
          (json['pending_invoices'] ?? json['pending'] ?? 0).toInt(),
      unpaidBills: (json['unpaid_bills'] ?? 0).toInt(),
      cashBalance: (json['cash_balance'] ?? json['balance'] ?? 0).toDouble(),
    );
  }
}

class Invoice {
  final String id;
  final String? invoiceNumber;
  final String? customerName;
  final double amount;
  final double? paidAmount;
  final String status;
  final DateTime? createdAt;

  const Invoice({
    required this.id,
    this.invoiceNumber,
    this.customerName,
    this.amount = 0,
    this.paidAmount,
    this.status = 'pending',
    this.createdAt,
  });

  factory Invoice.fromJson(Map<String, dynamic> json) {
    return Invoice(
      id: '${json['id']}',
      invoiceNumber:
          json['invoice_number'] as String? ?? json['number'] as String?,
      customerName:
          json['customer_name'] as String? ?? json['customer'] as String?,
      amount: (json['amount'] ?? json['total'] ?? 0).toDouble(),
      paidAmount: (json['paid_amount'] as num?)?.toDouble(),
      status: '${json['status'] ?? 'pending'}',
      createdAt:
          DateTime.tryParse('${json['created_at'] ?? json['date'] ?? ''}'),
    );
  }
}

class Bill {
  final String id;
  final String? billNumber;
  final String? vendorName;
  final double amount;
  final String status;
  final DateTime? dueDate;

  const Bill({
    required this.id,
    this.billNumber,
    this.vendorName,
    this.amount = 0,
    this.status = 'pending',
    this.dueDate,
  });

  factory Bill.fromJson(Map<String, dynamic> json) {
    return Bill(
      id: '${json['id']}',
      billNumber: json['bill_number'] as String? ?? json['number'] as String?,
      vendorName: json['vendor_name'] as String? ??
          json['vendor'] as String? ??
          json['supplier_name'] as String?,
      amount: (json['amount'] ?? json['total'] ?? 0).toDouble(),
      status: '${json['status'] ?? 'pending'}',
      dueDate: DateTime.tryParse('${json['due_date'] ?? json['date'] ?? ''}'),
    );
  }
}

class PaymentVerification {
  final String id;
  final String? transactionRef;
  final String? paymentMethod;
  final double amount;
  final String status;
  final String? verifiedBy;
  final DateTime? createdAt;

  const PaymentVerification({
    required this.id,
    this.transactionRef,
    this.paymentMethod,
    this.amount = 0,
    this.status = 'pending',
    this.verifiedBy,
    this.createdAt,
  });

  factory PaymentVerification.fromJson(Map<String, dynamic> json) {
    return PaymentVerification(
      id: '${json['id']}',
      transactionRef:
          json['transaction_ref'] as String? ?? json['reference'] as String?,
      paymentMethod:
          json['payment_method'] as String? ?? json['method'] as String?,
      amount: (json['amount'] ?? 0).toDouble(),
      status: '${json['status'] ?? 'pending'}',
      verifiedBy: json['verified_by'] as String?,
      createdAt:
          DateTime.tryParse('${json['created_at'] ?? json['date'] ?? ''}'),
    );
  }
}

class PettyCashTransaction {
  final String id;
  final String? description;
  final double amount;
  final String status;
  final String? requestedBy;
  final DateTime? createdAt;

  const PettyCashTransaction({
    required this.id,
    this.description,
    this.amount = 0,
    this.status = 'pending',
    this.requestedBy,
    this.createdAt,
  });

  factory PettyCashTransaction.fromJson(Map<String, dynamic> json) {
    return PettyCashTransaction(
      id: '${json['id']}',
      description: json['description'] as String? ?? json['remarks'] as String?,
      amount: (json['amount'] ?? 0).toDouble(),
      status: '${json['status'] ?? 'pending'}',
      requestedBy: json['requested_by'] as String? ?? json['user'] as String?,
      createdAt:
          DateTime.tryParse('${json['created_at'] ?? json['date'] ?? ''}'),
    );
  }
}

class BankAccount {
  final String id;
  final String? accountName;
  final String? accountNumber;
  final String? bankName;
  final double balance;

  const BankAccount({
    required this.id,
    this.accountName,
    this.accountNumber,
    this.bankName,
    this.balance = 0,
  });

  factory BankAccount.fromJson(Map<String, dynamic> json) {
    return BankAccount(
      id: '${json['id']}',
      accountName: json['account_name'] as String? ?? json['name'] as String?,
      accountNumber: json['account_number'] as String?,
      bankName: json['bank_name'] as String? ?? json['bank'] as String?,
      balance: (json['balance'] ?? 0).toDouble(),
    );
  }
}

class BankingRecord {
  final String id;
  final String type;
  final double amount;
  final String? description;
  final DateTime? date;
  final String? reference;

  const BankingRecord({
    required this.id,
    this.type = 'Deposit',
    this.amount = 0,
    this.description,
    this.date,
    this.reference,
  });

  factory BankingRecord.fromJson(Map<String, dynamic> json) {
    return BankingRecord(
      id: '${json['id']}',
      type: json['type'] as String? ??
          json['transaction_type'] as String? ??
          'Deposit',
      amount: (json['amount'] ?? 0).toDouble(),
      description: json['description'] as String? ?? json['remarks'] as String?,
      date: DateTime.tryParse('${json['date'] ?? json['created_at'] ?? ''}'),
      reference: json['reference'] as String? ?? json['ref'] as String?,
    );
  }
}

class ShiftPnL {
  final String id;
  final DateTime? shiftDate;
  final double revenue;
  final double expenses;
  final double net;
  final String? staffName;

  const ShiftPnL({
    required this.id,
    this.shiftDate,
    this.revenue = 0,
    this.expenses = 0,
    this.net = 0,
    this.staffName,
  });

  factory ShiftPnL.fromJson(Map<String, dynamic> json) {
    return ShiftPnL(
      id: '${json['id']}',
      shiftDate:
          DateTime.tryParse('${json['shift_date'] ?? json['date'] ?? ''}'),
      revenue: (json['revenue'] ?? json['total_revenue'] ?? 0).toDouble(),
      expenses: (json['expenses'] ?? json['total_expenses'] ?? 0).toDouble(),
      net: (json['net'] ?? json['net_profit'] ?? 0).toDouble(),
      staffName: json['staff_name'] as String? ?? json['cashier'] as String?,
    );
  }
}

class CreditBill {
  final String id;
  final String? customerName;
  final double amount;
  final String status;
  final DateTime? dueDate;

  const CreditBill({
    required this.id,
    this.customerName,
    this.amount = 0,
    this.status = 'pending',
    this.dueDate,
  });

  factory CreditBill.fromJson(Map<String, dynamic> json) {
    return CreditBill(
      id: '${json['id']}',
      customerName:
          json['customer_name'] as String? ?? json['customer'] as String?,
      amount: (json['amount'] ?? json['total'] ?? 0).toDouble(),
      status: '${json['status'] ?? 'pending'}',
      dueDate: DateTime.tryParse('${json['due_date'] ?? json['date'] ?? ''}'),
    );
  }
}

class Buffet {
  final String id;
  final String? name;
  final DateTime? date;
  final double price;
  final int guestCount;
  final double total;

  const Buffet({
    required this.id,
    this.name,
    this.date,
    this.price = 0,
    this.guestCount = 0,
    this.total = 0,
  });

  factory Buffet.fromJson(Map<String, dynamic> json) {
    return Buffet(
      id: '${json['id']}',
      name: json['name'] as String? ?? json['buffet_name'] as String?,
      date: DateTime.tryParse('${json['date'] ?? json['event_date'] ?? ''}'),
      price: (json['price'] ?? json['per_head_price'] ?? 0).toDouble(),
      guestCount: (json['guest_count'] ?? json['guests'] ?? 0).toInt(),
      total: (json['total'] ?? json['total_amount'] ?? 0).toDouble(),
    );
  }
}

class CateringBooking {
  final String id;
  final String? clientName;
  final DateTime? eventDate;
  final String? eventType;
  final int guestCount;
  final double total;
  final String status;

  const CateringBooking({
    required this.id,
    this.clientName,
    this.eventDate,
    this.eventType,
    this.guestCount = 0,
    this.total = 0,
    this.status = 'pending',
  });

  factory CateringBooking.fromJson(Map<String, dynamic> json) {
    return CateringBooking(
      id: '${json['id']}',
      clientName: json['client_name'] as String? ?? json['client'] as String?,
      eventDate:
          DateTime.tryParse('${json['event_date'] ?? json['date'] ?? ''}'),
      eventType: json['event_type'] as String? ?? json['type'] as String?,
      guestCount: (json['guest_count'] ?? json['guests'] ?? 0).toInt(),
      total: (json['total'] ?? json['total_amount'] ?? 0).toDouble(),
      status: '${json['status'] ?? 'pending'}',
    );
  }
}

class PettyCashEntry {
  final String id;
  final double amount;
  final String? purpose;
  final String? approvedBy;
  final DateTime? date;

  const PettyCashEntry({
    required this.id,
    this.amount = 0,
    this.purpose,
    this.approvedBy,
    this.date,
  });

  factory PettyCashEntry.fromJson(Map<String, dynamic> json) {
    return PettyCashEntry(
      id: '${json['id']}',
      amount: (json['amount'] ?? 0).toDouble(),
      purpose: json['purpose'] as String? ?? json['description'] as String?,
      approvedBy: json['approved_by'] as String? ?? json['approver'] as String?,
      date: DateTime.tryParse('${json['date'] ?? json['created_at'] ?? ''}'),
    );
  }
}

class CashierClearance {
  final String id;
  final String? cashierName;
  final String? shift;
  final double openingBalance;
  final double closingBalance;
  final double variance;
  final String status;

  const CashierClearance({
    required this.id,
    this.cashierName,
    this.shift,
    this.openingBalance = 0,
    this.closingBalance = 0,
    this.variance = 0,
    this.status = 'pending',
  });

  factory CashierClearance.fromJson(Map<String, dynamic> json) {
    return CashierClearance(
      id: '${json['id']}',
      cashierName:
          json['cashier_name'] as String? ?? json['cashier'] as String?,
      shift: json['shift'] as String? ?? json['shift_name'] as String?,
      openingBalance: (json['opening_balance'] ?? 0).toDouble(),
      closingBalance: (json['closing_balance'] ?? 0).toDouble(),
      variance: (json['variance'] ?? 0).toDouble(),
      status: '${json['status'] ?? 'pending'}',
    );
  }
}

class Purchase {
  final String id;
  final String? description;
  final String? supplier;
  final int quantity;
  final String? unit;
  final double estimatedCost;
  final String status;

  const Purchase({
    required this.id,
    this.description,
    this.supplier,
    this.quantity = 0,
    this.unit,
    this.estimatedCost = 0,
    this.status = 'pending',
  });

  factory Purchase.fromJson(Map<String, dynamic> json) {
    return Purchase(
      id: '${json['id']}',
      description: json['description'] as String? ?? json['item'] as String?,
      supplier: json['supplier'] as String? ?? json['vendor'] as String?,
      quantity: (json['quantity'] ?? json['qty'] ?? 0).toInt(),
      unit: json['unit'] as String?,
      estimatedCost:
          (json['estimated_cost'] ?? json['cost'] ?? json['amount'] ?? 0)
              .toDouble(),
      status: '${json['status'] ?? 'pending'}',
    );
  }
}

class BookingInvoice {
  final String id;
  final String? guestName;
  final DateTime? checkIn;
  final DateTime? checkOut;
  final String? invoiceNumber;
  final double amount;
  final String status;

  const BookingInvoice({
    required this.id,
    this.guestName,
    this.checkIn,
    this.checkOut,
    this.invoiceNumber,
    this.amount = 0,
    this.status = 'pending',
  });

  factory BookingInvoice.fromJson(Map<String, dynamic> json) {
    return BookingInvoice(
      id: '${json['id']}',
      guestName: json['guest_name'] as String? ??
          json['customer_name'] as String? ??
          json['guest'] as String?,
      checkIn:
          DateTime.tryParse('${json['check_in'] ?? json['checkin'] ?? ''}'),
      checkOut:
          DateTime.tryParse('${json['check_out'] ?? json['checkout'] ?? ''}'),
      invoiceNumber:
          json['invoice_number'] as String? ?? json['invoice_no'] as String?,
      amount: (json['amount'] ?? json['total'] ?? json['total_amount'] ?? 0)
          .toDouble(),
      status: '${json['status'] ?? 'pending'}',
    );
  }
}
