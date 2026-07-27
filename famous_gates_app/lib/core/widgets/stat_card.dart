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
        final w = constraints.maxWidth;
        final effectiveH = h.isFinite ? h : (w.isFinite ? w / 2.5 : 120.0);
        final tight = effectiveH < 96;
        final compact = effectiveH < 150;

        final Widget content = tight ? _buildTight(c) : _buildFull(c, compact);

        // When the parent hands us an UNBOUNDED height (e.g. a StatCard placed
        // directly in a Row inside a vertically-scrolling SingleChildScrollView,
        // as the cashier station does), the inner Column(mainAxisSize.max) with
        // a Flexible child receives infinite main-axis constraints. In
        // Flutter 3.44's layout/semantics pipeline that recurses instead of
        // overflowing cleanly, blowing the stack and corrupting the whole
        // frame. Pin the tile to the estimated height so the flex children
        // always get a bounded constraint. Bounded-height callers are
        // unaffected (content is returned as-is).
        return h.isFinite ? content : SizedBox(height: effectiveH, child: content);
      },
    );
  }

  Widget _buildFull(Color c, bool compact) {
    final padding = compact ? 10.0 : 16.0;
    final iconPadding = compact ? 6.0 : 8.0;
    final iconSize = compact ? 16.0 : 20.0;
    final valueSize = compact ? 20.0 : 24.0;
    final verticalGap = compact ? 4.0 : 10.0;

    return Container(
      padding: EdgeInsets.all(padding),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.kDivider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
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
