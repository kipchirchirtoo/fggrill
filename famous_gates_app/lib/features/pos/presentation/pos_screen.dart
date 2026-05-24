import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

class POSScreen extends ConsumerStatefulWidget {
  const POSScreen({super.key});

  @override
  ConsumerState<POSScreen> createState() => _POSScreenState();
}

class _POSScreenState extends ConsumerState<POSScreen> {
  String _selectedCategory = 'Food';
  final List<String> _categories = ['Food', 'Drinks', 'Accommodation', 'Extras'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.kSurface,
      body: Column(
        children: [
          _buildHeader(),
          Expanded(
            child: Row(
              children: [
                Expanded(flex: 3, child: _buildProductGrid()),
                Container(width: 1, color: AppColors.kDivider),
                Expanded(flex: 2, child: _buildOrderPanel()),
              ],
            ),
          ),
          _buildFooter(),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.kDivider)),
      ),
      child: Row(
        children: [
          const Text(
            'Famous Gates - HQ',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
          ),
          const Spacer(),
          _buildHeaderItem(PhosphorIcons.user(), 'John Doe (Cashier)'),
          const SizedBox(width: 24),
          _buildHeaderItem(PhosphorIcons.clock(), '14:30 PM'),
          const SizedBox(width: 24),
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(color: AppColors.kSuccess, shape: BoxShape.circle),
              ),
              const SizedBox(width: 8),
              const Text('Synced', style: TextStyle(color: AppColors.kSuccess, fontWeight: FontWeight.bold, fontSize: 12)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderItem(IconData icon, String label) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppColors.kTextSecondary),
        const SizedBox(width: 8),
        Text(label, style: const TextStyle(color: AppColors.kTextSecondary, fontSize: 14)),
      ],
    );
  }

  Widget _buildProductGrid() {
    return Column(
      children: [
        // Category Tabs
        Container(
          height: 60,
          padding: const EdgeInsets.symmetric(horizontal: 16),
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
        ),
        // Search Bar
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Search products...',
              prefixIcon: Icon(PhosphorIcons.magnifyingGlass()),
              contentPadding: const EdgeInsets.symmetric(vertical: 0),
            ),
          ),
        ),
        // Grid
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 4,
              childAspectRatio: 0.8,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
            ),
            itemCount: 20, // Mock
            itemBuilder: (context, index) {
              return _buildProductCard('Product $index', 450.0);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildProductCard(String name, double price) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () {},
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Container(
                color: AppColors.kSurface,
                child: Center(child: Icon(PhosphorIcons.package(), size: 48, color: AppColors.kDivider)),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: const TextStyle(fontWeight: FontWeight.bold), maxLines: 1, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 4),
                  Text('KES ${price.toStringAsFixed(2)}', style: const TextStyle(color: AppColors.kAccent, fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOrderPanel() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Current Order', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          Expanded(
            child: ListView.separated(
              itemCount: 3, // Mock
              separatorBuilder: (context, index) => const Divider(height: 24),
              itemBuilder: (context, index) {
                return _buildOrderItem('Mock Item $index', 1, 450.0);
              },
            ),
          ),
          const Divider(height: 48),
          _buildSummaryRow('Subtotal', 'KES 1,350.00'),
          _buildSummaryRow('VAT (16%)', 'KES 216.00'),
          const SizedBox(height: 8),
          _buildSummaryRow('Total', 'KES 1,566.00', isTotal: true),
          const SizedBox(height: 24),
          const Text('Payment Method', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 12),
          Row(
            children: [
              _buildPaymentIcon(PhosphorIcons.money(), 'Cash', true),
              _buildPaymentIcon(PhosphorIcons.phone(), 'M-Pesa', false),
              _buildPaymentIcon(PhosphorIcons.creditCard(), 'Card', false),
            ],
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.kSuccess,
              minimumSize: const Size(double.infinity, 64),
            ),
            child: const Text('CHARGE KES 1,566.00', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderItem(String name, int qty, double price) {
    return Row(
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(name, style: const TextStyle(fontWeight: FontWeight.bold)),
            Text('Qty: $qty x KES ${price.toStringAsFixed(2)}', style: const TextStyle(color: AppColors.kTextSecondary, fontSize: 12)),
          ],
        ),
        const Spacer(),
        Text('KES ${(qty * price).toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool isTotal = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(
          fontSize: isTotal ? 18 : 14,
          fontWeight: isTotal ? FontWeight.bold : FontWeight.normal,
          color: isTotal ? AppColors.kTextPrimary : AppColors.kTextSecondary,
        )),
        Text(value, style: TextStyle(
          fontSize: isTotal ? 18 : 14,
          fontWeight: isTotal ? FontWeight.bold : FontWeight.normal,
          color: isTotal ? AppColors.kPrimary : AppColors.kTextPrimary,
        )),
      ],
    );
  }

  Widget _buildPaymentIcon(IconData icon, String label, bool isSelected) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.kPrimary : Colors.white,
          border: Border.all(color: isSelected ? AppColors.kPrimary : AppColors.kDivider),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            Icon(icon, color: isSelected ? Colors.white : AppColors.kTextSecondary),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(
              color: isSelected ? Colors.white : AppColors.kTextSecondary,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            )),
          ],
        ),
      ),
    );
  }

  Widget _buildFooter() {
    return Container(
      height: 72,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.kDivider)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.start,
        children: [
          _buildFooterButton(PhosphorIcons.plus(), 'New Order'),
          _buildFooterButton(PhosphorIcons.pause(), 'Hold Order'),
          _buildFooterButton(PhosphorIcons.listBullets(), 'Recall'),
          const Spacer(),
          _buildFooterButton(PhosphorIcons.chartLine(), 'Daily Summary', color: AppColors.kPrimary),
        ],
      ),
    );
  }

  Widget _buildFooterButton(IconData icon, String label, {Color? color}) {
    return Padding(
      padding: const EdgeInsets.only(right: 16),
      child: OutlinedButton.icon(
        onPressed: () {},
        icon: Icon(icon, size: 20),
        label: Text(label),
        style: OutlinedButton.styleFrom(
          foregroundColor: color ?? AppColors.kTextPrimary,
          side: BorderSide(color: color?.withValues(alpha: 0.5) ?? AppColors.kDivider),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      ),
    );
  }
}
