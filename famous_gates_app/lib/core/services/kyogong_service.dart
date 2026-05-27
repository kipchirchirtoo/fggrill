import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final kyogongServiceProvider = Provider<KyogongService>((ref) {
  return KyogongService(ref.watch(dioProvider));
});

class KyogongService extends BaseApiService {
  KyogongService(super.dio);

  // ==================== SERVICES ====================

  // Frontend parity: /dashboard/admin/kyogong/services
  // GET /api/kyogong/dynamic-services
  Future<Map<String, dynamic>> getDynamicServices({
    String? serviceType,
    bool? isActive,
  }) async {
    final response = await get<Map<String, dynamic>>(
      '/kyogong/dynamic-services',
      queryParameters: {
        if (serviceType != null && serviceType.isNotEmpty)
          'service_type': serviceType,
        if (isActive != null) 'is_active': isActive,
      },
    );
    return response;
  }

  // POST /api/kyogong/dynamic-services
  Future<Map<String, dynamic>> createDynamicService(
      Map<String, dynamic> service) async {
    final response = await post<Map<String, dynamic>>(
      '/kyogong/dynamic-services',
      data: service,
    );
    return response;
  }

  // PUT /api/kyogong/dynamic-services/:id
  Future<Map<String, dynamic>> updateDynamicService(
      String id, Map<String, dynamic> service) async {
    final response = await put<Map<String, dynamic>>(
      '/kyogong/dynamic-services/$id',
      data: service,
    );
    return response;
  }

  // GET /api/kyogong/services
  Future<Map<String, dynamic>> getServices({
    String? category,
    String? status,
    bool? isAvailable,
  }) async {
    final query = {
      if (category != null) 'category': category,
      if (status != null) 'status': status,
      if (isAvailable != null) 'isAvailable': isAvailable,
    };
    final response = await get<Map<String, dynamic>>('/kyogong/services',
        queryParameters: query);
    return response;
  }

  // GET /api/kyogong/services/:id
  Future<Map<String, dynamic>> getService(String id) async {
    final response = await get<Map<String, dynamic>>('/kyogong/services/$id');
    return response;
  }

  // POST /api/kyogong/services
  Future<Map<String, dynamic>> createService(
      Map<String, dynamic> service) async {
    final response =
        await post<Map<String, dynamic>>('/kyogong/services', data: service);
    return response;
  }

  // PUT /api/kyogong/services/:id
  Future<Map<String, dynamic>> updateService(
      String id, Map<String, dynamic> service) async {
    final response =
        await put<Map<String, dynamic>>('/kyogong/services/$id', data: service);
    return response;
  }

  // ==================== SERVICE BOOKINGS ====================

  // GET /api/kyogong/bookings
  Future<Map<String, dynamic>> getServiceBookings({
    String? status,
    String? date,
    String? serviceId,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (date != null) 'date': date,
      if (serviceId != null) 'serviceId': serviceId,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>('/kyogong/bookings',
        queryParameters: query);
    return response;
  }

  // GET /api/kyogong/bookings/:id
  Future<Map<String, dynamic>> getServiceBooking(String id) async {
    final response = await get<Map<String, dynamic>>('/kyogong/bookings/$id');
    return response;
  }

  // POST /api/kyogong/bookings
  Future<Map<String, dynamic>> createServiceBooking(
      Map<String, dynamic> booking) async {
    final response =
        await post<Map<String, dynamic>>('/kyogong/bookings', data: booking);
    return response;
  }

  // PUT /api/kyogong/bookings/:id
  Future<Map<String, dynamic>> updateServiceBooking(
      String id, Map<String, dynamic> booking) async {
    final response =
        await put<Map<String, dynamic>>('/kyogong/bookings/$id', data: booking);
    return response;
  }

  // PATCH /api/kyogong/bookings/:id/status
  Future<Map<String, dynamic>> updateBookingStatus(
      String id, String status) async {
    final response = await patch<Map<String, dynamic>>(
      '/kyogong/bookings/$id/status',
      data: {'status': status},
    );
    return response;
  }

  // POST /api/kyogong/bookings/:id/start
  Future<Map<String, dynamic>> startService(String id) async {
    final response =
        await post<Map<String, dynamic>>('/kyogong/bookings/$id/start');
    return response;
  }

  // POST /api/kyogong/bookings/:id/complete
  Future<Map<String, dynamic>> completeService(String id) async {
    final response =
        await post<Map<String, dynamic>>('/kyogong/bookings/$id/complete');
    return response;
  }

  // POST /api/kyogong/bookings/:id/cancel
  Future<Map<String, dynamic>> cancelServiceBooking(String id,
      {String? reason}) async {
    final response = await post<Map<String, dynamic>>(
      '/kyogong/bookings/$id/cancel',
      data: {if (reason != null) 'reason': reason},
    );
    return response;
  }

  // POST /api/kyogong/bookings/:id/payment
  Future<Map<String, dynamic>> recordServicePayment(
      String id, Map<String, dynamic> payment) async {
    final response = await post<Map<String, dynamic>>(
        '/kyogong/bookings/$id/payment',
        data: payment);
    return response;
  }

  // ==================== SPA ====================

  // GET /api/kyogong/spa/therapists
  Future<Map<String, dynamic>> getSpaTherapists({String? status}) async {
    final query = {if (status != null) 'status': status};
    final response = await get<Map<String, dynamic>>('/kyogong/spa/therapists',
        queryParameters: query);
    return response;
  }

  // GET /api/kyogong/spa/schedule
  Future<Map<String, dynamic>> getSpaSchedule(
      {String? date, String? therapistId}) async {
    final query = {
      if (date != null) 'date': date,
      if (therapistId != null) 'therapistId': therapistId,
    };
    final response = await get<Map<String, dynamic>>('/kyogong/spa/schedule',
        queryParameters: query);
    return response;
  }

  // POST /api/kyogong/spa/bookings
  Future<Map<String, dynamic>> createSpaBooking(
      Map<String, dynamic> booking) async {
    final response = await post<Map<String, dynamic>>('/kyogong/spa/bookings',
        data: booking);
    return response;
  }

  // ==================== EXECUTIVE BAR ====================

  // GET /api/kyogong/executive-bar/menu
  Future<Map<String, dynamic>> getExecutiveBarMenu(
      {String? category, bool? isAvailable}) async {
    final query = {
      if (category != null) 'category': category,
      if (isAvailable != null) 'isAvailable': isAvailable,
    };
    final response = await get<Map<String, dynamic>>(
        '/kyogong/executive-bar/menu',
        queryParameters: query);
    return response;
  }

  // GET /api/kyogong/executive-bar/orders
  Future<Map<String, dynamic>> getExecutiveBarOrders({
    String? status,
    String? date,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (date != null) 'date': date,
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>(
        '/kyogong/executive-bar/orders',
        queryParameters: query);
    return response;
  }

  // POST /api/kyogong/executive-bar/orders
  Future<Map<String, dynamic>> createExecutiveBarOrder(
      Map<String, dynamic> order) async {
    final response = await post<Map<String, dynamic>>(
        '/kyogong/executive-bar/orders',
        data: order);
    return response;
  }

  // ==================== SPORTS BAR ====================

  // GET /api/kyogong/sports-bar/menu
  Future<Map<String, dynamic>> getSportsBarMenu(
      {String? category, bool? isAvailable}) async {
    final query = {
      if (category != null) 'category': category,
      if (isAvailable != null) 'isAvailable': isAvailable,
    };
    final response = await get<Map<String, dynamic>>('/kyogong/sports-bar/menu',
        queryParameters: query);
    return response;
  }

  // GET /api/kyogong/sports-bar/orders
  Future<Map<String, dynamic>> getSportsBarOrders({
    String? status,
    String? date,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (date != null) 'date': date,
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>(
        '/kyogong/sports-bar/orders',
        queryParameters: query);
    return response;
  }

  // POST /api/kyogong/sports-bar/orders
  Future<Map<String, dynamic>> createSportsBarOrder(
      Map<String, dynamic> order) async {
    final response = await post<Map<String, dynamic>>(
        '/kyogong/sports-bar/orders',
        data: order);
    return response;
  }

  // ==================== CASHIER OPERATIONS ====================

  // GET /api/kyogong/cashier/summary
  Future<Map<String, dynamic>> getCashierSummary(
      {String? date, String? cashierType}) async {
    final query = {
      if (date != null) 'date': date,
      if (cashierType != null) 'cashierType': cashierType,
    };
    final response = await get<Map<String, dynamic>>('/kyogong/cashier/summary',
        queryParameters: query);
    return response;
  }

  // POST /api/kyogong/cashier/transaction
  Future<Map<String, dynamic>> recordCashierTransaction(
      Map<String, dynamic> transaction) async {
    final response = await post<Map<String, dynamic>>(
        '/kyogong/cashier/transaction',
        data: transaction);
    return response;
  }

  // POST /api/kyogong/cashier/shift/open
  Future<Map<String, dynamic>> openCashierShift(
      Map<String, dynamic> shift) async {
    final response = await post<Map<String, dynamic>>(
        '/kyogong/cashier/shift/open',
        data: shift);
    return response;
  }

  // POST /api/kyogong/cashier/shift/close
  Future<Map<String, dynamic>> closeCashierShift(
      Map<String, dynamic> shift) async {
    final response = await post<Map<String, dynamic>>(
        '/kyogong/cashier/shift/close',
        data: shift);
    return response;
  }

  // ==================== PETTY CASH ====================

  // GET /api/kyogong/petty-cash
  Future<Map<String, dynamic>> getPettyCash(
      {String? type, String? status}) async {
    final query = {
      if (type != null) 'type': type,
      if (status != null) 'status': status,
    };
    final response = await get<Map<String, dynamic>>('/kyogong/petty-cash',
        queryParameters: query);
    return response;
  }

  // POST /api/kyogong/petty-cash/issue
  Future<Map<String, dynamic>> issuePettyCash(
      Map<String, dynamic> request) async {
    final response = await post<Map<String, dynamic>>(
        '/kyogong/petty-cash/issue',
        data: request);
    return response;
  }

  // POST /api/kyogong/petty-cash/reconcile
  Future<Map<String, dynamic>> reconcilePettyCash(
      Map<String, dynamic> reconciliation) async {
    final response = await post<Map<String, dynamic>>(
        '/kyogong/petty-cash/reconcile',
        data: reconciliation);
    return response;
  }

  // ==================== REPORTS ====================

  // GET /api/kyogong/reports/revenue
  Future<Map<String, dynamic>> getKyogongRevenueReport({
    String? period,
    String? serviceType,
  }) async {
    final query = {
      if (period != null) 'period': period,
      if (serviceType != null) 'serviceType': serviceType,
    };
    final response = await get<Map<String, dynamic>>('/kyogong/reports/revenue',
        queryParameters: query);
    return response;
  }

  // GET /api/kyogong/reports/occupancy
  Future<Map<String, dynamic>> getKyogongOccupancyReport(
      {String? period}) async {
    final query = {if (period != null) 'period': period};
    final response = await get<Map<String, dynamic>>(
        '/kyogong/reports/occupancy',
        queryParameters: query);
    return response;
  }
}
