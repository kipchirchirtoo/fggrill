import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import 'package:famous_gates_app/core/utils/pos_pin_rules.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/readable_record.dart';
import '../../../core/widgets/master_dashboard_shell.dart';
import '../../../core/widgets/record_detail_screen.dart';
import '../data/repository.dart';
import '../domain/models.dart';
import 'mobile/mobile_manager_reviews_screen.dart';
import '../../reception/presentation/screens/conference_booking_screen.dart';
import '../../branch_accountant/presentation/waiter_audit_screen.dart';
import '../../auth/domain/auth_notifier.dart';

/// Streamlined Branch Manager sections.
///
/// The dashboard nav surfaces only the core management screens (see
/// [_BranchManagerDashboardState._navItems]). The remaining values are
/// supporting detail / workflow views reached from those screens or via
/// deep-link routes (e.g. `/branch-manager/staff/:id`).
enum BranchManagerSection {
  // ── Core nav screens ──────────────────────────────────────────────────
  overview,
  waiterSales,
  staffPerformance,
  conferenceBooking,
  users,
  staff,
  checkin,
  reservations,
  reviews,
  attendance,
  leave,
  offers,
  // ── Supporting detail / workflow views (not in nav) ───────────────────
  newReservation,
  reservationDetail,
  arrivals,
  departures,
  guests,
  guestDetail,
  staffDetail,
  staffAttendance,
  staffLeave,
  staffKpis,
  staffDocuments,
}

class BranchManagerDashboard extends ConsumerStatefulWidget {
  const BranchManagerDashboard({
    super.key,
    this.initialSection = BranchManagerSection.overview,
    this.recordId,
  });

  final BranchManagerSection initialSection;
  final String? recordId;

  @override
  ConsumerState<BranchManagerDashboard> createState() =>
      _BranchManagerDashboardState();
}

class _BranchManagerDashboardState
    extends ConsumerState<BranchManagerDashboard> {
  late BranchManagerSection _section;
  String? _recordId;
  bool _loading = true;
  bool _busy = false;
  String _search = '';
  String _status = 'all';
  String _period = 'today';
  int _staffPerformancePeriod = 30;
  String _staffPerfTab = 'kpis';
  String _leaveTab = 'active';
  bool _leaveDateFilter = false;
  DateTime _date = DateTime.now();
  DateTime _from = DateTime.now().subtract(const Duration(days: 6));
  DateTime _to = DateTime.now();

  BranchManagerStats _stats = const BranchManagerStats();
  Map<String, dynamic> _summary = {};
  Map<String, dynamic>? _detail;
  List<Map<String, dynamic>> _rows = [];
  List<Map<String, dynamic>> _secondaryRows = [];

  // Executive dashboard performance snapshot.
  int _staffTotal = 0;
  int _staffOnDuty = 0;
  int _bookingsInHouse = 0;
  int _bookingsUpcoming = 0;

  BranchManagerRepository get _repo =>
      ref.read(branchManagerRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _section = widget.initialSection;
    _recordId = widget.recordId;
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void didUpdateWidget(covariant BranchManagerDashboard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialSection != widget.initialSection ||
        oldWidget.recordId != widget.recordId) {
      _section = widget.initialSection;
      _recordId = widget.recordId;
      _resetFilters();
      _load();
    }
  }

  Future<T> _safe<T>(Future<T> Function() action, T fallback) async {
    try {
      return await action();
    } catch (_) {
      return fallback;
    }
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loading = true);
    try {
      _summary = {};
      _detail = null;
      _secondaryRows = [];
      switch (_section) {
        case BranchManagerSection.overview:
          final results = await Future.wait<dynamic>([
            _repo.getDashboardStats(),
            _safe(() => _repo.staff(), <Map<String, dynamic>>[]),
            _safe(() => _repo.staffAttendance(date: _ymd(DateTime.now())),
                <Map<String, dynamic>>[]),
            _safe(() => _repo.bookings(), <Map<String, dynamic>>[]),
          ]);
          _stats = results[0] as BranchManagerStats;
          final overviewStaff = results[1] as List<Map<String, dynamic>>;
          final overviewAttendance = results[2] as List<Map<String, dynamic>>;
          final overviewBookings = results[3] as List<Map<String, dynamic>>;
          _staffTotal = overviewStaff.length;
          _staffOnDuty = overviewAttendance.map(_normalizeRecord).where((row) {
            final status = _attendanceStatus(row);
            return status == 'present' || status == 'late';
          }).length;
          _bookingsInHouse = overviewBookings
              .where((row) =>
                  _text(row, ['status']).toLowerCase() == 'checked_in')
              .length;
          _bookingsUpcoming = overviewBookings
              .where((row) =>
                  _text(row, ['status']).toLowerCase() == 'confirmed')
              .length;
          _rows = [];
          break;
        case BranchManagerSection.waiterSales:
          _summary =
              await _repo.waiterSalesReport(period: _period, date: _ymd(_date));
          _rows = _listFrom(
              _summary['waiter_sales'] ?? _summary['rows'] ?? _summary['data']);
          break;
        case BranchManagerSection.reservations:
          _rows = await _repo.bookings(status: _status, search: _search);
          break;
        case BranchManagerSection.newReservation:
          _rows = await _safe(
              () => _repo.guests(search: _search), <Map<String, dynamic>>[]);
          _secondaryRows = await _safe(
            () => _repo.availableRooms(
              checkIn: _ymd(_from),
              checkOut: _ymd(_to),
            ),
            <Map<String, dynamic>>[],
          );
          break;
        case BranchManagerSection.reservationDetail:
        case BranchManagerSection.checkin:
        case BranchManagerSection.arrivals:
        case BranchManagerSection.departures:
          await _loadBookingWorkflow();
          break;
        case BranchManagerSection.guests:
          _rows = await _repo.guests(search: _search);
          break;
        case BranchManagerSection.guestDetail:
          if (_recordId != null) {
            _detail = await _repo.guest(_recordId!);
            _rows = await _repo.guestHistory(_recordId!);
          } else {
            _rows = await _repo.guests(search: _search);
          }
          break;
        case BranchManagerSection.staff:
          _rows = await _repo.staff(department: _status, search: _search);
          _secondaryRows = await _safe(
            () => _repo.staffAttendance(date: _ymd(DateTime.now())),
            <Map<String, dynamic>>[],
          );
          break;
        case BranchManagerSection.users:
          _rows = await _repo.users(search: _search, role: _status);
          _secondaryRows = await _safe(
            () => _repo.staff(search: _search),
            <Map<String, dynamic>>[],
          );
          break;
        case BranchManagerSection.staffPerformance:
          _summary = await _repo.staffPerformanceReport(
            period: _staffPerformancePeriod,
            department: _status,
          );
          _rows = _listFrom(_summary['performance'] ??
              _summary['rows'] ??
              _summary['staff'] ??
              _summary['data']);
          break;
        case BranchManagerSection.staffDetail:
          await _loadStaffDetail();
          break;
        case BranchManagerSection.staffAttendance:
          _rows = await _repo.staffAttendance(
            date: _period == 'today' ? _ymd(_date) : null,
            startDate: _period == 'today' ? null : _attendanceStartDate(),
            endDate: _period == 'today' ? null : _ymd(_date),
            staffId: _recordId,
          );
          break;
        case BranchManagerSection.staffLeave:
          _rows = await _repo.leaveRequests(staffId: _recordId);
          break;
        case BranchManagerSection.staffKpis:
          _rows =
              await _repo.staffPerformance(period: _period, staffId: _recordId);
          _secondaryRows = await _repo.staffAttendance(staffId: _recordId);
          break;
        case BranchManagerSection.staffDocuments:
          _rows = _recordId == null
              ? <Map<String, dynamic>>[]
              : await _repo.staffDocuments(_recordId!);
          break;
        case BranchManagerSection.attendance:
          _rows = await _repo.staffAttendance(
            date: _period == 'today' ? _ymd(_date) : null,
            startDate: _period == 'today' ? null : _attendanceStartDate(),
            endDate: _period == 'today' ? null : _ymd(_date),
          );
          break;
        case BranchManagerSection.leave:
          _rows = await _repo.leaveRequests(status: _status);
          _secondaryRows = await _safe(
            () => _repo.staff(search: _search),
            <Map<String, dynamic>>[],
          );
          break;
        case BranchManagerSection.reviews:
        case BranchManagerSection.conferenceBooking:
        case BranchManagerSection.offers:
          break;
      }
    } catch (error) {
      if (mounted) _snack('Failed to load ${_label(_section)}: $error');
      _rows = [];
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadBookingWorkflow() async {
    if (_recordId != null &&
        _section == BranchManagerSection.reservationDetail) {
      _detail = await _repo.booking(_recordId!);
      _rows = [];
      return;
    }
    if (_section == BranchManagerSection.arrivals) {
      _rows = await _repo.bookings(
        status: 'confirmed',
        dateField: 'checkIn',
        date: _ymd(_date),
        search: _search,
      );
      return;
    }
    if (_section == BranchManagerSection.departures) {
      _rows = await _repo.bookings(
        status: 'checked_in',
        dateField: 'checkOut',
        date: _ymd(_date),
        search: _search,
      );
      return;
    }
    _rows = await _repo.bookings(status: 'confirmed', search: _search);
  }

  Future<void> _loadStaffDetail() async {
    if (_recordId == null) {
      _rows = await _repo.staff(search: _search);
      return;
    }
    _detail = await _repo.staffMember(_recordId!);
    final results = await Future.wait<List<Map<String, dynamic>>>([
      _safe(() => _repo.staffAttendance(staffId: _recordId),
          <Map<String, dynamic>>[]),
      _safe(() => _repo.leaveRequests(staffId: _recordId),
          <Map<String, dynamic>>[]),
      _safe(() => _repo.staffPerformance(staffId: _recordId),
          <Map<String, dynamic>>[]),
    ]);
    _rows = [
      ...results[0].map((row) => {'type': 'Attendance', ...row}),
      ...results[1].map((row) => {'type': 'Leave', ...row}),
      ...results[2].map((row) => {'type': 'Performance', ...row}),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return MasterDashboardShell<BranchManagerSection>(
      title: 'Branch Manager',
      subtitle: 'Famous Gates',
      initials: 'BM',
      breadcrumbRoot: 'Branch Manager',
      searchHint: 'Search branch workflows...',
      palette: const ShellPalette(
        background: Color(0xFFFAF0F2),
        surface: Colors.white,
        accent: AppColors.kPrimary,
      ),
      currentSection: _section,
      items: _navItems,
      onSectionSelected: (section) {
        setState(() {
          _section = section;
          _recordId = null;
          _resetFilters();
        });
        _load();
      },
      child: KeyedSubtree(
        key: ValueKey('${_section.name}-${_recordId ?? ''}'),
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _buildSection(),
      ),
    );
  }

  List<MasterNavItem<BranchManagerSection>> get _navItems => [
        // ── Overview ──────────────────────────────────────────────────────────
        const MasterNavItem(
          section: BranchManagerSection.overview,
          label: 'Executive Dashboard',
          icon: Icons.dashboard_outlined,
          group: null,
        ),
        // ── Performance & Audit ───────────────────────────────────────────────
        const MasterNavItem(
          section: BranchManagerSection.waiterSales,
          label: 'Waiter Performance',
          icon: Icons.groups_outlined,
          group: 'Performance & Audit',
        ),
        const MasterNavItem(
          section: BranchManagerSection.staffPerformance,
          label: 'Staff Performance & Audit',
          icon: Icons.speed_outlined,
          group: 'Performance & Audit',
        ),
        // ── Guest Services ────────────────────────────────────────────────────
        MasterNavItem(
          section: BranchManagerSection.checkin,
          label: 'Check-in / Check-out',
          icon: PhosphorIcons.signIn(),
          group: 'Guest Services',
        ),
        MasterNavItem(
          section: BranchManagerSection.reservations,
          label: 'Reservations',
          icon: PhosphorIcons.calendarCheck(),
          group: 'Guest Services',
        ),
        const MasterNavItem(
          section: BranchManagerSection.conferenceBooking,
          label: 'Conference Bookings',
          icon: Icons.meeting_room_outlined,
          group: 'Guest Services',
        ),
        MasterNavItem(
          section: BranchManagerSection.reviews,
          label: 'Customer Reviews',
          icon: PhosphorIcons.star(),
          group: 'Guest Services',
        ),
        // ── Pricing & Offers ──────────────────────────────────────────────────
        const MasterNavItem(
          section: BranchManagerSection.offers,
          label: 'Discounts & Offers',
          icon: Icons.local_offer_outlined,
          group: 'Pricing & Offers',
        ),
        // ── Personnel & HR ────────────────────────────────────────────────────
        const MasterNavItem(
          section: BranchManagerSection.users,
          label: 'User Accounts',
          icon: Icons.badge_outlined,
          group: 'Personnel & HR',
        ),
        MasterNavItem(
          section: BranchManagerSection.staff,
          label: 'Staff Directory',
          icon: PhosphorIcons.users(),
          group: 'Personnel & HR',
        ),
        MasterNavItem(
          section: BranchManagerSection.attendance,
          label: 'Attendance',
          icon: PhosphorIcons.clock(),
          group: 'Personnel & HR',
        ),
        MasterNavItem(
          section: BranchManagerSection.leave,
          label: 'Leave Requests',
          icon: PhosphorIcons.paperPlaneTilt(),
          group: 'Personnel & HR',
        ),
      ];

  Widget _buildSection() {
    switch (_section) {
      case BranchManagerSection.overview:
        return _overview();
      case BranchManagerSection.newReservation:
        return _reservationBuilder();
      case BranchManagerSection.reservationDetail:
      case BranchManagerSection.guestDetail:
      case BranchManagerSection.staffDetail:
        return _detailPage();
      case BranchManagerSection.checkin:
        return _bookingList(
          title: 'Check-in Desk',
          subtitle: 'Confirmed reservations and walk-in intake.',
          primaryAction: 'Walk-in',
          onPrimary: _showWalkInDialog,
        );
      case BranchManagerSection.arrivals:
        return _bookingList(
          title: 'Today Arrivals',
          subtitle: 'Confirmed guests expected on ${_ymd(_date)}.',
        );
      case BranchManagerSection.departures:
        return _bookingList(
          title: 'Today Departures',
          subtitle: 'Checked-in guests due out on ${_ymd(_date)}.',
        );
      case BranchManagerSection.reservations:
        return _genericPage(
          title: 'Reservations',
          subtitle: _subtitle(_section),
          fields: _fieldsFor(_section),
          createLabel: _createLabel(_section),
          onCreate: _createHandler(_section),
          actionsBuilder: _actionsFor,
        );
      case BranchManagerSection.guests:
        return _genericPage(
          title: 'Guest Directory',
          subtitle: _subtitle(_section),
          fields: _fieldsFor(_section),
          createLabel: _createLabel(_section),
          onCreate: _createHandler(_section),
          actionsBuilder: _actionsFor,
        );
      case BranchManagerSection.staff:
        return _genericPage(
          title: 'Staff Directory',
          subtitle: _subtitle(_section),
          fields: _fieldsFor(_section),
          createLabel: _createLabel(_section),
          onCreate: _createHandler(_section),
          actionsBuilder: _actionsFor,
        );
      case BranchManagerSection.users:
        return _genericPage(
          title: 'User Accounts',
          subtitle: _subtitle(_section),
          fields: _fieldsFor(_section),
          createLabel: _createLabel(_section),
          onCreate: _createHandler(_section),
          actionsBuilder: _actionsFor,
        );
      case BranchManagerSection.conferenceBooking:
        return const ConferenceBookingScreen();
      case BranchManagerSection.offers:
        return const _OffersSection();
      case BranchManagerSection.leave:
        return _leaveManagement();
      case BranchManagerSection.reviews:
        return const MobileManagerReviewsScreen();
      case BranchManagerSection.waiterSales:
        return _waiterPerformance();
      case BranchManagerSection.attendance:
      case BranchManagerSection.staffAttendance:
        return _attendanceDashboard();
      case BranchManagerSection.staffPerformance:
        return _staffPerformanceWithAudit();
      case BranchManagerSection.staffDocuments:
        return _genericPage(
          title: 'Staff Documents',
          subtitle: 'Document upload/download controls from the web workflow.',
          fields: const ['document_type', 'file_name', 'created_at', 'status'],
          actionsBuilder: (row) => [
            _miniButton('View', () => _showRow(row)),
            _miniButton('Download', () => _snack('Document download coming soon')),
          ],
        );
      default:
        return _genericPage(
          title: _label(_section),
          subtitle: _subtitle(_section),
          fields: _fieldsFor(_section),
          createLabel: _createLabel(_section),
          onCreate: _createHandler(_section),
          actionsBuilder: _actionsFor,
        );
    }
  }

  Widget _overview() {
    final user = ref.watch(authNotifierProvider).valueOrNull;
    final fullName = (user?.name ?? '').trim();
    final firstName =
        fullName.isEmpty ? 'Manager' : fullName.split(RegExp(r'\s+')).first;
    final branchName = (user?.branchName ?? '').trim();
    final occupied = _stats.occupiedRooms;
    final totalRooms = _stats.totalRooms;
    final occupancyPct =
        totalRooms > 0 ? occupied / totalRooms * 100 : _stats.occupancyRate;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Greeting ────────────────────────────────────────────────────
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${_greeting()}, $firstName 👋',
                      style: Theme.of(context)
                          .textTheme
                          .headlineLarge
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      [
                        branchName.isEmpty ? 'Famous Gates' : branchName,
                        _longDate(DateTime.now()),
                      ].join('  ·  '),
                      style: const TextStyle(
                          color: AppColors.kTextSecondary, fontSize: 15),
                    ),
                  ],
                ),
              ),
              OutlinedButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Refresh'),
              ),
            ],
          ),
          const SizedBox(height: 28),
          // ── Branch performance ──────────────────────────────────────────
          const Text('Branch Performance',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 14),
          Wrap(
            spacing: 16,
            runSpacing: 16,
            children: [
              _overviewStat(
                icon: PhosphorIcons.users(),
                color: AppColors.kPrimary,
                label: 'Branch Staff',
                value: '$_staffTotal',
                caption: '$_staffOnDuty on duty today',
              ),
              _overviewStat(
                icon: PhosphorIcons.bed(),
                color: AppColors.kSuccess,
                label: 'Room Occupancy',
                value: '${occupancyPct.toStringAsFixed(0)}%',
                caption: totalRooms > 0
                    ? '$occupied of $totalRooms rooms occupied'
                    : 'No room data',
              ),
              _overviewStat(
                icon: PhosphorIcons.calendarCheck(),
                color: AppColors.kWarning,
                label: 'Guests In-House',
                value: '$_bookingsInHouse',
                caption: '$_bookingsUpcoming upcoming bookings',
              ),
            ],
          ),
          const SizedBox(height: 30),
          // ── Quick links ─────────────────────────────────────────────────
          const Text('Go to',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 14),
          Wrap(
            spacing: 14,
            runSpacing: 14,
            children: [
              _navLink('Waiter Performance', Icons.groups_outlined,
                  BranchManagerSection.waiterSales),
              _navLink('Staff Performance & Audit', Icons.speed_outlined,
                  BranchManagerSection.staffPerformance),
              _navLink('Check-in / Check-out', PhosphorIcons.signIn(),
                  BranchManagerSection.checkin),
              _navLink('Reservations', PhosphorIcons.calendarCheck(),
                  BranchManagerSection.reservations),
              _navLink('Conference Bookings', Icons.meeting_room_outlined,
                  BranchManagerSection.conferenceBooking),
              _navLink('Customer Reviews', PhosphorIcons.star(),
                  BranchManagerSection.reviews),
              _navLink('User Accounts', Icons.badge_outlined,
                  BranchManagerSection.users),
              _navLink('Staff Directory', PhosphorIcons.users(),
                  BranchManagerSection.staff),
              _navLink('Attendance', PhosphorIcons.clock(),
                  BranchManagerSection.attendance),
              _navLink('Leave Requests', PhosphorIcons.paperPlaneTilt(),
                  BranchManagerSection.leave),
            ],
          ),
        ],
      ),
    );
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  String _longDate(DateTime d) {
    const days = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday'
    ];
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
    return '${days[d.weekday - 1]}, ${d.day} ${months[d.month - 1]} ${d.year}';
  }

  Widget _overviewStat({
    required IconData icon,
    required Color color,
    required String label,
    required String value,
    required String caption,
  }) {
    return SizedBox(
      width: 268,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.kDivider.withValues(alpha: 0.6)),
        ),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(
                          color: AppColors.kTextSecondary, fontSize: 13)),
                  const SizedBox(height: 2),
                  Text(value,
                      style: const TextStyle(
                          fontSize: 26, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 2),
                  Text(caption,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: AppColors.kTextSecondary, fontSize: 12)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _navLink(String label, IconData icon, BranchManagerSection section) {
    return SizedBox(
      width: 224,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          setState(() {
            _section = section;
            _recordId = null;
            _resetFilters();
          });
          _load();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border:
                Border.all(color: AppColors.kDivider.withValues(alpha: 0.6)),
          ),
          child: Row(
            children: [
              Icon(icon, size: 20, color: AppColors.kPrimary),
              const SizedBox(width: 12),
              Expanded(
                child: Text(label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
              const Icon(Icons.chevron_right,
                  size: 18, color: AppColors.kTextSecondary),
            ],
          ),
        ),
      ),
    );
  }

  Widget _bookingList({
    required String title,
    required String subtitle,
    String? primaryAction,
    VoidCallback? onPrimary,
  }) {
    return _genericPage(
      title: title,
      subtitle: subtitle,
      fields: _fieldsFor(BranchManagerSection.reservations),
      createLabel: primaryAction,
      onCreate: onPrimary,
      dateFilter: true,
      actionsBuilder: _actionsFor,
    );
  }

  Widget _reservationBuilder() {
    return _page(
      title: 'New Reservation',
      subtitle:
          'Create a reservation after selecting dates, guest details, and an available room.',
      trailing: [
        _dateRangeButton(),
        ElevatedButton.icon(
          onPressed: () => _showFormDialog(
            title: 'Create Reservation',
            fields: const [
              'guest_id',
              'room_id',
              'check_in_date',
              'check_out_date',
              'adults',
              'children',
              'total_amount',
              'notes',
            ],
            onSubmit: (data) async {
              await _repo.createBooking({
                ...data,
                'check_in_date': data['check_in_date'] ?? _ymd(_from),
                'check_out_date': data['check_out_date'] ?? _ymd(_to),
                'status': 'confirmed',
              });
            },
          ),
          icon: const Icon(Icons.save, size: 16),
          label: const Text('Create'),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _panel(
              'Available Rooms',
              _dataList(_secondaryRows,
                  const ['room_number', 'number', 'type', 'status'])),
          const SizedBox(height: 16),
          _panel('Guest Search',
              _dataList(_rows, _fieldsFor(BranchManagerSection.guests))),
        ],
      ),
    );
  }

  Widget _detailPage() {
    final detail = _detail == null ? null : _normalizeRecord(_detail!);
    final title = detail == null ? _label(_section) : _titleFor(detail);
    return _page(
      title: title,
      subtitle: detail == null
          ? 'Detail view with related workflow history and actions.'
          : _subtitleForRow(detail).ifEmpty(
              'Readable ${_label(_section).toLowerCase()} summary and history.'),
      trailing: [
        OutlinedButton.icon(
          onPressed: _load,
          icon: const Icon(Icons.refresh, size: 16),
          label: const Text('Refresh'),
        ),
      ],
      child: Column(
        children: [
          if (detail != null) _detailCard(detail),
          const SizedBox(height: 16),
          _dataList(_rows, _fieldsFor(_section), actionsBuilder: _actionsFor),
        ],
      ),
    );
  }

  Widget _waiterPerformance() {
    final summary = _summaryMap();
    final rows = _rankWaiters(_rows.map(_normalizeRecord).toList());
    return _page(
      title: 'Waiter Performance',
      subtitle:
          'Ranked by completed orders, total orders, revenue, and items served.',
      trailing: [
        _periodButton(),
        _dateButton(),
        OutlinedButton.icon(
          onPressed: () => _exportRows('waiter_performance', rows),
          icon: const Icon(Icons.download, size: 16),
          label: const Text('Export'),
        ),
        OutlinedButton.icon(
          onPressed: _load,
          icon: const Icon(Icons.refresh, size: 16),
          label: const Text('Refresh'),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(spacing: 12, runSpacing: 12, children: [
            _metric(
                'Waiters',
                _summaryValue(summary, ['total_waiters'], rows.length),
                PhosphorIcons.users(),
                AppColors.kPrimary),
            _metric(
                'Completed Orders',
                _summaryValue(summary, ['total_orders'],
                    _sumRows(rows, ['completed_orders', 'total_orders'])),
                PhosphorIcons.checkCircle(),
                AppColors.kSuccess),
            _metric('Revenue', _money(_num(summary, ['total_revenue'])),
                PhosphorIcons.money(), AppColors.kWarning),
            _metric(
                'Average Order',
                _money(_num(summary, ['average_order_value'])),
                PhosphorIcons.chartBar(),
                AppColors.kAccent),
          ]),
          const SizedBox(height: 18),
          _panel(
            'Top Waiters',
            rows.isEmpty
                ? const _EmptyNotice('No waiter activity found.')
                : Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: rows
                        .take(5)
                        .map((row) => _waiterRankCard(row))
                        .toList(),
                  ),
          ),
          const SizedBox(height: 18),
          _waiterTable(rows),
        ],
      ),
    );
  }

  Widget _waiterRankCard(Map<String, dynamic> row) {
    final rank = _text(row, ['rank']);
    final orders =
        _text(row, ['completed_orders', 'total_orders']).ifEmpty('0');
    return SizedBox(
      width: 290,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.kDivider.withValues(alpha: 0.65)),
        ),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: AppColors.kPrimary,
              child: Text('#$rank',
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w900)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_titleFor(row),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w900)),
                  Text('$orders completed orders',
                      style: const TextStyle(
                          color: AppColors.kTextSecondary, fontSize: 12)),
                ],
              ),
            ),
            Text(_money(_num(row, ['total_revenue'])),
                style: const TextStyle(fontWeight: FontWeight.w900)),
          ],
        ),
      ),
    );
  }

  Widget _waiterTable(List<Map<String, dynamic>> rows) {
    if (rows.isEmpty) return const _EmptyNotice('No waiter sales found.');
    return Card(
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          headingRowColor:
              WidgetStatePropertyAll(AppColors.kSurface.withValues(alpha: 0.8)),
          columns: const [
            DataColumn(label: Text('Rank')),
            DataColumn(label: Text('Waiter')),
            DataColumn(label: Text('Completed Orders')),
            DataColumn(label: Text('Items Sold')),
            DataColumn(label: Text('Revenue')),
            DataColumn(label: Text('Average Order')),
            DataColumn(label: Text('Tips')),
            DataColumn(label: Text('Actions')),
          ],
          rows: rows.map((row) {
            return DataRow(cells: [
              DataCell(Text('#${_text(row, ['rank'])}',
                  style: const TextStyle(fontWeight: FontWeight.w900))),
              DataCell(_staffCell(row)),
              DataCell(Text(_text(row, ['completed_orders', 'total_orders'])
                  .ifEmpty('0'))),
              DataCell(Text(_text(row, ['total_items_sold']).ifEmpty('0'))),
              DataCell(Text(_money(_num(row, ['total_revenue'])))),
              DataCell(Text(_money(_num(row, ['average_order_value'])))),
              DataCell(Text(_money(_num(row, ['total_tips'])))),
              DataCell(IconButton(
                tooltip: 'View waiter',
                icon: const Icon(Icons.visibility_outlined, size: 18),
                onPressed: () => _showRow(row),
              )),
            ]);
          }).toList(),
        ),
      ),
    );
  }

  Widget _attendanceDashboard() {
    final rows = _rankAttendance(_rows.map(_normalizeRecord).toList());
    final present =
        rows.where((row) => _attendanceStatus(row) == 'present').length;
    final late = rows.where((row) => _attendanceStatus(row) == 'late').length;
    final absent =
        rows.where((row) => _attendanceStatus(row) == 'absent').length;
    return _page(
      title: 'Attendance',
      subtitle:
          'Daily, weekly, and monthly branch attendance with staff ranking.',
      trailing: [
        DropdownButton<String>(
          value: _period,
          items: const [
            DropdownMenuItem(value: 'today', child: Text('Today')),
            DropdownMenuItem(value: 'week', child: Text('This Week')),
            DropdownMenuItem(value: 'month', child: Text('This Month')),
          ],
          onChanged: (value) {
            if (value == null) return;
            setState(() => _period = value);
            _load();
          },
        ),
        _dateButton(),
        OutlinedButton.icon(
          onPressed: () => _exportRows('attendance', rows),
          icon: const Icon(Icons.download, size: 16),
          label: const Text('Export'),
        ),
        OutlinedButton.icon(
          onPressed: _load,
          icon: const Icon(Icons.refresh, size: 16),
          label: const Text('Refresh'),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(spacing: 12, runSpacing: 12, children: [
            _metric('Records', '${rows.length}', PhosphorIcons.clock(),
                AppColors.kPrimary),
            _metric('Present', '$present', PhosphorIcons.checkCircle(),
                AppColors.kSuccess),
            _metric('Late', '$late', PhosphorIcons.warningCircle(),
                AppColors.kWarning),
            _metric(
                'Absent', '$absent', PhosphorIcons.xCircle(), AppColors.kError),
          ]),
          const SizedBox(height: 18),
          _attendanceTable(rows),
        ],
      ),
    );
  }

  Widget _attendanceTable(List<Map<String, dynamic>> rows) {
    if (rows.isEmpty) return const _EmptyNotice('No attendance records found.');
    return Card(
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          headingRowColor:
              WidgetStatePropertyAll(AppColors.kSurface.withValues(alpha: 0.8)),
          columns: const [
            DataColumn(label: Text('Rank')),
            DataColumn(label: Text('Staff Member')),
            DataColumn(label: Text('Date')),
            DataColumn(label: Text('Clock In')),
            DataColumn(label: Text('Clock Out')),
            DataColumn(label: Text('Hours')),
            DataColumn(label: Text('Status')),
            DataColumn(label: Text('Actions')),
          ],
          rows: rows.map((row) {
            return DataRow(cells: [
              DataCell(Text('#${_text(row, ['rank'])}',
                  style: const TextStyle(fontWeight: FontWeight.w900))),
              DataCell(_staffCell(row)),
              DataCell(Text(_formatDate(
                  row['attendance_date'] ?? row['date'] ?? row['created_at']))),
              DataCell(Text(_timeOnly(row['clock_in']))),
              DataCell(Text(_timeOnly(row['clock_out']))),
              DataCell(Text(
                  _text(row, ['hours_worked', 'total_hours']).ifEmpty('—'))),
              DataCell(_statusChip(_attendanceStatus(row))),
              DataCell(IconButton(
                tooltip: 'View attendance',
                icon: const Icon(Icons.visibility_outlined, size: 18),
                onPressed: () => _showRow(row),
              )),
            ]);
          }).toList(),
        ),
      ),
    );
  }

  /// Staff Performance & Audit: KPI leaderboard plus the embedded
  /// waiter/staff audit log (shared with the Branch Accountant workflow).
  Widget _staffPerformanceWithAudit() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
          child: Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _staffPerfTabButton(
                  'Performance KPIs', 'kpis', Icons.speed_outlined),
              _staffPerfTabButton(
                  'Waiter / Staff Audit', 'audit', Icons.fact_check_outlined),
            ],
          ),
        ),
        Expanded(
          child: _staffPerfTab == 'audit'
              ? const WaiterAuditScreen()
              : _staffPerformance(),
        ),
      ],
    );
  }

  Widget _staffPerfTabButton(String label, String value, IconData icon) {
    final selected = _staffPerfTab == value;
    return TextButton.icon(
      onPressed: () => setState(() => _staffPerfTab = value),
      icon: Icon(icon, size: 16),
      label: Text(label),
      style: TextButton.styleFrom(
        foregroundColor:
            selected ? AppColors.kPrimary : AppColors.kTextSecondary,
        backgroundColor:
            selected ? AppColors.kPrimary.withValues(alpha: 0.08) : null,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      ),
    );
  }

  Widget _staffPerformance() {
    final summary = _summaryMap();
    final rows = _rows.map(_normalizeRecord).where((row) {
      final query = _search.trim().toLowerCase();
      if (query.isEmpty) return true;
      return [
        'staff_name',
        'full_name',
        'email',
        'role',
        'department',
      ].any((key) => _text(row, [key]).toLowerCase().contains(query));
    }).toList();
    final topPerformers = _performanceTopRows(summary, rows);
    return _page(
      title: 'Staff Performance',
      subtitle: _text(summary, ['branch_name', 'branch'])
          .ifEmpty('Current branch staff performance'),
      trailing: [
        DropdownButton<int>(
          value: _staffPerformancePeriod,
          items: const [
            DropdownMenuItem(value: 7, child: Text('Last 7 Days')),
            DropdownMenuItem(value: 30, child: Text('Last 30 Days')),
            DropdownMenuItem(value: 90, child: Text('Last 90 Days')),
          ],
          onChanged: (value) {
            if (value == null) return;
            setState(() => _staffPerformancePeriod = value);
            _load();
          },
        ),
        OutlinedButton.icon(
          onPressed: _load,
          icon: const Icon(Icons.refresh, size: 16),
          label: const Text('Refresh'),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(spacing: 12, runSpacing: 12, children: [
            _metric(
                'Total Staff',
                _summaryValue(summary, ['total_staff'], rows.length),
                PhosphorIcons.users(),
                AppColors.kPrimary),
            _metric(
                'Avg Attendance',
                _percentText(summary, ['average_attendance']),
                PhosphorIcons.checkCircle(),
                AppColors.kSuccess),
            _metric(
                'Avg Punctuality',
                _percentText(summary, ['average_punctuality']),
                PhosphorIcons.clock(),
                AppColors.kAccent),
            _metric(
                'Task Completion',
                _percentText(summary, ['average_task_completion']),
                PhosphorIcons.target(),
                AppColors.kWarning),
            _metric(
                'Need Improvement',
                _summaryValue(
                    summary,
                    ['needs_improvement'],
                    rows
                        .where((row) => _num(row, ['performance_score']) < 60)
                        .length),
                PhosphorIcons.warningCircle(),
                AppColors.kError),
            _metric(
                'Avg Performance',
                _percentText(summary, ['average_performance']),
                PhosphorIcons.trendUp(),
                AppColors.kPrimary),
          ]),
          if (topPerformers.isNotEmpty) ...[
            const SizedBox(height: 18),
            _panel(
              'Top Performers',
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  for (var i = 0; i < topPerformers.length; i++)
                    _topPerformerCard(topPerformers[i], i + 1),
                ],
              ),
            ),
          ],
          const SizedBox(height: 18),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      decoration: const InputDecoration(
                        isDense: true,
                        prefixIcon: Icon(Icons.search, size: 18),
                        hintText: 'Search staff by name or email...',
                      ),
                      onChanged: (value) => setState(() => _search = value),
                    ),
                  ),
                  const SizedBox(width: 12),
                  DropdownButton<String>(
                    value: _statusOptions(_section).contains(_status)
                        ? _status
                        : 'all',
                    items: _statusOptions(_section)
                        .map((option) => DropdownMenuItem(
                              value: option,
                              child: Text(option == 'all'
                                  ? 'All Departments'
                                  : _pretty(option)),
                            ))
                        .toList(),
                    onChanged: (value) {
                      if (value == null) return;
                      _status = value;
                      _load();
                    },
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          _performanceTable(rows),
        ],
      ),
    );
  }

  Widget _topPerformerCard(Map<String, dynamic> row, int rank) {
    final score = _num(row, ['performance_score']);
    return SizedBox(
      width: 290,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFBEB),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFFDE68A)),
        ),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: const Color(0xFFF59E0B),
              child: Text('#$rank',
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w900)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_titleFor(row),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w900)),
                  Text(_text(row, ['role', 'department']).toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.kTextSecondary)),
                ],
              ),
            ),
            Text(_score(score),
                style: const TextStyle(
                    color: Color(0xFFD97706),
                    fontSize: 18,
                    fontWeight: FontWeight.w900)),
          ],
        ),
      ),
    );
  }

  Widget _performanceTable(List<Map<String, dynamic>> rows) {
    if (rows.isEmpty) {
      return const _EmptyNotice('No staff members match your filters.');
    }
    return Card(
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          headingRowColor:
              WidgetStatePropertyAll(AppColors.kSurface.withValues(alpha: 0.8)),
          columns: const [
            DataColumn(label: Text('Staff Member')),
            DataColumn(label: Text('Attendance')),
            DataColumn(label: Text('Punctuality')),
            DataColumn(label: Text('Task Completion')),
            DataColumn(label: Text('Performance Score')),
            DataColumn(label: Text('Revenue')),
            DataColumn(label: Text('Status')),
            DataColumn(label: Text('Actions')),
          ],
          rows: rows.map((row) {
            final id = _text(row, ['staff_id', 'id']);
            final score = _num(row, ['performance_score']);
            return DataRow(cells: [
              DataCell(_staffCell(row)),
              DataCell(_metricCell(
                _num(row, ['attendance_rate']),
                '${_text(row, ['present_days']).ifEmpty('0')}/${_text(row, [
                      'period_days'
                    ]).ifEmpty('0')} days',
              )),
              DataCell(_metricCell(
                _num(row, ['punctuality_score']),
                '${_text(row, ['late_days']).ifEmpty('0')} late',
              )),
              DataCell(_metricCell(
                _num(row, ['task_completion_rate']),
                '${_text(row, ['completed_tasks']).ifEmpty('0')}/${_text(row, [
                      'total_tasks'
                    ]).ifEmpty('0')} tasks',
              )),
              DataCell(Text(_score(score),
                  style: TextStyle(
                      color: _scoreColor(score),
                      fontSize: 16,
                      fontWeight: FontWeight.w900))),
              DataCell(Text(_num(row, ['revenue_contribution']) > 0
                  ? _money(_num(row, ['revenue_contribution']))
                  : 'N/A')),
              DataCell(_statusChip(_performanceStatus(score))),
              DataCell(IconButton(
                tooltip: 'View staff',
                icon: const Icon(Icons.visibility_outlined, size: 18),
                onPressed: id.isEmpty
                    ? null
                    : () => _openDetail(BranchManagerSection.staffDetail, id),
              )),
            ]);
          }).toList(),
        ),
      ),
    );
  }

  Widget _staffCell(Map<String, dynamic> row) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircleAvatar(
          radius: 16,
          backgroundColor: AppColors.kPrimary.withValues(alpha: 0.12),
          child: Text(_initials(_titleFor(row)),
              style: const TextStyle(
                  fontSize: 11,
                  color: AppColors.kPrimary,
                  fontWeight: FontWeight.w900)),
        ),
        const SizedBox(width: 10),
        Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_titleFor(row),
                style: const TextStyle(fontWeight: FontWeight.w800)),
            Text('${_text(row, ['role'])} • ${_text(row, ['department'])}',
                style: const TextStyle(
                    fontSize: 11, color: AppColors.kTextSecondary)),
          ],
        ),
      ],
    );
  }

  Widget _metricCell(num value, String detail) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(_score(value),
            style: TextStyle(
                color: _scoreColor(value), fontWeight: FontWeight.w900)),
        Text(detail,
            style:
                const TextStyle(fontSize: 10, color: AppColors.kTextSecondary)),
      ],
    );
  }

  Widget _leaveManagement() {
    final rows = _leaveRows();
    final stats = {
      'total': _rows.length,
      'pending':
          _rows.where((row) => _text(row, ['status']) == 'pending').length,
      'approved':
          _rows.where((row) => _text(row, ['status']) == 'approved').length,
      'rejected':
          _rows.where((row) => _text(row, ['status']) == 'rejected').length,
    };
    return _page(
      title: 'Leave Management',
      subtitle: 'Manage staff leave requests for the current branch.',
      trailing: [
        IconButton(
          tooltip: 'Refresh',
          onPressed: _load,
          icon: const Icon(Icons.refresh),
        ),
        OutlinedButton.icon(
          onPressed: () => _exportRows('leave_management', rows),
          icon: const Icon(Icons.download, size: 16),
          label: const Text('Export'),
        ),
        ElevatedButton.icon(
          onPressed: _createHandler(BranchManagerSection.leave),
          icon: const Icon(Icons.add, size: 16),
          label: const Text('New Request'),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(spacing: 10, children: [
            _tabButton('Active Leaves', 'active', Icons.schedule),
            _tabButton('History', 'history', Icons.history),
          ]),
          const SizedBox(height: 18),
          Wrap(spacing: 12, runSpacing: 12, children: [
            _metric('Total Requests', '${stats['total']}',
                PhosphorIcons.fileText(), AppColors.kTextSecondary),
            _metric('Pending', '${stats['pending']}', PhosphorIcons.clock(),
                AppColors.kWarning),
            _metric('Approved', '${stats['approved']}',
                PhosphorIcons.checkCircle(), AppColors.kSuccess),
            _metric('Rejected', '${stats['rejected']}', PhosphorIcons.xCircle(),
                AppColors.kError),
          ]),
          const SizedBox(height: 18),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      decoration: const InputDecoration(
                        isDense: true,
                        prefixIcon: Icon(Icons.search, size: 18),
                        hintText: 'Search by name or employee ID...',
                      ),
                      onChanged: (value) => setState(() => _search = value),
                    ),
                  ),
                  const SizedBox(width: 12),
                  DropdownButton<String>(
                    value: _statusOptions(_section).contains(_status)
                        ? _status
                        : 'all',
                    items: _statusOptions(_section)
                        .map((option) => DropdownMenuItem(
                              value: option,
                              child: Text(option == 'all'
                                  ? 'All Status'
                                  : _pretty(option)),
                            ))
                        .toList(),
                    onChanged: (value) {
                      if (value == null) return;
                      setState(() => _status = value);
                      _load();
                    },
                  ),
                  const SizedBox(width: 12),
                  OutlinedButton.icon(
                    onPressed: () =>
                        setState(() => _leaveDateFilter = !_leaveDateFilter),
                    icon: const Icon(Icons.filter_list, size: 16),
                    label: Text(_leaveDateFilter ? 'Date On' : 'Date Filter'),
                  ),
                  if (_leaveDateFilter) ...[
                    const SizedBox(width: 12),
                    _dateRangeButton(),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          _leaveTable(rows),
        ],
      ),
    );
  }

  Widget _tabButton(String label, String value, IconData icon) {
    final selected = _leaveTab == value;
    return TextButton.icon(
      onPressed: () => setState(() => _leaveTab = value),
      icon: Icon(icon, size: 16),
      label: Text(label),
      style: TextButton.styleFrom(
        foregroundColor:
            selected ? AppColors.kPrimary : AppColors.kTextSecondary,
        backgroundColor:
            selected ? AppColors.kPrimary.withValues(alpha: 0.08) : null,
      ),
    );
  }

  Widget _leaveTable(List<Map<String, dynamic>> rows) {
    if (rows.isEmpty) return const _EmptyNotice('No leave requests found.');
    return Card(
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          headingRowColor:
              WidgetStatePropertyAll(AppColors.kSurface.withValues(alpha: 0.8)),
          columns: const [
            DataColumn(label: Text('Employee')),
            DataColumn(label: Text('Leave Type')),
            DataColumn(label: Text('Duration')),
            DataColumn(label: Text('Days')),
            DataColumn(label: Text('Status')),
            DataColumn(label: Text('Requested')),
            DataColumn(label: Text('Actions')),
          ],
          rows: rows.map((row) {
            final id = _id(row);
            final status = _text(row, ['status']);
            return DataRow(cells: [
              DataCell(_staffCell(row)),
              DataCell(_leaveTypeChip(_text(row, ['leave_type', 'type']))),
              DataCell(Text(
                  '${_formatDate(row['start_date'])}\nto ${_formatDate(row['end_date'])}')),
              DataCell(Text('${_leaveDays(row)} days')),
              DataCell(_statusChip(status)),
              DataCell(Text(_formatDate(row['created_at']))),
              DataCell(Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    tooltip: 'View',
                    onPressed: () => _showRow(row),
                    icon: const Icon(Icons.visibility_outlined, size: 18),
                  ),
                  if (id.isNotEmpty && status == 'pending')
                    TextButton(
                        onPressed: () => _leaveAction(id, 'approve'),
                        child: const Text('Approve')),
                  if (id.isNotEmpty && status == 'pending')
                    TextButton(
                        onPressed: () => _leaveAction(id, 'reject'),
                        child: const Text('Reject')),
                  if (id.isNotEmpty && status == 'approved')
                    TextButton(
                        onPressed: () => _leaveAction(id, 'duty'),
                        child: const Text('Report duty')),
                ],
              )),
            ]);
          }).toList(),
        ),
      ),
    );
  }

  Map<String, dynamic> _summaryMap() {
    final summary = _summary['summary'];
    if (summary is Map) return Map<String, dynamic>.from(summary);
    return _summary;
  }

  String _summaryValue(
      Map<String, dynamic> summary, List<String> keys, Object fallback) {
    final value = _text(summary, keys);
    return value.isEmpty ? '$fallback' : value;
  }

  int _sumRows(List<Map<String, dynamic>> rows, List<String> keys) {
    return rows.fold<int>(0, (sum, row) => sum + _num(row, keys).round());
  }

  List<Map<String, dynamic>> _rankWaiters(List<Map<String, dynamic>> rows) {
    final ranked = rows.map((row) {
      final completed = _num(
          row, ['completed_orders', 'completed_order_count', 'total_orders']);
      return {
        ...row,
        'completed_orders': completed.round(),
      };
    }).toList();
    ranked.sort((a, b) {
      final completed = _num(b, ['completed_orders'])
          .compareTo(_num(a, ['completed_orders']));
      if (completed != 0) return completed;
      final orders =
          _num(b, ['total_orders']).compareTo(_num(a, ['total_orders']));
      if (orders != 0) return orders;
      return _num(b, ['total_revenue']).compareTo(_num(a, ['total_revenue']));
    });
    for (var i = 0; i < ranked.length; i++) {
      ranked[i]['rank'] = i + 1;
    }
    return ranked;
  }

  List<Map<String, dynamic>> _rankAttendance(List<Map<String, dynamic>> rows) {
    final ranked = rows.map((row) {
      final status = _attendanceStatus(row);
      final score = status == 'present'
          ? 3
          : status == 'late'
              ? 2
              : status == 'approved'
                  ? 1
                  : 0;
      return {...row, 'attendance_score': score};
    }).toList();
    ranked.sort((a, b) {
      final score = _num(b, ['attendance_score'])
          .compareTo(_num(a, ['attendance_score']));
      if (score != 0) return score;
      return _titleFor(a).compareTo(_titleFor(b));
    });
    for (var i = 0; i < ranked.length; i++) {
      ranked[i]['rank'] = i + 1;
    }
    return ranked;
  }

  String _attendanceStatus(Map<String, dynamic> row) {
    final status = _text(row, ['status']).toLowerCase();
    if (status.isNotEmpty) return status;
    if (_text(row, ['clock_in']).isNotEmpty) return 'present';
    return 'absent';
  }

  String _attendanceStartDate() {
    final days = _period == 'month' ? 29 : 6;
    return _ymd(_date.subtract(Duration(days: days)));
  }

  String _timeOnly(dynamic value) {
    final parsed = DateTime.tryParse('$value');
    if (parsed != null) {
      final local = parsed.toLocal();
      return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
    }
    final text = '$value'.trim();
    if (text.isEmpty || text == 'null') return '—';
    return text.length > 5 ? text.substring(0, 5) : text;
  }

  String _percentText(Map<String, dynamic> row, List<String> keys) {
    final value = _num(row, keys);
    return _score(value);
  }

  String _score(num value) => '${value.toStringAsFixed(1)}%';

  Color _scoreColor(num score) {
    if (score >= 80) return AppColors.kSuccess;
    if (score >= 60) return AppColors.kWarning;
    return AppColors.kError;
  }

  String _performanceStatus(num score) {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Improvement';
  }

  List<Map<String, dynamic>> _performanceTopRows(
    Map<String, dynamic> summary,
    List<Map<String, dynamic>> rows,
  ) {
    final top = summary['top_performers'];
    if (top is List && top.isNotEmpty) {
      return top
          .whereType<Map>()
          .map((row) => _normalizeRecord(Map<String, dynamic>.from(row)))
          .take(5)
          .toList();
    }
    final sorted = [...rows];
    sorted.sort((a, b) => _num(b, ['performance_score'])
        .compareTo(_num(a, ['performance_score'])));
    return sorted.take(5).toList();
  }

  Widget _statusChip(String status) {
    final color = _statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        readableStatus(status).toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 10.5,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }

  Widget _leaveTypeChip(String type) {
    final color = switch (type.toLowerCase()) {
      'annual' => AppColors.kPrimary,
      'sick' => AppColors.kError,
      'maternity' || 'paternity' => AppColors.kAccent,
      'emergency' => AppColors.kWarning,
      _ => AppColors.kTextSecondary,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        readableStatus(type.isEmpty ? 'Leave' : type),
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  List<Map<String, dynamic>> _leaveRows() {
    final query = _search.trim().toLowerCase();
    final today = DateTime.now();
    return _rows.map(_normalizeRecord).where((row) {
      final status = _text(row, ['status']);
      if (_status != 'all' && status != _status) return false;
      final end = DateTime.tryParse('${row['end_date'] ?? ''}');
      final isActive = end == null ||
          !end.isBefore(DateTime(
            today.year,
            today.month,
            today.day,
          ));
      if (_leaveTab == 'active' && !isActive) return false;
      if (_leaveTab == 'history' && isActive) return false;
      if (query.isNotEmpty) {
        final haystack = [
          _titleFor(row),
          _text(row, ['id_number', 'employee_number', 'staff_number']),
          _text(row, ['department', 'role']),
        ].join(' ').toLowerCase();
        if (!haystack.contains(query)) return false;
      }
      final created = DateTime.tryParse('${row['created_at'] ?? ''}');
      if (_leaveDateFilter && created != null) {
        final start = DateTime(_from.year, _from.month, _from.day);
        final endRange = DateTime(_to.year, _to.month, _to.day, 23, 59, 59);
        if (created.isBefore(start) || created.isAfter(endRange)) return false;
      }
      return true;
    }).toList();
  }

  int _leaveDays(Map<String, dynamic> row) {
    final explicit = int.tryParse(_text(row, ['days', 'duration_days']));
    if (explicit != null && explicit > 0) return explicit;
    final start = DateTime.tryParse('${row['start_date'] ?? ''}');
    final end = DateTime.tryParse('${row['end_date'] ?? ''}');
    if (start == null || end == null) return 0;
    return end.difference(start).inDays.abs() + 1;
  }

  String _formatDate(dynamic value) {
    final parsed = DateTime.tryParse('$value');
    if (parsed == null) {
      final text = '$value'.trim();
      return text.isEmpty || text == 'null' ? '—' : text;
    }
    return '${parsed.day.toString().padLeft(2, '0')}/${parsed.month.toString().padLeft(2, '0')}/${parsed.year}';
  }

  String _initials(String name) {
    final parts = name
        .split(RegExp(r'\s+'))
        .where((part) => part.trim().isNotEmpty)
        .toList();
    if (parts.isEmpty) return 'BM';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  Widget _genericPage({
    required String title,
    required String subtitle,
    required List<String> fields,
    String? createLabel,
    VoidCallback? onCreate,
    bool dateFilter = false,
    List<Widget> Function(Map<String, dynamic>)? actionsBuilder,
  }) {
    return _page(
      title: title,
      subtitle: subtitle,
      trailing: [
        if (_usesSearch(_section))
          SizedBox(
            width: 240,
            child: TextField(
              decoration: const InputDecoration(
                isDense: true,
                prefixIcon: Icon(Icons.search, size: 18),
                hintText: 'Search',
              ),
              onChanged: (v) { _search = v; if (v.isEmpty) _load(); },
              onSubmitted: (value) {
                _search = value;
                _load();
              },
            ),
          ),
        if (_statusOptions(_section).isNotEmpty) _statusDropdown(),
        if (dateFilter || _usesDate(_section)) _dateButton(),
        if (_usesRange(_section)) _dateRangeButton(),
        OutlinedButton.icon(
          onPressed: () => _exportRows(_label(_section), _rows),
          icon: const Icon(Icons.download, size: 16),
          label: const Text('Export'),
        ),
        OutlinedButton.icon(
          onPressed: _load,
          icon: const Icon(Icons.refresh, size: 16),
          label: const Text('Refresh'),
        ),
        if (createLabel != null && onCreate != null)
          ElevatedButton.icon(
            onPressed: onCreate,
            icon: const Icon(Icons.add, size: 16),
            label: Text(createLabel),
          ),
      ],
      child: _dataList(_filteredRows, fields, actionsBuilder: actionsBuilder),
    );
  }

  Widget _page({
    required String title,
    required String subtitle,
    required Widget child,
    List<Widget> trailing = const [],
  }) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 12,
            runSpacing: 12,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              SizedBox(
                width: 430,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: Theme.of(context).textTheme.headlineMedium),
                    const SizedBox(height: 4),
                    Text(subtitle,
                        style:
                            const TextStyle(color: AppColors.kTextSecondary)),
                  ],
                ),
              ),
              ...trailing,
            ],
          ),
          const SizedBox(height: 18),
          child,
        ],
      ),
    );
  }

  Widget _dataList(
    List<Map<String, dynamic>> rows,
    List<String> fields, {
    List<Widget> Function(Map<String, dynamic>)? actionsBuilder,
  }) {
    if (rows.isEmpty) return const _EmptyNotice('No records found.');
    return Card(
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: rows.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, index) {
          final row = _normalizeRecord(rows[index]);
          final title = _titleFor(row);
          final subtitle = _subtitleForRow(row);
          final chips = _rowChips(row, fields).take(6).toList();
          final status = _text(row, [
            'status',
            'approval_status',
            'payment_status',
            'housekeeping_status',
            'workflow_status',
          ]);
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: _statusColor(status).withValues(alpha: 0.12),
                child: Icon(_iconFor(_section),
                    size: 19, color: _statusColor(status)),
              ),
              title: Text(title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: subtitle.isEmpty && chips.isEmpty
                  ? null
                  : Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (subtitle.isNotEmpty)
                            Text(
                              subtitle,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppColors.kTextSecondary,
                              ),
                            ),
                          if (chips.isNotEmpty) ...[
                            if (subtitle.isNotEmpty) const SizedBox(height: 6),
                            Wrap(spacing: 8, runSpacing: 6, children: chips),
                          ],
                        ],
                      ),
                    ),
              trailing: Wrap(
                spacing: 4,
                children: actionsBuilder?.call(row) ??
                    [_miniButton('View', () => _showRow(row))],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _panel(String title, Widget child) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }

  Widget _metric(String label, String value, IconData icon, Color color) {
    return SizedBox(
      width: 230,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: color.withValues(alpha: 0.12),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            color: AppColors.kTextSecondary, fontSize: 12)),
                    Text(value,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 20, fontWeight: FontWeight.w800)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _detailCard(Map<String, dynamic> detail) {
    final normalized = _normalizeRecord(detail);
    final lineItems = _lineItems(normalized);
    final record = _detailRecord(normalized);
    final title = _titleFor(record);
    final subtitle = _subtitleForRow(record);
    final chips = _rowChips(record, _fieldsFor(_section)).take(8).toList();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
                  child: Icon(_iconFor(_section), color: AppColors.kPrimary),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.w900)),
                      if (subtitle.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(subtitle,
                            style: const TextStyle(
                                color: AppColors.kTextSecondary)),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            if (chips.isNotEmpty) ...[
              const SizedBox(height: 14),
              Wrap(spacing: 8, runSpacing: 8, children: chips),
            ],
            const SizedBox(height: 16),
            const Text('Details',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            ReadableRecordDetails(record: record, limit: 36, labelWidth: 170),
            if (lineItems.isNotEmpty) ...[
              const SizedBox(height: 18),
              const Text('Items',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
              const SizedBox(height: 8),
              ...lineItems.map(_detailLineItem),
            ],
          ],
        ),
      ),
    );
  }

  Widget _detailLineItem(Map<String, dynamic> item) {
    final title = _lineItemTitle(item);
    final quantity = _text(item, [
      'quantity',
      'qty',
      'quantity_sold',
      'quantity_received',
      'quantity_requested',
    ]);
    final price = _text(item, ['total_price', 'line_total', 'total', 'price']);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.kSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.kDivider.withValues(alpha: 0.6)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
          if (quantity.isNotEmpty)
            Text('Qty $quantity',
                style: const TextStyle(color: AppColors.kTextSecondary)),
          if (price.isNotEmpty) ...[
            const SizedBox(width: 14),
            Text(_formatValue(item, 'amount', price),
                style: const TextStyle(fontWeight: FontWeight.w800)),
          ],
        ],
      ),
    );
  }

  Widget _miniButton(String label, VoidCallback onPressed) {
    return TextButton(onPressed: _busy ? null : onPressed, child: Text(label));
  }

  Widget _pill(String text, {required Color color}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(text,
          style: TextStyle(
              color: color, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }

  Widget _statusDropdown() {
    final options = _statusOptions(_section);
    return DropdownButton<String>(
      value: options.contains(_status) ? _status : 'all',
      items: options
          .map((option) => DropdownMenuItem(
                value: option,
                child: Text(_pretty(option)),
              ))
          .toList(),
      onChanged: (value) {
        if (value == null) return;
        _status = value;
        _load();
      },
    );
  }

  Widget _periodButton() {
    return DropdownButton<String>(
      value: _period,
      items: const [
        DropdownMenuItem(value: 'today', child: Text('Today')),
        DropdownMenuItem(value: 'week', child: Text('Week')),
        DropdownMenuItem(value: 'month', child: Text('Month')),
        DropdownMenuItem(value: 'quarter', child: Text('Quarter')),
        DropdownMenuItem(value: 'year', child: Text('Year')),
      ],
      onChanged: (value) {
        if (value == null) return;
        _period = value;
        _load();
      },
    );
  }

  Widget _dateButton() {
    return OutlinedButton.icon(
      onPressed: () async {
        final picked = await showDatePicker(
          context: context,
          firstDate: DateTime(2023),
          lastDate: DateTime(2028),
          initialDate: _date,
        );
        if (picked != null) {
          _date = picked;
          if (!mounted) return;
          _load();
        }
      },
      icon: const Icon(Icons.date_range, size: 16),
      label: Text(_ymd(_date)),
    );
  }

  Widget _dateRangeButton() {
    return OutlinedButton.icon(
      onPressed: () async {
        final picked = await showDateRangePicker(
          context: context,
          firstDate: DateTime(2023),
          lastDate: DateTime(2028),
          initialDateRange: DateTimeRange(start: _from, end: _to),
        );
        if (picked != null) {
          _from = picked.start;
          _to = picked.end;
          if (!mounted) return;
          _load();
        }
      },
      icon: const Icon(Icons.date_range, size: 16),
      label: Text('${_ymd(_from)} - ${_ymd(_to)}'),
    );
  }

  List<Widget> _actionsFor(Map<String, dynamic> row) {
    final id = _id(row);
    final status = _text(row, ['status']).toLowerCase();
    switch (_section) {
      case BranchManagerSection.reservations:
      case BranchManagerSection.checkin:
      case BranchManagerSection.arrivals:
      case BranchManagerSection.departures:
        return [
          _miniButton('View',
              () => _openDetail(BranchManagerSection.reservationDetail, id)),
          if (id.isNotEmpty && status == 'confirmed')
            _miniButton('Check in', () => _bookingAction(id, 'checkin')),
          if (id.isNotEmpty && status == 'checked_in')
            _miniButton('Check out', () => _bookingAction(id, 'checkout')),
          if (id.isNotEmpty && status != 'cancelled')
            _miniButton('Cancel', () => _bookingAction(id, 'cancel')),
        ];
      case BranchManagerSection.guests:
        return [
          _miniButton(
              'View', () => _openDetail(BranchManagerSection.guestDetail, id)),
          _miniButton('Edit', () => _editGeneric(row)),
          if (id.isNotEmpty) _miniButton('Delete', () => _deleteGeneric(id)),
        ];
      case BranchManagerSection.staff:
        return [
          _miniButton(
              'View', () => _openDetail(BranchManagerSection.staffDetail, id)),
          _miniButton('Clock in', () => _staffClock(id, true)),
          _miniButton('Clock out', () => _staffClock(id, false)),
          _miniButton('Edit', () => _editGeneric(row)),
          if (_text(row, ['user_id']).isEmpty)
            _miniButton('Create login', () => _showCreateUserForStaffDialog(row)),
        ];
      case BranchManagerSection.users:
        return [
          _miniButton('View', () => _showRow(row)),
          _miniButton('Reset password', () => _showResetUserPasswordDialog(row)),
        ];
      case BranchManagerSection.leave:
      case BranchManagerSection.staffLeave:
        return [
          _miniButton('View', () => _showRow(row)),
          if (id.isNotEmpty && status == 'pending')
            _miniButton('Approve', () => _leaveAction(id, 'approve')),
          if (id.isNotEmpty && status == 'pending')
            _miniButton('Reject', () => _leaveAction(id, 'reject')),
          if (id.isNotEmpty && status == 'approved')
            _miniButton('Report duty', () => _leaveAction(id, 'duty')),
        ];
      case BranchManagerSection.waiterSales:
        return [_miniButton('Detail', () => _showRow(row))];
      case BranchManagerSection.staffPerformance:
        return [_miniButton('Detail', () {
          final id = _id(row);
          if (id.isNotEmpty) {
            _openDetail(BranchManagerSection.staffDetail, id);
          } else {
            _showRow(row);
          }
        })];
      default:
        return [_miniButton('View', () => _showRow(row))];
    }
  }

  VoidCallback? _createHandler(BranchManagerSection section) {
    switch (section) {
      case BranchManagerSection.reservations:
        return () => _showFormDialog(
              title: 'New Reservation',
              fields: const [
                'guest_id',
                'room_id',
                'check_in_date',
                'check_out_date',
                'total_amount',
                'notes'
              ],
              onSubmit: (data) => _repo.createBooking(data),
            );
      case BranchManagerSection.guests:
        return () => _showFormDialog(
              title: 'Add Guest',
              fields: const [
                'first_name',
                'last_name',
                'email',
                'phone',
                'id_number'
              ],
              onSubmit: _repo.createGuest,
            );
      case BranchManagerSection.staff:
        return _showStaffRegistrationDialog;
      case BranchManagerSection.users:
        return () => _showCreateUserForStaffDialog();
      case BranchManagerSection.leave:
        return () => _showFormDialog(
              title: 'New Leave Request',
              fields: const [
                'staff_id',
                'leave_type',
                'start_date',
                'end_date',
                'reason'
              ],
              onSubmit: _repo.createLeaveRequest,
            );
      default:
        return null;
    }
  }

  Future<void> _showFormDialog({
    required String title,
    required List<String> fields,
    required Future<dynamic> Function(Map<String, dynamic>) onSubmit,
    Map<String, dynamic> initial = const {},
  }) async {
    final controllers = {
      for (final field in fields)
        if (!field.endsWith('_id'))
          field: TextEditingController(text: '${initial[field] ?? ''}'),
    };
    final idValues = <String, String>{};
    final idOptions = <String, List<_SelectOption>>{};

    for (final field in fields) {
      if (field.endsWith('_id')) {
        idValues[field] = '${initial[field] ?? ''}';
        final options = await _loadIdOptions(field);
        idOptions[field] = options;
      }
    }

    if (!mounted) return;
    Map<String, dynamic>? result;
    try {
      result = await showDialog<Map<String, dynamic>>(
        context: context,
        builder: (ctx) => StatefulBuilder(
          builder: (ctx, setDialogState) => AlertDialog(
            title: Text(title),
            content: SizedBox(
              width: 460,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (final field in fields) ...[
                      if (field.endsWith('_id'))
                        _searchableSelectField(
                          label: readableRecordLabel(field),
                          value: idValues[field] ?? '',
                          options: idOptions[field] ?? const [],
                          onChanged: (value) =>
                              setDialogState(() => idValues[field] = value),
                        )
                      else
                        TextField(
                          controller: controllers[field],
                          keyboardType: _numericField(field)
                              ? const TextInputType.numberWithOptions(
                                  decimal: true)
                              : TextInputType.text,
                          decoration: InputDecoration(
                              labelText: readableRecordLabel(field)),
                        ),
                      const SizedBox(height: 10),
                    ],
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: () {
                  final data = <String, dynamic>{};
                  for (final field in fields) {
                    if (field.endsWith('_id')) {
                      if (idValues[field]!.isNotEmpty) {
                        data[field] = idValues[field];
                      }
                    } else {
                      final value = controllers[field]?.text.trim() ?? '';
                      if (value.isEmpty) continue;
                      data[field] = _numericField(field)
                          ? (num.tryParse(value) ?? value)
                          : value;
                    }
                  }
                  Navigator.pop(ctx, data);
                },
                child: const Text('Save'),
              ),
            ],
          ),
        ),
      );
    } finally {
      for (final controller in controllers.values) {
        controller.dispose();
      }
    }
    if (result == null) return;
    await _run(() async {
      await onSubmit(result!);
      await _load();
    }, success: '$title saved');
  }

  Widget _dialogField(TextEditingController controller, String label,
      {bool number = false}) {
    return SizedBox(
      width: 290,
      child: TextField(
        controller: controller,
        keyboardType: number
            ? const TextInputType.numberWithOptions(decimal: true)
            : TextInputType.text,
        decoration: InputDecoration(labelText: label),
      ),
    );
  }

  Future<void> _showStaffRegistrationDialog() async {
    final fnCtrl = TextEditingController();
    final lnCtrl = TextEditingController();
    final idCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final salaryCtrl = TextEditingController();
    final passwordCtrl = TextEditingController();
    final pinCtrl = TextEditingController();

    String dept = 'restaurant';
    String position = 'waiter';
    String shift = 'morning';
    String empType = 'permanent';
    String userRole = 'waiter';
    bool createAccount = true;

    const depts = [
      'restaurant', 'bar_lounge', 'kitchen', 'housekeeping', 'reception',
      'front_office', 'maintenance', 'finance', 'accounts', 'management',
      'hr', 'security', 'store', 'procurement', 'logistics', 'administration',
      'food_beverage', 'it', 'general', 'operations',
    ];
    const positions = [
      'waiter', 'bartender', 'chef', 'receptionist', 'housekeeper',
      'supervisor', 'manager', 'cashier', 'security_guard', 'driver',
      'accountant', 'storekeeper', 'maintenance_technician', 'kitchen_staff',
      'barista', 'porter', 'cleaner', 'laundry_attendant', 'employee',
    ];
    const shifts = ['morning', 'afternoon', 'night', 'full_day', 'split'];
    const empTypes = ['permanent', 'contract', 'casual', 'intern', 'part_time'];
    const loginRoles = [
      'waiter', 'bartender', 'cashier', 'receptionist', 'housekeeper',
      'chef', 'storekeeper', 'kitchen_operations', 'choma_zone_kds', 'branch_manager',
      'hr_manager', 'auditor', 'employee',
    ];

    Widget dropRow(String label, String value, List<String> options,
        void Function(String) onChanged) {
      return StatefulBuilder(builder: (ctx2, setSt) {
        return DropdownButtonFormField<String>(
          initialValue: options.contains(value) ? value : options.first,
          decoration: InputDecoration(labelText: label),
          items: options
              .map((o) => DropdownMenuItem(value: o, child: Text(o.replaceAll('_', ' '))))
              .toList(),
          onChanged: (v) {
            if (v != null) {
              onChanged(v);
              setSt(() {});
            }
          },
        );
      });
    }

    if (!mounted) return;
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDs) => AlertDialog(
          title: const Text('Add Staff Member'),
          content: SizedBox(
            width: 640,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Personal Details',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  Wrap(spacing: 10, runSpacing: 10, children: [
                    _dialogField(fnCtrl, 'First Name *'),
                    _dialogField(lnCtrl, 'Last Name *'),
                    _dialogField(idCtrl, 'National ID *'),
                    _dialogField(emailCtrl, 'Email'),
                    _dialogField(phoneCtrl, 'Phone'),
                  ]),
                  const SizedBox(height: 14),
                  const Text('Employment Details',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  Wrap(spacing: 10, runSpacing: 10, children: [
                    SizedBox(
                      width: 290,
                      child: dropRow('Department *', dept, depts,
                          (v) => setDs(() => dept = v)),
                    ),
                    SizedBox(
                      width: 290,
                      child: dropRow('Position / Role *', position, positions,
                          (v) => setDs(() => position = v)),
                    ),
                    SizedBox(
                      width: 290,
                      child: dropRow('Shift', shift, shifts,
                          (v) => setDs(() => shift = v)),
                    ),
                    SizedBox(
                      width: 290,
                      child: dropRow('Employment Type', empType, empTypes,
                          (v) => setDs(() => empType = v)),
                    ),
                    _dialogField(salaryCtrl, 'Basic Salary (KES)', number: true),
                  ]),
                  const SizedBox(height: 14),
                  SwitchListTile(
                    value: createAccount,
                    onChanged: (v) => setDs(() => createAccount = v),
                    title: const Text('Create login account'),
                    subtitle: const Text(
                        'Creates a Supabase Auth + app user account linked to this staff profile.'),
                    contentPadding: EdgeInsets.zero,
                  ),
                  if (createAccount) ...[
                    const SizedBox(height: 8),
                    Wrap(spacing: 10, runSpacing: 10, children: [
                      SizedBox(
                        width: 290,
                        child: dropRow('Login Role', userRole, loginRoles,
                            (v) => setDs(() => userRole = v)),
                      ),
                      _dialogField(
                          passwordCtrl, 'Password (blank = auto-generate)'),
                      _dialogField(pinCtrl, 'POS PIN (4 digits)'),
                    ]),
                  ],
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () {
                if (fnCtrl.text.trim().isEmpty ||
                    lnCtrl.text.trim().isEmpty ||
                    idCtrl.text.trim().isEmpty) {
                  ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(
                      content:
                          Text('First name, last name and national ID are required')));
                  return;
                }
                if (createAccount) {
                  final p = pinCtrl.text.trim().toUpperCase();
                  final posPinRequired = requiresPosPinForRole(userRole);
                  if (posPinRequired && p.isEmpty) {
                    ScaffoldMessenger.of(ctx).showSnackBar(
                      SnackBar(
                        content: Text(
                          'POS PIN is required for ${userRole.replaceAll('_', ' ')} logins',
                        ),
                      ),
                    );
                    return;
                  }
                  if (p.isNotEmpty && !RegExp(r'^[RMNCE]\d{4}$').hasMatch(p)) {
                    ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(content: Text('POS PIN must be exactly 5 characters: R, M, N, C, or E followed by 4 digits')));
                    return;
                  }
                }
                final data = <String, dynamic>{
                  'first_name': fnCtrl.text.trim(),
                  'last_name': lnCtrl.text.trim(),
                  'national_id': idCtrl.text.trim(),
                  if (emailCtrl.text.trim().isNotEmpty)
                    'email': emailCtrl.text.trim(),
                  if (phoneCtrl.text.trim().isNotEmpty)
                    'phone': phoneCtrl.text.trim(),
                  'department': dept,
                  'position': position,
                  'shift': shift,
                  'employment_type': empType,
                  if (salaryCtrl.text.trim().isNotEmpty)
                    'basic_salary':
                        num.tryParse(salaryCtrl.text.trim()) ??
                            salaryCtrl.text.trim(),
                  'create_user_account': createAccount,
                  if (createAccount) 'user_role': userRole,
                  if (createAccount &&
                      passwordCtrl.text.trim().isNotEmpty)
                    'password': passwordCtrl.text.trim(),
                  if (createAccount &&
                      pinCtrl.text.trim().isNotEmpty)
                    'pos_pin': pinCtrl.text.trim(),
                };
                Navigator.pop(ctx, data);
              },
              child: const Text('Register Staff'),
            ),
          ],
        ),
      ),
    );

    for (final c in [
      fnCtrl, lnCtrl, idCtrl, emailCtrl, phoneCtrl,
      salaryCtrl, passwordCtrl, pinCtrl
    ]) {
      c.dispose();
    }
    if (result == null) return;
    if (!mounted) return;

    await _run(() async {
      final created = await _repo.createStaff(result);
      await _load();
      final tempPassword = '${created['temp_password'] ?? ''}'.trim();
      if (tempPassword.isNotEmpty) {
        await _showGeneratedPasswordDialog(tempPassword);
      }
    }, success: 'Staff registered');
  }

  Future<void> _showCreateUserForStaffDialog([Map<String, dynamic>? staff]) async {
    final staffOptions = staff == null
        ? await _loadIdOptions('staff_profile_id')
        : <_SelectOption>[];
    if (!mounted) return;
    String staffProfileId = staff == null ? '' : _id(staff);
    String selectedRole = staff == null
        ? 'employee'
        : _text(staff, ['role', 'position']).ifEmpty('employee');
    const loginRoleOptions = [
      'waiter', 'bartender', 'cashier', 'receptionist', 'housekeeper',
      'chef', 'storekeeper', 'kitchen_operations', 'choma_zone_kds', 'branch_manager',
      'hr_manager', 'auditor', 'employee',
    ];
    final passwordController = TextEditingController();
    final pinController = TextEditingController();

    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Create User Account'),
          content: SizedBox(
            width: 520,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (staff == null) ...[
                  _searchableSelectField(
                    label: 'Staff Profile',
                    value: staffProfileId,
                    options: staffOptions,
                    onChanged: (value) =>
                        setDialogState(() => staffProfileId = value),
                  ),
                  const SizedBox(height: 10),
                ] else
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(_titleFor(_normalizeRecord(staff))),
                    subtitle: Text(_text(staff, ['email', 'department'])),
                  ),
                StatefulBuilder(builder: (ctx2, setSt2) {
                  return DropdownButtonFormField<String>(
                    initialValue: loginRoleOptions.contains(selectedRole)
                        ? selectedRole
                        : 'employee',
                    decoration: const InputDecoration(labelText: 'Login Role'),
                    items: loginRoleOptions
                        .map((r) => DropdownMenuItem(
                              value: r,
                              child: Text(r.replaceAll('_', ' ')),
                            ))
                        .toList(),
                    onChanged: (v) {
                      if (v != null) {
                        selectedRole = v;
                        setSt2(() {});
                      }
                    },
                  );
                }),
                const SizedBox(height: 10),
                TextField(
                  controller: passwordController,
                  decoration: const InputDecoration(
                      labelText: 'Password (blank = auto-generate)'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: pinController,
                  decoration: const InputDecoration(labelText: 'POS PIN'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: staffProfileId.isEmpty
                  ? null
                  : () => Navigator.pop(ctx, {
                        'staffProfileId': staffProfileId,
                        'role': selectedRole,
                        if (passwordController.text.trim().isNotEmpty)
                          'password': passwordController.text.trim(),
                        if (pinController.text.trim().isNotEmpty)
                          'pos_pin': pinController.text.trim(),
                      }),
              child: const Text('Create Account'),
            ),
          ],
        ),
      ),
    );


    passwordController.dispose();
    pinController.dispose();
    if (result == null) return;

    await _run(() async {
      final created = await _repo.createUser(result);
      await _load();
      final tempPassword = '${created['temp_password'] ?? ''}'.trim();
      if (tempPassword.isNotEmpty) {
        await _showGeneratedPasswordDialog(tempPassword);
      }
    }, success: 'User account created');
  }

  Future<void> _showResetUserPasswordDialog(Map<String, dynamic> row) async {
    final id = _id(row);
    if (id.isEmpty) return;
    final controller = TextEditingController();
    final password = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reset Password'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(labelText: 'New Password'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Reset'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (password == null || password.isEmpty) return;
    if (!mounted) return;
    await _run(() async {
      await _repo.updateUser(id, {'password': password});
    }, success: 'Password reset');
  }

  Future<void> _showGeneratedPasswordDialog(String password) async {
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Temporary Password'),
        content: SelectableText(password),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  Widget _searchableSelectField({
    required String label,
    required String value,
    required List<_SelectOption> options,
    required ValueChanged<String> onChanged,
  }) {
    _SelectOption? selected;
    for (final option in options) {
      if (option.value == value) {
        selected = option;
        break;
      }
    }
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: options.isEmpty
          ? null
          : () async {
              final picked = await _pickOption(label, options);
              if (picked != null) onChanged(picked.value);
            },
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          suffixIcon: const Icon(Icons.search, size: 18),
        ),
        child: Text(
          selected?.label ?? 'Search and select $label',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: selected == null
                ? AppColors.kTextSecondary
                : AppColors.kTextPrimary,
            fontWeight: selected == null ? FontWeight.w400 : FontWeight.w700,
          ),
        ),
      ),
    );
  }

  Future<_SelectOption?> _pickOption(
      String title, List<_SelectOption> options) {
    var query = '';
    return showDialog<_SelectOption>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          final filtered = options.where((option) {
            final haystack =
                '${option.label} ${option.subtitle} ${option.value}'
                    .toLowerCase();
            return haystack.contains(query.toLowerCase());
          }).toList();
          return AlertDialog(
            title: Text('Select $title'),
            content: SizedBox(
              width: 520,
              height: 460,
              child: Column(
                children: [
                  TextField(
                    autofocus: true,
                    decoration: InputDecoration(
                      isDense: true,
                      prefixIcon: const Icon(Icons.search, size: 18),
                      hintText: 'Search $title',
                    ),
                    onChanged: (value) =>
                        setDialogState(() => query = value.trim()),
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: filtered.isEmpty
                        ? const Center(
                            child: Text('No matches found',
                                style:
                                    TextStyle(color: AppColors.kTextSecondary)),
                          )
                        : ListView.separated(
                            itemCount: filtered.length,
                            separatorBuilder: (_, __) =>
                                const Divider(height: 1),
                            itemBuilder: (context, index) {
                              final option = filtered[index];
                              return ListTile(
                                title: Text(option.label,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w800)),
                                subtitle: option.subtitle.isEmpty
                                    ? null
                                    : Text(option.subtitle,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis),
                                onTap: () => Navigator.pop(ctx, option),
                              );
                            },
                          ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<List<_SelectOption>> _loadIdOptions(String field) async {
    try {
      switch (field) {
        case 'guest_id':
          final guests = await _repo.guests();
          return guests.map((g) {
            final row = _normalizeRecord(g);
            final name = _titleFor(row);
            return _SelectOption(
              value: '${g['id']}',
              label: name,
              subtitle: _text(row, ['phone', 'email', 'id_number']),
            );
          }).toList();
        case 'room_id':
          final rooms = await _repo.rooms();
          return rooms.map((r) {
            final row = _normalizeRecord(r);
            return _SelectOption(
              value: '${r['id']}',
              label: _text(row, ['room_number']).ifEmpty(_titleFor(row)),
              subtitle:
                  '${_text(row, ['room_type'])} • ${_text(row, ['status'])}',
            );
          }).toList();
        case 'staff_id':
        case 'staff_profile_id':
          final staff = await _repo.staff();
          return staff.where((s) => _text(s, ['user_id']).isEmpty).map((s) {
            final row = _normalizeRecord(s);
            return _SelectOption(
              value: '${s['id']}',
              label: _titleFor(row),
              subtitle: [
                _text(row, ['employee_number', 'staff_number', 'id_number']),
                _text(row, ['department']),
                _text(row, ['role']),
              ].where((part) => part.trim().isNotEmpty).join(' • '),
            );
          }).toList();
        case 'item_id':
          final items = await _repo.branchStock();
          return items
              .map((i) {
                final row = _normalizeRecord(i);
                return _SelectOption(
                  value: _text(row, ['item_id', 'id', 'sku', 'item_sku']),
                  label: _text(row, ['item_name', 'name'])
                      .ifEmpty(_text(row, ['item_sku', 'sku'])),
                  subtitle: [
                    _text(row, ['item_sku', 'sku']),
                    'Stock ${_text(row, [
                          'current_stock',
                          'quantity'
                        ]).ifEmpty('0')}',
                    _text(row, ['unit']),
                  ].where((part) => part.trim().isNotEmpty).join(' • '),
                );
              })
              .where((option) => option.value.isNotEmpty)
              .toList();
        default:
          return [];
      }
    } catch (_) {
      return [];
    }
  }

  void _showRow(Map<String, dynamic> row) {
    final record = _detailRecord(_normalizeRecord(row));
    openRecordDetailScreen(
      context,
      title: _titleFor(record),
      subtitle: _subtitleForRow(record).ifEmpty(_label(_section)),
      record: record,
    );
  }

  Future<void> _showWalkInDialog() {
    return _showFormDialog(
      title: 'Walk-in Check-in',
      fields: const [
        'first_name',
        'last_name',
        'phone',
        'email',
        'room_id',
        'check_out_date',
        'total_amount'
      ],
      onSubmit: (data) async {
        final guest = await _repo.createGuest({
          'first_name': data['first_name'],
          'last_name': data['last_name'],
          'phone': data['phone'],
          'email': data['email'],
        });
        final booking = await _repo.createBooking({
          'guest_id': guest['id'] ?? guest['guest_id'] ?? data['guest_id'],
          'room_id': data['room_id'],
          'check_in_date': _ymd(DateTime.now()),
          'check_out_date': data['check_out_date'],
          'total_amount': data['total_amount'],
          'status': 'confirmed',
        });
        final id = '${booking['id'] ?? booking['booking_id'] ?? ''}';
        if (id.isNotEmpty) await _repo.checkIn(id);
      },
    );
  }

  Future<void> _editGeneric(Map<String, dynamic> row) async {
    final id = _id(row);
    if (id.isEmpty) return _snack('Missing record id');
    await _showFormDialog(
      title: 'Edit ${_label(_section)}',
      fields: _editFields(_section),
      initial: row,
      onSubmit: (data) async {
        switch (_section) {
          case BranchManagerSection.guests:
            await _repo.updateGuest(id, data);
            break;
          case BranchManagerSection.staff:
            await _repo.updateStaff(id, data);
            break;
          default:
            throw UnimplementedError('Edit not supported for this section');
        }
      },
    );
  }

  Future<void> _deleteGeneric(String id) async {
    final confirmed = await _confirm('Delete this record?');
    if (!confirmed) return;
    await _run(() async {
      switch (_section) {
        case BranchManagerSection.guests:
          await _repo.deleteGuest(id);
          break;
        case BranchManagerSection.staff:
          await _repo.deleteStaff(id);
          break;
        default:
          throw UnimplementedError('Delete not supported for this section');
      }
      await _load();
    }, success: 'Record deleted');
  }

  Future<void> _bookingAction(String id, String action) async {
    if (action == 'cancel') {
      final confirmed = await _confirm('Cancel this booking?');
      if (!confirmed) return;
    }
    await _run(() async {
      if (action == 'checkin') await _repo.checkIn(id);
      if (action == 'checkout') await _repo.checkOut(id);
      if (action == 'cancel') await _repo.cancelBooking(id);
      await _load();
    }, success: 'Booking updated');
  }

  Future<void> _staffClock(String id, bool clockIn) async {
    if (id.isEmpty) return _snack('Missing staff id');
    await _run(() async {
      if (clockIn) {
        await _repo.clockIn(id);
      } else {
        await _repo.clockOut(id);
      }
      await _load();
    }, success: clockIn ? 'Clocked in' : 'Clocked out');
  }

  Future<void> _leaveAction(String id, String action) async {
    await _run(() async {
      if (action == 'approve') await _repo.approveLeave(id);
      if (action == 'reject') await _repo.rejectLeave(id);
      if (action == 'duty') await _repo.reportToDuty(id);
      await _load();
    }, success: 'Leave updated');
  }

  Future<void> _exportRows(String name, List<Map<String, dynamic>> rows) async {
    if (rows.isEmpty) return _snack('No rows to export');
    await _run(() async {
      final exportRows = rows
          .map((row) => _detailRecord(_normalizeRecord(row)))
          .where((row) => row.isNotEmpty)
          .toList();
      if (exportRows.isEmpty) {
        _snack('No readable rows to export');
        return;
      }
      final file = await _repo.exportCurrentRows(
        name: name.toLowerCase().replaceAll(' ', '_'),
        rows: exportRows,
      );
      _snack('CSV saved to ${file.path}');
    });
  }

  Future<void> _run(Future<void> Function() action, {String? success}) async {
    if (!mounted) return;
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
      if (success != null) _snack(success);
    } catch (error) {
      _snack('$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool> _confirm(String message) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm'),
        content: Text(message),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Confirm')),
        ],
      ),
    );
    return result ?? false;
  }

  void _openDetail(BranchManagerSection section, String id) {
    if (id.isEmpty) { _snack('No record ID available'); return; }
    setState(() {
      _section = section;
      _recordId = id;
    });
    _load();
  }

  void _resetFilters() {
    _search = '';
    _status = 'all';
    _period = 'today';
    _staffPerformancePeriod = 30;
    _leaveTab = 'active';
    _leaveDateFilter = false;
    _date = DateTime.now();
    _from = DateTime.now().subtract(const Duration(days: 6));
    _to = DateTime.now();
  }

  List<Map<String, dynamic>> get _filteredRows {
    if (_search.trim().isEmpty) return _rows;
    final needle = _search.toLowerCase();
    return _rows
        .where((row) =>
            row.values.any((value) => '$value'.toLowerCase().contains(needle)))
        .toList();
  }

  List<Map<String, dynamic>> _listFrom(dynamic data) {
    if (data is List) {
      return data
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
    if (data is Map) return [Map<String, dynamic>.from(data)];
    return <Map<String, dynamic>>[];
  }

  String _id(Map<String, dynamic> row) =>
      _text(row, ['id', 'booking_id', 'guest_id', 'staff_id', 'item_id']);

  String _titleFor(Map<String, dynamic> row) {
    final record = _normalizeRecord(row);
    final keys = <String>[
      ..._primaryTitleKeys(_section),
      'display_name',
      'guest_name',
      'full_name',
      'staff_name',
      'waiter_name',
      'cashier_name',
      'item_name',
      'menu_item_name',
      'room_number',
      'order_number',
      'booking_reference',
      'confirmation_number',
      'request_number',
      'invoice_number',
      'name',
      'title',
      'description',
      'item_sku',
      'sku',
      'type',
    ];
    for (final key in keys) {
      final value = _displayText(record[key]);
      if (_isUsefulDisplay(value)) return value;
    }
    final readable = readableMapName(record);
    if (_isUsefulDisplay(readable)) return readable!;
    return _label(_section);
  }

  List<String> _primaryTitleKeys(BranchManagerSection section) {
    switch (section) {
      case BranchManagerSection.reservations:
      case BranchManagerSection.reservationDetail:
      case BranchManagerSection.checkin:
      case BranchManagerSection.arrivals:
      case BranchManagerSection.departures:
        return const ['guest_name', 'room_number', 'booking_reference'];
      case BranchManagerSection.guests:
      case BranchManagerSection.guestDetail:
        return const ['full_name', 'guest_name', 'phone'];
      case BranchManagerSection.staff:
      case BranchManagerSection.users:
      case BranchManagerSection.staffDetail:
      case BranchManagerSection.staffPerformance:
      case BranchManagerSection.staffKpis:
      case BranchManagerSection.staffAttendance:
      case BranchManagerSection.attendance:
      case BranchManagerSection.leave:
      case BranchManagerSection.staffLeave:
        return const ['staff_name', 'full_name', 'employee_number'];
      case BranchManagerSection.waiterSales:
        return const ['waiter_name', 'staff_name', 'full_name'];
      default:
        return const ['description', 'user_name', 'name', 'title'];
    }
  }

  String _text(Map<String, dynamic> row, List<String> keys) {
    for (final key in keys) {
      final value = row[key];
      if (value != null && '$value'.trim().isNotEmpty) return '$value';
    }
    return '';
  }

  String _displayValue(Map<String, dynamic> row, String field) {
    return _formatValue(row, field, row[field] ?? row['${field}_name'] ?? '');
  }

  String _formatValue(Map<String, dynamic> row, String field, dynamic value) {
    final formatted = readableRecordValue(row, field, value);
    if (formatted == 'Linked record') return '—';
    if (_moneyField(field)) {
      final n = value is num ? value : num.tryParse('$value');
      if (n != null) return _money(n);
    }
    return formatted;
  }

  Map<String, dynamic> _normalizeRecord(Map<String, dynamic> raw) {
    final row = Map<String, dynamic>.from(raw);

    void alias(String from, String to) {
      if (_isUsefulDisplay(_displayText(row[from])) &&
          !_isUsefulDisplay(_displayText(row[to]))) {
        row[to] = row[from];
      }
    }

    void flatten(String sourceKey, Map<String, List<String>> targets) {
      final source = row[sourceKey];
      if (source is! Map) return;
      final map = Map<String, dynamic>.from(source);
      for (final entry in targets.entries) {
        final value = _firstNestedText(map, entry.value);
        if (_isUsefulDisplay(value) &&
            !_isUsefulDisplay(_displayText(row[entry.key]))) {
          row[entry.key] = value;
        }
      }
    }

    alias('checkInDate', 'check_in_date');
    alias('checkOutDate', 'check_out_date');
    alias('roomNumber', 'room_number');
    alias('roomType', 'room_type');
    alias('confirmationNumber', 'confirmation_number');
    alias('totalAmount', 'total_amount');
    alias('grandTotal', 'grand_total');
    alias('amountPaid', 'amount_paid');
    alias('balanceAmount', 'balance_amount');
    alias('expected_closing_float', 'expected_cash');
    alias('closing_float', 'actual_cash');
    alias('expected_cash', 'expected_amount');
    alias('actual_cash', 'actual_amount');
    alias('transaction_date', 'date');
    alias('createdAt', 'created_at');
    alias('updatedAt', 'updated_at');
    alias('hk_status', 'housekeeping_status');
    alias('current_quantity', 'current_stock');
    alias('stock_quantity', 'current_stock');
    alias('reorder_level', 'minimum_stock');
    alias('min_stock', 'minimum_stock');

    final first = _displayText(row['first_name']);
    final last = _displayText(row['last_name']);
    final joined = '$first $last'.trim();
    if (_isUsefulDisplay(joined) &&
        !_isUsefulDisplay(_displayText(row['full_name']))) {
      row['full_name'] = joined;
    }

    flatten('guest', {
      'guest_name': const ['full_name', 'name', 'guest_name'],
      'guest_phone': const ['phone', 'mobile', 'phone_number'],
      'guest_email': const ['email'],
      'id_number': const ['id_number', 'national_id', 'document_number'],
    });
    flatten('room', {
      'room_number': const ['room_number', 'number', 'name'],
      'room_type': const ['room_type', 'type', 'name'],
      'floor': const ['floor'],
    });
    flatten('room_type', {
      'room_type': const ['name', 'type', 'code'],
      'rate': const ['rate', 'base_rate', 'price'],
    });
    flatten('branch', {
      'branch_name': const ['name', 'branch_name', 'code', 'branch_code'],
    });
    flatten('cashier', {
      'cashier_name': const ['full_name', 'name', 'first_name'],
      'cashier_email': const ['email'],
    });
    flatten('waiter', {
      'waiter_name': const ['full_name', 'name', 'first_name'],
      'waiter_email': const ['email'],
    });
    flatten('staff', {
      'staff_name': const ['full_name', 'name', 'first_name'],
      'department': const ['department'],
      'role': const ['role'],
      'email': const ['email'],
    });
    flatten('employee', {
      'staff_name': const ['full_name', 'name', 'first_name'],
      'department': const ['department'],
      'role': const ['role'],
    });
    flatten('assigned_to_user', {
      'assigned_to_name': const ['full_name', 'name', 'first_name'],
    });
    flatten('assigned_to', {
      'assigned_to_name': const ['full_name', 'name', 'first_name'],
    });
    flatten('reported_by_user', {
      'reported_by_name': const ['full_name', 'name', 'first_name'],
    });
    flatten('reported_by', {
      'reported_by_name': const ['full_name', 'name', 'first_name'],
    });
    flatten('created_by_user', {
      'created_by_name': const ['full_name', 'name', 'first_name'],
    });
    flatten('created_by', {
      'created_by_name': const ['full_name', 'name', 'first_name'],
    });
    flatten('item', {
      'item_name': const ['item_name', 'name', 'description'],
      'item_sku': const ['sku', 'item_sku', 'code'],
      'unit': const ['unit', 'unit_of_measure'],
      'category_name': const ['category_name', 'category'],
    });
    flatten('inventory_item', {
      'item_name': const ['item_name', 'name', 'description'],
      'item_sku': const ['sku', 'item_sku', 'code'],
      'unit': const ['unit', 'unit_of_measure'],
    });
    flatten('stock_item', {
      'item_name': const ['item_name', 'name', 'description'],
      'item_sku': const ['sku', 'item_sku', 'code'],
      'unit': const ['unit', 'unit_of_measure'],
    });
    flatten('menu_item', {
      'menu_item_name': const ['name', 'item_name', 'description'],
      'item_name': const ['name', 'item_name', 'description'],
      'category_name': const ['category_name', 'category'],
      'price': const ['price', 'unit_price'],
    });
    flatten('category', {
      'category_name': const ['name', 'category_name', 'title'],
    });

    if (row['item'] is String && _isUsefulDisplay('${row['item']}')) {
      row['item_name'] ??= row['item'];
    }
    if (row['branch'] is String && _isUsefulDisplay('${row['branch']}')) {
      row['branch_name'] ??= row['branch'];
    }
    if (row['items'] is List) {
      row['items_summary'] = readableListValue(row['items'] as List);
      row['items_count'] ??= (row['items'] as List).length;
    }
    if (row['waiter_sales'] is List) {
      row['waiter_sales_summary'] =
          readableListValue(row['waiter_sales'] as List);
    }
    row['display_name'] ??= readableMapName(row);
    return row;
  }

  Map<String, dynamic> _detailRecord(Map<String, dynamic> raw) {
    final row = _normalizeRecord(raw);
    final cleaned = <String, dynamic>{};
    for (final entry in row.entries) {
      final key = entry.key;
      final value = entry.value;
      if (_hideDetailKey(row, key, value)) continue;
      if (value is Map || value is List) continue;
      cleaned[key] = value;
    }
    return cleaned;
  }

  bool _hideDetailKey(Map<String, dynamic> row, String key, dynamic value) {
    final lower = key.toLowerCase();
    if (lower.startsWith('_')) return true;
    if (lower == 'id' || lower == 'uuid') return true;
    if (lower.contains('password') || lower.contains('token')) return true;
    final text = _displayText(value);
    if (!_isUsefulDisplay(text)) return true;
    if (key.endsWith('_id') && readableRelatedValue(row, key) != null) {
      return true;
    }
    if (_isUuid(text) && readableRelatedValue(row, key) == null) return true;
    return false;
  }

  List<Widget> _rowChips(Map<String, dynamic> row, List<String> fields) {
    final seen = <String>{};
    final widgets = <Widget>[];
    for (final field in [
      ...fields,
      'branch_name',
      'guest_phone',
      'items_count',
    ]) {
      if (!seen.add(field)) continue;
      if (_isTitleField(field)) continue;
      final value = _displayValue(row, field);
      if (!_isUsefulDisplay(value)) continue;
      if (value == '—') continue;
      final label = readableRecordLabel(field);
      final color = field.contains('status')
          ? _statusColor(value)
          : AppColors.kTextSecondary;
      widgets.add(_pill('$label: $value', color: color));
    }
    return widgets;
  }

  bool _isTitleField(String field) {
    const fields = {
      'display_name',
      'guest_name',
      'full_name',
      'first_name',
      'last_name',
      'staff_name',
      'waiter_name',
      'cashier_name',
      'item_name',
      'menu_item_name',
      'name',
      'title',
      'description',
      'room_number',
    };
    return fields.contains(field);
  }

  String _subtitleForRow(Map<String, dynamic> raw) {
    final row = _normalizeRecord(raw);
    final parts = <String>[];
    void addField(String key) {
      final value = _displayValue(row, key);
      if (_isUsefulDisplay(value) && value != '—' && !parts.contains(value)) {
        parts.add(value);
      }
    }

    switch (_section) {
      case BranchManagerSection.reservations:
      case BranchManagerSection.reservationDetail:
      case BranchManagerSection.checkin:
      case BranchManagerSection.arrivals:
      case BranchManagerSection.departures:
        addField('room_number');
        addField('check_in_date');
        addField('check_out_date');
        addField('total_amount');
        addField('status');
        break;
      case BranchManagerSection.guests:
      case BranchManagerSection.guestDetail:
        addField('phone');
        addField('email');
        addField('id_number');
        break;
      case BranchManagerSection.staff:
      case BranchManagerSection.users:
      case BranchManagerSection.staffDetail:
      case BranchManagerSection.staffPerformance:
      case BranchManagerSection.staffKpis:
      case BranchManagerSection.staffAttendance:
      case BranchManagerSection.attendance:
      case BranchManagerSection.leave:
      case BranchManagerSection.staffLeave:
        addField('role');
        addField('department');
        addField('email');
        addField('status');
        break;
      case BranchManagerSection.waiterSales:
        addField('orders_count');
        addField('total_sales');
        addField('average_order_value');
        break;
      default:
        addField('category_name');
        addField('created_at');
        addField('status');
    }
    return parts.take(5).join(' • ');
  }

  List<Map<String, dynamic>> _lineItems(Map<String, dynamic> row) {
    final values = row['items'] ?? row['order_items'] ?? row['line_items'];
    if (values is! List) return const [];
    return values
        .whereType<Map>()
        .map((item) => _normalizeRecord(Map<String, dynamic>.from(item)))
        .toList();
  }

  String _lineItemTitle(Map<String, dynamic> item) {
    return _text(item, [
      'item_name',
      'menu_item_name',
      'name',
      'description',
      'item_sku',
      'sku',
    ]).ifEmpty('Item');
  }

  String _firstNestedText(Map<String, dynamic> row, List<String> keys) {
    for (final key in keys) {
      final value = row[key];
      if (value is Map) {
        final name = readableMapName(value);
        if (_isUsefulDisplay(name)) return name!;
      }
      final text = _displayText(value);
      if (_isUsefulDisplay(text)) return text;
    }
    final name = readableMapName(row);
    return _isUsefulDisplay(name) ? name! : '';
  }

  String _displayText(dynamic value) {
    if (value == null) return '';
    if (value is Map) return readableMapName(value) ?? '';
    if (value is List) return value.isEmpty ? '' : readableListValue(value);
    final text = '$value'.trim();
    return text == 'null' ? '' : text;
  }

  bool _isUsefulDisplay(String? value) {
    final text = (value ?? '').trim();
    if (text.isEmpty || text == 'null' || text == '[]') return false;
    if (_isUuid(text)) return false;
    return true;
  }

  bool _isUuid(String value) => readableUuidPattern.hasMatch(value.trim());

  bool _moneyField(String field) {
    final lower = field.toLowerCase();
    return lower.contains('amount') ||
        lower.contains('price') ||
        lower.contains('cost') ||
        lower.contains('cash') ||
        lower.contains('revenue') ||
        lower.contains('sales') ||
        lower.contains('variance') ||
        lower.contains('balance') ||
        lower.contains('rate') ||
        lower.contains('profit');
  }

  num _num(Map<String, dynamic> row, List<String> keys) {
    final raw = _text(row, keys);
    return num.tryParse(raw) ?? 0;
  }

  String _money(num value) => 'KES ${value.toStringAsFixed(0)}';

  String _ymd(DateTime date) =>
      '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

  String _pretty(String value) => value
      .replaceAll('_', ' ')
      .replaceAll('-', ' ')
      .split(' ')
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1))
      .join(' ');

  void _snack(String message) {
    if (!mounted) return;
    AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'available':
      case 'completed':
      case 'checked_in':
      case 'paid':
      case 'active':
        return AppColors.kSuccess;
      case 'pending':
      case 'confirmed':
      case 'in_progress':
      case 'low':
        return AppColors.kWarning;
      case 'cancelled':
      case 'rejected':
      case 'flagged':
      case 'out':
      case 'inactive':
        return AppColors.kError;
      default:
        return AppColors.kPrimary;
    }
  }

  IconData _iconFor(BranchManagerSection section) {
    switch (section) {
      case BranchManagerSection.reservations:
      case BranchManagerSection.reservationDetail:
      case BranchManagerSection.newReservation:
      case BranchManagerSection.checkin:
      case BranchManagerSection.arrivals:
      case BranchManagerSection.departures:
        return PhosphorIcons.calendarCheck();
      case BranchManagerSection.guests:
      case BranchManagerSection.guestDetail:
        return PhosphorIcons.identificationCard();
      case BranchManagerSection.staff:
      case BranchManagerSection.users:
      case BranchManagerSection.staffPerformance:
      case BranchManagerSection.staffDetail:
        return PhosphorIcons.users();
      case BranchManagerSection.waiterSales:
        return PhosphorIcons.forkKnife();
      default:
        return PhosphorIcons.list();
    }
  }
}

class _EmptyNotice extends StatelessWidget {
  const _EmptyNotice(this.message);
  final String message;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Center(
          child: Text(message,
              style: const TextStyle(color: AppColors.kTextSecondary)),
        ),
      ),
    );
  }
}

/// Discounts & Offers management. Branch managers create discounts against POS
/// menu items (restaurant/bar) or room rates. Active offers are surfaced at the
/// POS as an OFFER tag (via GET /offers/active) and flow into customer bills.
class _OffersSection extends ConsumerStatefulWidget {
  const _OffersSection();

  @override
  ConsumerState<_OffersSection> createState() => _OffersSectionState();
}

class _OffersSectionState extends ConsumerState<_OffersSection> {
  bool _loading = true;
  bool _busy = false;
  String _targetFilter = 'all';
  String _activeFilter = 'all';
  List<Map<String, dynamic>> _offers = [];

  BranchManagerRepository get _repo =>
      ref.read(branchManagerRepositoryProvider);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final rows =
          await _repo.offers(targetType: _targetFilter, active: _activeFilter);
      if (!mounted) return;
      setState(() {
        _offers = rows;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _offers = [];
        _loading = false;
      });
      _snack('Failed to load offers: $error');
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
  }

  Future<void> _run(Future<void> Function() action, {String? success}) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
      if (success != null) _snack(success);
    } catch (error) {
      _snack('$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _create() async {
    final result = await showDialog<dynamic>(
      context: context,
      builder: (_) => const _OfferFormDialog(),
    );
    if (result == null) return;
    await _run(() async {
      if (result is List) {
        final list = result.cast<Map<String, dynamic>>();
        for (final item in list) {
          await _repo.createOffer(item);
        }
        await _load();
      } else if (result is Map<String, dynamic>) {
        await _repo.createOffer(result);
        await _load();
      }
    },
        success: result is List && result.length > 1
            ? '${result.length} offers created'
            : 'Offer created');
  }

  Future<void> _edit(Map<String, dynamic> offer) async {
    final data = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _OfferFormDialog(initial: offer),
    );
    if (data == null) return;
    await _run(() async {
      await _repo.updateOffer('${offer['id']}', data);
      await _load();
    }, success: 'Offer updated');
  }

  Future<void> _toggle(Map<String, dynamic> offer) async {
    await _run(() async {
      await _repo.toggleOffer('${offer['id']}');
      await _load();
    });
  }

  Future<void> _delete(Map<String, dynamic> offer) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete offer?'),
        content: Text(
            'Remove "${offer['name'] ?? 'this offer'}"? This cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Delete')),
        ],
      ),
    );
    if (confirmed != true) return;
    await _run(() async {
      await _repo.deleteOffer('${offer['id']}');
      await _load();
    }, success: 'Offer deleted');
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Discounts & Offers',
                        style: Theme.of(context).textTheme.headlineMedium),
                    const SizedBox(height: 4),
                    const Text(
                      'Create discounts on menu items and room rates. Active offers '
                      'show as an OFFER tag at the POS and on customer bills.',
                      style: TextStyle(color: AppColors.kTextSecondary),
                    ),
                  ],
                ),
              ),
              OutlinedButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text('Refresh'),
              ),
              const SizedBox(width: 8),
              ElevatedButton.icon(
                onPressed: _busy ? null : _create,
                icon: const Icon(Icons.add, size: 16),
                label: const Text('New Offer'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(spacing: 12, runSpacing: 8, children: [
            DropdownButton<String>(
              value: _targetFilter,
              items: const [
                DropdownMenuItem(value: 'all', child: Text('All targets')),
                DropdownMenuItem(value: 'menu_item', child: Text('Menu items')),
                DropdownMenuItem(
                    value: 'menu_category', child: Text('Menu categories')),
                DropdownMenuItem(value: 'outlet', child: Text('Whole outlet')),
                DropdownMenuItem(value: 'room_type', child: Text('Room types')),
                DropdownMenuItem(value: 'all_rooms', child: Text('All rooms')),
                DropdownMenuItem(value: 'guest', child: Text('Specific Guest')),
              ],
              onChanged: (value) {
                if (value == null) return;
                setState(() => _targetFilter = value);
                _load();
              },
            ),
            DropdownButton<String>(
              value: _activeFilter,
              items: const [
                DropdownMenuItem(
                    value: 'all', child: Text('Active & inactive')),
                DropdownMenuItem(value: 'true', child: Text('Active only')),
                DropdownMenuItem(value: 'false', child: Text('Inactive only')),
              ],
              onChanged: (value) {
                if (value == null) return;
                setState(() => _activeFilter = value);
                _load();
              },
            ),
          ]),
          const SizedBox(height: 16),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _offers.isEmpty
                    ? const _EmptyNotice(
                        'No offers yet. Tap "New Offer" to create one.')
                    : ListView.separated(
                        itemCount: _offers.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, index) =>
                            _offerCard(_offers[index]),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _offerCard(Map<String, dynamic> offer) {
    final active = offer['is_active'] == true;
    final statusColor = active ? AppColors.kSuccess : AppColors.kTextSecondary;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(Icons.local_offer_outlined, color: statusColor),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text('${offer['name'] ?? 'Offer'}',
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 15)),
                      _chip(_discountText(offer), AppColors.kPrimary),
                      _chip(active ? 'ACTIVE' : 'INACTIVE', statusColor),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(_targetText(offer),
                      style: const TextStyle(
                          color: AppColors.kTextSecondary, fontSize: 13)),
                  if (_validityText(offer).isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(_validityText(offer),
                        style: const TextStyle(
                            color: AppColors.kTextSecondary, fontSize: 12)),
                  ],
                ],
              ),
            ),
            Switch(
                value: active, onChanged: _busy ? null : (_) => _toggle(offer)),
            IconButton(
                tooltip: 'Edit',
                onPressed: _busy ? null : () => _edit(offer),
                icon: const Icon(Icons.edit_outlined, size: 20)),
            IconButton(
                tooltip: 'Delete',
                onPressed: _busy ? null : () => _delete(offer),
                icon: const Icon(Icons.delete_outline, size: 20)),
          ],
        ),
      ),
    );
  }

  Widget _chip(String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(text,
            style: TextStyle(
                color: color, fontSize: 10.5, fontWeight: FontWeight.w900)),
      );

  String _discountText(Map<String, dynamic> offer) {
    final type = '${offer['discount_type']}';
    final value = num.tryParse('${offer['discount_value']}') ?? 0;
    return type == 'percentage'
        ? '${_trimNum(value)}% OFF'
        : 'KES ${_trimNum(value)} OFF';
  }

  String _targetText(Map<String, dynamic> offer) {
    final type = '${offer['target_type']}';
    final label = '${offer['target_label'] ?? ''}'.trim();
    final kind = '${offer['item_kind'] ?? ''}'.trim();
    final kindText = kind.isEmpty
        ? ''
        : ' (${kind[0].toUpperCase()}${kind.substring(1)})';
    switch (type) {
      case 'menu_item':
        return 'Menu item: ${label.isEmpty ? '—' : label}$kindText';
      case 'menu_category':
        return 'Category: ${label.isEmpty ? '—' : label}$kindText';
      case 'outlet':
        return 'Whole ${kind.isEmpty ? 'outlet' : kind} menu';
      case 'room_type':
        return 'Room type: ${label.isEmpty ? '—' : label}';
      case 'all_rooms':
        return 'All rooms';
      case 'guest':
        return 'Guest: ${label.isEmpty ? '—' : label}';
      default:
        return type;
    }
  }

  String _validityText(Map<String, dynamic> offer) {
    final start = '${offer['starts_on'] ?? ''}'.trim().split('T').first;
    final end = '${offer['ends_on'] ?? ''}'.trim().split('T').first;
    if (start.isEmpty && end.isEmpty) return '';
    if (start.isNotEmpty && end.isNotEmpty) return 'Valid $start → $end';
    return start.isNotEmpty ? 'From $start' : 'Until $end';
  }

  String _trimNum(num v) =>
      v == v.roundToDouble() ? v.toInt().toString() : v.toString();
}

/// Create / edit dialog for a single offer. Fields adapt to the chosen target.
class _OfferFormDialog extends ConsumerStatefulWidget {
  const _OfferFormDialog({this.initial});

  final Map<String, dynamic>? initial;

  @override
  ConsumerState<_OfferFormDialog> createState() => _OfferFormDialogState();
}

class _OfferFormDialogState extends ConsumerState<_OfferFormDialog> {
  late final TextEditingController _name;
  late final TextEditingController _desc;
  late final TextEditingController _value;
  String _discountType = 'percentage';
  String _targetType = 'menu_item';
  String _itemKind = 'restaurant';
  String _targetId = '';
  String _targetLabel = '';
  bool _active = true;
  DateTime? _start;
  DateTime? _end;

  // ── Multi-select guests (only when _targetType == 'guest') ───────────
  final Set<String> _selectedGuestIds = {};
  // bookingId → display label (e.g. "Gabriel — Room 204")
  final Map<String, String> _guestLabelById = {};

  bool _loadingOptions = false;
  List<_SelectOption> _options = [];

  BranchManagerRepository get _repo =>
      ref.read(branchManagerRepositoryProvider);

  bool get _needsKind =>
      _targetType == 'menu_item' ||
      _targetType == 'menu_category' ||
      _targetType == 'outlet';
  bool get _needsPicker =>
      _targetType == 'menu_item' ||
      _targetType == 'menu_category' ||
      _targetType == 'room_type' ||
      _targetType == 'guest';

  @override
  void initState() {
    super.initState();
    final init = widget.initial;
    _name = TextEditingController(text: '${init?['name'] ?? ''}');
    _desc = TextEditingController(text: '${init?['description'] ?? ''}');
    _value = TextEditingController(
        text: init?['discount_value'] == null
            ? ''
            : '${init!['discount_value']}');
    _discountType = '${init?['discount_type'] ?? 'percentage'}';
    _targetType = '${init?['target_type'] ?? 'menu_item'}';
    final kind = '${init?['item_kind'] ?? ''}';
    _itemKind = (kind == 'bar') ? 'bar' : 'restaurant';
    _targetId = '${init?['target_id'] ?? ''}';
    _targetLabel = '${init?['target_label'] ?? ''}';
    _active = init?['is_active'] == null ? true : init!['is_active'] == true;
    _start = init?['starts_on'] == null
        ? null
        : DateTime.tryParse('${init!['starts_on']}');
    _end = init?['ends_on'] == null
        ? null
        : DateTime.tryParse('${init!['ends_on']}');
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadOptions());
  }

  @override
  void dispose() {
    _name.dispose();
    _desc.dispose();
    _value.dispose();
    super.dispose();
  }

  Future<void> _loadOptions() async {
    if (!_needsPicker) {
      setState(() => _options = []);
      return;
    }
    setState(() => _loadingOptions = true);
    try {
      var opts = <_SelectOption>[];
      if (_targetType == 'menu_item') {
        final rows = _itemKind == 'bar'
            ? await _repo.barDrinks()
            : await _repo.restaurantMenuItems();
        opts = rows
            .map((r) => _SelectOption(
                value: '${r['id']}',
                label: '${r['name'] ?? r['item_name'] ?? 'Item'}'))
            .toList();
      } else if (_targetType == 'menu_category') {
        final rows = _itemKind == 'bar'
            ? await _repo.barCategories()
            : await _repo.restaurantCategories();
        opts = rows
            .map((r) => _SelectOption(
                value: '${r['id']}', label: '${r['name'] ?? 'Category'}'))
            .toList();
      } else if (_targetType == 'room_type') {
        final rows = await _repo.rooms();
        final seen = <String>{};
        for (final r in rows) {
          final t = '${r['room_type'] ?? r['type'] ?? ''}'.trim();
          if (t.isNotEmpty && seen.add(t.toLowerCase())) {
            opts.add(_SelectOption(value: t, label: t));
          }
        }
      } else if (_targetType == 'guest') {
        final rows = await _repo.bookings(status: 'checked_in');
        opts = rows.map((b) {
          final guestName =
              '${b['guest_name'] ?? b['guestName'] ?? b['guest']?['name'] ?? 'Guest'}'
                  .trim();
          final roomNum =
              '${b['room_number'] ?? b['roomNumber'] ?? b['room']?['room_number'] ?? ''}'
                  .trim();
          final label =
              roomNum.isNotEmpty ? '$guestName — Room $roomNum' : guestName;
          final id = '${b['id'] ?? ''}';
          return _SelectOption(value: id, label: label);
        }).where((o) => o.value.isNotEmpty).toList();
      }
      if (!mounted) return;
      setState(() {
        _options = opts;
        _loadingOptions = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _options = [];
        _loadingOptions = false;
      });
    }
  }

  void _onTargetTypeChanged(String value) {
    setState(() {
      _targetType = value;
      _targetId = '';
      _targetLabel = '';
      _options = [];
      _selectedGuestIds.clear();
      _guestLabelById.clear();
    });
    _loadOptions();
  }

  void _onKindChanged(String value) {
    setState(() {
      _itemKind = value;
      _targetId = '';
      _targetLabel = '';
      _options = [];
    });
    _loadOptions();
  }

  String _ymd(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  String _outletLabel() =>
      'Whole ${_itemKind == 'bar' ? 'bar' : 'restaurant'} menu';

  void _submit() {
    final name = _name.text.trim();
    if (name.isEmpty) {
      _snack('Offer name is required');
      return;
    }
    final value = num.tryParse(_value.text.trim());
    if (value == null || value < 0) {
      _snack('Enter a valid discount value');
      return;
    }
    if (_discountType == 'percentage' && value > 100) {
      _snack('Percentage cannot exceed 100');
      return;
    }

    // ── Guest target: validate multi-selection ──
    if (_targetType == 'guest') {
      if (_selectedGuestIds.isEmpty) {
        _snack('Select at least one checked-in guest');
        return;
      }
      final desc = _desc.text.trim().isEmpty ? null : _desc.text.trim();
      final starts = _start == null ? null : _ymd(_start!);
      final ends   = _end   == null ? null : _ymd(_end!);
      // One offer row per guest
      final offers = _selectedGuestIds.map((id) {
        final lbl = _guestLabelById[id] ?? id;
        return <String, dynamic>{
          'name': name,
          'description': desc,
          'discount_type': _discountType,
          'discount_value': value,
          'target_type': 'guest',
          'item_kind': null,
          'target_id': id,
          'target_label': lbl,
          'is_active': _active,
          'starts_on': starts,
          'ends_on': ends,
        };
      }).toList();
      Navigator.pop(context, offers);
      return;
    }

    // ── All other targets: original single-select path ──
    if (_needsPicker && _targetId.isEmpty) {
      _snack('Select what this offer applies to');
      return;
    }

    String label = _targetLabel;
    if (_targetType == 'outlet') label = _outletLabel();
    if (_targetType == 'all_rooms') label = 'All rooms';

    Navigator.pop(context, <String, dynamic>{
      'name': name,
      'description': _desc.text.trim().isEmpty ? null : _desc.text.trim(),
      'discount_type': _discountType,
      'discount_value': value,
      'target_type': _targetType,
      'item_kind': _needsKind ? _itemKind : null,
      'target_id': _needsPicker ? _targetId : null,
      'target_label': label.isEmpty ? null : label,
      'is_active': _active,
      'starts_on': _start == null ? null : _ymd(_start!),
      'ends_on': _end == null ? null : _ymd(_end!),
    });
  }

  void _snack(String message) {
    AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final pickerValue =
        _options.any((o) => o.value == _targetId) ? _targetId : null;
    return AlertDialog(
      title: Text(widget.initial == null ? 'New Offer' : 'Edit Offer'),
      content: SizedBox(
        width: 480,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Offer name *'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _desc,
                decoration:
                    const InputDecoration(labelText: 'Description (optional)'),
              ),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _discountType,
                    decoration:
                        const InputDecoration(labelText: 'Discount type'),
                    items: const [
                      DropdownMenuItem(
                          value: 'percentage', child: Text('Percentage (%)')),
                      DropdownMenuItem(
                          value: 'fixed', child: Text('Fixed amount (KES)')),
                    ],
                    onChanged: (v) =>
                        setState(() => _discountType = v ?? 'percentage'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _value,
                    keyboardType: const TextInputType.numberWithOptions(
                        decimal: true),
                    decoration: InputDecoration(
                      labelText: 'Value *',
                      prefixText: _discountType == 'fixed' ? 'KES ' : null,
                      suffixText: _discountType == 'percentage' ? '%' : null,
                    ),
                  ),
                ),
              ]),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: _targetType,
                decoration: const InputDecoration(labelText: 'Applies to'),
                items: const [
                  DropdownMenuItem(
                      value: 'menu_item', child: Text('Specific menu item')),
                  DropdownMenuItem(
                      value: 'menu_category', child: Text('Menu category')),
                  DropdownMenuItem(
                      value: 'outlet', child: Text('Whole outlet menu')),
                  DropdownMenuItem(
                      value: 'room_type', child: Text('Room type')),
                  DropdownMenuItem(
                      value: 'all_rooms', child: Text('All rooms')),
                  DropdownMenuItem(
                      value: 'guest', child: Text('Specific checked-in guest')),
                ],
                onChanged: (v) => _onTargetTypeChanged(v ?? 'menu_item'),
              ),
              if (_needsKind) ...[
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: _itemKind,
                  decoration: const InputDecoration(labelText: 'Menu'),
                  items: const [
                    DropdownMenuItem(
                        value: 'restaurant', child: Text('Restaurant')),
                    DropdownMenuItem(value: 'bar', child: Text('Bar')),
                  ],
                  onChanged: (v) => _onKindChanged(v ?? 'restaurant'),
                ),
              ],
              if (_needsPicker) ...[
                const SizedBox(height: 10),
                if (_loadingOptions)
                  const Padding(
                    padding: EdgeInsets.all(12),
                    child: Center(
                        child: SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2))),
                  )
                else if (_targetType == 'guest') ...[
                  // ── Multi-select chip checklist ──
                  Text(
                    'Checked-in guests * — tap to select one or more',
                    style: TextStyle(
                        fontSize: 12, color: AppColors.kTextSecondary),
                  ),
                  const SizedBox(height: 6),
                  if (_options.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Text('No guests currently checked in.',
                          style: TextStyle(
                              color: AppColors.kTextSecondary, fontSize: 12)),
                    )
                  else
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 180),
                      child: SingleChildScrollView(
                        child: Wrap(
                          spacing: 8,
                          runSpacing: 4,
                          children: _options.map((o) {
                            final selected =
                                _selectedGuestIds.contains(o.value);
                            return FilterChip(
                              label: Text(o.label,
                                  style: TextStyle(
                                      fontSize: 12.5,
                                      color: selected
                                          ? Colors.white
                                          : AppColors.kTextPrimary)),
                              selected: selected,
                              selectedColor: AppColors.kSuccess,
                              checkmarkColor: Colors.white,
                              backgroundColor: AppColors.kSurface,
                              side: BorderSide(
                                  color: selected
                                      ? AppColors.kSuccess
                                      : AppColors.kDivider),
                              onSelected: (on) => setState(() {
                                if (on) {
                                  _selectedGuestIds.add(o.value);
                                  _guestLabelById[o.value] = o.label;
                                } else {
                                  _selectedGuestIds.remove(o.value);
                                  _guestLabelById.remove(o.value);
                                }
                              }),
                            );
                          }).toList(),
                        ),
                      ),
                    ),
                  if (_selectedGuestIds.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        '${_selectedGuestIds.length} guest${_selectedGuestIds.length == 1 ? '' : 's'} selected — one offer per guest will be created.',
                        style: TextStyle(
                            fontSize: 11.5,
                            color: AppColors.kSuccess,
                            fontWeight: FontWeight.w600),
                      ),
                    ),
                ] else ...[
                  // ── Single-select dropdown for all other picker targets ──
                  DropdownButtonFormField<String>(
                    initialValue: pickerValue,
                    isExpanded: true,
                    decoration: InputDecoration(
                      labelText: _targetType == 'room_type'
                          ? 'Room type *'
                          : _targetType == 'menu_category'
                              ? 'Category *'
                              : 'Menu item *',
                    ),
                    items: _options
                        .map((o) => DropdownMenuItem(
                              value: o.value,
                              child: Text(o.label,
                                  overflow: TextOverflow.ellipsis),
                            ))
                        .toList(),
                    onChanged: (v) {
                      if (v == null) return;
                      final match = _options.firstWhere(
                          (o) => o.value == v,
                          orElse: () => _SelectOption(value: v, label: v));
                      setState(() {
                        _targetId = v;
                        _targetLabel = match.label;
                      });
                    },
                  ),
                  if (_options.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 6),
                      child: Text('No options found for this selection.',
                          style: TextStyle(
                              color: AppColors.kTextSecondary, fontSize: 12)),
                    ),
                ],
              ],
              const SizedBox(height: 10),
              Row(children: [
                Expanded(child: _dateField('Starts (optional)', _start,
                    (d) => setState(() => _start = d))),
                const SizedBox(width: 12),
                Expanded(child: _dateField('Ends (optional)', _end,
                    (d) => setState(() => _end = d))),
              ]),
              const SizedBox(height: 4),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: _active,
                onChanged: (v) => setState(() => _active = v),
                title: const Text('Active'),
                subtitle: const Text('Active offers apply immediately at POS.'),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        ElevatedButton(onPressed: _submit, child: const Text('Save')),
      ],
    );
  }

  Widget _dateField(String label, DateTime? value, ValueChanged<DateTime?> onPick) {
    return InkWell(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: value ?? DateTime.now(),
          firstDate: DateTime(2024),
          lastDate: DateTime(2030),
        );
        if (picked != null) onPick(picked);
      },
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          suffixIcon: value == null
              ? const Icon(Icons.calendar_today, size: 16)
              : IconButton(
                  icon: const Icon(Icons.clear, size: 16),
                  onPressed: () => onPick(null),
                ),
        ),
        child: Text(
          value == null ? 'Any date' : _ymd(value),
          style: TextStyle(
              color: value == null
                  ? AppColors.kTextSecondary
                  : AppColors.kTextPrimary),
        ),
      ),
    );
  }
}

class _SelectOption {
  const _SelectOption({
    required this.value,
    required this.label,
    this.subtitle = '',
  });

  final String value;
  final String label;
  final String subtitle;
}

extension _EmptyString on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}

String _label(BranchManagerSection section) {
  switch (section) {
    case BranchManagerSection.overview:
      return 'Overview';
    case BranchManagerSection.waiterSales:
      return 'Waiter Performance';
    case BranchManagerSection.staffPerformance:
      return 'Staff Performance';
    case BranchManagerSection.conferenceBooking:
      return 'Conference Bookings';
    case BranchManagerSection.users:
      return 'User Accounts';
    case BranchManagerSection.staff:
      return 'Staff';
    case BranchManagerSection.checkin:
      return 'Check-in';
    case BranchManagerSection.reservations:
      return 'Reservations';
    case BranchManagerSection.reviews:
      return 'Reviews';
    case BranchManagerSection.attendance:
      return 'Attendance';
    case BranchManagerSection.leave:
      return 'Leave Requests';
    case BranchManagerSection.offers:
      return 'Discounts & Offers';
    case BranchManagerSection.newReservation:
      return 'New Reservation';
    case BranchManagerSection.reservationDetail:
      return 'Reservation Detail';
    case BranchManagerSection.arrivals:
      return 'Arrivals';
    case BranchManagerSection.departures:
      return 'Departures';
    case BranchManagerSection.guests:
      return 'Guests';
    case BranchManagerSection.guestDetail:
      return 'Guest Detail';
    case BranchManagerSection.staffDetail:
      return 'Staff Detail';
    case BranchManagerSection.staffAttendance:
      return 'Staff Attendance';
    case BranchManagerSection.staffLeave:
      return 'Staff Leave';
    case BranchManagerSection.staffKpis:
      return 'Staff KPIs';
    case BranchManagerSection.staffDocuments:
      return 'Staff Documents';
  }
}

String _subtitle(BranchManagerSection section) {
  switch (section) {
    case BranchManagerSection.waiterSales:
      return 'Restaurant waiter leaderboard, sales totals, order counts, and service performance.';
    case BranchManagerSection.reservations:
      return 'Search, inspect, create, cancel, check in, and check out branch reservations.';
    case BranchManagerSection.guests:
      return 'Guest directory with profile, stay history, create, update, and delete actions.';
    case BranchManagerSection.staff:
      return 'Branch staff directory with CRUD, clock-in/clock-out, and detail workflows.';
    case BranchManagerSection.users:
      return 'Branch login accounts linked to staff profiles, with branch-safe account creation.';
    case BranchManagerSection.staffPerformance:
      return 'Team performance KPIs by period and department.';
    case BranchManagerSection.attendance:
      return 'Daily branch attendance log with detail review and CSV export.';
    case BranchManagerSection.leave:
      return 'Leave active/history workflow with approve, reject, report-to-duty, and export actions.';
    default:
      return 'Branch manager workflow.';
  }
}

List<String> _fieldsFor(BranchManagerSection section) {
  switch (section) {
    case BranchManagerSection.waiterSales:
      return const [
        'waiter_name',
        'orders_count',
        'total_sales',
        'average_order_value',
        'tips',
        'rank'
      ];
    case BranchManagerSection.reservations:
    case BranchManagerSection.reservationDetail:
      return const [
        'booking_reference',
        'guest_name',
        'room_number',
        'check_in_date',
        'check_out_date',
        'status',
        'total_amount'
      ];
    case BranchManagerSection.guests:
    case BranchManagerSection.guestDetail:
      return const [
        'full_name',
        'first_name',
        'last_name',
        'email',
        'phone',
        'total_visits'
      ];
    case BranchManagerSection.staff:
    case BranchManagerSection.staffDetail:
      return const [
        'full_name',
        'first_name',
        'last_name',
        'role',
        'department',
        'status',
        'email',
        'user_id'
      ];
    case BranchManagerSection.users:
      return const [
        'full_name',
        'first_name',
        'last_name',
        'email',
        'role',
        'status',
        'linked_staff_name'
      ];
    case BranchManagerSection.staffPerformance:
    case BranchManagerSection.staffKpis:
      return const [
        'staff_name',
        'department',
        'attendance_rate',
        'punctuality_score',
        'performance_score',
        'rank'
      ];
    case BranchManagerSection.staffAttendance:
    case BranchManagerSection.attendance:
      return const [
        'attendance_date',
        'staff_name',
        'clock_in',
        'clock_out',
        'hours_worked',
        'status'
      ];
    case BranchManagerSection.staffLeave:
    case BranchManagerSection.leave:
      return const [
        'staff_name',
        'leave_type',
        'start_date',
        'end_date',
        'days',
        'status',
        'reason'
      ];
    default:
      return const ['name', 'status', 'created_at'];
  }
}

List<String> _editFields(BranchManagerSection section) {
  switch (section) {
    case BranchManagerSection.guests:
      return const ['first_name', 'last_name', 'email', 'phone', 'id_number'];
    case BranchManagerSection.staff:
      return const [
        'first_name',
        'last_name',
        'email',
        'phone',
        'role',
        'department',
        'status'
      ];
    default:
      return _fieldsFor(section).take(6).toList();
  }
}

String? _createLabel(BranchManagerSection section) {
  switch (section) {
    case BranchManagerSection.reservations:
      return 'New';
    case BranchManagerSection.guests:
      return 'Add Guest';
    case BranchManagerSection.staff:
      return 'Add Staff';
    case BranchManagerSection.users:
      return 'Create Account';
    case BranchManagerSection.leave:
      return 'New Request';
    default:
      return null;
  }
}

List<String> _statusOptions(BranchManagerSection section) {
  switch (section) {
    case BranchManagerSection.reservations:
      return const [
        'all',
        'pending',
        'confirmed',
        'checked_in',
        'checked_out',
        'cancelled'
      ];
    case BranchManagerSection.staff:
    case BranchManagerSection.staffPerformance:
    case BranchManagerSection.users:
      return const [
        'all',
        'cashier',
        'restaurant_cashier',
        'branch_storekeeper',
        'branch_accountant',
        'receptionist',
        'waiter',
        'chef',
        'kitchen_operations',
        'front_desk',
        'housekeeping',
        'restaurant',
        'bar',
        'kitchen',
        'maintenance',
        'store'
      ];
    case BranchManagerSection.leave:
      return const ['all', 'pending', 'approved', 'rejected', 'completed'];
    default:
      return const [];
  }
}

bool _usesSearch(BranchManagerSection section) {
  return const {
    BranchManagerSection.reservations,
    BranchManagerSection.guests,
    BranchManagerSection.staff,
    BranchManagerSection.users,
  }.contains(section);
}

bool _usesDate(BranchManagerSection section) {
  return const {
    BranchManagerSection.attendance,
    BranchManagerSection.staffAttendance,
    BranchManagerSection.waiterSales,
    BranchManagerSection.arrivals,
    BranchManagerSection.departures,
  }.contains(section);
}

bool _usesRange(BranchManagerSection section) => false;

bool _numericField(String field) {
  return field.contains('amount') ||
      field.contains('price') ||
      field.contains('rate') ||
      field.contains('quantity') ||
      field.contains('stock') ||
      field == 'adults' ||
      field == 'children' ||
      field == 'floor';
}
