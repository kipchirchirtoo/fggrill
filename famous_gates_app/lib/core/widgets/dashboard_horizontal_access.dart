import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'sticky_horizontal_scrollbar.dart';

/// Gives wide dashboard content a synchronized top and bottom horizontal
/// scrollbar on narrower screens without changing the desktop layout.
class DashboardHorizontalAccess extends StatelessWidget {
  const DashboardHorizontalAccess({
    super.key,
    required this.child,
    this.minContentWidth = 0,
    this.activationBreakpoint = 0,
    this.overflowPadding = 0,
    this.bottomSpacing = 10,
    this.topSpacing = 10,
  });

  final Widget child;
  final double minContentWidth;
  final double activationBreakpoint;
  final double overflowPadding;
  final double bottomSpacing;
  final double topSpacing;

  @override
  Widget build(BuildContext context) {
    if (minContentWidth <= 0 || activationBreakpoint <= 0) {
      return child;
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final viewportWidth = constraints.maxWidth.isFinite
            ? constraints.maxWidth
            : MediaQuery.sizeOf(context).width;
        final shouldForceHorizontalAccess = viewportWidth < activationBreakpoint;
        final contentWidth = shouldForceHorizontalAccess
            ? math.max(minContentWidth, viewportWidth + overflowPadding)
            : viewportWidth;

        if (contentWidth <= viewportWidth + 1) {
          return child;
        }

        final mediaQuery = MediaQuery.of(context);

        return StickyHorizontalScrollbar(
          contentWidth: contentWidth,
          bottomSpacing: bottomSpacing,
          topSpacing: topSpacing,
          child: MediaQuery(
            data: mediaQuery.copyWith(
              size: Size(contentWidth, mediaQuery.size.height),
            ),
            child: ConstrainedBox(
              constraints: BoxConstraints(minWidth: contentWidth),
              child: child,
            ),
          ),
        );
      },
    );
  }
}
