import 'package:flutter_test/flutter_test.dart';

// Helper matching stock_take_page.dart severity evaluation logic
String evaluateSeverity({
  required double opening,
  required double sales,
  required double sdds,
  required double physical,
  required double largePct,
  required double extremePct,
}) {
  final expectedQty = opening - sales - sdds;
  final actualQty = physical;
  final variance = actualQty - expectedQty;
  final absVariance = variance.abs();
  double variancePercentage = 0;

  if (expectedQty > 0) {
    variancePercentage = (absVariance / expectedQty) * 100;
  } else if (absVariance > 0) {
    variancePercentage = 100.0;
  }

  if (expectedQty >= 1.0) {
    if (variancePercentage >= extremePct) {
      return 'EXTREME';
    } else if (variancePercentage >= largePct) {
      return 'LARGE';
    }
  } else {
    if (absVariance >= 1.0) {
      return 'EXTREME';
    } else if (absVariance >= 0.1) {
      return 'LARGE';
    }
  }
  return 'NORMAL';
}

void main() {
  group('Stocktake Variance Tiered Validation Tests', () {
    test('Normal variance (within thresholds)', () {
      final severity = evaluateSeverity(
        opening: 10.0,
        sales: 2.0,
        sdds: 0.0, // expected closing = 8.0
        physical: 7.9, // variance = 0.1 (1.25%)
        largePct: 3.0,
        extremePct: 10.0,
      );
      expect(severity, 'NORMAL');
    });

    test('Large variance (above large threshold, below extreme)', () {
      final severity = evaluateSeverity(
        opening: 10.0,
        sales: 2.0,
        sdds: 0.0, // expected closing = 8.0
        physical: 7.6, // variance = 0.4 (5.0%)
        largePct: 3.0,
        extremePct: 10.0,
      );
      expect(severity, 'LARGE');
    });

    test('Extreme variance (above extreme threshold)', () {
      final severity = evaluateSeverity(
        opening: 10.0,
        sales: 2.0,
        sdds: 0.0, // expected closing = 8.0
        physical: 7.0, // variance = 1.0 (12.5%)
        largePct: 3.0,
        extremePct: 10.0,
      );
      expect(severity, 'EXTREME');
    });

    test('Near-zero expected quantity fallback - Normal', () {
      final severity = evaluateSeverity(
        opening: 0.5,
        sales: 0.5,
        sdds: 0.0, // expected closing = 0.0
        physical: 0.05, // abs variance = 0.05
        largePct: 3.0,
        extremePct: 10.0,
      );
      expect(severity, 'NORMAL');
    });

    test('Near-zero expected quantity fallback - Large', () {
      final severity = evaluateSeverity(
        opening: 0.5,
        sales: 0.5,
        sdds: 0.0, // expected closing = 0.0
        physical: 0.2, // abs variance = 0.2
        largePct: 3.0,
        extremePct: 10.0,
      );
      expect(severity, 'LARGE');
    });

    test('Near-zero expected quantity fallback - Extreme', () {
      final severity = evaluateSeverity(
        opening: 0.5,
        sales: 0.5,
        sdds: 0.0, // expected closing = 0.0
        physical: 1.2, // abs variance = 1.2
        largePct: 3.0,
        extremePct: 10.0,
      );
      expect(severity, 'EXTREME');
    });
  });
}
