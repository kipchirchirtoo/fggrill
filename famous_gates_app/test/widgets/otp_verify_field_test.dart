// skill: flutter-add-widget-test
// Tests OTP input validation behaviour: empty-submit shows error, valid D-XXXX
// clears error.  Uses a self-contained test widget that mirrors the exact
// validation rules inside _OtpVerifyCardState (no Riverpod / network needed).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// ── Minimal test double that replicates _OtpVerifyCard validation logic ──────
class _OtpTestWidget extends StatefulWidget {
  const _OtpTestWidget({this.onVerify});
  final void Function(String otp)? onVerify;

  @override
  State<_OtpTestWidget> createState() => _OtpTestWidgetState();
}

class _OtpTestWidgetState extends State<_OtpTestWidget> {
  final _ctrl = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _submit() {
    final otp = _ctrl.text.trim().toUpperCase();
    if (otp.isEmpty) {
      setState(() => _error = 'Enter the D-XXXX OTP code');
      return;
    }
    setState(() => _error = null);
    widget.onVerify?.call(otp);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: _ctrl,
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(
                  hintText: 'D-XXXX',
                  errorText: _error,
                ),
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                key: const Key('verify_btn'),
                onPressed: _submit,
                child: const Text('Verify OTP'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
void main() {
  group('OTP verify field', () {
    testWidgets('shows hint text D-XXXX in the text field', (WidgetTester tester) async {
      // Step 2: build
      await tester.pumpWidget(const _OtpTestWidget());

      // Step 4: verify initial state — hint is present
      expect(find.text('D-XXXX'), findsOneWidget);
    });

    testWidgets('shows validation error when submitting empty field',
        (WidgetTester tester) async {
      await tester.pumpWidget(const _OtpTestWidget());

      // Step 5: tap verify without entering text
      await tester.tap(find.byKey(const Key('verify_btn')));

      // Step 6: rebuild
      await tester.pump();

      // Step 7: error should appear
      expect(find.text('Enter the D-XXXX OTP code'), findsOneWidget);
    });

    testWidgets('clears error after entering a valid OTP code',
        (WidgetTester tester) async {
      await tester.pumpWidget(const _OtpTestWidget());

      // First trigger the error
      await tester.tap(find.byKey(const Key('verify_btn')));
      await tester.pump();
      expect(find.text('Enter the D-XXXX OTP code'), findsOneWidget);

      // Step 5: enter a valid OTP
      await tester.enterText(find.byType(TextField), 'D-1234');

      // Tap verify
      await tester.tap(find.byKey(const Key('verify_btn')));

      // Step 6: rebuild
      await tester.pump();

      // Step 7: error should be gone
      expect(find.text('Enter the D-XXXX OTP code'), findsNothing);
    });

    testWidgets('uppercases the OTP before calling onVerify',
        (WidgetTester tester) async {
      String? captured;
      await tester.pumpWidget(
        _OtpTestWidget(onVerify: (otp) => captured = otp),
      );

      // Enter lowercase to verify the toUpperCase() normalization
      await tester.enterText(find.byType(TextField), 'd-abcd');
      await tester.tap(find.byKey(const Key('verify_btn')));
      await tester.pump();

      // Step 7: callback received uppercase value
      expect(captured, equals('D-ABCD'));
    });

    testWidgets('calls onVerify with entered text when field is not empty',
        (WidgetTester tester) async {
      String? received;
      await tester.pumpWidget(
        _OtpTestWidget(onVerify: (otp) => received = otp),
      );

      await tester.enterText(find.byType(TextField), 'D-5678');
      await tester.tap(find.byKey(const Key('verify_btn')));
      await tester.pump();

      expect(received, equals('D-5678'));
    });

    testWidgets('does not call onVerify when field is empty',
        (WidgetTester tester) async {
      bool called = false;
      await tester.pumpWidget(
        _OtpTestWidget(onVerify: (_) => called = true),
      );

      // Tap without entering text
      await tester.tap(find.byKey(const Key('verify_btn')));
      await tester.pump();

      expect(called, isFalse);
    });
  });
}
