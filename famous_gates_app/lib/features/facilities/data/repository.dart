import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';

final facilitiesRepositoryProvider = Provider<FacilitiesRepository>((ref) {
  return FacilitiesRepository(ref.read(dioProvider));
});

class FacilitiesRepository {
  final Dio _dio;
  FacilitiesRepository(this._dio);

  Future<Map<String, dynamic>> getDashboard() async {
    final res = await _dio.get('/facilities/dashboard');
    final data = res.data;
    return data is Map<String, dynamic>
        ? data
        : (data is Map ? Map<String, dynamic>.from(data) : {});
  }

  Future<List<Map<String, dynamic>>> getRooms() async {
    final res = await _dio.get('/facilities/rooms');
    final data = res.data;
    final list =
        data is List ? data : (data is Map ? (data['data'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<List<Map<String, dynamic>>> getHousekeepingTasks() async {
    return _getList('/facilities/housekeeping/tasks');
  }

  Future<List<Map<String, dynamic>>> getInspections() async =>
      _getList('/facilities/housekeeping/inspections');
  Future<List<Map<String, dynamic>>> getLostFound() async =>
      _getList('/facilities/housekeeping/lost-found');
  Future<List<Map<String, dynamic>>> getWorkOrders() async =>
      _getList('/facilities/maintenance/work-orders');
  Future<List<Map<String, dynamic>>> getAssets() async =>
      _getList('/facilities/maintenance/assets');
  Future<List<Map<String, dynamic>>> getSchedule() async =>
      _getList('/facilities/maintenance/schedule');
  Future<List<Map<String, dynamic>>> getStaff() async =>
      _getList('/facilities/staff');
  Future<List<Map<String, dynamic>>> getInventory() async =>
      _getList('/facilities/inventory');

  Future<List<Map<String, dynamic>>> _getList(String path) async {
    final res = await _dio.get(path);
    final data = res.data;
    final list = data is List
        ? data
        : (data is Map ? (data['data'] ?? data['items'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
}
