import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

class BarPOSScreen extends ConsumerStatefulWidget {
  const BarPOSScreen({super.key});

  @override
  ConsumerState<BarPOSScreen> createState() => _BarPOSScreenState();
}

class _BarPOSScreenState extends ConsumerState<BarPOSScreen> {
  String _selectedCategory = 'Alcoholic';
  final List<String> _categories = ['Alcoholic', 'Non-alcoholic', 'Mixers', 'Snacks'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.kSurface,
      appBar: AppBar(
        title: const Text('Bar POS'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
      ),
      body: Row(
        children: [
          Expanded(
            flex: 3,
            child: Column(
              children: [
                _buildCategoryTabs(),
                Expanded(child: _buildProductGrid()),
              ],
            ),
          ),
          Container(width: 1, color: AppColors.kDivider),
          Expanded(
            flex: 2,
            child: _buildOrderPanel(),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryTabs() {
    return Container(
      height: 60,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.kDivider)),
      ),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: _categories.length,
        itemBuilder: (context, index) {
          final cat = _categories[index];
          final isSelected = _selectedCategory == cat;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
            child: ChoiceChip(
              label: Text(cat),
              selected: isSelected,
              onSelected: (val) => setState(() => _selectedCategory = cat),
              selectedColor: AppColors.kPrimary,
              labelStyle: TextStyle(
                color: isSelected ? Colors.white : AppColors.kTextPrimary,
                fontWeight: FontWeight.bold,
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildProductGrid() {
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        childAspectRatio: 0.85,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: 15,
      itemBuilder: (context, index) {
        return _buildBarItem('Drink $index', 250.0, index % 5 == 0);
      },
    );
  }

  Widget _buildBarItem(String name, double price, bool lowStock) {
    return Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Container(
              width: double.infinity,
              color: AppColors.kSurface,
              child: Stack(
                children: [
                  Center(child: Icon(PhosphorIcons.wine(), size: 40, color: AppColors.kDivider)),
                  if (lowStock)
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: AppColors.kError, borderRadius: BorderRadius.circular(4)),
                        child: const Text('LOW STOCK', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold)),
                      ),
                    ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                Text('KES ${price.toStringAsFixed(0)}', style: const TextStyle(color: AppColors.kAccent, fontWeight: FontWeight.bold, fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderPanel() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.start,
            children: [
              const Text('Tab: Walk-in', style: TextStyle(fontWeight: FontWeight.bold)),
              const Spacer(),
              TextButton(onPressed: () {}, child: const Text('Open Tab')),
            ],
          ),
          const Divider(),
          const Expanded(child: Center(child: Text('Order items will appear here'))),
          const Divider(),
          ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.kSuccess),
            child: const Text('PROCESS PAYMENT'),
          ),
        ],
      ),
    );
  }
}
