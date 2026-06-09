import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.color,
    this.subtitle,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color? color;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.kPrimary;
    return LayoutBuilder(
      builder: (context, constraints) {
        final h = constraints.maxHeight;
        // Very short tiles can't fit a stacked layout — go horizontal.
        final tight = h.isFinite && h < 96;
        final compact = h.isFinite && h < 150;

        if (tight) {
          return _buildTight(c);
        }

        final padding = compact ? 14.0 : 20.0;
        final iconPadding = compact ? 7.0 : 8.0;
        final iconSize = compact ? 18.0 : 20.0;
        final valueSize = compact ? 22.0 : 24.0;
        final verticalGap = compact ? 10.0 : 16.0;

        return Container(
          padding: EdgeInsets.all(padding),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.kDivider),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Container(
                    padding: EdgeInsets.all(iconPadding),
                    decoration: BoxDecoration(
                      color: c.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(icon, color: c, size: iconSize),
                  ),
                  if (subtitle != null) ...[
                    const Spacer(),
                    Flexible(
                      child: Text(
                        subtitle!,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.kTextSecondary,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              SizedBox(height: verticalGap),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  value,
                  maxLines: 1,
                  style: TextStyle(
                    fontSize: valueSize,
                    fontWeight: FontWeight.bold,
                    color: c,
                  ),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: AppColors.kTextSecondary,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // Compact horizontal layout for very short tiles (icon left, text right).
  Widget _buildTight(Color c) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.kDivider),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(
              color: c.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: c, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    value,
                    maxLines: 1,
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: c,
                    ),
                  ),
                ),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.kTextSecondary,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class StatCardRow extends StatelessWidget {
  const StatCardRow({
    super.key,
    required this.cards,
  });

  final List<StatCard> cards;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: cards
          .map(
            (card) => Expanded(
              child: Padding(
                padding: const EdgeInsets.only(right: 16),
                child: card,
              ),
            ),
          )
          .toList(),
    );
  }

  static StatCardRow fromList(List<StatCardData> items) {
    return StatCardRow(
      cards: items
          .map(
            (item) => StatCard(
              label: item.label,
              value: item.value,
              icon: item.icon,
              color: item.color,
              subtitle: item.subtitle,
            ),
          )
          .toList(),
    );
  }
}

class StatCardData {
  const StatCardData({
    required this.label,
    required this.value,
    required this.icon,
    this.color,
    this.subtitle,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color? color;
  final String? subtitle;
}
