import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final procurementServiceProvider = Provider<ProcurementService>((ref) {
  return ProcurementService(ref.watch(dioProvider));
});

class ProcurementService extends BaseApiService {
  ProcurementService(super.dio);

  // ==================== PURCHASE ORDERS ====================

  // GET /api/procurement/purchase-orders
  Future<Map<String, dynamic>> getPurchaseOrders({
    String? status,
    int? supplierId,
    String? startDate,
    String? endDate,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (supplierId != null) 'supplierId': supplierId,
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>(
        '/procurement/purchase-orders',
        queryParameters: query);
    return response;
  }

  // GET /api/procurement/purchase-orders/:id
  Future<Map<String, dynamic>> getPurchaseOrder(String id) async {
    final response =
        await get<Map<String, dynamic>>('/procurement/purchase-orders/$id');
    return response;
  }

  // POST /api/procurement/purchase-orders
  Future<Map<String, dynamic>> createPurchaseOrder(
      Map<String, dynamic> po) async {
    final response = await post<Map<String, dynamic>>(
        '/procurement/purchase-orders',
        data: po);
    return response;
  }

  // PUT /api/procurement/purchase-orders/:id
  Future<Map<String, dynamic>> updatePurchaseOrder(
      String id, Map<String, dynamic> po) async {
    final response = await put<Map<String, dynamic>>(
        '/procurement/purchase-orders/$id',
        data: po);
    return response;
  }

  // PATCH /api/procurement/purchase-orders/:id/status
  Future<Map<String, dynamic>> updatePurchaseOrderStatus(
      String id, String status) async {
    final response = await patch<Map<String, dynamic>>(
      '/procurement/purchase-orders/$id/status',
      data: {'status': status},
    );
    return response;
  }

  // POST /api/procurement/purchase-orders/:id/approve
  Future<Map<String, dynamic>> approvePurchaseOrder(String id) async {
    final response = await post<Map<String, dynamic>>(
        '/procurement/purchase-orders/$id/approve');
    return response;
  }

  // POST /api/procurement/purchase-orders/:id/cancel
  Future<Map<String, dynamic>> cancelPurchaseOrder(String id,
      {String? reason}) async {
    final response = await post<Map<String, dynamic>>(
      '/procurement/purchase-orders/$id/cancel',
      data: {if (reason != null) 'reason': reason},
    );
    return response;
  }

  // ==================== SUPPLIERS ====================

  // GET /api/suppliers
  Future<Map<String, dynamic>> getSuppliers({
    String? category,
    String? status,
    String? search,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (category != null) 'category': category,
      if (status != null) 'status': status,
      if (search != null) 'search': search,
      'page': page,
      'limit': limit,
    };
    final response =
        await get<Map<String, dynamic>>('/suppliers', queryParameters: query);
    return response;
  }

  // GET /api/suppliers/:id
  Future<Map<String, dynamic>> getSupplier(String id) async {
    final response = await get<Map<String, dynamic>>('/suppliers/$id');
    return response;
  }

  // POST /api/suppliers
  Future<Map<String, dynamic>> createSupplier(
      Map<String, dynamic> supplier) async {
    final response =
        await post<Map<String, dynamic>>('/suppliers', data: supplier);
    return response;
  }

  // PUT /api/suppliers/:id
  Future<Map<String, dynamic>> updateSupplier(
      String id, Map<String, dynamic> supplier) async {
    final response =
        await put<Map<String, dynamic>>('/suppliers/$id', data: supplier);
    return response;
  }

  // PATCH /api/suppliers/:id/status
  Future<Map<String, dynamic>> updateSupplierStatus(
      String id, String status) async {
    final response = await patch<Map<String, dynamic>>(
      '/suppliers/$id/status',
      data: {'status': status},
    );
    return response;
  }

  // GET /api/suppliers/:id/performance
  Future<Map<String, dynamic>> getSupplierPerformance(String id) async {
    final response =
        await get<Map<String, dynamic>>('/suppliers/$id/performance');
    return response;
  }

  // GET /api/suppliers/:id/invoices
  Future<Map<String, dynamic>> getSupplierInvoices(String id) async {
    final response = await get<Map<String, dynamic>>('/suppliers/$id/invoices');
    return response;
  }

  // GET /api/suppliers/:id/payments
  Future<Map<String, dynamic>> getSupplierPayments(String id) async {
    final response = await get<Map<String, dynamic>>('/suppliers/$id/payments');
    return response;
  }

  // ==================== SUPPLIER INVOICES ====================

  // GET /api/suppliers/invoices
  Future<Map<String, dynamic>> getSupplierInvoicesList({
    String? status,
    int? supplierId,
    String? startDate,
    String? endDate,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (supplierId != null) 'supplierId': supplierId,
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>('/suppliers/invoices',
        queryParameters: query);
    return response;
  }

  // POST /api/suppliers/invoices
  Future<Map<String, dynamic>> createSupplierInvoice(
      Map<String, dynamic> invoice) async {
    final response =
        await post<Map<String, dynamic>>('/suppliers/invoices', data: invoice);
    return response;
  }

  // POST /api/suppliers/invoices/:id/payment
  Future<Map<String, dynamic>> recordSupplierPayment(
      String id, Map<String, dynamic> payment) async {
    final response = await post<Map<String, dynamic>>(
        '/suppliers/invoices/$id/payment',
        data: payment);
    return response;
  }

  // ==================== GRN (GOODS RECEIVED NOTES) ====================

  // GET /api/storekeeping/grn
  Future<Map<String, dynamic>> getGRNs({
    String? status,
    int? purchaseOrderId,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (purchaseOrderId != null) 'purchaseOrderId': purchaseOrderId,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>('/storekeeping/grn',
        queryParameters: query);
    return response;
  }

  // GET /api/storekeeping/grn/:id
  Future<Map<String, dynamic>> getGRN(String id) async {
    final response = await get<Map<String, dynamic>>('/storekeeping/grn/$id');
    return response;
  }

  // POST /api/storekeeping/grn
  Future<Map<String, dynamic>> createGRN(Map<String, dynamic> grn) async {
    final response =
        await post<Map<String, dynamic>>('/storekeeping/grn', data: grn);
    return response;
  }

  // POST /api/storekeeping/grn/:id/complete
  Future<Map<String, dynamic>> completeGRN(String id) async {
    final response =
        await post<Map<String, dynamic>>('/storekeeping/grn/$id/complete');
    return response;
  }

  // ==================== REQUISITIONS ====================

  // GET /api/procurement/requisitions
  Future<Map<String, dynamic>> getRequisitions({
    String? status,
    String? department,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (department != null) 'department': department,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>(
        '/procurement/requisitions',
        queryParameters: query);
    return response;
  }

  // GET /api/procurement/requisitions/:id
  Future<Map<String, dynamic>> getRequisition(String id) async {
    final response =
        await get<Map<String, dynamic>>('/procurement/requisitions/$id');
    return response;
  }

  // POST /api/procurement/requisitions
  Future<Map<String, dynamic>> createRequisition(
      Map<String, dynamic> requisition) async {
    final response = await post<Map<String, dynamic>>(
        '/procurement/requisitions',
        data: requisition);
    return response;
  }

  // POST /api/procurement/requisitions/:id/approve
  Future<Map<String, dynamic>> approveRequisition(String id) async {
    final response = await post<Map<String, dynamic>>(
        '/procurement/requisitions/$id/approve');
    return response;
  }

  // POST /api/procurement/requisitions/:id/fulfill
  Future<Map<String, dynamic>> fulfillRequisition(String id) async {
    final response = await post<Map<String, dynamic>>(
        '/procurement/requisitions/$id/fulfill');
    return response;
  }

  // ==================== VENDOR PERFORMANCE ====================

  // GET /api/vendor-performance
  Future<Map<String, dynamic>> getVendorPerformance({
    int? supplierId,
    String? period,
    int? branchId,
  }) async {
    final query = {
      if (supplierId != null) 'supplierId': supplierId,
      if (period != null) 'period': period,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/vendor-performance',
        queryParameters: query);
    return response;
  }

  // POST /api/vendor-performance/rating
  Future<Map<String, dynamic>> rateVendor(Map<String, dynamic> rating) async {
    final response = await post<Map<String, dynamic>>(
        '/vendor-performance/rating',
        data: rating);
    return response;
  }
}
