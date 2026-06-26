import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../supabase/supabase_direct_service.dart';
import 'realtime_channel_keys.dart';

final realtimeServiceProvider = Provider<RealtimeService>((ref) {
  return RealtimeService(ref);
});

enum RealtimeEventType { insert, update, delete }

enum RealtimeConnectionStatus { connected, disconnected, reconnecting }

class OrderItemRealtimeEvent {
  final String orderId;
  final String? itemId;
  final RealtimeEventType eventType;
  final String status;
  final String? waiterId;
  final String? waiterName;
  final String? orderNumber;
  final int branchId;
  final Map<String, dynamic> payload;

  OrderItemRealtimeEvent({
    required this.orderId,
    this.itemId,
    required this.eventType,
    required this.status,
    this.waiterId,
    this.waiterName,
    this.orderNumber,
    required this.branchId,
    required this.payload,
  });

  @override
  String toString() {
    return 'OrderItemRealtimeEvent(orderId: $orderId, itemId: $itemId, event: $eventType, status: $status)';
  }
}

class VoidRequestRealtimeEvent {
  final String id;
  final String orderId;
  final String status;
  final RealtimeEventType eventType;
  final int branchId;
  final Map<String, dynamic> payload;

  VoidRequestRealtimeEvent({
    required this.id,
    required this.orderId,
    required this.status,
    required this.eventType,
    required this.branchId,
    required this.payload,
  });

  @override
  String toString() {
    return 'VoidRequestRealtimeEvent(id: $id, orderId: $orderId, status: $status, event: $eventType)';
  }
}

class RealtimeService {
  RealtimeService(this._ref);

  final Ref _ref;
  final Map<String, RealtimeChannel> _activeChannels = {};

  final StreamController<RealtimeConnectionStatus> _statusController =
      StreamController<RealtimeConnectionStatus>.broadcast();

  Stream<RealtimeConnectionStatus> get statusStream => _statusController.stream;

  SupabaseClient? get _supabaseClient =>
      _ref.read(supabaseDirectServiceProvider).client;

  /// Closes and cleans up all active channels.
  void disposeAll() {
    for (final channel in _activeChannels.values) {
      channel.unsubscribe();
    }
    _activeChannels.clear();
    debugPrint('🔌 RealtimeService: Disposed all active channels.');
  }

  /// Subscribe to orders-related updates for a branch.
  /// Handles both traditional restaurant orders (restaurant_orders) and POS orders (pos_shift_orders).
  Stream<OrderItemRealtimeEvent> watchOrderItems(int branchId) {
    final client = _supabaseClient;
    if (client == null) {
      debugPrint('⚠️ RealtimeService: Supabase client is not available. Realtime disabled.');
      return const Stream.empty();
    }

    final controller = StreamController<OrderItemRealtimeEvent>.broadcast();
    final channelName = RealtimeChannelKeys.ordersChannel(branchId);

    if (_activeChannels.containsKey(channelName)) {
      _activeChannels[channelName]?.unsubscribe();
    }

    debugPrint('🔌 RealtimeService: Subscribing to $channelName');
    _statusController.add(RealtimeConnectionStatus.reconnecting);

    // Setup channel
    final channel = client.channel(channelName);

    // 1. Listen to restaurant_orders table changes
    // (This table contains branch_id directly, allowing a strict branch filter)
    channel.onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: RealtimeChannelKeys.restaurantOrdersTable,
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'branch_id',
        value: branchId,
      ),
      callback: (payload) {
        final newRecord = payload.newRecord;
        final oldRecord = payload.oldRecord;
        final eventType = _parseEventType(payload.eventType);

        final record = newRecord.isNotEmpty ? newRecord : oldRecord;
        if (record.isEmpty) return;

        final event = OrderItemRealtimeEvent(
          orderId: record['id']?.toString() ?? '',
          eventType: eventType,
          status: record['status']?.toString() ?? 'pending',
          waiterId: record['waiter_id']?.toString(),
          waiterName: record['waiter_name']?.toString(),
          orderNumber: record['order_number']?.toString(),
          branchId: branchId,
          payload: record,
        );
        controller.add(event);
      },
    );

    // 2. Listen to restaurant_order_items table changes
    // (This table does not have branch_id, so we perform client-side filtering on branch matching)
    channel.onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: RealtimeChannelKeys.restaurantOrderItemsTable,
      callback: (payload) {
        final newRecord = payload.newRecord;
        final oldRecord = payload.oldRecord;
        final eventType = _parseEventType(payload.eventType);

        final record = newRecord.isNotEmpty ? newRecord : oldRecord;
        if (record.isEmpty) return;

        final event = OrderItemRealtimeEvent(
          orderId: record['order_id']?.toString() ?? '',
          itemId: record['id']?.toString(),
          eventType: eventType,
          status: record['kitchen_status']?.toString() ?? 'pending',
          branchId: branchId,
          payload: record,
        );
        controller.add(event);
      },
    );

    // 3. Listen to pos_shift_orders table changes
    // (We also filter pos_shift_orders by branch_id on subscription under the assumption it's present,
    // and fallback to checking the branch_id field in callback payload)
    channel.onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: RealtimeChannelKeys.posShiftOrdersTable,
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'branch_id',
        value: branchId,
      ),
      callback: (payload) {
        final newRecord = payload.newRecord;
        final oldRecord = payload.oldRecord;
        final eventType = _parseEventType(payload.eventType);

        final record = newRecord.isNotEmpty ? newRecord : oldRecord;
        if (record.isEmpty) return;

        // Extra client-side safeguard verification
        final recordBranch = record['branch_id'];
        if (recordBranch != null && recordBranch.toString() != branchId.toString()) {
          return;
        }

        final event = OrderItemRealtimeEvent(
          orderId: record['id']?.toString() ?? '',
          eventType: eventType,
          status: record['kitchen_status']?.toString() ?? record['status']?.toString() ?? 'pending',
          waiterId: record['waiter_id']?.toString(),
          waiterName: record['waiter_name']?.toString(),
          orderNumber: record['order_number']?.toString(),
          branchId: branchId,
          payload: record,
        );
        controller.add(event);
      },
    );

    channel.subscribe((status, [error]) {
      debugPrint('🔌 RealtimeService Orders subscription status: $status');
      if (status == RealtimeSubscribeStatus.subscribed) {
        _statusController.add(RealtimeConnectionStatus.connected);
      } else if (status == RealtimeSubscribeStatus.channelError ||
          status == RealtimeSubscribeStatus.timedOut) {
        _statusController.add(RealtimeConnectionStatus.disconnected);
        debugPrint('❌ RealtimeService subscription error: $error');
      }
    });

    _activeChannels[channelName] = channel;

    controller.onCancel = () {
      debugPrint('🔌 RealtimeService: Cancelling stream for $channelName');
      channel.unsubscribe();
      _activeChannels.remove(channelName);
    };

    return controller.stream;
  }

  /// Subscribe to void requests updates for a branch.
  Stream<VoidRequestRealtimeEvent> watchVoidRequests(int branchId) {
    final client = _supabaseClient;
    if (client == null) {
      return const Stream.empty();
    }

    final controller = StreamController<VoidRequestRealtimeEvent>.broadcast();
    final channelName = RealtimeChannelKeys.voidsChannel(branchId);

    if (_activeChannels.containsKey(channelName)) {
      _activeChannels[channelName]?.unsubscribe();
    }

    final channel = client.channel(channelName);

    channel.onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: RealtimeChannelKeys.posItemVoidRequestsTable,
      filter: PostgresChangeFilter(
        type: PostgresChangeFilterType.eq,
        column: 'branch_id',
        value: branchId,
      ),
      callback: (payload) {
        final newRecord = payload.newRecord;
        final oldRecord = payload.oldRecord;
        final eventType = _parseEventType(payload.eventType);

        final record = newRecord.isNotEmpty ? newRecord : oldRecord;
        if (record.isEmpty) return;

        final event = VoidRequestRealtimeEvent(
          id: record['id']?.toString() ?? '',
          orderId: record['order_id']?.toString() ?? '',
          status: record['status']?.toString() ?? 'pending',
          eventType: eventType,
          branchId: branchId,
          payload: record,
        );
        controller.add(event);
      },
    );

    channel.subscribe((status, [error]) {
      debugPrint('🔌 RealtimeService Voids subscription status: $status');
    });

    _activeChannels[channelName] = channel;

    controller.onCancel = () {
      channel.unsubscribe();
      _activeChannels.remove(channelName);
    };

    return controller.stream;
  }

  RealtimeEventType _parseEventType(PostgresChangeEvent event) {
    switch (event) {
      case PostgresChangeEvent.insert:
        return RealtimeEventType.insert;
      case PostgresChangeEvent.update:
        return RealtimeEventType.update;
      case PostgresChangeEvent.delete:
        return RealtimeEventType.delete;
      default:
        return RealtimeEventType.update;
    }
  }
}
