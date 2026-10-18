/// Customer-facing paper (bills, receipts) for the Sotik branch is branded KLUB DIAMOND, with
/// nothing of FamousGate on it, and NO LOGO AT ALL: no logo image is ever printed for Sotik.
///
/// Every other branch keeps its existing FamousGate branding, so [forBranch] returns null for
/// them and callers fall through to their normal code.
class PrintBranding {
  const PrintBranding._({required this.companyName});

  /// Printed at the top and in the footer line.
  final String companyName;

  static const PrintBranding klubDiamond =
      PrintBranding._(companyName: 'KLUB DIAMOND');

  /// Sotik is branch id 4 (and every POS/terminal name there starts with "Sotik").
  static bool isSotik({String? branchId, String? branchName}) {
    final id = (branchId ?? '').trim();
    if (id == '4') return true;
    return (branchName ?? '').trim().toLowerCase().contains('sotik');
  }

  /// The Klub Diamond branding for Sotik, or null (= keep FamousGate branding).
  static PrintBranding? forBranch({String? branchId, String? branchName}) =>
      isSotik(branchId: branchId, branchName: branchName) ? klubDiamond : null;

  // Company address / phone / email are intentionally empty for Klub Diamond: those lines are
  // omitted rather than printing FamousGate's details. Add real Klub Diamond contact details
  // here when they are available.
  String get address => '';
  String get phone => '';
  String get email => '';

  static final RegExp _famousGateName = RegExp(
    r'famous\s*gates?(\s*hotels?)?',
    caseSensitive: false,
  );

  /// Replaces any FamousGate wording in template text with the Klub Diamond name.
  String rebrandText(String? text) {
    if (text == null || text.isEmpty) return text ?? '';
    return text.replaceAll(_famousGateName, companyName);
  }
}
