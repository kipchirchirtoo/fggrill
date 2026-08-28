import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:printing/printing.dart';

import '../../../core/utils/api_error_message.dart';
import '../../../core/widgets/app_notifier.dart';
import '../data/repository.dart';
import 'branch_payroll_screen.dart';
import 'payroll_policies_screen.dart';
import 'payroll_adjustments_screen.dart';

/// Unified **Staff Accounts** control panel.
///
/// Combines the three staff-ledger workflows — Credit Bills, Salary Advances and
/// Staff Loans — into one dense, line-of-business style screen: a compact filter
/// strip, a Tax/Total/Paid/Balance-style totals panel, tabbed grids with inline
/// row actions, and a bottom action toolbar. Wired to `/payroll/credit-bills`,
/// `/payroll/advances` and `/payroll/loans`.
class StaffAccountsScreen extends ConsumerStatefulWidget {
  const StaffAccountsScreen({super.key});

  @override
  ConsumerState<StaffAccountsScreen> createState() =>
      _StaffAccountsScreenState();
}

class _StaffAccountsScreenState extends ConsumerState<StaffAccountsScreen> {
  // ── Line-of-business palette ───────────────────────────────────────────────
  static const _header = Color(0xFF2C3E50);
  static const _accent = Color(0xFF2563EB);
  static const _gridHead = Color(0xFFE7EEF5);
  static const _rowAlt = Color(0xFFF6F9FC);
  static const _border = Color(0xFFCBD5E1);
  static const _text = Color(0xFF1E293B);
  static const _muted = Color(0xFF64748B);
  static const _success = Color(0xFF15803D);
  static const _warning = Color(0xFFB45309);
  static const _danger = Color(0xFFB91C1C);

  final NumberFormat _fmt = NumberFormat('#,##0');
  final NumberFormat _fmt2 = NumberFormat('#,##0.00');

  bool _loading = true;
  bool _busy = false;
  String _tab =
      'overview'; // overview | credit | advances | loans | salaries | payroll
  String _payrollSubTab = 'batch'; // batch | deductions | adjustments
  String _status = 'all';
  String _staff = 'all';
  String _query = '';
  DateTime _from = DateTime.now().subtract(const Duration(days: 30));
  DateTime _to = DateTime.now();

  static const _creditDateKeys = ['bill_date', 'date', 'created_at'];
  static const _advanceDateKeys = [
    'advance_date',
    'request_date',
    'created_at'
  ];
  static const _loanDateKeys = ['start_date', 'created_at'];

  List<Map<String, dynamic>> _credit = [];
  List<Map<String, dynamic>> _advances = [];
  List<Map<String, dynamic>> _loans = [];
  List<Map<String, dynamic>> _staffList = [];
  // Cashier-recorded "staff paid bill" entries (staff settling cash/mpesa
  // toward their credit during a shift) waiting for the branch accountant to
  // apply them against an actual credit bill and shrink its balance.
  List<Map<String, dynamic>> _paidCreditEntries = [];

  Timer? _searchTimer;
  int _page = 1;
  static const int _pageSize = 50;

  Map<String, Map<String, dynamic>> _staffIndexMap = {};

  void _buildStaffIndex() {
    final map = <String, Map<String, dynamic>>{};
    for (final s in _staffList) {
      for (final idKey in [
        'id',
        'staff_id',
        'user_id',
        'employee_id',
        'employee_number',
        'national_id'
      ]) {
        final id = _t(s, [idKey]);
        if (id.isNotEmpty) map[id] = s;
      }
    }
    _staffIndexMap = map;
  }

  BranchAccountantRepository get _repo =>
      ref.read(branchAccountantRepositoryProvider);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _searchTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);
    try {
      final repo = _repo;
      // The From/To filter chips used to be purely cosmetic — they filtered
      // the list client-side *after* every credit bill/advance/loan/paid-bill
      // entry the branch has ever had was already fetched in full (1000+
      // rows, unbounded, on every load). That's what made this screen hang
      // or crash. Now the same range actually scopes the server query.
      final fromStr = DateFormat('yyyy-MM-dd').format(_from);
      final toStr = DateFormat('yyyy-MM-dd').format(_to);
      final res = await Future.wait([
        repo.getPayrollCreditBills(fromDate: fromStr, toDate: toStr),
        repo.getPayrollAdvances(fromDate: fromStr, toDate: toStr),
        repo.getPayrollLoans(fromDate: fromStr, toDate: toStr),
        repo.getBranchStaff(),
        repo.getCashierPaidCreditEntries(
            status: 'pending', fromDate: fromStr, toDate: toStr),
      ]);
      if (!mounted) return;
      setState(() {
        _credit = List<Map<String, dynamic>>.from(res[0]);
        _advances = List<Map<String, dynamic>>.from(res[1]);
        _loans = List<Map<String, dynamic>>.from(res[2]);
        _staffList = List<Map<String, dynamic>>.from(res[3]);
        _paidCreditEntries = List<Map<String, dynamic>>.from(res[4]);
        _buildStaffIndex();
        _page = 1;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _loading = false);
      _snack(apiErrorMessage(error, fallback: 'Failed to load staff accounts'));
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  void _snack(String message) {
    if (!mounted) return;
    AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
  }

  Future<void> _run(Future<void> Function() action, {String? ok}) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
      await _load();
      if (ok != null) _snack(ok);
    } catch (error) {
      _snack(apiErrorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _money(num v) => 'KES ${_fmt.format(v)}';

  num _n(Map m, List<String> keys) {
    for (final k in keys) {
      final v = m[k];
      if (v is num) return v;
      final p = num.tryParse('${v ?? ''}');
      if (p != null) return p;
    }
    return 0;
  }

  String _t(Map m, List<String> keys) {
    for (final k in keys) {
      final v = m[k];
      if (v != null && '$v'.trim().isNotEmpty && '$v' != 'null') return '$v';
    }
    return '';
  }

  String _date(dynamic v) {
    final parsed = DateTime.tryParse('${v ?? ''}');
    if (parsed == null) {
      final s = '${v ?? ''}'.split('T').first;
      return s.isEmpty || s == 'null' ? '—' : s;
    }
    return DateFormat('dd/MM/yy').format(parsed);
  }

  String _staffName(Map m) {
    // 1. Direct top-level name keys
    final direct = _t(m,
        ['staff_name', 'full_name', 'name', 'employee_name', 'customer_name']);
    if (direct.isNotEmpty &&
        direct.toLowerCase() != 'staff' &&
        direct.toLowerCase() != 'null') {
      return direct;
    }

    // 2. Nested staff/user/profile objects
    for (final parentKey in [
      'staff',
      'staff_profile',
      'user',
      'employee',
      'created_by_user'
    ]) {
      final parent = m[parentKey];
      if (parent is Map) {
        final nestedName =
            _t(parent, ['full_name', 'staff_name', 'name', 'username']);
        if (nestedName.isNotEmpty) return nestedName;
        final joinedNested =
            '${_t(parent, ['first_name'])} ${_t(parent, ['last_name'])}'.trim();
        if (joinedNested.isNotEmpty) return joinedNested;
      }
    }

    // 3. First + last name on top level
    final joined = '${_t(m, ['first_name'])} ${_t(m, ['last_name'])}'.trim();
    if (joined.isNotEmpty) return joined;

    // 4. Lookup via staff index using all possible ID keys
    final id =
        _t(m, ['staff_id', 'staff_profile_id', 'user_id', 'employee_id']);
    if (id.isNotEmpty) {
      final s = _staffIndex[id];
      if (s != null) {
        final sName = _t(s, ['full_name', 'staff_name', 'name', 'first_name']);
        if (sName.isNotEmpty) {
          final sLast = _t(s, ['last_name']);
          return sLast.isNotEmpty && !sName.contains(sLast)
              ? '$sName $sLast'.trim()
              : sName;
        }
      }
    }

    // 5. Fallback to description / reference if available
    final desc = _t(m, ['description', 'remarks', 'reason']);
    if (desc.contains('-')) {
      final parts = desc.split('-');
      if (parts.length > 1 && parts.last.trim().isNotEmpty) {
        final potentialName = parts.last.trim();
        if (!potentialName.toUpperCase().startsWith('CRD') &&
            !potentialName.toUpperCase().startsWith('FG')) {
          return potentialName;
        }
      }
    }

    return 'Staff';
  }

  Map<String, Map<String, dynamic>> get _staffIndex => _staffIndexMap;

  bool _statusMatch(String status) {
    final s = status.toLowerCase();
    switch (_status) {
      case 'pending':
        return s.contains('pending');
      case 'approved':
        return s.contains('confirmed') ||
            s.contains('approved') ||
            s == 'active';
      case 'settled':
        return s == 'paid' || s == 'completed' || s == 'deducted';
      case 'cancelled':
        return s == 'cancelled' || s == 'rejected' || s == 'defaulted';
      default:
        return true;
    }
  }

  bool _rowMatch(Map m, String haystack) {
    if (_staff != 'all' && _t(m, ['staff_id']) != _staff) return false;
    if (!_statusMatch(_t(m, ['status']))) return false;
    if (_query.trim().isNotEmpty &&
        !haystack.toLowerCase().contains(_query.trim().toLowerCase())) {
      return false;
    }
    return true;
  }

  bool _isOpenCredit(Map m) {
    final s = _t(m, ['status']).toLowerCase();
    // Real terminal statuses the backend actually sets: staff_credit_bills
    // uses paid_cash/deducted/cancelled; the cashier-station credit_bills
    // table uses paid/cancelled. 'paid' and 'rejected' alone never matched
    // any of those, so already-settled bills kept showing Edit/Reject/Pay.
    return s != 'paid' &&
        s != 'paid_cash' &&
        s != 'deducted' &&
        s != 'cancelled' &&
        s != 'rejected';
  }

  /// GET /payroll/credit-bills merges rows from staff_credit_bills and the
  /// cashier station's own credit_bills table (tagged by the backend as
  /// `source_table`). The two tables have different action endpoints —
  /// calling the staff_credit_bills-only endpoints against a credit_bills
  /// row 404s ("Credit bill not found"), which is what made Approve/Reject/
  /// Edit/Record Payment silently fail for cashier-billed rows.
  bool _isCashierSourced(Map m) => '${m['source_table']}' == 'credit_bills';

  bool _isOpenAdvance(Map m) {
    final s = _t(m, ['status']).toLowerCase();
    return s != 'cancelled' && s != 'rejected' && s != 'deducted';
  }

  bool _isActiveLoan(Map m) {
    final s = _t(m, ['status']).toLowerCase();
    return s != 'completed' && s != 'cancelled' && s != 'defaulted';
  }

  num _creditBalance(Map m) {
    final bal = _n(m, ['balance']);
    return bal > 0 ? bal : _n(m, ['amount']) - _n(m, ['paid_amount']);
  }

  String _creditBillLabel(Map<String, dynamic> bill) => '${_t(bill, [
            'description',
            'reason'
          ]).ifEmpty('Credit bill')} — Bal ${_money(_creditBalance(bill))}';

  String _creditTargetLabel(Map<String, dynamic> target) {
    if (target['id'] == 'unlinked') {
      return '${target['description'] ?? 'General Staff Salary Credit'}';
    }
    return _creditBillLabel(target);
  }

  List<Widget> _buildSelectedDropdownItems(
    List<Map<String, dynamic>> values, {
    bool highlightUnlinked = false,
  }) {
    return values
        .map(
          (value) => Align(
            alignment: Alignment.centerLeft,
            child: Text(
              highlightUnlinked
                  ? _creditTargetLabel(value)
                  : _creditBillLabel(value),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: highlightUnlinked
                  ? TextStyle(
                      fontWeight: value['id'] == 'unlinked'
                          ? FontWeight.w700
                          : FontWeight.w500,
                      color: value['id'] == 'unlinked' ? _success : _text,
                    )
                  : null,
            ),
          ),
        )
        .toList();
  }

  bool _inRange(Map m, List<String> keys) {
    final d = DateTime.tryParse(_t(m, keys));
    if (d == null) return true;
    final from = DateTime(_from.year, _from.month, _from.day);
    final to = DateTime(_to.year, _to.month, _to.day, 23, 59, 59);
    return !d.isBefore(from) && !d.isAfter(to);
  }

  List<Map<String, dynamic>> get _fCredit => _credit
      .where((m) =>
          _rowMatch(
              m, '${_staffName(m)} ${_t(m, ['description', 'reason'])}') &&
          _inRange(m, _creditDateKeys))
      .toList();

  List<Map<String, dynamic>> get _fAdvances => _advances
      .where((m) =>
          _rowMatch(m, '${_staffName(m)} ${_t(m, ['reason'])}') &&
          _inRange(m, _advanceDateKeys))
      .toList();

  List<Map<String, dynamic>> get _fLoans => _loans
      .where((m) =>
          _rowMatch(m, '${_staffName(m)} ${_t(m, ['reason'])}') &&
          _inRange(m, _loanDateKeys))
      .toList();

  List<Map<String, dynamic>> get _fStaffList => _staffList.where((s) {
        if (_staff != 'all' && _t(s, ['id', 'staff_id']) != _staff)
          return false;
        final q = _query.trim().toLowerCase();
        if (q.isEmpty) return true;
        final hay = '${_staffName(s)} '
            '${_t(s, ['employee_id', 'employee_number', 'national_id'])} '
            '${_t(s, ['department', 'role'])}';
        return hay.toLowerCase().contains(q);
      }).toList();

  /// Per-staff roll-up combining the three ledgers (respects staff/search/date
  /// filters). Shared by the Overview grid and its PDF export.
  List<Map<String, dynamic>> _overviewData() {
    final byStaff = <String, Map<String, num>>{};
    void add(String id, String key, num v) {
      final m =
          byStaff.putIfAbsent(id, () => {'credit': 0, 'adv': 0, 'loan': 0});
      m[key] = (m[key] ?? 0) + v;
    }

    for (final m in _credit) {
      if (_isOpenCredit(m) && _inRange(m, _creditDateKeys)) {
        add(_t(m, ['staff_id']), 'credit', _creditBalance(m));
      }
    }
    for (final m in _advances) {
      if (_isOpenAdvance(m) && _inRange(m, _advanceDateKeys)) {
        add(_t(m, ['staff_id']), 'adv', _n(m, ['amount']));
      }
    }
    for (final m in _loans) {
      if (_isActiveLoan(m) && _inRange(m, _loanDateKeys)) {
        add(_t(m, ['staff_id']), 'loan',
            _n(m, ['remaining_balance', 'total_amount']));
      }
    }

    final idx = _staffIndex;
    final ids = {...idx.keys, ...byStaff.keys}..removeWhere((e) => e.isEmpty);
    final sorted = ids.toList()
      ..sort((a, b) {
        final ta = byStaff[a]?.values.fold<num>(0, (s, v) => s + v) ?? 0;
        final tb = byStaff[b]?.values.fold<num>(0, (s, v) => s + v) ?? 0;
        return tb.compareTo(ta);
      });

    final out = <Map<String, dynamic>>[];
    for (final id in sorted) {
      if (_staff != 'all' && id != _staff) continue;
      final s = idx[id] ?? {'staff_id': id};
      final name = _staffName(s);
      if (_query.trim().isNotEmpty &&
          !name.toLowerCase().contains(_query.trim().toLowerCase())) {
        continue;
      }
      final agg = byStaff[id] ?? const {'credit': 0, 'adv': 0, 'loan': 0};
      final credit = agg['credit'] ?? 0;
      final adv = agg['adv'] ?? 0;
      final loan = agg['loan'] ?? 0;
      final salary = _n(s, ['basic_salary', 'salary']);
      out.add({
        'name': name,
        'emp': _t(s, ['employee_id', 'employee_number', 'national_id']),
        'dept': _t(s, ['department', 'role']),
        'salary': salary,
        'credit': credit,
        'adv': adv,
        'loan': loan,
        'owed': credit + adv + loan,
        'net': salary - (credit + adv + loan),
      });
    }
    return out;
  }

  // ── Build ──────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF1F5F9),
      child: Column(
        children: [
          _headerBar(),
          if (_tab != 'payroll') _filterStrip(),
          if (_tab != 'payroll') _totalsPanel(),
          _tabStrip(),
          Expanded(
            child: (_loading && _tab != 'payroll')
                ? const Center(child: CircularProgressIndicator())
                : _tabBody(),
          ),
          if (_tab != 'payroll') _bottomToolbar(),
        ],
      ),
    );
  }

  Widget _headerBar() {
    return Container(
      width: double.infinity,
      color: _header,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          const Icon(Icons.account_balance_wallet,
              color: Colors.white, size: 20),
          const SizedBox(width: 10),
          const Text('STAFF ACCOUNTS',
              style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                  letterSpacing: 0.5)),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              'Credit bills, salary advances & staff loans — one ledger',
              style: TextStyle(color: Color(0xFFB8C4D0), fontSize: 12),
            ),
          ),
          if (_busy)
            const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white)),
        ],
      ),
    );
  }

  Widget _filterStrip() {
    final staffNames = <String, String>{};
    for (final s in _staffList) {
      final id = _t(s, ['id', 'staff_id']);
      if (id.isNotEmpty) staffNames[id] = _staffName(s);
    }
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          _fieldLabel('Status'),
          _dropdown(
              _status,
              const {
                'all': 'All',
                'pending': 'Pending',
                'approved': 'Approved',
                'settled': 'Settled',
                'cancelled': 'Cancelled',
              },
              (v) => setState(() {
                    _status = v;
                    _page = 1;
                  })),
          const SizedBox(width: 14),
          _fieldLabel('Staff'),
          _dropdown(
              _staff,
              {
                'all': 'All Staff',
                for (final e in staffNames.entries) e.key: e.value,
              },
              (v) => setState(() {
                    _staff = v;
                    _page = 1;
                  })),
          const SizedBox(width: 14),
          SizedBox(
            width: 220,
            height: 32,
            child: TextField(
              decoration: const InputDecoration(
                isDense: true,
                prefixIcon: Icon(Icons.search, size: 16),
                hintText: 'Search staff / description',
                border: OutlineInputBorder(),
                contentPadding: EdgeInsets.symmetric(horizontal: 8),
              ),
              style: const TextStyle(fontSize: 12),
              onChanged: (v) {
                _searchTimer?.cancel();
                _searchTimer = Timer(const Duration(milliseconds: 250), () {
                  if (mounted) {
                    setState(() {
                      _query = v;
                      _page = 1;
                    });
                  }
                });
              },
            ),
          ),
          const SizedBox(width: 14),
          _fieldLabel('From'),
          _dateChip(_from, (d) {
            setState(() => _from = d);
            _load();
          }),
          const SizedBox(width: 8),
          _fieldLabel('To'),
          _dateChip(_to, (d) {
            setState(() => _to = d);
            _load();
          }),
          const Spacer(),
          _toolbarBtn(Icons.refresh, 'Refresh', _muted,
              onTap: _busy ? null : _load),
        ],
      ),
    );
  }

  Widget _dateChip(DateTime value, ValueChanged<DateTime> onPick) {
    return InkWell(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: value,
          firstDate: DateTime(2023),
          lastDate: DateTime(2030),
        );
        if (picked != null) onPick(picked);
      },
      child: Container(
        height: 32,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          border: Border.all(color: _border),
          borderRadius: BorderRadius.circular(4),
          color: Colors.white,
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.calendar_today, size: 13, color: _muted),
          const SizedBox(width: 6),
          Text(DateFormat('dd MMM yy').format(value),
              style: const TextStyle(fontSize: 12, color: _text)),
        ]),
      ),
    );
  }

  Widget _fieldLabel(String s) => Padding(
        padding: const EdgeInsets.only(right: 6),
        child: Text(s,
            style: const TextStyle(
                fontSize: 11, fontWeight: FontWeight.w700, color: _muted)),
      );

  Widget _dropdown(String value, Map<String, String> options,
      ValueChanged<String> onChanged) {
    return Container(
      height: 32,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        border: Border.all(color: _border),
        borderRadius: BorderRadius.circular(4),
        color: Colors.white,
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: options.containsKey(value) ? value : options.keys.first,
          isDense: true,
          style: const TextStyle(fontSize: 12, color: _text),
          items: options.entries
              .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
              .toList(),
          onChanged: (v) => onChanged(v ?? 'all'),
        ),
      ),
    );
  }

  // ── Totals panel (Tax/Total/Paid/Balance style) ────────────────────────────
  Widget _totalsPanel() {
    num creditOut = 0, advOut = 0, loanOut = 0;
    for (final m in _credit) {
      if (_staff != 'all' && _t(m, ['staff_id']) != _staff) continue;
      if (!_inRange(m, _creditDateKeys)) continue;
      if (_isOpenCredit(m)) creditOut += _creditBalance(m);
    }
    for (final m in _advances) {
      if (_staff != 'all' && _t(m, ['staff_id']) != _staff) continue;
      if (!_inRange(m, _advanceDateKeys)) continue;
      if (_isOpenAdvance(m)) advOut += _n(m, ['amount']);
    }
    for (final m in _loans) {
      if (_staff != 'all' && _t(m, ['staff_id']) != _staff) continue;
      if (!_inRange(m, _loanDateKeys)) continue;
      if (_isActiveLoan(m))
        loanOut += _n(m, ['remaining_balance', 'total_amount']);
    }
    final total = creditOut + advOut + loanOut;
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
      child: Row(
        children: [
          _totalBox('Credit Bills', creditOut, _warning, Icons.credit_card),
          _totalBox('Salary Advances', advOut, const Color(0xFF4F46E5),
              Icons.payments),
          _totalBox('Staff Loans', loanOut, _success, Icons.account_balance),
          _totalBox('Total Outstanding', total, _danger, Icons.summarize,
              emphasize: true),
        ],
      ),
    );
  }

  Widget _totalBox(String label, num value, Color color, IconData icon,
      {bool emphasize = false}) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: emphasize ? color.withValues(alpha: 0.06) : Colors.white,
          border: Border.all(color: emphasize ? color : _border),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label.toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: _muted,
                          letterSpacing: 0.3)),
                  const SizedBox(height: 2),
                  Text(_money(value),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w900,
                          color: color)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Tab strip ──────────────────────────────────────────────────────────────
  Widget _tabStrip() {
    return Container(
      color: const Color(0xFFDDE5EE),
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Row(
        children: [
          _tab2('overview', 'Overview', Icons.grid_view),
          _tab2('credit', 'Credit Bills', Icons.credit_card),
          _tab2('paidbills', 'Paid Bills', Icons.point_of_sale,
              badge: _paidCreditEntries.length),
          _tab2('advances', 'Advances', Icons.payments),
          _tab2('loans', 'Loans', Icons.account_balance),
          _tab2('salaries', 'Salaries', Icons.badge),
          _tab2('payroll', 'Payroll', Icons.receipt_long),
        ],
      ),
    );
  }

  Widget _tab2(String id, String label, IconData icon, {int badge = 0}) {
    final selected = _tab == id;
    return InkWell(
      onTap: () => setState(() {
        _tab = id;
        _page = 1;
      }),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? Colors.white : Colors.transparent,
          border: Border(
            top: BorderSide(
                color: selected ? _accent : Colors.transparent, width: 2.5),
            left: BorderSide(color: selected ? _border : Colors.transparent),
            right: BorderSide(color: selected ? _border : Colors.transparent),
          ),
        ),
        child: Row(
          children: [
            Icon(icon, size: 15, color: selected ? _accent : _muted),
            const SizedBox(width: 6),
            Text(label,
                style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: selected ? FontWeight.w900 : FontWeight.w600,
                    color: selected ? _accent : _muted)),
            if (badge > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: _warning,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text('$badge',
                    style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        color: Colors.white)),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _tabBody() {
    switch (_tab) {
      case 'credit':
        return _creditGrid();
      case 'paidbills':
        return _paidBillsGrid();
      case 'advances':
        return _advancesGrid();
      case 'loans':
        return _loansGrid();
      case 'salaries':
        return _salariesGrid();
      case 'payroll':
        return _payrollWorkspace();
      default:
        return _overviewGrid();
    }
  }

  /// Payroll workspace — consolidates every payroll feature into the tab:
  /// the batch run (generate / review / PDF / payslips ZIP), the statutory
  /// deduction toggles (NSSF / SHIF / Housing), and manual adjustments.
  Widget _payrollWorkspace() {
    Widget body;
    switch (_payrollSubTab) {
      case 'deductions':
        body = const PayrollPoliciesScreen();
        break;
      case 'adjustments':
        body = const PayrollAdjustmentsScreen();
        break;
      default:
        body = const BranchPayrollScreen();
    }
    return Container(
      color: Colors.white,
      child: Column(
        children: [
          Container(
            color: _gridHead,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Row(
              children: [
                _payrollSubTabBtn('batch', 'Payroll Batch', Icons.receipt_long),
                _payrollSubTabBtn(
                    'deductions',
                    'Deductions (NSSF / SHIF / Housing)',
                    Icons.toggle_on_outlined),
                _payrollSubTabBtn('adjustments', 'Adjustments', Icons.tune),
              ],
            ),
          ),
          Expanded(child: body),
        ],
      ),
    );
  }

  Widget _payrollSubTabBtn(String id, String label, IconData icon) {
    final selected = _payrollSubTab == id;
    return InkWell(
      onTap: () => setState(() => _payrollSubTab = id),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
                color: selected ? _accent : Colors.transparent, width: 2.5),
          ),
        ),
        child: Row(
          children: [
            Icon(icon, size: 15, color: selected ? _accent : _muted),
            const SizedBox(width: 6),
            Text(label,
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: selected ? FontWeight.w900 : FontWeight.w600,
                    color: selected ? _accent : _muted)),
          ],
        ),
      ),
    );
  }

  // ── Grids ──────────────────────────────────────────────────────────────────
  Widget _overviewGrid() {
    final rows = <List<Widget>>[];
    for (final e in _overviewData()) {
      final salary = e['salary'] as num;
      final credit = e['credit'] as num;
      final adv = e['adv'] as num;
      final loan = e['loan'] as num;
      final owed = e['owed'] as num;
      rows.add([
        _c(e['name'] as String, bold: true),
        _c((e['emp'] as String).ifEmpty('—')),
        _c((e['dept'] as String).ifEmpty('—')),
        _c(salary > 0 ? _money(salary) : '—', color: _muted),
        _c(_money(credit), color: credit > 0 ? _warning : _muted),
        _c(_money(adv), color: adv > 0 ? const Color(0xFF4F46E5) : _muted),
        _c(_money(loan), color: loan > 0 ? _success : _muted),
        _c(_money(owed), bold: true, color: owed > 0 ? _danger : _success),
        _c(salary > 0 ? _money(e['net'] as num) : '—', bold: true),
      ]);
    }

    return _grid(
      const [
        'Staff',
        'Emp ID',
        'Dept',
        'Salary',
        'Credit Bills',
        'Advances',
        'Loans',
        'Total Owed',
        'Net Payable',
      ],
      rows,
      emptyLabel: 'No staff ledger activity yet.',
    );
  }

  Widget _creditGrid() {
    final rows = <List<Widget>>[];
    for (final m in _fCredit) {
      final status = _t(m, ['status']);
      final bal = _creditBalance(m);
      rows.add([
        _c(_date(_t(m, ['bill_date', 'date', 'created_at']))),
        _c(_staffName(m), bold: true),
        _c(_t(m, ['description', 'reason']).ifEmpty('—')),
        _c(_money(_n(m, ['amount']))),
        _c(_money(_n(m, ['paid_amount'])), color: _muted),
        _c(_money(bal), bold: true, color: bal > 0 ? _danger : _success),
        _chip(status),
        Row(mainAxisSize: MainAxisSize.min, children: [
          _act(Icons.receipt_long, 'Contents', _muted, () => _viewContents(m)),
          if (status.toLowerCase().contains('pending') ||
              status.toLowerCase() == 'accountant_confirmed')
            _act(
                Icons.check_circle,
                'Approve',
                _success,
                () => _run(
                    () => _isCashierSourced(m)
                        ? _repo.approveCashierCreditBill('${m['id']}')
                        : _repo.approvePayrollCreditBill('${m['id']}'),
                    ok: 'Approved')),
          if (bal > 0 && _isOpenCredit(m))
            _act(Icons.payments, 'Record payment', _accent,
                () => _payDialog('credit', m, bal)),
          if (_isOpenCredit(m))
            _act(Icons.edit, 'Edit', _warning, () => _editCreditDialog(m)),
          if (_isOpenCredit(m))
            _act(Icons.cancel, 'Reject', _danger,
                () => _rejectDialog('credit', m)),
        ]),
      ]);
    }
    return _grid(
      const [
        'Date',
        'Staff',
        'Description',
        'Amount',
        'Paid',
        'Balance',
        'Status',
        'Actions',
      ],
      rows,
      emptyLabel: 'No credit bills.',
    );
  }

  /// Cashier station "paid bills" — a cashier recorded a staff member
  /// settling cash/mpesa toward their credit during their shift. These sit
  /// here until the branch accountant applies each one against the actual
  /// credit bill it's meant to reduce (there was previously no screen for
  /// this at all, so cashier-collected payments never made it onto the
  /// staff's outstanding balance).
  Widget _paidBillsGrid() {
    final rows = <List<Widget>>[];
    for (final e in _paidCreditEntries) {
      final remaining = _n(e, ['remaining_amount']);
      final applied = _n(e, ['applied_amount']);
      rows.add([
        _c(_date(_t(e, ['recorded_at']))),
        _c(_t(e, ['cashier_name']).ifEmpty('—'), color: _muted),
        _c(_t(e, ['staff_name']).ifEmpty('—'), bold: true),
        _c(_money(_n(e, ['amount']))),
        _c(_money(applied), color: applied > 0 ? _success : _muted),
        _c(_money(remaining),
            bold: true, color: remaining > 0 ? _warning : _success),
        _chip(_t(e, ['review_status']).ifEmpty('pending')),
        Row(mainAxisSize: MainAxisSize.min, children: [
          if (remaining > 0)
            _act(Icons.playlist_add_check, 'Apply to credit bill', _success,
                () => _applyPaidEntryDialog(e)),
        ]),
      ]);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(10, 10, 10, 0),
          child: Text(
            'Money cashiers collected from staff during their shift toward an '
            'outstanding credit bill. Apply each entry to reduce that staff '
            "member's actual credit bill balance — their credit bill must "
            'already be approved (not still Pending) before you can apply a '
            'payment to it.',
            style: TextStyle(
                fontSize: 11.5, color: _muted, fontStyle: FontStyle.italic),
          ),
        ),
        Expanded(
          child: _grid(
            const [
              'Recorded',
              'Cashier',
              'Staff',
              'Amount',
              'Applied',
              'Remaining',
              'Status',
              'Actions',
            ],
            rows,
            emptyLabel: 'No cashier-recorded paid bills awaiting review.',
          ),
        ),
      ],
    );
  }

  Widget _advancesGrid() {
    final rows = <List<Widget>>[];
    const months = [
      '',
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    for (final m in _fAdvances) {
      final status = _t(m, ['status']);
      final mm = _n(m, ['month_to_deduct']).toInt();
      final yy = _t(m, ['year_to_deduct']);
      final deduct = mm >= 1 && mm <= 12
          ? '${months[mm]} $yy'.trim()
          : (yy.isEmpty ? '—' : yy);
      rows.add([
        _c(_date(_t(m, ['advance_date', 'request_date', 'created_at']))),
        _c(_staffName(m), bold: true),
        _c(_t(m, ['reason']).ifEmpty('—')),
        _c(_money(_n(m, ['amount'])), bold: true),
        _c(deduct, color: _muted),
        _chip(status),
        Row(mainAxisSize: MainAxisSize.min, children: [
          if (status.toLowerCase().contains('pending') ||
              status.toLowerCase() == 'accountant_confirmed')
            _act(
                Icons.check_circle,
                'Approve',
                _success,
                () => _run(() => _repo.approvePayrollAdvance('${m['id']}'),
                    ok: 'Advance approved')),
          if (_isOpenAdvance(m))
            _act(
                Icons.cancel,
                'Reject',
                _danger,
                () => _run(() => _repo.rejectPayrollAdvance('${m['id']}'),
                    ok: 'Advance rejected')),
        ]),
      ]);
    }
    return _grid(
      const [
        'Date',
        'Staff',
        'Reason',
        'Amount',
        'Deduct In',
        'Status',
        'Actions',
      ],
      rows,
      emptyLabel: 'No salary advances.',
    );
  }

  Widget _loansGrid() {
    final rows = <List<Widget>>[];
    for (final m in _fLoans) {
      final status = _t(m, ['status']);
      final remaining = _n(m, ['remaining_balance', 'total_amount']);
      rows.add([
        _c(_date(_t(m, ['start_date', 'created_at']))),
        _c(_staffName(m), bold: true),
        _c(_t(m, ['reason']).ifEmpty('—')),
        _c(_money(_n(m, ['total_amount']))),
        _c(_money(_n(m, ['monthly_installment'])), color: _muted),
        _c(_money(remaining),
            bold: true, color: remaining > 0 ? _danger : _success),
        _chip(status),
        Row(mainAxisSize: MainAxisSize.min, children: [
          if (status.toLowerCase().contains('pending'))
            _act(
                Icons.check_circle,
                'Approve',
                _success,
                () => _run(() => _repo.approvePayrollLoan('${m['id']}'),
                    ok: 'Loan approved')),
          if (_isActiveLoan(m) && remaining > 0)
            _act(Icons.payments, 'Record repayment', _accent,
                () => _payDialog('loan', m, remaining)),
          if (_isActiveLoan(m))
            _act(
                Icons.cancel,
                'Reject',
                _danger,
                () => _run(() => _repo.rejectPayrollLoan('${m['id']}'),
                    ok: 'Loan rejected')),
        ]),
      ]);
    }
    return _grid(
      const [
        'Start',
        'Staff',
        'Reason',
        'Total',
        'Monthly',
        'Remaining',
        'Status',
        'Actions',
      ],
      rows,
      emptyLabel: 'No staff loans.',
    );
  }

  Widget _salariesGrid() {
    final rows = <List<Widget>>[];
    for (final s in _fStaffList) {
      final salary = _n(s, ['basic_salary', 'salary']);
      rows.add([
        _c(_staffName(s), bold: true),
        _c(_t(s, ['employee_id', 'employee_number', 'national_id'])
            .ifEmpty('—')),
        _c(_t(s, ['department', 'role']).ifEmpty('—')),
        _c(salary > 0 ? _money(salary) : 'Not set',
            bold: true, color: salary > 0 ? _text : _warning),
        Row(mainAxisSize: MainAxisSize.min, children: [
          _act(Icons.edit, 'Set salary', _accent, () => _setSalaryDialog(s)),
          _act(Icons.tune, 'Adjust pay (bonus / deduction)', _warning,
              () => _adjustDialog(s)),
        ]),
      ]);
    }
    return _grid(
      const ['Staff', 'Emp #', 'Dept', 'Basic Salary', 'Actions'],
      rows,
      emptyLabel: 'No staff found.',
    );
  }

  Future<void> _setSalaryDialog(Map s) async {
    final current = _n(s, ['basic_salary', 'salary']);
    final amount = TextEditingController(
        text: current > 0 ? current.toStringAsFixed(0) : '');
    final ok = await _formDialog(
      title: 'Set Salary — ${_staffName(s)}',
      builder: (setD) => [
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(
            'Current: ${current > 0 ? _money(current) : "Not set"}',
            style: const TextStyle(
                fontSize: 12, color: _muted, fontWeight: FontWeight.w700),
          ),
        ),
        _numField(amount, 'Basic monthly salary (KES) *'),
      ],
      onValidate: () => (num.tryParse(amount.text.trim()) ?? -1) >= 0,
    );
    final value = num.tryParse(amount.text.trim()) ?? 0;
    amount.dispose();
    if (ok != true) return;
    await _run(
        () => _repo.updateStaffSalary('${s['id'] ?? s['staff_id']}', value),
        ok: 'Salary updated');
  }

  Future<void> _adjustDialog(Map s) async {
    const cats = <String, List<String>>{
      'deduction': [
        'credit_bills',
        'absenteeism',
        'loan',
        'advance',
        'shif',
        'nssf',
        'uniform',
        'other'
      ],
      'addition': ['bonus', 'overtime', 'allowance', 'extra_day', 'other'],
    };
    const months = [
      '',
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ];
    String type = 'addition';
    String category = 'bonus';
    final amount = TextEditingController();
    final desc = TextEditingController();
    int month = DateTime.now().month;
    final year = TextEditingController(text: '${DateTime.now().year}');

    final ok = await _formDialog(
      title: 'Adjust Pay — ${_staffName(s)}',
      builder: (setD) => [
        DropdownButtonFormField<String>(
          initialValue: type,
          decoration: _dec('Type'),
          items: const [
            DropdownMenuItem(
                value: 'addition', child: Text('Addition (bonus / allowance)')),
            DropdownMenuItem(value: 'deduction', child: Text('Deduction')),
          ],
          onChanged: (v) => setD(() {
            type = v ?? 'addition';
            if (!cats[type]!.contains(category)) category = cats[type]!.first;
          }),
        ),
        DropdownButtonFormField<String>(
          initialValue:
              cats[type]!.contains(category) ? category : cats[type]!.first,
          decoration: _dec('Category'),
          items: cats[type]!
              .map((c) => DropdownMenuItem(
                  value: c, child: Text(c.replaceAll('_', ' '))))
              .toList(),
          onChanged: (v) => setD(() => category = v ?? category),
        ),
        _numField(amount, 'Amount (KES) *'),
        _textField(desc, 'Description'),
        Row(children: [
          Expanded(
            child: DropdownButtonFormField<int>(
              initialValue: month,
              decoration: _dec('Deduct/pay in month *'),
              items: [
                for (var i = 1; i <= 12; i++)
                  DropdownMenuItem(value: i, child: Text(months[i])),
              ],
              onChanged: (v) => setD(() => month = v ?? month),
            ),
          ),
          const SizedBox(width: 10),
          SizedBox(width: 110, child: _numField(year, 'Year *', integer: true)),
        ]),
      ],
      onValidate: () =>
          (num.tryParse(amount.text.trim()) ?? 0) > 0 &&
          (int.tryParse(year.text.trim()) ?? 0) > 2000,
    );
    final amt = num.tryParse(amount.text.trim()) ?? 0;
    final yr = int.tryParse(year.text.trim()) ?? DateTime.now().year;
    final note = desc.text.trim();
    amount.dispose();
    desc.dispose();
    year.dispose();
    if (ok != true) return;
    await _run(() async {
      await _repo.createPayrollAdjustment(
        staffId: '${s['id'] ?? s['staff_id']}',
        type: type,
        category: category,
        amount: amt.toDouble(),
        description: note.isEmpty ? category.replaceAll('_', ' ') : note,
        month: month,
        year: yr,
      );
    }, ok: 'Pay adjustment added');
  }

  // ── Grid + cell primitives ─────────────────────────────────────────────────
  Widget _grid(List<String> cols, List<List<Widget>> rows,
      {required String emptyLabel}) {
    if (rows.isEmpty) {
      return Center(
        child: Text(emptyLabel,
            style: const TextStyle(color: _muted, fontSize: 13)),
      );
    }

    final totalCount = rows.length;
    final totalPages = (totalCount / _pageSize).ceil();
    final currentPage = _page.clamp(1, totalPages);
    final startIndex = (currentPage - 1) * _pageSize;
    final endIndex = (startIndex + _pageSize < totalCount)
        ? startIndex + _pageSize
        : totalCount;
    final pageRows = (totalCount > _pageSize)
        ? rows.sublist(startIndex < totalCount ? startIndex : 0, endIndex)
        : rows;

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.vertical,
            padding: const EdgeInsets.all(10),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                headingRowColor: const WidgetStatePropertyAll(_gridHead),
                headingRowHeight: 34,
                dataRowMinHeight: 34,
                dataRowMaxHeight: 46,
                columnSpacing: 22,
                horizontalMargin: 12,
                headingTextStyle: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 11.5, color: _text),
                border: TableBorder.all(color: _border, width: 0.6),
                columns: cols.map((c) => DataColumn(label: Text(c))).toList(),
                rows: [
                  for (var i = 0; i < pageRows.length; i++)
                    DataRow(
                      color: WidgetStatePropertyAll(
                          i.isEven ? Colors.white : _rowAlt),
                      cells: pageRows[i].map((w) => DataCell(w)).toList(),
                    ),
                ],
              ),
            ),
          ),
        ),
        if (totalCount > _pageSize)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: _border, width: 0.6)),
            ),
            child: Row(
              children: [
                Text(
                  'Showing ${startIndex + 1}–$endIndex of $totalCount records',
                  style: const TextStyle(
                      fontSize: 12, color: _muted, fontWeight: FontWeight.w600),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.chevron_left, size: 20),
                  onPressed: currentPage > 1
                      ? () => setState(() => _page = currentPage - 1)
                      : null,
                ),
                Text(
                  'Page $currentPage of $totalPages',
                  style: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w700, color: _text),
                ),
                IconButton(
                  icon: const Icon(Icons.chevron_right, size: 20),
                  onPressed: currentPage < totalPages
                      ? () => setState(() => _page = currentPage + 1)
                      : null,
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _c(String s, {bool bold = false, Color? color}) => Text(
        s,
        style: TextStyle(
            fontSize: 12,
            fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
            color: color ?? _text),
      );

  Widget _chip(String status) {
    final s = status.toLowerCase();
    Color color;
    if (s.contains('pending')) {
      color = _warning;
    } else if (s.contains('confirmed') ||
        s.contains('approved') ||
        s == 'active') {
      color = _accent;
    } else if (s == 'paid' || s == 'completed' || s == 'deducted') {
      color = _success;
    } else if (s == 'cancelled' || s == 'rejected' || s == 'defaulted') {
      color = _danger;
    } else {
      color = _muted;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        status.replaceAll('_', ' ').toUpperCase(),
        style:
            TextStyle(color: color, fontSize: 9.5, fontWeight: FontWeight.w900),
      ),
    );
  }

  Widget _act(IconData icon, String tip, Color color, VoidCallback onTap) {
    return IconButton(
      tooltip: tip,
      icon: Icon(icon, size: 17, color: color),
      onPressed: _busy ? null : onTap,
      visualDensity: VisualDensity.compact,
      padding: const EdgeInsets.all(2),
      constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
    );
  }

  // ── Bottom toolbar ─────────────────────────────────────────────────────────
  Widget _bottomToolbar() {
    final count = _tab == 'credit'
        ? _fCredit.length
        : _tab == 'paidbills'
            ? _paidCreditEntries.length
            : _tab == 'advances'
                ? _fAdvances.length
                : _tab == 'loans'
                    ? _fLoans.length
                    : _tab == 'salaries'
                        ? _fStaffList.length
                        : _overviewData().length;
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFE2E8F0),
        border: Border(top: BorderSide(color: _border)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        children: [
          _newButton(),
          const SizedBox(width: 8),
          _toolbarBtn(Icons.picture_as_pdf, 'Export PDF', _accent,
              onTap: _busy ? null : _exportPdf),
          const SizedBox(width: 8),
          _toolbarBtn(Icons.refresh, 'Refresh', _muted,
              onTap: _busy ? null : _load),
          const Spacer(),
          Text('$count record${count == 1 ? '' : 's'}',
              style: const TextStyle(
                  fontSize: 11, color: _muted, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _newButton() {
    if (_tab == 'salaries') return const SizedBox.shrink();
    if (_tab == 'overview') {
      return PopupMenuButton<String>(
        enabled: !_busy,
        onSelected: (v) {
          if (v == 'credit') {
            _newCreditDialog();
          } else if (v == 'advance') {
            _newAdvanceDialog();
          } else {
            _newLoanDialog();
          }
        },
        itemBuilder: (_) => const [
          PopupMenuItem(value: 'credit', child: Text('New Credit Bill')),
          PopupMenuItem(value: 'advance', child: Text('New Advance')),
          PopupMenuItem(value: 'loan', child: Text('New Loan')),
        ],
        child: _toolbarBtn(Icons.add, 'New ▾', _accent, filled: true),
      );
    }
    final label = _tab == 'credit'
        ? 'New Credit Bill'
        : _tab == 'paidbills'
            ? 'Record Paid Bill'
            : _tab == 'advances'
                ? 'New Advance'
                : 'New Loan';
    return _toolbarBtn(Icons.add, label, _accent,
        filled: true,
        onTap: _busy
            ? null
            : _tab == 'credit'
                ? _newCreditDialog
                : _tab == 'paidbills'
                    ? _recordPaidBillDialog
                    : _tab == 'advances'
                        ? _newAdvanceDialog
                        : _newLoanDialog);
  }

  Widget _toolbarBtn(IconData icon, String label, Color color,
      {VoidCallback? onTap, bool filled = false}) {
    final child = Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: filled ? color : Colors.white,
        border: Border.all(color: filled ? color : _border),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 15, color: filled ? Colors.white : color),
        const SizedBox(width: 6),
        Text(label,
            style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: filled ? Colors.white : color)),
      ]),
    );
    if (onTap == null && !filled) return child;
    return InkWell(onTap: onTap, child: child);
  }

  // ── Export (branded payroll-template PDF via python-services) ──────────────
  String _period() =>
      '${DateFormat('dd MMM yyyy').format(_from)} - ${DateFormat('dd MMM yyyy').format(_to)}';

  String _branchName() {
    for (final s in _staffList) {
      final b = _t(s, ['branch_name', 'branch']);
      if (b.isNotEmpty) return b;
    }
    return 'All Branches';
  }

  String _statusText(Map m) =>
      _t(m, ['status']).replaceAll('_', ' ').toUpperCase();

  Future<void> _exportPdf() async {
    if (_busy || _tab == 'payroll') return;
    final payload = _buildExportPayload();
    final rows = (payload?['rows'] as List?) ?? const [];
    if (payload == null || rows.isEmpty) {
      _snack('Nothing to export for this tab');
      return;
    }
    setState(() => _busy = true);
    try {
      final file = await _repo.generateStatementPdf(payload);
      if (!mounted) return;
      try {
        await Printing.layoutPdf(onLayout: (_) => file.readAsBytes());
      } catch (_) {
        _snack('PDF saved to: ${file.path}');
      }
    } catch (error) {
      _snack('Export failed: $error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Map<String, dynamic>? _buildExportPayload() {
    switch (_tab) {
      case 'credit':
        return _creditPayload();
      case 'advances':
        return _advancesPayload();
      case 'loans':
        return _loansPayload();
      case 'salaries':
        return _salariesPayload();
      case 'overview':
        return _overviewPayload();
      default:
        return null;
    }
  }

  Map<String, dynamic> _salariesPayload() {
    final rows = <List<String>>[];
    num tot = 0;
    for (final s in _fStaffList) {
      final salary = _n(s, ['basic_salary', 'salary']);
      tot += salary;
      rows.add([
        _staffName(s),
        _t(s, ['employee_id', 'employee_number', 'national_id']).ifEmpty('-'),
        _t(s, ['department', 'role']).ifEmpty('-'),
        salary > 0 ? _fmt2.format(salary) : 'Not set',
      ]);
    }
    return {
      'title': 'STAFF SALARIES',
      'period': _period(),
      'branch': _branchName(),
      'columns': const [
        {'header': 'Staff', 'align': 'left', 'weight': 3.0},
        {'header': 'Emp #', 'align': 'center', 'weight': 1.5},
        {'header': 'Dept', 'align': 'left', 'weight': 2.0},
        {'header': 'Basic Salary (KES)', 'align': 'right', 'weight': 1.8},
      ],
      'rows': rows,
      'summary': [
        {'label': 'Staff', 'value': '${rows.length}'},
        {'label': 'Monthly Salary Bill (KES)', 'value': _fmt2.format(tot)},
      ],
      'totals': ['TOTALS', '', '', _fmt2.format(tot)],
    };
  }

  Map<String, dynamic> _creditPayload() {
    final rows = <List<String>>[];
    num amt = 0, paid = 0, bal = 0;
    for (final m in _fCredit) {
      final b = _creditBalance(m);
      amt += _n(m, ['amount']);
      paid += _n(m, ['paid_amount']);
      bal += b;
      rows.add([
        _date(_t(m, _creditDateKeys)),
        _staffName(m),
        _t(m, ['description', 'reason']).ifEmpty('-'),
        _fmt2.format(_n(m, ['amount'])),
        _fmt2.format(_n(m, ['paid_amount'])),
        _fmt2.format(b),
        _statusText(m),
      ]);
    }
    return {
      'title': 'STAFF CREDIT BILLS',
      'period': _period(),
      'branch': _branchName(),
      'columns': const [
        {'header': 'Date', 'align': 'center', 'weight': 1.2},
        {'header': 'Staff', 'align': 'left', 'weight': 2.4},
        {'header': 'Description', 'align': 'left', 'weight': 3.0},
        {'header': 'Amount (KES)', 'align': 'right', 'weight': 1.4},
        {'header': 'Paid (KES)', 'align': 'right', 'weight': 1.4},
        {'header': 'Balance (KES)', 'align': 'right', 'weight': 1.4},
        {'header': 'Status', 'align': 'center', 'weight': 1.6},
      ],
      'rows': rows,
      'summary': [
        {'label': 'Records', 'value': '${rows.length}'},
        {'label': 'Total Billed (KES)', 'value': _fmt2.format(amt)},
        {'label': 'Total Paid (KES)', 'value': _fmt2.format(paid)},
        {'label': 'Total Balance (KES)', 'value': _fmt2.format(bal)},
      ],
      'totals': [
        'TOTALS',
        '',
        '',
        _fmt2.format(amt),
        _fmt2.format(paid),
        _fmt2.format(bal),
        '',
      ],
    };
  }

  Map<String, dynamic> _advancesPayload() {
    const months = [
      '',
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    final rows = <List<String>>[];
    num amt = 0;
    for (final m in _fAdvances) {
      amt += _n(m, ['amount']);
      final mm = _n(m, ['month_to_deduct']).toInt();
      final yy = _t(m, ['year_to_deduct']);
      final deduct = mm >= 1 && mm <= 12
          ? '${months[mm]} $yy'.trim()
          : (yy.isEmpty ? '-' : yy);
      rows.add([
        _date(_t(m, _advanceDateKeys)),
        _staffName(m),
        _t(m, ['reason']).ifEmpty('-'),
        _fmt2.format(_n(m, ['amount'])),
        deduct,
        _statusText(m),
      ]);
    }
    return {
      'title': 'SALARY ADVANCES',
      'period': _period(),
      'branch': _branchName(),
      'columns': const [
        {'header': 'Date', 'align': 'center', 'weight': 1.2},
        {'header': 'Staff', 'align': 'left', 'weight': 2.4},
        {'header': 'Reason', 'align': 'left', 'weight': 3.0},
        {'header': 'Amount (KES)', 'align': 'right', 'weight': 1.5},
        {'header': 'Deduct In', 'align': 'center', 'weight': 1.6},
        {'header': 'Status', 'align': 'center', 'weight': 1.6},
      ],
      'rows': rows,
      'summary': [
        {'label': 'Records', 'value': '${rows.length}'},
        {'label': 'Total Advances (KES)', 'value': _fmt2.format(amt)},
      ],
      'totals': ['TOTALS', '', '', _fmt2.format(amt), '', ''],
    };
  }

  Map<String, dynamic> _loansPayload() {
    final rows = <List<String>>[];
    num tot = 0, rem = 0;
    for (final m in _fLoans) {
      tot += _n(m, ['total_amount']);
      rem += _n(m, ['remaining_balance', 'total_amount']);
      rows.add([
        _date(_t(m, _loanDateKeys)),
        _staffName(m),
        _t(m, ['reason']).ifEmpty('-'),
        _fmt2.format(_n(m, ['total_amount'])),
        _fmt2.format(_n(m, ['monthly_installment'])),
        _fmt2.format(_n(m, ['remaining_balance', 'total_amount'])),
        _statusText(m),
      ]);
    }
    return {
      'title': 'STAFF LOANS',
      'period': _period(),
      'branch': _branchName(),
      'columns': const [
        {'header': 'Start', 'align': 'center', 'weight': 1.2},
        {'header': 'Staff', 'align': 'left', 'weight': 2.4},
        {'header': 'Reason', 'align': 'left', 'weight': 2.6},
        {'header': 'Total (KES)', 'align': 'right', 'weight': 1.4},
        {'header': 'Monthly (KES)', 'align': 'right', 'weight': 1.4},
        {'header': 'Remaining (KES)', 'align': 'right', 'weight': 1.5},
        {'header': 'Status', 'align': 'center', 'weight': 1.5},
      ],
      'rows': rows,
      'summary': [
        {'label': 'Records', 'value': '${rows.length}'},
        {'label': 'Total Principal (KES)', 'value': _fmt2.format(tot)},
        {'label': 'Total Remaining (KES)', 'value': _fmt2.format(rem)},
      ],
      'totals': [
        'TOTALS',
        '',
        '',
        _fmt2.format(tot),
        '',
        _fmt2.format(rem),
        '',
      ],
    };
  }

  Map<String, dynamic> _overviewPayload() {
    final data = _overviewData();
    final rows = <List<String>>[];
    num c = 0, a = 0, l = 0, o = 0;
    for (final e in data) {
      final salary = e['salary'] as num;
      c += e['credit'] as num;
      a += e['adv'] as num;
      l += e['loan'] as num;
      o += e['owed'] as num;
      rows.add([
        e['name'] as String,
        (e['emp'] as String).ifEmpty('-'),
        (e['dept'] as String).ifEmpty('-'),
        salary > 0 ? _fmt2.format(salary) : '-',
        _fmt2.format(e['credit'] as num),
        _fmt2.format(e['adv'] as num),
        _fmt2.format(e['loan'] as num),
        _fmt2.format(e['owed'] as num),
        salary > 0 ? _fmt2.format(e['net'] as num) : '-',
      ]);
    }
    return {
      'title': 'STAFF ACCOUNTS OVERVIEW',
      'period': _period(),
      'branch': _branchName(),
      'columns': const [
        {'header': 'Staff', 'align': 'left', 'weight': 2.4},
        {'header': 'Emp ID', 'align': 'center', 'weight': 1.3},
        {'header': 'Dept', 'align': 'left', 'weight': 1.6},
        {'header': 'Salary (KES)', 'align': 'right', 'weight': 1.4},
        {'header': 'Credit Bills (KES)', 'align': 'right', 'weight': 1.4},
        {'header': 'Advances (KES)', 'align': 'right', 'weight': 1.4},
        {'header': 'Loans (KES)', 'align': 'right', 'weight': 1.4},
        {'header': 'Total Owed (KES)', 'align': 'right', 'weight': 1.5},
        {'header': 'Net Payable (KES)', 'align': 'right', 'weight': 1.5},
      ],
      'rows': rows,
      'summary': [
        {'label': 'Staff', 'value': '${rows.length}'},
        {'label': 'Credit Bills (KES)', 'value': _fmt2.format(c)},
        {'label': 'Advances (KES)', 'value': _fmt2.format(a)},
        {'label': 'Loans (KES)', 'value': _fmt2.format(l)},
      ],
      'totals': [
        'TOTALS',
        '',
        '',
        '',
        _fmt2.format(c),
        _fmt2.format(a),
        _fmt2.format(l),
        _fmt2.format(o),
        '',
      ],
    };
  }

  // ── Create / action dialogs ────────────────────────────────────────────────
  Future<void> _newCreditDialog() async {
    String staffId = '';
    final amount = TextEditingController();
    final desc = TextEditingController();
    DateTime date = DateTime.now();
    final ok = await _formDialog(
      title: 'New Credit Bill',
      builder: (setD) => [
        _staffField(staffId, (v) => setD(() => staffId = v)),
        _numField(amount, 'Amount (KES) *'),
        _textField(desc, 'Description *'),
        _dateField('Bill date', date, (d) => setD(() => date = d)),
      ],
      onValidate: () =>
          staffId.isNotEmpty &&
          (num.tryParse(amount.text.trim()) ?? 0) > 0 &&
          desc.text.trim().isNotEmpty,
    );
    amount.dispose();
    desc.dispose();
    if (ok != true) return;
    await _run(
        () => _repo.createPayrollCreditBill({
              'staff_id': staffId,
              'amount': num.tryParse(amount.text.trim()) ?? 0,
              'description': desc.text.trim(),
              'date': DateFormat('yyyy-MM-dd').format(date),
            }),
        ok: 'Credit bill created');
  }

  Future<void> _newAdvanceDialog() async {
    String staffId = '';
    final amount = TextEditingController();
    final reason = TextEditingController();
    int month = DateTime.now().month;
    final year = TextEditingController(text: '${DateTime.now().year}');
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ];
    final ok = await _formDialog(
      title: 'New Salary Advance',
      builder: (setD) => [
        _staffField(staffId, (v) => setD(() => staffId = v)),
        _numField(amount, 'Amount (KES) *'),
        _textField(reason, 'Reason *'),
        Row(children: [
          Expanded(
            child: DropdownButtonFormField<int>(
              initialValue: month,
              decoration: _dec('Deduct in month *'),
              items: [
                for (var i = 1; i <= 12; i++)
                  DropdownMenuItem(value: i, child: Text(months[i - 1])),
              ],
              onChanged: (v) => setD(() => month = v ?? month),
            ),
          ),
          const SizedBox(width: 10),
          SizedBox(width: 110, child: _numField(year, 'Year *', integer: true)),
        ]),
      ],
      onValidate: () =>
          staffId.isNotEmpty &&
          (num.tryParse(amount.text.trim()) ?? 0) > 0 &&
          reason.text.trim().isNotEmpty &&
          (int.tryParse(year.text.trim()) ?? 0) > 2000,
    );
    amount.dispose();
    reason.dispose();
    year.dispose();
    if (ok != true) return;
    await _run(
        () => _repo.createPayrollAdvance({
              'staff_id': staffId,
              'amount': num.tryParse(amount.text.trim()) ?? 0,
              'reason': reason.text.trim(),
              'month_to_deduct': month,
              'year_to_deduct': int.tryParse(year.text.trim()),
            }),
        ok: 'Advance created');
  }

  Future<void> _newLoanDialog() async {
    String staffId = '';
    final total = TextEditingController();
    final monthly = TextEditingController();
    final reason = TextEditingController();
    DateTime start = DateTime.now();
    final ok = await _formDialog(
      title: 'New Staff Loan',
      builder: (setD) => [
        _staffField(staffId, (v) => setD(() => staffId = v)),
        _numField(total, 'Total amount (KES) *'),
        _numField(monthly, 'Monthly installment (KES) *'),
        _dateField('Start date', start, (d) => setD(() => start = d)),
        _textField(reason, 'Reason'),
      ],
      onValidate: () =>
          staffId.isNotEmpty &&
          (num.tryParse(total.text.trim()) ?? 0) > 0 &&
          (num.tryParse(monthly.text.trim()) ?? 0) > 0,
    );
    total.dispose();
    monthly.dispose();
    reason.dispose();
    if (ok != true) return;
    await _run(
        () => _repo.createPayrollLoan({
              'staff_id': staffId,
              'total_amount': num.tryParse(total.text.trim()) ?? 0,
              'monthly_installment': num.tryParse(monthly.text.trim()) ?? 0,
              'start_date': DateFormat('yyyy-MM-dd').format(start),
              'reason': reason.text.trim(),
            }),
        ok: 'Loan created');
  }

  Future<void> _editCreditDialog(Map m) async {
    final amount = TextEditingController(text: '${_n(m, ['amount'])}');
    final desc = TextEditingController(text: _t(m, ['description', 'reason']));
    final ok = await _formDialog(
      title: 'Edit Credit Bill',
      builder: (setD) => [
        _numField(amount, 'Amount (KES) *'),
        _textField(desc, 'Description *'),
      ],
      onValidate: () =>
          (num.tryParse(amount.text.trim()) ?? 0) > 0 &&
          desc.text.trim().isNotEmpty,
    );
    amount.dispose();
    desc.dispose();
    if (ok != true) return;
    final data = {
      'amount': num.tryParse(amount.text.trim()) ?? 0,
      'description': desc.text.trim(),
    };
    await _run(
        () => _isCashierSourced(m)
            ? _repo.editCashierCreditBill('${m['id']}', data)
            : _repo.editPayrollCreditBill('${m['id']}', data),
        ok: 'Credit bill updated');
  }

  Future<void> _payDialog(String kind, Map m, num maxAmount) async {
    final amount = TextEditingController(text: maxAmount.toStringAsFixed(0));
    final ok = await _formDialog(
      title: kind == 'loan' ? 'Record Loan Repayment' : 'Record Payment',
      builder: (setD) => [
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text('Outstanding: ${_money(maxAmount)}',
              style: const TextStyle(
                  fontSize: 12, color: _muted, fontWeight: FontWeight.w700)),
        ),
        _numField(amount, 'Payment amount (KES) *'),
      ],
      onValidate: () {
        final v = num.tryParse(amount.text.trim()) ?? 0;
        return v > 0 && v <= maxAmount + 0.01;
      },
    );
    final value = num.tryParse(amount.text.trim()) ?? 0;
    amount.dispose();
    if (ok != true) return;
    await _run(() async {
      if (kind == 'loan') {
        await _repo.recordPayrollLoanPayment('${m['id']}', {'amount': value});
      } else if (_isCashierSourced(m)) {
        await _repo.recordCashierCreditBillPayment('${m['id']}', amount: value);
      } else {
        await _repo
            .recordPayrollCreditBillPayment('${m['id']}', {'amount': value});
      }
    }, ok: 'Payment recorded');
  }

  Future<void> _rejectDialog(String kind, Map m) async {
    final reason = TextEditingController();
    // The backend requires a rejection reason (400s without one) — this used
    // to be marked optional in the UI, and even when filled in the request
    // sent the wrong field name ('reason' instead of 'rejection_reason'), so
    // every reject attempt failed regardless of what was typed.
    final ok = await _formDialog(
      title: 'Reject Credit Bill',
      builder: (setD) => [_textField(reason, 'Reason *')],
      onValidate: () => reason.text.trim().isNotEmpty,
    );
    final text = reason.text.trim();
    reason.dispose();
    if (ok != true) return;
    await _run(
        () => _isCashierSourced(m)
            ? _repo.rejectCashierCreditBill('${m['id']}', text)
            : _repo.rejectPayrollCreditBill(
                '${m['id']}', {'rejection_reason': text}),
        ok: 'Credit bill rejected');
  }

  /// Apply a cashier-recorded "paid bill" entry against one of that staff
  /// member's actual credit bills, shrinking its balance by the amount the
  /// cashier collected. Only staff_credit_bills rows qualify — that's what
  /// POST /payroll/credit-bills/cashier-paid-credits/:id/apply operates on
  /// — and the backend requires the bill to already be approved (not
  /// Pending) before a payment can land on it.
  Future<void> _applyPaidEntryDialog(Map entry) async {
    final staffId = '${entry['staff_id'] ?? ''}';
    final candidates = _credit.where((c) {
      if (!_isOpenCredit(c)) return false;
      if (staffId.isEmpty) return true;
      return '${c['staff_id'] ?? ''}' == staffId;
    }).toList();
    final remaining = _n(entry, ['remaining_amount']);

    final generalOption = <String, dynamic>{
      'id': 'unlinked',
      'description':
          'General Staff Salary Credit (Credit to Payroll / Future Bills)',
    };
    final options = [generalOption, ...candidates];

    Map<String, dynamic>? selected =
        candidates.isNotEmpty ? candidates.first : generalOption;
    final amount = TextEditingController(text: remaining.toStringAsFixed(0));

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setD) => AlertDialog(
          title: const Text('Apply Paid Bill Entry'),
          content: SizedBox(
            width: 480,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${_t(entry, [
                        'staff_name'
                      ]).ifEmpty('Staff')} — ${_money(remaining)} remaining to apply',
                  style: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<Map<String, dynamic>>(
                  value: selected,
                  decoration: _dec('Credit bill or account target *'),
                  isExpanded: true,
                  selectedItemBuilder: (_) => _buildSelectedDropdownItems(
                      options,
                      highlightUnlinked: true),
                  items: options
                      .map((c) => DropdownMenuItem(
                            value: c,
                            child: Text(
                              c['id'] == 'unlinked'
                                  ? c['description']
                                  : '${_t(c, [
                                          'description',
                                          'reason'
                                        ]).ifEmpty('Credit bill')} — Bal ${_money(_creditBalance(c))}',
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: c['id'] == 'unlinked'
                                    ? FontWeight.w700
                                    : FontWeight.w500,
                                color: c['id'] == 'unlinked' ? _success : _text,
                              ),
                            ),
                          ))
                      .toList(),
                  onChanged: (v) => setD(() => selected = v),
                ),
                const SizedBox(height: 10),
                _numField(amount, 'Amount to apply (KES) *'),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () {
                final v = num.tryParse(amount.text.trim()) ?? 0;
                if (selected == null || v <= 0) {
                  _snack('Select a valid target and amount');
                  return;
                }
                Navigator.pop(ctx, true);
              },
              child: const Text('Apply & Approve'),
            ),
          ],
        ),
      ),
    );
    final value = num.tryParse(amount.text.trim()) ?? 0;
    amount.dispose();
    if (ok != true || selected == null) return;
    await _run(
        () => _repo.applyCashierPaidCreditEntry('${entry['id']}', {
              'staff_credit_bill_id': '${selected!['id']}',
              'amount': value,
            }),
        ok: 'Payment processed successfully');
  }

  /// Directly record a staff member settling money toward their credit bill
  /// — for when the branch accountant collects/hears about the payment
  /// themselves rather than reviewing one a cashier already logged in a
  /// shift. This works like the cashier station "paid bills" flow:
  /// the accountant records a payment for the staff member and the backend
  /// auto-applies it FIFO across that staff member's open credit bills.
  Future<void> _recordPaidBillDialog() async {
    String staffId = '';
    String paymentMethod = 'cash';
    final reference = TextEditingController();
    final amount = TextEditingController();

    List<Map<String, dynamic>> candidatesFor(String id) => _credit
        .where((c) => _isOpenCredit(c) && '${c['staff_id'] ?? ''}' == id)
        .toList();

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setD) {
          final candidates = staffId.isEmpty
              ? <Map<String, dynamic>>[]
              : candidatesFor(staffId);
          final outstandingTotal = candidates.fold<num>(
            0,
            (sum, bill) => sum + _creditBalance(bill),
          );
          final needsReference = paymentMethod != 'cash';
          return AlertDialog(
            title: const Text('Record Paid Bill'),
            content: SizedBox(
              width: 460,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _staffField(
                        staffId,
                        (v) => setD(() {
                              staffId = v;
                            })),
                    const SizedBox(height: 10),
                    if (staffId.isNotEmpty && candidates.isEmpty)
                      const Text(
                        'This staff member has no open credit bill to '
                        'reduce right now.',
                        style: TextStyle(color: _danger, fontSize: 12),
                      ),
                    if (candidates.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: _success.withValues(alpha: .06),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color: _success.withValues(alpha: .18)),
                        ),
                        child: Text(
                          '${candidates.length} open credit bill(s) found • Total outstanding ${_money(outstandingTotal)}',
                          style: const TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                      ),
                    const SizedBox(height: 10),
                    _numField(amount, 'Amount paid (KES) *'),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      value: paymentMethod,
                      decoration: _dec('Payment method'),
                      items: const [
                        DropdownMenuItem(value: 'cash', child: Text('Cash')),
                        DropdownMenuItem(value: 'mpesa', child: Text('M-Pesa')),
                        DropdownMenuItem(value: 'card', child: Text('Card')),
                        DropdownMenuItem(value: 'bank', child: Text('Bank')),
                      ],
                      onChanged: (v) => setD(() => paymentMethod = v ?? 'cash'),
                    ),
                    if (needsReference) ...[
                      const SizedBox(height: 10),
                      TextField(
                        controller: reference,
                        decoration: _dec(
                          paymentMethod == 'mpesa'
                              ? 'M-Pesa reference *'
                              : paymentMethod == 'card'
                                  ? 'Card reference *'
                                  : 'Payment reference *',
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Cancel')),
              ElevatedButton(
                onPressed: () {
                  final v = num.tryParse(amount.text.trim()) ?? 0;
                  if (staffId.isEmpty) {
                    _snack('Select the staff member who paid');
                    return;
                  }
                  if (candidates.isEmpty) {
                    _snack(
                        'This staff member has no open credit bill to reduce');
                    return;
                  }
                  if (v <= 0 || v > outstandingTotal + 0.01) {
                    _snack('Enter an amount up to the total outstanding '
                        '(${_money(outstandingTotal)})');
                    return;
                  }
                  if (needsReference && reference.text.trim().isEmpty) {
                    _snack('Enter the payment reference');
                    return;
                  }
                  Navigator.pop(ctx, true);
                },
                child: const Text('Record Payment'),
              ),
            ],
          );
        },
      ),
    );
    final value = num.tryParse(amount.text.trim()) ?? 0;
    final ref = reference.text.trim();
    amount.dispose();
    reference.dispose();
    if (ok != true || staffId.isEmpty) return;
    await _run(
        () => _repo.recordPaidBillByStaff({
              'staff_id': staffId,
              'amount': value,
              'payment_method': paymentMethod,
              if (ref.isNotEmpty) 'reference': ref,
            }),
        ok: 'Paid bill recorded and applied to staff credit balance');
  }

  Future<void> _viewContents(Map m) async {
    Map<String, dynamic> contents = {};
    try {
      contents = await _repo.getPayrollCreditBillContents('${m['id']}');
    } catch (_) {}
    if (!mounted) return;
    final items =
        (contents['items'] ?? contents['contents'] ?? contents['data']);
    final list =
        items is List ? items.whereType<Map>().toList() : const <Map>[];
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('${_staffName(m)} — Credit Bill'),
        content: SizedBox(
          width: 480,
          height: (MediaQuery.of(ctx).size.height * 0.55).clamp(240.0, 440.0),
          child: list.isEmpty
              ? SingleChildScrollView(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8.0),
                    child: Text('Amount: ${_money(_n(m, ['amount']))}\n'
                        'Balance: ${_money(_creditBalance(m))}\n'
                        '${_t(m, ['description', 'reason'])}'),
                  ),
                )
              : ListView.separated(
                  itemCount: list.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (_, index) {
                    final it = Map<String, dynamic>.from(list[index]);
                    final qty = _n(it, ['quantity', 'qty']);
                    final unitPrice = _n(it, [
                      'unit_price',
                      'selling_price',
                      'price',
                      'menu_price',
                      'retail_price',
                    ]);
                    final totalPrice = _n(it, [
                      'total_price',
                      'line_total',
                      'total_amount',
                      'subtotal',
                      'total',
                      'amount',
                    ]);
                    final num finalTotal = totalPrice > 0
                        ? totalPrice
                        : (qty > 0 && unitPrice > 0 ? qty * unitPrice : unitPrice);

                    return ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        '${it['name'] ?? it['item_name'] ?? it['description'] ?? 'Item'}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      subtitle: qty > 0 || unitPrice > 0
                          ? Text(
                              'Qty ${qty > 0 ? qty : 1}${unitPrice > 0 ? ' • Unit ${_money(unitPrice)}' : ''}',
                              style: const TextStyle(fontSize: 12),
                            )
                          : null,
                      trailing: Text(
                        _money(finalTotal),
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    );
                  },
                ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
        ],
      ),
    );
  }

  // ── Shared form primitives ─────────────────────────────────────────────────
  Future<bool?> _formDialog({
    required String title,
    required List<Widget> Function(void Function(void Function()) setD) builder,
    required bool Function() onValidate,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setD) => AlertDialog(
          title: Text(title),
          content: SizedBox(
            width: 460,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final w in builder(setD)) ...[
                    w,
                    const SizedBox(height: 10)
                  ],
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () {
                if (!onValidate()) {
                  _snack('Please complete the required fields');
                  return;
                }
                Navigator.pop(ctx, true);
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _dec(String label) =>
      InputDecoration(labelText: label, isDense: true);

  /// Searchable staff picker used by the New Credit Bill / Advance / Loan
  /// dialogs — tap to open a type-to-filter list (name, employee ID, dept).
  Widget _staffField(String value, ValueChanged<String> onChanged) {
    String selectedLabel = '';
    if (value.isNotEmpty) {
      final s = _staffIndex[value];
      if (s != null) selectedLabel = _staffName(s);
    }
    return InkWell(
      borderRadius: BorderRadius.circular(4),
      onTap: () async {
        final picked = await _pickStaff();
        if (picked != null) onChanged(picked);
      },
      child: InputDecorator(
        decoration: _dec('Staff member *').copyWith(
          suffixIcon: const Icon(Icons.search, size: 18),
        ),
        child: Text(
          selectedLabel.isEmpty ? 'Tap to search staff…' : selectedLabel,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: selectedLabel.isEmpty ? _muted : _text,
            fontWeight:
                selectedLabel.isEmpty ? FontWeight.w400 : FontWeight.w700,
          ),
        ),
      ),
    );
  }

  Future<String?> _pickStaff() {
    var query = '';
    return showDialog<String>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setD) {
          final q = query.trim().toLowerCase();
          final filtered = _staffList.where((s) {
            if (q.isEmpty) return true;
            final hay = '${_staffName(s)} '
                    '${_t(s, [
                  'employee_id',
                  'employee_number',
                  'national_id'
                ])} '
                    '${_t(s, ['department', 'role'])}'
                .toLowerCase();
            return hay.contains(q);
          }).toList();
          return AlertDialog(
            title: const Text('Select staff member'),
            content: SizedBox(
              width: 480,
              height:
                  (MediaQuery.of(ctx).size.height * 0.55).clamp(240.0, 440.0),
              child: Column(
                children: [
                  TextField(
                    autofocus: true,
                    decoration: const InputDecoration(
                      isDense: true,
                      prefixIcon: Icon(Icons.search, size: 18),
                      hintText: 'Search name, employee ID, department',
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (v) => setD(() => query = v),
                  ),
                  const SizedBox(height: 8),
                  Expanded(
                    child: filtered.isEmpty
                        ? const Center(
                            child: Text('No staff found',
                                style: TextStyle(color: _muted)))
                        : ListView.separated(
                            itemCount: filtered.length,
                            separatorBuilder: (_, __) =>
                                const Divider(height: 1),
                            itemBuilder: (_, i) {
                              final s = filtered[i];
                              final id = _t(s, ['id', 'staff_id']);
                              final sub = [
                                _t(s, [
                                  'employee_id',
                                  'employee_number',
                                  'national_id'
                                ]),
                                _t(s, ['department', 'role']),
                              ].where((e) => e.isNotEmpty).join('  •  ');
                              return ListTile(
                                dense: true,
                                title: Text(_staffName(s),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700)),
                                subtitle: sub.isEmpty ? null : Text(sub),
                                onTap: id.isEmpty
                                    ? null
                                    : () => Navigator.pop(ctx, id),
                              );
                            },
                          ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancel')),
            ],
          );
        },
      ),
    );
  }

  Widget _textField(TextEditingController c, String label) =>
      TextField(controller: c, decoration: _dec(label));

  Widget _numField(TextEditingController c, String label,
          {bool integer = false}) =>
      TextField(
        controller: c,
        keyboardType: TextInputType.numberWithOptions(decimal: !integer),
        inputFormatters: integer
            ? [FilteringTextInputFormatter.digitsOnly]
            : [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
        decoration: _dec(label),
      );

  Widget _dateField(
      String label, DateTime value, ValueChanged<DateTime> onPick) {
    return InkWell(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: value,
          firstDate: DateTime(2023),
          lastDate: DateTime(2030),
        );
        if (picked != null) onPick(picked);
      },
      child: InputDecorator(
        decoration: _dec(label),
        child: Text(DateFormat('dd MMM yyyy').format(value),
            style: const TextStyle(fontSize: 13)),
      ),
    );
  }
}

extension _Str on String {
  String ifEmpty(String fallback) => trim().isEmpty ? fallback : this;
}
