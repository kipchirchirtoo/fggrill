class Booking {
  const Booking({
    required this.id,
    this.guestId,
    this.roomId,
    this.guestName,
    this.guestPhone,
    this.roomNumber,
    this.roomType,
    required this.checkIn,
    required this.checkOut,
    this.status = 'confirmed',
    this.totalAmount,
    this.amountPaid,
    this.confirmationNumber,
    this.specialRequests,
    this.createdAt,
    this.raw = const {},
  });

  final String id;
  final String? guestId;
  final String? roomId;
  final String? guestName;
  final String? guestPhone;
  final String? roomNumber;
  final String? roomType;
  final DateTime checkIn;
  final DateTime checkOut;
  final String status;
  final double? totalAmount;
  final double? amountPaid;
  final String? confirmationNumber;
  final String? specialRequests;
  final DateTime? createdAt;
  final Map<String, dynamic> raw;

  factory Booking.fromJson(Map<String, dynamic> json) {
    final guest =
        json['guest'] is Map ? Map<String, dynamic>.from(json['guest']) : null;
    final room =
        json['room'] is Map ? Map<String, dynamic>.from(json['room']) : null;
    return Booking(
      id: '${json['id']}',
      guestId: _string(json['guest_id'] ?? json['guestId'] ?? guest?['id']),
      roomId: _string(json['room_id'] ?? json['roomId'] ?? room?['id']),
      guestName: _string(json['guest_name'] ??
          json['guestName'] ??
          guest?['name'] ??
          guest?['full_name'] ??
          _name(guest)),
      guestPhone:
          _string(json['guest_phone'] ?? json['phone'] ?? guest?['phone']),
      roomNumber: _string(json['room_number'] ??
          json['roomNumber'] ??
          room?['room_number'] ??
          room?['number']),
      roomType: _string(json['room_type'] ??
          json['roomType'] ??
          room?['room_type'] ??
          room?['type']),
      checkIn: _date(json['check_in'] ??
          json['checkIn'] ??
          json['checkin_date'] ??
          json['check_in_date']),
      checkOut: _date(json['check_out'] ??
          json['checkOut'] ??
          json['checkout_date'] ??
          json['check_out_date']),
      status: '${json['status'] ?? 'confirmed'}',
      totalAmount: _double(json['total_amount'] ?? json['totalAmount']),
      amountPaid: _double(
          json['amount_paid'] ?? json['amountPaid'] ?? json['paid_amount']),
      confirmationNumber:
          _string(json['confirmation_number'] ?? json['booking_number']),
      specialRequests:
          _string(json['special_requests'] ?? json['specialRequests']),
      createdAt: _tryDate(json['created_at'] ?? json['createdAt']),
      raw: json,
    );
  }

  double get balance => (totalAmount ?? 0) - (amountPaid ?? 0);

  String get statusLabel {
    switch (status) {
      case 'confirmed':
        return 'Confirmed';
      case 'checked_in':
        return 'Checked In';
      case 'checked_out':
        return 'Checked Out';
      case 'cancelled':
        return 'Cancelled';
      case 'pending':
        return 'Pending';
      default:
        return status.replaceAll('_', ' ');
    }
  }
}

class Room {
  const Room({
    required this.id,
    required this.number,
    this.type,
    this.floor,
    this.status = 'available',
    this.guestName,
    this.checkOutDate,
    this.pricePerNight,
    this.raw = const {},
  });

  final String id;
  final int number;
  final String? type;
  final int? floor;
  final String status;
  final String? guestName;
  final DateTime? checkOutDate;
  final double? pricePerNight;
  final Map<String, dynamic> raw;

  factory Room.fromJson(Map<String, dynamic> json) {
    final type =
        json['type'] is Map ? Map<String, dynamic>.from(json['type']) : null;
    return Room(
      id: '${json['id']}',
      number: _int(json['number'] ?? json['room_number']) ?? 0,
      type: _string(json['room_type'] ?? json['type'] ?? type?['name']),
      floor: _int(json['floor']),
      status: '${json['status'] ?? 'available'}',
      guestName: _string(json['guest_name'] ?? json['current_guest']),
      checkOutDate: _tryDate(json['check_out_date'] ?? json['checkOutDate']),
      pricePerNight: _double(
          json['price_per_night'] ?? json['rate'] ?? json['base_price']),
      raw: json,
    );
  }
}

class Guest {
  const Guest({
    required this.id,
    required this.name,
    this.firstName,
    this.lastName,
    this.email,
    this.phone,
    this.idNumber,
    this.isVip = false,
    this.totalVisits,
    this.createdAt,
    this.raw = const {},
  });

  final String id;
  final String name;
  final String? firstName;
  final String? lastName;
  final String? email;
  final String? phone;
  final String? idNumber;
  final bool isVip;
  final int? totalVisits;
  final DateTime? createdAt;
  final Map<String, dynamic> raw;

  factory Guest.fromJson(Map<String, dynamic> json) {
    final first = _string(json['first_name'] ?? json['firstName']);
    final last = _string(json['last_name'] ?? json['lastName']);
    return Guest(
      id: '${json['id']}',
      name: _string(json['name'] ?? json['full_name']) ??
          [first, last]
              .where((part) => part != null && part.isNotEmpty)
              .join(' '),
      firstName: first,
      lastName: last,
      email: _string(json['email']),
      phone: _string(json['phone']),
      idNumber: _string(json['id_number'] ?? json['idNumber']),
      isVip: json['is_vip'] == true || json['vip'] == true,
      totalVisits: _int(json['total_visits'] ?? json['visits']),
      createdAt: _tryDate(json['created_at'] ?? json['createdAt']),
      raw: json,
    );
  }
}

String? _string(dynamic value) {
  if (value == null) return null;
  final text = '$value';
  return text == 'null' ? null : text;
}

String? _name(Map<String, dynamic>? json) {
  if (json == null) return null;
  return [_string(json['first_name']), _string(json['last_name'])]
      .where((part) => part != null && part.isNotEmpty)
      .join(' ');
}

DateTime _date(dynamic value) => _tryDate(value) ?? DateTime.now();

DateTime? _tryDate(dynamic value) {
  if (value == null) return null;
  return DateTime.tryParse('$value');
}

double? _double(dynamic value) {
  if (value is num) return value.toDouble();
  return double.tryParse('$value');
}

int? _int(dynamic value) {
  if (value is num) return value.toInt();
  return int.tryParse('$value');
}
