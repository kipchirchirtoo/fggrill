import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';

// ─── Shared ────────────────────────────────────────────────────────────────

Widget _header(String title, IconData icon, {String? subtitle}) => Container(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
      decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(bottom: BorderSide(color: AppColors.kDivider))),
      child: Row(children: [
        Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
                color: AppColors.kPrimary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: AppColors.kPrimary, size: 20)),
        const SizedBox(width: 14),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.kTextPrimary)),
          if (subtitle != null)
            Text(subtitle,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.kTextSecondary)),
        ]),
      ]),
    );

class _S extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color;
  const _S(
      {required this.label,
      required this.value,
      required this.icon,
      required this.color});
  @override
  Widget build(BuildContext context) => Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5))),
        child: Padding(
            padding: const EdgeInsets.all(16),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(height: 8),
              Text(value,
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w700)),
              Text(label,
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.kTextSecondary)),
            ])),
      );
}

Widget _t(String title) => Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Text(title,
                style: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 14))),
        const Divider(height: 1),
        const Padding(
            padding: EdgeInsets.all(20),
            child: Center(
                child: Text('No records found',
                    style: TextStyle(color: AppColors.kTextSecondary)))),
      ]),
    );

// ═══════════════════════════════════════════════════════════════════
// BRANCH STORE OPS
// ═══════════════════════════════════════════════════════════════════

class BranchStoreOverviewSection extends StatelessWidget {
  const BranchStoreOverviewSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Branch Store', PhosphorIcons.package(),
            subtitle: 'Branch-level stock and storekeeping overview'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Items in Stock',
                            value: '—',
                            icon: PhosphorIcons.package(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Low Stock Alerts',
                            value: '—',
                            icon: PhosphorIcons.warning(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Pending Requests',
                            value: '—',
                            icon: PhosphorIcons.clock(),
                            color: Colors.blue)),
                  ]),
                  const SizedBox(height: 20),
                  _t('Recent Stock Movements'),
                ]))),
      ]);
}

class ReceiveGoodsSection extends StatelessWidget {
  const ReceiveGoodsSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Receive Goods', PhosphorIcons.packageArrowUp(),
            subtitle: 'Receive and verify incoming stock at branch level'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: ElevatedButton.icon(
                      onPressed: () {
                        final poCtrl = TextEditingController();
                        final supplierCtrl = TextEditingController();
                        showDialog(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Record Goods Receipt'),
                            content: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  TextField(
                                      controller: poCtrl,
                                      decoration: const InputDecoration(
                                          labelText: 'PO Number')),
                                  const SizedBox(height: 12),
                                  TextField(
                                      controller: supplierCtrl,
                                      decoration: const InputDecoration(
                                          labelText: 'Supplier')),
                                ]),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(ctx),
                                  child: const Text('Cancel')),
                              ElevatedButton(
                                  onPressed: () {
                                    Navigator.pop(ctx);
                                    AppNotifier.showSnackBar(
                                        context,
                                        const SnackBar(
                                            content: Text('Receipt recorded')));
                                  },
                                  child: const Text('Record')),
                            ],
                          ),
                        );
                      },
                      icon: Icon(PhosphorIcons.plus(), size: 14),
                      label: const Text('Record Receipt'),
                      style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.kPrimary,
                          foregroundColor: Colors.white,
                          minimumSize: const Size(0, 36)),
                    )),
                  ]),
                  const SizedBox(height: 20),
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Expected Today',
                            value: '—',
                            icon: PhosphorIcons.truck(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Received',
                            value: '—',
                            icon: PhosphorIcons.checkCircle(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Discrepancies',
                            value: '—',
                            icon: PhosphorIcons.warning(),
                            color: Colors.red)),
                  ]),
                  const SizedBox(height: 20),
                  _t('Goods Receipt Log'),
                ]))),
      ]);
}

class BranchSuppliersSection extends StatelessWidget {
  const BranchSuppliersSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Branch Suppliers', PhosphorIcons.users(),
            subtitle: 'Branch-level supplier management'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Active Suppliers',
                            value: '—',
                            icon: PhosphorIcons.users(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    ElevatedButton.icon(
                      onPressed: () {
                        final nameCtrl = TextEditingController();
                        final phoneCtrl = TextEditingController();
                        showDialog(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Add Supplier'),
                            content: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  TextField(
                                      controller: nameCtrl,
                                      decoration: const InputDecoration(
                                          labelText: 'Supplier Name')),
                                  const SizedBox(height: 12),
                                  TextField(
                                      controller: phoneCtrl,
                                      decoration: const InputDecoration(
                                          labelText: 'Phone')),
                                ]),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(ctx),
                                  child: const Text('Cancel')),
                              ElevatedButton(
                                  onPressed: () {
                                    Navigator.pop(ctx);
                                    AppNotifier.showSnackBar(
                                        context,
                                        SnackBar(
                                            content: Text(
                                                'Supplier ${nameCtrl.text} added')));
                                  },
                                  child: const Text('Add')),
                            ],
                          ),
                        );
                      },
                      icon: Icon(PhosphorIcons.plus(), size: 14),
                      label: const Text('Add Supplier'),
                      style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.kPrimary,
                          foregroundColor: Colors.white,
                          minimumSize: const Size(0, 36)),
                    ),
                  ]),
                  const SizedBox(height: 20),
                  _t('Suppliers'),
                ]))),
      ]);
}

class BranchStockTakesSection extends StatelessWidget {
  const BranchStockTakesSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Stock Takes', PhosphorIcons.clipboardText(),
            subtitle: 'Branch inventory stock counts and reconciliation'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Last Stock Take',
                            value: '—',
                            icon: PhosphorIcons.calendar(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Variances',
                            value: '—',
                            icon: PhosphorIcons.warning(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Items Counted',
                            value: '—',
                            icon: PhosphorIcons.package(),
                            color: Colors.green)),
                  ]),
                  const SizedBox(height: 20),
                  Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Stock Take History',
                            style: TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 14)),
                        ElevatedButton.icon(
                          onPressed: () async {
                            final confirm = await showDialog<bool>(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('Start Stock Take'),
                                content: const Text(
                                    'This will begin a new stock count. All items will need to be verified.'),
                                actions: [
                                  TextButton(
                                      onPressed: () =>
                                          Navigator.pop(ctx, false),
                                      child: const Text('Cancel')),
                                  ElevatedButton(
                                      onPressed: () => Navigator.pop(ctx, true),
                                      child: const Text('Start')),
                                ],
                              ),
                            );
                            if (confirm == true && context.mounted) {
                              AppNotifier.showSnackBar(
                                  context,
                                  const SnackBar(
                                      content: Text('Stock take started')));
                            }
                          },
                          icon: Icon(PhosphorIcons.plus(), size: 14),
                          label: const Text('New Stock Take'),
                          style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.kPrimary,
                              foregroundColor: Colors.white,
                              minimumSize: const Size(0, 36)),
                        ),
                      ]),
                  const SizedBox(height: 12),
                  _t('Stock Take Records'),
                ]))),
      ]);
}

class BranchPurchaseOrdersSection extends StatelessWidget {
  const BranchPurchaseOrdersSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Purchase Orders', PhosphorIcons.fileText(),
            subtitle: 'Branch-level purchase orders to central store'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Open POs',
                            value: '—',
                            icon: PhosphorIcons.clock(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Fulfilled',
                            value: '—',
                            icon: PhosphorIcons.checkCircle(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'This Month',
                            value: '—',
                            icon: PhosphorIcons.calendar(),
                            color: AppColors.kPrimary)),
                  ]),
                  const SizedBox(height: 20),
                  Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Purchase Orders',
                            style: TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 14)),
                        ElevatedButton.icon(
                          onPressed: () {
                            final supplierCtrl = TextEditingController();
                            final itemsCtrl = TextEditingController();
                            showDialog(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('New Purchase Order'),
                                content: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      TextField(
                                          controller: supplierCtrl,
                                          decoration: const InputDecoration(
                                              labelText: 'Supplier')),
                                      const SizedBox(height: 12),
                                      TextField(
                                          controller: itemsCtrl,
                                          decoration: const InputDecoration(
                                              labelText:
                                                  'Items (comma-separated)'),
                                          maxLines: 2),
                                    ]),
                                actions: [
                                  TextButton(
                                      onPressed: () => Navigator.pop(ctx),
                                      child: const Text('Cancel')),
                                  ElevatedButton(
                                      onPressed: () {
                                        Navigator.pop(ctx);
                                        AppNotifier.showSnackBar(
                                            context,
                                            const SnackBar(
                                                content: Text(
                                                    'Purchase order created')));
                                      },
                                      child: const Text('Create')),
                                ],
                              ),
                            );
                          },
                          icon: Icon(PhosphorIcons.plus(), size: 14),
                          label: const Text('New PO'),
                          style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.kPrimary,
                              foregroundColor: Colors.white,
                              minimumSize: const Size(0, 36)),
                        ),
                      ]),
                  const SizedBox(height: 12),
                  _t('Purchase Orders'),
                ]))),
      ]);
}

class StoreRequisitionsSection extends StatelessWidget {
  const StoreRequisitionsSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Store Requisitions', PhosphorIcons.shoppingCart(),
            subtitle: 'Request stock from central store'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Pending',
                            value: '—',
                            icon: PhosphorIcons.clock(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Approved',
                            value: '—',
                            icon: PhosphorIcons.checkCircle(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Fulfilled',
                            value: '—',
                            icon: PhosphorIcons.package(),
                            color: AppColors.kPrimary)),
                  ]),
                  const SizedBox(height: 20),
                  Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Requisitions',
                            style: TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 14)),
                        ElevatedButton.icon(
                          onPressed: () {
                            final itemCtrl = TextEditingController();
                            final qtyCtrl = TextEditingController();
                            showDialog(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('New Stock Requisition'),
                                content: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      TextField(
                                          controller: itemCtrl,
                                          decoration: const InputDecoration(
                                              labelText: 'Item Name')),
                                      const SizedBox(height: 12),
                                      TextField(
                                          controller: qtyCtrl,
                                          keyboardType: TextInputType.number,
                                          decoration: const InputDecoration(
                                              labelText: 'Quantity')),
                                    ]),
                                actions: [
                                  TextButton(
                                      onPressed: () => Navigator.pop(ctx),
                                      child: const Text('Cancel')),
                                  ElevatedButton(
                                      onPressed: () {
                                        Navigator.pop(ctx);
                                        AppNotifier.showSnackBar(
                                            context,
                                            const SnackBar(
                                                content: Text(
                                                    'Requisition submitted')));
                                      },
                                      child: const Text('Submit')),
                                ],
                              ),
                            );
                          },
                          icon: Icon(PhosphorIcons.plus(), size: 14),
                          label: const Text('New Request'),
                          style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.kPrimary,
                              foregroundColor: Colors.white,
                              minimumSize: const Size(0, 36)),
                        ),
                      ]),
                  const SizedBox(height: 12),
                  _t('Requisition History'),
                ]))),
      ]);
}

class KitchenUsageSection extends StatelessWidget {
  const KitchenUsageSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Kitchen Usage', PhosphorIcons.cookingPot(),
            subtitle: 'Track ingredients and supplies consumed by kitchen'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Items Used Today',
                            value: '—',
                            icon: PhosphorIcons.cookingPot(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Cost Today',
                            value: '—',
                            icon: PhosphorIcons.currencyDollar(),
                            color: Colors.blue)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'vs Yesterday',
                            value: '—',
                            icon: PhosphorIcons.arrowsLeftRight(),
                            color: Colors.green)),
                  ]),
                  const SizedBox(height: 20),
                  _t('Usage Log'),
                ]))),
      ]);
}

class StockOutSection extends StatelessWidget {
  const StockOutSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Stock Out', PhosphorIcons.arrowUpRight(),
            subtitle: 'Stock issuance and outgoing stock records'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Issued Today',
                            value: '—',
                            icon: PhosphorIcons.arrowUpRight(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Total This Week',
                            value: '—',
                            icon: PhosphorIcons.trendUp(),
                            color: Colors.blue)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Pending Approval',
                            value: '—',
                            icon: PhosphorIcons.clock(),
                            color: Colors.orange)),
                  ]),
                  const SizedBox(height: 20),
                  Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Stock Out Log',
                            style: TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 14)),
                        ElevatedButton.icon(
                          onPressed: () {
                            final itemCtrl = TextEditingController();
                            final qtyCtrl = TextEditingController();
                            final toCtrl = TextEditingController();
                            showDialog(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('Issue Stock'),
                                content: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      TextField(
                                          controller: itemCtrl,
                                          decoration: const InputDecoration(
                                              labelText: 'Item Name')),
                                      const SizedBox(height: 12),
                                      TextField(
                                          controller: qtyCtrl,
                                          keyboardType: TextInputType.number,
                                          decoration: const InputDecoration(
                                              labelText: 'Quantity')),
                                      const SizedBox(height: 12),
                                      TextField(
                                          controller: toCtrl,
                                          decoration: const InputDecoration(
                                              labelText:
                                                  'Issued To (Dept/Person)')),
                                    ]),
                                actions: [
                                  TextButton(
                                      onPressed: () => Navigator.pop(ctx),
                                      child: const Text('Cancel')),
                                  ElevatedButton(
                                      onPressed: () {
                                        Navigator.pop(ctx);
                                        AppNotifier.showSnackBar(
                                            context,
                                            const SnackBar(
                                                content: Text('Stock issued')));
                                      },
                                      child: const Text('Issue')),
                                ],
                              ),
                            );
                          },
                          icon: Icon(PhosphorIcons.plus(), size: 14),
                          label: const Text('Issue Stock'),
                          style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.kPrimary,
                              foregroundColor: Colors.white,
                              minimumSize: const Size(0, 36)),
                        ),
                      ]),
                  const SizedBox(height: 12),
                  _t('Issuance Records'),
                ]))),
      ]);
}

// ═══════════════════════════════════════════════════════════════════
// KITCHEN OPS
// ═══════════════════════════════════════════════════════════════════

class KitchenOpsOverviewSection extends StatelessWidget {
  const KitchenOpsOverviewSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Kitchen Ops Overview', PhosphorIcons.chefHat(),
            subtitle: 'Kitchen operations, stock and production management'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Active Orders',
                            value: '—',
                            icon: PhosphorIcons.clipboardText(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Items in Stock',
                            value: '—',
                            icon: PhosphorIcons.package(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Wastage Today',
                            value: '—',
                            icon: PhosphorIcons.trash(),
                            color: Colors.red)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Low Stock Items',
                            value: '—',
                            icon: PhosphorIcons.warning(),
                            color: Colors.orange)),
                  ]),
                  const SizedBox(height: 20),
                  _t('Active Kitchen Orders'),
                ]))),
      ]);
}

class StockLedgerSection extends StatelessWidget {
  const StockLedgerSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Stock Ledger', PhosphorIcons.bookOpen(),
            subtitle: 'Complete kitchen ingredient and stock ledger'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Total Items',
                            value: '—',
                            icon: PhosphorIcons.package(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Below Reorder',
                            value: '—',
                            icon: PhosphorIcons.warning(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Stock Value',
                            value: '—',
                            icon: PhosphorIcons.currencyDollar(),
                            color: Colors.green)),
                  ]),
                  const SizedBox(height: 20),
                  _t('Stock Ledger'),
                ]))),
      ]);
}

class RequestStockSection extends StatelessWidget {
  const RequestStockSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Request Stock', PhosphorIcons.shoppingCart(),
            subtitle: 'Request ingredients and supplies from branch store'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: ElevatedButton.icon(
                      onPressed: () {
                        final itemCtrl = TextEditingController();
                        final qtyCtrl = TextEditingController();
                        showDialog(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Kitchen Stock Requisition'),
                            content: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  TextField(
                                      controller: itemCtrl,
                                      decoration: const InputDecoration(
                                          labelText: 'Ingredient/Item')),
                                  const SizedBox(height: 12),
                                  TextField(
                                      controller: qtyCtrl,
                                      keyboardType: TextInputType.number,
                                      decoration: const InputDecoration(
                                          labelText: 'Quantity')),
                                ]),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(ctx),
                                  child: const Text('Cancel')),
                              ElevatedButton(
                                  onPressed: () {
                                    Navigator.pop(ctx);
                                    AppNotifier.showSnackBar(
                                        context,
                                        const SnackBar(
                                            content: Text(
                                                'Requisition submitted to store')));
                                  },
                                  child: const Text('Submit')),
                            ],
                          ),
                        );
                      },
                      icon: Icon(PhosphorIcons.plus(), size: 14),
                      label: const Text('New Requisition'),
                      style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.kPrimary,
                          foregroundColor: Colors.white,
                          minimumSize: const Size(0, 36)),
                    )),
                  ]),
                  const SizedBox(height: 20),
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Pending',
                            value: '—',
                            icon: PhosphorIcons.clock(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Approved',
                            value: '—',
                            icon: PhosphorIcons.checkCircle(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Delivered',
                            value: '—',
                            icon: PhosphorIcons.package(),
                            color: AppColors.kPrimary)),
                  ]),
                  const SizedBox(height: 20),
                  _t('Requisition History'),
                ]))),
      ]);
}

class RecipesBOMSection extends StatelessWidget {
  const RecipesBOMSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Recipes & BOM', PhosphorIcons.chefHat(),
            subtitle: 'Recipe management and bill of materials for costing'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(children: [
                          _S(
                              label: 'Recipes',
                              value: '—',
                              icon: PhosphorIcons.chefHat(),
                              color: AppColors.kPrimary),
                        ]),
                        ElevatedButton.icon(
                          onPressed: () {
                            final nameCtrl = TextEditingController();
                            final categoryCtrl = TextEditingController();
                            showDialog(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('Add Recipe'),
                                content: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      TextField(
                                          controller: nameCtrl,
                                          decoration: const InputDecoration(
                                              labelText: 'Recipe Name')),
                                      const SizedBox(height: 12),
                                      TextField(
                                          controller: categoryCtrl,
                                          decoration: const InputDecoration(
                                              labelText:
                                                  'Category (e.g. Main, Starter)')),
                                    ]),
                                actions: [
                                  TextButton(
                                      onPressed: () => Navigator.pop(ctx),
                                      child: const Text('Cancel')),
                                  ElevatedButton(
                                      onPressed: () {
                                        Navigator.pop(ctx);
                                        AppNotifier.showSnackBar(
                                            context,
                                            SnackBar(
                                                content: Text(
                                                    'Recipe "${nameCtrl.text}" added')));
                                      },
                                      child: const Text('Add')),
                                ],
                              ),
                            );
                          },
                          icon: Icon(PhosphorIcons.plus(), size: 14),
                          label: const Text('Add Recipe'),
                          style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.kPrimary,
                              foregroundColor: Colors.white,
                              minimumSize: const Size(0, 36)),
                        ),
                      ]),
                  const SizedBox(height: 20),
                  _t('Recipes'),
                ]))),
      ]);
}

class UsageTrackingSection extends StatelessWidget {
  const UsageTrackingSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Usage Tracking', PhosphorIcons.clipboardText(),
            subtitle: 'Track ingredient consumption per order and shift'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Tracked Today',
                            value: '—',
                            icon: PhosphorIcons.clipboardText(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Cost of Goods',
                            value: '—',
                            icon: PhosphorIcons.currencyDollar(),
                            color: Colors.blue)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Variance',
                            value: '—',
                            icon: PhosphorIcons.warning(),
                            color: Colors.orange)),
                  ]),
                  const SizedBox(height: 20),
                  _t('Usage Log'),
                ]))),
      ]);
}

class RecordWastageSection extends StatelessWidget {
  const RecordWastageSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Record Wastage', PhosphorIcons.trash(),
            subtitle: 'Log and track kitchen food wastage'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: ElevatedButton.icon(
                      onPressed: () {
                        final itemCtrl = TextEditingController();
                        final qtyCtrl = TextEditingController();
                        final reasonCtrl = TextEditingController();
                        showDialog(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Record Wastage'),
                            content: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  TextField(
                                      controller: itemCtrl,
                                      decoration: const InputDecoration(
                                          labelText: 'Item')),
                                  const SizedBox(height: 12),
                                  TextField(
                                      controller: qtyCtrl,
                                      keyboardType: TextInputType.number,
                                      decoration: const InputDecoration(
                                          labelText: 'Quantity Wasted')),
                                  const SizedBox(height: 12),
                                  TextField(
                                      controller: reasonCtrl,
                                      decoration: const InputDecoration(
                                          labelText: 'Reason'),
                                      maxLines: 2),
                                ]),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(ctx),
                                  child: const Text('Cancel')),
                              ElevatedButton(
                                  style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.red),
                                  onPressed: () {
                                    Navigator.pop(ctx);
                                    AppNotifier.showSnackBar(
                                        context,
                                        const SnackBar(
                                            content: Text('Wastage recorded')));
                                  },
                                  child: const Text('Record')),
                            ],
                          ),
                        );
                      },
                      icon: Icon(PhosphorIcons.plus(), size: 14),
                      label: const Text('Record Wastage'),
                      style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.red,
                          foregroundColor: Colors.white,
                          minimumSize: const Size(0, 36)),
                    )),
                  ]),
                  const SizedBox(height: 20),
                  Row(children: [
                    Expanded(
                        child: _S(
                            label: 'Today\'s Wastage',
                            value: '—',
                            icon: PhosphorIcons.trash(),
                            color: Colors.red)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'This Week',
                            value: '—',
                            icon: PhosphorIcons.calendar(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _S(
                            label: 'Cost Lost',
                            value: '—',
                            icon: PhosphorIcons.currencyDollar(),
                            color: Colors.grey)),
                  ]),
                  const SizedBox(height: 20),
                  _t('Wastage Records'),
                ]))),
      ]);
}
