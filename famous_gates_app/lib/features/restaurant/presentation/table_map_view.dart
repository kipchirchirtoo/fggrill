import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

class TableMapView extends StatelessWidget {
  const TableMapView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Restaurant Tables'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          _buildStatusLegend(),
          Expanded(
            child: GridView.builder(
              padding: const EdgeInsets.all(24),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 5,
                crossAxisSpacing: 16,
                mainAxisSpacing: 16,
              ),
              itemCount: 25,
              itemBuilder: (context, index) {
                final status = index % 3 == 0 ? 'Occupied' : (index % 5 == 0 ? 'Bill Requested' : 'Free');
                return _buildTableItem(context, 'Table ${index + 1}', status);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusLegend() {
    return Container(
      padding: const EdgeInsets.all(16),
      color: Colors.white,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _buildLegendItem('Free', AppColors.kSuccess),
          const SizedBox(width: 24),
          _buildLegendItem('Occupied', AppColors.kWarning),
          const SizedBox(width: 24),
          _buildLegendItem('Bill Requested', AppColors.kError),
        ],
      ),
    );
  }

  Widget _buildLegendItem(String label, Color color) {
    return Row(
      children: [
        Container(width: 12, height: 12, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildTableItem(BuildContext context, String name, String status) {
    Color color;
    switch (status) {
      case 'Occupied': color = AppColors.kWarning; break;
      case 'Bill Requested': color = AppColors.kError; break;
      default: color = AppColors.kSuccess;
    }

    return Card(
      elevation: 0,
      color: color.withOpacity(0.1),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: color, width: 2),
      ),
      child: InkWell(
        onTap: () {},
        borderRadius: BorderRadius.circular(12),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(PhosphorIcons.house(), color: color, size: 32),
            const SizedBox(height: 8),
            Text(name, style: TextStyle(fontWeight: FontWeight.bold, color: color)),
            const SizedBox(height: 4),
            Text(status, style: TextStyle(fontSize: 10, color: color.withOpacity(0.8))),
          ],
        ),
      ),
    );
  }
}
