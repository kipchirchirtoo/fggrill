import 'package:flutter/material.dart';
import 'mobile_shell.dart';

/// A stat-card grid that adapts its column count based on available width.
///
/// Applies skill: flutter-build-responsive-layout
/// Uses LayoutBuilder + SliverGridDelegateWithMaxCrossAxisExtent so the grid
/// always looks correct whether the app is running on a small phone, a tablet,
/// or a desktop window — without checking device type.
class AdaptiveStatGrid extends StatelessWidget {
  const AdaptiveStatGrid({
    super.key,
    required this.stats,
    this.tileMinWidth = 160.0,
    this.childAspectRatio = 1.35,
  });

  final List<_StatDef> stats;

  /// Minimum width each tile should occupy before a new column is added.
  final double tileMinWidth;

  /// Height-to-width ratio for each tile.
  final double childAspectRatio;

  @override
  Widget build(BuildContext context) {
    // skill: flutter-build-responsive-layout — LayoutBuilder reads parent
    // constraints, not device type or MediaQuery.
    return LayoutBuilder(
      builder: (context, constraints) {
        // Compute safe column count from available width
        final cols =
            (constraints.maxWidth / tileMinWidth).floor().clamp(2, 4);
        return GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: cols,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: childAspectRatio,
          children: stats
              .map((s) => MobileStatCard(
                    label: s.label,
                    value: s.value,
                    icon: s.icon,
                    color: s.color,
                    subtitle: s.subtitle,
                  ))
              .toList(),
        );
      },
    );
  }
}

/// Descriptor passed to [AdaptiveStatGrid].
class _StatDef {
  const _StatDef({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.subtitle,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final String? subtitle;
}

/// Convenience factory — same API as MobileStatCard but returns a [_StatDef].
_StatDef statDef({
  required String label,
  required String value,
  required IconData icon,
  required Color color,
  String? subtitle,
}) =>
    _StatDef(
        label: label,
        value: value,
        icon: icon,
        color: color,
        subtitle: subtitle);
