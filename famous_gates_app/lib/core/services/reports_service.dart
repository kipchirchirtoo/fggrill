import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final reportsServiceProvider = Provider<ReportsService>((ref) {
  return ReportsService(ref.watch(dioProvider));
});

class ReportsService extends BaseApiService {
  ReportsService(super.dio);

  // ==================== GENERAL REPORTS ====================

  // GET /api/reports
  Future<Map<String, dynamic>> getReports({
    String? type,
    String? category,
    String? startDate,
    String? endDate,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (type != null) 'type': type,
      if (category != null) 'category': category,
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response =
        await get<Map<String, dynamic>>('/reports', queryParameters: query);
    return response;
  }

  // GET /api/reports/:id
  Future<Map<String, dynamic>> getReport(String id) async {
    final response = await get<Map<String, dynamic>>('/reports/$id');
    return response;
  }

  // POST /api/reports/generate
  Future<Map<String, dynamic>> generateReport(
      Map<String, dynamic> params) async {
    final response =
        await post<Map<String, dynamic>>('/reports/generate', data: params);
    return response;
  }

  // GET /api/reports/:id/download
  Future<Map<String, dynamic>> downloadReport(String id,
      {String? format}) async {
    final query = {if (format != null) 'format': format};
    final response = await get<Map<String, dynamic>>('/reports/$id/download',
        queryParameters: query);
    return response;
  }

  // ==================== REVENUE REPORTS ====================

  // GET /api/reports/revenue
  Future<Map<String, dynamic>> getRevenueReport({
    String? period,
    String? groupBy,
    int? branchId,
  }) async {
    final query = {
      if (period != null) 'period': period,
      if (groupBy != null) 'groupBy': groupBy,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/reports/revenue',
        queryParameters: query);
    return response;
  }

  // GET /api/reports/revenue/daily
  Future<Map<String, dynamic>> getDailyRevenue(
      {String? date, int? branchId}) async {
    final query = {
      if (date != null) 'date': date,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/reports/revenue/daily',
        queryParameters: query);
    return response;
  }

  // GET /api/reports/revenue/monthly
  Future<Map<String, dynamic>> getMonthlyRevenue(
      {String? month, int? branchId}) async {
    final query = {
      if (month != null) 'month': month,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/reports/revenue/monthly',
        queryParameters: query);
    return response;
  }

  // ==================== OCCUPANCY REPORTS ====================

  // GET /api/reports/occupancy
  Future<Map<String, dynamic>> getOccupancyReport({
    String? period,
    String? groupBy,
    int? branchId,
  }) async {
    final query = {
      if (period != null) 'period': period,
      if (groupBy != null) 'groupBy': groupBy,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/reports/occupancy',
        queryParameters: query);
    return response;
  }

  // GET /api/reports/occupancy/daily
  Future<Map<String, dynamic>> getDailyOccupancy(
      {String? date, int? branchId}) async {
    final query = {
      if (date != null) 'date': date,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/reports/occupancy/daily',
        queryParameters: query);
    return response;
  }

  // ==================== FINANCIAL REPORTS ====================

  // GET /api/reports/financial
  Future<Map<String, dynamic>> getFinancialReport({
    String? type,
    String? period,
    int? branchId,
  }) async {
    final query = {
      if (type != null) 'type': type,
      if (period != null) 'period': period,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/reports/financial',
        queryParameters: query);
    return response;
  }

  // GET /api/reports/financial/pnl
  Future<Map<String, dynamic>> getPnLReport({
    String? startDate,
    String? endDate,
    int? branchId,
  }) async {
    final query = {
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/reports/financial/pnl',
        queryParameters: query);
    return response;
  }

  // ==================== INVENTORY REPORTS ====================

  // GET /api/reports/inventory
  Future<Map<String, dynamic>> getInventoryReport({
    String? type,
    String? category,
    int? branchId,
  }) async {
    final query = {
      if (type != null) 'type': type,
      if (category != null) 'category': category,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/reports/inventory',
        queryParameters: query);
    return response;
  }

  // GET /api/reports/inventory/valuation
  Future<Map<String, dynamic>> getInventoryValuation({int? branchId}) async {
    final query = {if (branchId != null) 'branchId': branchId};
    final response = await get<Map<String, dynamic>>(
        '/reports/inventory/valuation',
        queryParameters: query);
    return response;
  }

  // GET /api/reports/inventory/movement
  Future<Map<String, dynamic>> getInventoryMovement({
    String? startDate,
    String? endDate,
    int? branchId,
  }) async {
    final query = {
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>(
        '/reports/inventory/movement',
        queryParameters: query);
    return response;
  }

  // ==================== STAFF REPORTS ====================

  // GET /api/reports/staff
  Future<Map<String, dynamic>> getStaffReport({
    String? type,
    String? period,
    int? branchId,
  }) async {
    final query = {
      if (type != null) 'type': type,
      if (period != null) 'period': period,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/reports/staff',
        queryParameters: query);
    return response;
  }

  // GET /api/reports/staff/attendance
  Future<Map<String, dynamic>> getStaffAttendanceReport({
    String? startDate,
    String? endDate,
    int? branchId,
  }) async {
    final query = {
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>(
        '/reports/staff/attendance',
        queryParameters: query);
    return response;
  }

  // GET /api/reports/staff/performance
  Future<Map<String, dynamic>> getStaffPerformanceReport({
    String? period,
    int? branchId,
  }) async {
    final query = {
      if (period != null) 'period': period,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>(
        '/reports/staff/performance',
        queryParameters: query);
    return response;
  }

  // ==================== BRANCH ANALYTICS ====================

  // GET /api/branch-analytics
  Future<Map<String, dynamic>> getBranchAnalytics({
    String? metric,
    String? period,
    int? branchId,
  }) async {
    final query = {
      if (metric != null) 'metric': metric,
      if (period != null) 'period': period,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/branch-analytics',
        queryParameters: query);
    return response;
  }

  // GET /api/branch-analytics/comparison
  Future<Map<String, dynamic>> getBranchComparison({
    List<int>? branchIds,
    String? metric,
    String? period,
  }) async {
    final query = {
      if (branchIds != null) 'branchIds': branchIds.join(','),
      if (metric != null) 'metric': metric,
      if (period != null) 'period': period,
    };
    final response = await get<Map<String, dynamic>>(
        '/branch-analytics/comparison',
        queryParameters: query);
    return response;
  }

  // ==================== ML FORECASTING ====================

  // GET /api/forecasting/inventory
  Future<Map<String, dynamic>> getDemandForecast({
    String? horizon,
    int? branchId,
    String? roomType,
  }) async {
    final query = {
      if (horizon != null) 'horizon': horizon,
      if (branchId != null) 'branchId': branchId,
      if (roomType != null) 'roomType': roomType,
    };
    final response = await get<Map<String, dynamic>>('/forecasting/inventory',
        queryParameters: query);
    return response;
  }

  // GET /api/forecasting/sales
  Future<Map<String, dynamic>> getRevenueForecast({
    String? horizon,
    int? branchId,
  }) async {
    final query = {
      if (horizon != null) 'horizon': horizon,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/forecasting/sales',
        queryParameters: query);
    return response;
  }

  // GET /api/forecasting/sales
  Future<Map<String, dynamic>> getPricingRecommendations({
    String? date,
    int? branchId,
  }) async {
    final query = {
      if (date != null) 'date': date,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/forecasting/sales',
        queryParameters: query);
    return response;
  }

  // ==================== STOCK ANALYTICS ====================

  // GET /api/store/consumption-trends
  Future<Map<String, dynamic>> getStockAnalytics({
    String? type,
    String? period,
    int? branchId,
  }) async {
    final query = {
      if (type != null) 'type': type,
      if (period != null) 'period': period,
      if (branchId != null) 'branch_id': branchId,
    };
    final response = await get<Map<String, dynamic>>(
        '/store/consumption-trends',
        queryParameters: query);
    return response;
  }

  // GET /api/store/stock-movement
  Future<Map<String, dynamic>> getStockTrends({
    String? itemId,
    String? period,
    int? branchId,
  }) async {
    final query = {
      if (itemId != null) 'itemId': itemId,
      if (period != null) 'period': period,
      if (branchId != null) 'branch_id': branchId,
    };
    final response = await get<Map<String, dynamic>>('/store/stock-movement',
        queryParameters: query);
    return response;
  }
}
