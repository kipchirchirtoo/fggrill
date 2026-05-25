import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/theme/app_theme.dart';

// ─── Shared helpers ────────────────────────────────────────────────────────

Widget _header(String title, IconData icon, {String? subtitle}) {
  return Container(
    padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
    decoration: const BoxDecoration(color: Colors.white, border: Border(bottom: BorderSide(color: AppColors.kDivider))),
    child: Row(children: [
      Container(
        width: 40, height: 40,
        decoration: BoxDecoration(color: AppColors.kPrimary.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
        child: Icon(icon, color: AppColors.kPrimary, size: 20),
      ),
      const SizedBox(width: 14),
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.kTextPrimary)),
        if (subtitle != null) Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.kTextSecondary)),
      ]),
    ]),
  );
}

class _StatCard extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color;
  const _StatCard({required this.label, required this.value, required this.icon, required this.color});
  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: AppColors.kDivider.withOpacity(0.5))),
    child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, color: color, size: 18),
      const SizedBox(height: 8),
      Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
      Text(label, style: const TextStyle(fontSize: 11, color: AppColors.kTextSecondary)),
    ])),
  );
}

Widget _table(String title, List<String> cols) => Card(
  elevation: 0,
  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: AppColors.kDivider.withOpacity(0.5))),
  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    Padding(padding: const EdgeInsets.fromLTRB(16, 14, 16, 10), child: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14))),
    const Divider(height: 1),
    const Padding(padding: EdgeInsets.all(20), child: Center(child: Text('No records found', style: TextStyle(color: AppColors.kTextSecondary)))),
  ]),
);

// ─── Goods Receiving ──────────────────────────────────────────────────────

class GoodsReceivingSection extends StatelessWidget {
  const GoodsReceivingSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
    _header('Goods Receiving', PhosphorIcons.packageArrowUp(), subtitle: 'Receive and verify incoming stock deliveries'),
    Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: Column(children: [
      Row(children: [
        Expanded(child: _StatCard(label: 'Expected Today', value: '—', icon: PhosphorIcons.truck(), color: AppColors.kPrimary)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Received', value: '—', icon: PhosphorIcons.checkCircle(), color: Colors.green)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Pending GRN', value: '—', icon: PhosphorIcons.clock(), color: Colors.orange)),
      ]),
      const SizedBox(height: 20),
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        const Text('Incoming Deliveries', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        ElevatedButton.icon(onPressed: () {}, icon: Icon(PhosphorIcons.plus(), size: 14), label: const Text('Record Receipt'), style: ElevatedButton.styleFrom(backgroundColor: AppColors.kPrimary, foregroundColor: Colors.white, minimumSize: const Size(0, 36))),
      ]),
      const SizedBox(height: 12),
      _table('Deliveries', ['PO #', 'Supplier', 'Expected Date', 'Items', 'Status']),
    ]))),
  ]);
}

// ─── Foodstuffs ───────────────────────────────────────────────────────────

class FoodstuffsSection extends StatelessWidget {
  const FoodstuffsSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
    _header('Foodstuffs', PhosphorIcons.cookingPot(), subtitle: 'Central store food items and dry goods inventory'),
    Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: Column(children: [
      Row(children: [
        Expanded(child: _StatCard(label: 'Total Items', value: '—', icon: PhosphorIcons.package(), color: AppColors.kPrimary)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Low Stock', value: '—', icon: PhosphorIcons.warning(), color: Colors.orange)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Out of Stock', value: '—', icon: PhosphorIcons.x(), color: Colors.red)),
      ]),
      const SizedBox(height: 20),
      _table('Foodstuffs Inventory', ['Item', 'Category', 'Unit', 'In Stock', 'Min Level', 'Status']),
    ]))),
  ]);
}

// ─── Bar & Beverages (Store) ──────────────────────────────────────────────

class BarBeveragesStoreSection extends StatelessWidget {
  const BarBeveragesStoreSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
    _header('Bar & Beverages', PhosphorIcons.wine(), subtitle: 'Bar items, spirits, wines and beverage inventory'),
    Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: Column(children: [
      Row(children: [
        Expanded(child: _StatCard(label: 'SKUs', value: '—', icon: PhosphorIcons.wine(), color: AppColors.kPrimary)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Low Stock', value: '—', icon: PhosphorIcons.warning(), color: Colors.orange)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Total Value', value: '—', icon: PhosphorIcons.currencyDollar(), color: Colors.green)),
      ]),
      const SizedBox(height: 20),
      _table('Bar Inventory', ['Item', 'Brand', 'Unit', 'In Stock', 'Min Level', 'Value']),
    ]))),
  ]);
}

// ─── Stationery Items ─────────────────────────────────────────────────────

class StationeryItemsSection extends StatelessWidget {
  const StationeryItemsSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
    _header('Stationery Items', PhosphorIcons.pencil(), subtitle: 'Office and operational stationery inventory'),
    Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: Column(children: [
      Row(children: [
        Expanded(child: _StatCard(label: 'Total Items', value: '—', icon: PhosphorIcons.pencil(), color: AppColors.kPrimary)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Low Stock', value: '—', icon: PhosphorIcons.warning(), color: Colors.orange)),
      ]),
      const SizedBox(height: 20),
      _table('Stationery', ['Item', 'Unit', 'In Stock', 'Reorder Level', 'Last Ordered']),
    ]))),
  ]);
}

// ─── Requisitions ─────────────────────────────────────────────────────────

class RequisitionsSection extends StatelessWidget {
  const RequisitionsSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
    _header('Requisitions', PhosphorIcons.clipboardText(), subtitle: 'Branch stock requisition requests from central store'),
    Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: Column(children: [
      Row(children: [
        Expanded(child: _StatCard(label: 'Pending', value: '—', icon: PhosphorIcons.clock(), color: Colors.orange)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Approved', value: '—', icon: PhosphorIcons.checkCircle(), color: Colors.green)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Fulfilled Today', value: '—', icon: PhosphorIcons.package(), color: AppColors.kPrimary)),
      ]),
      const SizedBox(height: 20),
      _table('Requisitions', ['REQ #', 'Branch', 'Requested By', 'Items', 'Date', 'Status']),
    ]))),
  ]);
}

// ─── Packing ──────────────────────────────────────────────────────────────

class PackingSection extends StatelessWidget {
  const PackingSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
    _header('Packing', PhosphorIcons.package(), subtitle: 'Pack and prepare orders for dispatch to branches'),
    Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: Column(children: [
      Row(children: [
        Expanded(child: _StatCard(label: 'To Pack', value: '—', icon: PhosphorIcons.package(), color: Colors.orange)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Packed Today', value: '—', icon: PhosphorIcons.checkCircle(), color: Colors.green)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Ready to Dispatch', value: '—', icon: PhosphorIcons.truck(), color: AppColors.kPrimary)),
      ]),
      const SizedBox(height: 20),
      _table('Packing Queue', ['Order #', 'Branch', 'Items', 'Packed By', 'Status']),
    ]))),
  ]);
}

// ─── Dispatch & Notes ─────────────────────────────────────────────────────

class DispatchNotesSection extends StatelessWidget {
  const DispatchNotesSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
    _header('Dispatch & Notes', PhosphorIcons.truck(), subtitle: 'Dispatch records and delivery notes'),
    Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: Column(children: [
      Row(children: [
        Expanded(child: _StatCard(label: 'In Transit', value: '—', icon: PhosphorIcons.truck(), color: AppColors.kPrimary)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Delivered Today', value: '—', icon: PhosphorIcons.checkCircle(), color: Colors.green)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Pending Dispatch', value: '—', icon: PhosphorIcons.clock(), color: Colors.orange)),
      ]),
      const SizedBox(height: 20),
      _table('Dispatch Notes', ['DN #', 'Branch', 'Driver', 'Items', 'Dispatched', 'Status']),
    ]))),
  ]);
}

// ─── Purchase Orders ──────────────────────────────────────────────────────

class PurchaseOrdersSection extends StatelessWidget {
  const PurchaseOrdersSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
    _header('Purchase Orders', PhosphorIcons.fileText(), subtitle: 'Create and track supplier purchase orders'),
    Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: Column(children: [
      Row(children: [
        Expanded(child: ElevatedButton.icon(onPressed: () {}, icon: Icon(PhosphorIcons.plus(), size: 14), label: const Text('New Purchase Order'), style: ElevatedButton.styleFrom(backgroundColor: AppColors.kPrimary, foregroundColor: Colors.white))),
      ]),
      const SizedBox(height: 20),
      Row(children: [
        Expanded(child: _StatCard(label: 'Open POs', value: '—', icon: PhosphorIcons.clock(), color: Colors.orange)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Received', value: '—', icon: PhosphorIcons.checkCircle(), color: Colors.green)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Total Value', value: '—', icon: PhosphorIcons.currencyDollar(), color: AppColors.kPrimary)),
      ]),
      const SizedBox(height: 20),
      _table('Purchase Orders', ['PO #', 'Supplier', 'Date', 'Amount', 'Expected', 'Status']),
    ]))),
  ]);
}

// ─── Goods Receipt (GRN) ──────────────────────────────────────────────────

class GoodsReceiptGRNSection extends StatelessWidget {
  const GoodsReceiptGRNSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
    _header('Goods Receipt (GRN)', PhosphorIcons.clipboardText(), subtitle: 'Record and verify goods received against purchase orders'),
    Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: Column(children: [
      Row(children: [
        Expanded(child: _StatCard(label: 'GRNs Today', value: '—', icon: PhosphorIcons.clipboardText(), color: AppColors.kPrimary)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Pending Matching', value: '—', icon: PhosphorIcons.arrowsLeftRight(), color: Colors.orange)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Discrepancies', value: '—', icon: PhosphorIcons.warning(), color: Colors.red)),
      ]),
      const SizedBox(height: 20),
      _table('GRN Register', ['GRN #', 'PO #', 'Supplier', 'Received Date', 'Received By', 'Status']),
    ]))),
  ]);
}

// ─── Drivers ──────────────────────────────────────────────────────────────

class DriversSection extends StatelessWidget {
  const DriversSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
    _header('Drivers', PhosphorIcons.users(), subtitle: 'Manage fleet drivers and delivery assignments'),
    Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: Column(children: [
      Row(children: [
        Expanded(child: _StatCard(label: 'Active Drivers', value: '—', icon: PhosphorIcons.users(), color: AppColors.kPrimary)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'On Route', value: '—', icon: PhosphorIcons.truck(), color: Colors.blue)),
        const SizedBox(width: 12),
        Expanded(child: _StatCard(label: 'Available', value: '—', icon: PhosphorIcons.checkCircle(), color: Colors.green)),
      ]),
      const SizedBox(height: 20),
      _table('Drivers', ['Name', 'Vehicle', 'Status', 'Current Route', 'Last Active']),
    ]))),
  ]);
}

// ─── Central Reports ──────────────────────────────────────────────────────

class CentralReportsSection extends StatelessWidget {
  const CentralReportsSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
    _header('Central Reports', PhosphorIcons.chartBar(), subtitle: 'Central store analytics and operational reports'),
    Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: Column(children: [
      _ReportItem(title: 'Stock Valuation Report', icon: PhosphorIcons.package()),
      _ReportItem(title: 'Purchase Summary', icon: PhosphorIcons.shoppingBag()),
      _ReportItem(title: 'Dispatch Report', icon: PhosphorIcons.truck()),
      _ReportItem(title: 'Low Stock Alert', icon: PhosphorIcons.warning()),
      _ReportItem(title: 'Supplier Performance', icon: PhosphorIcons.star()),
      _ReportItem(title: 'GRN Discrepancy Report', icon: PhosphorIcons.clipboardText()),
    ]))),
  ]);
}

class _ReportItem extends StatelessWidget {
  final String title;
  final IconData icon;
  const _ReportItem({required this.title, required this.icon});
  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    margin: const EdgeInsets.only(bottom: 8),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10), side: BorderSide(color: AppColors.kDivider.withOpacity(0.5))),
    child: ListTile(
      leading: Icon(icon, color: AppColors.kPrimary, size: 20),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13)),
      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
        OutlinedButton.icon(onPressed: () {}, icon: Icon(PhosphorIcons.fileText(), size: 12), label: const Text('Generate', style: TextStyle(fontSize: 11))),
      ]),
    ),
  );
}
