import 'package:flutter/material.dart';

const double _kMobileBreak = 600.0;
const double _kTabletBreak = 960.0;

/// Breakpoint helpers. Use these instead of raw MediaQuery comparisons so
/// thresholds stay consistent across the codebase.
abstract final class ScreenSize {
  /// Phone (< 600 logical pixels wide).
  static bool isMobile(BuildContext ctx) =>
      MediaQuery.of(ctx).size.width < _kMobileBreak;

  /// Tablet (600–959).
  static bool isTablet(BuildContext ctx) {
    final w = MediaQuery.of(ctx).size.width;
    return w >= _kMobileBreak && w < _kTabletBreak;
  }

  /// Desktop / large tablet (≥ 960).
  static bool isDesktop(BuildContext ctx) =>
      MediaQuery.of(ctx).size.width >= _kTabletBreak;

  /// Compact breakpoint — phone OR narrow tablet (< 768).
  static bool isCompact(BuildContext ctx) =>
      MediaQuery.of(ctx).size.width < 768;

  // ── Responsive spacing helpers ──────────────────────────────────────────

  /// Full-bleed content padding. 14px on phone, 24px on desktop.
  static EdgeInsets p(BuildContext ctx) =>
      isMobile(ctx) ? const EdgeInsets.all(14) : const EdgeInsets.all(24);

  /// Horizontal-only content padding.
  static EdgeInsets ph(BuildContext ctx) => isMobile(ctx)
      ? const EdgeInsets.symmetric(horizontal: 14)
      : const EdgeInsets.symmetric(horizontal: 24);

  /// Adaptive section gap: 12px on phone, 20px on desktop.
  static double gap(BuildContext ctx) => isMobile(ctx) ? 12.0 : 20.0;

  /// Adaptive card padding: 12px on phone, 18px on desktop.
  static EdgeInsets card(BuildContext ctx) =>
      isMobile(ctx) ? const EdgeInsets.all(12) : const EdgeInsets.all(18);
}
