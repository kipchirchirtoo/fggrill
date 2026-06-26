import 'package:flutter/material.dart';

/// Three-tier green/orange/red badge matching the backend's `flag` field
/// (within tolerance / moderate variance / significant variance).
class ControlVarianceBadge extends StatelessWidget {
  const ControlVarianceBadge({
    super.key,
    required this.flag,
    required this.label,
  });

  final String flag; // 'green' | 'orange' | 'red'
  final String label;

  Color get _color {
    switch (flag) {
      case 'red':
        return const Color(0xFFD32F2F);
      case 'orange':
        return const Color(0xFFF9A825);
      default:
        return const Color(0xFF2E7D32);
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _color;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.4), width: 1),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 12),
      ),
    );
  }
}
