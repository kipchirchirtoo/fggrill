import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';

final employeeDashboardProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final repo = ref.read(employeePortalRepositoryProvider);
  return repo.getDashboard();
});

final employeeSchedulesProvider =
    FutureProvider.family<List<Map<String, dynamic>>, Map<String, String?>>(
        (ref, range) async {
  final repo = ref.read(employeePortalRepositoryProvider);
  return repo.getSchedules(
    startDate: range['start_date'],
    endDate: range['end_date'],
  );
});

final employeeProfileProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.read(employeePortalRepositoryProvider).getProfile();
});

final employeeTimeClockProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(employeePortalRepositoryProvider).getTimeClock();
});

final employeeLeaveRequestsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(employeePortalRepositoryProvider).getLeaveRequests();
});

final employeeTasksProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(employeePortalRepositoryProvider).getTasks();
});

final employeeContentProvider =
    FutureProvider.autoDispose<Map<String, List<Map<String, dynamic>>>>(
        (ref) async {
  final repo = ref.read(employeePortalRepositoryProvider);
  final results = await Future.wait([
    repo.getPayslips(),
    repo.getDocuments(),
    repo.getAnnouncements(),
    repo.getTraining(),
    repo.getPerformance(),
  ]);
  return {
    'payslips': results[0],
    'documents': results[1],
    'announcements': results[2],
    'training': results[3],
    'performance': results[4],
  };
});
