import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

class KDSScreen extends StatelessWidget {
  const KDSScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212), // Dark mode for kitchen
      appBar: AppBar(
        title: const Text('Kitchen Display System (KDS)'),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 4,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 0.7,
        ),
        itemCount: 8,
        itemBuilder: (context, index) {
          final isUrgent = index < 2;
          return _buildOrderTicket(context, index + 101, isUrgent);
        },
      ),
    );
  }

  Widget _buildOrderTicket(BuildContext context, int orderNo, bool isUrgent) {
    return Card(
      color: const Color(0xFF1E1E1E),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            color: isUrgent ? AppColors.kError : AppColors.kPrimary,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('#$orderNo', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                const Text('12m', style: TextStyle(color: Colors.white, fontSize: 12)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Table 05 • Waiter John', style: TextStyle(color: Colors.white70, fontSize: 10)),
                const SizedBox(height: 12),
                _buildTicketItem('Grilled Tilapia', 'Well Done', 1),
                _buildTicketItem('Beef Stew', 'No Onions', 2),
                _buildTicketItem('Ugali', '', 3),
              ],
            ),
          ),
          const Spacer(),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {},
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white10,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(0, 40),
                    ),
                    child: const Text('BUMP', style: TextStyle(fontSize: 12)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTicketItem(String name, String notes, int qty) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('$qty', style: const TextStyle(color: AppColors.kAccent, fontWeight: FontWeight.bold)),
              const SizedBox(width: 8),
              Text(name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ],
          ),
          if (notes.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(left: 20),
              child: Text(notes, style: const TextStyle(color: AppColors.kWarning, fontSize: 10)),
            ),
        ],
      ),
    );
  }
}
