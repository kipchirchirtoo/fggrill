import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/repository.dart';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

final _lastScannedProvider = StateProvider<String?>((ref) => null);
final _scannedItemProvider =
    StateProvider<Map<String, dynamic>?>((ref) => null);
final _isLoadingProvider = StateProvider<bool>((ref) => false);
final _flashOnProvider = StateProvider<bool>((ref) => false);

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/// Full-screen barcode scanner for Central Store / Branch Storekeeper.
/// On scan: looks up item in /storekeeping/items and shows a bottom sheet
/// with quick actions (Add to GRN, Add to Stock Take, View Detail).
class MobileBarcodeScanScreen extends ConsumerStatefulWidget {
  const MobileBarcodeScanScreen({super.key, this.onItemScanned});

  /// Optional callback: when a scan result is acted on, pass the item map.
  final void Function(Map<String, dynamic> item, String action)? onItemScanned;

  @override
  ConsumerState<MobileBarcodeScanScreen> createState() =>
      _MobileBarcodeScanScreenState();
}

class _MobileBarcodeScanScreenState
    extends ConsumerState<MobileBarcodeScanScreen> {
  late final MobileScannerController _controller;

  @override
  void initState() {
    super.initState();
    _controller = MobileScannerController(
      detectionSpeed: DetectionSpeed.noDuplicates,
      returnImage: false,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    final barcode = capture.barcodes.firstOrNull;
    if (barcode == null || barcode.rawValue == null) return;
    final code = barcode.rawValue!;

    final last = ref.read(_lastScannedProvider);
    if (last == code) return; // debounce
    ref.read(_lastScannedProvider.notifier).state = code;

    HapticFeedback.lightImpact();
    await _controller.stop();

    ref.read(_isLoadingProvider.notifier).state = true;
    try {
      final repo = ref.read(storeRepositoryProvider);
      final item = await repo.getItemByBarcode(code);
      ref.read(_scannedItemProvider.notifier).state = item;
      if (item != null) {
        _showItemSheet(item);
      } else {
        _showNotFoundSheet(code);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Lookup failed: $e'),
            backgroundColor: AppColors.kError));
      }
    } finally {
      ref.read(_isLoadingProvider.notifier).state = false;
    }
  }

  void _resumeScan() {
    ref.read(_lastScannedProvider.notifier).state = null;
    ref.read(_scannedItemProvider.notifier).state = null;
    _controller.start();
  }

  void _showNotFoundSheet(String code) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => _NotFoundSheet(code: code, onRescan: _resumeScan),
    ).then((_) => _resumeScan());
  }

  void _showItemSheet(Map<String, dynamic> item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ItemSheet(
        item: item,
        onAction: (action) {
          Navigator.pop(context);
          widget.onItemScanned?.call(item, action);
          _resumeScan();
        },
        onClose: () {
          Navigator.pop(context);
          _resumeScan();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(_isLoadingProvider);
    final flashOn = ref.watch(_flashOnProvider);

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Camera feed
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),

          // Scan overlay
          CustomPaint(
            size: MediaQuery.of(context).size,
            painter: _ScanOverlayPainter(),
          ),

          // Top bar
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.black.withOpacity(0.4),
                    ),
                  ),
                  const Expanded(
                    child: Center(
                      child: Text(
                        'Scan Barcode',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                          fontFamily: 'SF Pro Display',
                        ),
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () async {
                      await _controller.toggleTorch();
                      ref.read(_flashOnProvider.notifier).state = !flashOn;
                    },
                    icon: Icon(
                      flashOn ? Icons.flash_on : Icons.flash_off,
                      color: flashOn ? AppColors.kAccent : Colors.white,
                    ),
                    style: IconButton.styleFrom(
                      backgroundColor: Colors.black.withOpacity(0.4),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Scan hint
          Align(
            alignment: Alignment.bottomCenter,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 48),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.55),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: const Text(
                    'Point camera at barcode or QR code',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontFamily: 'SF Pro Display',
                    ),
                  ),
                ),
              ),
            ),
          ),

          // Loading overlay
          if (isLoading)
            Container(
              color: Colors.black.withOpacity(0.55),
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: AppColors.kAccent),
                    SizedBox(height: 14),
                    Text(
                      'Looking up item…',
                      style: TextStyle(
                        color: Colors.white,
                        fontFamily: 'SF Pro Display',
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Scan Overlay Painter
// ---------------------------------------------------------------------------

class _ScanOverlayPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    const scanBoxWidth = 260.0;
    const scanBoxHeight = 180.0;
    final left = (size.width - scanBoxWidth) / 2;
    final top = (size.height - scanBoxHeight) / 2 - 40;

    // Dark overlay excluding scan box
    final path = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
      ..addRRect(RRect.fromRectAndRadius(
        Rect.fromLTWH(left, top, scanBoxWidth, scanBoxHeight),
        const Radius.circular(12),
      ))
      ..fillType = PathFillType.evenOdd;
    canvas.drawPath(
      path,
      Paint()..color = Colors.black.withOpacity(0.55),
    );

    // Corner brackets
    final bracketPaint = Paint()
      ..color = AppColors.kAccent
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    const cs = 24.0; // corner size
    final r = Rect.fromLTWH(left, top, scanBoxWidth, scanBoxHeight);
    // TL
    canvas
      ..drawLine(r.topLeft, r.topLeft.translate(cs, 0), bracketPaint)
      ..drawLine(r.topLeft, r.topLeft.translate(0, cs), bracketPaint)
      // TR
      ..drawLine(r.topRight, r.topRight.translate(-cs, 0), bracketPaint)
      ..drawLine(r.topRight, r.topRight.translate(0, cs), bracketPaint)
      // BL
      ..drawLine(r.bottomLeft, r.bottomLeft.translate(cs, 0), bracketPaint)
      ..drawLine(r.bottomLeft, r.bottomLeft.translate(0, -cs), bracketPaint)
      // BR
      ..drawLine(r.bottomRight, r.bottomRight.translate(-cs, 0), bracketPaint)
      ..drawLine(
          r.bottomRight, r.bottomRight.translate(0, -cs), bracketPaint);
  }

  @override
  bool shouldRepaint(_) => false;
}

// ---------------------------------------------------------------------------
// Item Result Sheet
// ---------------------------------------------------------------------------

class _ItemSheet extends StatelessWidget {
  const _ItemSheet({
    required this.item,
    required this.onAction,
    required this.onClose,
  });

  final Map<String, dynamic> item;
  final void Function(String action) onAction;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final name = item['name'] ?? item['item_name'] ?? 'Unknown Item';
    final sku = item['sku'] ?? '';
    final barcode = item['barcode'] ?? '';
    final category = item['category'] ?? '';
    final unit = item['unit'] ?? '';
    final currentStock = item['current_stock'] ?? item['quantity'] ?? 0;
    final minStock = item['minimum_stock'] ?? item['min_stock'] ?? 0;
    final isPerishable = item['is_perishable'] == true;
    final stockNum = (currentStock is num) ? currentStock.toDouble() : 0.0;
    final minNum = (minStock is num) ? minStock.toDouble() : 0.0;
    final isLow = stockNum <= minNum;

    return Container(
      decoration: const BoxDecoration(
        color: AppColors.kCardBg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Header row
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.kPrimary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(PhosphorIcons.package(),
                    color: AppColors.kPrimary, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.kTextPrimary,
                        fontFamily: 'SF Pro Display',
                      ),
                    ),
                    Text(
                      'SKU: $sku${barcode.isNotEmpty ? ' · $barcode' : ''}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.kTextSecondary,
                        fontFamily: 'SF Pro Display',
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: onClose,
                icon: const Icon(Icons.close, color: AppColors.kTextSecondary),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Chips row
          Wrap(
            spacing: 8,
            children: [
              if (category.isNotEmpty) _Chip(label: category),
              if (unit.isNotEmpty) _Chip(label: unit),
              if (isPerishable)
                _Chip(
                    label: 'Perishable',
                    color: AppColors.kWarning,
                    icon: Icons.thermostat),
              if (isLow)
                _Chip(
                    label: 'Low Stock',
                    color: AppColors.kError,
                    icon: PhosphorIcons.warning()),
            ],
          ),
          const SizedBox(height: 16),

          // Stock row
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.kSurface,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _StockStat(
                    label: 'Current Stock',
                    value: '$stockNum $unit',
                    color: isLow ? AppColors.kError : AppColors.kSuccess),
                Container(width: 1, height: 36, color: Colors.grey.shade200),
                _StockStat(
                    label: 'Min Stock',
                    value: '$minNum $unit',
                    color: AppColors.kTextSecondary),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Actions
          const Text(
            'Quick Actions',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.kTextSecondary,
              fontFamily: 'SF Pro Display',
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _ActionButton(
                  label: 'Add to GRN',
                  icon: PhosphorIcons.packageArrowUp(),
                  color: AppColors.kPrimary,
                  onTap: () => onAction('grn'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _ActionButton(
                  label: 'Stock Take',
                  icon: PhosphorIcons.clipboardText(),
                  color: AppColors.kSuccess,
                  onTap: () => onAction('stock_take'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: _ActionButton(
              label: 'View Item Detail',
              icon: PhosphorIcons.eye(),
              color: AppColors.kTextSecondary,
              onTap: () => onAction('detail'),
              outline: true,
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Not Found Sheet
// ---------------------------------------------------------------------------

class _NotFoundSheet extends StatelessWidget {
  const _NotFoundSheet({required this.code, required this.onRescan});

  final String code;
  final VoidCallback onRescan;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.kCardBg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 32,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 24),
          Icon(PhosphorIcons.magnifyingGlass(),
              size: 48, color: AppColors.kTextSecondary.withOpacity(0.4)),
          const SizedBox(height: 14),
          const Text(
            'Item Not Found',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: AppColors.kTextPrimary,
              fontFamily: 'SF Pro Display',
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'No item matched "$code".\nCheck if the item has been registered in the system.',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.kTextSecondary,
              fontFamily: 'SF Pro Display',
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
                Navigator.pop(context);
                onRescan();
              },
              icon: Icon(PhosphorIcons.arrowsClockwise()),
              label: const Text('Scan Again'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kPrimary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
                textStyle: const TextStyle(
                    fontFamily: 'SF Pro Display',
                    fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

class _Chip extends StatelessWidget {
  const _Chip({required this.label, this.color, this.icon});

  final String label;
  final Color? color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.kPrimary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: c.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: c.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: c),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              color: c,
              fontWeight: FontWeight.w600,
              fontFamily: 'SF Pro Display',
            ),
          ),
        ],
      ),
    );
  }
}

class _StockStat extends StatelessWidget {
  const _StockStat(
      {required this.label, required this.value, required this.color});

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: color,
            fontFamily: 'SF Pro Display',
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(
            fontSize: 10,
            color: AppColors.kTextSecondary,
            fontFamily: 'SF Pro Display',
          ),
        ),
      ],
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
    this.outline = false,
  });

  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
  final bool outline;

  @override
  Widget build(BuildContext context) {
    if (outline) {
      return OutlinedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: 16),
        label: Text(label),
        style: OutlinedButton.styleFrom(
          foregroundColor: color,
          side: BorderSide(color: color.withOpacity(0.5)),
          padding: const EdgeInsets.symmetric(vertical: 12),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle: const TextStyle(
              fontFamily: 'SF Pro Display', fontWeight: FontWeight.w600),
        ),
      );
    }
    return ElevatedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 16),
      label: Text(label),
      style: ElevatedButton.styleFrom(
        backgroundColor: color,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        textStyle: const TextStyle(
            fontFamily: 'SF Pro Display', fontWeight: FontWeight.w600),
      ),
    );
  }
}
