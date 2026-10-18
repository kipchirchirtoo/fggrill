import 'package:famous_gates_app/core/branding/print_branding.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Sotik prints as KLUB DIAMOND', () {
    test('recognised by branch id or by any Sotik name', () {
      expect(PrintBranding.forBranch(branchId: '4'), isNotNull);
      expect(PrintBranding.forBranch(branchName: 'SOTIK'), isNotNull);
      expect(PrintBranding.forBranch(branchName: 'Sotik Main Bar POS 1'), isNotNull);
      expect(PrintBranding.forBranch(branchId: '4', branchName: 'Anything'), isNotNull);
    });

    test('every other branch keeps FamousGate branding (null = unchanged)', () {
      for (final name in ['Kyogong', 'BOMET TOWN', 'KAPLONG', 'MOGOGOSHIEK', 'LITEIN', 'GRILL']) {
        expect(PrintBranding.forBranch(branchName: name), isNull, reason: name);
      }
      expect(PrintBranding.forBranch(branchId: '2', branchName: 'BOMET TOWN'), isNull);
      expect(PrintBranding.forBranch(), isNull);
    });

    test('carries no FamousGate contact details', () {
      const b = PrintBranding.klubDiamond;
      expect(b.companyName, 'KLUB DIAMOND');
      expect(b.address, isEmpty);
      expect(b.phone, isEmpty);
      expect(b.email, isEmpty);
    });

    test('rebrandText replaces every spelling of the FamousGate name', () {
      const b = PrintBranding.klubDiamond;
      expect(b.rebrandText('Welcome to FamousGate Hotels'), 'Welcome to KLUB DIAMOND');
      expect(b.rebrandText('FAMOUS GATES HOTEL'), 'KLUB DIAMOND');
      expect(b.rebrandText('Famous Gate'), 'KLUB DIAMOND');
      expect(b.rebrandText('Thank you, come again'), 'Thank you, come again');
      expect(b.rebrandText(null), '');
    });
  });
}
