import 'package:flutter/material.dart';
import '../stock_take/providers/stock_take_provider.dart';
import '../stock_take/stock_take_page.dart';

/// Store Stocktake — embeds StockTakePage directly so store items load
/// immediately when the user navigates to this section.
class StoreStocktakeScreen extends StatelessWidget {
  const StoreStocktakeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const StockTakePage(stockTakeType: StockTakeType.store);
  }
}
