import 'package:flutter_test/flutter_test.dart';
import 'package:famous_gates_app/main.dart';

void main() {
  testWidgets('Splash screen shows branding', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const FamousGatesApp());

    // Verify that our branding exists.
    expect(find.text('FAMOUS GATES'), findsOneWidget);
    expect(find.text('HOTEL & RESTAURANT'), findsOneWidget);
  });
}
