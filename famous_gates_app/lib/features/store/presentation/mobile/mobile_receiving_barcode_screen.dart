import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/platform_utils.dart';
import '../../../../core/widgets/mobile_shell.dart';
import 'mobile_barcode_scan_screen.dart';
import 'mobile_grn_screen.dart';
import 'mobile_stock_take_screen.dart';

/// Entry-point screen for `/central-store/receiving-barcode`.
///
/// On mobile: Shows a MobileShell with three tabs:
///   1. Quick Scan  — barcode lookup
///   2. GRN Receive — scan items into a goods receipt note
///   3. Stock Take  — physical inventory count
///
/// On desktop: Renders a fallback message (handled at router level but kept
/// here as a safety net).
class MobileReceivingBarcodeScreen extends ConsumerWidget {
  const MobileReceivingBarcodeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Safety net: should not reach here on desktop (router guards it)
    if (AppPlatform.isDesktop) {
      return Scaffold(
        appBar: AppBar(
          backgroundColor: AppColors.kPrimary,
          title: const Text('Barcode Receiving',
              style: TextStyle(color: Colors.white)),
        ),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(PhosphorIcons.building(),
                  size: 56, color: AppColors.kTextSecondary.withOpacity(0.4)),
              const SizedBox(height: 16),
              const Text(
                'Use the desktop app',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  fontFamily: 'SF Pro Display',
                  color: AppColors.kTextPrimary,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Barcode scanning is available on the mobile app only.',
                style: TextStyle(
                    color: AppColors.kTextSecondary,
                    fontFamily: 'SF Pro Display'),
              ),
            ],
          ),
        ),
      );
    }

    return MobileShell(
      title: 'Central Store',
      tabs: const [
        MobileTab(
          label: 'Quick Scan',
          icon: Icons.qr_code_scanner_outlined,
          activeIcon: Icons.qr_code_scanner,
          body: _QuickScanTab(),
        ),
        MobileTab(
          label: 'GRN Receive',
          icon: Icons.inventory_2_outlined,
          activeIcon: Icons.inventory_2,
          body: _GrnTab(),
        ),
        MobileTab(
          label: 'Stock Take',
          icon: Icons.checklist_outlined,
          activeIcon: Icons.checklist,
          body: _StockTakeTab(),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Tab Bodies
// ---------------------------------------------------------------------------

/// Quick Scan tab — inline scanner with item result.
class _QuickScanTab extends ConsumerStatefulWidget {
  const _QuickScanTab();

  @override
  ConsumerState<_QuickScanTab> createState() => _QuickScanTabState();
}

class _QuickScanTabState extends ConsumerState<_QuickScanTab> {
  void _openScanner() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => UncontrolledProviderScope(
          container: ProviderScope.containerOf(context),
          child: const MobileBarcodeScanScreen(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 120,
            height: 120,
            decoration: BoxDecoration(
              color: AppColors.kPrimary.withOpacity(0.08),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.qr_code_2,
              size: 56,
              color: AppColors.kPrimary,
            ),
          ),
          const SizedBox(height: 28),
          const Text(
            'Quick Item Lookup',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.kTextPrimary,
              fontFamily: 'SF Pro Display',
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Scan any item barcode to check stock levels, category, and unit info instantly.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              color: AppColors.kTextSecondary,
              fontFamily: 'SF Pro Display',
            ),
          ),
          const SizedBox(height: 40),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _openScanner,
              icon: Icon(PhosphorIcons.magnifyingGlass(), size: 22),
              label: const Text('Scan Barcode'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kPrimary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
                textStyle: const TextStyle(
                  fontFamily: 'SF Pro Display',
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          const _FeatureRow(
            icon: Icons.flash_on_outlined,
            label: 'Works with all standard barcodes & QR codes',
          ),
          const _FeatureRow(
            icon: Icons.offline_bolt_outlined,
            label: 'Scans saved offline — synced automatically',
          ),
          const _FeatureRow(
            icon: Icons.warning_amber_outlined,
            label: 'Low-stock alerts shown on scan',
          ),
        ],
      ),
    );
  }
}

/// GRN Tab — launches the GRN receive flow.
class _GrnTab extends ConsumerStatefulWidget {
  const _GrnTab();

  @override
  ConsumerState<_GrnTab> createState() => _GrnTabState();
}

class _GrnTabState extends ConsumerState<_GrnTab> {
  void _openGrn() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => UncontrolledProviderScope(
          container: ProviderScope.containerOf(context),
          child: const MobileGrnScreen(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 120,
            height: 120,
            decoration: BoxDecoration(
              color: AppColors.kSuccess.withOpacity(0.08),
              shape: BoxShape.circle,
            ),
            child: Icon(
              PhosphorIcons.packageArrowUp(),
              size: 56,
              color: AppColors.kSuccess,
            ),
          ),
          const SizedBox(height: 28),
          const Text(
            'Goods Receipt (GRN)',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.kTextPrimary,
              fontFamily: 'SF Pro Display',
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Select a purchase order, scan incoming items, enter received quantities and submit the GRN.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              color: AppColors.kTextSecondary,
              fontFamily: 'SF Pro Display',
            ),
          ),
          const SizedBox(height: 40),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _openGrn,
              icon: Icon(PhosphorIcons.packageArrowUp(), size: 22),
              label: const Text('Start GRN Receive'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kSuccess,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
                textStyle: const TextStyle(
                  fontFamily: 'SF Pro Display',
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          const _FeatureRow(
            icon: Icons.receipt_long_outlined,
            label: 'Tie to an approved purchase order',
          ),
          const _FeatureRow(
            icon: Icons.qr_code_scanner_outlined,
            label: 'Scan each item barcode to populate GRN lines',
          ),
          const _FeatureRow(
            icon: Icons.check_circle_outline,
            label: 'Enter received vs rejected quantities per item',
          ),
        ],
      ),
    );
  }
}

/// Stock Take Tab — launches the physical inventory count flow.
class _StockTakeTab extends ConsumerStatefulWidget {
  const _StockTakeTab();

  @override
  ConsumerState<_StockTakeTab> createState() => _StockTakeTabState();
}

class _StockTakeTabState extends ConsumerState<_StockTakeTab> {
  void _openStockTake() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => UncontrolledProviderScope(
          container: ProviderScope.containerOf(context),
          child: const MobileStockTakeScreen(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 120,
            height: 120,
            decoration: BoxDecoration(
              color: AppColors.kAccent.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              PhosphorIcons.clipboardText(),
              size: 56,
              color: AppColors.kAccent,
            ),
          ),
          const SizedBox(height: 28),
          const Text(
            'Physical Stock Take',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.kTextPrimary,
              fontFamily: 'SF Pro Display',
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Scan each item on the shelf, enter the physical count, and review variances before submitting.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              color: AppColors.kTextSecondary,
              fontFamily: 'SF Pro Display',
            ),
          ),
          const SizedBox(height: 40),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _openStockTake,
              icon: Icon(PhosphorIcons.clipboardText(), size: 22),
              label: const Text('Start Stock Take'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kAccent,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
                textStyle: const TextStyle(
                  fontFamily: 'SF Pro Display',
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          const _FeatureRow(
            icon: Icons.category_outlined,
            label: 'Filter by category (Foodstuffs, Bar, Stationery)',
          ),
          const _FeatureRow(
            icon: Icons.bar_chart_outlined,
            label: 'Real-time variance vs system stock',
          ),
          const _FeatureRow(
            icon: Icons.cloud_upload_outlined,
            label: 'Submit finalised count to the server',
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Helper widget
// ---------------------------------------------------------------------------

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppColors.kTextSecondary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.kTextSecondary,
                fontFamily: 'SF Pro Display',
              ),
            ),
          ),
        ],
      ),
    );
  }
}
