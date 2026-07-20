import 'package:flutter/material.dart';
import '../stock_take/providers/stock_take_provider.dart';
import '../stock_take/stock_take_page.dart';

/// Bar Stocktake — embeds StockTakePage directly so bar stock loads
/// immediately when the user navigates to this section.
class BarStocktakeScreen extends StatelessWidget {
  final VoidCallback? onBack;
  const BarStocktakeScreen({super.key, this.onBack});

  @override
  Widget build(BuildContext context) {
    return StockTakePage(stockTakeType: StockTakeType.bar, onBack: onBack);
  }
}
