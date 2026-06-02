import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/branch_sales_payments_view.dart';
import '../../../core/widgets/master_dashboard_shell.dart';
import '../data/repository.dart';
import '../domain/models.dart';
import '../../kitchen/presentation/kds_screen.dart';
import 'mobile/mobile_manager_reviews_screen.dart';

enum BranchManagerSection {
  overview,
  analytics,
  salesPayments,
  cashierClearance,
  soldItems,
  waiterSales,
  reservations,
  newReservation,
  reservationDetail,
  checkin,
  arrivals,
  departures,
  rooms,
  guests,
  guestDetail,
  staff,
  staffPerformance,
  staffDetail,
  staffAttendance,
  staffLeave,
  staffKpis,
  staffDocuments,
  attendance,
  leave,
  stock,
  stockAnalytics,
  stockOut,
  restaurant,
  orderIntelligence,
  menu,
  barMenu,
  housekeeping,
  maintenance,
  wastage,
  reports,
  reviews,
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
  DateTime _date = DateTime.now();
  DateTime _from = DateTime.now().subtract(const Duration(days: 6));
  DateTime _to = DateTime.now();

  BranchManagerStats _stats = const BranchManagerStats();
  Map<String, dynamic> _summary = {};
  Map<String, dynamic>? _detail;
  List<Map<String, dynamic>> _rows = [];
  List<Map<String, dynamic>> _feed = [];
  List<Map<String, dynamic>> _secondaryRows = [];

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
            _safe(_repo.getDashboardStats, const BranchManagerStats()),
            _safe(_repo.getRecentActivity, <RecentActivity>[]),
            _safe(_repo.getDashboardFeed, <Map<String, dynamic>>[]),
          ]);
          _stats = results[0] as BranchManagerStats;
          _rows = (results[1] as List<RecentActivity>)
              .map((item) => {
                    'id': item.id,
                    'description': item.description,
                    'user_name': item.userName,
                    'amount': item.amount,
                    'time': item.timeAgo,
                  })
              .toList();
          _feed = List<Map<String, dynamic>>.from(results[2] as List);
          break;
        case BranchManagerSection.salesPayments:
          // Self-contained view fetches its own data.
          break;
        case BranchManagerSection.analytics:
          _summary = await _repo.branchSalesAnalytics(
            startDate: _ymd(_from),
            endDate: _ymd(_to),
            filters: {'search': _search, 'period': _period},
          );
          _rows = _listFrom(_summary['transactions'] ??
              _summary['rows'] ??
              _summary['sales'] ??
              _summary['data']);
          break;
        case BranchManagerSection.cashierClearance:
          _rows = await _repo.getCashierClearances(
            date: _ymd(_date),
            status: _status,
          );
          break;
        case BranchManagerSection.soldItems:
          _summary = await _repo.getSoldItemsAnalytics(
            startDate: _ymd(_from),
            endDate: _ymd(_to),
            search: _search,
          );
          _rows = _listFrom(_summary['items'] ??
              _summary['sold_items'] ??
              _summary['rows'] ??
              _summary['data']);
          break;
        case BranchManagerSection.waiterSales:
          _rows = await _repo.waiterSales(period: _period, date: _ymd(_date));
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
        case BranchManagerSection.rooms:
          _rows = await _repo.rooms(status: _status, search: _search);
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
        case BranchManagerSection.staffPerformance:
          _rows = await _repo.staffPerformance(
              period: _period, department: _status);
          break;
        case BranchManagerSection.staffDetail:
          await _loadStaffDetail();
          break;
        case BranchManagerSection.staffAttendance:
          _rows = await _repo.staffAttendance(
            date: _ymd(_date),
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
          _rows = await _repo.staffAttendance(date: _ymd(_date));
          break;
        case BranchManagerSection.leave:
          _rows = await _repo.leaveRequests(status: _status);
          break;
        case BranchManagerSection.stock:
          _rows = await _repo.branchStock(search: _search, status: _status);
          break;
        case BranchManagerSection.stockAnalytics:
          _summary = await _repo.stockAnalytics(period: _period);
          _rows = _listFrom(_summary['reorder_suggestions'] ??
              _summary['suggestions'] ??
              _summary['low_stock']);
          _secondaryRows = _listFrom(_summary['trends'] ??
              _summary['consumption_trends'] ??
              _summary['wastage']);
          break;
        case BranchManagerSection.stockOut:
          _rows = await _repo.stockOut();
          break;
        case BranchManagerSection.restaurant:
          _rows = await _repo.restaurantOrders();
          break;
        case BranchManagerSection.orderIntelligence:
          break;
        case BranchManagerSection.menu:
          _rows = await _repo.restaurantMenuItems(category: _status);
          _secondaryRows =
              await _safe(_repo.restaurantCategories, <Map<String, dynamic>>[]);
          break;
        case BranchManagerSection.barMenu:
          _rows = await _repo.barDrinks(category: _status);
          _secondaryRows =
              await _safe(_repo.barCategories, <Map<String, dynamic>>[]);
          break;
        case BranchManagerSection.housekeeping:
          _rows = await _repo.housekeepingTasks(status: _status);
          break;
        case BranchManagerSection.maintenance:
          _rows = await _repo.maintenanceRequests(status: _status);
          break;
        case BranchManagerSection.wastage:
          _rows = await _repo.wastage(
            startDate: _ymd(_from),
            endDate: _ymd(_to),
            reason: _status,
          );
          break;
        case BranchManagerSection.reports:
          _rows = _reportCards;
          break;
        case BranchManagerSection.reviews:
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

  // Grouped to mirror the Next.js branch-manager sidebar:
  // Analytics & Reports → Front Desk Operations → Guest Management →
  // Restaurant Operations → Facility Management → Stock Management →
  // Staff Management → Reports.
  List<MasterNavItem<BranchManagerSection>> get _navItems => [
        // ── Analytics & Reports ──
        const MasterNavItem(
          section: BranchManagerSection.overview,
          label: 'Executive Dashboard',
          icon: Icons.dashboard_outlined,
          group: 'Analytics & Reports',
        ),
        MasterNavItem(
          section: BranchManagerSection.analytics,
          label: 'Sales Analytics',
          icon: PhosphorIcons.chartLine(),
          group: 'Analytics & Reports',
        ),
        MasterNavItem(
          section: BranchManagerSection.salesPayments,
          label: 'Sales & Payments',
          icon: PhosphorIcons.creditCard(),
          group: 'Analytics & Reports',
        ),
        MasterNavItem(
          section: BranchManagerSection.cashierClearance,
          label: 'Cashier Clearance',
          icon: PhosphorIcons.receipt(),
          group: 'Analytics & Reports',
        ),
        MasterNavItem(
          section: BranchManagerSection.soldItems,
          label: 'Sold Items',
          icon: PhosphorIcons.shoppingBag(),
          group: 'Analytics & Reports',
        ),
        // ── Front Desk Operations ──
        MasterNavItem(
          section: BranchManagerSection.checkin,
          label: 'Check-in/Check-out',
          icon: PhosphorIcons.signIn(),
          group: 'Front Desk Operations',
        ),
        MasterNavItem(
          section: BranchManagerSection.reservations,
          label: 'Reservations',
          icon: PhosphorIcons.calendarCheck(),
          group: 'Front Desk Operations',
        ),
        MasterNavItem(
          section: BranchManagerSection.newReservation,
          label: 'New Reservation',
          icon: PhosphorIcons.plus(),
          group: 'Front Desk Operations',
        ),
        const MasterNavItem(
          section: BranchManagerSection.arrivals,
          label: 'Expected Arrivals',
          icon: Icons.flight_land,
          group: 'Front Desk Operations',
        ),
        const MasterNavItem(
          section: BranchManagerSection.departures,
          label: 'Expected Departures',
          icon: Icons.flight_takeoff,
          group: 'Front Desk Operations',
        ),
        // ── Guest Management ──
        MasterNavItem(
          section: BranchManagerSection.guests,
          label: 'Guest Directory',
          icon: PhosphorIcons.identificationCard(),
          group: 'Guest Management',
        ),
        MasterNavItem(
          section: BranchManagerSection.rooms,
          label: 'Room Status',
          icon: PhosphorIcons.bed(),
          group: 'Guest Management',
        ),
        // ── Restaurant Operations ──
        MasterNavItem(
          section: BranchManagerSection.restaurant,
          label: 'Restaurant Overview',
          icon: PhosphorIcons.forkKnife(),
          group: 'Restaurant Operations',
        ),
        const MasterNavItem(
          section: BranchManagerSection.waiterSales,
          label: 'Waiter Performance',
          icon: Icons.groups_outlined,
          group: 'Restaurant Operations',
        ),
        const MasterNavItem(
          section: BranchManagerSection.orderIntelligence,
          label: 'Order Intelligence',
          icon: Icons.insights_outlined,
          group: 'Restaurant Operations',
        ),
        MasterNavItem(
          section: BranchManagerSection.menu,
          label: 'Restaurant Menu',
          icon: PhosphorIcons.listChecks(),
          group: 'Restaurant Operations',
        ),
        MasterNavItem(
          section: BranchManagerSection.barMenu,
          label: 'Bar Menu',
          icon: PhosphorIcons.wine(),
          group: 'Restaurant Operations',
        ),
        // ── Facility Management ──
        const MasterNavItem(
          section: BranchManagerSection.housekeeping,
          label: 'Housekeeping',
          icon: Icons.cleaning_services_outlined,
          group: 'Facility Management',
        ),
        MasterNavItem(
          section: BranchManagerSection.maintenance,
          label: 'Maintenance',
          icon: PhosphorIcons.wrench(),
          group: 'Facility Management',
        ),
        // ── Stock Management ──
        MasterNavItem(
          section: BranchManagerSection.stock,
          label: 'Stock Overview',
          icon: PhosphorIcons.package(),
          group: 'Stock Management',
        ),
        MasterNavItem(
          section: BranchManagerSection.stockAnalytics,
          label: 'Stock Analytics',
          icon: PhosphorIcons.trendUp(),
          group: 'Stock Management',
        ),
        MasterNavItem(
          section: BranchManagerSection.stockOut,
          label: 'Stock Issuance',
          icon: PhosphorIcons.trendDown(),
          group: 'Stock Management',
        ),
        MasterNavItem(
          section: BranchManagerSection.wastage,
          label: 'Wastage Tracking',
          icon: PhosphorIcons.trash(),
          group: 'Stock Management',
        ),
        // ── Staff Management ──
        MasterNavItem(
          section: BranchManagerSection.staff,
          label: 'Staff Directory',
          icon: PhosphorIcons.users(),
          group: 'Staff Management',
        ),
        MasterNavItem(
          section: BranchManagerSection.attendance,
          label: 'Attendance',
          icon: PhosphorIcons.clock(),
          group: 'Staff Management',
        ),
        MasterNavItem(
          section: BranchManagerSection.leave,
          label: 'Leave Requests',
          icon: PhosphorIcons.paperPlaneTilt(),
          group: 'Staff Management',
        ),
        const MasterNavItem(
          section: BranchManagerSection.staffPerformance,
          label: 'Performance',
          icon: Icons.speed_outlined,
          group: 'Staff Management',
        ),
        // ── Reports ──
        MasterNavItem(
          section: BranchManagerSection.reports,
          label: 'Reports',
          icon: PhosphorIcons.filePdf(),
          group: 'Reports',
        ),
        MasterNavItem(
          section: BranchManagerSection.reviews,
          label: 'Review Management',
          icon: PhosphorIcons.chatCircle(),
          group: 'Reports',
        ),
      ];

  Widget _buildSection() {
    switch (_section) {
      case BranchManagerSection.overview:
        return _overview();
      case BranchManagerSection.analytics:
        return _analytics();
      case BranchManagerSection.salesPayments:
        return const BranchSalesPaymentsView();
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
      case BranchManagerSection.reports:
        return _reports();
      case BranchManagerSection.reviews:
        return const MobileManagerReviewsScreen();
      case BranchManagerSection.orderIntelligence:
        return const KitchenOrderIntelligencePanel();
      case BranchManagerSection.stockAnalytics:
        return _stockAnalytics();
      case BranchManagerSection.staffDocuments:
        return _genericPage(
          title: 'Staff Documents',
          subtitle: 'Document upload/download controls from the web workflow.',
          fields: const ['document_type', 'file_name', 'created_at', 'status'],
          actionsBuilder: (row) => [
            _miniButton('View', () => _showRow(row)),
            _miniButton('Download', () => _snack('Download queued')),
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
    return _page(
      title: 'Branch Overview',
      subtitle:
          'Live branch performance, operational alerts, recent activity, and quick actions.',
      trailing: [
        OutlinedButton.icon(
          onPressed: _load,
          icon: const Icon(Icons.refresh, size: 16),
          label: const Text('Refresh'),
        ),
        ElevatedButton.icon(
          onPressed: _showBarcodeItemDialog,
          icon: const Icon(Icons.qr_code_scanner, size: 16),
          label: const Text('Add Item'),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _metric('Today Revenue', _money(_stats.todayRevenue),
                  PhosphorIcons.money(), AppColors.kSuccess),
              _metric('Active Orders', '${_stats.activeOrders}',
                  PhosphorIcons.shoppingCart(), AppColors.kWarning),
              _metric(
                  'Occupancy',
                  '${_stats.occupancyRate.toStringAsFixed(1)}%',
                  PhosphorIcons.bed(),
                  AppColors.kPrimary),
              _metric('Low Stock', '${_stats.lowStockItems}',
                  PhosphorIcons.warning(), AppColors.kError),
            ],
          ),
          const SizedBox(height: 18),
          LayoutBuilder(builder: (context, constraints) {
            final twoCols = constraints.maxWidth > 980;
            final quick = _panel(
              'Quick Actions',
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _quick('Reservations', BranchManagerSection.reservations),
                  _quick('Stock Request', BranchManagerSection.stock),
                  _quick('Staff KPIs', BranchManagerSection.staffPerformance),
                  _quick('Clearance', BranchManagerSection.cashierClearance),
                  _quick('Attendance', BranchManagerSection.attendance),
                  _quick('Reports', BranchManagerSection.reports),
                ],
              ),
            );
            final alerts = _panel(
              'Alerts & Activity',
              Column(
                children: [
                  ..._feed.take(8).map((row) => _compactRow(row)),
                  if (_feed.isEmpty) const _EmptyNotice('No branch alerts.'),
                ],
              ),
            );
            final activity = _panel(
              'Recent Activity',
              Column(
                children: [
                  ..._rows.take(8).map((row) => _compactRow(row)),
                  if (_rows.isEmpty) const _EmptyNotice('No recent activity.'),
                ],
              ),
            );
            if (!twoCols) {
              return Column(children: [quick, alerts, activity]);
            }
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: activity),
                const SizedBox(width: 16),
                Expanded(child: Column(children: [quick, alerts])),
              ],
            );
          }),
        ],
      ),
    );
  }

  Widget _analytics() {
    final total = _num(_summary, ['total_revenue', 'revenue', 'gross_sales']);
    final orders = _num(_summary, ['total_orders', 'orders', 'transactions']);
    final average = orders == 0 ? 0 : total / orders;
    return _page(
      title: 'Sales Analytics',
      subtitle:
          'Branch sales analytics with web parity for date range filters, payment/order/category breakdowns, and exports.',
      trailing: [
        _dateRangeButton(),
        _periodButton(),
        OutlinedButton.icon(
          onPressed: () => _exportBranchSales('csv'),
          icon: const Icon(Icons.download, size: 16),
          label: const Text('CSV'),
        ),
        ElevatedButton.icon(
          onPressed: () => _exportBranchSales('pdf'),
          icon: const Icon(Icons.picture_as_pdf, size: 16),
          label: const Text('PDF'),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(spacing: 12, runSpacing: 12, children: [
            _metric('Gross Sales', _money(total), PhosphorIcons.money(),
                AppColors.kSuccess),
            _metric('Transactions', orders.toStringAsFixed(0),
                PhosphorIcons.receipt(), AppColors.kPrimary),
            _metric('Average Ticket', _money(average), PhosphorIcons.chartBar(),
                AppColors.kAccent),
            _metric('Range', '${_ymd(_from)} to ${_ymd(_to)}',
                PhosphorIcons.calendar(), AppColors.kWarning),
          ]),
          const SizedBox(height: 16),
          _dataList(_rows, _fieldsFor(_section), actionsBuilder: _actionsFor),
        ],
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
                const ['room_number', 'number', 'type', 'rate', 'status']),
          ),
          const SizedBox(height: 16),
          _panel('Guest Search',
              _dataList(_rows, _fieldsFor(BranchManagerSection.guests))),
        ],
      ),
    );
  }

  Widget _detailPage() {
    final title = _recordId == null
        ? _label(_section)
        : '${_label(_section)} #$_recordId';
    return _page(
      title: title,
      subtitle: 'Detail view with related workflow history and actions.',
      trailing: [
        OutlinedButton.icon(
          onPressed: _load,
          icon: const Icon(Icons.refresh, size: 16),
          label: const Text('Refresh'),
        ),
      ],
      child: Column(
        children: [
          if (_detail != null) _detailCard(_detail!),
          const SizedBox(height: 16),
          _dataList(_rows, _fieldsFor(_section), actionsBuilder: _actionsFor),
        ],
      ),
    );
  }

  Widget _stockAnalytics() {
    return _page(
      title: 'Stock Analytics',
      subtitle:
          'Consumption trends, reorder suggestions, wastage signals, and stock request actions.',
      trailing: [_periodButton()],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(spacing: 12, runSpacing: 12, children: [
            _metric('Suggestions', '${_rows.length}', PhosphorIcons.warning(),
                AppColors.kWarning),
            _metric('Trend Rows', '${_secondaryRows.length}',
                PhosphorIcons.trendUp(), AppColors.kPrimary),
            _metric(
                'Period', _period, PhosphorIcons.calendar(), AppColors.kAccent),
          ]),
          const SizedBox(height: 16),
          _panel(
            'Reorder Suggestions',
            _dataList(
                _rows,
                const [
                  'item_name',
                  'name',
                  'current_stock',
                  'minimum_stock',
                  'suggested_quantity',
                  'priority'
                ],
                actionsBuilder: _actionsFor),
          ),
          const SizedBox(height: 16),
          _panel(
            'Trends & Wastage',
            _dataList(_secondaryRows,
                const ['date', 'item_name', 'quantity', 'variance', 'reason']),
          ),
        ],
      ),
    );
  }

  Widget _reports() {
    return _page(
      title: 'Reports',
      subtitle:
          'Branch reports with scheduling-ready report cards and export actions.',
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
          maxCrossAxisExtent: 360,
          childAspectRatio: 1.65,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
        ),
        itemCount: _reportCards.length,
        itemBuilder: (context, index) {
          final report = _reportCards[index];
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(PhosphorIcons.fileText(), color: AppColors.kPrimary),
                  const Spacer(),
                  Text(_text(report, ['title', 'name']),
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w700)),
                  Text(_text(report, ['description']),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: AppColors.kTextSecondary)),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerRight,
                    child: ElevatedButton.icon(
                      onPressed: () => _exportReport(_text(report, ['type'])),
                      icon: const Icon(Icons.download, size: 16),
                      label: const Text('Export'),
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
          final row = rows[index];
          final title = _titleFor(row);
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: _statusColor(_text(row, ['status']))
                    .withValues(alpha: 0.12),
                child: Icon(_iconFor(_section),
                    size: 19, color: _statusColor(_text(row, ['status']))),
              ),
              title: Text(title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: fields
                      .where((field) => _text(row, [field]).isNotEmpty)
                      .take(6)
                      .map((field) => _pill(
                            '${_pretty(field)}: ${_text(row, [field])}',
                            color: field.contains('status')
                                ? _statusColor(_text(row, [field]))
                                : AppColors.kTextSecondary,
                          ))
                      .toList(),
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

  Widget _compactRow(Map<String, dynamic> row) {
    return ListTile(
      dense: true,
      contentPadding: EdgeInsets.zero,
      leading: Icon(_iconFor(_section), size: 18, color: AppColors.kPrimary),
      title: Text(_titleFor(row),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text(_text(row, ['type', 'status', 'created_at']),
          maxLines: 1, overflow: TextOverflow.ellipsis),
      trailing: _text(row, ['amount', 'total_amount', 'quantity']).isEmpty
          ? null
          : Text(_text(row, ['amount', 'total_amount', 'quantity']),
              style: const TextStyle(fontWeight: FontWeight.w700)),
    );
  }

  Widget _detailCard(Map<String, dynamic> detail) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Wrap(
          spacing: 10,
          runSpacing: 10,
          children: detail.entries
              .where(
                  (entry) => entry.value != null && '${entry.value}'.isNotEmpty)
              .take(24)
              .map((entry) => _pill('${_pretty(entry.key)}: ${entry.value}',
                  color: AppColors.kPrimary))
              .toList(),
        ),
      ),
    );
  }

  Widget _quick(String label, BranchManagerSection section) {
    return OutlinedButton(
      onPressed: () {
        setState(() {
          _section = section;
          _recordId = null;
          _resetFilters();
        });
        _load();
      },
      child: Text(label),
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
      child: Text(
        text,
        style:
            TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600),
      ),
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
      case BranchManagerSection.cashierClearance:
        return [
          _miniButton('View', () => _showRow(row)),
          if (id.isNotEmpty && status != 'approved')
            _miniButton('Approve', () => _approveClearance(id)),
          if (id.isNotEmpty) _miniButton('Flag', () => _flagClearance(id)),
        ];
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
      case BranchManagerSection.rooms:
        return [
          _miniButton('View', () => _showRow(row)),
          _miniButton('Edit', () => _editGeneric(row)),
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
      case BranchManagerSection.stock:
      case BranchManagerSection.stockAnalytics:
        return [
          _miniButton('View', () => _showRow(row)),
          _miniButton('Request', () => _stockRequest(row)),
        ];
      case BranchManagerSection.menu:
      case BranchManagerSection.barMenu:
        return [
          _miniButton('Edit', () => _editGeneric(row)),
          if (id.isNotEmpty) _miniButton('Toggle', () => _toggleMenu(id)),
          if (id.isNotEmpty) _miniButton('Delete', () => _deleteGeneric(id)),
        ];
      case BranchManagerSection.housekeeping:
        return [
          _miniButton('View', () => _showRow(row)),
          if (id.isNotEmpty && status == 'pending')
            _miniButton('Start', () => _housekeepingAction(id, 'in_progress')),
          if (id.isNotEmpty && status == 'in_progress')
            _miniButton('Done', () => _housekeepingAction(id, 'completed')),
        ];
      case BranchManagerSection.waiterSales:
      case BranchManagerSection.staffPerformance:
        return [_miniButton('Detail', () => _showRow(row))];
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
      case BranchManagerSection.rooms:
        return () => _showFormDialog(
              title: 'Add Room',
              fields: const [
                'room_number',
                'room_type',
                'floor',
                'rate',
                'status'
              ],
              onSubmit: _repo.createRoom,
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
        return () => _showFormDialog(
              title: 'Add Staff',
              fields: const [
                'first_name',
                'last_name',
                'email',
                'phone',
                'role',
                'department'
              ],
              onSubmit: _repo.createStaff,
            );
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
      case BranchManagerSection.stock:
        return () => _showFormDialog(
              title: 'Create Stock Request',
              fields: const ['item_id', 'quantity', 'priority', 'notes'],
              onSubmit: _repo.createStockRequest,
            );
      case BranchManagerSection.menu:
        return () => _showFormDialog(
              title: 'Create Menu Item',
              fields: const [
                'name',
                'category_id',
                'price',
                'description',
                'available'
              ],
              onSubmit: _repo.createRestaurantMenuItem,
            );
      case BranchManagerSection.barMenu:
        return () => _showFormDialog(
              title: 'Create Bar Drink',
              fields: const [
                'name',
                'category_id',
                'price',
                'description',
                'available'
              ],
              onSubmit: _repo.createBarDrink,
            );
      case BranchManagerSection.wastage:
        return () => _showFormDialog(
              title: 'Record Wastage',
              fields: const ['item_id', 'quantity', 'reason', 'notes'],
              onSubmit: _repo.recordWastage,
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
        field: TextEditingController(text: '${initial[field] ?? ''}'),
    };
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: SizedBox(
          width: 460,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final field in fields) ...[
                  TextField(
                    controller: controllers[field],
                    keyboardType: _numericField(field)
                        ? const TextInputType.numberWithOptions(decimal: true)
                        : TextInputType.text,
                    decoration: InputDecoration(labelText: _pretty(field)),
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
              for (final entry in controllers.entries) {
                final value = entry.value.text.trim();
                if (value.isEmpty) continue;
                data[entry.key] = _numericField(entry.key)
                    ? (num.tryParse(value) ?? value)
                    : value;
              }
              Navigator.pop(ctx, data);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
    for (final controller in controllers.values) {
      controller.dispose();
    }
    if (result == null) return;
    await _run(() async {
      await onSubmit(result);
      await _load();
    }, success: '$title saved');
  }

  void _showRow(Map<String, dynamic> row) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(_titleFor(row)),
        content: SizedBox(width: 520, child: _detailCard(row)),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
        ],
      ),
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

  Future<void> _showBarcodeItemDialog() {
    return _showFormDialog(
      title: 'Add Item by Barcode/SKU',
      fields: const [
        'sku',
        'barcode',
        'name',
        'quantity',
        'unit',
        'cost_price'
      ],
      onSubmit: (data) => _repo.postMap('/store/items', data: data),
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
          case BranchManagerSection.rooms:
            await _repo.updateRoom(id, data);
            break;
          case BranchManagerSection.guests:
            await _repo.updateGuest(id, data);
            break;
          case BranchManagerSection.staff:
            await _repo.updateStaff(id, data);
            break;
          case BranchManagerSection.menu:
            await _repo.updateRestaurantMenuItem(id, data);
            break;
          case BranchManagerSection.barMenu:
            await _repo.updateBarDrink(id, data);
            break;
          default:
            break;
        }
      },
    );
  }

  Future<void> _deleteGeneric(String id) async {
    final confirmed = await _confirm('Delete this record?');
    if (!confirmed) return;
    await _run(() async {
      switch (_section) {
        case BranchManagerSection.rooms:
          await _repo.deleteRoom(id);
          break;
        case BranchManagerSection.guests:
          await _repo.deleteGuest(id);
          break;
        case BranchManagerSection.staff:
          await _repo.deleteStaff(id);
          break;
        case BranchManagerSection.menu:
          await _repo.deleteRestaurantMenuItem(id);
          break;
        case BranchManagerSection.barMenu:
          await _repo.deleteBarDrink(id);
          break;
        default:
          break;
      }
      await _load();
    }, success: 'Record deleted');
  }

  Future<void> _approveClearance(String id) async {
    await _run(() async {
      await _repo.approveClearance(id);
      await _load();
    }, success: 'Clearance approved');
  }

  Future<void> _flagClearance(String id) async {
    await _showFormDialog(
      title: 'Flag Clearance',
      fields: const ['reason', 'notes'],
      onSubmit: (data) => _repo.flagClearance(
        id,
        reason: '${data['reason'] ?? 'Needs review'}',
        notes: '${data['notes'] ?? ''}',
      ),
    );
  }

  Future<void> _bookingAction(String id, String action) async {
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

  Future<void> _stockRequest(Map<String, dynamic> row) async {
    await _showFormDialog(
      title: 'Create Stock Request',
      fields: const ['item_id', 'quantity', 'priority', 'notes'],
      initial: {
        'item_id': row['item_id'] ?? row['id'],
        'quantity': row['suggested_quantity'] ?? row['minimum_stock'] ?? '',
        'priority': row['priority'] ?? 'normal',
      },
      onSubmit: _repo.createStockRequest,
    );
  }

  Future<void> _toggleMenu(String id) async {
    await _run(() async {
      if (_section == BranchManagerSection.menu) {
        await _repo.toggleRestaurantMenuItem(id);
      } else {
        await _repo.toggleBarDrink(id);
      }
      await _load();
    }, success: 'Availability updated');
  }

  Future<void> _housekeepingAction(String id, String status) async {
    await _run(() async {
      await _repo.updateHousekeepingTask(id, {'status': status});
      await _load();
    }, success: 'Housekeeping task updated');
  }

  Future<void> _exportBranchSales(String format) async {
    await _run(() async {
      final file = await _repo.exportBranchSales(
        startDate: _ymd(_from),
        endDate: _ymd(_to),
        format: format,
        filters: {'period': _period, 'search': _search},
      );
      _snack('Export saved to ${file.path}');
    });
  }

  Future<void> _exportReport(String type) async {
    await _run(() async {
      final file = await _repo.exportReport(type, data: {
        'start_date': _ymd(_from),
        'end_date': _ymd(_to),
      });
      _snack('Report saved to ${file.path}');
    });
  }

  Future<void> _exportRows(String name, List<Map<String, dynamic>> rows) async {
    if (rows.isEmpty) return _snack('No rows to export');
    await _run(() async {
      final file = await _repo.exportCurrentRows(
        name: name.toLowerCase().replaceAll(' ', '_'),
        rows: rows,
      );
      _snack('CSV saved to ${file.path}');
    });
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
    if (id.isEmpty) return _showRow({});
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

  String _titleFor(Map<String, dynamic> row) => _text(row, [
        'guest_name',
        'full_name',
        'name',
        'item_name',
        'staff_name',
        'cashier_name',
        'room_number',
        'title',
        'description',
        'type',
        'id',
      ]).ifEmpty('Record');

  String _text(Map<String, dynamic> row, List<String> keys) {
    for (final key in keys) {
      final value = row[key];
      if (value != null && '$value'.trim().isNotEmpty) return '$value';
    }
    return '';
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
      case BranchManagerSection.analytics:
        return PhosphorIcons.chartLine();
      case BranchManagerSection.cashierClearance:
        return PhosphorIcons.receipt();
      case BranchManagerSection.rooms:
        return PhosphorIcons.bed();
      case BranchManagerSection.staff:
      case BranchManagerSection.staffPerformance:
        return PhosphorIcons.users();
      case BranchManagerSection.stock:
      case BranchManagerSection.stockAnalytics:
      case BranchManagerSection.stockOut:
        return PhosphorIcons.package();
      case BranchManagerSection.menu:
      case BranchManagerSection.restaurant:
      case BranchManagerSection.orderIntelligence:
        return PhosphorIcons.forkKnife();
      case BranchManagerSection.barMenu:
        return PhosphorIcons.wine();
      case BranchManagerSection.housekeeping:
        return Icons.cleaning_services_outlined;
      case BranchManagerSection.maintenance:
        return PhosphorIcons.wrench();
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

extension _EmptyString on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}

const _reportCards = <Map<String, dynamic>>[
  {
    'title': 'Daily Sales',
    'type': 'daily-sales',
    'description': 'Daily cashier, restaurant, bar, and branch sales.'
  },
  {
    'title': 'Occupancy',
    'type': 'occupancy',
    'description': 'Room occupancy and arrival/departure performance.'
  },
  {
    'title': 'Staff Performance',
    'type': 'staff-performance',
    'description': 'Attendance, leave, and branch team KPI report.'
  },
  {
    'title': 'Sold Items',
    'type': 'sold-items',
    'description': 'Item-level sold quantity and revenue analysis.'
  },
  {
    'title': 'Wastage Summary',
    'type': 'wastage',
    'description': 'Wastage quantities, reasons, and financial impact.'
  },
  {
    'title': 'Inventory Status',
    'type': 'inventory',
    'description': 'Stock levels, low-stock alerts, and reorder signals.'
  },
];

String _label(BranchManagerSection section) {
  switch (section) {
    case BranchManagerSection.overview:
      return 'Overview';
    case BranchManagerSection.analytics:
      return 'Sales Analytics';
    case BranchManagerSection.salesPayments:
      return 'Sales & Payments';
    case BranchManagerSection.cashierClearance:
      return 'Cashier Clearance';
    case BranchManagerSection.soldItems:
      return 'Sold Items';
    case BranchManagerSection.waiterSales:
      return 'Waiter Sales';
    case BranchManagerSection.reservations:
      return 'Reservations';
    case BranchManagerSection.newReservation:
      return 'New Reservation';
    case BranchManagerSection.reservationDetail:
      return 'Reservation Detail';
    case BranchManagerSection.checkin:
      return 'Check-in';
    case BranchManagerSection.arrivals:
      return 'Arrivals';
    case BranchManagerSection.departures:
      return 'Departures';
    case BranchManagerSection.rooms:
      return 'Rooms';
    case BranchManagerSection.guests:
      return 'Guests';
    case BranchManagerSection.guestDetail:
      return 'Guest Detail';
    case BranchManagerSection.staff:
      return 'Staff';
    case BranchManagerSection.staffPerformance:
      return 'Staff Performance';
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
    case BranchManagerSection.attendance:
      return 'Attendance';
    case BranchManagerSection.leave:
      return 'Leave Requests';
    case BranchManagerSection.stock:
      return 'Stock';
    case BranchManagerSection.stockAnalytics:
      return 'Stock Analytics';
    case BranchManagerSection.stockOut:
      return 'Stock Out';
    case BranchManagerSection.restaurant:
      return 'Restaurant';
    case BranchManagerSection.orderIntelligence:
      return 'Order Intelligence';
    case BranchManagerSection.menu:
      return 'Restaurant Menu';
    case BranchManagerSection.barMenu:
      return 'Bar Menu';
    case BranchManagerSection.housekeeping:
      return 'Housekeeping';
    case BranchManagerSection.maintenance:
      return 'Maintenance';
    case BranchManagerSection.wastage:
      return 'Wastage';
    case BranchManagerSection.reports:
      return 'Reports';
    case BranchManagerSection.reviews:
      return 'Reviews';
  }
}

String _subtitle(BranchManagerSection section) {
  switch (section) {
    case BranchManagerSection.cashierClearance:
      return 'Review cashier station submissions, approve reconciled shifts, and flag variances.';
    case BranchManagerSection.soldItems:
      return 'Branch sold-item analytics with date filtering, search, and export.';
    case BranchManagerSection.waiterSales:
      return 'Restaurant waiter leaderboard, sales totals, order counts, and service performance.';
    case BranchManagerSection.reservations:
      return 'Search, inspect, create, cancel, check in, and check out branch reservations.';
    case BranchManagerSection.rooms:
      return 'Room status board with availability, occupancy, maintenance, and room CRUD actions.';
    case BranchManagerSection.guests:
      return 'Guest directory with profile, stay history, create, update, and delete actions.';
    case BranchManagerSection.staff:
      return 'Branch staff directory with CRUD, clock-in/clock-out, and detail workflows.';
    case BranchManagerSection.staffPerformance:
      return 'Team performance KPIs by period and department.';
    case BranchManagerSection.attendance:
      return 'Daily branch attendance log with detail review and CSV export.';
    case BranchManagerSection.leave:
      return 'Leave active/history workflow with approve, reject, report-to-duty, and export actions.';
    case BranchManagerSection.stock:
      return 'Branch stock overview, low/out-of-stock filters, and stock request creation.';
    case BranchManagerSection.stockOut:
      return 'Stock-out movement ledger for branch inventory deductions.';
    case BranchManagerSection.restaurant:
      return 'Restaurant operation overview with recent orders and quick links to menu and waiter sales.';
    case BranchManagerSection.orderIntelligence:
      return 'Branch-specific kitchen demand, rush windows, and preparation pressure from restaurant POS orders.';
    case BranchManagerSection.menu:
      return 'Restaurant menu item/category management, availability toggles, and CRUD.';
    case BranchManagerSection.barMenu:
      return 'Bar drink/category management, availability toggles, and CRUD.';
    case BranchManagerSection.housekeeping:
      return 'Housekeeping task queue with start and completion actions.';
    case BranchManagerSection.maintenance:
      return 'Maintenance work-order board for branch manager visibility.';
    case BranchManagerSection.wastage:
      return 'Wastage reports by period and reason with record and export actions.';
    default:
      return 'Branch manager workflow mirrored from the Next.js dashboard.';
  }
}

List<String> _fieldsFor(BranchManagerSection section) {
  switch (section) {
    case BranchManagerSection.analytics:
      return const [
        'date',
        'order_number',
        'payment_method',
        'order_type',
        'category',
        'total_amount'
      ];
    case BranchManagerSection.cashierClearance:
      return const [
        'date',
        'cashier_name',
        'shift',
        'expected_amount',
        'actual_amount',
        'variance',
        'status'
      ];
    case BranchManagerSection.soldItems:
      return const [
        'item_name',
        'sku',
        'category',
        'quantity_sold',
        'total_revenue',
        'profit'
      ];
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
    case BranchManagerSection.rooms:
      return const [
        'room_number',
        'room_type',
        'floor',
        'rate',
        'status',
        'housekeeping_status'
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
        'email'
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
    case BranchManagerSection.stock:
      return const [
        'item_name',
        'name',
        'sku',
        'current_stock',
        'minimum_stock',
        'unit',
        'status'
      ];
    case BranchManagerSection.stockOut:
      return const [
        'created_at',
        'item_name',
        'quantity',
        'unit',
        'reason',
        'created_by'
      ];
    case BranchManagerSection.restaurant:
      return const [
        'order_number',
        'table_number',
        'waiter_name',
        'status',
        'total_amount',
        'created_at'
      ];
    case BranchManagerSection.menu:
      return const [
        'name',
        'category_name',
        'price',
        'available',
        'description'
      ];
    case BranchManagerSection.barMenu:
      return const [
        'name',
        'category_name',
        'price',
        'available',
        'stock_quantity'
      ];
    case BranchManagerSection.housekeeping:
      return const [
        'room_number',
        'task_type',
        'assigned_to',
        'priority',
        'status',
        'due_date'
      ];
    case BranchManagerSection.maintenance:
      return const [
        'title',
        'room_number',
        'priority',
        'status',
        'reported_by',
        'created_at'
      ];
    case BranchManagerSection.wastage:
      return const [
        'created_at',
        'item_name',
        'quantity',
        'reason',
        'cost_impact',
        'notes'
      ];
    default:
      return const ['name', 'status', 'created_at'];
  }
}

List<String> _editFields(BranchManagerSection section) {
  switch (section) {
    case BranchManagerSection.rooms:
      return const ['room_number', 'room_type', 'floor', 'rate', 'status'];
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
    case BranchManagerSection.menu:
    case BranchManagerSection.barMenu:
      return const ['name', 'category_id', 'price', 'description', 'available'];
    default:
      return _fieldsFor(section).take(6).toList();
  }
}

String? _createLabel(BranchManagerSection section) {
  switch (section) {
    case BranchManagerSection.reservations:
      return 'New';
    case BranchManagerSection.rooms:
      return 'Add Room';
    case BranchManagerSection.guests:
      return 'Add Guest';
    case BranchManagerSection.staff:
      return 'Add Staff';
    case BranchManagerSection.leave:
      return 'New Request';
    case BranchManagerSection.stock:
      return 'Stock Request';
    case BranchManagerSection.menu:
      return 'Menu Item';
    case BranchManagerSection.barMenu:
      return 'Drink';
    case BranchManagerSection.wastage:
      return 'Record';
    default:
      return null;
  }
}

List<String> _statusOptions(BranchManagerSection section) {
  switch (section) {
    case BranchManagerSection.cashierClearance:
      return const ['all', 'pending', 'approved', 'flagged'];
    case BranchManagerSection.reservations:
      return const [
        'all',
        'pending',
        'confirmed',
        'checked_in',
        'checked_out',
        'cancelled'
      ];
    case BranchManagerSection.rooms:
      return const ['all', 'available', 'occupied', 'maintenance', 'cleaning'];
    case BranchManagerSection.staff:
    case BranchManagerSection.staffPerformance:
      return const [
        'all',
        'front_office',
        'restaurant',
        'housekeeping',
        'maintenance',
        'store',
        'bar'
      ];
    case BranchManagerSection.leave:
      return const ['all', 'pending', 'approved', 'rejected', 'completed'];
    case BranchManagerSection.stock:
      return const ['all', 'low', 'out'];
    case BranchManagerSection.menu:
    case BranchManagerSection.barMenu:
      return const ['all'];
    case BranchManagerSection.housekeeping:
    case BranchManagerSection.maintenance:
      return const ['all', 'pending', 'in_progress', 'completed', 'cancelled'];
    case BranchManagerSection.wastage:
      return const [
        'all',
        'expired',
        'spoiled',
        'damaged',
        'overproduction',
        'other'
      ];
    default:
      return const [];
  }
}

bool _usesSearch(BranchManagerSection section) {
  return const {
    BranchManagerSection.reservations,
    BranchManagerSection.soldItems,
    BranchManagerSection.rooms,
    BranchManagerSection.guests,
    BranchManagerSection.staff,
    BranchManagerSection.stock,
    BranchManagerSection.menu,
    BranchManagerSection.barMenu,
  }.contains(section);
}

bool _usesDate(BranchManagerSection section) {
  return const {
    BranchManagerSection.cashierClearance,
    BranchManagerSection.attendance,
    BranchManagerSection.staffAttendance,
    BranchManagerSection.waiterSales,
    BranchManagerSection.arrivals,
    BranchManagerSection.departures,
  }.contains(section);
}

bool _usesRange(BranchManagerSection section) {
  return const {
    BranchManagerSection.soldItems,
    BranchManagerSection.wastage,
  }.contains(section);
}

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
