import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../data/branch_storekeeper_repository.dart';
import 'branch_po_create_screen.dart';

class SupplierFolioScreen extends ConsumerStatefulWidget {
  const SupplierFolioScreen({
    super.key,
    required this.supplier,
    this.initialPurchaseOrders = const [],
  });

  final Map<String, dynamic> supplier;
  final List<Map<String, dynamic>> initialPurchaseOrders;

  @override
  ConsumerState<SupplierFolioScreen> createState() =>
      _SupplierFolioScreenState();
}

class _SupplierFolioScreenState extends ConsumerState<SupplierFolioScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _loading = true;
  List<Map<String, dynamic>> _pos = [];
  List<Map<String, dynamic>> _grns = [];
  final _currency = NumberFormat.currency(symbol: 'KES ', decimalDigits: 2);
  final _dateFormat = DateFormat('dd MMM yyyy, HH:mm');
  final _shortDate = DateFormat('dd MMM yyyy');

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _pos = List<Map<String, dynamic>>.from(widget.initialPurchaseOrders);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  String get _supplierId => '${widget.supplier['id'] ?? ''}';
  String get _supplierName => '${widget.supplier['name'] ?? 'Supplier'}';
  String get _supplierCode =>
      '${widget.supplier['supplier_code'] ?? widget.supplier['code'] ?? 'LCL'}';

  Future<void> _loadData() async {
    setState(() => _loading = true);
    final repo = ref.read(branchStorekeeperRepositoryProvider);

    try {
      final futures = await Future.wait([
        repo.purchaseOrders(),
        repo.grns(supplierId: _supplierId),
      ]);

      final allPos = futures[0];
      final allGrns = futures[1];

      final filteredPos = allPos.where((po) {
        final poSupplierId = '${po['supplier_id'] ?? ''}';
        final poSupplierName =
            '${po['supplier_name'] ?? po['supplier'] ?? ''}'.toLowerCase();
        return poSupplierId == _supplierId ||
            (poSupplierName.isNotEmpty &&
                poSupplierName == _supplierName.toLowerCase());
      }).toList();

      final filteredGrns = allGrns.where((grn) {
        final grnSupplierId = '${grn['supplier_id'] ?? ''}';
        final grnSupplierName =
            '${grn['supplier_name'] ?? grn['supplier'] ?? ''}'.toLowerCase();
        return grnSupplierId == _supplierId ||
            (grnSupplierName.isNotEmpty &&
                grnSupplierName == _supplierName.toLowerCase());
      }).toList();

      if (mounted) {
        setState(() {
          _pos = filteredPos;
          _grns = filteredGrns;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  num _num(dynamic v) {
    if (v is num) return v;
    return num.tryParse('${v ?? 0}') ?? 0;
  }

  String _formatDate(dynamic dateStr) {
    if (dateStr == null || '$dateStr'.isEmpty) return '—';
    try {
      final parsed = DateTime.parse('$dateStr').toLocal();
      return _dateFormat.format(parsed);
    } catch (_) {
      return '$dateStr';
    }
  }

  String _formatShortDate(dynamic dateStr) {
    if (dateStr == null || '$dateStr'.isEmpty) return '—';
    try {
      final parsed = DateTime.parse('$dateStr').toLocal();
      return _shortDate.format(parsed);
    } catch (_) {
      return '$dateStr';
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final totalPoValue = _pos.fold<num>(
      0,
      (sum, p) => sum + _num(p['total_amount'] ?? p['total'] ?? p['subtotal']),
    );
    final totalGrnValue = _grns.fold<num>(
      0,
      (sum, g) => sum + _num(g['total_value'] ?? g['total_amount'] ?? 0),
    );
    final totalGrnQty = _grns.fold<num>(
      0,
      (sum, g) => sum + _num(g['total_quantity'] ?? 0),
    );

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Supplier Folio - $_supplierName'),
            Text(
              'Code: $_supplierCode · Branch ${_formatSupplierBranch()}',
              style: theme.textTheme.bodySmall?.copyWith(
                color: Colors.white70,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
          ),
          IconButton(
            tooltip: 'New PO',
            icon: const Icon(Icons.add_shopping_cart),
            onPressed: () async {
              final created = await Navigator.of(context).push<bool>(
                MaterialPageRoute(
                  builder: (_) => const BranchPoCreateScreen(),
                ),
              );
              if (created == true) _loadData();
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.amber,
          indicatorWeight: 3,
          tabs: [
            Tab(
              icon: Icon(PhosphorIcons.shoppingCart(), size: 18),
              text: 'Purchase Orders (${_pos.length})',
            ),
            Tab(
              icon: Icon(PhosphorIcons.clipboardText(), size: 18),
              text: 'Goods Receipts (${_grns.length})',
            ),
            Tab(
              icon: Icon(PhosphorIcons.info(), size: 18),
              text: 'Vendor Details',
            ),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                _buildHeroBanner(totalPoValue, totalGrnValue, totalGrnQty),
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildPurchaseOrdersTab(),
                      _buildGrnsTab(),
                      _buildSupplierProfileTab(),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  String _formatSupplierBranch() {
    final b = widget.supplier['branch_id'];
    return b != null ? '$b' : '1 (Kyogong)';
  }

  Widget _buildHeroBanner(
    num totalPoValue,
    num totalGrnValue,
    num totalGrnQty,
  ) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(
          bottom: BorderSide(color: Colors.grey.shade200),
        ),
      ),
      child: LayoutBuilder(builder: (context, constraints) {
        final isWide = constraints.maxWidth > 700;
        final items = [
          _buildKpiCard(
            label: 'Total POs',
            value: '${_pos.length}',
            subvalue: _currency.format(totalPoValue),
            icon: PhosphorIcons.shoppingCart(),
            color: const Color(0xFF1E3A8A),
          ),
          _buildKpiCard(
            label: 'Goods Receipts (GRNs)',
            value: '${_grns.length}',
            subvalue: _currency.format(totalGrnValue),
            icon: PhosphorIcons.checkCircle(),
            color: const Color(0xFF059669),
          ),
          _buildKpiCard(
            label: 'Quantity Received',
            value: totalGrnQty.toStringAsFixed(2),
            subvalue: 'Units / KG Total',
            icon: PhosphorIcons.package(),
            color: const Color(0xFFD97706),
          ),
          _buildKpiCard(
            label: 'Payment Terms',
            value: '${widget.supplier['payment_terms'] ?? 'Cash'}'
                .toUpperCase()
                .replaceAll('_', ' '),
            subvalue:
                'Contact: ${widget.supplier['phone'] ?? widget.supplier['contact_person'] ?? '—'}',
            icon: PhosphorIcons.creditCard(),
            color: const Color(0xFF4B5563),
          ),
        ];

        if (isWide) {
          return Row(
            children: items
                .map((w) => Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        child: w,
                      ),
                    ))
                .toList(),
          );
        } else {
          return Wrap(
            spacing: 8,
            runSpacing: 8,
            children: items
                .map((w) => SizedBox(
                      width: (constraints.maxWidth - 8) / 2,
                      child: w,
                    ))
                .toList(),
          );
        }
      }),
    );
  }

  Widget _buildKpiCard({
    required String label,
    required String value,
    required String subvalue,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.06),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withOpacity(0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: Colors.grey.shade700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: color,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  subvalue,
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey.shade600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPurchaseOrdersTab() {
    if (_pos.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(PhosphorIcons.shoppingCart(),
                size: 56, color: Colors.grey.shade400),
            const SizedBox(height: 12),
            Text(
              'No Purchase Orders for $_supplierName',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Colors.grey.shade700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Create a purchase order to start procuring from this supplier.',
              style: TextStyle(color: Colors.grey.shade500),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              icon: const Icon(Icons.add),
              label: const Text('Create Purchase Order'),
              onPressed: () async {
                final created = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(
                    builder: (_) => const BranchPoCreateScreen(),
                  ),
                );
                if (created == true) _loadData();
              },
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _pos.length,
      itemBuilder: (context, i) {
        final po = _pos[i];
        final poNumber = '${po['po_number'] ?? po['id'] ?? 'PO'}';
        final status = '${po['status'] ?? 'DRAFT'}'.toUpperCase();
        final amount =
            _num(po['total_amount'] ?? po['total'] ?? po['subtotal']);
        final date = _formatDate(po['created_at'] ?? po['order_date']);
        final items = (po['items'] as List?) ?? [];

        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.shade200),
          ),
          elevation: 0,
          color: Colors.white,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E3A8A).withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(
                            Icons.shopping_bag_outlined,
                            color: Color(0xFF1E3A8A),
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              poNumber,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            Text(
                              'Date: $date',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey.shade600,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    _buildStatusBadge(status),
                  ],
                ),
                const Divider(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Total Value',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade600,
                          ),
                        ),
                        Text(
                          _currency.format(amount),
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF059669),
                          ),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          'Items Count',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade600,
                          ),
                        ),
                        Text(
                          items.isNotEmpty ? '${items.length} items' : '1 item',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                if (items.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: items.map<Widget>((item) {
                        final name =
                            '${item['item_name'] ?? item['name'] ?? item['sku'] ?? 'Item'}';
                        final qty = _num(item['quantity_ordered'] ??
                            item['quantity'] ??
                            item['ordered_quantity']);
                        final unit = '${item['unit'] ?? item['unit_of_measure'] ?? 'units'}';
                        final price = _num(item['unit_price'] ?? 0);
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '• $name ($qty $unit)',
                                style: const TextStyle(fontSize: 13),
                              ),
                              Text(
                                _currency.format(price * qty),
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Colors.grey.shade700,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildGrnsTab() {
    if (_grns.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(PhosphorIcons.clipboardText(),
                size: 56, color: Colors.grey.shade400),
            const SizedBox(height: 12),
            Text(
              'No Goods Receipts for $_supplierName',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Colors.grey.shade700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Goods receipts will appear here as orders are delivered and accepted.',
              style: TextStyle(color: Colors.grey.shade500),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _grns.length,
      itemBuilder: (context, i) {
        final grn = _grns[i];
        final grnNumber = '${grn['grn_number'] ?? grn['id'] ?? 'GRN'}';
        final status = '${grn['status'] ?? 'POSTED'}'.toUpperCase();
        final totalValue = _num(grn['total_value'] ?? grn['total_amount']);
        final totalQty = _num(grn['total_quantity']);
        final date = _formatDate(grn['received_at'] ?? grn['grn_date'] ?? grn['created_at']);
        final items = (grn['items'] as List?) ?? [];

        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.shade200),
          ),
          elevation: 0,
          color: Colors.white,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF059669).withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(
                            Icons.receipt_long_outlined,
                            color: Color(0xFF059669),
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              grnNumber,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            Text(
                              'Received: $date',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey.shade600,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    _buildStatusBadge(status),
                  ],
                ),
                const Divider(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Total Value',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade600,
                          ),
                        ),
                        Text(
                          _currency.format(totalValue),
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF059669),
                          ),
                        ),
                      ],
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          'Quantity Accepted',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade600,
                          ),
                        ),
                        Text(
                          '${totalQty.toStringAsFixed(2)} units',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                if (items.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: items.map<Widget>((item) {
                        final name =
                            '${item['item_name'] ?? item['sku'] ?? 'Item'}';
                        final accepted = _num(item['quantity_accepted'] ??
                            item['quantity_received'] ??
                            item['quantity']);
                        final unit = '${item['unit'] ?? item['unit_of_measure'] ?? 'kg'}';
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2),
                          child: Text(
                            '• $name: $accepted $unit accepted',
                            style: const TextStyle(fontSize: 13),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildSupplierProfileTab() {
    final s = widget.supplier;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.shade200),
          ),
          elevation: 0,
          color: Colors.white,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Business & Contact Information',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 16),
                _buildDetailRow('Vendor Name', '${s['name'] ?? '—'}'),
                _buildDetailRow('Supplier Code', '${s['supplier_code'] ?? '—'}'),
                _buildDetailRow('Contact Person', '${s['contact_person'] ?? '—'}'),
                _buildDetailRow('Phone Number', '${s['phone'] ?? '—'}'),
                _buildDetailRow('Email Address', '${s['email'] ?? '—'}'),
                _buildDetailRow('Physical Address', '${s['address'] ?? s['address_line1'] ?? '—'}'),
                _buildDetailRow('City / Country', '${s['city'] ?? '—'}, ${s['country'] ?? 'Kenya'}'),
                _buildDetailRow('Tax PIN / KRA PIN', '${s['tax_pin'] ?? s['tax_id'] ?? '—'}'),
                _buildDetailRow('VAT Registered', s['vat_registered'] == true ? 'Yes' : 'No'),
                _buildDetailRow('Payment Terms', '${s['payment_terms'] ?? 'Cash'}'.toUpperCase()),
                _buildDetailRow('Credit Days', '${s['payment_terms_days'] ?? '30'} days'),
                _buildDetailRow('Status', '${s['status'] ?? 'ACTIVE'}'.toUpperCase()),
                _buildDetailRow('Created Date', _formatShortDate(s['created_at'])),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 160,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                color: Colors.grey.shade600,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF1E293B),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg = const Color(0xFFE2E8F0);
    Color fg = const Color(0xFF475569);

    if (status.contains('APPROVED') ||
        status.contains('POSTED') ||
        status.contains('RECEIVED') ||
        status.contains('ACTIVE') ||
        status.contains('COMPLETED')) {
      bg = const Color(0xFFDCFCE7);
      fg = const Color(0xFF16A34A);
    } else if (status.contains('PENDING') || status.contains('DRAFT')) {
      bg = const Color(0xFFFEF3C7);
      fg = const Color(0xFFD97706);
    } else if (status.contains('CANCEL')) {
      bg = const Color(0xFFFEE2E2);
      fg = const Color(0xFFDC2626);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status.replaceAll('_', ' '),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.bold,
          color: fg,
        ),
      ),
    );
  }
}
