import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/api_error_message.dart';
import '../../../core/widgets/master_dashboard_shell.dart';
import '../../../core/widgets/error_state.dart';
import '../../../core/widgets/loading_skeleton.dart';
import '../../../core/widgets/stat_card.dart';
import '../data/repository.dart';
import '../domain/models.dart';
import 'screens/screens.dart';

enum ReceptionSection {
  overview,
  reservations,
  checkInOut,
  rooms,
  guests,
  guestProfile,
  housekeeping,
  conference,
  catering,
  cashier,
  logbook,
  history,
}

class ReceptionDashboard extends ConsumerStatefulWidget {
  const ReceptionDashboard({
    super.key,
    this.initialSection = ReceptionSection.overview,
    this.guestId,
  });

  final ReceptionSection initialSection;
  final String? guestId;

  @override
  ConsumerState<ReceptionDashboard> createState() => _ReceptionDashboardState();
}

class _ReceptionDashboardState extends ConsumerState<ReceptionDashboard> {
  late ReceptionSection _section = widget.initialSection;
  late String? _guestId = widget.guestId;
  late Future<_ReceptionSnapshot> _future;
  final _searchController = TextEditingController();
  String _statusFilter = 'all';
  String _dateFilter = 'all';
  String _roomStatusFilter = 'all';
  String _roomTypeFilter = 'all';
  bool? _checkedInGuestFilter;
  bool _vipOnly = false;

  ReceptionRepository get _repo => ref.read(receptionRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<_ReceptionSnapshot> _load() async {
    Future<T> guard<T>(Future<T> future, T fallback) async {
      try {
        return await future;
      } catch (_) {
        return fallback;
      }
    }

    final bookings =
        await guard(_repo.getBookings(params: {'limit': 250}), <Booking>[]);
    final bookingRows = await guard(
        _repo.getBookingRows(params: {'limit': 250}), <Map<String, dynamic>>[]);
    final rooms = await guard(_repo.getRooms(), <Room>[]);
    final roomRows = await guard(_repo.getRoomRows(), <Map<String, dynamic>>[]);
    final guests =
        await guard(_repo.getGuests(search: _searchController.text), <Guest>[]);
    final guestRows = await guard(
        _repo.getGuestRows(search: _searchController.text),
        <Map<String, dynamic>>[]);
    final hkTasks = await guard(
      _repo.getHousekeepingTasks(params: {'status': 'pending'}),
      <Map<String, dynamic>>[],
    );
    final hkRooms =
        await guard(_repo.getHousekeepingRoomGrid(), <Map<String, dynamic>>[]);
    final conferenceHalls =
        await guard(_repo.getConferenceHalls(), <Map<String, dynamic>>[]);
    final conferenceBookings = await guard(
      _repo.getConferenceBookings(params: {'status': 'confirmed'}),
      <Map<String, dynamic>>[],
    );
    final cateringBookings = await guard(
      _repo.getCateringBookings(params: {'status': 'confirmed'}),
      <Map<String, dynamic>>[],
    );
    final cashierStats =
        await guard(_repo.getCashierStats(), <String, dynamic>{});
    final unpaidBills =
        await guard(_repo.getUnpaidBills(), <Map<String, dynamic>>[]);
    final creditBills =
        await guard(_repo.getCreditBills(), <Map<String, dynamic>>[]);
    final payments =
        await guard(_repo.getCashierPayments(), <Map<String, dynamic>>[]);
    final logbook = await guard(_repo.getLogbookToday(), <String, dynamic>{});
    final guestProfile = _guestId == null
        ? <String, dynamic>{}
        : await guard(_repo.getGuest(_guestId!), <String, dynamic>{});
    final guestHistory = _guestId == null
        ? <Map<String, dynamic>>[]
        : await guard(
            _repo.getGuestHistory(_guestId!), <Map<String, dynamic>>[]);
    final guestLoyalty = _guestId == null
        ? <String, dynamic>{}
        : await guard(_repo.getGuestLoyalty(_guestId!), <String, dynamic>{});

    return _ReceptionSnapshot(
      bookings: bookings,
      bookingRows: bookingRows.isEmpty
          ? bookings.map((b) => b.raw).toList()
          : bookingRows,
      rooms: rooms,
      roomRows: roomRows.isEmpty ? rooms.map((r) => r.raw).toList() : roomRows,
      guests: guests,
      guestRows:
          guestRows.isEmpty ? guests.map((g) => g.raw).toList() : guestRows,
      housekeepingTasks: hkTasks,
      housekeepingRooms: hkRooms,
      conferenceHalls: conferenceHalls,
      conferenceBookings: conferenceBookings,
      cateringBookings: cateringBookings,
      cashierStats: cashierStats,
      unpaidBills: unpaidBills,
      creditBills: creditBills,
      payments: payments,
      logbook: logbook,
      guestProfile: guestProfile,
      guestHistory: guestHistory,
      guestLoyalty: guestLoyalty,
    );
  }

  void _refresh() {
    setState(() {
      _future = _load();
    });
  }

  void _selectSection(ReceptionSection section) {
    if (section == ReceptionSection.cashier) {
      setState(() => _section = section);
      return;
    }
    setState(() {
      _section = section;
      if (section != ReceptionSection.guestProfile) _guestId = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MasterDashboardShell<ReceptionSection>(
      title: 'Reception',
      subtitle: 'Front desk operations',
      initials: 'FD',
      breadcrumbRoot: 'Reception',
      searchHint: 'Search room, guest, booking...',
      currentSection: _section,
      items: const [
        MasterNavItem(
            section: ReceptionSection.overview,
            label: 'Overview',
            icon: Icons.dashboard_outlined,
            group: 'Front Desk'),
        MasterNavItem(
            section: ReceptionSection.reservations,
            label: 'Reservations',
            icon: Icons.calendar_month_outlined,
            group: 'Front Desk'),
        MasterNavItem(
            section: ReceptionSection.checkInOut,
            label: 'Check In / Out',
            icon: Icons.login_outlined,
            group: 'Front Desk'),
        MasterNavItem(
            section: ReceptionSection.rooms,
            label: 'Rooms',
            icon: Icons.bed_outlined,
            group: 'Front Desk'),
        MasterNavItem(
            section: ReceptionSection.guests,
            label: 'Guests',
            icon: Icons.people_alt_outlined,
            group: 'Guest Services'),
        MasterNavItem(
            section: ReceptionSection.housekeeping,
            label: 'Housekeeping',
            icon: Icons.cleaning_services_outlined,
            group: 'Guest Services'),
        MasterNavItem(
            section: ReceptionSection.conference,
            label: 'Conference',
            icon: Icons.corporate_fare_outlined,
            group: 'Events'),
        MasterNavItem(
            section: ReceptionSection.catering,
            label: 'Catering',
            icon: Icons.room_service_outlined,
            group: 'Events'),
        MasterNavItem(
            section: ReceptionSection.cashier,
            label: 'Cashier',
            icon: Icons.point_of_sale_outlined,
            group: 'Cashier'),
        MasterNavItem(
            section: ReceptionSection.logbook,
            label: 'Shift Logbook',
            icon: Icons.fact_check_outlined,
            group: 'Cashier'),
        MasterNavItem(
            section: ReceptionSection.history,
            label: 'History',
            icon: Icons.history_outlined,
            group: 'Audit'),
      ],
      onSectionSelected: _selectSection,
      child: FutureBuilder<_ReceptionSnapshot>(
        key: ValueKey('$_section-$_guestId-${_searchController.text}'),
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting &&
              !snapshot.hasData) {
            return const Padding(
              padding: EdgeInsets.all(24),
              child: LoadingSkeleton(type: SkeletonType.list),
            );
          }
          final data = snapshot.data ?? _ReceptionSnapshot.empty();
          return _sectionChild(data);
        },
      ),
    );
  }

  Widget _sectionChild(_ReceptionSnapshot data) {
    switch (_section) {
      case ReceptionSection.overview:
        return _OverviewSection(
            data: data, onRefresh: _refresh, onAction: _selectSection);
      case ReceptionSection.reservations:
        return _ReservationsSection(
          data: data,
          searchController: _searchController,
          statusFilter: _statusFilter,
          dateFilter: _dateFilter,
          onStatusChanged: (value) => setState(() => _statusFilter = value),
          onDateChanged: (value) => setState(() => _dateFilter = value),
          onSearch: _refresh,
          onRefresh: _refresh,
        );
      case ReceptionSection.checkInOut:
        return _CheckInOutSection(data: data, onRefresh: _refresh);
      case ReceptionSection.rooms:
        return _RoomsSection(
          data: data,
          searchController: _searchController,
          statusFilter: _roomStatusFilter,
          typeFilter: _roomTypeFilter,
          onStatusChanged: (value) => setState(() => _roomStatusFilter = value),
          onTypeChanged: (value) => setState(() => _roomTypeFilter = value),
          onRefresh: _refresh,
        );
      case ReceptionSection.guests:
        return _GuestsSection(
          data: data,
          searchController: _searchController,
          checkedInFilter: _checkedInGuestFilter,
          vipOnly: _vipOnly,
          onSearch: _refresh,
          onRefresh: _refresh,
          onCheckedInChanged: (value) =>
              setState(() => _checkedInGuestFilter = value),
          onVipChanged: (value) => setState(() => _vipOnly = value),
          onOpenProfile: (id) {
            setState(() {
              _guestId = id;
              _section = ReceptionSection.guestProfile;
              _future = _load();
            });
          },
        );
      case ReceptionSection.guestProfile:
        return _GuestProfileSection(
          data: data,
          onBack: () => setState(() => _section = ReceptionSection.guests),
          onRefresh: _refresh,
        );
      case ReceptionSection.housekeeping:
        return _HousekeepingSection(data: data, onRefresh: _refresh);
      case ReceptionSection.conference:
        return _ConferenceSection(data: data, onRefresh: _refresh);
      case ReceptionSection.catering:
        return _CateringSection(data: data, onRefresh: _refresh);
      case ReceptionSection.cashier:
        return _CashierSection(data: data, onRefresh: _refresh);
      case ReceptionSection.logbook:
        return _LogbookSection(data: data, onRefresh: _refresh);
      case ReceptionSection.history:
        return _HistorySection(data: data, onRefresh: _refresh);
    }
  }

  // ── Navigation helpers for new screens ──────────────────────────────────────

  Future<void> navigateToCreateReservation() async {
    final result = await Navigator.of(context).push<Booking>(
      MaterialPageRoute(builder: (_) => const CreateReservationScreen()),
    );
    if (result != null && mounted) {
      setState(() {
        _future = _load();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text('Reservation created: ${result.confirmationNumber}')),
      );
    }
  }

  Future<void> navigateToCheckIn([Booking? booking]) async {
    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => CheckInScreen(booking: booking)),
    );
    if (result == true && mounted) {
      setState(() {
        _future = _load();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Guest checked in successfully')),
      );
    }
  }

  Future<void> navigateToCheckOut([Booking? booking]) async {
    final result = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => CheckOutScreen(booking: booking)),
    );
    if (result == true && mounted) {
      setState(() {
        _future = _load();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Guest checked out successfully')),
      );
    }
  }

  Future<void> navigateToGuestManagement() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const GuestManagementScreen()),
    );
    if (mounted) {
      setState(() {
        _future = _load();
      });
    }
  }

  Future<void> navigateToRoomManagement() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const RoomManagementScreen()),
    );
    if (mounted) {
      setState(() {
        _future = _load();
      });
    }
  }

  Future<void> navigateToHousekeeping() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const HousekeepingScreen()),
    );
    if (mounted) {
      setState(() {
        _future = _load();
      });
    }
  }
}

class _OverviewSection extends ConsumerWidget {
  const _OverviewSection({
    required this.data,
    required this.onRefresh,
    required this.onAction,
  });

  final _ReceptionSnapshot data;
  final VoidCallback onRefresh;
  final ValueChanged<ReceptionSection> onAction;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final today = DateTime.now();
    final arrivals = data.bookings
        .where((b) => b.status == 'confirmed' && _sameDay(b.checkIn, today))
        .toList();
    final departures = data.bookings
        .where((b) => b.status == 'checked_in' && _sameDay(b.checkOut, today))
        .toList();
    final available = data.rooms.where((r) => r.status == 'available').length;
    final occupied = data.rooms.where((r) => r.status == 'occupied').length;

    return _PageScaffold(
      title: 'Front Desk Dashboard',
      subtitle: DateFormat('EEEE, MMMM d • HH:mm').format(DateTime.now()),
      actions: [
        OutlinedButton.icon(
          onPressed: () => _showAttendanceDialog(context, ref),
          icon: const Icon(Icons.schedule, size: 16),
          label: const Text('Attendance'),
        ),
        OutlinedButton.icon(
          onPressed: () => _showPettyCashDialog(context, ref),
          icon: const Icon(Icons.account_balance_wallet_outlined, size: 16),
          label: const Text('Petty Cash'),
        ),
        ElevatedButton.icon(
          onPressed: () => _showNewReservationDialog(context, ref, onRefresh),
          icon: const Icon(Icons.add, size: 16),
          label: const Text('New Booking'),
        ),
      ],
      child: Column(
        children: [
          _StatGrid(cards: [
            _StatData('Available Rooms', '$available', Icons.bed_outlined,
                AppColors.kSuccess),
            _StatData('Occupied Rooms', '$occupied',
                Icons.person_pin_circle_outlined, Colors.blue),
            _StatData('Today Arrivals', '${arrivals.length}',
                Icons.login_outlined, AppColors.kWarning),
            _StatData('Today Departures', '${departures.length}',
                Icons.logout_outlined, AppColors.kError),
          ]),
          const SizedBox(height: 20),
          _OperationsPulseSection(data: data, onAction: onAction),
          const SizedBox(height: 20),
          _ResponsivePair(
            leftFlex: 2,
            left: _CardPanel(
              title: 'Room Status',
              action: TextButton(
                onPressed: () => onAction(ReceptionSection.rooms),
                child: const Text('View all rooms'),
              ),
              child: _RoomsTable(rooms: data.rooms.take(10).toList()),
            ),
            right: Column(
              children: [
                _BookingMiniList(
                  title: "Today's Arrivals",
                  bookings: arrivals.take(5).toList(),
                  empty: 'No arrivals today',
                  actionLabel: 'Check in',
                  onOpen: () => onAction(ReceptionSection.checkInOut),
                ),
                const SizedBox(height: 16),
                _BookingMiniList(
                  title: "Today's Departures",
                  bookings: departures.take(5).toList(),
                  empty: 'No departures today',
                  actionLabel: 'Check out',
                  onOpen: () => onAction(ReceptionSection.checkInOut),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _ResponsivePair(
            left: _CardPanel(
              title: 'Conference & Catering',
              action: TextButton(
                onPressed: () => onAction(ReceptionSection.conference),
                child: const Text('Events'),
              ),
              child: _KeyValueList(rows: [
                {
                  'label': 'Active conference bookings',
                  'value': '${data.conferenceBookings.length}'
                },
                {
                  'label': 'Available halls',
                  'value': '${data.conferenceHalls.where((h) => _text(h, [
                            'status'
                          ]) == 'available').length}'
                },
                {
                  'label': 'Catering bookings',
                  'value': '${data.cateringBookings.length}'
                },
              ]),
            ),
            right: _CardPanel(
              title: 'Cashier Snapshot',
              action: TextButton(
                onPressed: () => onAction(ReceptionSection.cashier),
                child: const Text('Open cashier'),
              ),
              child: _KeyValueList(rows: [
                {
                  'label': "Today's revenue",
                  'value': _money(_num(data.cashierStats,
                      ['today_payments', 'todayRevenue', 'today_collections']))
                },
                {
                  'label': 'Unconfirmed bills',
                  'value': '${data.unpaidBills.length}'
                },
                {
                  'label': 'Credit bills',
                  'value': '${data.creditBills.length}'
                },
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReservationsSection extends ConsumerWidget {
  const _ReservationsSection({
    required this.data,
    required this.searchController,
    required this.statusFilter,
    required this.dateFilter,
    required this.onStatusChanged,
    required this.onDateChanged,
    required this.onSearch,
    required this.onRefresh,
  });

  final _ReceptionSnapshot data;
  final TextEditingController searchController;
  final String statusFilter;
  final String dateFilter;
  final ValueChanged<String> onStatusChanged;
  final ValueChanged<String> onDateChanged;
  final VoidCallback onSearch;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now();
    final rows = data.bookings.where((booking) {
      final query = searchController.text.toLowerCase();
      final matchesSearch = query.isEmpty ||
          (booking.guestName ?? '').toLowerCase().contains(query) ||
          (booking.roomNumber ?? '').toLowerCase().contains(query) ||
          (booking.confirmationNumber ?? booking.id)
              .toLowerCase()
              .contains(query);
      final matchesStatus =
          statusFilter == 'all' || booking.status == statusFilter;
      final matchesDate = switch (dateFilter) {
        'today' => _sameDay(booking.checkIn, now),
        'week' => booking.checkIn.isBefore(now.add(const Duration(days: 7))) &&
            booking.checkIn.isAfter(now.subtract(const Duration(days: 1))),
        'future' => booking.checkIn.isAfter(now),
        _ => true,
      };
      return matchesSearch && matchesStatus && matchesDate;
    }).toList();

    return _PageScaffold(
      title: 'Reservations',
      subtitle:
          'Create, edit, cancel, check in, check out and hand off folios.',
      actions: [
        OutlinedButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Refresh')),
        ElevatedButton.icon(
          onPressed: () => _showNewReservationDialog(context, ref, onRefresh),
          icon: const Icon(Icons.add, size: 16),
          label: const Text('New Reservation'),
        ),
        OutlinedButton.icon(
          onPressed: () async {
            final result = await Navigator.of(context).push<Booking>(
              MaterialPageRoute(
                  builder: (_) => const CreateReservationScreen()),
            );
            if (result != null && context.mounted) onRefresh();
          },
          icon: const Icon(Icons.open_in_new, size: 16),
          label: const Text('Full Screen'),
        ),
      ],
      child: Column(
        children: [
          _FilterBar(
            searchController: searchController,
            searchHint: 'Search guest, room or reference',
            onSearch: onSearch,
            filters: [
              _FilterMenu(
                  value: statusFilter,
                  label: 'Status',
                  values: const [
                    'all',
                    'pending',
                    'confirmed',
                    'checked_in',
                    'checked_out',
                    'cancelled'
                  ],
                  onChanged: onStatusChanged),
              _FilterMenu(
                  value: dateFilter,
                  label: 'Date',
                  values: const ['all', 'today', 'week', 'future'],
                  onChanged: onDateChanged),
            ],
          ),
          const SizedBox(height: 16),
          _StatGrid(cards: [
            _StatData('Total', '${rows.length}', Icons.calendar_month,
                AppColors.kPrimary),
            _StatData(
                'Confirmed',
                '${rows.where((b) => b.status == 'confirmed').length}',
                Icons.check_circle_outline,
                AppColors.kSuccess),
            _StatData(
                'Checked In',
                '${rows.where((b) => b.status == 'checked_in').length}',
                Icons.login,
                Colors.blue),
            _StatData(
                'Cancelled',
                '${rows.where((b) => b.status == 'cancelled').length}',
                Icons.cancel_outlined,
                AppColors.kError),
          ]),
          const SizedBox(height: 16),
          _CardPanel(
            title: 'Reservation Ledger',
            child: rows.isEmpty
                ? const EmptyState(message: 'No reservations found')
                : _HorizontalTable(
                    columns: const [
                      'Ref',
                      'Guest',
                      'Room',
                      'Dates',
                      'Status',
                      'Balance',
                      'Actions'
                    ],
                    rows: rows
                        .map((b) => [
                              Text((b.confirmationNumber ?? b.id).replaceRange(
                                  8.clamp(
                                      0, (b.confirmationNumber ?? b.id).length),
                                  null,
                                  '')),
                              _TwoLine(
                                  title: b.guestName ?? 'Walk-in',
                                  subtitle: b.guestPhone ?? ''),
                              Text(
                                  'Room ${b.roomNumber ?? '-'}\n${b.roomType ?? ''}'),
                              Text('${_date(b.checkIn)}\n${_date(b.checkOut)}'),
                              _StatusPill(b.status),
                              Text(_money(b.balance)),
                              Wrap(spacing: 6, runSpacing: 6, children: [
                                _SmallAction(
                                    'Edit',
                                    Icons.edit_outlined,
                                    () => _showEditBookingDialog(
                                        context, ref, b, onRefresh)),
                                if (b.status == 'confirmed')
                                  _SmallAction(
                                      'Check in',
                                      Icons.login,
                                      () =>
                                          _checkIn(context, ref, b, onRefresh)),
                                if (b.status == 'checked_in')
                                  _SmallAction(
                                      'Check out',
                                      Icons.logout,
                                      () => _showCheckoutDialog(
                                          context, ref, b, onRefresh)),
                                _SmallAction(
                                    'Folio',
                                    Icons.receipt_long_outlined,
                                    () => _showFolioDialog(context, b)),
                                if (b.status != 'cancelled' &&
                                    b.status != 'checked_out')
                                  _SmallAction(
                                      'Cancel',
                                      Icons.cancel_outlined,
                                      () => _cancelBooking(
                                          context, ref, b, onRefresh),
                                      danger: true),
                              ]),
                            ])
                        .toList(),
                  ),
          ),
        ],
      ),
    );
  }
}

class _CheckInOutSection extends ConsumerStatefulWidget {
  const _CheckInOutSection({required this.data, required this.onRefresh});

  final _ReceptionSnapshot data;
  final VoidCallback onRefresh;

  @override
  ConsumerState<_CheckInOutSection> createState() => _CheckInOutSectionState();
}

class _CheckInOutSectionState extends ConsumerState<_CheckInOutSection> {
  String _tab = 'checkin';
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final today = DateTime.now();
    final source = widget.data.bookings.where((booking) {
      if (_tab == 'checkin') {
        return booking.status == 'confirmed' &&
            !_sameDay(
                booking.checkOut, today.subtract(const Duration(days: 1)));
      }
      return booking.status == 'checked_in';
    }).where((booking) {
      final query = _search.text.toLowerCase();
      return query.isEmpty ||
          (booking.guestName ?? '').toLowerCase().contains(query) ||
          (booking.roomNumber ?? '').toLowerCase().contains(query);
    }).toList();

    return _PageScaffold(
      title: 'Check In / Check Out',
      subtitle:
          'Run arrivals, departures, checkout bill printing and cashier handoff.',
      actions: [
        OutlinedButton.icon(
          onPressed: widget.onRefresh,
          icon: const Icon(Icons.refresh, size: 16),
          label: const Text('Refresh'),
        ),
        ElevatedButton.icon(
          onPressed: () async {
            final ok = await Navigator.of(context).push<bool>(
              MaterialPageRoute(builder: (_) => const CheckInScreen()),
            );
            if (ok == true && context.mounted) widget.onRefresh();
          },
          icon: const Icon(Icons.login, size: 16),
          label: const Text('Check In'),
        ),
        ElevatedButton.icon(
          onPressed: () async {
            final ok = await Navigator.of(context).push<bool>(
              MaterialPageRoute(builder: (_) => const CheckOutScreen()),
            );
            if (ok == true && context.mounted) widget.onRefresh();
          },
          icon: const Icon(Icons.logout, size: 16),
          label: const Text('Check Out'),
        ),
      ],
      child: Column(
        children: [
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(
                  value: 'checkin',
                  label: Text('Check-in Queue'),
                  icon: Icon(Icons.login)),
              ButtonSegment(
                  value: 'checkout',
                  label: Text('Check-out Queue'),
                  icon: Icon(Icons.logout)),
            ],
            selected: {_tab},
            onSelectionChanged: (value) => setState(() => _tab = value.first),
          ),
          const SizedBox(height: 16),
          _SearchField(
              controller: _search,
              hint: 'Search guest or room',
              onSubmitted: (_) => setState(() {})),
          const SizedBox(height: 16),
          _CardPanel(
            title: _tab == 'checkin' ? 'Arrivals' : 'Departures',
            child: source.isEmpty
                ? EmptyState(
                    message: _tab == 'checkin'
                        ? 'No confirmed bookings to check in'
                        : 'No checked-in guests to check out')
                : _RecordList(
                    rows: source.map((b) {
                      return _RecordTileData(
                        title: b.guestName ?? 'Guest',
                        subtitle:
                            'Room ${b.roomNumber ?? '-'} • ${_date(b.checkIn)} to ${_date(b.checkOut)}',
                        trailing: _StatusPill(b.status),
                        actions: [
                          if (_tab == 'checkin')
                            _SmallAction(
                                'Check in',
                                Icons.login,
                                () => _checkIn(
                                    context, ref, b, widget.onRefresh)),
                          if (_tab == 'checkout')
                            _SmallAction(
                                'Check out',
                                Icons.logout,
                                () => _showCheckoutDialog(
                                    context, ref, b, widget.onRefresh)),
                          if (_tab == 'checkout')
                            _SmallAction('Print bill', Icons.print_outlined,
                                () => _downloadCheckoutBill(context, ref, b)),
                        ],
                      );
                    }).toList(),
                  ),
          ),
        ],
      ),
    );
  }
}

class _RoomsSection extends ConsumerWidget {
  const _RoomsSection({
    required this.data,
    required this.searchController,
    required this.statusFilter,
    required this.typeFilter,
    required this.onStatusChanged,
    required this.onTypeChanged,
    required this.onRefresh,
  });

  final _ReceptionSnapshot data;
  final TextEditingController searchController;
  final String statusFilter;
  final String typeFilter;
  final ValueChanged<String> onStatusChanged;
  final ValueChanged<String> onTypeChanged;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final types = data.rooms.map((r) => r.type ?? 'standard').toSet().toList()
      ..sort();
    final rooms = data.rooms.where((room) {
      final query = searchController.text.toLowerCase();
      return (query.isEmpty ||
              '${room.number}'.contains(query) ||
              (room.guestName ?? '').toLowerCase().contains(query)) &&
          (statusFilter == 'all' || room.status == statusFilter) &&
          (typeFilter == 'all' || room.type == typeFilter);
    }).toList();

    return _PageScaffold(
      title: 'Rooms',
      subtitle:
          'Room status board, quick check-in, status changes and active booking checkout.',
      actions: [
        OutlinedButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Refresh')),
      ],
      child: Column(
        children: [
          _FilterBar(
            searchController: searchController,
            searchHint: 'Search room or guest',
            onSearch: onRefresh,
            filters: [
              _FilterMenu(
                  value: statusFilter,
                  label: 'Status',
                  values: const [
                    'all',
                    'available',
                    'occupied',
                    'reserved',
                    'cleaning',
                    'dirty',
                    'maintenance'
                  ],
                  onChanged: onStatusChanged),
              _FilterMenu(
                  value: typeFilter,
                  label: 'Type',
                  values: ['all', ...types],
                  onChanged: onTypeChanged),
            ],
          ),
          const SizedBox(height: 16),
          _StatGrid(cards: [
            _StatData(
                'Available',
                '${data.rooms.where((r) => r.status == 'available').length}',
                Icons.check_circle_outline,
                AppColors.kSuccess),
            _StatData(
                'Occupied',
                '${data.rooms.where((r) => r.status == 'occupied').length}',
                Icons.person,
                Colors.blue),
            _StatData(
                'Cleaning',
                '${data.rooms.where((r) => r.status == 'cleaning' || r.status == 'dirty').length}',
                Icons.cleaning_services,
                AppColors.kWarning),
            _StatData(
                'Maintenance',
                '${data.rooms.where((r) => r.status == 'maintenance').length}',
                Icons.build,
                AppColors.kError),
          ]),
          const SizedBox(height: 16),
          rooms.isEmpty
              ? const EmptyState(message: 'No rooms found')
              : LayoutBuilder(
                  builder: (context, constraints) {
                    final width = constraints.maxWidth;
                    final crossAxisCount = width > 1200
                        ? 6
                        : width > 900
                            ? 4
                            : width > 600
                                ? 3
                                : 2;
                    return GridView.builder(
                      itemCount: rooms.length,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: crossAxisCount,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                        childAspectRatio: 1.25,
                      ),
                      itemBuilder: (context, index) {
                        final room = rooms[index];
                        return _RoomCard(
                          room: room,
                          onQuickCheckIn: room.status == 'available'
                              ? () => _showQuickCheckInDialog(
                                  context, ref, room, onRefresh)
                              : null,
                          onStatus: (status) async {
                            await ref
                                .read(receptionRepositoryProvider)
                                .updateRoomStatus(room.id, status);
                            if (!context.mounted) return;
                            onRefresh();
                            _snack(
                                context, 'Room ${room.number} marked $status');
                          },
                          onCheckout: room.status == 'occupied'
                              ? () =>
                                  _checkoutRoom(context, ref, room, onRefresh)
                              : null,
                        );
                      },
                    );
                  },
                ),
        ],
      ),
    );
  }
}

class _GuestsSection extends ConsumerWidget {
  const _GuestsSection({
    required this.data,
    required this.searchController,
    required this.checkedInFilter,
    required this.vipOnly,
    required this.onSearch,
    required this.onRefresh,
    required this.onCheckedInChanged,
    required this.onVipChanged,
    required this.onOpenProfile,
  });

  final _ReceptionSnapshot data;
  final TextEditingController searchController;
  final bool? checkedInFilter;
  final bool vipOnly;
  final VoidCallback onSearch;
  final VoidCallback onRefresh;
  final ValueChanged<bool?> onCheckedInChanged;
  final ValueChanged<bool> onVipChanged;
  final ValueChanged<String> onOpenProfile;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activeGuestIds = data.bookings
        .where((b) => b.status == 'checked_in' && b.guestId != null)
        .map((b) => b.guestId)
        .toSet();
    final guests = data.guests.where((guest) {
      final checkedIn = activeGuestIds.contains(guest.id);
      return (checkedInFilter == null || checkedInFilter == checkedIn) &&
          (!vipOnly || guest.isVip);
    }).toList();

    return _PageScaffold(
      title: 'Guests',
      subtitle:
          'Register guests, update profiles, view stay history and VIP/current-stay filters.',
      actions: [
        OutlinedButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Refresh')),
        ElevatedButton.icon(
          onPressed: () => _showGuestFormDialog(context, ref, null, onRefresh),
          icon: const Icon(Icons.person_add_alt_1, size: 16),
          label: const Text('New Guest'),
        ),
      ],
      child: Column(
        children: [
          _FilterBar(
            searchController: searchController,
            searchHint: 'Search guests by name, phone, email',
            onSearch: onSearch,
            filters: [
              _InlineChoice(
                  label: 'All',
                  selected: checkedInFilter == null,
                  onTap: () => onCheckedInChanged(null)),
              _InlineChoice(
                  label: 'Checked in',
                  selected: checkedInFilter == true,
                  onTap: () => onCheckedInChanged(true)),
              _InlineChoice(
                  label: 'VIP',
                  selected: vipOnly,
                  onTap: () => onVipChanged(!vipOnly)),
            ],
          ),
          const SizedBox(height: 16),
          _CardPanel(
            title: 'Guest Directory',
            child: guests.isEmpty
                ? const EmptyState(message: 'No guests found')
                : _RecordList(
                    rows: guests.map((guest) {
                      final activeBooking = data.bookings
                          .where((b) =>
                              b.guestId == guest.id && b.status == 'checked_in')
                          .firstOrNull;
                      return _RecordTileData(
                        title: guest.name.isEmpty ? 'Guest' : guest.name,
                        subtitle:
                            '${guest.email ?? '-'} • ${guest.phone ?? '-'}${activeBooking == null ? '' : ' • Room ${activeBooking.roomNumber}'}',
                        leading: CircleAvatar(
                            child: Text(
                                (guest.name.isNotEmpty ? guest.name[0] : '?')
                                    .toUpperCase())),
                        trailing: activeBooking == null
                            ? (guest.isVip ? const _StatusPill('vip') : null)
                            : const _StatusPill('checked_in'),
                        actions: [
                          _SmallAction('Profile', Icons.visibility_outlined,
                              () => onOpenProfile(guest.id)),
                          _SmallAction(
                              'Edit',
                              Icons.edit_outlined,
                              () => _showGuestFormDialog(
                                  context, ref, guest, onRefresh)),
                          _SmallAction(
                              'Delete',
                              Icons.delete_outline,
                              () =>
                                  _deleteGuest(context, ref, guest, onRefresh),
                              danger: true),
                        ],
                      );
                    }).toList(),
                  ),
          ),
        ],
      ),
    );
  }
}

class _GuestProfileSection extends StatelessWidget {
  const _GuestProfileSection({
    required this.data,
    required this.onBack,
    required this.onRefresh,
  });

  final _ReceptionSnapshot data;
  final VoidCallback onBack;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final guest = data.guestProfile;
    final loyalty = data.guestLoyalty;
    return _PageScaffold(
      title: _text(guest, ['name', 'full_name']) ?? 'Guest Profile',
      subtitle: 'Guest identity, loyalty tier, documents and stay history.',
      actions: [
        OutlinedButton.icon(
            onPressed: onBack,
            icon: const Icon(Icons.arrow_back, size: 16),
            label: const Text('Back')),
        OutlinedButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Refresh')),
      ],
      child: Column(
        children: [
          _ResponsivePair(
            left: _CardPanel(
              title: 'Profile',
              child: _KeyValueList(rows: [
                {
                  'label': 'Name',
                  'value': _text(guest, ['name', 'full_name']) ?? '-'
                },
                {
                  'label': 'Email',
                  'value': _text(guest, ['email']) ?? '-'
                },
                {
                  'label': 'Phone',
                  'value': _text(guest, ['phone']) ?? '-'
                },
                {
                  'label': 'ID / Passport',
                  'value': _text(guest, ['id_number', 'passport_number']) ?? '-'
                },
              ]),
            ),
            right: _CardPanel(
              title: 'Loyalty',
              child: _KeyValueList(rows: [
                {
                  'label': 'Tier',
                  'value': _text(loyalty, ['tier', 'loyalty_tier']) ?? 'Bronze'
                },
                {
                  'label': 'Points',
                  'value': '${_num(loyalty, ['points', 'loyalty_points'])}'
                },
                {
                  'label': 'Total stays',
                  'value': '${_num(loyalty, ['total_stays', 'visits'])}'
                },
                {
                  'label': 'Total spend',
                  'value':
                      _money(_num(loyalty, ['total_spend', 'lifetime_value']))
                },
              ]),
            ),
          ),
          const SizedBox(height: 16),
          _CardPanel(
            title: 'Stay History',
            child: data.guestHistory.isEmpty
                ? const EmptyState(message: 'No stay history found')
                : _SimpleRows(
                    rows: data.guestHistory,
                    fields: const [
                      'booking_number',
                      'room_number',
                      'check_in',
                      'check_out',
                      'status',
                      'total_amount'
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _HousekeepingSection extends ConsumerStatefulWidget {
  const _HousekeepingSection({required this.data, required this.onRefresh});
  final _ReceptionSnapshot data;
  final VoidCallback onRefresh;

  @override
  ConsumerState<_HousekeepingSection> createState() =>
      _HousekeepingSectionState();
}

class _HousekeepingSectionState extends ConsumerState<_HousekeepingSection> {
  String _tab = 'requests';

  @override
  Widget build(BuildContext context) {
    final dirty = widget.data.housekeepingRooms
        .where((r) => ['dirty', 'cleaning'].contains(_text(r, ['status'])))
        .length;
    return _PageScaffold(
      title: 'Housekeeping',
      subtitle:
          'Pending requests, room readiness grid and reception cleaning requests.',
      actions: [
        OutlinedButton.icon(
            onPressed: widget.onRefresh,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Refresh')),
      ],
      child: Column(
        children: [
          _StatGrid(cards: [
            _StatData(
                'Pending Tasks',
                '${widget.data.housekeepingTasks.length}',
                Icons.pending_actions,
                AppColors.kWarning),
            _StatData('Rooms Needing Attention', '$dirty',
                Icons.cleaning_services, AppColors.kError),
            _StatData(
                'Ready Rooms',
                '${widget.data.housekeepingRooms.where((r) => _text(r, [
                          'status'
                        ]) == 'clean').length}',
                Icons.verified,
                AppColors.kSuccess),
            _StatData(
                'DND / Occupied',
                '${widget.data.housekeepingRooms.where((r) => _text(r, [
                          'status'
                        ]) == 'occupied').length}',
                Icons.hotel,
                Colors.blue),
          ]),
          const SizedBox(height: 16),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(
                  value: 'requests',
                  label: Text('Requests'),
                  icon: Icon(Icons.list_alt)),
              ButtonSegment(
                  value: 'status',
                  label: Text('Room Grid'),
                  icon: Icon(Icons.grid_view)),
            ],
            selected: {_tab},
            onSelectionChanged: (value) => setState(() => _tab = value.first),
          ),
          const SizedBox(height: 16),
          if (_tab == 'requests')
            _CardPanel(
              title: 'Pending Housekeeping Requests',
              child: widget.data.housekeepingTasks.isEmpty
                  ? const EmptyState(message: 'No pending housekeeping tasks')
                  : _RecordList(
                      rows: widget.data.housekeepingTasks.map((task) {
                        return _RecordTileData(
                          title: _text(task,
                                  ['title', 'task_type', 'description']) ??
                              'Housekeeping task',
                          subtitle: 'Room ${_text(task, [
                                    'room_number',
                                    'room'
                                  ]) ?? '-'} • ${_text(task, ['priority']) ?? 'normal'}',
                          trailing:
                              _StatusPill(_text(task, ['status']) ?? 'pending'),
                          actions: [
                            _SmallAction(
                                'In progress',
                                Icons.play_arrow,
                                () => _updateTask(
                                    context, ref, task, 'in_progress')),
                            _SmallAction(
                                'Complete',
                                Icons.check,
                                () => _updateTask(
                                    context, ref, task, 'completed')),
                          ],
                        );
                      }).toList(),
                    ),
            )
          else
            _HousekeepingRoomGrid(
              rooms: widget.data.housekeepingRooms,
              onRequestCleaning: (room) => _requestCleaning(context, ref, room),
            ),
        ],
      ),
    );
  }

  Future<void> _updateTask(BuildContext context, WidgetRef ref,
      Map<String, dynamic> task, String status) async {
    final id = _text(task, ['id']);
    if (id == null) return;
    await ref
        .read(receptionRepositoryProvider)
        .updateHousekeepingTaskStatus(id, status);
    if (!context.mounted) return;
    widget.onRefresh();
    _snack(context, 'Task marked $status');
  }

  Future<void> _requestCleaning(
      BuildContext context, WidgetRef ref, Map<String, dynamic> room) async {
    await ref.read(receptionRepositoryProvider).createHousekeepingGuestRequest({
      'room_number': _text(room, ['room_number', 'number']),
      'request_type': 'cleaning',
      'priority': 'normal',
      'description': 'Reception requested room cleaning',
    });
    if (!context.mounted) return;
    widget.onRefresh();
    _snack(context, 'Cleaning request sent');
  }
}

class _ConferenceSection extends ConsumerWidget {
  const _ConferenceSection({required this.data, required this.onRefresh});
  final _ReceptionSnapshot data;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _PageScaffold(
      title: 'Conference Halls & Bookings',
      subtitle:
          'Hall availability, conference bookings, payment status and invoice handoff.',
      actions: [
        OutlinedButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Refresh')),
        ElevatedButton.icon(
          onPressed: () => _showConferenceBookingDialog(
              context, ref, data.conferenceHalls, onRefresh),
          icon: const Icon(Icons.add, size: 16),
          label: const Text('Book Conference Hall'),
        ),
      ],
      child: _ResponsivePair(
        left: _CardPanel(
          title: 'Available Halls',
          child: data.conferenceHalls.isEmpty
              ? const EmptyState(message: 'No conference halls found')
              : _RecordList(
                  rows: data.conferenceHalls.map((hall) {
                    final id = _text(hall, ['id']);
                    return _RecordTileData(
                      title: _text(hall, ['name']) ?? 'Conference hall',
                      subtitle: 'Capacity ${_text(hall, [
                                'capacity'
                              ]) ?? '-'} • ${_money(_num(hall, [
                            'base_price_per_day',
                            'rate'
                          ]))}/day',
                      trailing:
                          _StatusPill(_text(hall, ['status']) ?? 'available'),
                      actions: [
                        for (final status in const [
                          'available',
                          'occupied',
                          'maintenance'
                        ])
                          _SmallAction(
                              status,
                              Icons.flag_outlined,
                              id == null
                                  ? null
                                  : () async {
                                      await ref
                                          .read(receptionRepositoryProvider)
                                          .updateConferenceHall(
                                              id, {'status': status});
                                      if (!context.mounted) return;
                                      onRefresh();
                                      _snack(context, 'Hall status updated');
                                    }),
                      ],
                    );
                  }).toList(),
                ),
        ),
        leftFlex: 1,
        right: _CardPanel(
          title: 'Active & Upcoming Bookings',
          child: data.conferenceBookings.isEmpty
              ? const EmptyState(message: 'No conference bookings found')
              : _SimpleRows(
                  rows: data.conferenceBookings,
                  fields: const [
                    'invoice_number',
                    'company_name',
                    'hall.name',
                    'num_participants',
                    'start_date',
                    'payment_status',
                    'total_amount'
                  ],
                  actionsBuilder: (booking) {
                    final id = _text(booking, ['id']);
                    final invoice = _text(booking, ['invoice_number']);
                    return Wrap(spacing: 6, children: [
                      _SmallAction(
                          'PDF',
                          Icons.download,
                          id == null
                              ? null
                              : () =>
                                  _downloadConferenceInvoice(context, ref, id)),
                      _SmallAction(
                          'Pay',
                          Icons.point_of_sale,
                          invoice == null
                              ? null
                              : () => context.go('/cashier?invoice=$invoice')),
                      _SmallAction(
                          'Add payment',
                          Icons.payments,
                          id == null
                              ? null
                              : () => _showAmountDialog(
                                      context, 'Conference payment',
                                      (amount, method) async {
                                    await ref
                                        .read(receptionRepositoryProvider)
                                        .addConferencePayment(id, {
                                      'payment_amount': amount,
                                      'payment_method': method,
                                      'payment_reference':
                                          '$method-${DateTime.now().millisecondsSinceEpoch}',
                                    });
                                    onRefresh();
                                  }, withMethod: true)),
                    ]);
                  },
                ),
        ),
      ),
    );
  }
}

class _CateringSection extends ConsumerWidget {
  const _CateringSection({required this.data, required this.onRefresh});
  final _ReceptionSnapshot data;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _PageScaffold(
      title: 'Outside Catering Bookings',
      subtitle:
          'Create outside catering events, record payments and cancel bookings.',
      actions: [
        OutlinedButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Refresh')),
        ElevatedButton.icon(
          onPressed: () => _showCateringDialog(context, ref, onRefresh),
          icon: const Icon(Icons.add, size: 16),
          label: const Text('Book Catering Event'),
        ),
      ],
      child: _CardPanel(
        title: 'Catering Ledger',
        child: data.cateringBookings.isEmpty
            ? const EmptyState(message: 'No catering bookings found')
            : _SimpleRows(
                rows: data.cateringBookings,
                fields: const [
                  'customer_name',
                  'customer_phone',
                  'event_location',
                  'event_date',
                  'guest_count',
                  'status',
                  'total_amount'
                ],
                actionsBuilder: (booking) {
                  final id = _text(booking, ['id']);
                  return Wrap(spacing: 6, children: [
                    _SmallAction(
                        'Payment',
                        Icons.payments,
                        id == null
                            ? null
                            : () =>
                                _showAmountDialog(context, 'Catering payment',
                                    (amount, method) async {
                                  await ref
                                      .read(receptionRepositoryProvider)
                                      .recordCateringPayment(id, amount);
                                  onRefresh();
                                })),
                    _SmallAction(
                        'Cancel',
                        Icons.cancel_outlined,
                        id == null
                            ? null
                            : () async {
                                await ref
                                    .read(receptionRepositoryProvider)
                                    .cancelCateringBooking(id);
                                if (!context.mounted) return;
                                onRefresh();
                                _snack(context, 'Catering booking cancelled');
                              },
                        danger: true),
                  ]);
                },
              ),
      ),
    );
  }
}

class _CashierSection extends ConsumerWidget {
  const _CashierSection({required this.data, required this.onRefresh});
  final _ReceptionSnapshot data;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _PageScaffold(
      title: 'Reception Cashier',
      subtitle:
          'Same cashier station access exposed inside the reception dashboard.',
      actions: [
        OutlinedButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Refresh')),
        ElevatedButton.icon(
          onPressed: () => context.go('/cashier'),
          icon: const Icon(Icons.open_in_new, size: 16),
          label: const Text('Open Full Cashier Station'),
        ),
        ElevatedButton.icon(
          onPressed: () => _showDynamicBillDialog(context, ref, onRefresh),
          icon: const Icon(Icons.add, size: 16),
          label: const Text('Dynamic Bill'),
        ),
      ],
      child: Column(
        children: [
          _StatGrid(cards: [
            _StatData(
                "Today's Revenue",
                _money(_num(data.cashierStats,
                    ['today_payments', 'todayRevenue', 'today_collections'])),
                Icons.payments_outlined,
                AppColors.kSuccess),
            _StatData('Pending Confirmation', '${data.unpaidBills.length}',
                Icons.verified_outlined, AppColors.kWarning),
            _StatData(
                'Active Credit Bills',
                '${data.creditBills.where((b) => _text(b, [
                          'status'
                        ]) != 'paid').length}',
                Icons.credit_score_outlined,
                AppColors.kError),
            _StatData('Payments', '${data.payments.length}',
                Icons.receipt_long_outlined, AppColors.kPrimary),
          ]),
          const SizedBox(height: 16),
          _ResponsivePair(
            left: _CardPanel(
              title: 'Unconfirmed Bills',
              child: _BillsList(
                  bills: data.unpaidBills,
                  onPay: (bill) => _openCashierForBill(context, bill)),
            ),
            right: _CardPanel(
              title: 'Recent Credit Bills',
              child: _BillsList(
                  bills: data.creditBills.take(10).toList(),
                  onPay: (bill) => _openCashierForBill(context, bill)),
            ),
          ),
        ],
      ),
    );
  }
}

class _LogbookSection extends ConsumerWidget {
  const _LogbookSection({required this.data, required this.onRefresh});
  final _ReceptionSnapshot data;
  final VoidCallback onRefresh;

  // Auto-reconcile the shift from today's collected payments — no manual entry.
  Map<String, num> _reconcile() {
    final openingFloat = _num(data.logbook, ['opening_float', 'openingFloat']);
    num cash = 0, mpesa = 0, card = 0;
    for (final p in data.payments) {
      final method = (_text(p, ['payment_method', 'method']) ?? '').toLowerCase();
      final amount = _num(p, ['amount', 'total_amount', 'payment_amount']);
      if (method.contains('mpesa')) {
        mpesa += amount;
      } else if (method.contains('card')) {
        card += amount;
      } else {
        cash += amount;
      }
    }
    return {
      'opening': openingFloat,
      'cash': cash,
      'mpesa': mpesa,
      'card': card,
      'expected': openingFloat + cash,
      'total': cash + mpesa + card,
    };
  }

  Future<void> _generateAndSend(BuildContext context, WidgetRef ref) async {
    final r = _reconcile();
    final repo = ref.read(receptionRepositoryProvider);
    try {
      // 1. Auto-generate + save the logbook (cashier model fields).
      final saved = await repo.saveLogbook({
        'type': 'cashier',
        'opening_float': r['opening'],
        'closing_float': r['expected'], // expected cash in drawer
        'total_mpesa': r['mpesa'],
        'total_swipe': r['card'],
        'sales_breakdown': {
          'total_cash': r['cash'],
          'total_mpesa': r['mpesa'],
          'total_card': r['card'],
          'total_revenue': r['total'],
          'transactions': data.payments.length,
          'source': 'reception_auto',
        },
        'notes':
            'Auto-generated reception shift logbook. Cash ${_money(r['cash']!)}, M-Pesa ${_money(r['mpesa']!)}, Card ${_money(r['card']!)}.',
        'status': 'submitted',
      });
      // 2. Send it to the auditor for review (best-effort — the save already
      // persisted, so a submit hiccup must not look like a failure).
      final id = _text(saved, ['id']);
      var sent = false;
      if (id != null) {
        try {
          await repo.submitLogbook(id);
          sent = true;
        } catch (_) {}
      }
      onRefresh();
      if (context.mounted) {
        _snack(
            context,
            sent
                ? 'Shift logbook generated and sent to the auditor'
                : 'Shift logbook saved');
      }
    } catch (e) {
      if (context.mounted) {
        _snack(context, apiErrorMessage(e, fallback: 'Could not submit logbook'),
            error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final r = _reconcile();
    return _PageScaffold(
      title: 'Shift Logbook',
      subtitle:
          'Auto-generated cash-control reconciliation — submitted to the auditor.',
      actions: [
        OutlinedButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Refresh')),
        ElevatedButton.icon(
          onPressed: () => _generateAndSend(context, ref),
          icon: const Icon(Icons.send_outlined, size: 16),
          label: const Text('Generate & Send to Auditor'),
        ),
      ],
      child: _buildLogbookBody(r),
    );
  }

  Widget _buildLogbookBody(Map<String, num> r) {
    final openingFloat = r['opening']!;
    final cashCollected = r['cash']!;
    final mpesaCollected = r['mpesa']!;
    final cardCollected = r['card']!;
    final expectedCash = r['expected']!;
    final closingCash = _num(data.logbook, ['closing_float', 'closing_cash']);
    final variance = closingCash > 0 ? closingCash - expectedCash : 0;
    final status = _text(data.logbook, ['status']) ?? 'draft';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _CardPanel(
          title: 'Cash Control',
          child: _KeyValueList(rows: [
            {'label': 'Opening float', 'value': _money(openingFloat)},
            {'label': 'Cash collected today', 'value': _money(cashCollected)},
            {'label': 'Expected cash in drawer', 'value': _money(expectedCash)},
            {'label': 'Closing cash counted', 'value': _money(closingCash)},
            {
              'label': 'Variance',
              'value':
                  '${variance == 0 ? '' : variance > 0 ? '+' : ''}${_money(variance)}'
            },
            {'label': 'Status', 'value': status.toUpperCase()},
          ]),
        ),
        const SizedBox(height: 12),
        _CardPanel(
          title: 'Other Collections (today)',
          child: _KeyValueList(rows: [
            {'label': 'M-Pesa', 'value': _money(mpesaCollected)},
            {'label': 'Card', 'value': _money(cardCollected)},
            {
              'label': 'Total collected',
              'value': _money(cashCollected + mpesaCollected + cardCollected)
            },
          ]),
        ),
        const SizedBox(height: 12),
        _CardPanel(
          title: 'Shift Notes',
          child: Text(
            _text(data.logbook, ['notes']) ?? 'No notes recorded for this shift.',
            style: const TextStyle(height: 1.5),
          ),
        ),
      ],
    );
  }
}

class _HistorySection extends StatelessWidget {
  const _HistorySection({required this.data, required this.onRefresh});
  final _ReceptionSnapshot data;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return _PageScaffold(
      title: 'Activity History & Logs',
      subtitle:
          'Recent reservation and payment activity for the branch front desk.',
      actions: [
        OutlinedButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Refresh')),
      ],
      child: _ResponsivePair(
        leftFlex: 2,
        left: _CardPanel(
          title: 'Recent Bookings History',
          child: _SimpleRows(
            rows: data.bookingRows.take(50).map((b) => {
                  ...b,
                  'booking_number': _text(b, [
                        'booking_number',
                        'confirmation_number',
                        'reference',
                        'ref'
                      ]) ??
                      '-',
                  'guest_name': _text(b, [
                        'guest_name',
                        'guest.name',
                        'guest.first_name',
                        'customer_name'
                      ]) ??
                      'Walk-in',
                  'room_number': _text(b, [
                        'room_number',
                        'room.room_number',
                        'room.number',
                        'room_no'
                      ]) ??
                      '-',
                }).toList(),
            fields: const [
              'booking_number',
              'guest_name',
              'room_number',
              'status',
              'created_at'
            ],
          ),
        ),
        right: _CardPanel(
          title: 'Recent Payments',
          child: _SimpleRows(
            rows: data.payments.take(50).map((p) => {
                  ...p,
                  'customer_name': _text(p, [
                        'customer_name',
                        'guest_name',
                        'customer.name',
                        'guest.name',
                        'booking.guest_name',
                        'bill.customer_name',
                        'payer_name'
                      ]) ??
                      'Walk-in',
                }).toList(),
            fields: const [
              'customer_name',
              'payment_method',
              'amount',
              'status',
              'created_at'
            ],
          ),
        ),
      ),
    );
  }
}

class _ReceptionSnapshot {
  const _ReceptionSnapshot({
    required this.bookings,
    required this.bookingRows,
    required this.rooms,
    required this.roomRows,
    required this.guests,
    required this.guestRows,
    required this.housekeepingTasks,
    required this.housekeepingRooms,
    required this.conferenceHalls,
    required this.conferenceBookings,
    required this.cateringBookings,
    required this.cashierStats,
    required this.unpaidBills,
    required this.creditBills,
    required this.payments,
    required this.logbook,
    required this.guestProfile,
    required this.guestHistory,
    required this.guestLoyalty,
  });

  final List<Booking> bookings;
  final List<Map<String, dynamic>> bookingRows;
  final List<Room> rooms;
  final List<Map<String, dynamic>> roomRows;
  final List<Guest> guests;
  final List<Map<String, dynamic>> guestRows;
  final List<Map<String, dynamic>> housekeepingTasks;
  final List<Map<String, dynamic>> housekeepingRooms;
  final List<Map<String, dynamic>> conferenceHalls;
  final List<Map<String, dynamic>> conferenceBookings;
  final List<Map<String, dynamic>> cateringBookings;
  final Map<String, dynamic> cashierStats;
  final List<Map<String, dynamic>> unpaidBills;
  final List<Map<String, dynamic>> creditBills;
  final List<Map<String, dynamic>> payments;
  final Map<String, dynamic> logbook;
  final Map<String, dynamic> guestProfile;
  final List<Map<String, dynamic>> guestHistory;
  final Map<String, dynamic> guestLoyalty;

  int get availableRooms =>
      rooms.where((room) => room.status == 'available').length;

  int get occupiedRooms =>
      rooms.where((room) => room.status == 'occupied').length;

  double get occupancyRate => rooms.isEmpty ? 0 : occupiedRooms / rooms.length;

  int get vipGuestCount => guests.where((guest) => guest.isVip).length;

  int get openHousekeepingCount => housekeepingTasks.where((task) {
        final status = _text(task, const ['status']) ?? '';
        return status == 'pending' || status == 'in_progress';
      }).length;

  int get dirtyRoomCount {
    final source = housekeepingRooms.isNotEmpty ? housekeepingRooms : roomRows;
    return source.where((room) {
      final status =
          (_text(room, const ['status', 'hk_status', 'cleaning_status']) ?? '')
              .toLowerCase();
      return status == 'dirty' ||
          status == 'cleaning' ||
          status == 'inspecting' ||
          status == 'maintenance';
    }).length;
  }

  int get unassignedArrivalsToday {
    final today = DateTime.now();
    return bookings.where((booking) {
      final roomKey = (booking.roomNumber ?? booking.roomId ?? '').trim();
      return booking.status == 'confirmed' &&
          _sameDay(booking.checkIn, today) &&
          roomKey.isEmpty;
    }).length;
  }

  int get departuresWithBalance {
    final today = DateTime.now();
    return bookings.where((booking) {
      return booking.status == 'checked_in' &&
          _sameDay(booking.checkOut, today) &&
          booking.balance > 0;
    }).length;
  }

  int get activeEventCount {
    bool active(Map<String, dynamic> row) {
      final status =
          (_text(row, const ['status', 'booking_status']) ?? '').toLowerCase();
      return status.isEmpty ||
          status == 'confirmed' ||
          status == 'in_progress' ||
          status == 'active';
    }

    return conferenceBookings.where(active).length +
        cateringBookings.where(active).length;
  }

  num get totalOutstandingBalance {
    return bookings.fold<num>(0, (sum, booking) {
      final balance = booking.balance;
      return sum + (balance > 0 ? balance : 0);
    });
  }

  num get todayRevenue => _num(cashierStats, const [
        'today_payments',
        'todayRevenue',
        'today_collections',
        'today_sales',
      ]);

  factory _ReceptionSnapshot.empty() => const _ReceptionSnapshot(
        bookings: [],
        bookingRows: [],
        rooms: [],
        roomRows: [],
        guests: [],
        guestRows: [],
        housekeepingTasks: [],
        housekeepingRooms: [],
        conferenceHalls: [],
        conferenceBookings: [],
        cateringBookings: [],
        cashierStats: {},
        unpaidBills: [],
        creditBills: [],
        payments: [],
        logbook: {},
        guestProfile: {},
        guestHistory: [],
        guestLoyalty: {},
      );
}

class _PageScaffold extends StatelessWidget {
  const _PageScaffold({
    required this.title,
    required this.subtitle,
    required this.child,
    this.actions = const [],
  });

  final String title;
  final String subtitle;
  final Widget child;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            runSpacing: 12,
            spacing: 12,
            alignment: WrapAlignment.spaceBetween,
            children: [
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 680),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: Theme.of(context)
                            .textTheme
                            .headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text(subtitle,
                        style:
                            const TextStyle(color: AppColors.kTextSecondary)),
                  ],
                ),
              ),
              if (actions.isNotEmpty)
                Wrap(spacing: 8, runSpacing: 8, children: actions),
            ],
          ),
          const SizedBox(height: 20),
          child,
        ],
      ),
    );
  }
}

class _StatData {
  const _StatData(this.label, this.value, this.icon, this.color);
  final String label;
  final String value;
  final IconData icon;
  final Color color;
}

class _StatGrid extends StatelessWidget {
  const _StatGrid({required this.cards});
  final List<_StatData> cards;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final width = constraints.maxWidth;
      final columns = width > 1000
          ? 4
          : width > 680
              ? 2
              : 1;
      return GridView.builder(
        itemCount: cards.length,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: columns,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: width > 1000
              ? 3.1
              : width > 680
                  ? 3.25
                  : 3.2,
        ),
        itemBuilder: (context, index) {
          final card = cards[index];
          return StatCard(
              label: card.label,
              value: card.value,
              icon: card.icon,
              color: card.color);
        },
      );
    });
  }
}

class _ResponsivePair extends StatelessWidget {
  const _ResponsivePair({
    required this.left,
    required this.right,
    this.leftFlex = 1,
  });

  final Widget left;
  final Widget right;
  final int leftFlex;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      if (constraints.maxWidth < 900) {
        return Column(children: [left, const SizedBox(height: 16), right]);
      }
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(flex: leftFlex, child: left),
          const SizedBox(width: 16),
          Expanded(child: right),
        ],
      );
    });
  }
}

class _OperationsPulseSection extends StatelessWidget {
  const _OperationsPulseSection({
    required this.data,
    required this.onAction,
  });

  final _ReceptionSnapshot data;
  final ValueChanged<ReceptionSection> onAction;

  @override
  Widget build(BuildContext context) {
    final occupancy = (data.occupancyRate * 100).clamp(0, 100).round();
    final actionCues = [
      _ActionCueData(
        label: 'Checkout balances',
        value: '${data.departuresWithBalance}',
        note: 'Guests due out today with unsettled folios',
        icon: Icons.receipt_long_outlined,
        color: AppColors.kError,
        section: ReceptionSection.checkInOut,
      ),
      _ActionCueData(
        label: 'Dirty / blocked rooms',
        value: '${data.dirtyRoomCount}',
        note: 'Rooms that need cleaning, inspection or maintenance',
        icon: Icons.cleaning_services_outlined,
        color: AppColors.kWarning,
        section: ReceptionSection.housekeeping,
      ),
      _ActionCueData(
        label: 'Housekeeping queue',
        value: '${data.openHousekeepingCount}',
        note: 'Pending and in-progress task load from operations',
        icon: Icons.assignment_late_outlined,
        color: Colors.blue,
        section: ReceptionSection.housekeeping,
      ),
      _ActionCueData(
        label: 'VIP guest watchlist',
        value: '${data.vipGuestCount}',
        note: 'Guest profiles flagged for premium service handling',
        icon: Icons.workspace_premium_outlined,
        color: const Color(0xFFB7791F),
        section: ReceptionSection.guests,
      ),
    ];

    return _ResponsivePair(
      left: _CardPanel(
        title: 'Operations Pulse',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                gradient: LinearGradient(
                  colors: [
                    AppColors.kPrimary.withValues(alpha: 0.10),
                    Colors.blue.withValues(alpha: 0.06),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(Icons.radar_outlined,
                            color: AppColors.kPrimary),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Live service health',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Occupancy, cash exposure and service pressure in one place.',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(color: AppColors.kTextSecondary),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        '$occupancy%',
                        style: Theme.of(context)
                            .textTheme
                            .headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w900),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      minHeight: 10,
                      value: data.occupancyRate.clamp(0, 1),
                      backgroundColor: Colors.white,
                      color: occupancy >= 85
                          ? AppColors.kWarning
                          : occupancy >= 65
                              ? Colors.blue
                              : AppColors.kSuccess,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _PulseMetricTile(
                  label: 'Outstanding folios',
                  value: _money(data.totalOutstandingBalance),
                  hint: 'Open receivable exposure',
                  icon: Icons.account_balance_wallet_outlined,
                  color: AppColors.kError,
                ),
                _PulseMetricTile(
                  label: 'Today revenue',
                  value: _money(data.todayRevenue),
                  hint: 'Cashier collections and payments',
                  icon: Icons.payments_outlined,
                  color: AppColors.kSuccess,
                ),
                _PulseMetricTile(
                  label: 'Events in motion',
                  value: '${data.activeEventCount}',
                  hint: 'Conference and catering workload',
                  icon: Icons.corporate_fare_outlined,
                  color: Colors.blue,
                ),
                _PulseMetricTile(
                  label: 'Unassigned arrivals',
                  value: '${data.unassignedArrivalsToday}',
                  hint: 'Guests due in without room placement',
                  icon: Icons.key_off_outlined,
                  color: AppColors.kWarning,
                ),
              ],
            ),
          ],
        ),
      ),
      right: _CardPanel(
        title: 'Action Center',
        action: TextButton(
          onPressed: () => onAction(ReceptionSection.reservations),
          child: const Text('Open reservations'),
        ),
        child: Column(
          children: actionCues
              .map((cue) => _ActionCueTile(
                    data: cue,
                    onTap: () => onAction(cue.section),
                  ))
              .toList(),
        ),
      ),
    );
  }
}

class _CardPanel extends StatelessWidget {
  const _CardPanel({required this.title, required this.child, this.action});

  final String title;
  final Widget child;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                    child: Text(title,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 16))),
                if (action != null) action!,
              ],
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _PulseMetricTile extends StatelessWidget {
  const _PulseMetricTile({
    required this.label,
    required this.value,
    required this.hint,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final String hint;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 220, maxWidth: 320),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.kDivider),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: Theme.of(context)
                          .textTheme
                          .labelLarge
                          ?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(value,
                      style: Theme.of(context)
                          .textTheme
                          .titleLarge
                          ?.copyWith(fontWeight: FontWeight.w900)),
                  const SizedBox(height: 2),
                  Text(hint,
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: AppColors.kTextSecondary)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionCueData {
  const _ActionCueData({
    required this.label,
    required this.value,
    required this.note,
    required this.icon,
    required this.color,
    required this.section,
  });

  final String label;
  final String value;
  final String note;
  final IconData icon;
  final Color color;
  final ReceptionSection section;
}

class _ActionCueTile extends StatelessWidget {
  const _ActionCueTile({
    required this.data,
    required this.onTap,
  });

  final _ActionCueData data;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: Ink(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.kDivider),
              color: data.color.withValues(alpha: 0.05),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: data.color.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(data.icon, color: data.color),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(data.label,
                          style: Theme.of(context)
                              .textTheme
                              .titleSmall
                              ?.copyWith(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 4),
                      Text(data.note,
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: AppColors.kTextSecondary)),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(data.value,
                        style: Theme.of(context)
                            .textTheme
                            .headlineSmall
                            ?.copyWith(
                                fontWeight: FontWeight.w900,
                                color: data.color)),
                    const SizedBox(height: 2),
                    const Icon(Icons.chevron_right_rounded,
                        color: AppColors.kTextSecondary),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RoomsTable extends StatelessWidget {
  const _RoomsTable({required this.rooms});
  final List<Room> rooms;

  @override
  Widget build(BuildContext context) {
    if (rooms.isEmpty) return const EmptyState(message: 'No rooms found');
    return _HorizontalTable(
      columns: const ['Room', 'Type', 'Status', 'Guest', 'Checkout'],
      rows: rooms
          .map((room) => [
                Text('${room.number}',
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                Text(room.type ?? '-'),
                _StatusPill(room.status),
                Text(room.guestName ?? '-'),
                Text(room.checkOutDate == null
                    ? '-'
                    : _date(room.checkOutDate!)),
              ])
          .toList(),
    );
  }
}

class _HorizontalTable extends StatelessWidget {
  const _HorizontalTable({required this.columns, required this.rows});

  final List<String> columns;
  final List<List<Widget>> rows;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        headingRowColor: WidgetStatePropertyAll(Colors.grey.shade50),
        // Allow rows to grow so wrapped action buttons are never clipped.
        dataRowMinHeight: 52,
        dataRowMaxHeight: 96,
        columns: columns
            .map((c) => DataColumn(
                label: Text(c,
                    style: const TextStyle(fontWeight: FontWeight.w800))))
            .toList(),
        rows: rows
            .map((cells) =>
                DataRow(cells: cells.map((cell) => DataCell(cell)).toList()))
            .toList(),
      ),
    );
  }
}

class _BookingMiniList extends StatelessWidget {
  const _BookingMiniList({
    required this.title,
    required this.bookings,
    required this.empty,
    required this.actionLabel,
    required this.onOpen,
  });

  final String title;
  final List<Booking> bookings;
  final String empty;
  final String actionLabel;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return _CardPanel(
      title: title,
      child: bookings.isEmpty
          ? EmptyState(message: empty)
          : Column(
              children: bookings.map((booking) {
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(
                      child: Text((booking.guestName ?? 'G')[0].toUpperCase())),
                  title: Text(booking.guestName ?? 'Guest',
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text(
                      'Room ${booking.roomNumber ?? '-'} • ${booking.roomType ?? ''}'),
                  trailing:
                      TextButton(onPressed: onOpen, child: Text(actionLabel)),
                );
              }).toList(),
            ),
    );
  }
}

class _FilterBar extends StatelessWidget {
  const _FilterBar({
    required this.searchController,
    required this.searchHint,
    required this.onSearch,
    this.filters = const [],
  });

  final TextEditingController searchController;
  final String searchHint;
  final VoidCallback onSearch;
  final List<Widget> filters;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        SizedBox(
          width: 360,
          child: _SearchField(
            controller: searchController,
            hint: searchHint,
            onSubmitted: (_) => onSearch(),
          ),
        ),
        ...filters,
        OutlinedButton.icon(
            onPressed: onSearch,
            icon: const Icon(Icons.search, size: 16),
            label: const Text('Search')),
      ],
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({
    required this.controller,
    required this.hint,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final String hint;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onSubmitted: onSubmitted,
      decoration:
          InputDecoration(prefixIcon: const Icon(Icons.search), hintText: hint),
    );
  }
}

class _FilterMenu extends StatelessWidget {
  const _FilterMenu({
    required this.value,
    required this.label,
    required this.values,
    required this.onChanged,
  });

  final String value;
  final String label;
  final List<String> values;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 190,
      child: DropdownButtonFormField<String>(
        initialValue: values.contains(value) ? value : values.first,
        decoration: InputDecoration(labelText: label),
        items: values
            .map((v) => DropdownMenuItem(value: v, child: Text(_label(v))))
            .toList(),
        onChanged: (value) {
          if (value != null) onChanged(value);
        },
      ),
    );
  }
}

class _InlineChoice extends StatelessWidget {
  const _InlineChoice(
      {required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
        label: Text(label), selected: selected, onSelected: (_) => onTap());
  }
}

class _RecordTileData {
  const _RecordTileData({
    required this.title,
    required this.subtitle,
    this.leading,
    this.trailing,
    this.actions = const [],
  });

  final String title;
  final String subtitle;
  final Widget? leading;
  final Widget? trailing;
  final List<Widget> actions;
}

class _RecordList extends StatelessWidget {
  const _RecordList({required this.rows});
  final List<_RecordTileData> rows;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: rows.map((row) {
        return Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: Colors.grey.shade100))),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (row.leading != null) ...[
                row.leading!,
                const SizedBox(width: 12)
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(row.title,
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 3),
                    Text(row.subtitle,
                        style: const TextStyle(
                            color: AppColors.kTextSecondary, fontSize: 12)),
                    if (row.actions.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Wrap(spacing: 6, runSpacing: 6, children: row.actions),
                    ],
                  ],
                ),
              ),
              if (row.trailing != null) row.trailing!,
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _RoomCard extends StatelessWidget {
  const _RoomCard({
    required this.room,
    required this.onStatus,
    this.onQuickCheckIn,
    this.onCheckout,
  });

  final Room room;
  final ValueChanged<String> onStatus;
  final VoidCallback? onQuickCheckIn;
  final VoidCallback? onCheckout;

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(room.status);
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: color.withValues(alpha: 0.45), width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('${room.number}',
                    style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        color: color)),
                const Spacer(),
                PopupMenuButton<String>(
                  onSelected: onStatus,
                  itemBuilder: (context) => const [
                    PopupMenuItem(
                        value: 'available', child: Text('Mark available')),
                    PopupMenuItem(
                        value: 'cleaning', child: Text('Mark cleaning')),
                    PopupMenuItem(
                        value: 'maintenance', child: Text('Mark maintenance')),
                    PopupMenuItem(value: 'dirty', child: Text('Mark dirty')),
                  ],
                ),
              ],
            ),
            Text(room.type ?? 'Room',
                maxLines: 1, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 8),
            _StatusPill(room.status),
            const Spacer(),
            Text(room.guestName ?? 'No guest',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.kTextSecondary)),
            const SizedBox(height: 8),
            Wrap(spacing: 6, runSpacing: 6, children: [
              if (onQuickCheckIn != null)
                _SmallAction('Quick check-in', Icons.login, onQuickCheckIn),
              if (onCheckout != null)
                _SmallAction('Checkout', Icons.logout, onCheckout),
            ]),
          ],
        ),
      ),
    );
  }
}

class _HousekeepingRoomGrid extends StatelessWidget {
  const _HousekeepingRoomGrid(
      {required this.rooms, required this.onRequestCleaning});
  final List<Map<String, dynamic>> rooms;
  final ValueChanged<Map<String, dynamic>> onRequestCleaning;

  @override
  Widget build(BuildContext context) {
    if (rooms.isEmpty) {
      return const EmptyState(message: 'No housekeeping room status found');
    }
    return LayoutBuilder(builder: (context, constraints) {
      final crossAxisCount = constraints.maxWidth > 1100
          ? 6
          : constraints.maxWidth > 780
              ? 4
              : constraints.maxWidth > 520
                  ? 3
                  : 2;
      return GridView.builder(
        itemCount: rooms.length,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: crossAxisCount,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1.3,
        ),
        itemBuilder: (context, index) {
          final room = rooms[index];
          final status = _text(room, ['status']) ?? 'unknown';
          return Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
              side: BorderSide(
                  color: _statusColor(status).withValues(alpha: 0.45)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Room ${_text(room, ['room_number', 'number']) ?? '-'}',
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  _StatusPill(status),
                  const Spacer(),
                  if (status == 'dirty' || status == 'cleaning')
                    _SmallAction('Request clean', Icons.cleaning_services,
                        () => onRequestCleaning(room)),
                ],
              ),
            ),
          );
        },
      );
    });
  }
}

class _BillsList extends StatelessWidget {
  const _BillsList({required this.bills, required this.onPay});
  final List<Map<String, dynamic>> bills;
  final ValueChanged<Map<String, dynamic>> onPay;

  @override
  Widget build(BuildContext context) {
    if (bills.isEmpty) return const EmptyState(message: 'No bills found');
    return _RecordList(
      rows: bills.map((bill) {
        return _RecordTileData(
          title:
              '#${_text(bill, ['bill_number', 'invoice_number', 'id']) ?? '-'}',
          subtitle: '${_text(bill, [
                    'customer_name',
                    'staff_name'
                  ]) ?? 'Walk-in'} • ${_text(bill, ['bill_type', 'source']) ?? 'bill'}',
          trailing: Text(_money(_num(bill, ['total_amount', 'amount'])),
              style: const TextStyle(fontWeight: FontWeight.w800)),
          actions: [
            _SmallAction('Record payment', Icons.payments, () => onPay(bill)),
          ],
        );
      }).toList(),
    );
  }
}

class _SimpleRows extends StatelessWidget {
  const _SimpleRows({
    required this.rows,
    required this.fields,
    this.actionsBuilder,
  });

  final List<Map<String, dynamic>> rows;
  final List<String> fields;
  final Widget Function(Map<String, dynamic>)? actionsBuilder;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const EmptyState(message: 'No records found');
    return _HorizontalTable(
      columns: [...fields.map(_label), if (actionsBuilder != null) 'Actions'],
      rows: rows.map((row) {
        return [
          ...fields.map((field) {
            final value = _nested(row, field);
            return Text(_cell(value),
                maxLines: 2, overflow: TextOverflow.ellipsis);
          }),
          if (actionsBuilder != null) actionsBuilder!(row),
        ];
      }).toList(),
    );
  }
}

class _KeyValueList extends StatelessWidget {
  const _KeyValueList({required this.rows});
  final List<Map<String, String>> rows;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: rows.map((row) {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 7),
          child: Row(
            children: [
              Expanded(
                  child: Text(row['label'] ?? '',
                      style: const TextStyle(color: AppColors.kTextSecondary))),
              const SizedBox(width: 16),
              Flexible(
                  child: Text(row['value'] ?? '',
                      textAlign: TextAlign.right,
                      style: const TextStyle(fontWeight: FontWeight.w800))),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _TwoLine extends StatelessWidget {
  const _TwoLine({required this.title, required this.subtitle});
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        if (subtitle.isNotEmpty)
          Text(subtitle,
              style: const TextStyle(
                  fontSize: 11, color: AppColors.kTextSecondary)),
      ],
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill(this.status);
  final String status;

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        _label(status).toUpperCase(),
        style:
            TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color),
      ),
    );
  }
}

class _SmallAction extends StatelessWidget {
  const _SmallAction(this.label, this.icon, this.onPressed,
      {this.danger = false});

  final String label;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 14),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        foregroundColor: danger ? AppColors.kError : null,
        minimumSize: const Size(0, 34),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _RecordField {
  const _RecordField(this.key, this.label,
      {this.numeric = false,
      this.multiline = false,
      this.initial,
      this.options,
      this.optionLabels});
  final String key;
  final String label;
  final bool numeric;
  final bool multiline;
  final String? initial;
  final List<String>? options;

  /// Optional value→display-label map. When present, the dropdown shows the
  /// label but still submits the underlying option value (e.g. an id).
  final Map<String, String>? optionLabels;
}

class _RecordDialog extends StatefulWidget {
  const _RecordDialog({
    required this.title,
    required this.fields,
    required this.onSubmit,
    this.submitLabel = 'Save',
  });

  final String title;
  final List<_RecordField> fields;
  final Future<void> Function(Map<String, dynamic>) onSubmit;
  final String submitLabel;

  @override
  State<_RecordDialog> createState() => _RecordDialogState();
}

class _RecordDialogState extends State<_RecordDialog> {
  late final Map<String, TextEditingController> _controllers = {
    for (final field in widget.fields)
      if (field.options == null)
        field.key: TextEditingController(text: field.initial ?? ''),
  };
  late final Map<String, String> _selectValues = {
    for (final field in widget.fields)
      if (field.options != null)
        field.key: field.initial ?? field.options!.first,
  };
  bool _busy = false;

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: SizedBox(
        width: 520,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: widget.fields.map((field) {
              if (field.options != null) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: DropdownButtonFormField<String>(
                    initialValue: _selectValues[field.key],
                    decoration: InputDecoration(labelText: field.label),
                    items: field.options!
                        .map((item) => DropdownMenuItem(
                            value: item,
                            child: Text(
                                field.optionLabels?[item] ?? _label(item))))
                        .toList(),
                    onChanged: (value) => setState(() =>
                        _selectValues[field.key] =
                            value ?? field.options!.first),
                  ),
                );
              }
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: TextField(
                  controller: _controllers[field.key],
                  maxLines: field.multiline ? 3 : 1,
                  keyboardType:
                      field.numeric ? TextInputType.number : TextInputType.text,
                  decoration: InputDecoration(labelText: field.label),
                ),
              );
            }).toList(),
          ),
        ),
      ),
      actions: [
        TextButton(
            onPressed: _busy ? null : () => Navigator.pop(context),
            child: const Text('Cancel')),
        ElevatedButton(
          onPressed: _busy
              ? null
              : () async {
                  setState(() => _busy = true);
                  final values = <String, dynamic>{};
                  for (final field in widget.fields) {
                    final value = field.options == null
                        ? _controllers[field.key]!.text.trim()
                        : _selectValues[field.key];
                    values[field.key] =
                        field.numeric ? num.tryParse(value ?? '') ?? 0 : value;
                  }
                  try {
                    await widget.onSubmit(values);
                    if (context.mounted) Navigator.pop(context);
                  } finally {
                    if (mounted) setState(() => _busy = false);
                  }
                },
          child: Text(_busy ? 'Saving...' : widget.submitLabel),
        ),
      ],
    );
  }
}

class _NewReservationDialog extends ConsumerStatefulWidget {
  const _NewReservationDialog({required this.onSuccess});
  final VoidCallback onSuccess;

  @override
  ConsumerState<_NewReservationDialog> createState() =>
      _NewReservationDialogState();
}

class _NewReservationDialogState extends ConsumerState<_NewReservationDialog> {
  final _checkIn = TextEditingController(
      text: DateFormat('yyyy-MM-dd').format(DateTime.now()));
  final _checkOut = TextEditingController(
      text: DateFormat('yyyy-MM-dd')
          .format(DateTime.now().add(const Duration(days: 1))));
  final _guestSearch = TextEditingController();
  final _special = TextEditingController();
  final _deposit = TextEditingController(text: '0');
  int _step = 0;
  int _adults = 1;
  int _children = 0;
  String _mealPlan = 'bed_breakfast';
  bool _busy = false;
  List<Map<String, dynamic>> _rooms = [];
  List<Guest> _guests = [];
  Map<String, dynamic>? _selectedRoom;
  Guest? _selectedGuest;

  @override
  void dispose() {
    _checkIn.dispose();
    _checkOut.dispose();
    _guestSearch.dispose();
    _special.dispose();
    _deposit.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final total = _totalAmount();
    return AlertDialog(
      title: const Text('New Reservation'),
      content: SizedBox(
        width: 720,
        height: 560,
        child: Stepper(
          currentStep: _step,
          onStepTapped: (step) => setState(() => _step = step),
          controlsBuilder: (context, details) => const SizedBox.shrink(),
          steps: [
            Step(
              title: const Text('Dates'),
              isActive: _step == 0,
              content: Column(
                children: [
                  Row(children: [
                    Expanded(
                        child: TextField(
                            controller: _checkIn,
                            decoration: const InputDecoration(
                                labelText: 'Check-in date'))),
                    const SizedBox(width: 12),
                    Expanded(
                        child: TextField(
                            controller: _checkOut,
                            decoration: const InputDecoration(
                                labelText: 'Check-out date'))),
                  ]),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                        child: _Counter(
                            label: 'Adults',
                            value: _adults,
                            onChanged: (v) => setState(() => _adults = v))),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _Counter(
                            label: 'Children',
                            value: _children,
                            onChanged: (v) => setState(() => _children = v))),
                  ]),
                  const SizedBox(height: 12),
                  ElevatedButton.icon(
                      onPressed: _searchRooms,
                      icon: const Icon(Icons.search),
                      label: const Text('Search Available Rooms')),
                ],
              ),
            ),
            Step(
              title: const Text('Room'),
              isActive: _step == 1,
              content: _rooms.isEmpty
                  ? const EmptyState(
                      message: 'Search dates to load available rooms')
                  : SizedBox(
                      height: 220,
                      child: ListView(
                        children: _rooms.map((room) {
                          final selected = _selectedRoom?['id'] == room['id'];
                          return ListTile(
                            selected: selected,
                            title: Text('Room ${_text(room, [
                                      'room_number',
                                      'number'
                                    ]) ?? '-'}'),
                            subtitle: Text('${_text(room, [
                                      'room_type',
                                      'type'
                                    ]) ?? 'Room'} • ${_money(_num(room, [
                                  'price_per_night',
                                  'rate',
                                  'base_price'
                                ]))}/night'),
                            trailing: selected
                                ? const Icon(Icons.check_circle,
                                    color: AppColors.kSuccess)
                                : null,
                            onTap: () => setState(() => _selectedRoom = room),
                          );
                        }).toList(),
                      ),
                    ),
            ),
            Step(
              title: const Text('Guest'),
              isActive: _step == 2,
              content: Column(
                children: [
                  Row(children: [
                    Expanded(
                        child: TextField(
                            controller: _guestSearch,
                            decoration: const InputDecoration(
                                labelText: 'Search guest'))),
                    const SizedBox(width: 8),
                    ElevatedButton(
                        onPressed: _searchGuests, child: const Text('Search')),
                    const SizedBox(width: 8),
                    OutlinedButton(
                        onPressed: _createGuestInline,
                        child: const Text('New guest')),
                  ]),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 180,
                    child: _guests.isEmpty
                        ? const EmptyState(message: 'No guests loaded')
                        : ListView(
                            children: _guests.map((guest) {
                              final selected = _selectedGuest?.id == guest.id;
                              return ListTile(
                                selected: selected,
                                title: Text(guest.name),
                                subtitle:
                                    Text(guest.phone ?? guest.email ?? ''),
                                trailing: selected
                                    ? const Icon(Icons.check_circle,
                                        color: AppColors.kSuccess)
                                    : null,
                                onTap: () =>
                                    setState(() => _selectedGuest = guest),
                              );
                            }).toList(),
                          ),
                  ),
                ],
              ),
            ),
            Step(
              title: const Text('Confirm'),
              isActive: _step == 3,
              content: Column(
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: _mealPlan,
                    decoration: const InputDecoration(labelText: 'Meal plan'),
                    items: const [
                      DropdownMenuItem(
                          value: 'room_only', child: Text('Room only')),
                      DropdownMenuItem(
                          value: 'bed_breakfast',
                          child: Text('Bed & breakfast')),
                      DropdownMenuItem(
                          value: 'half_board', child: Text('Half board')),
                      DropdownMenuItem(
                          value: 'full_board', child: Text('Full board')),
                    ],
                    onChanged: (v) =>
                        setState(() => _mealPlan = v ?? 'bed_breakfast'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                      controller: _deposit,
                      keyboardType: TextInputType.number,
                      decoration:
                          const InputDecoration(labelText: 'Deposit amount')),
                  const SizedBox(height: 12),
                  TextField(
                      controller: _special,
                      maxLines: 3,
                      decoration:
                          const InputDecoration(labelText: 'Special requests')),
                  const SizedBox(height: 12),
                  _KeyValueList(rows: [
                    {
                      'label': 'Room',
                      'value': _selectedRoom == null
                          ? '-'
                          : 'Room ${_text(_selectedRoom!, [
                                  'room_number',
                                  'number'
                                ])}'
                    },
                    {'label': 'Guest', 'value': _selectedGuest?.name ?? '-'},
                    {'label': 'Total', 'value': _money(total)},
                  ]),
                ],
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: _busy ? null : () => Navigator.pop(context),
            child: const Text('Cancel')),
        if (_step > 0)
          TextButton(
              onPressed: _busy ? null : () => setState(() => _step--),
              child: const Text('Back')),
        if (_step < 3)
          ElevatedButton(
              onPressed: _busy ? null : () => setState(() => _step++),
              child: const Text('Next'))
        else
          ElevatedButton(
              onPressed: _busy ? null : _submit,
              child: Text(_busy ? 'Creating...' : 'Create Reservation')),
      ],
    );
  }

  Future<void> _searchRooms() async {
    setState(() => _busy = true);
    try {
      final rows =
          await ref.read(receptionRepositoryProvider).getAvailableRooms({
        'checkIn': _checkIn.text,
        'checkOut': _checkOut.text,
        'adults': _adults + _children,
      });
      setState(() {
        _rooms = rows;
        _step = 1;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _searchGuests() async {
    final rows = await ref
        .read(receptionRepositoryProvider)
        .getGuests(search: _guestSearch.text);
    setState(() => _guests = rows);
  }

  Future<void> _createGuestInline() async {
    final created = await showDialog<Guest>(
      context: context,
      builder: (_) => _InlineGuestDialog(),
    );
    if (created != null) {
      setState(() {
        _selectedGuest = created;
        _guests = [created, ..._guests];
      });
    }
  }

  double _totalAmount() {
    final rate = _num(_selectedRoom ?? const {},
        ['price_per_night', 'rate', 'base_price']).toDouble();
    final inDate = DateTime.tryParse(_checkIn.text) ?? DateTime.now();
    final outDate = DateTime.tryParse(_checkOut.text) ??
        inDate.add(const Duration(days: 1));
    final nights = outDate.difference(inDate).inDays.clamp(1, 365);
    final meal = switch (_mealPlan) {
      'bed_breakfast' => 1200,
      'half_board' => 2800,
      'full_board' => 4200,
      _ => 0,
    };
    return (rate + meal) * nights;
  }

  Future<void> _submit() async {
    if (_selectedRoom == null || _selectedGuest == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(receptionRepositoryProvider).createBookingRow({
        'room_id': _text(_selectedRoom!, ['id']),
        'guest_id': _selectedGuest!.id,
        'check_in': _checkIn.text,
        'check_out': _checkOut.text,
        'adults': _adults,
        'children': _children,
        'meal_plan': _mealPlan,
        'special_requests': _special.text,
        'total_amount': _totalAmount(),
        'amount_paid': num.tryParse(_deposit.text) ?? 0,
        'status': 'confirmed',
      });
      final roomId = _text(_selectedRoom!, ['id']);
      if (roomId != null) {
        await ref
            .read(receptionRepositoryProvider)
            .updateRoomStatus(roomId, 'reserved');
      }
      widget.onSuccess();
      if (mounted) Navigator.pop(context);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class _InlineGuestDialog extends ConsumerStatefulWidget {
  @override
  ConsumerState<_InlineGuestDialog> createState() => _InlineGuestDialogState();
}

class _InlineGuestDialogState extends ConsumerState<_InlineGuestDialog> {
  final _first = TextEditingController();
  final _last = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();

  @override
  void dispose() {
    _first.dispose();
    _last.dispose();
    _phone.dispose();
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('New Guest'),
      content: SizedBox(
        width: 420,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(
              controller: _first,
              decoration: const InputDecoration(labelText: 'First name')),
          const SizedBox(height: 10),
          TextField(
              controller: _last,
              decoration: const InputDecoration(labelText: 'Last name')),
          const SizedBox(height: 10),
          TextField(
              controller: _phone,
              decoration: const InputDecoration(labelText: 'Phone')),
          const SizedBox(height: 10),
          TextField(
              controller: _email,
              decoration: const InputDecoration(labelText: 'Email')),
        ]),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        ElevatedButton(
          onPressed: () async {
            final row =
                await ref.read(receptionRepositoryProvider).createGuest({
              'first_name': _first.text,
              'last_name': _last.text,
              'phone': _phone.text,
              'email': _email.text,
            });
            if (context.mounted) Navigator.pop(context, Guest.fromJson(row));
          },
          child: const Text('Create'),
        ),
      ],
    );
  }
}

class _Counter extends StatelessWidget {
  const _Counter(
      {required this.label, required this.value, required this.onChanged});
  final String label;
  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return InputDecorator(
      decoration: InputDecoration(labelText: label),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
              onPressed: value <= 0 ? null : () => onChanged(value - 1),
              icon: const Icon(Icons.remove)),
          Text('$value', style: const TextStyle(fontWeight: FontWeight.w800)),
          IconButton(
              onPressed: () => onChanged(value + 1),
              icon: const Icon(Icons.add)),
        ],
      ),
    );
  }
}

Future<void> _showNewReservationDialog(
    BuildContext context, WidgetRef ref, VoidCallback onSuccess) async {
  await showDialog<void>(
      context: context,
      builder: (_) => _NewReservationDialog(onSuccess: onSuccess));
}

Future<void> _showEditBookingDialog(BuildContext context, WidgetRef ref,
    Booking booking, VoidCallback onSuccess) async {
  await showDialog<void>(
    context: context,
    builder: (_) => _RecordDialog(
      title: 'Edit Reservation',
      fields: [
        _RecordField('check_in', 'Check-in',
            initial: DateFormat('yyyy-MM-dd').format(booking.checkIn)),
        _RecordField('check_out', 'Check-out',
            initial: DateFormat('yyyy-MM-dd').format(booking.checkOut)),
        _RecordField('adults', 'Adults',
            numeric: true, initial: '${booking.raw['adults'] ?? 1}'),
        _RecordField('children', 'Children',
            numeric: true, initial: '${booking.raw['children'] ?? 0}'),
        _RecordField('special_requests', 'Special requests',
            multiline: true, initial: booking.specialRequests),
      ],
      onSubmit: (values) async {
        await ref
            .read(receptionRepositoryProvider)
            .updateBooking(booking.id, values);
        onSuccess();
      },
    ),
  );
}

Future<void> _showGuestFormDialog(BuildContext context, WidgetRef ref,
    Guest? guest, VoidCallback onSuccess) async {
  await showDialog<void>(
    context: context,
    builder: (_) => _RecordDialog(
      title: guest == null ? 'Register New Guest' : 'Edit Guest',
      fields: [
        _RecordField('first_name', 'First name', initial: guest?.firstName),
        _RecordField('last_name', 'Last name', initial: guest?.lastName),
        _RecordField('phone', 'Phone', initial: guest?.phone),
        _RecordField('email', 'Email', initial: guest?.email),
        _RecordField('id_number', 'ID / Passport', initial: guest?.idNumber),
      ],
      onSubmit: (values) async {
        if (guest == null) {
          await ref.read(receptionRepositoryProvider).createGuest(values);
        } else {
          await ref
              .read(receptionRepositoryProvider)
              .updateGuest(guest.id, values);
        }
        onSuccess();
      },
    ),
  );
}

Future<void> _showQuickCheckInDialog(BuildContext context, WidgetRef ref,
    Room room, VoidCallback onSuccess) async {
  Guest? selected;
  final repo = ref.read(receptionRepositoryProvider);
  final guests = await repo.getGuests();
  if (!context.mounted) return;
  await showDialog<void>(
    context: context,
    builder: (_) => StatefulBuilder(builder: (context, setState) {
      return AlertDialog(
        title: Text('Quick Check-in Room ${room.number}'),
        content: SizedBox(
          width: 520,
          height: 420,
          child: Column(
            children: [
              Expanded(
                child: ListView(
                  children: guests.map((guest) {
                    return ListTile(
                      selected: selected?.id == guest.id,
                      title: Text(guest.name),
                      subtitle: Text(guest.phone ?? guest.email ?? ''),
                      onTap: () => setState(() => selected = guest),
                    );
                  }).toList(),
                ),
              ),
              OutlinedButton.icon(
                onPressed: () async {
                  final created = await showDialog<Guest>(
                      context: context, builder: (_) => _InlineGuestDialog());
                  if (created != null) setState(() => selected = created);
                },
                icon: const Icon(Icons.person_add),
                label: const Text('Create Guest'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: selected == null
                ? null
                : () async {
                    await repo.createBookingRow({
                      'room_id': room.id,
                      'guest_id': selected!.id,
                      'check_in':
                          DateFormat('yyyy-MM-dd').format(DateTime.now()),
                      'check_out': DateFormat('yyyy-MM-dd')
                          .format(DateTime.now().add(const Duration(days: 1))),
                      'adults': 1,
                      'children': 0,
                      'status': 'checked_in',
                    });
                    await repo.updateRoomStatus(room.id, 'occupied');
                    onSuccess();
                    if (context.mounted) Navigator.pop(context);
                  },
            child: const Text('Check In'),
          ),
        ],
      );
    }),
  );
}

Future<void> _showCheckoutDialog(BuildContext context, WidgetRef ref,
    Booking booking, VoidCallback onSuccess) async {
  final charges = TextEditingController(text: '0');
  await showDialog<void>(
    context: context,
    builder: (_) => AlertDialog(
      title: Text('Check Out ${booking.guestName ?? 'Guest'}'),
      content: SizedBox(
        width: 460,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          _KeyValueList(rows: [
            {'label': 'Room', 'value': booking.roomNumber ?? '-'},
            {'label': 'Total', 'value': _money(booking.totalAmount ?? 0)},
            {'label': 'Paid', 'value': _money(booking.amountPaid ?? 0)},
            {'label': 'Balance', 'value': _money(booking.balance)},
          ]),
          TextField(
              controller: charges,
              keyboardType: TextInputType.number,
              decoration:
                  const InputDecoration(labelText: 'Additional charges')),
        ]),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        OutlinedButton(
            onPressed: () => _downloadCheckoutBill(context, ref, booking),
            child: const Text('Print Bill')),
        ElevatedButton(
          onPressed: () async {
            final balance = booking.balance + (num.tryParse(charges.text) ?? 0);
            if (balance > 0) {
              Navigator.pop(context);
              await _showPaymentMethodSheet(context, booking, amount: balance);
              return;
            }
            await _manualCheckout(context, ref, booking, onSuccess);
            if (context.mounted) Navigator.pop(context);
          },
          child: const Text('Proceed'),
        ),
      ],
    ),
  );
}

Future<void> _showPaymentMethodSheet(BuildContext context, Booking booking,
    {num? amount}) {
  final billRef = booking.confirmationNumber ?? booking.id;
  final due = (amount ?? booking.balance);
  return showModalBottomSheet<void>(
    context: context,
    builder: (_) => Padding(
      padding: const EdgeInsets.all(20),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text('Settle balance ${_money(due)}',
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 4),
        Text('Redirecting to cashier station with amount pre-filled',
            style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
        const SizedBox(height: 16),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          alignment: WrapAlignment.center,
          children: [
            for (final method in const ['mpesa', 'cash', 'card'])
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  context.go(
                      '/cashier?billId=$billRef&method=$method&amount=${due.toStringAsFixed(0)}');
                },
                icon: Icon(method == 'mpesa'
                    ? Icons.phone_android
                    : method == 'cash'
                        ? Icons.payments
                        : Icons.credit_card),
                label: Text('Pay by ${_label(method)}'),
              ),
          ],
        ),
      ]),
    ),
  );
}

Future<void> _manualCheckout(BuildContext context, WidgetRef ref,
    Booking booking, VoidCallback onSuccess) async {
  final repo = ref.read(receptionRepositoryProvider);
  try {
    await repo.verifyCheckoutAnomaly({
      'booking_id': booking.id,
      'total_amount': booking.totalAmount ?? 0,
      'amount_paid': booking.amountPaid ?? 0,
      'balance': booking.balance,
    });
  } catch (_) {}
  await repo.checkOut(booking.id);
  if (booking.roomId != null) {
    await repo.updateRoomStatus(booking.roomId!, 'cleaning');
  }
  onSuccess();
  if (context.mounted) _snack(context, 'Guest checked out');
}

Future<void> _checkIn(BuildContext context, WidgetRef ref, Booking booking,
    VoidCallback onSuccess) async {
  await ref.read(receptionRepositoryProvider).checkIn(booking.id);
  if (booking.roomId != null) {
    await ref
        .read(receptionRepositoryProvider)
        .updateRoomStatus(booking.roomId!, 'occupied');
  }
  onSuccess();
  if (context.mounted) _snack(context, 'Guest checked in');
}

Future<void> _cancelBooking(BuildContext context, WidgetRef ref,
    Booking booking, VoidCallback onSuccess) async {
  final confirmed = await _confirm(context, 'Cancel this reservation?');
  if (!confirmed) return;
  await ref.read(receptionRepositoryProvider).cancelBooking(booking.id);
  if (booking.roomId != null) {
    await ref
        .read(receptionRepositoryProvider)
        .updateRoomStatus(booking.roomId!, 'available');
  }
  onSuccess();
  if (context.mounted) _snack(context, 'Reservation cancelled');
}

Future<void> _deleteGuest(BuildContext context, WidgetRef ref, Guest guest,
    VoidCallback onSuccess) async {
  final confirmed = await _confirm(context, 'Delete ${guest.name}?');
  if (!confirmed) return;
  await ref.read(receptionRepositoryProvider).deleteGuest(guest.id);
  onSuccess();
  if (context.mounted) _snack(context, 'Guest deleted');
}

Future<void> _checkoutRoom(BuildContext context, WidgetRef ref, Room room,
    VoidCallback onSuccess) async {
  final bookings =
      await ref.read(receptionRepositoryProvider).getRoomBookings(room.id);
  final active =
      bookings.where((b) => _text(b, ['status']) == 'checked_in').firstOrNull;
  if (active != null) {
    await ref.read(receptionRepositoryProvider).checkOut('${active['id']}');
  }
  await ref
      .read(receptionRepositoryProvider)
      .updateRoomStatus(room.id, 'cleaning');
  onSuccess();
  if (context.mounted) _snack(context, 'Room checked out and sent to cleaning');
}

Future<void> _downloadCheckoutBill(
    BuildContext context, WidgetRef ref, Booking booking) async {
  try {
    final total = (booking.totalAmount ?? 0) > 0
        ? booking.totalAmount!
        : booking.balance + (booking.amountPaid ?? 0);
    final nights = booking.checkOut.difference(booking.checkIn).inDays;
    final file =
        await ref.read(receptionRepositoryProvider).downloadCheckoutBill({
      // Short, human-readable reference (matches POS proforma codes), not the UUID.
      'booking_id': booking.confirmationNumber ?? booking.id,
      'guest_name': booking.guestName,
      'guest_phone': booking.guestPhone,
      'room_number': booking.roomNumber,
      'nights': nights > 0 ? nights : 1,
      'check_in': booking.checkIn.toIso8601String(),
      'check_out': booking.checkOut.toIso8601String(),
      'room_charges': total,
      'additional_charges': 0,
      'total_amount': total,
      'amount_paid': booking.amountPaid ?? 0,
      'balance': booking.balance,
    });
    if (context.mounted) {
      _snack(context, 'Checkout bill saved to ${file.path}');
    }
  } catch (error) {
    if (context.mounted) {
      _snack(context, 'Checkout bill download failed: $error', error: true);
    }
  }
}

Future<void> _downloadConferenceInvoice(
    BuildContext context, WidgetRef ref, String id) async {
  try {
    final file = await ref
        .read(receptionRepositoryProvider)
        .downloadConferenceInvoice(id);
    if (context.mounted) {
      _snack(context, 'Conference invoice saved to ${file.path}');
    }
  } catch (error) {
    if (context.mounted) {
      _snack(context, 'Invoice download failed: $error', error: true);
    }
  }
}

Future<void> _showFolioDialog(BuildContext context, Booking booking) async {
  await showDialog<void>(
    context: context,
    builder: (_) => AlertDialog(
      title: const Text('Folio'),
      content: SizedBox(
        width: 420,
        child: _KeyValueList(rows: [
          {'label': 'Guest', 'value': booking.guestName ?? '-'},
          {'label': 'Room', 'value': booking.roomNumber ?? '-'},
          {'label': 'Total', 'value': _money(booking.totalAmount ?? 0)},
          {'label': 'Paid', 'value': _money(booking.amountPaid ?? 0)},
          {'label': 'Balance', 'value': _money(booking.balance)},
        ]),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context), child: const Text('Close'))
      ],
    ),
  );
}

Future<void> _showConferenceBookingDialog(BuildContext context, WidgetRef ref,
    List<Map<String, dynamic>> halls, VoidCallback onSuccess) async {
  final hallIds = halls
      .map((h) => _text(h, ['id']) ?? '')
      .where((id) => id.isNotEmpty)
      .toList();
  final hallLabels = <String, String>{
    for (final h in halls)
      if ((_text(h, ['id']) ?? '').isNotEmpty)
        _text(h, ['id'])!: () {
          final name = _text(h, ['name', 'hall_name', 'title']) ?? 'Hall';
          final price = _num(
              h, ['base_price_per_day', 'price_per_day', 'rate', 'price', 'amount']);
          return price > 0 ? '$name • ${_money(price)}/day' : name;
        }(),
  };
  await showDialog<void>(
    context: context,
    builder: (_) => _RecordDialog(
      title: 'Book Conference Hall',
      fields: [
        _RecordField('hall_id', 'Hall',
            options: hallIds.ifEmpty(['']), optionLabels: hallLabels),
        const _RecordField('company_name', 'Company / Client'),
        const _RecordField('contact_person', 'Contact person'),
        const _RecordField('customer_phone', 'Phone'),
        _RecordField('start_date', 'Start date/time',
            initial: DateFormat('yyyy-MM-dd HH:mm').format(DateTime.now())),
        _RecordField('end_date', 'End date/time',
            initial: DateFormat('yyyy-MM-dd HH:mm')
                .format(DateTime.now().add(const Duration(hours: 4)))),
        const _RecordField('num_participants', 'Participants',
            numeric: true, initial: '1'),
        const _RecordField('total_amount', 'Total amount',
            numeric: true, initial: '0'),
      ],
      onSubmit: (values) async {
        await ref
            .read(receptionRepositoryProvider)
            .createConferenceBooking(values);
        onSuccess();
      },
    ),
  );
}

Future<void> _showCateringDialog(
    BuildContext context, WidgetRef ref, VoidCallback onSuccess) async {
  await showDialog<void>(
    context: context,
    builder: (_) => _RecordDialog(
      title: 'Book Catering Event',
      fields: [
        const _RecordField('customer_name', 'Customer name'),
        const _RecordField('customer_phone', 'Phone'),
        const _RecordField('event_location', 'Event location'),
        _RecordField('event_date', 'Event date/time',
            initial: DateFormat('yyyy-MM-dd HH:mm')
                .format(DateTime.now().add(const Duration(days: 1)))),
        const _RecordField('guest_count', 'Guest count',
            numeric: true, initial: '1'),
        const _RecordField('menu_details', 'Menu details', multiline: true),
        const _RecordField('total_amount', 'Total amount',
            numeric: true, initial: '0'),
      ],
      onSubmit: (values) async {
        await ref
            .read(receptionRepositoryProvider)
            .createCateringBooking(values);
        onSuccess();
      },
    ),
  );
}

Future<void> _showDynamicBillDialog(
    BuildContext context, WidgetRef ref, VoidCallback onSuccess) async {
  await showDialog<void>(
    context: context,
    builder: (_) => _RecordDialog(
      title: 'Create Dynamic Bill',
      fields: const [
        _RecordField('customer_name', 'Customer name'),
        _RecordField('bill_type', 'Bill type', options: [
          'misc',
          'room_service',
          'conference',
          'catering',
          'credit'
        ]),
        _RecordField('description', 'Description', multiline: true),
        _RecordField('total_amount', 'Total amount',
            numeric: true, initial: '0'),
      ],
      onSubmit: (values) async {
        await ref.read(receptionRepositoryProvider).createDynamicBill(values);
        onSuccess();
      },
    ),
  );
}

// Open the full cashier station for this bill, with the bill reference and the
// outstanding amount pre-filled and ready for payment confirmation.
void _openCashierForBill(BuildContext context, Map<String, dynamic> bill) {
  final ref0 = _text(bill, ['bill_number', 'invoice_number', 'id']);
  if (ref0 == null) return;
  final outstanding = _num(
      bill, ['balance', 'balance_amount', 'total_amount', 'amount']);
  context.go(
      '/cashier?billId=$ref0&amount=${outstanding.toStringAsFixed(0)}');
}

Future<void> _showAmountDialog(BuildContext context, String title,
    Future<void> Function(num amount, String method) onSubmit,
    {num initial = 0, bool withMethod = false}) async {
  final amount = TextEditingController(
      text: initial > 0 ? initial.toStringAsFixed(0) : '');
  String method = 'cash';
  await showDialog<void>(
    context: context,
    builder: (_) => StatefulBuilder(
      builder: (context, setLocal) => AlertDialog(
        title: Text(title),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(
              controller: amount,
              autofocus: true,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                  labelText: 'Amount', prefixText: 'KES ')),
          if (withMethod) ...[
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: method,
              decoration: const InputDecoration(labelText: 'Payment method'),
              items: const [
                DropdownMenuItem(value: 'cash', child: Text('Cash')),
                DropdownMenuItem(value: 'mpesa', child: Text('M-Pesa')),
                DropdownMenuItem(value: 'card', child: Text('Card')),
              ],
              onChanged: (v) => setLocal(() => method = v ?? 'cash'),
            ),
          ],
        ]),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              final value = num.tryParse(amount.text.trim()) ?? 0;
              if (value <= 0) {
                _snack(context, 'Enter an amount greater than zero',
                    error: true);
                return;
              }
              try {
                await onSubmit(value, method);
                if (context.mounted) Navigator.pop(context);
              } catch (e) {
                if (context.mounted) {
                  _snack(context, apiErrorMessage(e, fallback: 'Payment failed'),
                      error: true);
                }
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    ),
  );
}

Future<void> _showAttendanceDialog(BuildContext context, WidgetRef ref) async {
  await showDialog<void>(
    context: context,
    builder: (_) => AlertDialog(
      title: const Text('Staff Attendance'),
      content: const Text(
          'Clock front desk attendance for the current authenticated staff member.'),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        OutlinedButton(
            onPressed: () async {
              await ref.read(receptionRepositoryProvider).clockAttendance('in');
              if (context.mounted) Navigator.pop(context);
            },
            child: const Text('Clock In')),
        ElevatedButton(
            onPressed: () async {
              await ref
                  .read(receptionRepositoryProvider)
                  .clockAttendance('out');
              if (context.mounted) Navigator.pop(context);
            },
            child: const Text('Clock Out')),
      ],
    ),
  );
}

Future<void> _showPettyCashDialog(BuildContext context, WidgetRef ref) async {
  await showDialog<void>(
    context: context,
    builder: (_) => _RecordDialog(
      title: 'Petty Cash Request',
      fields: const [
        _RecordField('amount', 'Amount', numeric: true),
        _RecordField('category', 'Category'),
        _RecordField('description', 'Description', multiline: true),
      ],
      onSubmit: (values) =>
          ref.read(receptionRepositoryProvider).requestPettyCash(values),
      submitLabel: 'Request',
    ),
  );
}

Future<bool> _confirm(BuildContext context, String message) async {
  return await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Confirm action'),
          content: Text(message),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel')),
            ElevatedButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Confirm')),
          ],
        ),
      ) ??
      false;
}

void _snack(BuildContext context, String message, {bool error = false}) {
  AppNotifier.showSnackBar(
    context,
    SnackBar(
      content: Text(message),
      backgroundColor: error ? AppColors.kError : null,
    ),
  );
}

String? _text(Map<String, dynamic> row, List<String> keys) {
  for (final key in keys) {
    final value = _nested(row, key);
    if (value != null && '$value'.isNotEmpty && '$value' != 'null') {
      return '$value';
    }
  }
  return null;
}

num _num(Map<String, dynamic> row, List<String> keys) {
  for (final key in keys) {
    final value = _nested(row, key);
    if (value is num) return value;
    final parsed = num.tryParse('$value');
    if (parsed != null) return parsed;
  }
  return 0;
}

dynamic _nested(Map<String, dynamic> row, String path) {
  dynamic current = row;
  for (final part in path.split('.')) {
    if (current is Map) {
      current = current[part];
    } else {
      return null;
    }
  }
  return current;
}

String _cell(dynamic value) {
  if (value == null) return '-';
  if (value is num && value > 999) return _money(value);
  final date = DateTime.tryParse('$value');
  if (date != null && '$value'.contains('-')) {
    return DateFormat('MMM d, yyyy').format(date);
  }
  return '$value';
}

String _date(DateTime value) => DateFormat('MMM d, yyyy').format(value);

String _money(num value) =>
    NumberFormat.currency(symbol: 'KES ', decimalDigits: 0).format(value);

String _label(String value) =>
    value.replaceAll('_', ' ').split(' ').map((part) {
      if (part.isEmpty) return part;
      return '${part[0].toUpperCase()}${part.substring(1)}';
    }).join(' ');

bool _sameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

Color _statusColor(String status) {
  switch (status) {
    case 'available':
    case 'clean':
    case 'confirmed':
    case 'paid':
    case 'completed':
    case 'approved':
      return AppColors.kSuccess;
    case 'occupied':
    case 'checked_in':
    case 'partial':
    case 'in_progress':
      return Colors.blue;
    case 'cleaning':
    case 'dirty':
    case 'pending':
    case 'reserved':
    case 'unpaid':
      return AppColors.kWarning;
    case 'maintenance':
    case 'cancelled':
    case 'rejected':
      return AppColors.kError;
    default:
      return AppColors.kPrimary;
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

extension _IfEmpty<T> on List<T> {
  List<T> ifEmpty(List<T> fallback) => isEmpty ? fallback : this;
}
