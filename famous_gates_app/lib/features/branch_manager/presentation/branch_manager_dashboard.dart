import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/readable_record.dart';
import '../../../core/widgets/branch_sales_payments_view.dart';
import '../../../core/widgets/master_dashboard_shell.dart';
import '../../../core/widgets/record_detail_screen.dart';
import '../../kitchen_operations/presentation/kitchen_operations_dashboard.dart';
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
  kitchenStock,
  kitchenRequisitions,
  kitchenRecipes,
  kitchenUsage,
  kitchenWastage,
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
  String _leaveTab = 'active';
  bool _leaveDateFilter = false;
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
        case BranchManagerSection.kitchenStock:
        case BranchManagerSection.kitchenRequisitions:
        case BranchManagerSection.kitchenRecipes:
        case BranchManagerSection.kitchenUsage:
        case BranchManagerSection.kitchenWastage:
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

  List<MasterNavItem<BranchManagerSection>> get _navItems => [
        const MasterNavItem(
          section: BranchManagerSection.overview,
          label: 'Executive Dashboard',
          icon: Icons.dashboard_outlined,
          group: null,
        ),
        MasterNavItem(
          section: BranchManagerSection.analytics,
          label: 'Sales Analytics',
          icon: PhosphorIcons.chartLine(),
          group: 'Financial Performance',
        ),
        MasterNavItem(
          section: BranchManagerSection.cashierClearance,
          label: 'Cashier Clearance',
          icon: PhosphorIcons.receipt(),
          group: 'Financial Performance',
        ),
        MasterNavItem(
          section: BranchManagerSection.checkin,
          label: 'Check-in/Check-out',
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
          section: BranchManagerSection.arrivals,
          label: 'Expected Arrivals',
          icon: Icons.flight_land,
          group: 'Guest Services',
        ),
        const MasterNavItem(
          section: BranchManagerSection.departures,
          label: 'Expected Departures',
          icon: Icons.flight_takeoff,
          group: 'Guest Services',
        ),
        MasterNavItem(
          section: BranchManagerSection.guests,
          label: 'Guest Directory',
          icon: PhosphorIcons.identificationCard(),
          group: 'Guest Services',
        ),
        MasterNavItem(
          section: BranchManagerSection.rooms,
          label: 'Room Status',
          icon: PhosphorIcons.bed(),
          group: 'Guest Services',
        ),
        MasterNavItem(
          section: BranchManagerSection.restaurant,
          label: 'Restaurant Overview',
          icon: PhosphorIcons.forkKnife(),
          group: 'Food & Beverage',
        ),
        const MasterNavItem(
          section: BranchManagerSection.waiterSales,
          label: 'Waiter Performance',
          icon: Icons.groups_outlined,
          group: 'Food & Beverage',
        ),
        const MasterNavItem(
          section: BranchManagerSection.housekeeping,
          label: 'Housekeeping',
          icon: Icons.cleaning_services_outlined,
          group: 'Facilities & Operations',
        ),
        MasterNavItem(
          section: BranchManagerSection.maintenance,
          label: 'Maintenance',
          icon: PhosphorIcons.wrench(),
          group: 'Facilities & Operations',
        ),
        MasterNavItem(
          section: BranchManagerSection.stock,
          label: 'Stock Overview',
          icon: PhosphorIcons.package(),
          group: 'Inventory Control',
        ),
        MasterNavItem(
          section: BranchManagerSection.stockAnalytics,
          label: 'Stock Analytics',
          icon: PhosphorIcons.trendUp(),
          group: 'Inventory Control',
        ),
        MasterNavItem(
          section: BranchManagerSection.stockOut,
          label: 'Stock Issuance',
          icon: PhosphorIcons.trendDown(),
          group: 'Inventory Control',
        ),
        MasterNavItem(
          section: BranchManagerSection.wastage,
          label: 'Wastage Tracking',
          icon: PhosphorIcons.trash(),
          group: 'Inventory Control',
        ),
        MasterNavItem(
          section: BranchManagerSection.staff,
          label: 'Staff Directory',
          icon: PhosphorIcons.users(),
          group: 'Human Resources',
        ),
        MasterNavItem(
          section: BranchManagerSection.attendance,
          label: 'Attendance',
          icon: PhosphorIcons.clock(),
          group: 'Human Resources',
        ),
        MasterNavItem(
          section: BranchManagerSection.leave,
          label: 'Leave Requests',
          icon: PhosphorIcons.paperPlaneTilt(),
          group: 'Human Resources',
        ),
        const MasterNavItem(
          section: BranchManagerSection.staffPerformance,
          label: 'Performance',
          icon: Icons.speed_outlined,
          group: 'Human Resources',
        ),
        MasterNavItem(
          section: BranchManagerSection.kitchenStock,
          label: 'Stock Ledger',
          icon: PhosphorIcons.bookOpen(),
          group: 'Kitchen Ops',
        ),
        MasterNavItem(
          section: BranchManagerSection.kitchenRequisitions,
          label: 'Request Stock',
          icon: PhosphorIcons.shoppingCart(),
          group: 'Kitchen Ops',
        ),
        MasterNavItem(
          section: BranchManagerSection.kitchenRecipes,
          label: 'Recipes & BOM',
          icon: PhosphorIcons.cookingPot(),
          group: 'Kitchen Ops',
        ),
        MasterNavItem(
          section: BranchManagerSection.kitchenUsage,
          label: 'Usage Tracking',
          icon: PhosphorIcons.clipboardText(),
          group: 'Kitchen Ops',
        ),
        MasterNavItem(
          section: BranchManagerSection.kitchenWastage,
          label: 'Record Wastage',
          icon: PhosphorIcons.trash(),
          group: 'Kitchen Ops',
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
      case BranchManagerSection.waiterSales:
        return _waiterPerformance();
      case BranchManagerSection.attendance:
      case BranchManagerSection.staffAttendance:
        return _attendanceDashboard();
      case BranchManagerSection.stockAnalytics:
        return _stockAnalytics();
      case BranchManagerSection.staffPerformance:
        return _staffPerformance();
      case BranchManagerSection.leave:
        return _leaveManagement();
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
      case BranchManagerSection.kitchenStock:
        return const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.stock,
          embedded: true,
        );
      case BranchManagerSection.kitchenRequisitions:
        return const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.requisitions,
          embedded: true,
        );
      case BranchManagerSection.kitchenRecipes:
        return const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.recipes,
          embedded: true,
        );
      case BranchManagerSection.kitchenUsage:
        return const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.usage,
          embedded: true,
        );
      case BranchManagerSection.kitchenWastage:
        return const KitchenOperationsDashboard(
          initialSection: KitchenOperationsSection.wastage,
          embedded: true,
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
          Wrap(spacing: 12, runSpacing: 12, children: [
            _metric('Today Revenue', _money(_stats.todayRevenue),
                PhosphorIcons.money(), AppColors.kSuccess),
            _metric('Active Orders', '${_stats.activeOrders}',
                PhosphorIcons.shoppingCart(), AppColors.kWarning),
            _metric('Occupancy', '${_stats.occupancyRate.toStringAsFixed(1)}%',
                PhosphorIcons.bed(), AppColors.kPrimary),
            _metric('Low Stock', '${_stats.lowStockItems}',
                PhosphorIcons.warning(), AppColors.kError),
          ]),
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
                ));
            final alerts = _panel(
                'Alerts & Activity',
                Column(
                  children: [
                    ..._feed.take(8).map((row) => _compactRow(row)),
                    if (_feed.isEmpty) const _EmptyNotice('No branch alerts.'),
                  ],
                ));
            final activity = _panel(
                'Recent Activity',
                Column(
                  children: [
                    ..._rows.take(8).map((row) => _compactRow(row)),
                    if (_rows.isEmpty)
                      const _EmptyNotice('No recent activity.'),
                  ],
                ));
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
          'Branch sales analytics with date range filters, payment/order/category breakdowns, and exports.',
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
                actionsBuilder: _actionsFor,
              )),
          const SizedBox(height: 16),
          _panel(
              'Trends & Wastage',
              _dataList(_secondaryRows, const [
                'date',
                'item_name',
                'quantity',
                'variance',
                'reason'
              ])),
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
            _period = value;
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
            _staffPerformancePeriod = value;
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

  Widget _compactRow(Map<String, dynamic> row) {
    final record = _normalizeRecord(row);
    final amount = _text(record, [
      'amount',
      'total_amount',
      'grand_total',
      'quantity',
      'current_stock',
    ]);
    return ListTile(
      dense: true,
      contentPadding: EdgeInsets.zero,
      leading: Icon(_iconFor(_section), size: 18, color: AppColors.kPrimary),
      title: Text(_titleFor(record),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text(
          _subtitleForRow(record)
              .ifEmpty(_text(record, ['type', 'status', 'created_at'])),
          maxLines: 1,
          overflow: TextOverflow.ellipsis),
      trailing: amount.isEmpty
          ? null
          : Text(_formatValue(record, 'amount', amount),
              style: const TextStyle(fontWeight: FontWeight.w700)),
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
          if (id.isNotEmpty)
            _miniButton('Status', () => _changeRoomStatus(row)),
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
      case BranchManagerSection.maintenance:
        return [
          _miniButton('View', () => _showRow(row)),
          if (id.isNotEmpty && status == 'pending')
            _miniButton('Start', () => _maintenanceAction(id, 'in_progress')),
          if (id.isNotEmpty && status == 'in_progress')
            _miniButton('Complete', () => _maintenanceAction(id, 'completed')),
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
              fields: const ['room_number', 'room_type', 'floor', 'status'],
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
      case BranchManagerSection.maintenance:
        return () => _showFormDialog(
              title: 'New Maintenance Request',
              fields: const ['title', 'description', 'priority', 'location'],
              onSubmit: (data) => _repo.postMap('/maintenance/tasks', data: {
                ...data,
                'status': 'pending',
              }),
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
    final result = await showDialog<Map<String, dynamic>>(
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
    for (final controller in controllers.values) {
      controller.dispose();
    }
    if (result == null) return;
    await _run(() async {
      await onSubmit(result);
      await _load();
    }, success: '$title saved');
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
          final staff = await _repo.staff();
          return staff.map((s) {
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
        case 'category_id':
          if (_section == BranchManagerSection.barMenu) {
            final cats = await _repo.barCategories();
            return cats
                .map((c) =>
                    _SelectOption(value: '${c['id']}', label: '${c['name']}'))
                .toList();
          }
          final cats =
              await _safe(_repo.restaurantCategories, <Map<String, dynamic>>[]);
          return cats
              .map((c) =>
                  _SelectOption(value: '${c['id']}', label: '${c['name']}'))
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
          case BranchManagerSection.maintenance:
            await _repo.putMap('/maintenance/tasks/$id', data: data);
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
        case BranchManagerSection.maintenance:
          await _repo.delete('/maintenance/tasks/$id');
          break;
        default:
          break;
      }
      await _load();
    }, success: 'Record deleted');
  }

  Future<void> _changeRoomStatus(Map<String, dynamic> row) async {
    final id = _id(row);
    if (id.isEmpty) return;
    final currentStatus = _text(row, ['status']).toLowerCase();
    final options = ['available', 'occupied', 'maintenance', 'cleaning'];
    final newStatus = await showDialog<String>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('Change Room Status'),
        children: options
            .where((o) => o != currentStatus)
            .map((o) => SimpleDialogOption(
                  onPressed: () => Navigator.pop(ctx, o),
                  child: Text(_pretty(o)),
                ))
            .toList(),
      ),
    );
    if (newStatus == null) return;
    await _run(() async {
      await _repo.patchMap('/rooms/$id/status', data: {'status': newStatus});
      await _load();
    }, success: 'Room status updated');
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

  Future<void> _maintenanceAction(String id, String newStatus) async {
    await _run(() async {
      await _repo.putMap('/maintenance/tasks/$id', data: {'status': newStatus});
      await _load();
    }, success: 'Maintenance task updated');
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
      case BranchManagerSection.rooms:
        return const ['room_number', 'name'];
      case BranchManagerSection.guests:
      case BranchManagerSection.guestDetail:
        return const ['full_name', 'guest_name', 'phone'];
      case BranchManagerSection.staff:
      case BranchManagerSection.staffDetail:
      case BranchManagerSection.staffPerformance:
      case BranchManagerSection.staffKpis:
      case BranchManagerSection.staffAttendance:
      case BranchManagerSection.attendance:
      case BranchManagerSection.leave:
      case BranchManagerSection.staffLeave:
        return const ['staff_name', 'full_name', 'employee_number'];
      case BranchManagerSection.stock:
      case BranchManagerSection.stockAnalytics:
      case BranchManagerSection.stockOut:
      case BranchManagerSection.wastage:
        return const ['item_name', 'menu_item_name', 'item_sku', 'sku'];
      case BranchManagerSection.restaurant:
        return const ['order_number', 'table_number', 'guest_name'];
      case BranchManagerSection.waiterSales:
        return const ['waiter_name', 'staff_name', 'full_name'];
      case BranchManagerSection.cashierClearance:
        return const ['cashier_name', 'shift', 'date'];
      default:
        return const ['name', 'title'];
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
    if (_section == BranchManagerSection.rooms &&
        const {'rate', 'base_rate', 'room_rate', 'price'}.contains(lower)) {
      return true;
    }
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
      case BranchManagerSection.rooms:
        addField('room_type');
        addField('floor');
        addField('housekeeping_status');
        addField('status');
        break;
      case BranchManagerSection.guests:
      case BranchManagerSection.guestDetail:
        addField('phone');
        addField('email');
        addField('id_number');
        break;
      case BranchManagerSection.staff:
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
      case BranchManagerSection.stock:
      case BranchManagerSection.stockAnalytics:
        addField('item_sku');
        addField('current_stock');
        addField('minimum_stock');
        addField('unit');
        break;
      case BranchManagerSection.stockOut:
      case BranchManagerSection.wastage:
        addField('item_name');
        addField('quantity');
        addField('reason');
        addField('created_at');
        break;
      case BranchManagerSection.restaurant:
        addField('table_number');
        addField('waiter_name');
        addField('items_count');
        addField('total_amount');
        addField('status');
        break;
      case BranchManagerSection.waiterSales:
        addField('orders_count');
        addField('total_sales');
        addField('average_order_value');
        break;
      case BranchManagerSection.cashierClearance:
        addField('date');
        addField('expected_amount');
        addField('actual_amount');
        addField('variance');
        addField('status');
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
      case BranchManagerSection.kitchenStock:
        return PhosphorIcons.cookingPot();
      case BranchManagerSection.kitchenRequisitions:
        return PhosphorIcons.clipboardText();
      case BranchManagerSection.kitchenRecipes:
        return PhosphorIcons.notebook();
      case BranchManagerSection.kitchenUsage:
        return PhosphorIcons.chartBar();
      case BranchManagerSection.kitchenWastage:
        return PhosphorIcons.trash();
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
    case BranchManagerSection.kitchenStock:
      return 'Kitchen Stock';
    case BranchManagerSection.kitchenRequisitions:
      return 'Kitchen Requisitions';
    case BranchManagerSection.kitchenRecipes:
      return 'Kitchen Recipes';
    case BranchManagerSection.kitchenUsage:
      return 'Kitchen Usage';
    case BranchManagerSection.kitchenWastage:
      return 'Kitchen Wastage';
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
      return 'Maintenance work-order board with create, update, and status management.';
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
        'created_by_name'
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
        'assigned_to_name',
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
        'reported_by_name',
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
      return const ['room_number', 'room_type', 'floor', 'status'];
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
    case BranchManagerSection.maintenance:
      return const ['title', 'description', 'priority', 'status'];
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
    case BranchManagerSection.maintenance:
      return 'New Request';
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
