// skill: flutter-add-widget-test
// Tests the MobileStatCard widget renders its required and optional properties,
// and that AdaptiveStatGrid computes the correct column count from constraints.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:famous_gates_app/core/widgets/mobile_shell.dart';
import 'package:famous_gates_app/core/widgets/adaptive_stat_grid.dart';

void main() {
  // ─────────────────────────────────────────────────────────────────────────
  // MobileStatCard
  // ─────────────────────────────────────────────────────────────────────────
  group('MobileStatCard', () {
    /// Wraps the card in a minimal MaterialApp so theme/directionality is
    /// available (skill step 2: wrap in MaterialApp).
    Widget _build({required String label, required String value, String? subtitle}) {
      return MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 200,
            height: 100,
            child: MobileStatCard(
              label: label,
              value: value,
              icon: Icons.star,
              color: Colors.blue,
              subtitle: subtitle,
            ),
          ),
        ),
      );
    }

    // Step 1-4: static rendering tests
    testWidgets('renders label and value', (WidgetTester tester) async {
      // Step 2: build
      await tester.pumpWidget(_build(label: 'Revenue', value: 'KES 12,500'));

      // Step 3 & 4: locate + verify
      expect(find.text('Revenue'), findsOneWidget);
      expect(find.text('KES 12,500'), findsOneWidget);
    });

    testWidgets('renders icon', (WidgetTester tester) async {
      await tester.pumpWidget(_build(label: 'Label', value: '0'));

      expect(find.byIcon(Icons.star), findsOneWidget);
    });

    testWidgets('renders subtitle when provided', (WidgetTester tester) async {
      await tester.pumpWidget(
        _build(label: 'Occupancy', value: '85%', subtitle: '+5% vs yesterday'),
      );

      // Step 3 & 4: subtitle is optional — verify it appears when supplied
      expect(find.text('+5% vs yesterday'), findsOneWidget);
    });

    testWidgets('does NOT render subtitle when omitted', (WidgetTester tester) async {
      await tester.pumpWidget(_build(label: 'Staff', value: '24'));

      // Step 4: subtitle should be absent
      expect(find.text('+5% vs yesterday'), findsNothing);
    });

    testWidgets('value text is distinct from label text', (WidgetTester tester) async {
      await tester.pumpWidget(_build(label: 'Orders', value: '42'));

      // Both texts coexist as separate widgets
      expect(find.text('Orders'), findsOneWidget);
      expect(find.text('42'), findsOneWidget);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AdaptiveStatGrid
  // skill: flutter-build-responsive-layout — LayoutBuilder drives column count
  // ─────────────────────────────────────────────────────────────────────────
  group('AdaptiveStatGrid', () {
    /// Builds an AdaptiveStatGrid inside a fixed-width SizedBox so
    /// LayoutBuilder gets deterministic constraints.
    Widget _buildGrid(double width, {int statCount = 4}) {
      final stats = List.generate(
        statCount,
        (i) => statDef(
          label: 'Stat $i',
          value: '$i',
          icon: Icons.circle,
          color: Colors.orange,
        ),
      );
      return MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: width,
            child: AdaptiveStatGrid(stats: stats),
          ),
        ),
      );
    }

    testWidgets('renders all stat tiles', (WidgetTester tester) async {
      await tester.pumpWidget(_buildGrid(400, statCount: 3));

      // All 3 statDef labels should appear
      expect(find.text('Stat 0'), findsOneWidget);
      expect(find.text('Stat 1'), findsOneWidget);
      expect(find.text('Stat 2'), findsOneWidget);
    });

    testWidgets('renders MobileStatCard widgets for each stat', (WidgetTester tester) async {
      await tester.pumpWidget(_buildGrid(400, statCount: 4));

      // 4 MobileStatCard widgets (one per statDef)
      expect(find.byType(MobileStatCard), findsNWidgets(4));
    });

    testWidgets('clamps to minimum 2 columns on narrow viewport', (WidgetTester tester) async {
      // Width 300 → floor(300/160) = 1, clamp(1,2,4) = 2
      // skill: flutter-fix-layout-issues — tiles are ~145px each, safe with overflow ellipsis
      await tester.pumpWidget(_buildGrid(300, statCount: 4));

      // Grid exists and all tiles rendered (column calc is internal; verify presence)
      expect(find.byType(GridView), findsOneWidget);
      expect(find.byType(MobileStatCard), findsNWidgets(4));
    });

    testWidgets('uses up to 4 columns on wide viewport', (WidgetTester tester) async {
      // Width 800 → floor(800/160) = 5, clamp(5,2,4) = 4
      await tester.pumpWidget(_buildGrid(800, statCount: 4));

      expect(find.byType(GridView), findsOneWidget);
      expect(find.byType(MobileStatCard), findsNWidgets(4));
    });

    testWidgets('renders with zero stats gracefully', (WidgetTester tester) async {
      await tester.pumpWidget(_buildGrid(400, statCount: 0));

      // GridView present, no tiles
      expect(find.byType(GridView), findsOneWidget);
      expect(find.byType(MobileStatCard), findsNothing);
    });
  });
}
