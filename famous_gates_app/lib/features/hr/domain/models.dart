class StaffMember {
  final String id;
  final String name;
  final String? email;
  final String? phone;
  final String? role;
  final String? department;
  final String? firstName;
  final String? lastName;
  final String? nationalId;
  final String? position;
  final String? shift;
  final num? basicSalary;
  final String? employeeId;
  final bool nssfEnabled;
  final bool shifEnabled;
  final bool uniformEnabled;
  final bool housingFundEnabled;
  final String? branchName;
  final String? photoUrl;
  final String? bankName;
  final String? accountNumber;
  final bool isActive;

  const StaffMember({
    required this.id,
    required this.name,
    this.email,
    this.phone,
    this.role,
    this.department,
    this.firstName,
    this.lastName,
    this.nationalId,
    this.position,
    this.shift,
    this.basicSalary,
    this.employeeId,
    this.nssfEnabled = true,
    this.shifEnabled = true,
    this.uniformEnabled = false,
    this.housingFundEnabled = true,
    this.branchName,
    this.photoUrl,
    this.bankName,
    this.accountNumber,
    this.isActive = true,
  });

  factory StaffMember.fromJson(Map<String, dynamic> json) {
    final linkedUser = json['user'];
    final userData = json['user_data'];
    Map<String, dynamic> data;
    if (linkedUser is Map) {
      data = Map<String, dynamic>.from(linkedUser);
      data.addAll(json);
    } else if (userData is Map) {
      data = Map<String, dynamic>.from(userData);
      data.addAll(json);
    } else {
      data = Map<String, dynamic>.from(json);
    }
    final composedName =
        '${data['first_name'] ?? ''} ${data['last_name'] ?? ''}'.trim();
    final staffId = json['staff_profile_id'] ??
        json['staff_id'] ??
        json['profile_id'] ??
        json['id'];
    final employeeCode = data['employee_id'] ??
        data['employee_number'] ??
        data['staff_number'] ??
        data['id_number'];
    return StaffMember(
      id: '$staffId',
      name:
          '${data['full_name'] ?? data['name'] ?? (composedName.isEmpty ? null : composedName) ?? data['username'] ?? ''}',
      email: data['email'] as String?,
      phone: data['phone'] as String? ?? data['phone_number'] as String?,
      role: '${data['role'] ?? data['position'] ?? ''}',
      department:
          data['department'] as String? ?? json['department'] as String?,
      firstName: data['first_name'] as String?,
      lastName: data['last_name'] as String?,
      nationalId:
          data['national_id'] as String? ?? data['id_number'] as String?,
      position: data['position'] as String?,
      shift: data['shift'] as String?,
      basicSalary: data['basic_salary'] is num
          ? data['basic_salary'] as num
          : data['salary'] is num
              ? data['salary'] as num
              : num.tryParse('${data['basic_salary'] ?? data['salary'] ?? ''}'),
      employeeId: employeeCode == null ? null : '$employeeCode',
      nssfEnabled:
          data['nssf_enabled'] != false && data['nssf_enabled'] != 'false',
      shifEnabled:
          data['shif_enabled'] != false && data['shif_enabled'] != 'false',
      uniformEnabled:
          data['uniform_enabled'] == true || data['uniform_enabled'] == 'true',
      housingFundEnabled: data['housing_fund_enabled'] != false &&
          data['housing_fund_enabled'] != 'false',
      branchName:
          data['branch_name'] as String? ?? json['branch_name'] as String?,
      photoUrl: data['photo_url'] as String? ??
          data['profile_photo'] as String? ??
          data['avatar'] as String?,
      bankName: data['bank_name'] as String?,
      accountNumber: data['account_number'] as String?,
      isActive: data['is_active'] != false && data['status'] != 'archived',
    );
  }
}

class AttendanceRecord {
  final String id;
  final String? staffName;
  final DateTime? clockIn;
  final DateTime? clockOut;
  final String? status;
  final double? hoursWorked;

  const AttendanceRecord({
    required this.id,
    this.staffName,
    this.clockIn,
    this.clockOut,
    this.status,
    this.hoursWorked,
  });

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    return AttendanceRecord(
      id: '${json['id']}',
      staffName: json['staff_name'] as String? ?? json['name'] as String?,
      clockIn:
          DateTime.tryParse('${json['clock_in'] ?? json['check_in'] ?? ''}'),
      clockOut:
          DateTime.tryParse('${json['clock_out'] ?? json['check_out'] ?? ''}'),
      status: '${json['status'] ?? 'present'}',
      hoursWorked: (json['hours_worked'] as num?)?.toDouble(),
    );
  }
}

class LeaveRequest {
  final String id;
  final String? staffName;
  final String? employeeId;
  final String? leaveType;
  final DateTime? startDate;
  final DateTime? endDate;
  final String status;
  final String? reason;
  final bool reportedToDuty;

  const LeaveRequest({
    required this.id,
    this.staffName,
    this.employeeId,
    this.leaveType,
    this.startDate,
    this.endDate,
    this.status = 'pending',
    this.reason,
    this.reportedToDuty = false,
  });

  factory LeaveRequest.fromJson(Map<String, dynamic> json) {
    final staff = json['staff'];
    final staffData =
        staff is Map ? Map<String, dynamic>.from(staff) : <String, dynamic>{};
    final user = staffData['user'];
    final userData =
        user is Map ? Map<String, dynamic>.from(user) : <String, dynamic>{};
    final staffName = json['staff_name'] ??
        json['name'] ??
        staffData['full_name'] ??
        staffData['name'] ??
        [
          staffData['first_name'] ?? userData['first_name'],
          staffData['last_name'] ?? userData['last_name'],
        ]
            .where((part) => part != null && '$part'.trim().isNotEmpty)
            .map((part) => '$part'.trim())
            .join(' ');
    return LeaveRequest(
      id: '${json['id']}',
      staffName: '$staffName'.trim().isEmpty ? null : '$staffName',
      employeeId: json['employee_id'] as String? ??
          json['id_number'] as String? ??
          staffData['id_number'] as String? ??
          staffData['employee_id'] as String? ??
          staffData['national_id'] as String?,
      leaveType: json['leave_type'] as String? ?? json['type'] as String?,
      startDate: DateTime.tryParse('${json['start_date'] ?? ''}'),
      endDate: DateTime.tryParse('${json['end_date'] ?? ''}'),
      status: '${json['status'] ?? 'pending'}',
      reason: json['reason'] as String?,
      reportedToDuty: json['reported_to_duty'] == true ||
          json['reported_to_duty'] == 'true',
    );
  }
}

class ShiftSchedule {
  final String id;
  final String? staffName;
  final String? shiftType;
  final DateTime? date;
  final String? startTime;
  final String? endTime;

  const ShiftSchedule({
    required this.id,
    this.staffName,
    this.shiftType,
    this.date,
    this.startTime,
    this.endTime,
  });

  factory ShiftSchedule.fromJson(Map<String, dynamic> json) {
    return ShiftSchedule(
      id: '${json['id']}',
      staffName: json['staff_name'] as String? ?? json['name'] as String?,
      shiftType: json['shift_type'] as String? ?? json['type'] as String?,
      date: DateTime.tryParse('${json['date'] ?? json['shift_date'] ?? ''}'),
      startTime: json['start_time'] as String?,
      endTime: json['end_time'] as String?,
    );
  }
}

class PayrollRecord {
  final String id;
  final String? staffName;
  final String? payPeriod;
  final double? grossSalary;
  final double? netSalary;
  final double? deductions;
  final String? status;

  const PayrollRecord({
    required this.id,
    this.staffName,
    this.payPeriod,
    this.grossSalary,
    this.netSalary,
    this.deductions,
    this.status,
  });

  factory PayrollRecord.fromJson(Map<String, dynamic> json) {
    return PayrollRecord(
      id: '${json['id']}',
      staffName: json['staff_name'] as String? ?? json['name'] as String?,
      payPeriod: json['pay_period'] as String? ?? json['period'] as String?,
      grossSalary: (json['gross_salary'] ?? json['gross'] as num?)?.toDouble(),
      netSalary: (json['net_salary'] ?? json['net'] as num?)?.toDouble(),
      deductions: (json['deductions'] as num?)?.toDouble(),
      status: json['status'] as String?,
    );
  }
}
