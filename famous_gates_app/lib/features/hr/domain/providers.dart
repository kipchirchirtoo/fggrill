import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';
import 'models.dart';

final staffListProvider =
    FutureProvider.family<List<StaffMember>, String?>((ref, search) async {
  final repo = ref.read(hrRepositoryProvider);
  return repo.getStaff(search: search);
});

final attendanceProvider = FutureProvider<List<AttendanceRecord>>((ref) async {
  final repo = ref.read(hrRepositoryProvider);
  return repo.getAttendance();
});

final leaveRequestsProvider =
    FutureProvider.family<List<LeaveRequest>, String?>((ref, status) async {
  final repo = ref.read(hrRepositoryProvider);
  return repo.getLeaveRequests(status: status);
});

final shiftSchedulesProvider = FutureProvider<List<ShiftSchedule>>((ref) async {
  final repo = ref.read(hrRepositoryProvider);
  return repo.getShifts();
});

final payrollProvider = FutureProvider<List<PayrollRecord>>((ref) async {
  final repo = ref.read(hrRepositoryProvider);
  return repo.getPayroll();
});

enum HrTab {
  overview,
  employees,
  attendance,
  attendanceLogs,
  staffAttendance,
  leave,
  shifts,
  payroll,
  salaries,
  salaryAdjustments,
  policies,
  performance,
  terminal,
  reports,
}

final hrTabProvider = StateProvider<HrTab>((ref) => HrTab.overview);

final performanceReviewsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String?>((ref, staffId) async {
  return ref.read(hrRepositoryProvider).getPerformanceReviews(staffId: staffId);
});

final salaryAdjustmentsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String?>((ref, status) async {
  return ref.read(hrRepositoryProvider).getSalaryAdjustments(status: status);
});

final hrReportsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(hrRepositoryProvider).getHRReports();
});

final payrollPoliciesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(hrRepositoryProvider).getPayrollPolicies();
});
