import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:powersync/powersync.dart';

import '../config/app_config.dart';
import '../network/dio_client.dart';

class FamousGatesPowerSyncConnector extends PowerSyncBackendConnector {
  FamousGatesPowerSyncConnector(this._ref);

  final Ref _ref;

  @override
  Future<PowerSyncCredentials?> fetchCredentials() async {
    // Prefer a compile-time token for quick setup / dashboard-generated
    // client tokens. If not provided, fall back to the backend credentials
    // endpoint which mints short-lived JWTs for production.
    const compileTimeToken = AppConfig.powerSyncToken;
    if (compileTimeToken.isNotEmpty) {
      return PowerSyncCredentials(
        endpoint: AppConfig.powerSyncUrl,
        token: compileTimeToken,
      );
    }

    final dio = _ref.read(dioProvider);
    final response = await dio.post('/powersync/credentials');
    final payload = _unwrap(response.data);
    final endpoint = '${payload['endpoint'] ?? AppConfig.powerSyncUrl}'.trim();
    final token = '${payload['token'] ?? ''}'.trim();
    if (endpoint.isEmpty || token.isEmpty) {
      return null;
    }

    final userId = '${payload['user_id'] ?? ''}'.trim();
    final expiresAtText = '${payload['expires_at'] ?? ''}'.trim();
    return PowerSyncCredentials(
      endpoint: endpoint,
      token: token,
      userId: userId.isEmpty ? null : userId,
      expiresAt:
          expiresAtText.isEmpty ? null : DateTime.tryParse(expiresAtText),
    );
  }

  @override
  Future<void> uploadData(PowerSyncDatabase database) async {
    // Upload pending local writes to the backend API. PowerSync calls this
    // whenever there is data to upload, online or offline. Errors are retried;
    // transaction.complete() must be called to advance the queue.
    final transaction = await database.getNextCrudTransaction();
    if (transaction == null) {
      return;
    }

    try {
      final ops = transaction.crud.map((op) => _crudEntryToJson(op)).toList();
      if (ops.isEmpty) {
        await transaction.complete();
        return;
      }

      final dio = _ref.read(dioProvider);
      await dio.post('/powersync/upload', data: ops);
      await transaction.complete();
    } catch (error) {
      debugPrint('PowerSync upload failed: $error');
      // Re-throwing makes PowerSync retry with backoff. Do not call
      // transaction.complete() on failure or the queue will stall.
      rethrow;
    }
  }

  Map<String, dynamic> _crudEntryToJson(CrudEntry op) {
    return {
      'id': op.id,
      'op': op.op.name.toUpperCase(),
      'table': op.table,
      if (op.opData != null) 'opData': op.opData,
    };
  }

  Map<String, dynamic> _unwrap(Object? value) {
    if (value is Map<String, dynamic>) {
      final data = value['data'];
      if (data is Map<String, dynamic>) return data;
      if (data is Map) return Map<String, dynamic>.from(data);
      return value;
    }
    if (value is Map) {
      final map = Map<String, dynamic>.from(value);
      final data = map['data'];
      if (data is Map) return Map<String, dynamic>.from(data);
      return map;
    }
    return const {};
  }
}
