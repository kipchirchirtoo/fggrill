class Booking {
  const Booking({
    required this.id,
    this.guestId,
    this.roomId,
    this.guestName,
    this.guestPhone,
    this.guestEmail,
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
  final String? guestEmail;
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
      guestEmail:
          _string(json['guest_email'] ?? json['email'] ?? guest?['email']),
      roomNumber: _string(json['room_number'] ??
          json['roomNumber'] ??
          room?['room_number'] ??
          room?['number']),
      roomType: _extractTypeName(json['room_type'] ??
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

  // Convenience getters for additional properties from raw
  int get adults => _int(raw['adults']) ?? 1;
  int get children => _int(raw['children']) ?? 0;
  int get infants => _int(raw['infants']) ?? 0;
  String? get mealPlan => _string(raw['meal_plan'] ?? raw['mealPlan']);
  String? get bookingSource =>
      _string(raw['booking_source'] ?? raw['bookingSource']);
  String? get internalNotes =>
      _string(raw['internal_notes'] ?? raw['internalNotes']);
  double? get depositAmount =>
      _double(raw['deposit_amount'] ?? raw['depositAmount']);
  String? get paymentMethod =>
      _string(raw['payment_method'] ?? raw['paymentMethod']);
  double? get roomRate => _double(raw['room_rate'] ?? raw['roomRate']);
  double? get subtotal => _double(raw['subtotal']);
  double? get taxAmount => _double(raw['tax_amount'] ?? raw['taxAmount']);
  double? get serviceCharge =>
      _double(raw['service_charge'] ?? raw['serviceCharge']);

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
    this.roomNumber,
    this.type,
    this.floor,
    this.status = 'available',
    this.guestName,
    this.checkInDate,
    this.checkOutDate,
    this.pricePerNight,
    this.raw = const {},
  });

  final String id;
  final int number;
  final String? roomNumber;
  final String? type;
  final int? floor;
  final String status;
  final String? guestName;
  final DateTime? checkInDate;
  final DateTime? checkOutDate;
  final double? pricePerNight;
  final Map<String, dynamic> raw;

  factory Room.fromJson(Map<String, dynamic> json) {
    final room =
        json['room'] is Map ? Map<String, dynamic>.from(json['room']) : null;
    final rawRoomNumber = json['room_number'] ??
        json['roomNumber'] ??
        json['room_no'] ??
        json['name'] ??
        json['number'] ??
        room?['room_number'] ??
        room?['roomNumber'] ??
        room?['number'];
    final guestObj = json['guest'] is Map ? Map<String, dynamic>.from(json['guest']) : null;
    final parsedGuestName = _string(
      json['guest_name'] ??
      json['current_guest'] ??
      (guestObj != null ? _name(guestObj) : null)
    );
    return Room(
      id: '${json['id']}',
      number: _int(rawRoomNumber) ?? 0,
      roomNumber: _string(rawRoomNumber),
      type: _extractTypeName(json['room_type'] ?? json['type']),
      floor: _int(json['floor'] ?? json['floor_number']),
      status: '${json['status'] ?? 'available'}',
      guestName: parsedGuestName,
      checkInDate: _tryDate(json['check_in_date'] ?? json['checkInDate']),
      checkOutDate: _tryDate(json['check_out_date'] ?? json['checkOutDate']),
      pricePerNight: _double(
          json['price_per_night'] ?? json['rate'] ?? json['base_price']),
      raw: json,
    );
  }

  // Convenience getters
  int? get maxOccupancy => _int(raw['max_occupancy'] ?? raw['maxOccupancy']);
  bool? get isClean => raw['is_clean'] == true || raw['clean'] == true;
  String? get roomTypeId => _string(raw['room_type_id'] ?? raw['type_id']);
  String get displayNumber =>
      (roomNumber != null && roomNumber!.trim().isNotEmpty)
          ? roomNumber!.trim()
          : number.toString();
}

class Guest {
  const Guest({
    required this.id,
    required this.name,
    this.firstName,
    this.lastName,
    this.email,
    this.phone,
    this.idType,
    this.idNumber,
    this.carNumberPlate,
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
  final String? idType;
  final String? idNumber;
  final String? carNumberPlate;
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
      idType: _string(json['id_type'] ?? json['idType']),
      idNumber: _string(json['id_number'] ?? json['idNumber']),
      carNumberPlate: _string(json['car_number_plate'] ??
          json['carNumberPlate'] ??
          json['vehicle_plate'] ??
          json['vehiclePlate']),
      isVip: json['is_vip'] == true || json['vip'] == true,
      totalVisits: _int(json['total_visits'] ?? json['visits']),
      createdAt: _tryDate(json['created_at'] ?? json['createdAt']),
      raw: json,
    );
  }

  // Convenience getters
  String? get address => _string(raw['address']);
  String? get nationality => _string(raw['nationality']);
  String? get vipTier => _string(raw['vip_tier'] ?? raw['vipTier']);
  int? get loyaltyPoints => _int(raw['loyalty_points'] ?? raw['loyaltyPoints']);
  bool get blacklistStatus =>
      raw['blacklist_status'] == true || raw['blacklisted'] == true;
  String? get blacklistReason =>
      _string(raw['blacklist_reason'] ?? raw['blacklistReason']);
  String? get notes => _string(raw['notes']);
}

String? _string(dynamic value) {
  if (value == null) return null;
  final text = '$value';
  return text == 'null' ? null : text;
}

// Safely extract a type name — handles both plain strings and nested
// {id, name, ...} objects returned by joined Supabase queries.
String? _extractTypeName(dynamic value) {
  if (value == null) return null;
  if (value is Map) return _string(value['name'] ?? value['type_name'] ?? value['label']);
  return _string(value);
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
