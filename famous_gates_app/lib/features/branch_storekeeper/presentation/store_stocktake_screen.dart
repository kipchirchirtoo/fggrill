import 'package:flutter/material.dart';
import '../stock_take/providers/stock_take_provider.dart';
import '../stock_take/stock_take_page.dart';

/// Launcher wrapper for Store Stocktake screen pointing to the new unified StockTakePage
class StoreStocktakeScreen extends StatefulWidget {
  const StoreStocktakeScreen({super.key});

  @override
  State<StoreStocktakeScreen> createState() => _StoreStocktakeScreenState();
}

class _StoreStocktakeScreenState extends State<StoreStocktakeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _launchStockTake();
    });
  }

  void _launchStockTake() {
    Navigator.push(
      context,
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (context) => const StockTakePage(
          stockTakeType: StockTakeType.store,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : const Color(0xFFF5F7FA),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: const Color(0xFF1565C0).withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.inventory_outlined,
                  size: 64,
                  color: Color(0xFF1565C0),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Store Stock Take',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              const Text(
                'Manage daily physical stock counts and reconcile them against the system.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Colors.grey),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: 280,
                height: 50,
                child: FilledButton.icon(
                  onPressed: _launchStockTake,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF1565C0),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  icon: const Icon(Icons.table_chart_outlined),
                  label: const Text(
                    'Open Spreadsheet Grid',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
