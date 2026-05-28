import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/mobile_shell.dart';
import '../../data/repository.dart';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

final _branchStockRequestsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final list = await ref.read(storeRepositoryProvider).getStockRequests();
  return list
      .map((r) => {
            'id': r.id,
            'request_number': r.id,
            'status': r.status ?? 'PENDING_AUDIT',
            'priority': r.priority ?? 'NORMAL',
            'items_count': r.itemCount,
            'created_at': r.createdAt?.toIso8601String() ?? '',
            'branch': r.requestingBranch ?? '',
          })
      .toList();
});

final _incomingDispatchesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(storeRepositoryProvider).getIncomingDispatches();
});

final _lowStockProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final items = await ref.read(storeRepositoryProvider).getLowStockItems();
  return items
      .map((i) => {
            'id': i.id,
            'name': i.name,
            'sku': i.sku ?? '',
            'category': i.category ?? '',
            'unit': i.unit ?? '',
            'current_quantity': i.currentStock,
            'reorder_level': i.minStock ?? 0,
          })
      .toList();
});

// ---------------------------------------------------------------------------
// Root screen
// ---------------------------------------------------------------------------

class MobileBranchStoreScreen extends ConsumerWidget {
  const MobileBranchStoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MobileShell(
      title: 'Branch Store',
      tabs: const [
        MobileTab(
          label: 'Requests',
          icon: Icons.list_alt_outlined,
          activeIcon: Icons.list_alt,
          body: _RequestsTab(),
        ),
        MobileTab(
          label: 'Receive',
          icon: Icons.move_to_inbox_outlined,
          activeIcon: Icons.move_to_inbox,
          body: _ReceiveTab(),
        ),
        MobileTab(
          label: 'My Stock',
          icon: Icons.inventory_2_outlined,
          activeIcon: Icons.inventory_2,
          body: _MyStockTab(),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 1 — Stock Requests
// ---------------------------------------------------------------------------

class _RequestsTab extends ConsumerWidget {
  const _RequestsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_branchStockRequestsProvider);
    return async.when(
      loading: () =>
          const MobileLoadingView(message: 'Loading stock requests…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load requests',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_branchStockRequestsProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (requests) => Stack(
        children: [
          requests.isEmpty
              ? const MobileEmptyState(
                  icon: Icons.list_alt_outlined,
                  title: 'No stock requests',
                  subtitle:
                      'Tap + to submit a new stock request to central store.',
                )
              : ListView.separated(
                  padding:
                      const EdgeInsets.fromLTRB(16, 16, 16, 80),
                  itemCount: requests.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, i) =>
                      _RequestTile(request: requests[i]),
                ),
          Positioned(
            bottom: 16,
            right: 16,
            child: FloatingActionButton.extended(
              onPressed: () => _showNewRequestSheet(context, ref),
              backgroundColor: AppColors.kPrimary,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add),
              label: const Text('New Request'),
            ),
          ),
        ],
      ),
    );
  }

  void _showNewRequestSheet(BuildContext context, WidgetRef ref) {
    final container = ProviderScope.containerOf(context);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => UncontrolledProviderScope(
        container: container,
        child: const _NewRequestSheet(),
      ),
    );
  }
}

class _RequestTile extends StatelessWidget {
  const _RequestTile({required this.request});

  final Map<String, dynamic> request;

  static const _statusColors = {
    'PENDING_AUDIT': AppColors.kWarning,
    'UNDER_REVIEW': Color(0xFF7C3AED),
    'APPROVED': AppColors.kSuccess,
    'REJECTED': AppColors.kError,
    'DISPATCHED': AppColors.kPrimary,
    'DELIVERED': AppColors.kSuccess,
  };

  @override
  Widget build(BuildContext context) {
    final number =
        request['request_number'] ?? request['id'] ?? '—';
    final status =
        (request['status'] ?? 'PENDING_AUDIT').toString().toUpperCase();
    final date = request['created_at'] ?? request['date'] ?? '';
    final items = request['stock_request_items'] as List? ??
        request['items'] as List? ?? [];
    final itemCount =
        request['items_count'] ?? items.length;
    final priority =
        (request['priority'] ?? 'NORMAL').toString().toUpperCase();

    final statusColor =
        _statusColors[status] ?? AppColors.kTextSecondary;

    String dateDisplay = '';
    if (date.isNotEmpty) {
      try {
        final dt = DateTime.parse(date.toString());
        dateDisplay = '${dt.day}/${dt.month}/${dt.year}';
      } catch (_) {
        dateDisplay = date.toString();
      }
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.kCardBg,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: statusColor.withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child:
                Icon(Icons.list_alt, color: statusColor, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Request #$number',
                  style: const TextStyle(
                    color: AppColors.kTextPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
                Row(
                  children: [
                    Text(
                      '$itemCount item(s)',
                      style: const TextStyle(
                        color: AppColors.kTextSecondary,
                        fontSize: 12,
                        fontFamily: 'SF Pro Display',
                      ),
                    ),
                    if (priority != 'NORMAL') ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.kError.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          priority,
                          style: const TextStyle(
                            color: AppColors.kError,
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            fontFamily: 'SF Pro Display',
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                if (dateDisplay.isNotEmpty)
                  Text(
                    dateDisplay,
                    style: const TextStyle(
                      color: AppColors.kTextSecondary,
                      fontSize: 11,
                      fontFamily: 'SF Pro Display',
                    ),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: statusColor.withOpacity(0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              status,
              style: TextStyle(
                color: statusColor,
                fontSize: 10,
                fontWeight: FontWeight.w700,
                fontFamily: 'SF Pro Display',
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NewRequestSheet extends ConsumerStatefulWidget {
  const _NewRequestSheet();

  @override
  ConsumerState<_NewRequestSheet> createState() => _NewRequestSheetState();
}

class _NewRequestSheetState extends ConsumerState<_NewRequestSheet> {
  final _reasonController = TextEditingController();
  String _priority = 'NORMAL';
  final List<Map<String, dynamic>> _items = [];
  bool _loading = false;
  String? _error;

  // Simple item input
  final _skuController = TextEditingController();
  final _nameController = TextEditingController();
  final _qtyController = TextEditingController();

  void _addItem() {
    final sku = _skuController.text.trim();
    final name = _nameController.text.trim();
    final qty = int.tryParse(_qtyController.text.trim()) ?? 0;
    if (sku.isEmpty || qty <= 0) return;
    setState(() {
      _items.add({
        'item_sku': sku,
        'item_name': name.isEmpty ? sku : name,
        'requested_quantity': qty,
      });
      _skuController.clear();
      _nameController.clear();
      _qtyController.clear();
    });
  }

  Future<void> _submit() async {
    if (_items.isEmpty) {
      setState(() => _error = 'Add at least one item');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(storeRepositoryProvider).createStockRequest({
        'items': _items,
        'priority': _priority,
        'reason': _reasonController.text.trim(),
      });
      ref.invalidate(_branchStockRequestsProvider);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Stock request submitted — pending audit'),
            backgroundColor: AppColors.kSuccess,
          ),
        );
      }
    } catch (e) {
      setState(
          () => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _reasonController.dispose();
    _skuController.dispose();
    _nameController.dispose();
    _qtyController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
        left: 20,
        right: 20,
        top: 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                const Text(
                  'New Stock Request',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    fontFamily: 'SF Pro Display',
                    color: AppColors.kTextPrimary,
                  ),
                ),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Priority
            DropdownButtonFormField<String>(
              value: _priority,
              decoration: const InputDecoration(
                labelText: 'Priority',
                border: OutlineInputBorder(),
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
              items: ['NORMAL', 'HIGH', 'URGENT']
                  .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                  .toList(),
              onChanged: (v) => setState(() => _priority = v ?? 'NORMAL'),
            ),
            const SizedBox(height: 10),

            // Reason
            TextField(
              controller: _reasonController,
              decoration: const InputDecoration(
                labelText: 'Reason / Notes (optional)',
                border: OutlineInputBorder(),
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
              maxLines: 2,
            ),
            const SizedBox(height: 16),

            // Add items
            const Text(
              'Items',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontFamily: 'SF Pro Display',
                color: AppColors.kTextPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  flex: 2,
                  child: TextField(
                    controller: _skuController,
                    decoration: const InputDecoration(
                      hintText: 'SKU',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(
                          horizontal: 10, vertical: 8),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  flex: 3,
                  child: TextField(
                    controller: _nameController,
                    decoration: const InputDecoration(
                      hintText: 'Item Name',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(
                          horizontal: 10, vertical: 8),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                SizedBox(
                  width: 60,
                  child: TextField(
                    controller: _qtyController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      hintText: 'Qty',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(
                          horizontal: 8, vertical: 8),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                IconButton(
                  onPressed: _addItem,
                  icon: const Icon(Icons.add_circle,
                      color: AppColors.kPrimary),
                ),
              ],
            ),

            // Items list
            if (_items.isNotEmpty) ...[
              const SizedBox(height: 8),
              ..._items.map((item) => _ItemChip(
                    item: item,
                    onRemove: () =>
                        setState(() => _items.remove(item)),
                  )),
            ],

            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(
                _error!,
                style: const TextStyle(
                    color: AppColors.kError, fontSize: 12),
              ),
            ],
            const SizedBox(height: 16),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _loading ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.kPrimary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: _loading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Submit Request'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ItemChip extends StatelessWidget {
  const _ItemChip({required this.item, required this.onRemove});

  final Map<String, dynamic> item;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding:
          const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.kPrimary.withOpacity(0.06),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
            color: AppColors.kPrimary.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              '${item['item_sku']} — ${item['item_name']} × ${item['requested_quantity']}',
              style: const TextStyle(
                fontSize: 12,
                fontFamily: 'SF Pro Display',
                color: AppColors.kTextPrimary,
              ),
            ),
          ),
          GestureDetector(
            onTap: onRemove,
            child: const Icon(Icons.close,
                size: 16, color: AppColors.kError),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 2 — Receive Dispatch
// ---------------------------------------------------------------------------

class _ReceiveTab extends ConsumerWidget {
  const _ReceiveTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_incomingDispatchesProvider);
    return async.when(
      loading: () =>
          const MobileLoadingView(message: 'Loading dispatches…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load dispatches',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_incomingDispatchesProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (dispatches) {
        if (dispatches.isEmpty) {
          return const MobileEmptyState(
            icon: Icons.move_to_inbox_outlined,
            title: 'No incoming dispatches',
            subtitle: 'Dispatches from central store will appear here.',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: dispatches.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, i) =>
              _IncomingDispatchTile(dispatch: dispatches[i]),
        );
      },
    );
  }
}

class _IncomingDispatchTile extends ConsumerWidget {
  const _IncomingDispatchTile({required this.dispatch});

  final Map<String, dynamic> dispatch;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final number =
        dispatch['dispatch_number'] ?? dispatch['id'] ?? '—';
    final from =
        dispatch['from_branch'] ?? dispatch['source_branch'] ?? 'Central Store';
    final driver = dispatch['driver_name'] ?? dispatch['driver'] ?? '—';
    final items = dispatch['dispatch_items'] as List? ??
        dispatch['items'] as List? ?? [];
    final itemCount = dispatch['items_count'] ?? items.length;
    final status =
        (dispatch['status'] ?? 'IN_TRANSIT').toString().toUpperCase();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.kCardBg,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Dispatch $number',
                      style: const TextStyle(
                        color: AppColors.kTextPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        fontFamily: 'SF Pro Display',
                      ),
                    ),
                    Text(
                      'From: $from • Driver: $driver',
                      style: const TextStyle(
                        color: AppColors.kTextSecondary,
                        fontSize: 12,
                        fontFamily: 'SF Pro Display',
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.kPrimary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  status,
                  style: const TextStyle(
                    color: AppColors.kPrimary,
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(Icons.inventory_2_outlined,
                  size: 14, color: AppColors.kTextSecondary),
              const SizedBox(width: 4),
              Text(
                '$itemCount item(s)',
                style: const TextStyle(
                  color: AppColors.kTextSecondary,
                  fontSize: 12,
                  fontFamily: 'SF Pro Display',
                ),
              ),
              const Spacer(),
              TextButton.icon(
                onPressed: () => _showVerifyOtpSheet(context, ref),
                icon: const Icon(Icons.verified_outlined, size: 16),
                label: const Text('Verify B-OTP'),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.kPrimary,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 6),
                  textStyle: const TextStyle(
                    fontSize: 12,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
              ),
              TextButton.icon(
                onPressed: () => _showConfirmSheet(context, ref),
                icon: const Icon(Icons.done_all, size: 16),
                label: const Text('Confirm'),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.kSuccess,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 6),
                  textStyle: const TextStyle(
                    fontSize: 12,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showVerifyOtpSheet(BuildContext context, WidgetRef ref) {
    final id = '${dispatch['id'] ?? dispatch['dispatch_id']}';
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => UncontrolledProviderScope(
        container: ProviderScope.containerOf(context),
        child: _BranchOtpSheet(dispatchId: id),
      ),
    );
  }

  void _showConfirmSheet(BuildContext context, WidgetRef ref) {
    final id = '${dispatch['id'] ?? dispatch['dispatch_id']}';
    final items = dispatch['dispatch_items'] as List? ??
        dispatch['items'] as List? ?? [];
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => UncontrolledProviderScope(
        container: ProviderScope.containerOf(context),
        child: _ConfirmDeliverySheet(
          dispatchId: id,
          items: items
              .map((i) => Map<String, dynamic>.from(i as Map))
              .toList(),
        ),
      ),
    );
  }
}

class _BranchOtpSheet extends ConsumerStatefulWidget {
  const _BranchOtpSheet({required this.dispatchId});

  final String dispatchId;

  @override
  ConsumerState<_BranchOtpSheet> createState() => _BranchOtpSheetState();
}

class _BranchOtpSheetState extends ConsumerState<_BranchOtpSheet> {
  final _otpController = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final otp = _otpController.text.trim().toUpperCase();
    if (otp.isEmpty) {
      setState(() => _error = 'Enter the B-XXXX OTP code');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref
          .read(storeRepositoryProvider)
          .verifyBranchOtp(widget.dispatchId, otp);
      ref.invalidate(_incomingDispatchesProvider);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Branch OTP verified — dispatch completed!'),
            backgroundColor: AppColors.kSuccess,
          ),
        );
      }
    } catch (e) {
      setState(
          () => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        left: 20,
        right: 20,
        top: 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                'Verify Branch OTP',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  fontFamily: 'SF Pro Display',
                  color: AppColors.kTextPrimary,
                ),
              ),
              const Spacer(),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
          const Text(
            'Enter the B-XXXX code provided by the driver to confirm goods arrival.',
            style: TextStyle(
              color: AppColors.kTextSecondary,
              fontSize: 13,
              fontFamily: 'SF Pro Display',
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _otpController,
            textCapitalization: TextCapitalization.characters,
            style: const TextStyle(
              letterSpacing: 4,
              fontSize: 20,
              fontWeight: FontWeight.bold,
              fontFamily: 'SF Pro Display',
            ),
            decoration: InputDecoration(
              hintText: 'B-XXXX',
              hintStyle: const TextStyle(
                letterSpacing: 2,
                color: AppColors.kTextSecondary,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(
                    color: AppColors.kPrimary, width: 2),
              ),
              errorText: _error,
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _loading ? null : _verify,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kPrimary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: _loading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Verify OTP'),
            ),
          ),
        ],
      ),
    );
  }
}

class _ConfirmDeliverySheet extends ConsumerStatefulWidget {
  const _ConfirmDeliverySheet({
    required this.dispatchId,
    required this.items,
  });

  final String dispatchId;
  final List<Map<String, dynamic>> items;

  @override
  ConsumerState<_ConfirmDeliverySheet> createState() =>
      _ConfirmDeliverySheetState();
}

class _ConfirmDeliverySheetState
    extends ConsumerState<_ConfirmDeliverySheet> {
  late final List<Map<String, dynamic>> _lines;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _lines = widget.items.map((item) {
      final dispatched =
          (item['dispatched_quantity'] ?? item['quantity'] ?? 0) as num;
      return {
        'item_id': item['item_id'] ?? item['id'],
        'item_name':
            item['item_name'] ?? item['name'] ?? item['sku'] ?? '—',
        'dispatched': dispatched,
        'received_qty': TextEditingController(
            text: dispatched.toStringAsFixed(0)),
        'damaged_qty': TextEditingController(text: '0'),
      };
    }).toList();
  }

  @override
  void dispose() {
    for (final l in _lines) {
      (l['received_qty'] as TextEditingController).dispose();
      (l['damaged_qty'] as TextEditingController).dispose();
    }
    super.dispose();
  }

  Future<void> _confirm() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = _lines.map((l) {
        return {
          'item_id': l['item_id'],
          'received_quantity':
              double.tryParse(
                      (l['received_qty'] as TextEditingController).text) ??
                  0,
          'damaged_quantity':
              double.tryParse(
                      (l['damaged_qty'] as TextEditingController).text) ??
                  0,
        };
      }).toList();

      await ref.read(storeRepositoryProvider).confirmDispatchNote(
            widget.dispatchId,
            {'items': items},
          );
      ref.invalidate(_incomingDispatchesProvider);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Delivery confirmed successfully'),
            backgroundColor: AppColors.kSuccess,
          ),
        );
      }
    } catch (e) {
      setState(
          () => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        left: 20,
        right: 20,
        top: 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                'Confirm Delivery',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  fontFamily: 'SF Pro Display',
                  color: AppColors.kTextPrimary,
                ),
              ),
              const Spacer(),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (_lines.isEmpty)
            const Text(
              'No items to confirm.',
              style: TextStyle(
                  color: AppColors.kTextSecondary,
                  fontFamily: 'SF Pro Display'),
            )
          else
            ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.4,
              ),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: _lines.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, i) {
                  final l = _lines[i];
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${l['item_name']} (dispatched: ${l['dispatched']})',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          fontFamily: 'SF Pro Display',
                          color: AppColors.kTextPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller:
                                  l['received_qty'] as TextEditingController,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Received',
                                border: OutlineInputBorder(),
                                contentPadding: EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 8),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: TextField(
                              controller:
                                  l['damaged_qty'] as TextEditingController,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Damaged',
                                border: OutlineInputBorder(),
                                contentPadding: EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 8),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  );
                },
              ),
            ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(
              _error!,
              style: const TextStyle(
                  color: AppColors.kError, fontSize: 12),
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _loading ? null : _confirm,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kSuccess,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: _loading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Confirm Delivery'),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 3 — My Stock (low stock alerts)
// ---------------------------------------------------------------------------

class _MyStockTab extends ConsumerWidget {
  const _MyStockTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_lowStockProvider);
    return async.when(
      loading: () =>
          const MobileLoadingView(message: 'Loading stock levels…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load stock',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_lowStockProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const MobileEmptyState(
            icon: Icons.check_circle_outline,
            title: 'All stock levels OK',
            subtitle: 'No items are currently below reorder level.',
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              color: AppColors.kWarning.withOpacity(0.1),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber,
                      color: AppColors.kWarning, size: 18),
                  const SizedBox(width: 8),
                  Text(
                    '${items.length} item(s) below reorder level',
                    style: const TextStyle(
                      color: AppColors.kWarning,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      fontFamily: 'SF Pro Display',
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, i) => _StockTile(item: items[i]),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _StockTile extends StatelessWidget {
  const _StockTile({required this.item});

  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final name = item['name'] ?? item['item_name'] ?? '—';
    final sku = item['sku'] ?? item['item_sku'] ?? '';
    final qty = item['current_quantity'] ?? item['quantity'] ?? 0;
    final reorder = item['reorder_level'] ?? item['min_stock'] ?? 0;
    final unit = item['unit'] ?? '';
    final category = item['category'] ?? '';

    final pct = reorder > 0 ? (qty as num) / (reorder as num) : 1.0;
    final color = pct < 0.5
        ? AppColors.kError
        : pct < 1.0
            ? AppColors.kWarning
            : AppColors.kSuccess;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.kCardBg,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(Icons.inventory_2, color: color, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name.toString(),
                  style: const TextStyle(
                    color: AppColors.kTextPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
                Text(
                  sku.isNotEmpty ? '$sku • $category' : category.toString(),
                  style: const TextStyle(
                    color: AppColors.kTextSecondary,
                    fontSize: 11,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
                const SizedBox(height: 4),
                LinearProgressIndicator(
                  value: pct.clamp(0.0, 1.5).toDouble(),
                  backgroundColor: Colors.grey.shade200,
                  color: color,
                  minHeight: 4,
                  borderRadius: BorderRadius.circular(2),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '$qty $unit',
                style: TextStyle(
                  color: color,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  fontFamily: 'SF Pro Display',
                ),
              ),
              Text(
                'min: $reorder',
                style: const TextStyle(
                  color: AppColors.kTextSecondary,
                  fontSize: 10,
                  fontFamily: 'SF Pro Display',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
