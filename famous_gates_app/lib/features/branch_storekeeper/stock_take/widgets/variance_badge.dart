import 'package:flutter/material.dart';

class VarianceBadge extends StatelessWidget {
  final int variance;
  final bool hasCount;

  const VarianceBadge({
    super.key,
    required this.variance,
    required this.hasCount,
  });

  @override
  Widget build(BuildContext context) {
    if (!hasCount) {
      return const Text(
        '—',
        style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold),
      );
    }

    Color color;
    String text;

    if (variance == 0) {
      color = const Color(0xFF2E7D32); // Success
      text = '0';
    } else if (variance > 0) {
      color = const Color(0xFFF9A825); // Warning
      text = '+$variance';
    } else {
      color = const Color(0xFFD32F2F); // Error
      text = '$variance';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.4), width: 1),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w800,
          fontSize: 12,
        ),
      ),
    );
  }
}
