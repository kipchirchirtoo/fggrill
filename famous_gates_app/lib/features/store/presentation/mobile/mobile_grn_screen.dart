import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:uuid/uuid.dart';

import '../../../../core/database/app_database.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/mobile_shell.dart';
import '../../data/repository.dart';
import 'mobile_barcode_scan_screen.dart';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

final _activePOProvider = StateProvider<Map<String, dynamic>?>((ref) => null);

final _grnScansProvider = StateProvider<List<_GrnLineItem>>((ref) => const []);

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

class _GrnLineItem {
  _GrnLineItem({
    required this.localId,
    required this.itemId,
    required this.itemSku,
    required this.itemName,
    required this.itemUnit,
    required this.quantityReceived,
    required this.quantityAccepted,
    required this.quantityRejected,
    this.expiryDate,
    this.notes,
  });

  final String localId;
  final String itemId;
  final String itemSku;
  final String itemName;
  final String itemUnit;
  double quantityReceived;
  double quantityAccepted;
  double quantityRejected;
  DateTime? expiryDate;
  String? notes;

  _GrnLineItem copyWith({
    double? quantityReceived,
    double? quantityAccepted,
    double? quantityRejected,
    DateTime? expiryDate,
    String? notes,
  }) {
    return _GrnLineItem(
      localId: localId,
      itemId: itemId,
      itemSku: itemSku,
      itemName: itemName,
      itemUnit: itemUnit,
      quantityReceived: quantityReceived ?? this.quantityReceived,
      quantityAccepted: quantityAccepted ?? this.quantityAccepted,
      quantityRejected: quantityRejected ?? this.quantityRejected,
      expiryDate: expiryDate ?? this.expiryDate,
      notes: notes ?? this.notes,
    );
  }

  Map<String, dynamic> toApiMap() => {
        'item_id': itemId,
        'sku': itemSku,
        'quantity_received': quantityReceived,
        'quantity_accepted': quantityAccepted,
        'quantity_rejected': quantityRejected,
        if (expiryDate != null)
          'expiry_date': expiryDate!.toIso8601String().split('T').first,
        if (notes != null) 'notes': notes,
      };
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/// Mobile GRN (Goods Receipt Note) screen.
/// - Select a PO → scan items → enter quantities → submit GRN.
class MobileGrnScreen extends ConsumerStatefulWidget {
  const MobileGrnScreen({super.key});

  @override
  ConsumerState<MobileGrnScreen> createState() => _MobileGrnScreenState();
}

class _MobileGrnScreenState extends ConsumerState<MobileGrnScreen> {
  List<Map<String, dynamic>>? _purchaseOrders;
  bool _loadingPOs = true;
  bool _submitting = false;
  final _invoiceCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadPurchaseOrders();
  }

  @override
  void dispose() {
    _invoiceCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadPurchaseOrders() async {
    setState(() => _loadingPOs = true);
    try {
      final repo = ref.read(storeRepositoryProvider);
      final pos = await repo.getPurchaseOrders(status: 'APPROVED');
      setState(() => _purchaseOrders = pos);
    } catch (e) {
      if (mounted) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text('Failed to load POs: $e'),
              backgroundColor: AppColors.kError));
        }
      }
    } finally {
      if (mounted) setState(() => _loadingPOs = false);
    }
  }

  void _addScanToGrn(Map<String, dynamic> item) {
    final itemId = item['id']?.toString() ?? '';
    final itemSku = item['sku']?.toString() ?? '';
    final itemName = item['name'] ?? item['item_name'] ?? 'Unknown';
    final itemUnit = item['unit']?.toString() ?? 'pcs';
    final isPerishable = item['is_perishable'] == true;

    // If already in list → increment quantity
    final current = ref.read(_grnScansProvider);
    final idx = current.indexWhere((l) => l.itemSku == itemSku);
    if (idx >= 0) {
      final updated = List<_GrnLineItem>.from(current);
      updated[idx] = current[idx].copyWith(
          quantityReceived: current[idx].quantityReceived + 1,
          quantityAccepted: current[idx].quantityAccepted + 1);
      ref.read(_grnScansProvider.notifier).state = updated;
      HapticFeedback.mediumImpact();
      return;
    }

    // New line item
    final newLine = _GrnLineItem(
      localId: const Uuid().v4(),
      itemId: itemId,
      itemSku: itemSku,
      itemName: itemName,
      itemUnit: itemUnit,
      quantityReceived: 1,
      quantityAccepted: 1,
      quantityRejected: 0,
    );

    ref.read(_grnScansProvider.notifier).state = [...current, newLine];
    HapticFeedback.mediumImpact();

    if (isPerishable) {
      _promptExpiry(newLine);
    }
  }

  void _promptExpiry(_GrnLineItem line) {
    showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 7)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 730)),
      helpText: 'Set Expiry for ${line.itemName}',
    ).then((d) {
      if (d != null) {
        final current = List<_GrnLineItem>.from(ref.read(_grnScansProvider));
        final idx = current.indexWhere((l) => l.localId == line.localId);
        if (idx >= 0) {
          current[idx] = current[idx].copyWith(expiryDate: d);
          ref.read(_grnScansProvider.notifier).state = current;
        }
      }
    });
  }

  void _openScanner() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => UncontrolledProviderScope(
          container: ProviderScope.containerOf(context),
          child: MobileBarcodeScanScreen(
            onItemScanned: (item, action) {
              if (action == 'grn' || action == 'stock_take') {
                _addScanToGrn(item);
              }
            },
          ),
        ),
      ),
    );
  }

  Future<void> _submitGrn() async {
    final activePO = ref.read(_activePOProvider);
    final scans = ref.read(_grnScansProvider);
    if (scans.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Scan at least one item before submitting.'),
            backgroundColor: AppColors.kError));
      }
      return;
    }

    final invoiceNo = _invoiceCtrl.text.trim();
    if (invoiceNo.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Enter the supplier invoice number.'),
            backgroundColor: AppColors.kError));
      }
      return;
    }

    setState(() => _submitting = true);
    try {
      final repo = ref.read(storeRepositoryProvider);
      await repo.submitGrn({
        if (activePO != null) 'po_id': activePO['id'],
        'invoice_number': invoiceNo,
        'items': scans.map((l) => l.toApiMap()).toList(),
      });

      // Save scan session to local DB
      final db = ref.read(appDatabaseProvider);
      for (final scan in scans) {
        await db.scanSessionsDao.insertScan(ScanSessionEntry(
          localId: scan.localId,
          sessionType: 'grn',
          sessionRef: activePO?['id']?.toString(),
          barcode: scan.itemSku,
          itemId: scan.itemId,
          itemSku: scan.itemSku,
          itemName: scan.itemName,
          itemUnit: scan.itemUnit,
          scannedQuantity: scan.quantityAccepted,
          systemStock: null,
          scannedAt: DateTime.now().millisecondsSinceEpoch,
          synced: true,
        ));
      }

      // Reset
      ref.read(_grnScansProvider.notifier).state = [];
      ref.read(_activePOProvider.notifier).state = null;
      _invoiceCtrl.clear();

      if (mounted) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text('GRN submitted successfully!'),
              backgroundColor: AppColors.kSuccess));
        }
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text('GRN submission failed: $e'),
              backgroundColor: AppColors.kError));
        }
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final activePO = ref.watch(_activePOProvider);
    final scans = ref.watch(_grnScansProvider);

    return Scaffold(
      backgroundColor: AppColors.kSurface,
      appBar: AppBar(
        backgroundColor: AppColors.kPrimary,
        title: const Text(
          'Goods Receipt Note',
          style: TextStyle(
            color: Colors.white,
            fontFamily: 'SF Pro Display',
            fontWeight: FontWeight.w700,
          ),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          if (scans.isNotEmpty)
            TextButton(
              onPressed: _submitting ? null : _submitGrn,
              child: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : Text(
                      'Submit (${scans.length})',
                      style: const TextStyle(
                        color: AppColors.kAccent,
                        fontWeight: FontWeight.w700,
                        fontFamily: 'SF Pro Display',
                      ),
                    ),
            ),
        ],
      ),
      body: Column(
        children: [
          // PO selector + invoice field
          Container(
            color: AppColors.kCardBg,
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Purchase Order',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.kTextSecondary,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
                const SizedBox(height: 8),
                _loadingPOs
                    ? const LinearProgressIndicator(
                        color: AppColors.kPrimary, minHeight: 2)
                    : DropdownButtonFormField<Map<String, dynamic>>(
                        value: activePO,
                        hint: const Text(
                          'Select PO (optional)',
                          style: TextStyle(
                              fontFamily: 'SF Pro Display', fontSize: 13),
                        ),
                        decoration: InputDecoration(
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8)),
                          filled: true,
                          fillColor: AppColors.kSurface,
                        ),
                        items: [
                          const DropdownMenuItem(
                              value: null,
                              child: Text('Ad-hoc (no PO)',
                                  style:
                                      TextStyle(fontFamily: 'SF Pro Display'))),
                          ...(_purchaseOrders ?? []).map((po) {
                            final poNum = po['po_number'] ?? po['id'] ?? 'PO';
                            final supplier = po['supplier_name'] ?? '';
                            return DropdownMenuItem(
                              value: po,
                              child: Text(
                                '$poNum${supplier.isNotEmpty ? ' – $supplier' : ''}',
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontFamily: 'SF Pro Display', fontSize: 13),
                              ),
                            );
                          }),
                        ],
                        onChanged: (v) =>
                            ref.read(_activePOProvider.notifier).state = v,
                      ),
                const SizedBox(height: 12),
                TextField(
                  controller: _invoiceCtrl,
                  decoration: InputDecoration(
                    labelText: 'Supplier Invoice No. *',
                    isDense: true,
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8)),
                    filled: true,
                    fillColor: AppColors.kSurface,
                    prefixIcon: Icon(PhosphorIcons.receipt(),
                        size: 18, color: AppColors.kTextSecondary),
                  ),
                  style: const TextStyle(fontFamily: 'SF Pro Display'),
                ),
              ],
            ),
          ),

          // Scanned items list
          Expanded(
            child: scans.isEmpty
                ? MobileEmptyState(
                    icon: Icons.qr_code_2,
                    title: 'No items scanned yet',
                    subtitle: 'Tap the scan button below to scan item barcodes',
                    action: _ScanButton(onTap: _openScanner),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: scans.length,
                    itemBuilder: (_, i) {
                      final line = scans[i];
                      return _GrnLineCard(
                        line: line,
                        onUpdate: (updated) {
                          final list = List<_GrnLineItem>.from(scans);
                          list[i] = updated;
                          ref.read(_grnScansProvider.notifier).state = list;
                        },
                        onRemove: () {
                          final list = List<_GrnLineItem>.from(scans)
                            ..removeAt(i);
                          ref.read(_grnScansProvider.notifier).state = list;
                        },
                      );
                    },
                  ),
          ),

          // Bottom scan button (when items exist)
          if (scans.isNotEmpty)
            SafeArea(
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: _ScanButton(onTap: _openScanner),
              ),
            ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// GRN Line Card
// ---------------------------------------------------------------------------

class _GrnLineCard extends StatefulWidget {
  const _GrnLineCard({
    required this.line,
    required this.onUpdate,
    required this.onRemove,
  });

  final _GrnLineItem line;
  final void Function(_GrnLineItem) onUpdate;
  final VoidCallback onRemove;

  @override
  State<_GrnLineCard> createState() => _GrnLineCardState();
}

class _GrnLineCardState extends State<_GrnLineCard> {
  late final TextEditingController _qtyCtrl;
  late final TextEditingController _rejCtrl;

  @override
  void initState() {
    super.initState();
    _qtyCtrl = TextEditingController(
        text: widget.line.quantityReceived.toStringAsFixed(0));
    _rejCtrl = TextEditingController(
        text: widget.line.quantityRejected.toStringAsFixed(0));
  }

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _rejCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    widget.line.itemName,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      fontFamily: 'SF Pro Display',
                      color: AppColors.kTextPrimary,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: widget.onRemove,
                  icon: Icon(PhosphorIcons.trash(),
                      color: AppColors.kError, size: 18),
                  constraints: const BoxConstraints(),
                  padding: EdgeInsets.zero,
                ),
              ],
            ),
            Text(
              'SKU: ${widget.line.itemSku} · ${widget.line.itemUnit}',
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.kTextSecondary,
                fontFamily: 'SF Pro Display',
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _QtyField(
                    label: 'Received',
                    controller: _qtyCtrl,
                    onChanged: (v) {
                      final qty = double.tryParse(v) ?? 0;
                      widget.onUpdate(widget.line.copyWith(
                        quantityReceived: qty,
                        quantityAccepted: qty - widget.line.quantityRejected,
                      ));
                    },
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _QtyField(
                    label: 'Rejected',
                    controller: _rejCtrl,
                    color: AppColors.kError,
                    onChanged: (v) {
                      final rej = double.tryParse(v) ?? 0;
                      widget.onUpdate(widget.line.copyWith(
                        quantityRejected: rej,
                        quantityAccepted: widget.line.quantityReceived - rej,
                      ));
                    },
                  ),
                ),
              ],
            ),
            if (widget.line.expiryDate != null) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(PhosphorIcons.calendar(),
                      size: 12, color: AppColors.kWarning),
                  const SizedBox(width: 4),
                  Text(
                    'Expiry: ${widget.line.expiryDate!.toLocal().toString().split(' ').first}',
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.kWarning,
                      fontFamily: 'SF Pro Display',
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _QtyField extends StatelessWidget {
  const _QtyField({
    required this.label,
    required this.controller,
    required this.onChanged,
    this.color,
  });

  final String label;
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      textAlign: TextAlign.center,
      decoration: InputDecoration(
        labelText: label,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        labelStyle: TextStyle(
          fontSize: 11,
          color: color ?? AppColors.kTextSecondary,
          fontFamily: 'SF Pro Display',
        ),
      ),
      style: TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w600,
        color: color ?? AppColors.kTextPrimary,
        fontFamily: 'SF Pro Display',
      ),
    );
  }
}

class _ScanButton extends StatelessWidget {
  const _ScanButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: onTap,
        icon: Icon(Icons.qr_code_2, size: 20),
        label: const Text('Scan Item'),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.kPrimary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(
            fontFamily: 'SF Pro Display',
            fontWeight: FontWeight.w700,
            fontSize: 15,
          ),
        ),
      ),
    );
  }
}
