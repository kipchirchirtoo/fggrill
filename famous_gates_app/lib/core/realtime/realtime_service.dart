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

class NotificationRealtimeEvent {
  final String id;
  final String title;
  final String message;
  final String type;
  final String category;
  final String priority;
  final Map<String, dynamic> payload;

  NotificationRealtimeEvent({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    required this.category,
    required this.priority,
    required this.payload,
  });
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
  ///
  /// Returns the stream synchronously so callers can attach `onError`
  /// immediately, but the actual Supabase wiring happens after awaiting
  /// `SupabaseDirectService.ensureReady()` — nothing else in this app ever
  /// called that, so the direct-Supabase client was never initialized and
  /// every realtime subscription was silently a no-op stream that neither
  /// emitted data nor errored (so callers' fallback-polling never engaged
  /// either). If init still leaves no client (e.g. no bridge token yet),
  /// the stream emits an error so the caller's fallback kicks in instead of
  /// going dark forever.
  Stream<OrderItemRealtimeEvent> watchOrderItems(int branchId) {
    final controller = StreamController<OrderItemRealtimeEvent>.broadcast();
    final channelName = RealtimeChannelKeys.ordersChannel(branchId);

    _initOrderChannel(branchId, channelName, controller);

    return controller.stream;
  }

  Future<void> _initOrderChannel(
    int branchId,
    String channelName,
    StreamController<OrderItemRealtimeEvent> controller,
  ) async {
    await _ref.read(supabaseDirectServiceProvider).ensureReady();
    final client = _supabaseClient;
    if (client == null) {
      debugPrint('⚠️ RealtimeService: Supabase client is not available. Realtime disabled.');
      _statusController.add(RealtimeConnectionStatus.disconnected);
      controller.addError(StateError('Direct Supabase client unavailable'));
      return;
    }

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

    // 4. Listen to pos_customer_bills table changes
    channel.onPostgresChanges(
      event: PostgresChangeEvent.all,
      schema: 'public',
      table: 'pos_customer_bills',
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
          status: record['payment_status']?.toString() ?? 'unpaid',
          orderNumber: record['bill_number']?.toString() ?? record['short_code']?.toString(),
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
  }

  /// Subscribe to void requests updates for a branch. See watchOrderItems()
  /// above for why this awaits ensureReady() before wiring the channel.
  Stream<VoidRequestRealtimeEvent> watchVoidRequests(int branchId) {
    final controller = StreamController<VoidRequestRealtimeEvent>.broadcast();
    final channelName = RealtimeChannelKeys.voidsChannel(branchId);

    _initVoidChannel(channelName, branchId, controller);

    return controller.stream;
  }

  Future<void> _initVoidChannel(
    String channelName,
    int branchId,
    StreamController<VoidRequestRealtimeEvent> controller,
  ) async {
    await _ref.read(supabaseDirectServiceProvider).ensureReady();
    final client = _supabaseClient;
    if (client == null) {
      controller.addError(StateError('Direct Supabase client unavailable'));
      return;
    }

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
  }

  /// Live INSERT feed for notifications targeted at [userId] directly, or
  /// broadcast to [role] (optionally scoped to [branchId] — see
  /// notification.service.ts's notifyRole). Only ever emits genuinely new
  /// rows created after the subscription is live — it never replays
  /// existing/backlog notifications, so callers (the toast overlay) don't
  /// need to de-dupe against GET /notifications history themselves.
  Stream<NotificationRealtimeEvent> watchNotifications({
    required String userId,
    required String role,
    int? branchId,
  }) {
    final controller = StreamController<NotificationRealtimeEvent>.broadcast();
    final channelName = RealtimeChannelKeys.notificationsChannel(userId);

    _initNotificationsChannel(channelName, userId, role, branchId, controller);

    return controller.stream;
  }

  Future<void> _initNotificationsChannel(
    String channelName,
    String userId,
    String role,
    int? branchId,
    StreamController<NotificationRealtimeEvent> controller,
  ) async {
    await _ref.read(supabaseDirectServiceProvider).ensureReady();
    final client = _supabaseClient;
    if (client == null) {
      controller.addError(StateError('Direct Supabase client unavailable'));
      return;
    }

    if (_activeChannels.containsKey(channelName)) {
      _activeChannels[channelName]?.unsubscribe();
    }

    final channel = client.channel(channelName);

    // No server-side filter: notifications target via user_id OR role
    // (optionally AND branch_id) — see notifyUser/notifyRole/notifyBranch
    // in backend/src/services/notification.service.ts. A single Postgres
    // Changes filter can't express that OR across columns, so every insert
    // is received and matched client-side here, same approach already used
    // for restaurant_order_items above (no branch_id column to filter on).
    channel.onPostgresChanges(
      event: PostgresChangeEvent.insert,
      schema: 'public',
      table: RealtimeChannelKeys.notificationsTable,
      callback: (payload) {
        final record = payload.newRecord;
        debugPrint('🔔 RealtimeService: notifications INSERT payload=$record');
        if (record.isEmpty) return;

        final recordUserId = record['user_id']?.toString();
        final recordRole = record['role']?.toString();
        final recordBranchId = record['branch_id'];

        final matchesUser = recordUserId != null && recordUserId == userId;
        final matchesRole = recordRole != null &&
            recordRole.toLowerCase() == role.toLowerCase() &&
            (recordBranchId == null ||
                branchId == null ||
                recordBranchId.toString() == branchId.toString());
        debugPrint('🔔 RealtimeService: matchesUser=$matchesUser matchesRole=$matchesRole '
            '(recordUserId=$recordUserId userId=$userId recordRole=$recordRole role=$role)');
        if (!matchesUser && !matchesRole) return;

        controller.add(NotificationRealtimeEvent(
          id: record['id']?.toString() ?? '',
          title: record['title']?.toString() ?? 'Notification',
          message: record['message']?.toString() ?? '',
          type: record['type']?.toString() ?? 'info',
          category: record['category']?.toString() ?? '',
          priority: record['priority']?.toString() ?? 'medium',
          payload: record,
        ));
        debugPrint('🔔 RealtimeService: added NotificationRealtimeEvent to stream');
      },
    );

    channel.subscribe((status, [error]) {
      debugPrint('🔌 RealtimeService Notifications subscription status: $status'
          '${error != null ? ' error=$error' : ''}');
    });

    _activeChannels[channelName] = channel;

    controller.onCancel = () {
      channel.unsubscribe();
      _activeChannels.remove(channelName);
    };
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
