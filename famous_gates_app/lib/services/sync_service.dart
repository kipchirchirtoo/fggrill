import 'dart:convert';
import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/database/app_database.dart';
import '../core/network/dio_client.dart';

final syncServiceProvider = Provider<SyncService>((ref) {
  final service = SyncService(
    ref.read(dioProvider),
    ref.read(appDatabaseProvider).offlineSalesDao,
  );
  ref.onDispose(service.stop);
  return service;
});

class SyncService {
  SyncService(this._dio, this._offlineSalesDao);

  final Dio _dio;
  final OfflineSalesDao _offlineSalesDao;
  Timer? _timer;

  void start() {
    _timer = Timer.periodic(const Duration(seconds: 30), (timer) async {
      final connectivityResult = await Connectivity().checkConnectivity();
      if (!connectivityResult.contains(ConnectivityResult.none)) {
        await _syncPendingSales();
      }
    });
  }

  Future<void> _syncPendingSales() async {
    final pending = await _offlineSalesDao.getPending();
    if (pending.isEmpty) return;

    for (final sale in pending) {
      try {
        final items = (jsonDecode(sale.itemsJson) as List).map((item) {
          final map = item as Map<String, dynamic>;
          return {
            'id': map['product_id'] ?? map['id'],
            'name': map['name'],
            'unit_price': map['price'] ?? map['unit_price'],
            'quantity': map['qty'] ?? map['quantity'],
            'line_total': map['line_total'],
          };
        }).toList();

        await _dio.post(
          '/cashier/pos/transactions',
          data: {
            'items': items,
            'total_amount': sale.total,
          },
          options: Options(
            headers: {
              'Idempotency-Key': 'pos-sale-${sale.localId}',
              'X-Client-Id': sale.cashierId,
            },
          ),
        );
        await _offlineSalesDao.markSynced([sale.localId]);
      } catch (_) {
        // The timer retries on the next connectivity cycle.
      }
    }
  }

  void stop() {
    _timer?.cancel();
  }
}
