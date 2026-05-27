import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final restaurantServiceProvider = Provider<RestaurantService>((ref) {
  return RestaurantService(ref.watch(dioProvider));
});

class RestaurantService extends BaseApiService {
  RestaurantService(super.dio);

  // ==================== RESTAURANT ORDERS ====================

  // GET /api/restaurant/orders
  Future<Map<String, dynamic>> getOrders({
    String? status,
    int? tableId,
    String? date,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (tableId != null) 'tableId': tableId,
      if (date != null) 'date': date,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>('/restaurant/orders',
        queryParameters: query);
    return response;
  }

  // GET /api/restaurant/orders/:id
  Future<Map<String, dynamic>> getOrder(String id) async {
    final response = await get<Map<String, dynamic>>('/restaurant/orders/$id');
    return response;
  }

  // POST /api/restaurant/orders
  Future<Map<String, dynamic>> createOrder(Map<String, dynamic> order) async {
    final response =
        await post<Map<String, dynamic>>('/restaurant/orders', data: order);
    return response;
  }

  // PUT /api/restaurant/orders/:id
  Future<Map<String, dynamic>> updateOrder(
      String id, Map<String, dynamic> order) async {
    final response =
        await put<Map<String, dynamic>>('/restaurant/orders/$id', data: order);
    return response;
  }

  // PATCH /api/restaurant/orders/:id/status
  Future<Map<String, dynamic>> updateOrderStatus(
      String id, String status) async {
    final response = await patch<Map<String, dynamic>>(
      '/restaurant/orders/$id/status',
      data: {'status': status},
    );
    return response;
  }

  // POST /api/restaurant/orders/:id/void
  Future<Map<String, dynamic>> voidOrder(String id,
      {String? reason, String? authorizedBy}) async {
    final response = await post<Map<String, dynamic>>(
      '/restaurant/orders/$id/void',
      data: {
        if (reason != null) 'reason': reason,
        if (authorizedBy != null) 'authorizedBy': authorizedBy,
      },
    );
    return response;
  }

  // POST /api/restaurant/orders/:id/payment
  Future<Map<String, dynamic>> recordOrderPayment(
      String id, Map<String, dynamic> payment) async {
    final response = await post<Map<String, dynamic>>(
        '/restaurant/orders/$id/payment',
        data: payment);
    return response;
  }

  // ==================== TABLES ====================

  // GET /api/restaurant/tables
  Future<Map<String, dynamic>> getTables({
    String? status,
    String? area,
    int? capacity,
    int? branchId,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (area != null) 'area': area,
      if (capacity != null) 'capacity': capacity,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/restaurant/tables',
        queryParameters: query);
    return response;
  }

  // GET /api/restaurant/tables/:id
  Future<Map<String, dynamic>> getTable(String id) async {
    final response = await get<Map<String, dynamic>>('/restaurant/tables/$id');
    return response;
  }

  // POST /api/restaurant/tables
  Future<Map<String, dynamic>> createTable(Map<String, dynamic> table) async {
    final response =
        await post<Map<String, dynamic>>('/restaurant/tables', data: table);
    return response;
  }

  // PUT /api/restaurant/tables/:id
  Future<Map<String, dynamic>> updateTable(
      String id, Map<String, dynamic> table) async {
    final response =
        await put<Map<String, dynamic>>('/restaurant/tables/$id', data: table);
    return response;
  }

  // PATCH /api/restaurant/tables/:id/status
  Future<Map<String, dynamic>> updateTableStatus(
      String id, String status) async {
    final response = await patch<Map<String, dynamic>>(
      '/restaurant/tables/$id/status',
      data: {'status': status},
    );
    return response;
  }

  // POST /api/restaurant/tables/:id/occupy
  Future<Map<String, dynamic>> occupyTable(String id,
      {int? guestCount, String? guestName}) async {
    final response = await post<Map<String, dynamic>>(
      '/restaurant/tables/$id/occupy',
      data: {
        if (guestCount != null) 'guestCount': guestCount,
        if (guestName != null) 'guestName': guestName,
      },
    );
    return response;
  }

  // POST /api/restaurant/tables/:id/clear
  Future<Map<String, dynamic>> clearTable(String id) async {
    final response =
        await post<Map<String, dynamic>>('/restaurant/tables/$id/clear');
    return response;
  }

  // ==================== MENU ====================

  // Frontend parity: /dashboard/admin/restaurant/menu
  // GET /api/restaurant/menu/categories
  Future<Map<String, dynamic>> getMenuCategories({int? branchId}) async {
    final response = await get<Map<String, dynamic>>(
      '/restaurant/menu/categories',
      queryParameters: {if (branchId != null) 'branch_id': branchId},
    );
    return response;
  }

  // GET /api/restaurant/menu/items
  Future<Map<String, dynamic>> getAdminMenuItems({
    String? categoryId,
    int? branchId,
    bool onlyAvailable = false,
  }) async {
    final response = await get<Map<String, dynamic>>(
      '/restaurant/menu/items',
      queryParameters: {
        if (categoryId != null && categoryId.isNotEmpty) 'category': categoryId,
        if (branchId != null) 'branch_id': branchId,
        'available': onlyAvailable,
      },
    );
    return response;
  }

  // POST /api/restaurant/menu/items
  Future<Map<String, dynamic>> createAdminMenuItem(
      Map<String, dynamic> item) async {
    final response =
        await post<Map<String, dynamic>>('/restaurant/menu/items', data: item);
    return response;
  }

  // PUT /api/restaurant/menu/items/:id
  Future<Map<String, dynamic>> updateAdminMenuItem(
      String id, Map<String, dynamic> item) async {
    final response = await put<Map<String, dynamic>>(
        '/restaurant/menu/items/$id',
        data: item);
    return response;
  }

  // DELETE /api/restaurant/menu/items/:id
  Future<Map<String, dynamic>> deleteAdminMenuItem(String id) async {
    final response =
        await delete<Map<String, dynamic>>('/restaurant/menu/items/$id');
    return response;
  }

  // PUT /api/restaurant/menu/items/:id/toggle
  Future<Map<String, dynamic>> toggleAdminMenuItemAvailability(
      String id) async {
    final response =
        await put<Map<String, dynamic>>('/restaurant/menu/items/$id/toggle');
    return response;
  }

  // GET /api/restaurant/menu
  Future<Map<String, dynamic>> getMenu({
    String? category,
    bool? isAvailable,
    int? branchId,
  }) async {
    final query = {
      if (category != null) 'category': category,
      if (isAvailable != null) 'isAvailable': isAvailable,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/restaurant/menu',
        queryParameters: query);
    return response;
  }

  // GET /api/restaurant/menu/:id
  Future<Map<String, dynamic>> getMenuItem(String id) async {
    final response = await get<Map<String, dynamic>>('/restaurant/menu/$id');
    return response;
  }

  // POST /api/restaurant/menu
  Future<Map<String, dynamic>> createMenuItem(Map<String, dynamic> item) async {
    final response =
        await post<Map<String, dynamic>>('/restaurant/menu', data: item);
    return response;
  }

  // PUT /api/restaurant/menu/:id
  Future<Map<String, dynamic>> updateMenuItem(
      String id, Map<String, dynamic> item) async {
    final response =
        await put<Map<String, dynamic>>('/restaurant/menu/$id', data: item);
    return response;
  }

  // PATCH /api/restaurant/menu/:id/availability
  Future<Map<String, dynamic>> updateMenuItemAvailability(
      String id, bool isAvailable) async {
    final response = await patch<Map<String, dynamic>>(
      '/restaurant/menu/$id/availability',
      data: {'isAvailable': isAvailable},
    );
    return response;
  }

  // DELETE /api/restaurant/menu/:id
  Future<Map<String, dynamic>> deleteMenuItem(String id) async {
    final response = await delete<Map<String, dynamic>>('/restaurant/menu/$id');
    return response;
  }

  // ==================== RESERVATIONS ====================

  // GET /api/restaurant/reservations
  Future<Map<String, dynamic>> getReservations({
    String? status,
    String? date,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (date != null) 'date': date,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>('/restaurant/reservations',
        queryParameters: query);
    return response;
  }

  // GET /api/restaurant/reservations/:id
  Future<Map<String, dynamic>> getReservation(String id) async {
    final response =
        await get<Map<String, dynamic>>('/restaurant/reservations/$id');
    return response;
  }

  // POST /api/restaurant/reservations
  Future<Map<String, dynamic>> createReservation(
      Map<String, dynamic> reservation) async {
    final response = await post<Map<String, dynamic>>(
        '/restaurant/reservations',
        data: reservation);
    return response;
  }

  // PUT /api/restaurant/reservations/:id
  Future<Map<String, dynamic>> updateReservation(
      String id, Map<String, dynamic> reservation) async {
    final response = await put<Map<String, dynamic>>(
        '/restaurant/reservations/$id',
        data: reservation);
    return response;
  }

  // PATCH /api/restaurant/reservations/:id/status
  Future<Map<String, dynamic>> updateReservationStatus(
      String id, String status) async {
    final response = await patch<Map<String, dynamic>>(
      '/restaurant/reservations/$id/status',
      data: {'status': status},
    );
    return response;
  }

  // DELETE /api/restaurant/reservations/:id
  Future<Map<String, dynamic>> cancelReservation(String id,
      {String? reason}) async {
    final queryParams = <String, dynamic>{};
    if (reason != null) queryParams['reason'] = reason;
    final response = await delete<Map<String, dynamic>>(
      '/restaurant/reservations/$id',
      queryParameters: queryParams.isNotEmpty ? queryParams : null,
    );
    return response;
  }

  // ==================== WAITER SALES ====================

  // GET /api/waiter-sales
  Future<Map<String, dynamic>> getWaiterSales({
    int? waiterId,
    String? date,
    String? period,
    int? branchId,
  }) async {
    final query = {
      if (waiterId != null) 'waiterId': waiterId,
      if (date != null) 'date': date,
      if (period != null) 'period': period,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/waiter-sales',
        queryParameters: query);
    return response;
  }

  // GET /api/waiter-sales/:id
  Future<Map<String, dynamic>> getWaiterSaleDetails(String id) async {
    final response = await get<Map<String, dynamic>>('/waiter-sales/$id');
    return response;
  }

  // ==================== BILLS ====================

  // GET /api/restaurant-bills
  Future<Map<String, dynamic>> getBills({
    String? status,
    String? date,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (date != null) 'date': date,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>('/restaurant-bills',
        queryParameters: query);
    return response;
  }

  // GET /api/restaurant-bills/:id
  Future<Map<String, dynamic>> getBill(String id) async {
    final response = await get<Map<String, dynamic>>('/restaurant-bills/$id');
    return response;
  }

  // POST /api/restaurant-bills
  Future<Map<String, dynamic>> createBill(Map<String, dynamic> bill) async {
    final response =
        await post<Map<String, dynamic>>('/restaurant-bills', data: bill);
    return response;
  }

  // POST /api/restaurant-bills/:id/payment
  Future<Map<String, dynamic>> recordBillPayment(
      String id, Map<String, dynamic> payment) async {
    final response = await post<Map<String, dynamic>>(
        '/restaurant-bills/$id/payment',
        data: payment);
    return response;
  }

  // POST /api/restaurant-bills/:id/void
  Future<Map<String, dynamic>> voidBill(String id,
      {String? reason, String? authorizedBy}) async {
    final response = await post<Map<String, dynamic>>(
      '/restaurant-bills/$id/void',
      data: {
        if (reason != null) 'reason': reason,
        if (authorizedBy != null) 'authorizedBy': authorizedBy,
      },
    );
    return response;
  }

  // ==================== BUFFET ====================

  // GET /api/buffet
  Future<Map<String, dynamic>> getBuffet(
      {int? branchId, String? status}) async {
    final query = {
      if (branchId != null) 'branchId': branchId,
      if (status != null) 'status': status,
    };
    final response =
        await get<Map<String, dynamic>>('/buffet', queryParameters: query);
    return response;
  }

  // POST /api/buffet/checkin
  Future<Map<String, dynamic>> buffetCheckIn(
      Map<String, dynamic> checkIn) async {
    final response =
        await post<Map<String, dynamic>>('/buffet/checkin', data: checkIn);
    return response;
  }

  // POST /api/buffet/checkout
  Future<Map<String, dynamic>> buffetCheckOut(String id) async {
    final response =
        await post<Map<String, dynamic>>('/buffet/checkout', data: {'id': id});
    return response;
  }

  // ==================== CATERING ====================

  // GET /api/catering
  Future<Map<String, dynamic>> getCatering({
    String? status,
    String? date,
    int? branchId,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (date != null) 'date': date,
      if (branchId != null) 'branchId': branchId,
    };
    final response =
        await get<Map<String, dynamic>>('/catering', queryParameters: query);
    return response;
  }

  // GET /api/catering/bookings
  Future<Map<String, dynamic>> getCateringBookings({
    String? status,
    String? eventDate,
    int? branchId,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (eventDate != null) 'eventDate': eventDate,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/catering-bookings',
        queryParameters: query);
    return response;
  }

  // POST /api/catering/bookings
  Future<Map<String, dynamic>> createCateringBooking(
      Map<String, dynamic> booking) async {
    final response =
        await post<Map<String, dynamic>>('/catering-bookings', data: booking);
    return response;
  }
}
