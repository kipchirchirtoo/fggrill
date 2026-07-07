import 'package:flutter_test/flutter_test.dart';

// Helper matching kitchen_stocktake_screen.dart severity evaluation logic
String evaluateKitchenSeverity({
  required double opening,
  required double added,
  required double sold,
  required double spoilage,
  required double closing,
  required double largePct,
  required double extremePct,
}) {
  final expected = opening + added - sold - spoilage;
  final variance = closing - expected;
  final absVariance = variance.abs();

  double variancePercentage = 0;
  if (expected > 0) {
    variancePercentage = (absVariance / expected) * 100;
  } else if (absVariance > 0) {
    variancePercentage = 100.0;
  }

  if (expected >= 1.0) {
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
  group('Kitchen Stocktake Tiered Variance Validation Tests', () {
    test('Normal variance (within thresholds)', () {
      final severity = evaluateKitchenSeverity(
        opening: 5.0,
        added: 15.0,
        sold: 12.0,
        spoilage: 0.0, // expected = 8.0
        closing: 7.9,  // variance = -0.1 (1.25%)
        largePct: 3.0,
        extremePct: 10.0,
      );
      expect(severity, 'NORMAL');
    });

    test('Large variance (above large threshold, below extreme)', () {
      final severity = evaluateKitchenSeverity(
        opening: 5.0,
        added: 15.0,
        sold: 12.0,
        spoilage: 0.0, // expected = 8.0
        closing: 7.6,  // variance = -0.4 (5.0%)
        largePct: 3.0,
        extremePct: 10.0,
      );
      expect(severity, 'LARGE');
    });

    test('Extreme variance (above extreme threshold)', () {
      final severity = evaluateKitchenSeverity(
        opening: 5.0,
        added: 15.0,
        sold: 12.0,
        spoilage: 0.0, // expected = 8.0
        closing: 7.0,  // variance = -1.0 (12.5%)
        largePct: 3.0,
        extremePct: 10.0,
      );
      expect(severity, 'EXTREME');
    });

    test('Low expected quantity fallback - Normal', () {
      final severity = evaluateKitchenSeverity(
        opening: 0.2,
        added: 0.3,
        sold: 0.5,
        spoilage: 0.0, // expected = 0.0
        closing: 0.05, // variance = 0.05
        largePct: 3.0,
        extremePct: 10.0,
      );
      expect(severity, 'NORMAL');
    });

    test('Low expected quantity fallback - Large', () {
      final severity = evaluateKitchenSeverity(
        opening: 0.2,
        added: 0.3,
        sold: 0.5,
        spoilage: 0.0, // expected = 0.0
        closing: 0.2,  // variance = 0.2
        largePct: 3.0,
        extremePct: 10.0,
      );
      expect(severity, 'LARGE');
    });

    test('Low expected quantity fallback - Extreme', () {
      final severity = evaluateKitchenSeverity(
        opening: 0.2,
        added: 0.3,
        sold: 0.5,
        spoilage: 0.0, // expected = 0.0
        closing: 1.2,  // variance = 1.2
        largePct: 3.0,
        extremePct: 10.0,
      );
      expect(severity, 'EXTREME');
    });
  });
}
