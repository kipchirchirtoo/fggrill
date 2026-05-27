import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/safe_avatar.dart';
import '../../../services/print_service.dart';
import '../../auth/data/auth_repository.dart';
import '../../auth/domain/auth_notifier.dart';
import '../data/held_orders_repository.dart';
import '../data/sales_repository.dart';
import '../domain/models.dart';
import '../domain/pos_providers.dart';

class POSScreen extends ConsumerWidget {
  const POSScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Leave POS?'),
            content: const Text('Are you sure you want to leave the POS?'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.of(ctx).pop(false),
                  child: const Text('Stay')),
              ElevatedButton(
                  onPressed: () => Navigator.of(ctx).pop(true),
                  child: const Text('Leave')),
            ],
          ),
        );
        if (confirmed == true && context.mounted) {
          context.go('/terminal');
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.kSurface,
        body: Column(
          children: [
            const _Header(),
            Expanded(
              child: Row(
                children: [
                  Expanded(flex: 3, child: _ProductPane()),
                  Container(width: 1, color: AppColors.kDivider),
                  Expanded(flex: 2, child: _OrderPanel()),
                ],
              ),
            ),
            const _Footer(),
          ],
        ),
      ),
    );
  }
}

class _Header extends ConsumerWidget {
  const _Header();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sync = ref.watch(syncStatusProvider).valueOrNull;
    final user = ref.watch(authNotifierProvider).valueOrNull;
    final statusText = sync == null
        ? 'Checking sync'
        : sync.isOffline
            ? 'Offline'
            : sync.pendingCount > 0
                ? '${sync.pendingCount} pending'
                : 'Synced';
    final statusColor = sync?.isOffline == true
        ? AppColors.kError
        : sync != null && sync.pendingCount > 0
            ? AppColors.kWarning
            : AppColors.kSuccess;

    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.kDivider)),
      ),
      child: Row(
        children: [
          const Text('Famous Gates - POS',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.kSurface,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _avatarWidget(user?.avatar, user?.name ?? 'C', radius: 12),
                const SizedBox(width: 6),
                Text(
                  user?.name.split(' ').first ?? 'Cashier',
                  style: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            width: 8,
            height: 8,
            decoration:
                BoxDecoration(color: statusColor, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
          Text(statusText,
              style: TextStyle(
                  color: statusColor,
                  fontWeight: FontWeight.bold,
                  fontSize: 12)),
          const SizedBox(width: 16),
          InkWell(
            onTap: () async {
              final confirmed = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Logout?'),
                  content: const Text('Are you sure you want to logout?'),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.of(ctx).pop(false),
                        child: const Text('Cancel')),
                    ElevatedButton(
                        onPressed: () => Navigator.of(ctx).pop(true),
                        child: const Text('Logout')),
                  ],
                ),
              );
              if (confirmed == true && context.mounted) {
                await ref.read(authNotifierProvider.notifier).logout();
                if (context.mounted) context.go('/login');
              }
            },
            child: const Icon(Icons.logout, size: 20, color: AppColors.kError),
          ),
        ],
      ),
    );
  }
}

Widget _avatarWidget(String? avatar, String name, {double radius = 14}) {
  return SafeAvatar(imageUrl: avatar, name: name, radius: radius);
}

class _ProductPane extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsState = ref.watch(productsNotifierProvider);
    final categories = productsState.allProducts
        .map((product) => product.category)
        .where((category) => category.isNotEmpty)
        .toSet()
        .toList()
      ..sort();

    return Column(
      children: [
        Container(
          height: 60,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                child: ChoiceChip(
                  label: const Text('All'),
                  selected: productsState.category == null,
                  onSelected: (_) => ref
                      .read(productsNotifierProvider.notifier)
                      .clearCategory(),
                  selectedColor: AppColors.kPrimary,
                  labelStyle: TextStyle(
                    color: productsState.category == null
                        ? Colors.white
                        : AppColors.kTextPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              ...categories.map((category) {
                final selected = productsState.category == category;
                return Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                  child: ChoiceChip(
                    label: Text(category),
                    selected: selected,
                    onSelected: (_) => ref
                        .read(productsNotifierProvider.notifier)
                        .filterByCategory(category),
                    selectedColor: AppColors.kPrimary,
                    labelStyle: TextStyle(
                      color: selected ? Colors.white : AppColors.kTextPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                );
              }),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            onChanged: ref.read(productsNotifierProvider.notifier).search,
            decoration: InputDecoration(
              hintText: 'Search products...',
              prefixIcon: Icon(PhosphorIcons.magnifyingGlass()),
              contentPadding: const EdgeInsets.symmetric(vertical: 0),
            ),
          ),
        ),
        Expanded(
          child: productsState.products.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, _) => _RetryState(
              message: '$error',
              onRetry: ref.read(productsNotifierProvider.notifier).load,
            ),
            data: (products) {
              if (products.isEmpty) {
                return _RetryState(
                  message: 'No products available.',
                  onRetry: ref.read(productsNotifierProvider.notifier).refresh,
                );
              }
              return RefreshIndicator(
                onRefresh: ref.read(productsNotifierProvider.notifier).refresh,
                child: GridView.builder(
                  padding: const EdgeInsets.all(16),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 4,
                    childAspectRatio: 0.8,
                    crossAxisSpacing: 16,
                    mainAxisSpacing: 16,
                  ),
                  itemCount: products.length,
                  itemBuilder: (context, index) =>
                      _ProductCard(product: products[index]),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _ProductCard extends ConsumerWidget {
  const _ProductCard({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => ref.read(cartNotifierProvider.notifier).addItem(product),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Container(
                color: AppColors.kSurface,
                child: Center(
                    child: Icon(PhosphorIcons.package(),
                        size: 48, color: AppColors.kDivider)),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(product.name,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 4),
                  Text(formatKes(product.price),
                      style: const TextStyle(
                          color: AppColors.kAccent,
                          fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OrderPanel extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartNotifierProvider);
    final cartNotifier = ref.read(cartNotifierProvider.notifier);

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Current Order',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          Expanded(
            child: cart.items.isEmpty
                ? const Center(child: Text('No items selected.'))
                : ListView.separated(
                    itemCount: cart.items.length,
                    separatorBuilder: (context, index) =>
                        const Divider(height: 24),
                    itemBuilder: (context, index) =>
                        _OrderItem(item: cart.items[index]),
                  ),
          ),
          const Divider(height: 48),
          _summaryRow('Subtotal', formatKes(cart.subtotal)),
          _summaryRow('VAT (16%)', formatKes(cart.vatAmount)),
          if (cart.discountAmount > 0)
            _summaryRow('Discount', '-${formatKes(cart.discountAmount)}'),
          const SizedBox(height: 8),
          _summaryRow('Total', formatKes(cart.total), isTotal: true),
          const SizedBox(height: 24),
          const Text('Payment Method',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 12),
          Row(
            children: [
              _PaymentButton(
                  icon: PhosphorIcons.money(), label: 'Cash', value: 'cash'),
              _PaymentButton(
                  icon: PhosphorIcons.phone(), label: 'M-Pesa', value: 'mpesa'),
              _PaymentButton(
                  icon: PhosphorIcons.creditCard(),
                  label: 'Card',
                  value: 'card'),
            ],
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed:
                cart.items.isEmpty ? null : () => _charge(context, ref, cart),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.kSuccess,
              minimumSize: const Size(double.infinity, 64),
            ),
            child: Text('CHARGE ${formatKes(cart.total)}',
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          ),
          TextButton(
            onPressed: cart.items.isEmpty
                ? null
                : () async {
                    await ref
                        .read(heldOrdersRepositoryProvider)
                        .holdOrder('Walk-in', cart.items, cart.subtotal);
                    cartNotifier.clearCart();
                    if (context.mounted) {
                      AppNotifier.showSnackBar(context,
                          const SnackBar(content: Text('Order held.')));
                    }
                  },
            child: const Text('Hold order'),
          ),
        ],
      ),
    );
  }

  Widget _summaryRow(String label, String value, {bool isTotal = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style: TextStyle(
              fontSize: isTotal ? 18 : 14,
              fontWeight: isTotal ? FontWeight.bold : FontWeight.normal,
              color:
                  isTotal ? AppColors.kTextPrimary : AppColors.kTextSecondary,
            )),
        Text(value,
            style: TextStyle(
              fontSize: isTotal ? 18 : 14,
              fontWeight: isTotal ? FontWeight.bold : FontWeight.normal,
              color: isTotal ? AppColors.kPrimary : AppColors.kTextPrimary,
            )),
      ],
    );
  }

  Future<void> _charge(
      BuildContext context, WidgetRef ref, CartState cart) async {
    try {
      final repo = ref.read(salesRepositoryProvider);
      final cartNotifier = ref.read(cartNotifierProvider.notifier);
      final branchName = await ref
              .read(secureStorageProvider)
              .read(key: AuthRepository.branchNameKey) ??
          'Famous Gates';
      final user = ref.read(authNotifierProvider).valueOrNull;

      final saleRequest = CreateSaleRequest(
        items: cart.items,
        totalAmount: cart.total,
        customerName: 'Walk-in',
      );
      final sale = await repo.createSale(saleRequest);

      if (sale.offlineQueued) {
        cartNotifier.clearCart();
        if (context.mounted) {
          AppNotifier.showSnackBar(
              context, const SnackBar(content: Text('Sale queued for sync.')));
        }
        return;
      }

      if (cart.paymentMethod == 'mpesa') {
        if (!context.mounted) return;
        final phone = await _askForPhone(context);
        if (phone == null || phone.isEmpty) return;
        final payResult = await repo.payTransaction(
          sale.transactionId,
          PayTransactionRequest(method: 'MPESA', phoneNumber: phone),
        );
        if (!payResult.success) {
          throw Exception(payResult.message ?? 'M-Pesa payment failed.');
        }
        if (payResult.checkoutRequestId != null) {
          final mpesaStatus = await ref
              .read(mpesaStatusProvider(payResult.checkoutRequestId!).future);
          if (!mpesaStatus.isComplete) {
            throw Exception(mpesaStatus.failureReason ??
                'M-Pesa payment did not complete.');
          }
        }
      } else {
        await repo.payTransaction(
          sale.transactionId,
          const PayTransactionRequest(method: 'CASH'),
        );
      }

      await repo.sendRestaurantOrderToKitchen(
        saleRequest,
        paymentMethod: cart.paymentMethod,
      );

      await PrintService().printReceipt(
        SaleResult(
          transactionId: sale.transactionId,
          createdAt: sale.createdAt,
          receiptNumber: sale.receiptNumber,
          cashierName: sale.cashierName ?? user?.name,
          total: sale.total,
          paymentMethod: sale.paymentMethod,
        ),
        cart.items,
        branchName,
      );
      cartNotifier.clearCart();
      if (context.mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Sale completed.')));
      }
    } catch (error) {
      if (context.mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text('$error')));
      }
    }
  }

  Future<String?> _askForPhone(BuildContext context) {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('M-Pesa phone number'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(hintText: '2547XXXXXXXX'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () =>
                  Navigator.of(context).pop(controller.text.trim()),
              child: const Text('Send STK')),
        ],
      ),
    ).whenComplete(controller.dispose);
  }
}

class _OrderItem extends ConsumerWidget {
  const _OrderItem({required this.item});

  final CartItem item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.read(cartNotifierProvider.notifier);
    return Dismissible(
      key: ValueKey(item.productId),
      onDismissed: (_) => cart.removeItem(item.productId),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.name,
                    style: const TextStyle(fontWeight: FontWeight.bold)),
                Text('${item.qty} x ${formatKes(item.unitPrice)}',
                    style: const TextStyle(
                        color: AppColors.kTextSecondary, fontSize: 12)),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Decrease',
            icon: const Icon(Icons.remove_circle_outline),
            onPressed: () => cart.updateQty(item.productId, item.qty - 1),
          ),
          Text('${item.qty}'),
          IconButton(
            tooltip: 'Increase',
            icon: const Icon(Icons.add_circle_outline),
            onPressed: () => cart.updateQty(item.productId, item.qty + 1),
          ),
          SizedBox(
              width: 96,
              child: Text(formatKes(item.lineTotal),
                  textAlign: TextAlign.end,
                  style: const TextStyle(fontWeight: FontWeight.bold))),
        ],
      ),
    );
  }
}

class _PaymentButton extends ConsumerWidget {
  const _PaymentButton(
      {required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(cartNotifierProvider).paymentMethod == value;
    return Expanded(
      child: InkWell(
        onTap: () =>
            ref.read(cartNotifierProvider.notifier).setPaymentMethod(value),
        child: Container(
          margin: const EdgeInsets.only(right: 8),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: selected ? AppColors.kPrimary : Colors.white,
            border: Border.all(
                color: selected ? AppColors.kPrimary : AppColors.kDivider),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            children: [
              Icon(icon,
                  color: selected ? Colors.white : AppColors.kTextSecondary),
              const SizedBox(height: 4),
              Text(label,
                  style: TextStyle(
                    color: selected ? Colors.white : AppColors.kTextSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  )),
            ],
          ),
        ),
      ),
    );
  }
}

class _Footer extends ConsumerWidget {
  const _Footer();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      height: 72,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.kDivider)),
      ),
      child: Row(
        children: [
          _FooterButton(
              icon: PhosphorIcons.plus(),
              label: 'New Order',
              onPressed: ref.read(cartNotifierProvider.notifier).clearCart),
          _FooterButton(
              icon: PhosphorIcons.listBullets(),
              label: 'Recall',
              onPressed: () => _showHeldOrders(context, ref)),
          const Spacer(),
          _FooterButton(
              icon: PhosphorIcons.arrowsClockwise(),
              label: 'Refresh Products',
              onPressed: ref.read(productsNotifierProvider.notifier).refresh),
        ],
      ),
    );
  }

  Future<void> _showHeldOrders(BuildContext context, WidgetRef ref) async {
    final orders = await ref.read(heldOrdersRepositoryProvider).getHeldOrders();
    if (!context.mounted) return;
    showModalBottomSheet<void>(
      context: context,
      builder: (context) => ListView(
        children: [
          const ListTile(title: Text('Held Orders')),
          if (orders.isEmpty) const ListTile(title: Text('No held orders.')),
          ...orders.map((order) => ListTile(
                title: Text(order.label ?? order.id),
                subtitle: Text(formatKes(order.subtotal)),
                onTap: () async {
                  ref.read(cartNotifierProvider.notifier).restore(order.items);
                  await ref
                      .read(heldOrdersRepositoryProvider)
                      .deleteHeldOrder(order.id);
                  if (context.mounted) Navigator.of(context).pop();
                },
              )),
        ],
      ),
    );
  }
}

class _FooterButton extends StatelessWidget {
  const _FooterButton(
      {required this.icon, required this.label, required this.onPressed});

  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 16),
      child: OutlinedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, size: 20),
        label: Text(label),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.kTextPrimary,
          side: const BorderSide(color: AppColors.kDivider),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      ),
    );
  }
}

class _RetryState extends StatelessWidget {
  const _RetryState({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}
