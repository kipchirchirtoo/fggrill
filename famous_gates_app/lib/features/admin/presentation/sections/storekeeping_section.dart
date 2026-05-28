import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import 'central_store_subsections.dart';

enum _StoreTab {
  purchaseOrders,
  grn,
  dispatches,
  stockTakes,
  spoilage,
  stockRequests,
}

class StorekeepingSection extends StatefulWidget {
  const StorekeepingSection({super.key});

  @override
  State<StorekeepingSection> createState() => _StorekeepingSectionState();
}

class _StorekeepingSectionState extends State<StorekeepingSection> {
  _StoreTab _currentTab = _StoreTab.purchaseOrders;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _SubTabBar(
          tabs: _StoreTab.values,
          selected: _currentTab,
          onChanged: (tab) => setState(() => _currentTab = tab),
        ),
        Expanded(child: _buildContent()),
      ],
    );
  }

  Widget _buildContent() {
    return switch (_currentTab) {
      _StoreTab.purchaseOrders => const PurchaseOrdersSection(),
      _StoreTab.grn => const GoodsReceiptGRNSection(),
      _StoreTab.dispatches => const DispatchNotesSection(),
      _StoreTab.stockTakes => const CentralStockTakesSection(),
      _StoreTab.spoilage => const CentralSpoilageSection(),
      _StoreTab.stockRequests => const RequisitionsSection(),
    };
  }
}

class _SubTabBar extends StatelessWidget {
  const _SubTabBar({
    required this.tabs,
    required this.selected,
    required this.onChanged,
  });

  final List<_StoreTab> tabs;
  final _StoreTab selected;
  final ValueChanged<_StoreTab> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56,
      color: Colors.white,
      alignment: Alignment.centerLeft,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
        itemCount: tabs.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (context, index) {
          final tab = tabs[index];
          final isSelected = tab == selected;
          return InkWell(
            borderRadius: BorderRadius.circular(20),
            onTap: () => onChanged(tab),
            child: Container(
              constraints: const BoxConstraints(minWidth: 82),
              padding: const EdgeInsets.symmetric(horizontal: 18),
              decoration: BoxDecoration(
                color: isSelected ? AppColors.kPrimary : Colors.transparent,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isSelected ? AppColors.kPrimary : AppColors.kDivider,
                ),
              ),
              child: Center(
                child: Text(
                  _label(tab),
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    color: isSelected ? Colors.white : AppColors.kTextSecondary,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  String _label(_StoreTab tab) {
    return switch (tab) {
      _StoreTab.purchaseOrders => 'Purchase Orders',
      _StoreTab.grn => 'GRN',
      _StoreTab.dispatches => 'Dispatches',
      _StoreTab.stockTakes => 'Stock Takes',
      _StoreTab.spoilage => 'Spoilage',
      _StoreTab.stockRequests => 'Stock Requests',
    };
  }
}
