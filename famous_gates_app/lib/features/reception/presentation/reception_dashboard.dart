import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:dio/dio.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../../../core/config/app_config.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/api_error_message.dart';
import '../../../core/widgets/master_dashboard_shell.dart';
import '../../../core/widgets/error_state.dart';
import '../../../core/widgets/loading_skeleton.dart';
import '../../../core/widgets/stat_card.dart';
import '../../cashier/presentation/cashier_dashboard.dart';
import '../data/repository.dart';
import '../domain/models.dart';
import '../../templates/data/document_printer.dart';
import '../../pos/domain/models.dart';
import '../../shared/presentation/room_bills_view.dart';
import 'screens/screens.dart';

enum ReceptionSection {
  overview,
  reservations,
  checkInOut,
  breakfastPax,
  rooms,
  roomBills,
  guests,
  guestProfile,
  housekeeping,
  conference,
  catering,
  cashier,
  history,
  emailAutomation,
}

class ReceptionDashboard extends ConsumerStatefulWidget {
  const ReceptionDashboard({
    super.key,
    this.initialSection = ReceptionSection.overview,
    this.guestId,
    this.cashierBillRef,
    this.cashierAmount,
    this.cashierMethod,
  });

  final ReceptionSection initialSection;
  final String? guestId;
  final String? cashierBillRef;
  final String? cashierAmount;
  final String? cashierMethod;

  @override
  ConsumerState<ReceptionDashboard> createState() => _ReceptionDashboardState();
}

class _ReceptionDashboardState extends ConsumerState<ReceptionDashboard> {
  late ReceptionSection _section = widget.initialSection;
  late String? _guestId = widget.guestId;
  late String? _cashierBillRef = widget.cashierBillRef;
  late String? _cashierAmount = widget.cashierAmount;
  late String? _cashierMethod = widget.cashierMethod;
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
    final rawGuestProfile = _guestId == null
        ? <String, dynamic>{}
        : await guard(_repo.getGuest(_guestId!), <String, dynamic>{});
    final guestFallback = _guestId == null
        ? <String, dynamic>{}
        : guestRows.firstWhere(
            (row) => '${row['id'] ?? row['guest_id'] ?? ''}' == _guestId,
            orElse: () => <String, dynamic>{},
          );
    final guestProfile = _guestId == null
        ? <String, dynamic>{}
        : _normalizeGuestProfile({...guestFallback, ...rawGuestProfile});

    final rawGuestHistory = _guestId == null
        ? <Map<String, dynamic>>[]
        : await guard(
            _repo.getGuestHistory(_guestId!), <Map<String, dynamic>>[]);
    final bookingHistoryFallback = _guestId == null
        ? <Map<String, dynamic>>[]
        : bookingRows
            .where((row) =>
                '${row['guest_id'] ?? row['guestId'] ?? ''}' == _guestId)
            .map((row) => Map<String, dynamic>.from(row))
            .toList();
    final guestHistory = _normalizeStayHistory(
      rawGuestHistory.isEmpty ? bookingHistoryFallback : rawGuestHistory,
    );
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
      setState(() {
        _section = section;
        _cashierBillRef = null;
        _cashierAmount = null;
        _cashierMethod = null;
      });
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
      palette: const ShellPalette(
        background: Color(0xFFF4F0FA),
        surface: Colors.white,
        accent: AppColors.kPrimary,
      ),
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
            section: ReceptionSection.breakfastPax,
            label: 'Breakfast Pax',
            icon: Icons.free_breakfast_outlined,
            group: 'Front Desk'),
        MasterNavItem(
            section: ReceptionSection.rooms,
            label: 'Rooms',
            icon: Icons.bed_outlined,
            group: 'Front Desk'),
        MasterNavItem(
            section: ReceptionSection.roomBills,
            label: 'Room Bills',
            icon: Icons.receipt_long_outlined,
            group: 'Front Desk'),
        MasterNavItem(
            section: ReceptionSection.cashier,
            label: 'Cashier',
            icon: Icons.point_of_sale_outlined,
            group: 'Cashier'),
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
            section: ReceptionSection.history,
            label: 'History',
            icon: Icons.history_outlined,
            group: 'Audit'),
        MasterNavItem(
            section: ReceptionSection.emailAutomation,
            label: 'Email Automation',
            icon: Icons.auto_fix_high_outlined,
            group: 'Automation'),
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
      case ReceptionSection.breakfastPax:
        return const _BreakfastPaxSection();
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
      case ReceptionSection.roomBills:
        // Reception tracks room bills / folios read-only; the cashier settles.
        return const RoomBillsView(canSettle: false);
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
        return _CashierSection(
          billRef: _cashierBillRef,
          amount: _cashierAmount,
          method: _cashierMethod,
        );
      case ReceptionSection.history:
        return _HistorySection(data: data, onRefresh: _refresh);
      case ReceptionSection.emailAutomation:
        return _EmailAutomationSection(data: data, onRefresh: _refresh);
    }
  }

  Map<String, dynamic> _normalizeGuestProfile(Map<String, dynamic> raw) {
    final row = Map<String, dynamic>.from(raw);
    for (final key in const ['guest', 'profile', 'data']) {
      final nested = row[key];
      if (nested is Map) {
        row.addAll(Map<String, dynamic>.from(nested));
      }
    }

    final first = _text(row, const ['first_name', 'firstName']) ?? '';
    final last = _text(row, const ['last_name', 'lastName']) ?? '';
    final joined = '$first $last'.trim();
    if ((_text(row, const ['full_name', 'name']) ?? '').isEmpty &&
        joined.isNotEmpty) {
      row['full_name'] = joined;
    }

    row['phone'] ??= row['phone_number'] ?? row['mobile'] ?? row['contact'];
    row['email'] ??= row['email_address'];
    row['id_number'] ??=
        row['national_id'] ?? row['passport_number'] ?? row['document_number'];
    row['car_number_plate'] ??= row['vehicle_plate'] ??
        row['vehiclePlate'] ??
        row['carPlate'] ??
        row['number_plate'];
    return row;
  }

  List<Map<String, dynamic>> _normalizeStayHistory(
      List<Map<String, dynamic>> rows) {
    return rows.map((raw) {
      final row = Map<String, dynamic>.from(raw);

      void flatten(String key) {
        final nested = row[key];
        if (nested is Map) row.addAll(Map<String, dynamic>.from(nested));
      }

      flatten('booking');
      flatten('reservation');

      final room = row['room'];
      if (room is Map) {
        final map = Map<String, dynamic>.from(room);
        row['room_number'] ??=
            map['room_number'] ?? map['number'] ?? map['name'];
        row['room_type'] ??= map['room_type'] ?? map['type'];
      }

      row['booking_number'] ??= row['confirmation_number'] ??
          row['confirmationNumber'] ??
          row['booking_reference'] ??
          row['reference'] ??
          row['id'];
      row['room_number'] ??= row['roomNumber'];
      row['check_in'] ??= row['check_in_date'] ?? row['checkInDate'];
      row['check_out'] ??= row['check_out_date'] ?? row['checkOutDate'];
      row['total_amount'] ??=
          row['grand_total'] ?? row['amount'] ?? row['balance_amount'];
      return row;
    }).toList();
  }
}

class _BreakfastSummaryCard extends StatelessWidget {
  const _BreakfastSummaryCard({
    required this.title,
    required this.mainText,
    required this.subText,
    required this.icon,
  });

  final String title;
  final String mainText;
  final String subText;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 240,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: AppColors.kPrimary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey.shade800),
                  maxLines: 2,
                  softWrap: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(mainText,
              style:
                  const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(subText,
              style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
        ],
      ),
    );
  }
}

class _BreakfastPaxSection extends ConsumerStatefulWidget {
  const _BreakfastPaxSection();

  @override
  ConsumerState<_BreakfastPaxSection> createState() =>
      _BreakfastPaxSectionState();
}

class _BreakfastPaxSectionState extends ConsumerState<_BreakfastPaxSection> {
  late final TextEditingController _dateController;
  final TextEditingController _confirmedAdultsController =
      TextEditingController();
  final TextEditingController _confirmedChildrenController =
      TextEditingController();
  final TextEditingController _paidExtraController =
      TextEditingController(text: '0');
  final TextEditingController _complimentaryController =
      TextEditingController(text: '0');
  final TextEditingController _reasonController = TextEditingController();
  final TextEditingController _searchController = TextEditingController();

  bool _saving = false;
  int _activeTab = 0;
  String _mealPlanFilter = 'all';
  String _quickFilter = 'all';

  final Set<String> _expandedRowIds = {};
  final Set<String> _excludedBookingIds = {};
  final Set<String> _earlyBreakfastIds = {};
  final Set<String> _packedBreakfastIds = {};
  final Map<String, String> _dietaryNotes = {};
  final List<Map<String, dynamic>> _paidEntries = [];
  final List<Map<String, dynamic>> _complimentaryEntries = [];
  final List<Map<String, dynamic>> _versionsHistory = [];

  late Future<Map<String, dynamic>> _future;
  ReceptionRepository get _repo => ref.read(receptionRepositoryProvider);

  @override
  void initState() {
    super.initState();
    final today = DateTime.now();
    _dateController = TextEditingController(
      text: DateFormat('yyyy-MM-dd').format(today),
    );
    _future = _load();
  }

  @override
  void dispose() {
    _dateController.dispose();
    _confirmedAdultsController.dispose();
    _confirmedChildrenController.dispose();
    _paidExtraController.dispose();
    _complimentaryController.dispose();
    _reasonController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<Map<String, dynamic>> _load() async {
    final data = await _repo.getDailyBreakfastPax(date: _dateController.text);
    final bookings =
        (data['eligible_bookings'] as List?)?.whereType<Map>().toList() ?? [];

    int calcAdults = 0;
    int calcChildren = 0;
    for (final b in bookings) {
      calcAdults += (b['adults'] as num?)?.toInt() ??
          (b['pax'] as num?)?.toInt() ??
          1;
      calcChildren += (b['children'] as num?)?.toInt() ?? 0;
    }

    if (_confirmedAdultsController.text.isEmpty) {
      _confirmedAdultsController.text = '$calcAdults';
    }
    if (_confirmedChildrenController.text.isEmpty) {
      _confirmedChildrenController.text = '$calcChildren';
    }
    _reasonController.text = data['adjustment_reason']?.toString() ?? '';
    return data;
  }

  void _refresh() {
    setState(() {
      _future = _load();
    });
  }

  Future<void> _save(String statusTarget) async {
    if (statusTarget == 'confirmed') {
      _showConfirmKitchenDialog();
      return;
    }
    await _executeSave('draft');
  }

  Future<void> _executeSave(String status) async {
    setState(() => _saving = true);
    try {
      final adults = int.tryParse(_confirmedAdultsController.text) ?? 0;
      final children = int.tryParse(_confirmedChildrenController.text) ?? 0;
      final paid = int.tryParse(_paidExtraController.text) ?? 0;
      final compl = int.tryParse(_complimentaryController.text) ?? 0;
      final total =
          adults + children + paid + compl - _excludedBookingIds.length;

      await _repo.saveDailyBreakfastPax(
        date: _dateController.text,
        confirmedPax: total,
        status: status,
        adjustmentReason: _reasonController.text,
      );

      final versionNum = _versionsHistory.length + 1;
      _versionsHistory.insert(0, {
        'version': versionNum,
        'status': status,
        'pax': total,
        'adults': adults,
        'children': children,
        'reason': _reasonController.text.isEmpty
            ? 'Routine pax confirmation'
            : _reasonController.text,
        'timestamp': DateFormat('HH:mm:ss').format(DateTime.now()),
        'user': 'Reception User',
      });

      _refresh();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.kSuccess,
          content: Text(status == 'draft'
              ? 'Breakfast pax draft saved successfully.'
              : 'Breakfast pax (v$versionNum) confirmed and dispatched to Kitchen!'),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.kError,
          content: Text(apiErrorMessage(error)),
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting &&
              !snapshot.hasData) {
            return const LoadingSkeleton(type: SkeletonType.list);
          }
          if (snapshot.hasError) {
            return ErrorState(
              message: apiErrorMessage(snapshot.error ?? 'Unknown error'),
              onRetry: _refresh,
            );
          }

          final data = snapshot.data ?? const <String, dynamic>{};
          final checkedIn =
              (data['checked_in_reservations'] as num?)?.toInt() ?? 0;
          final eligible =
              (data['eligible_reservations'] as num?)?.toInt() ?? 0;
          final status =
              (data['status']?.toString() ?? 'unconfirmed').toLowerCase();
          final bookings =
              (data['eligible_bookings'] as List?)?.whereType<Map>().toList() ??
                  const <Map>[];

          final typedBookings =
              bookings.map((b) => Map<String, dynamic>.from(b)).toList();

          int calcAdults = 0;
          int calcChildren = 0;
          final Set<String> occupiedRooms = {};
          for (final b in typedBookings) {
            calcAdults += (b['adults'] as num?)?.toInt() ??
                (b['pax'] as num?)?.toInt() ??
                1;
            calcChildren += (b['children'] as num?)?.toInt() ?? 0;
            final rm = b['room_number']?.toString() ?? b['room']?.toString();
            if (rm != null && rm.isNotEmpty) occupiedRooms.add(rm);
          }
          final calcTotal = calcAdults + calcChildren;

          final confAdults =
              int.tryParse(_confirmedAdultsController.text) ?? calcAdults;
          final confChildren =
              int.tryParse(_confirmedChildrenController.text) ?? calcChildren;
          final paidExtra = int.tryParse(_paidExtraController.text) ?? 0;
          final compl = int.tryParse(_complimentaryController.text) ?? 0;
          final excludedCount = _excludedBookingIds.length;
          final finalConfirmedTotal =
              confAdults + confChildren + paidExtra + compl - excludedCount;
          final adjustment = finalConfirmedTotal - calcTotal;

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Daily Breakfast Pax',
                            style: TextStyle(
                                fontSize: 24, fontWeight: FontWeight.w800)),
                        SizedBox(height: 4),
                        Text(
                          'Reception confirms accommodation breakfast pax for the kitchen session and closing reconciliation.',
                          style: TextStyle(color: Colors.grey),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(
                    width: 160,
                    child: TextFormField(
                      controller: _dateController,
                      decoration: const InputDecoration(
                        labelText: 'Breakfast date',
                        border: OutlineInputBorder(),
                        contentPadding:
                            EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      onFieldSubmitted: (_) => _refresh(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    onPressed: _refresh,
                    icon: const Icon(Icons.refresh, size: 18),
                    label: const Text('Reload'),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    onPressed: () => _showExportPdfDialog(typedBookings),
                    icon: const Icon(Icons.picture_as_pdf,
                        size: 18, color: Colors.red),
                    label: const Text('Export PDF'),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    onPressed: _showVersionHistoryDialog,
                    icon: const Icon(Icons.history, size: 18),
                    label: const Text('View History'),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 16,
                runSpacing: 16,
                children: [
                  _BreakfastSummaryCard(
                    title: 'Checked-in bookings',
                    mainText: '$checkedIn bookings',
                    subText: '${occupiedRooms.length} occupied rooms',
                    icon: Icons.hotel_outlined,
                  ),
                  _BreakfastSummaryCard(
                    title: 'Breakfast-eligible stays',
                    mainText: '$eligible stays',
                    subText: 'BB, HB and FB plans',
                    icon: Icons.people_alt_outlined,
                  ),
                  _BreakfastSummaryCard(
                    title: 'Calculated pax',
                    mainText: '$calcTotal',
                    subText: '$calcAdults adults · $calcChildren children',
                    icon: Icons.calculate_outlined,
                  ),
                  _BreakfastSummaryCard(
                    title: 'Confirmed pax',
                    mainText: '$finalConfirmedTotal',
                    subText: status == 'confirmed'
                        ? 'Confirmed (v${_versionsHistory.length})'
                        : 'Status: ${status.toUpperCase()}',
                    icon: Icons.verified_outlined,
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: status == 'confirmed'
                      ? Colors.green.shade50
                      : Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: status == 'confirmed'
                        ? Colors.green.shade300
                        : Colors.orange.shade300,
                  ),
                ),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: status == 'confirmed'
                              ? Colors.green.shade100
                              : Colors.orange.shade100,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          'Status: ${status.replaceAll('_', ' ').toUpperCase()}',
                          style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                              color: status == 'confirmed'
                                  ? Colors.green.shade900
                                  : Colors.orange.shade900),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Text('Calculated: $calcTotal',
                          style: const TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(width: 14),
                      _barInput('Confirmed Adults', _confirmedAdultsController, 125),
                      const SizedBox(width: 10),
                      _barInput('Confirmed Children', _confirmedChildrenController, 130),
                      const SizedBox(width: 10),
                      _barInput('Paid Extra', _paidExtraController, 105),
                      const SizedBox(width: 10),
                      _barInput('Complimentary', _complimentaryController, 115),
                      const SizedBox(width: 14),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Confirmed Total',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Colors.grey.shade800,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '$finalConfirmedTotal pax',
                            style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w900,
                                color: AppColors.kPrimary),
                          ),
                        ],
                      ),
                      const SizedBox(width: 14),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Adjustment',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Colors.grey.shade800,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '${adjustment >= 0 ? "+$adjustment" : "$adjustment"}',
                            style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: adjustment == 0
                                    ? Colors.grey
                                    : (adjustment > 0
                                        ? Colors.green.shade800
                                        : Colors.red.shade800)),
                          ),
                        ],
                      ),
                      const SizedBox(width: 14),
                      SizedBox(
                        width: 220,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text(
                              'Adjustment Reason',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF334155),
                              ),
                            ),
                            const SizedBox(height: 3),
                            TextField(
                              controller: _reasonController,
                              style: const TextStyle(fontSize: 12),
                              decoration: InputDecoration(
                                hintText: 'Adjustment reason...',
                                isDense: true,
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(6),
                                  borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(6),
                                  borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(6),
                                  borderSide: const BorderSide(color: AppColors.kPrimary, width: 1.5),
                                ),
                                contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 7),
                                fillColor: Colors.white,
                                filled: true,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      ElevatedButton(
                        onPressed: _saving ? null : () => _save('draft'),
                        style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: Colors.black87),
                        child: const Text('Save Draft'),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: _saving ? null : () => _save('confirmed'),
                        child: const Text('Confirm for Kitchen'),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  _tabButton(0, 'Eligible Guests (${typedBookings.length})'),
                  _tabButton(1, 'Expected Arrivals'),
                  _tabButton(2, 'Checkout Today'),
                  _tabButton(3, 'Paid & Complimentary (${_paidEntries.length + _complimentaryEntries.length})'),
                  _tabButton(4, 'Changes / Audit (${_versionsHistory.length})'),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  SizedBox(
                    width: 260,
                    child: TextField(
                      controller: _searchController,
                      onChanged: (_) => setState(() {}),
                      decoration: InputDecoration(
                        hintText: 'Search room, guest, ref...',
                        prefixIcon: const Icon(Icons.search, size: 18),
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 8),
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  DropdownButton<String>(
                    value: _mealPlanFilter,
                    underline: const SizedBox(),
                    items: const [
                      DropdownMenuItem(value: 'all', child: Text('All Meal Plans')),
                      DropdownMenuItem(value: 'bed_breakfast', child: Text('Bed & Breakfast')),
                      DropdownMenuItem(value: 'half_board', child: Text('Half Board')),
                      DropdownMenuItem(value: 'full_board', child: Text('Full Board')),
                    ],
                    onChanged: (val) {
                      if (val != null) setState(() => _mealPlanFilter = val);
                    },
                  ),
                  const SizedBox(width: 12),
                  DropdownButton<String>(
                    value: _quickFilter,
                    underline: const SizedBox(),
                    items: const [
                      DropdownMenuItem(value: 'all', child: Text('Quick Filter: All')),
                      DropdownMenuItem(value: 'in_house', child: Text('In-House Only')),
                      DropdownMenuItem(value: 'checkout_today', child: Text('Checkout Today')),
                      DropdownMenuItem(value: 'dietary', child: Text('Special Dietary Notes')),
                    ],
                    onChanged: (val) {
                      if (val != null) setState(() => _quickFilter = val);
                    },
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Expanded(
                child: Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: _buildActiveTabBody(typedBookings),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(12),
                    bottomRight: Radius.circular(12),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Adults: $calcAdults | Children: $calcChildren | Excluded: $excludedCount | Paid Extra: $paidExtra | Complimentary: $compl',
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                    ),
                    Text(
                      'Final Confirmed Pax: $finalConfirmedTotal',
                      style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                          color: AppColors.kPrimary),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showConfirmKitchenDialog() {
    final adults = int.tryParse(_confirmedAdultsController.text) ?? 0;
    final children = int.tryParse(_confirmedChildrenController.text) ?? 0;
    final paid = int.tryParse(_paidExtraController.text) ?? 0;
    final compl = int.tryParse(_complimentaryController.text) ?? 0;
    final finalPax =
        adults + children + paid + compl - _excludedBookingIds.length;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.soup_kitchen, color: AppColors.kPrimary),
            const SizedBox(width: 8),
            Text('Confirm Breakfast Pax for Kitchen (${_dateController.text})'),
          ],
        ),
        content: SizedBox(
          width: 500,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.grey.shade300),
                ),
                child: Column(
                  children: [
                    _dialogSummaryRow('Confirmed Adults', '$adults'),
                    _dialogSummaryRow('Confirmed Children', '$children'),
                    _dialogSummaryRow(
                        'Excluded Pax', '-${_excludedBookingIds.length}'),
                    _dialogSummaryRow('Paid Additional Pax', '+$paid'),
                    _dialogSummaryRow('Complimentary Pax', '+$compl'),
                    const Divider(),
                    _dialogSummaryRow('Final Confirmed Total', '$finalPax',
                        isBold: true),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Dietary & Special Entitlements:',
                style: TextStyle(
                    fontWeight: FontWeight.bold, color: Colors.grey.shade800),
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: [
                  Chip(
                    avatar: const Icon(Icons.alarm, size: 16),
                    label: Text('Early Breakfast: ${_earlyBreakfastIds.length}'),
                  ),
                  Chip(
                    avatar: const Icon(Icons.takeout_dining, size: 16),
                    label: Text('Packed Breakfast: ${_packedBreakfastIds.length}'),
                  ),
                  Chip(
                    avatar: const Icon(Icons.note_alt, size: 16),
                    label: Text('Dietary Notes: ${_dietaryNotes.length}'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (_reasonController.text.trim().isEmpty &&
                  _excludedBookingIds.isNotEmpty)
                Container(
                  padding: const EdgeInsets.all(8),
                  color: Colors.amber.shade50,
                  child: const Row(
                    children: [
                      Icon(Icons.warning_amber, color: Colors.amber),
                      SizedBox(width: 6),
                      Expanded(
                          child: Text(
                        'Note: Please ensure an adjustment reason is provided if totals differ from calculated.',
                        style: TextStyle(fontSize: 12),
                      )),
                    ],
                  ),
                ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          OutlinedButton(
            onPressed: () {
              Navigator.pop(ctx);
              _executeSave('draft');
            },
            child: const Text('Save Draft'),
          ),
          ElevatedButton.icon(
            icon: const Icon(Icons.send),
            label: const Text('Confirm & Send to Kitchen'),
            onPressed: () {
              Navigator.pop(ctx);
              _executeSave('confirmed');
            },
          ),
        ],
      ),
    );
  }

  Widget _dialogSummaryRow(String label, String value, {bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                  fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
                  fontSize: isBold ? 14 : 13)),
          Text(value,
              style: TextStyle(
                  fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
                  fontSize: isBold ? 14 : 13,
                  color: isBold ? AppColors.kPrimary : null)),
        ],
      ),
    );
  }

  void _showVersionHistoryDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.history, color: AppColors.kPrimary),
            SizedBox(width: 8),
            Text('Breakfast Confirmation Version History'),
          ],
        ),
        content: SizedBox(
          width: 540,
          height: 380,
          child: _versionsHistory.isEmpty
              ? const Center(
                  child: Text(
                      'No confirmation history recorded for this session date.'),
                )
              : ListView.separated(
                  itemCount: _versionsHistory.length,
                  separatorBuilder: (_, __) => const Divider(),
                  itemBuilder: (context, idx) {
                    final v = _versionsHistory[idx];
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor:
                            AppColors.kPrimary.withValues(alpha: 0.1),
                        child: Text('v${v['version']}'),
                      ),
                      title: Text(
                          'Version ${v['version']} - ${v['pax']} Confirmed Pax (${v['status'].toString().toUpperCase()})'),
                      subtitle: Text(
                          '${v['adults']} adults · ${v['children']} children\nReason: ${v['reason']}'),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(v['timestamp'] ?? ''),
                          Text(v['user'] ?? '',
                              style: const TextStyle(
                                  fontSize: 11, color: Colors.grey)),
                        ],
                      ),
                    );
                  },
                ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Future<void> _showExportPdfDialog(List<Map<String, dynamic>> bookings) async {
    String reportType = 'confirmed_guest_list';
    bool incGuestNames = true;
    bool incBookingRefs = true;
    bool incRoomNumbers = true;
    bool incDietaryNotes = true;
    bool incSignatureBlock = true;
    String formatType = 'portrait';

    await showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.picture_as_pdf, color: Colors.red),
              SizedBox(width: 8),
              Text('Export Breakfast Report'),
            ],
          ),
          content: SizedBox(
            width: 520,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Report Type',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    initialValue: reportType,
                    decoration:
                        const InputDecoration(border: OutlineInputBorder()),
                    items: const [
                      DropdownMenuItem(
                          value: 'confirmed_guest_list',
                          child: Text('A. Confirmed Breakfast Guest List')),
                      DropdownMenuItem(
                          value: 'kitchen_plan',
                          child: Text('B. Kitchen Breakfast Plan')),
                      DropdownMenuItem(
                          value: 'room_list',
                          child: Text('C. Room-by-Room Breakfast List')),
                      DropdownMenuItem(
                          value: 'pax_summary',
                          child: Text('D. Breakfast Pax Summary')),
                      DropdownMenuItem(
                          value: 'forecast',
                          child: Text('E. Date-Range Breakfast Forecast')),
                      DropdownMenuItem(
                          value: 'group_report',
                          child: Text('F. Group Breakfast Report')),
                      DropdownMenuItem(
                          value: 'audit_report',
                          child: Text('G. Adjustments & Audit Report')),
                    ],
                    onChanged: (val) {
                      if (val != null) setModalState(() => reportType = val);
                    },
                  ),
                  const SizedBox(height: 16),
                  const Text('Include Details',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  CheckboxListTile(
                    title: const Text('Guest Names'),
                    value: incGuestNames,
                    onChanged: (v) =>
                        setModalState(() => incGuestNames = v ?? true),
                  ),
                  CheckboxListTile(
                    title: const Text('Booking References'),
                    value: incBookingRefs,
                    onChanged: (v) =>
                        setModalState(() => incBookingRefs = v ?? true),
                  ),
                  CheckboxListTile(
                    title: const Text('Room Numbers'),
                    value: incRoomNumbers,
                    onChanged: (v) =>
                        setModalState(() => incRoomNumbers = v ?? true),
                  ),
                  CheckboxListTile(
                    title: const Text('Dietary & Special Notes'),
                    value: incDietaryNotes,
                    onChanged: (v) =>
                        setModalState(() => incDietaryNotes = v ?? true),
                  ),
                  CheckboxListTile(
                    title: const Text('Signature Block (Reception/Kitchen)'),
                    value: incSignatureBlock,
                    onChanged: (v) =>
                        setModalState(() => incSignatureBlock = v ?? true),
                  ),
                  const SizedBox(height: 12),
                  const Text('Page Format',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  Row(
                    children: [
                      Expanded(
                        child: RadioListTile<String>(
                          title: const Text('A4 Portrait'),
                          value: 'portrait',
                          groupValue: formatType,
                          onChanged: (v) =>
                              setModalState(() => formatType = v!),
                        ),
                      ),
                      Expanded(
                        child: RadioListTile<String>(
                          title: const Text('A4 Landscape'),
                          value: 'landscape',
                          groupValue: formatType,
                          onChanged: (v) =>
                              setModalState(() => formatType = v!),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton.icon(
              icon: const Icon(Icons.print),
              label: const Text('Print / Save PDF'),
              onPressed: () async {
                Navigator.pop(ctx);
                await _printPdfReport(
                  bookings: bookings,
                  reportType: reportType,
                  incGuestNames: incGuestNames,
                  incBookingRefs: incBookingRefs,
                  incRoomNumbers: incRoomNumbers,
                  incDietaryNotes: incDietaryNotes,
                  incSignatureBlock: incSignatureBlock,
                  isLandscape: formatType == 'landscape',
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _printPdfReport({
    required List<Map<String, dynamic>> bookings,
    required String reportType,
    required bool incGuestNames,
    required bool incBookingRefs,
    required bool incRoomNumbers,
    required bool incDietaryNotes,
    required bool incSignatureBlock,
    required bool isLandscape,
  }) async {
    final pdf = pw.Document();
    final pageFormat =
        isLandscape ? PdfPageFormat.a4.landscape : PdfPageFormat.a4;

    pw.MemoryImage? logoImage;
    try {
      final logoBytes =
          await rootBundle.load('assets/frontend_public/fglogo.png');
      logoImage = pw.MemoryImage(logoBytes.buffer.asUint8List());
    } catch (_) {}

    final adults = int.tryParse(_confirmedAdultsController.text) ?? 0;
    final children = int.tryParse(_confirmedChildrenController.text) ?? 0;
    final paid = int.tryParse(_paidExtraController.text) ?? 0;
    final compl = int.tryParse(_complimentaryController.text) ?? 0;
    final total =
        adults + children + paid + compl - _excludedBookingIds.length;

    String titleMap;
    String subtitleMap;
    switch (reportType) {
      case 'kitchen_plan':
        titleMap = 'B. Kitchen Breakfast Operations Plan';
        subtitleMap =
            'Operational kitchen breakdown for food preparation & portioning control.';
        break;
      case 'room_list':
        titleMap = 'C. Room-by-Room Breakfast Entrance List';
        subtitleMap =
            'Sequential room verification checklist for breakfast service counter.';
        break;
      case 'pax_summary':
        titleMap = 'D. Daily Breakfast Pax Executive Summary';
        subtitleMap =
            'Operational & Closing reconciliation breakdown of accommodation pax.';
        break;
      case 'forecast':
        titleMap = 'E. Multi-Day Breakfast Pax Forecast Report';
        subtitleMap =
            'Confirmed vs. Tentative upcoming breakfast pax projection.';
        break;
      case 'group_report':
        titleMap = 'F. Conference & Group Breakfast Manifest';
        subtitleMap =
            'Dedicated guest list and dietary requirements for groups & events.';
        break;
      case 'audit_report':
        titleMap = 'G. Breakfast Pax Adjustments & Audit Trail';
        subtitleMap =
            'Complete audit log of reception edits, overrides, and version changes.';
        break;
      case 'confirmed_guest_list':
      default:
        titleMap = 'A. Confirmed Breakfast Guest List';
        subtitleMap =
            'Official reception guest manifest for accommodation breakfast session.';
        break;
    }

    pdf.addPage(
      pw.MultiPage(
        pageFormat: pageFormat,
        margin: const pw.EdgeInsets.symmetric(horizontal: 36, vertical: 28),
        build: (pw.Context context) {
          return [
            // Standard Payroll/HR Header Block
            pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                if (logoImage != null)
                  pw.Image(logoImage, width: 72, height: 50)
                else
                  pw.Container(width: 72),
                pw.SizedBox(width: 16),
                pw.Expanded(
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('FamousGate Hotels',
                          style: pw.TextStyle(
                              fontWeight: pw.FontWeight.bold, fontSize: 16)),
                      pw.Text('Bomet, Kenya',
                          style: const pw.TextStyle(
                              fontSize: 10, color: PdfColors.grey700)),
                      pw.Text(
                          'Tel: +254 706 782 828 | Email: info@famousgatehotels.com',
                          style: const pw.TextStyle(
                              fontSize: 9, color: PdfColors.grey600)),
                    ],
                  ),
                ),
              ],
            ),
            pw.SizedBox(height: 12),

            // Banner Title Box (Payroll grey200 style)
            pw.Container(
              width: double.infinity,
              padding: const pw.EdgeInsets.all(10),
              decoration: const pw.BoxDecoration(
                color: PdfColors.grey200,
                borderRadius: pw.BorderRadius.all(pw.Radius.circular(4)),
              ),
              child: pw.Column(
                children: [
                  pw.Text(titleMap,
                      style: pw.TextStyle(
                          fontWeight: pw.FontWeight.bold, fontSize: 15)),
                  pw.SizedBox(height: 3),
                  pw.Text(subtitleMap,
                      style: const pw.TextStyle(
                          fontSize: 10, color: PdfColors.grey700)),
                  pw.SizedBox(height: 4),
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.center,
                    children: [
                      pw.Text('Breakfast Date: ${_dateController.text}  |  ',
                          style: const pw.TextStyle(
                              fontSize: 9, color: PdfColors.grey800)),
                      pw.Text(
                          'Status: ${_versionsHistory.isEmpty ? "UNCONFIRMED" : "CONFIRMED (v${_versionsHistory.length})"}  |  ',
                          style: pw.TextStyle(
                              fontSize: 9,
                              fontWeight: pw.FontWeight.bold,
                              color: PdfColors.grey800)),
                      pw.Text(
                          'Printed: ${DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now())}',
                          style: const pw.TextStyle(
                              fontSize: 9, color: PdfColors.grey600)),
                    ],
                  ),
                ],
              ),
            ),
            pw.SizedBox(height: 12),

            // Operational KPI Summary Box
            pw.Container(
              padding: const pw.EdgeInsets.all(8),
              decoration: pw.BoxDecoration(
                border: pw.Border.all(color: PdfColors.grey400, width: 0.5),
                color: PdfColors.grey100,
              ),
              child: pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceAround,
                children: [
                  pw.Text('Adults: $adults',
                      style: pw.TextStyle(
                          fontSize: 9, fontWeight: pw.FontWeight.bold)),
                  pw.Text('Children: $children',
                      style: pw.TextStyle(
                          fontSize: 9, fontWeight: pw.FontWeight.bold)),
                  pw.Text('Excluded: ${_excludedBookingIds.length}',
                      style: const pw.TextStyle(
                          fontSize: 9, color: PdfColors.red800)),
                  pw.Text('Paid Extras: $paid',
                      style: const pw.TextStyle(fontSize: 9)),
                  pw.Text('Complimentary: $compl',
                      style: const pw.TextStyle(fontSize: 9)),
                  pw.Text('Final Confirmed Pax: $total',
                      style: pw.TextStyle(
                          fontSize: 10,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColors.black)),
                ],
              ),
            ),
            pw.SizedBox(height: 12),

            // Main Table styled like Payroll (Grey300 headers, alternating rows)
            pw.Table(
              border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.5),
              children: [
                pw.TableRow(
                  decoration: const pw.BoxDecoration(color: PdfColors.grey300),
                  children: [
                    if (incRoomNumbers)
                      _tableHeaderCell('Room'),
                    if (incBookingRefs)
                      _tableHeaderCell('Booking Ref'),
                    if (incGuestNames && reportType != 'kitchen_plan')
                      _tableHeaderCell('Guest Name'),
                    _tableHeaderCell('Meal Plan'),
                    _tableHeaderCell('Adults'),
                    _tableHeaderCell('Children'),
                    _tableHeaderCell('Total Pax'),
                    if (incDietaryNotes)
                      _tableHeaderCell('Dietary / Notes'),
                  ],
                ),
                ...bookings.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final b = entry.value;
                  final refStr = b['confirmation_number']?.toString() ?? '-';
                  final isExcluded = _excludedBookingIds.contains(refStr);

                  final notes = <String>[];
                  if (_earlyBreakfastIds.contains(refStr)) notes.add('Early');
                  if (_packedBreakfastIds.contains(refStr)) notes.add('Packed');
                  if (_dietaryNotes.containsKey(refStr)) {
                    notes.add(_dietaryNotes[refStr]!);
                  }

                  return pw.TableRow(
                    decoration: pw.BoxDecoration(
                      color: idx.isOdd ? PdfColors.grey100 : PdfColors.white,
                    ),
                    children: [
                      if (incRoomNumbers)
                        _tableDataCell(b['room_number']?.toString() ??
                            b['room']?.toString() ??
                            '-'),
                      if (incBookingRefs)
                        _tableDataCell(refStr),
                      if (incGuestNames && reportType != 'kitchen_plan')
                        _tableDataCell(isExcluded
                            ? '${b['guest_name']} [EXCLUDED]'
                            : (b['guest_name']?.toString() ?? 'Guest')),
                      _tableDataCell(b['meal_plan']?.toString() ?? 'BB'),
                      _tableDataCell('${b['adults'] ?? 1}'),
                      _tableDataCell('${b['children'] ?? 0}'),
                      _tableDataCell(
                          '${(b['adults'] as num? ?? 1) + (b['children'] as num? ?? 0)}',
                          isBold: true),
                      if (incDietaryNotes)
                        _tableDataCell(
                            notes.isEmpty ? '-' : notes.join(', ')),
                    ],
                  );
                }),
              ],
            ),
            pw.SizedBox(height: 16),

            // Optional Payroll Signature Block
            if (incSignatureBlock) ...[
              pw.SizedBox(height: 10),
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('Prepared by (Reception):',
                          style: pw.TextStyle(
                              fontWeight: pw.FontWeight.bold, fontSize: 8)),
                      pw.SizedBox(height: 20),
                      pw.Text('_____________________________',
                          style: const pw.TextStyle(fontSize: 8)),
                      pw.Text('Name / Signature / Date',
                          style: const pw.TextStyle(
                              fontSize: 7, color: PdfColors.grey600)),
                    ],
                  ),
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('Confirmed by (Duty Manager):',
                          style: pw.TextStyle(
                              fontWeight: pw.FontWeight.bold, fontSize: 8)),
                      pw.SizedBox(height: 20),
                      pw.Text('_____________________________',
                          style: const pw.TextStyle(fontSize: 8)),
                      pw.Text('Name / Signature / Date',
                          style: const pw.TextStyle(
                              fontSize: 7, color: PdfColors.grey600)),
                    ],
                  ),
                  pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('Received by (Chef / Kitchen):',
                          style: pw.TextStyle(
                              fontWeight: pw.FontWeight.bold, fontSize: 8)),
                      pw.SizedBox(height: 20),
                      pw.Text('_____________________________',
                          style: const pw.TextStyle(fontSize: 8)),
                      pw.Text('Name / Signature / Date',
                          style: const pw.TextStyle(
                              fontSize: 7, color: PdfColors.grey600)),
                    ],
                  ),
                ],
              ),
            ],
          ];
        },
        footer: (pw.Context ctx) {
          return pw.Container(
            margin: const pw.EdgeInsets.only(top: 10),
            padding: const pw.EdgeInsets.only(top: 6),
            decoration: const pw.BoxDecoration(
              border: pw.Border(
                top: pw.BorderSide(color: PdfColors.grey300, width: 0.5),
              ),
            ),
            child: pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text(
                    'FamousGate Hotels | Confidential Operations Report | Generated by FG Systems',
                    style: const pw.TextStyle(
                        fontSize: 7, color: PdfColors.grey600)),
                pw.Text('Page ${ctx.pageNumber} of ${ctx.pagesCount}',
                    style: const pw.TextStyle(
                        fontSize: 7, color: PdfColors.grey600)),
              ],
            ),
          );
        },
      ),
    );

    await Printing.layoutPdf(
      onLayout: (PdfPageFormat format) async => pdf.save(),
      name: 'Breakfast_Report_${_dateController.text}.pdf',
    );
  }

  pw.Widget _tableHeaderCell(String text) {
    return pw.Padding(
      padding: const pw.EdgeInsets.all(5),
      child: pw.Text(
        text,
        style: pw.TextStyle(
            fontWeight: pw.FontWeight.bold,
            fontSize: 8,
            color: PdfColors.black),
      ),
    );
  }

  pw.Widget _tableDataCell(String text, {bool isBold = false}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.all(5),
      child: pw.Text(
        text,
        style: pw.TextStyle(
          fontSize: 8,
          fontWeight: isBold ? pw.FontWeight.bold : pw.FontWeight.normal,
        ),
      ),
    );
  }

  void _showAddPaidBreakfastDialog() {
    final guestCtrl = TextEditingController();
    final roomCtrl = TextEditingController();
    final adultsCtrl = TextEditingController(text: '1');
    final childCtrl = TextEditingController(text: '0');
    final amountCtrl = TextEditingController(text: '1200');
    String paymentMethod = 'cash';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Paid Extra Breakfast Ticket'),
        content: SizedBox(
          width: 400,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: guestCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Guest Name / Walk-in *',
                      border: OutlineInputBorder()),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: roomCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Room Number (Optional)',
                      border: OutlineInputBorder()),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: adultsCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                            labelText: 'Adults', border: OutlineInputBorder()),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: childCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                            labelText: 'Children', border: OutlineInputBorder()),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: amountCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                      labelText: 'Total Amount (KES)',
                      border: OutlineInputBorder()),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: paymentMethod,
                  decoration: const InputDecoration(
                      labelText: 'Payment Method', border: OutlineInputBorder()),
                  items: const [
                    DropdownMenuItem(value: 'cash', child: Text('Cash')),
                    DropdownMenuItem(value: 'mpesa', child: Text('M-Pesa')),
                    DropdownMenuItem(value: 'card', child: Text('Card')),
                    DropdownMenuItem(
                        value: 'room_charge', child: Text('Room Charge')),
                  ],
                  onChanged: (v) => paymentMethod = v ?? 'cash',
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              final a = int.tryParse(adultsCtrl.text) ?? 1;
              final c = int.tryParse(childCtrl.text) ?? 0;
              setState(() {
                _paidEntries.add({
                  'guest':
                      guestCtrl.text.isEmpty ? 'Walk-in Guest' : guestCtrl.text,
                  'room': roomCtrl.text,
                  'adults': a,
                  'children': c,
                  'amount': amountCtrl.text,
                  'method': paymentMethod,
                  'time': DateFormat('HH:mm').format(DateTime.now()),
                });
                _paidExtraController.text =
                    '${(int.tryParse(_paidExtraController.text) ?? 0) + a + c}';
              });
              Navigator.pop(ctx);
            },
            child: const Text('Add Paid Ticket'),
          ),
        ],
      ),
    );
  }

  void _showAddComplimentaryDialog() {
    final guestCtrl = TextEditingController();
    final roomCtrl = TextEditingController();
    final adultsCtrl = TextEditingController(text: '1');
    final childCtrl = TextEditingController(text: '0');
    final reasonCtrl = TextEditingController();
    final authCtrl = TextEditingController(text: 'GM / Reception');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Complimentary Breakfast Voucher'),
        content: SizedBox(
          width: 400,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: guestCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Guest Name *', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: roomCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Room Number / VIP', border: OutlineInputBorder()),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: adultsCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                            labelText: 'Adults', border: OutlineInputBorder()),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: childCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                            labelText: 'Children', border: OutlineInputBorder()),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: reasonCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Reason (VIP / Service Recovery)',
                      border: OutlineInputBorder()),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: authCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Authorized By', border: OutlineInputBorder()),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              final a = int.tryParse(adultsCtrl.text) ?? 1;
              final c = int.tryParse(childCtrl.text) ?? 0;
              setState(() {
                _complimentaryEntries.add({
                  'guest':
                      guestCtrl.text.isEmpty ? 'VIP Guest' : guestCtrl.text,
                  'room': roomCtrl.text,
                  'adults': a,
                  'children': c,
                  'reason': reasonCtrl.text,
                  'auth': authCtrl.text,
                  'time': DateFormat('HH:mm').format(DateTime.now()),
                });
                _complimentaryController.text =
                    '${(int.tryParse(_complimentaryController.text) ?? 0) + a + c}';
              });
              Navigator.pop(ctx);
            },
            child: const Text('Add Voucher'),
          ),
        ],
      ),
    );
  }

  Widget _barInput(
      String label, TextEditingController controller, double width) {
    return SizedBox(
      width: width,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: Color(0xFF334155),
            ),
            maxLines: 1,
            overflow: TextOverflow.visible,
          ),
          const SizedBox(height: 3),
          TextField(
            controller: controller,
            keyboardType: TextInputType.number,
            onChanged: (_) => setState(() {}),
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
            decoration: InputDecoration(
              isDense: true,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(6),
                borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(6),
                borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(6),
                borderSide: const BorderSide(color: AppColors.kPrimary, width: 1.5),
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              fillColor: Colors.white,
              filled: true,
            ),
          ),
        ],
      ),
    );
  }

  Widget _tabButton(int index, String label) {
    final active = _activeTab == index;
    return InkWell(
      onTap: () => setState(() => _activeTab = index),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        margin: const EdgeInsets.only(right: 6),
        decoration: BoxDecoration(
          color: active ? AppColors.kPrimary : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: active ? FontWeight.bold : FontWeight.w600,
            color: active ? Colors.white : Colors.grey.shade800,
          ),
        ),
      ),
    );
  }

  Widget _buildActiveTabBody(List<Map<String, dynamic>> typedBookings) {
    switch (_activeTab) {
      case 0:
        return _buildEligibleGuestsTab(typedBookings);
      case 1:
        return _buildExpectedArrivalsTab(typedBookings);
      case 2:
        return _buildCheckoutTodayTab(typedBookings);
      case 3:
        return _buildPaidAndComplimentaryTab();
      case 4:
        return _buildChangesAuditTab();
      default:
        return _buildEligibleGuestsTab(typedBookings);
    }
  }

  Widget _buildEligibleGuestsTab(List<Map<String, dynamic>> bookings) {
    var filtered = bookings.where((b) {
      final q = _searchController.text.toLowerCase();
      final guest = (b['guest_name'] ?? '').toString().toLowerCase();
      final room = (b['room_number'] ?? b['room'] ?? '').toString().toLowerCase();
      final refStr = (b['confirmation_number'] ?? '').toString().toLowerCase();
      if (q.isNotEmpty &&
          !guest.contains(q) &&
          !room.contains(q) &&
          !refStr.contains(q)) {
        return false;
      }
      final plan = (b['meal_plan'] ?? '').toString().toLowerCase();
      if (_mealPlanFilter != 'all' && !plan.contains(_mealPlanFilter)) {
        return false;
      }
      final refKey = b['confirmation_number']?.toString() ?? '';
      if (_quickFilter == 'dietary' && !_dietaryNotes.containsKey(refKey)) {
        return false;
      }
      return true;
    }).toList();

    if (filtered.isEmpty) {
      return const Center(
        child: Text('No breakfast-eligible guests match the current filters.'),
      );
    }

    return ListView.separated(
      itemCount: filtered.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final b = filtered[index];
        final refStr = b['confirmation_number']?.toString() ?? '-';
        final isExpanded = _expandedRowIds.contains(refStr);
        final isExcluded = _excludedBookingIds.contains(refStr);

        return Column(
          children: [
            ListTile(
              leading: CircleAvatar(
                backgroundColor: isExcluded
                    ? Colors.red.shade100
                    : AppColors.kPrimary.withValues(alpha: 0.1),
                child: Text(b['room_number']?.toString() ?? 'R'),
              ),
              title: Text(
                'Room ${b['room_number'] ?? '-'} • ${b['guest_name'] ?? 'Guest'}',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  decoration: isExcluded ? TextDecoration.lineThrough : null,
                ),
              ),
              subtitle: Text(
                  'Ref: $refStr • Plan: ${b['meal_plan'] ?? 'BB'} • Stay: ${b['check_in_date'] ?? '-'} to ${b['check_out_date'] ?? '-'}'),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: isExcluded
                          ? Colors.red.shade50
                          : Colors.green.shade50,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      isExcluded
                          ? 'Excluded'
                          : '${(b['adults'] ?? 1) + (b['children'] ?? 0)} pax',
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: isExcluded
                              ? Colors.red.shade800
                              : Colors.green.shade800),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: Icon(isExpanded
                        ? Icons.keyboard_arrow_up
                        : Icons.keyboard_arrow_down),
                    onPressed: () {
                      setState(() {
                        if (isExpanded) {
                          _expandedRowIds.remove(refStr);
                        } else {
                          _expandedRowIds.add(refStr);
                        }
                      });
                    },
                  ),
                ],
              ),
            ),
            if (isExpanded)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                color: Colors.grey.shade50,
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
                              const Text('Booking Info',
                                  style:
                                      TextStyle(fontWeight: FontWeight.bold)),
                              Text('Adults: ${b['adults'] ?? 1}'),
                              Text('Children: ${b['children'] ?? 0}'),
                              Text('Status: ${b['status'] ?? 'Checked-In'}'),
                            ],
                          ),
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Special Instructions',
                                  style:
                                      TextStyle(fontWeight: FontWeight.bold)),
                              Row(
                                children: [
                                  Checkbox(
                                    value: _earlyBreakfastIds.contains(refStr),
                                    onChanged: (v) => setState(() {
                                      if (v == true) {
                                        _earlyBreakfastIds.add(refStr);
                                      } else {
                                        _earlyBreakfastIds.remove(refStr);
                                      }
                                    }),
                                  ),
                                  const Text('Early Breakfast'),
                                ],
                              ),
                              Row(
                                children: [
                                  Checkbox(
                                    value: _packedBreakfastIds.contains(refStr),
                                    onChanged: (v) => setState(() {
                                      if (v == true) {
                                        _packedBreakfastIds.add(refStr);
                                      } else {
                                        _packedBreakfastIds.remove(refStr);
                                      }
                                    }),
                                  ),
                                  const Text('Packed Breakfast'),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: TextEditingController(
                          text: _dietaryNotes[refStr] ?? ''),
                      onChanged: (val) => _dietaryNotes[refStr] = val,
                      decoration: const InputDecoration(
                        hintText:
                            'Dietary notes (e.g. Vegetarian, Nut allergy)...',
                        isDense: true,
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        if (!isExcluded)
                          OutlinedButton.icon(
                            icon: const Icon(Icons.block,
                                size: 16, color: Colors.red),
                            label: const Text('Exclude from Breakfast'),
                            onPressed: () =>
                                setState(() => _excludedBookingIds.add(refStr)),
                          )
                        else
                          ElevatedButton.icon(
                            icon: const Icon(Icons.restore, size: 16),
                            label: const Text('Restore Guest'),
                            onPressed: () => setState(
                                () => _excludedBookingIds.remove(refStr)),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }

  Widget _buildExpectedArrivalsTab(List<Map<String, dynamic>> bookings) {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: bookings.map((b) {
        return ListTile(
          leading: const Icon(Icons.flight_land, color: Colors.blue),
          title: Text('${b['guest_name'] ?? 'Arrival Guest'} (${b['room_number'] ?? 'Unassigned'})'),
          subtitle: Text('Arrival: ${b['check_in_date'] ?? 'Today'} • Plan: ${b['meal_plan'] ?? 'BB'}'),
          trailing: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            color: Colors.blue.shade50,
            child: const Text('Starts Tomorrow',
                style: TextStyle(color: Colors.blue, fontWeight: FontWeight.bold)),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildCheckoutTodayTab(List<Map<String, dynamic>> bookings) {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: bookings.map((b) {
        return ListTile(
          leading: const Icon(Icons.exit_to_app, color: Colors.orange),
          title: Text('Room ${b['room_number'] ?? '-'} • ${b['guest_name']}'),
          subtitle: Text('Departing: Today • Plan: ${b['meal_plan'] ?? 'BB'}'),
          trailing: const Chip(
            avatar: Icon(Icons.check, size: 16),
            label: Text('Breakfast Included Today'),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildPaidAndComplimentaryTab() {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ElevatedButton.icon(
                icon: const Icon(Icons.add),
                label: const Text('Add Paid Extra Ticket'),
                onPressed: _showAddPaidBreakfastDialog,
              ),
              const SizedBox(width: 12),
              OutlinedButton.icon(
                icon: const Icon(Icons.card_giftcard),
                label: const Text('Add Complimentary Voucher'),
                onPressed: _showAddComplimentaryDialog,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Expanded(
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Paid Breakfast Tickets',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 6),
                      Expanded(
                        child: _paidEntries.isEmpty
                            ? const Center(
                                child: Text('No paid extra tickets recorded.'))
                            : ListView.builder(
                                itemCount: _paidEntries.length,
                                itemBuilder: (context, idx) {
                                  final p = _paidEntries[idx];
                                  return Card(
                                    child: ListTile(
                                      title: Text('${p['guest']} (${p['room']})'),
                                      subtitle: Text(
                                          '${p['adults']} adults, ${p['children']} children • KES ${p['amount']} (${p['method']})'),
                                      trailing: Text(p['time']),
                                    ),
                                  );
                                },
                              ),
                      ),
                    ],
                  ),
                ),
                const VerticalDivider(),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Complimentary Vouchers',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 6),
                      Expanded(
                        child: _complimentaryEntries.isEmpty
                            ? const Center(
                                child: Text('No complimentary vouchers added.'))
                            : ListView.builder(
                                itemCount: _complimentaryEntries.length,
                                itemBuilder: (context, idx) {
                                  final c = _complimentaryEntries[idx];
                                  return Card(
                                    child: ListTile(
                                      title: Text('${c['guest']} (${c['room']})'),
                                      subtitle: Text(
                                          '${c['adults']} adults, ${c['children']} children • Reason: ${c['reason']}'),
                                      trailing: Text('Auth: ${c['auth']}'),
                                    ),
                                  );
                                },
                              ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChangesAuditTab() {
    return _versionsHistory.isEmpty
        ? const Center(
            child: Text(
                'No confirmation versions or changes recorded for this session date.'),
          )
        : ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: _versionsHistory.length,
            separatorBuilder: (_, __) => const Divider(),
            itemBuilder: (context, idx) {
              final v = _versionsHistory[idx];
              return ListTile(
                leading: CircleAvatar(
                  child: Text('v${v['version']}'),
                ),
                title: Text(
                    'Version ${v['version']} - ${v['pax']} Confirmed Pax (${v['status'].toString().toUpperCase()})'),
                subtitle: Text(
                    'Confirmed Adults: ${v['adults']} · Children: ${v['children']}\nAdjustment Reason: ${v['reason']}'),
                trailing: Text('${v['timestamp']}\n${v['user']}'),
              );
            },
          );
  }
}

class _ReceptionMetricCard extends StatelessWidget {
  const _ReceptionMetricCard({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 220,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: AppColors.kPrimary.withOpacity(.08),
            child: Icon(icon, color: AppColors.kPrimary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: const TextStyle(
                        color: Colors.grey, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(value,
                    style: const TextStyle(
                        fontSize: 20, fontWeight: FontWeight.w800)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Navigation helpers for new screens ──────────────────────────────────────

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
        ElevatedButton.icon(
          onPressed: () => onAction(ReceptionSection.cashier),
          icon: const Icon(Icons.point_of_sale, size: 16),
          label: const Text('Cashier Station'),
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.teal.shade700,
            foregroundColor: Colors.white,
          ),
        ),
        OutlinedButton.icon(
          onPressed: () => context.go('/pos'),
          icon: const Icon(Icons.receipt_long, size: 16),
          label: const Text('POS Terminal'),
        ),
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
          onPressed: () => _showNewBookingDialog(context, ref, onRefresh),
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
        IconButton(
          tooltip: 'Test SMTP',
          onPressed: () => _testSmtpConnection(context, ref),
          icon: const Icon(Icons.outgoing_mail, size: 20),
        ),
        OutlinedButton.icon(
          onPressed: () => _showNewReservationDialog(context, ref, onRefresh),
          icon: const Icon(Icons.bookmark_border, size: 16),
          label: const Text('New Reservation'),
        ),
        ElevatedButton.icon(
          onPressed: () => _showNewBookingDialog(context, ref, onRefresh),
          icon: const Icon(Icons.add, size: 16),
          label: const Text('New Booking'),
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
                                if (b.status == 'pending' ||
                                    b.status == 'unconfirmed' ||
                                    b.status == 'awaiting_payment')
                                  _SmallAction(
                                      'Confirm Booking',
                                      Icons.check_circle_outline,
                                      () => _confirmBooking(
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
                                    'Email',
                                    Icons.email_outlined,
                                    () => _sendBookingEmail(
                                        context, ref, b, onRefresh)),
                                _SmallAction(
                                    'Invoice',
                                    Icons.receipt_outlined,
                                    () => _sendBookingInvoice(
                                        context, ref, b, onRefresh)),
                                _SmallAction(
                                    'Folio',
                                    Icons.receipt_long_outlined,
                                    () => _showFolioDialog(context, ref, b)),
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
                          _SmallAction(
                              'Email',
                              Icons.email_outlined,
                              () => _sendBookingEmail(
                                  context, ref, b, widget.onRefresh)),
                          _SmallAction(
                              'Invoice',
                              Icons.receipt_outlined,
                              () => _sendBookingInvoice(
                                  context, ref, b, widget.onRefresh)),
                          if (_tab == 'checkin')
                            _SmallAction(
                                'Reminder',
                                Icons.access_alarm_outlined,
                                () => _sendCheckInReminder(
                                    context, ref, b, widget.onRefresh)),
                          if (_tab == 'checkout')
                            _SmallAction(
                                'Reminder',
                                Icons.access_alarm_outlined,
                                () => _sendCheckOutReminder(
                                    context, ref, b, widget.onRefresh)),
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
              room.displayNumber.toLowerCase().contains(query) ||
              (room.guestName ?? '').toLowerCase().contains(query)) &&
          (statusFilter == 'all' || room.status == statusFilter) &&
          (typeFilter == 'all' || room.type == typeFilter);
    }).toList();

    return _PageScaffold(
      title: 'Rooms',
      subtitle:
          'Room status board, quick check-in, status changes and active booking checkout.',
      actions: [
        ElevatedButton.icon(
          onPressed: () => printRoomsReportPDF(
            context: context,
            rooms: rooms,
            branchName: 'FamousGate Bomet',
          ),
          icon: const Icon(Icons.print, size: 16),
          label: const Text('Print Room List & Occupancy'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.kPrimary,
            foregroundColor: Colors.white,
          ),
        ),
        const SizedBox(width: 8),
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
                        childAspectRatio: 0.95,
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
                            _snack(context,
                                'Room ${room.displayNumber} marked $status');
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
            searchHint: 'Search guests by name, phone, ID or car plate',
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
                            '${guest.email ?? '-'} • ${guest.phone ?? '-'}'
                            '${guest.idNumber == null ? '' : ' • ID ${guest.idNumber}'}'
                            '${guest.carNumberPlate == null ? '' : ' • ${guest.carNumberPlate}'}'
                            '${activeBooking == null ? '' : ' • Room ${activeBooking.roomNumber}'}',
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
                {
                  'label': 'Car plate',
                  'value': _text(guest, [
                        'car_number_plate',
                        'carNumberPlate',
                        'vehicle_plate',
                        'vehiclePlate'
                      ]) ??
                      '-'
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
          'Book halls, manage reservations, record payments and track occupancy.',
      actions: [
        OutlinedButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Refresh')),
        ElevatedButton.icon(
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => const ConferenceBookingScreen(),
            ),
          ).then((_) => onRefresh()),
          icon: const Icon(Icons.meeting_room_outlined, size: 16),
          label: const Text('Manage Conference Halls'),
        ),
      ],
      child: _ResponsivePair(
        left: _CardPanel(
          title: 'Hall Status (${data.conferenceHalls.length} halls)',
          child: data.conferenceHalls.isEmpty
              ? const EmptyState(message: 'No conference halls found')
              : _RecordList(
                  rows: data.conferenceHalls.map((hall) {
                    final id = _text(hall, ['id']);
                    final status = _text(hall, ['status']) ?? 'available';
                    final capacity = _num(hall, ['capacity']).toInt();
                    final priceDay = _num(
                        hall, ['base_price_per_day', 'price_per_day', 'rate']);
                    return _RecordTileData(
                      title: _text(hall, ['name']) ?? 'Conference hall',
                      subtitle:
                          '$capacity pax${priceDay > 0 ? ' • ${_money(priceDay)}/day' : ''}',
                      trailing: _StatusPill(status),
                      actions: [
                        _SmallAction(
                          'Open',
                          Icons.open_in_new,
                          () => showDialog<void>(
                            context: context,
                            builder: (_) => ConferenceBookingDialog(
                              halls: data.conferenceHalls,
                              repo: ref.read(receptionRepositoryProvider),
                              onSuccess: onRefresh,
                              initialHall: hall,
                            ),
                          ),
                        ),
                      ],
                    );
                  }).toList(),
                ),
        ),
        leftFlex: 1,
        right: _CardPanel(
          title:
              'Active & Upcoming Bookings (${data.conferenceBookings.length})',
          child: data.conferenceBookings.isEmpty
              ? Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const EmptyState(
                        message: 'No active conference bookings'),
                    const SizedBox(height: 12),
                    ElevatedButton.icon(
                      onPressed: () => showDialog<void>(
                        context: context,
                        builder: (_) => ConferenceBookingDialog(
                          halls: data.conferenceHalls,
                          repo: ref.read(receptionRepositoryProvider),
                          onSuccess: onRefresh,
                        ),
                      ),
                      icon: const Icon(Icons.add, size: 16),
                      label: const Text('Book a Hall'),
                    ),
                  ],
                )
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
                          'Details',
                          Icons.open_in_new,
                          () => Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) =>
                                      const ConferenceBookingScreen(),
                                ),
                              ).then((_) => onRefresh())),
                      _SmallAction(
                          'Pay',
                          Icons.point_of_sale,
                          invoice == null
                              ? null
                              : () => _openReceptionCashier(context,
                                  billRef: invoice)),
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

class _CashierSection extends StatelessWidget {
  const _CashierSection({
    this.billRef,
    this.amount,
    this.method,
  });

  final String? billRef;
  final String? amount;
  final String? method;

  @override
  Widget build(BuildContext context) {
    return CashierDashboard(
      key: ValueKey(
          'reception_cashier_${billRef ?? ''}_${amount ?? ''}_${method ?? ''}'),
      embedded: true,
      initialBillRef: billRef,
      initialAmount: amount,
      initialMethod: method,
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
            rows: data.bookingRows
                .take(50)
                .map((b) => {
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
                    })
                .toList(),
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
            rows: data.payments
                .take(50)
                .map((p) => {
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
                    })
                .toList(),
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

class _EmailAutomationSection extends ConsumerWidget {
  const _EmailAutomationSection({required this.data, required this.onRefresh});
  final _ReceptionSnapshot data;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return _PageScaffold(
      title: 'Email Automation',
      subtitle: 'Manage automated emails, send reminders, and monitor SMTP.',
      actions: [
        OutlinedButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Refresh')),
        IconButton(
          tooltip: 'Test SMTP',
          onPressed: () => _testSmtpConnection(context, ref),
          icon: const Icon(Icons.outgoing_mail, size: 20),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardPanel(
            title: 'SMTP Status',
            child: ListTile(
              leading: const Icon(Icons.cloud_done, color: AppColors.kSuccess),
              title: const Text('Gmail SMTP Server'),
              subtitle: const Text('booking.famousgatehotels@gmail.com'),
              trailing: ElevatedButton.icon(
                onPressed: () => _testSmtpConnection(context, ref),
                icon: const Icon(Icons.play_arrow, size: 16),
                label: const Text('Test'),
              ),
            ),
          ),
          const SizedBox(height: 12),
          _CardPanel(
            title: 'Auto-Send Settings',
            child: Column(
              children: [
                _AutoSendTile(
                  icon: Icons.mark_email_read,
                  label: 'Auto-send booking confirmation',
                  subtitle: 'When a new reservation is created',
                  value: true,
                  onChanged: (_) {},
                ),
                _AutoSendTile(
                  icon: Icons.login,
                  label: 'Auto-send check-in welcome',
                  subtitle: 'When guest checks in',
                  value: true,
                  onChanged: (_) {},
                ),
                _AutoSendTile(
                  icon: Icons.logout,
                  label: 'Auto-send checkout invoice',
                  subtitle: 'When guest checks out',
                  value: true,
                  onChanged: (_) {},
                ),
                _AutoSendTile(
                  icon: Icons.cancel_outlined,
                  label: 'Auto-send cancellation notice',
                  subtitle: 'When a booking is cancelled',
                  value: true,
                  onChanged: (_) {},
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _CardPanel(
            title: 'Quick Actions',
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final booking in data.bookings.where((b) =>
                    b.status == 'confirmed' && (b.guestEmail ?? '').isNotEmpty))
                  ActionChip(
                    avatar: const Icon(Icons.email_outlined, size: 16),
                    label: Text('Confirm: ${booking.guestName ?? 'Guest'}'),
                    onPressed: () =>
                        _sendBookingEmail(context, ref, booking, onRefresh),
                  ),
                for (final booking in data.bookings.where((b) =>
                    b.status == 'checked_in' &&
                    (b.guestEmail ?? '').isNotEmpty))
                  ActionChip(
                    avatar: const Icon(Icons.receipt_outlined, size: 16),
                    label: Text('Invoice: ${booking.guestName ?? 'Guest'}'),
                    onPressed: () =>
                        _sendBookingInvoice(context, ref, booking, onRefresh),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _CardPanel(
            title: 'Recent Email Activity',
            child: data.bookingRows.isEmpty
                ? const EmptyState(message: 'No recent activity')
                : _SimpleRows(
                    rows: data.bookingRows
                        .where((b) => (_text(b, ['guest_email', 'email']) ?? '')
                            .isNotEmpty)
                        .take(20)
                        .toList(),
                    fields: const [
                      'confirmation_number',
                      'guest_name',
                      'status',
                      'guest_email'
                    ],
                    actionsBuilder: (row) {
                      final id = _text(row, ['id']) ?? '';
                      final email = _text(row, ['guest_email', 'email']) ?? '';
                      if (id.isEmpty || email.isEmpty) return const SizedBox();
                      return Wrap(spacing: 6, children: [
                        _SmallAction('Confirm', Icons.email_outlined, () async {
                          try {
                            await ref
                                .read(receptionRepositoryProvider)
                                .sendBookingConfirmationEmail(id);
                            _snack(context, 'Confirmation sent to $email');
                          } catch (e) {
                            _snack(context, 'Failed: ${apiErrorMessage(e)}',
                                error: true);
                          }
                        }),
                        _SmallAction('Invoice', Icons.receipt_outlined,
                            () async {
                          try {
                            await ref
                                .read(receptionRepositoryProvider)
                                .sendInvoiceEmail(id);
                            _snack(context, 'Invoice sent to $email');
                          } catch (e) {
                            _snack(context, 'Failed: ${apiErrorMessage(e)}',
                                error: true);
                          }
                        }),
                        _SmallAction('Cancel', Icons.cancel_outlined, () async {
                          try {
                            await ref
                                .read(receptionRepositoryProvider)
                                .sendCancellationEmail(id);
                            _snack(context, 'Cancellation sent to $email');
                          } catch (e) {
                            _snack(context, 'Failed: ${apiErrorMessage(e)}',
                                error: true);
                          }
                        }),
                      ]);
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _AutoSendTile extends StatelessWidget {
  const _AutoSendTile({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  final IconData icon;
  final String label;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      secondary: Icon(icon, color: AppColors.kPrimary),
      title: Text(label),
      subtitle: Text(subtitle,
          style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
      value: value,
      onChanged: onChanged,
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
              ? 2.45
              : width > 680
                  ? 2.5
                  : 2.5,
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
        label: 'Cashier Station & POS',
        value: 'KES ${_money(_num(data.cashierStats, ['today_payments', 'todayRevenue', 'today_collections']))}',
        note: 'Point of sale billing, guest checkout folios & shift register',
        icon: Icons.point_of_sale_outlined,
        color: Colors.teal,
        section: ReceptionSection.cashier,
      ),
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
                Text(room.displayNumber,
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
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Text(room.displayNumber,
                    style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: color)),
                const Spacer(),
                PopupMenuButton<String>(
                  padding: EdgeInsets.zero,
                  iconSize: 18,
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
            Row(
              children: [
                Expanded(
                  child: Text(room.type ?? 'Room',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.kTextSecondary)),
                ),
                const SizedBox(width: 4),
                _StatusPill(room.status),
              ],
            ),
            Text(
              room.guestName ?? (room.status == 'occupied' ? 'Occupied Guest' : 'No guest'),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11,
                fontWeight: room.status == 'occupied' ? FontWeight.bold : FontWeight.normal,
                color: room.status == 'occupied' ? AppColors.kPrimary : AppColors.kTextSecondary,
              ),
            ),
            if (onQuickCheckIn != null || onCheckout != null)
              Wrap(spacing: 4, runSpacing: 4, children: [
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
          childAspectRatio: 1.0,
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
      this.isRequired = false,
      this.initial,
      this.options,
      this.optionLabels});
  final String key;
  final String label;
  final bool numeric;
  final bool multiline;
  final bool isRequired;
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
                    if (field.isRequired && (value == null || value.isEmpty)) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('${field.label} is required')),
                      );
                      setState(() => _busy = false);
                      return;
                    }
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
  const _NewReservationDialog({
    required this.onSuccess,
    this.isBookingMode = false,
  });
  final VoidCallback onSuccess;
  final bool isBookingMode;

  @override
  ConsumerState<_NewReservationDialog> createState() =>
      _NewReservationDialogState();
}

class _NewReservationDialogState extends ConsumerState<_NewReservationDialog> {
  static final _dateFormat = DateFormat('yyyy-MM-dd');

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

  DateTime get _checkInDate =>
      DateTime.tryParse(_checkIn.text) ?? DateTime.now();

  DateTime get _checkOutDate =>
      DateTime.tryParse(_checkOut.text) ??
      _checkInDate.add(const Duration(days: 1));

  Future<void> _pickStayDate({required bool checkIn}) async {
    final currentIn = _checkInDate;
    final currentOut = _checkOutDate;
    final firstDate = checkIn
        ? DateTime.now().subtract(const Duration(days: 1))
        : currentIn.add(const Duration(days: 1));
    final initialDate = checkIn
        ? currentIn
        : currentOut.isAfter(firstDate)
            ? currentOut
            : firstDate;
    final picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: firstDate,
      lastDate: DateTime.now().add(const Duration(days: 730)),
      helpText: checkIn ? 'Select check-in date' : 'Select check-out date',
    );
    if (picked == null || !mounted) return;

    setState(() {
      if (checkIn) {
        _checkIn.text = _dateFormat.format(picked);
        if (!_checkOutDate.isAfter(picked)) {
          _checkOut.text =
              _dateFormat.format(picked.add(const Duration(days: 1)));
        }
      } else {
        _checkOut.text = _dateFormat.format(picked);
      }
      _rooms = [];
      _selectedRoom = null;
    });
  }

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
    final titleText = widget.isBookingMode
        ? 'New Confirmed Booking'
        : 'New Provisional Reservation';

    return AlertDialog(
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(titleText, style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(
            widget.isBookingMode
                ? 'Creates a confirmed booking and blocks room (Status: Confirmed)'
                : 'Creates a provisional room hold awaiting confirmation (Status: Pending)',
            style: TextStyle(
                fontSize: 12,
                color: Colors.grey.shade600,
                fontWeight: FontWeight.normal),
          ),
        ],
      ),
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
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Padding(
                            padding: EdgeInsets.only(left: 2, bottom: 6),
                            child: Text(
                              'Check-in Date',
                              style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.kTextPrimary),
                            ),
                          ),
                          TextField(
                            controller: _checkIn,
                            readOnly: true,
                            onTap: () => _pickStayDate(checkIn: true),
                            decoration: InputDecoration(
                              hintText: 'Select check-in date',
                              contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 12),
                              border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8)),
                              prefixIcon: const Icon(Icons.calendar_today,
                                  size: 18),
                              suffixIcon: const Icon(Icons.arrow_drop_down),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Padding(
                            padding: EdgeInsets.only(left: 2, bottom: 6),
                            child: Text(
                              'Check-out Date',
                              style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.kTextPrimary),
                            ),
                          ),
                          TextField(
                            controller: _checkOut,
                            readOnly: true,
                            onTap: () => _pickStayDate(checkIn: false),
                            decoration: InputDecoration(
                              hintText: 'Select check-out date',
                              contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 12),
                              border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8)),
                              prefixIcon: const Icon(Icons.event_available,
                                  size: 18),
                              suffixIcon: const Icon(Icons.arrow_drop_down),
                            ),
                          ),
                        ],
                      ),
                    ),
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
                                      'type.name',
                                      'type.code',
                                      'room_type.name',
                                      'room_type.code',
                                      'type_name',
                                    ]) ?? 'Standard'} • ${_money(_num(room, [
                                  'price_per_night',
                                  'rate',
                                  'base_rate',
                                  'base_price',
                                  'type.base_price',
                                  'type.price_per_night',
                                  'type.base_rate',
                                  'type.rate',
                                  'room_type.base_price',
                                  'room_type.price_per_night',
                                  'room_type.rate',
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
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Padding(
                              padding: EdgeInsets.only(left: 2, bottom: 6),
                              child: Text(
                                'Search Guest',
                                style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.kTextPrimary),
                              ),
                            ),
                            TextField(
                              controller: _guestSearch,
                              decoration: InputDecoration(
                                hintText: 'Enter guest name or phone...',
                                contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 12),
                                border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(8)),
                                prefixIcon:
                                    const Icon(Icons.search, size: 18),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: _searchGuests,
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 14),
                        ),
                        child: const Text('Search'),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton(
                        onPressed: _createGuestInline,
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 14),
                        ),
                        child: const Text('New guest'),
                      ),
                    ],
                  ),
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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(left: 2, bottom: 6),
                    child: Text(
                      'Meal Plan',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.kTextPrimary),
                    ),
                  ),
                  DropdownButtonFormField<String>(
                    initialValue: _mealPlan,
                    decoration: InputDecoration(
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
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
                  Padding(
                    padding: const EdgeInsets.only(left: 2, bottom: 6),
                    child: Text(
                      widget.isBookingMode
                          ? 'Deposit / Payment Received (KES)'
                          : 'Deposit / Hold Amount (KES)',
                      style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.kTextPrimary),
                    ),
                  ),
                  TextField(
                    controller: _deposit,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      hintText: '0',
                      prefixText: 'KES ',
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Padding(
                    padding: EdgeInsets.only(left: 2, bottom: 6),
                    child: Text(
                      'Special Requests / Notes',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.kTextPrimary),
                    ),
                  ),
                  TextField(
                    controller: _special,
                    maxLines: 3,
                    decoration: InputDecoration(
                      hintText: 'Guest preferences, estimated arrival time...',
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _KeyValueList(rows: [
                    {
                      'label': 'Room',
                      'value': _selectedRoom == null
                          ? 'No room selected'
                          : 'Room ${_text(_selectedRoom!, [
                                  'room_number',
                                  'number'
                                ]) ?? ''}'
                    },
                    {'label': 'Guest', 'value': _selectedGuest?.name ?? 'No guest selected'},
                    {
                      'label': 'Nightly Rate',
                      'value': _money(_num(_selectedRoom ?? const {}, [
                        'price_per_night',
                        'rate',
                        'base_price',
                        'base_rate',
                        'type.base_price',
                        'type.price_per_night',
                        'type.base_rate',
                        'type.rate',
                        'room_type.base_price',
                        'room_type.price_per_night',
                        'room_type.rate',
                      ]))
                    },
                    {'label': 'Total Amount', 'value': _money(total)},
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
              child: Text(_busy
                  ? (widget.isBookingMode
                      ? 'Creating Booking...'
                      : 'Creating Hold...')
                  : (widget.isBookingMode
                      ? 'Create Confirmed Booking'
                      : 'Create Provisional Hold'))),
      ],
    );
  }

  Future<void> _searchRooms() async {
    if (!_checkOutDate.isAfter(_checkInDate)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Check-out date must be after check-in date'),
          ),
        );
      }
      return;
    }
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
    final rate = _num(_selectedRoom ?? const {}, [
      'price_per_night',
      'rate',
      'base_price',
      'base_rate',
      'type.base_price',
      'type.price_per_night',
      'type.base_rate',
      'type.rate',
      'room_type.base_price',
      'room_type.price_per_night',
      'room_type.rate',
    ]).toDouble();
    final inDate = DateTime.tryParse(_checkIn.text) ?? DateTime.now();
    final outDate = DateTime.tryParse(_checkOut.text) ??
        inDate.add(const Duration(days: 1));
    final nights = outDate.difference(inDate).inDays.clamp(1, 365);
    final mealAddon = switch (_mealPlan) {
      'half_board' => 1600,
      'full_board' => 3000,
      _ => 0,
    };
    return (rate + mealAddon) * nights;
  }

  Future<void> _submit() async {
    if (_selectedRoom == null || _selectedGuest == null) return;
    setState(() => _busy = true);
    try {
      final status = widget.isBookingMode ? 'confirmed' : 'pending';
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
        'status': status,
      });
      final roomId = _text(_selectedRoom!, ['id']);
      if (roomId != null && status == 'confirmed') {
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
  final _formKey = GlobalKey<FormState>();
  final _first = TextEditingController();
  final _last = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _idNumber = TextEditingController();
  final _carNumberPlate = TextEditingController();
  String _idType = 'national_id';

  @override
  void dispose() {
    _first.dispose();
    _last.dispose();
    _phone.dispose();
    _email.dispose();
    _idNumber.dispose();
    _carNumberPlate.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('New Guest'),
      content: SizedBox(
        width: 460,
        child: Form(
          key: _formKey,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextFormField(
                controller: _first,
                decoration: const InputDecoration(labelText: 'First name *'),
                validator: (value) =>
                    value == null || value.trim().isEmpty ? 'Required' : null),
            const SizedBox(height: 10),
            TextFormField(
                controller: _last,
                decoration: const InputDecoration(labelText: 'Last name *'),
                validator: (value) =>
                    value == null || value.trim().isEmpty ? 'Required' : null),
            const SizedBox(height: 10),
            TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Phone *'),
                validator: (value) =>
                    value == null || value.trim().isEmpty ? 'Required' : null),
            const SizedBox(height: 10),
            TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email')),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: _idType,
              decoration: const InputDecoration(labelText: 'ID Type'),
              items: const [
                DropdownMenuItem(
                    value: 'national_id', child: Text('National ID')),
                DropdownMenuItem(value: 'passport', child: Text('Passport')),
                DropdownMenuItem(
                    value: 'driving_license', child: Text('Driving License')),
                DropdownMenuItem(
                    value: 'military_id', child: Text('Military ID')),
              ],
              onChanged: (value) =>
                  setState(() => _idType = value ?? 'national_id'),
            ),
            const SizedBox(height: 10),
            TextFormField(
                controller: _idNumber,
                decoration: const InputDecoration(labelText: 'ID number *'),
                validator: (value) =>
                    value == null || value.trim().isEmpty ? 'Required' : null),
            const SizedBox(height: 10),
            TextFormField(
              controller: _carNumberPlate,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                  labelText: 'Car number plate (optional)'),
            ),
          ]),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        ElevatedButton(
          onPressed: () async {
            if (!_formKey.currentState!.validate()) return;
            final row =
                await ref.read(receptionRepositoryProvider).createGuest({
              'first_name': _first.text,
              'last_name': _last.text,
              'phone': _phone.text,
              'email': _email.text,
              'id_type': _idType,
              'id_number': _idNumber.text.trim(),
              if (_carNumberPlate.text.trim().isNotEmpty)
                'car_number_plate': _carNumberPlate.text.trim().toUpperCase(),
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 2, bottom: 6),
          child: Text(
            label,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.kTextPrimary),
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.grey.shade50,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.grey.shade300),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                onPressed: value <= 0 ? null : () => onChanged(value - 1),
                icon: const Icon(Icons.remove, size: 18),
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                padding: EdgeInsets.zero,
              ),
              Text('$value',
                  style: const TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 15)),
              IconButton(
                onPressed: () => onChanged(value + 1),
                icon: const Icon(Icons.add, size: 18),
                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                padding: EdgeInsets.zero,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

Future<void> _showNewReservationDialog(
    BuildContext context, WidgetRef ref, VoidCallback onSuccess) async {
  await showDialog<void>(
    context: context,
    builder: (_) => _NewReservationDialog(
      isBookingMode: false,
      onSuccess: onSuccess,
    ),
  );
}

Future<void> _showNewBookingDialog(
    BuildContext context, WidgetRef ref, VoidCallback onSuccess) async {
  await showDialog<void>(
    context: context,
    builder: (_) => _NewReservationDialog(
      isBookingMode: true,
      onSuccess: onSuccess,
    ),
  );
}

Future<void> _confirmBooking(
    BuildContext context, WidgetRef ref, Booking booking, VoidCallback onSuccess) async {
  try {
    await ref.read(receptionRepositoryProvider).updateBooking(booking.id, {
      'status': 'confirmed',
    });
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              'Reservation ${booking.confirmationNumber ?? booking.id} converted to Confirmed Booking!'),
          backgroundColor: AppColors.kSuccess,
        ),
      );
    }
    onSuccess();
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to confirm booking: $e'),
          backgroundColor: AppColors.kError,
        ),
      );
    }
  }
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
        _RecordField('first_name', 'First name',
            initial: guest?.firstName, isRequired: true),
        _RecordField('last_name', 'Last name',
            initial: guest?.lastName, isRequired: true),
        _RecordField('phone', 'Phone', initial: guest?.phone, isRequired: true),
        _RecordField('email', 'Email', initial: guest?.email),
        _RecordField(
          'id_type',
          'ID Type',
          initial: guest?.idType ?? 'national_id',
          options: const [
            'national_id',
            'passport',
            'driving_license',
            'military_id',
          ],
          optionLabels: const {
            'national_id': 'National ID',
            'passport': 'Passport',
            'driving_license': 'Driving License',
            'military_id': 'Military ID',
          },
        ),
        _RecordField('id_number', 'ID / Passport',
            initial: guest?.idNumber, isRequired: true),
        _RecordField('car_number_plate', 'Car number plate',
            initial: guest?.carNumberPlate),
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
        title: Text('Quick Check-in Room ${room.displayNumber}'),
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
        Text('Opening Reception cashier with amount pre-filled',
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
                  _openReceptionCashier(context,
                      billRef: billRef,
                      method: method,
                      amount: due.toStringAsFixed(0));
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

Future<void> _sendBookingEmail(BuildContext context, WidgetRef ref,
    Booking booking, VoidCallback onRefresh) async {
  final guestEmail = booking.guestEmail ?? '';
  if (guestEmail.isEmpty) {
    _snack(context, 'Guest has no email address', error: true);
    return;
  }
  final confirmed = await _confirm(
      context, 'Send booking confirmation email to\n$guestEmail?');
  if (!confirmed) return;
  try {
    final result = await ref
        .read(receptionRepositoryProvider)
        .sendBookingConfirmationEmail(booking.id);
    final email = result['data']?['email'] ?? guestEmail;
    if (context.mounted) {
      _snack(context, 'Email sent successfully to $email');
    }
  } catch (e) {
    if (context.mounted) {
      _snack(context, apiErrorMessage(e, fallback: 'Failed to send email'),
          error: true);
    }
  }
}

Future<void> _testSmtpConnection(BuildContext context, WidgetRef ref) async {
  try {
    final result =
        await ref.read(receptionRepositoryProvider).testEmailConnection();
    final status = result['connection_status'] ?? 'Unknown';
    final from = result['from_email'] ?? '';
    final usingEthereal = result['using_ethereal'] == true;
    if (context.mounted) {
      final statusText = usingEthereal ? 'Connected (Ethereal Dev)' : status;
      _snack(context, 'SMTP $statusText${from.isNotEmpty ? ' ($from)' : ''}');
    }
  } catch (e) {
    if (context.mounted) {
      _snack(context, apiErrorMessage(e, fallback: 'SMTP test failed'),
          error: true);
    }
  }
}

Future<void> _sendBookingInvoice(BuildContext context, WidgetRef ref,
    Booking booking, VoidCallback onRefresh) async {
  final guestEmail = booking.guestEmail ?? '';
  if (guestEmail.isEmpty) {
    _snack(context, 'Guest has no email address', error: true);
    return;
  }
  final confirmed =
      await _confirm(context, 'Send invoice email to\n$guestEmail?');
  if (!confirmed) return;
  try {
    final result = await ref
        .read(receptionRepositoryProvider)
        .sendInvoiceEmail(booking.id);
    final email = result['data']?['email'] ?? guestEmail;
    if (context.mounted) {
      _snack(context, 'Invoice sent successfully to $email');
    }
  } catch (e) {
    if (context.mounted) {
      _snack(context, apiErrorMessage(e, fallback: 'Failed to send invoice'),
          error: true);
    }
  }
}

Future<void> _sendCheckInReminder(BuildContext context, WidgetRef ref,
    Booking booking, VoidCallback onRefresh) async {
  final guestEmail = booking.guestEmail ?? '';
  if (guestEmail.isEmpty) {
    _snack(context, 'Guest has no email address', error: true);
    return;
  }
  try {
    final result = await ref
        .read(receptionRepositoryProvider)
        .sendCheckInReminder(booking.id);
    final email = result['data']?['email'] ?? guestEmail;
    if (context.mounted) {
      _snack(context, 'Check-in reminder sent to $email');
    }
  } catch (e) {
    if (context.mounted) {
      _snack(context, apiErrorMessage(e, fallback: 'Failed to send reminder'),
          error: true);
    }
  }
}

Future<void> _sendCheckOutReminder(BuildContext context, WidgetRef ref,
    Booking booking, VoidCallback onRefresh) async {
  final guestEmail = booking.guestEmail ?? '';
  if (guestEmail.isEmpty) {
    _snack(context, 'Guest has no email address', error: true);
    return;
  }
  try {
    final result = await ref
        .read(receptionRepositoryProvider)
        .sendCheckOutReminder(booking.id);
    final email = result['data']?['email'] ?? guestEmail;
    if (context.mounted) {
      _snack(context, 'Check-out reminder sent to $email');
    }
  } catch (e) {
    if (context.mounted) {
      _snack(context, apiErrorMessage(e, fallback: 'Failed to send reminder'),
          error: true);
    }
  }
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
  final repo = ref.read(receptionRepositoryProvider);
  try {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(
        child: Card(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(),
                SizedBox(height: 16),
                Text('Loading guest details for checkout...'),
              ],
            ),
          ),
        ),
      ),
    );

    final bookingsMap = await repo.getRoomBookings(room.id);
    final activeMap = bookingsMap
        .where((b) => _text(b, ['status']) == 'checked_in')
        .firstOrNull;

    Booking? booking;
    if (activeMap != null) {
      booking = Booking.fromJson(activeMap);
    } else {
      final checkedInList = await repo.getBookings(status: 'checked_in');
      booking = checkedInList.where((b) =>
          b.roomId == room.id ||
          (b.roomNumber != null &&
              b.roomNumber!.toLowerCase() == room.displayNumber.toLowerCase())).firstOrNull;
    }

    if (context.mounted) {
      Navigator.of(context, rootNavigator: true).pop();
    }

    booking ??= Booking(
      id: '',
      roomId: room.id,
      roomNumber: room.displayNumber,
      roomType: room.type,
      guestName: 'Guest (${room.displayNumber})',
      checkIn: DateTime.now(),
      checkOut: DateTime.now(),
      status: 'checked_in',
      raw: const {},
    );

    if (!context.mounted) return;
    final ok = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => CheckOutScreen(booking: booking),
      ),
    );

    if (ok == true) {
      onSuccess();
    }
  } catch (e) {
    if (context.mounted) {
      Navigator.of(context, rootNavigator: true).pop();
      _snack(context, 'Failed to load guest details: $e', error: true);
    }
  }
}

Future<void> _openCheckOutBooking(
    BuildContext context, Booking booking, VoidCallback onSuccess) async {
  final ok = await Navigator.of(context).push<bool>(
    MaterialPageRoute(
      builder: (_) => CheckOutScreen(booking: booking),
    ),
  );
  if (ok == true) {
    onSuccess();
  }
}

Future<void> printBookingInvoicePDF({
  required BuildContext context,
  required String invoiceNumber,
  required String invoiceDate,
  required String dueDate,
  required String clientName,
  String? clientPhone,
  String? clientDetails,
  required List<Map<String, dynamic>> items,
  required double totalAmount,
  required double amountPaid,
  double? balanceDue,
  String? notes,
}) async {
  final pdf = pw.Document();
  pw.MemoryImage? logoImage;
  try {
    final logoBytes =
        await rootBundle.load('assets/frontend_public/fglogo.png');
    logoImage = pw.MemoryImage(logoBytes.buffer.asUint8List());
  } catch (_) {}

  final double grossTotal = totalAmount > 0
      ? totalAmount
      : items.fold(0.0, (sum, item) {
          final q = (item['qty'] as num?)?.toDouble() ?? 1.0;
          final p = (item['unitPrice'] as num?)?.toDouble() ?? 0.0;
          final t = (item['totalAmount'] as num?)?.toDouble() ?? (q * p);
          return sum + t;
        });

  final double vatRate = 0.16;
  final double clRate = 0.02;
  final double scRate = 0.03;
  final double combinedRate = vatRate + clRate + scRate; // 0.21

  final double netSubtotal = grossTotal / (1.0 + combinedRate);
  final double vatAmount = netSubtotal * vatRate;
  final double clAmount = netSubtotal * clRate;
  final double scAmount = netSubtotal * scRate;

  final double paid = amountPaid;
  final double balance =
      balanceDue ?? (grossTotal - paid).clamp(0.0, double.infinity);

  final numFormat = NumberFormat('#,##0.00', 'en_KE');

  pdf.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.symmetric(horizontal: 36, vertical: 28),
      build: (pw.Context ctx) {
        return [
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              if (logoImage != null)
                pw.Image(logoImage, width: 72, height: 50)
              else
                pw.Container(width: 72),
              pw.SizedBox(width: 16),
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('FamousGate Hotels',
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 16)),
                    pw.Text('Bomet, Kenya',
                        style: const pw.TextStyle(
                            fontSize: 10, color: PdfColors.grey700)),
                    pw.Text('Tel: 0706782828',
                        style: const pw.TextStyle(
                            fontSize: 9, color: PdfColors.grey600)),
                    pw.Text('Email: famousgatesbmt@gmail.com',
                        style: const pw.TextStyle(
                            fontSize: 9, color: PdfColors.grey600)),
                    pw.Text('www.famousgatehotels.com',
                        style: pw.TextStyle(
                            fontSize: 9,
                            fontWeight: pw.FontWeight.bold,
                            color: PdfColors.blue800)),
                  ],
                ),
              ),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text('INVOICE',
                      style: pw.TextStyle(
                          fontSize: 22,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColors.grey800)),
                ],
              ),
            ],
          ),
          pw.SizedBox(height: 12),
          pw.Divider(color: PdfColors.grey400, thickness: 0.5),
          pw.SizedBox(height: 10),
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('GUEST / CLIENT:',
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 10)),
                    pw.SizedBox(height: 3),
                    pw.Text(clientName,
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 11)),
                    if (clientPhone != null && clientPhone.isNotEmpty)
                      pw.Text(clientPhone,
                          style: const pw.TextStyle(fontSize: 9)),
                    if (clientDetails != null && clientDetails.isNotEmpty)
                      pw.Text(clientDetails,
                          style: const pw.TextStyle(fontSize: 9)),
                  ],
                ),
              ),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text('Invoice #: $invoiceNumber',
                      style: pw.TextStyle(
                          fontWeight: pw.FontWeight.bold, fontSize: 10)),
                  pw.SizedBox(height: 2),
                  pw.Text('Date: $invoiceDate',
                      style: const pw.TextStyle(fontSize: 9)),
                  pw.Text('Due Date: $dueDate',
                      style: const pw.TextStyle(fontSize: 9)),
                ],
              ),
            ],
          ),
          pw.SizedBox(height: 14),
          pw.Table(
            border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.5),
            children: [
              pw.TableRow(
                decoration: const pw.BoxDecoration(color: PdfColors.grey300),
                children: [
                  _pdfHeaderCell('Description'),
                  _pdfHeaderCell('Qty'),
                  _pdfHeaderCell('Unit Price (KES)'),
                  _pdfHeaderCell('VAT'),
                  _pdfHeaderCell('Total Amount'),
                ],
              ),
              ...items.asMap().entries.map((entry) {
                final idx = entry.key;
                final item = entry.value;
                final desc = item['description']?.toString() ?? 'Item';
                final qty = (item['qty'] as num?)?.toInt() ?? 1;
                final price = (item['unitPrice'] as num?)?.toDouble() ?? 0.0;
                final tot =
                    (item['totalAmount'] as num?)?.toDouble() ?? (qty * price);

                return pw.TableRow(
                  decoration: pw.BoxDecoration(
                    color: idx.isOdd ? PdfColors.grey100 : PdfColors.white,
                  ),
                  children: [
                    _pdfDataCell(desc),
                    _pdfDataCell('$qty'),
                    _pdfDataCell('Ksh ${numFormat.format(price)}'),
                    _pdfDataCell('16%'),
                    _pdfDataCell('Ksh ${numFormat.format(tot)}', isBold: true),
                  ],
                );
              }),
            ],
          ),
          pw.SizedBox(height: 14),
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.end,
            children: [
              pw.SizedBox(
                width: 250,
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    _pdfSummaryRow('Subtotal (Excl. Tax & Levies):',
                        'Ksh ${numFormat.format(netSubtotal)}'),
                    _pdfSummaryRow('VAT Amount (16.00%):',
                        'Ksh ${numFormat.format(vatAmount)}'),
                    _pdfSummaryRow('Catering Levy (CL 2.00%):',
                        'Ksh ${numFormat.format(clAmount)}'),
                    _pdfSummaryRow('Service Charge (SC 3.00%):',
                        'Ksh ${numFormat.format(scAmount)}'),
                    pw.Divider(color: PdfColors.grey400, thickness: 0.5),
                    _pdfSummaryRow('GRAND TOTAL:',
                        'Ksh ${numFormat.format(grossTotal)}',
                        isBold: true, fontSize: 11),
                    _pdfSummaryRow('Total Payment Done:',
                        'Ksh ${numFormat.format(paid)}',
                        color: PdfColors.green800),
                    _pdfSummaryRow('Balance Due:',
                        'Ksh ${numFormat.format(balance)}',
                        isBold: true,
                        color: balance > 0
                            ? PdfColors.red800
                            : PdfColors.green800),
                  ],
                ),
              ),
            ],
          ),
          pw.SizedBox(height: 14),
          if (notes != null && notes.isNotEmpty) ...[
            pw.Text('Notes / Instructions:',
                style:
                    pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
            pw.SizedBox(height: 2),
            pw.Text(notes,
                style: const pw.TextStyle(
                    fontSize: 8, color: PdfColors.grey700)),
          ],
        ];
      },
      footer: (pw.Context ctx) {
        return pw.Container(
          margin: const pw.EdgeInsets.only(top: 10),
          padding: const pw.EdgeInsets.only(top: 6),
          decoration: const pw.BoxDecoration(
            border: pw.Border(
              top: pw.BorderSide(color: PdfColors.grey300, width: 0.5),
            ),
          ),
          child: pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(
                  'FamousGate Hotels - Finance System | www.famousgatehotels.com',
                  style: const pw.TextStyle(
                      fontSize: 7, color: PdfColors.grey600)),
              pw.Text('Page ${ctx.pageNumber} of ${ctx.pagesCount}',
                  style: const pw.TextStyle(
                      fontSize: 7, color: PdfColors.grey600)),
            ],
          ),
        );
      },
    ),
  );

  await Printing.layoutPdf(
    onLayout: (PdfPageFormat format) async => pdf.save(),
    name: 'Invoice_${invoiceNumber.replaceAll('/', '_')}.pdf',
  );
}

pw.Widget _pdfHeaderCell(String text, {pw.TextAlign align = pw.TextAlign.left}) {
  return pw.Padding(
    padding: const pw.EdgeInsets.all(5),
    child: pw.Text(text,
        textAlign: align,
        style: pw.TextStyle(
            fontWeight: pw.FontWeight.bold,
            fontSize: 8,
            color: PdfColors.black)),
  );
}

pw.Widget _pdfDataCell(String text, {bool isBold = false}) {
  return pw.Padding(
    padding: const pw.EdgeInsets.all(5),
    child: pw.Text(text,
        style: pw.TextStyle(
            fontSize: 8,
            fontWeight: isBold ? pw.FontWeight.bold : pw.FontWeight.normal)),
  );
}

Future<void> printRoomsReportPDF({
  required BuildContext context,
  required List<Room> rooms,
  required String branchName,
}) async {
  final pdf = pw.Document();
  pw.MemoryImage? logoImage;
  try {
    final logoBytes =
        await rootBundle.load('assets/frontend_public/fglogo.png');
    logoImage = pw.MemoryImage(logoBytes.buffer.asUint8List());
  } catch (_) {}

  final totalRooms = rooms.length;
  final availableRooms = rooms.where((r) => r.status == 'available').length;
  final occupiedRoomsList = rooms.where((r) => r.status == 'occupied').toList();
  final occupiedRooms = occupiedRoomsList.length;
  final cleaningRooms =
      rooms.where((r) => r.status == 'cleaning' || r.status == 'dirty').length;
  final maintenanceRooms =
      rooms.where((r) => r.status == 'maintenance').length;
  final occupancyRate = totalRooms > 0
      ? (occupiedRooms / totalRooms * 100).toStringAsFixed(1)
      : '0.0';

  final totalAdultPax = occupiedRoomsList.fold<int>(0, (sum, r) => sum + r.adults);
  final totalChildrenPax = occupiedRoomsList.fold<int>(0, (sum, r) => sum + r.children);
  final totalGuestPax = occupiedRoomsList.fold<int>(
      0, (sum, r) => sum + (r.totalPax ?? (r.adults + r.children)));

  final nowStr = DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now());

  // Group rooms by Room Type
  final Map<String, List<Room>> groupedRooms = {};
  for (final room in rooms) {
    final catName = (room.type != null && room.type!.trim().isNotEmpty)
        ? room.type!.trim()
        : 'Standard Room';
    groupedRooms.putIfAbsent(catName, () => []).add(room);
  }

  // Sort categories logically
  final sortedCategories = groupedRooms.keys.toList()
    ..sort((a, b) {
      final aLower = a.toLowerCase();
      final bLower = b.toLowerCase();
      if (aLower.contains('vip') && !bLower.contains('vip')) return -1;
      if (bLower.contains('vip') && !aLower.contains('vip')) return 1;
      if (aLower.contains('executive') && !bLower.contains('executive')) return -1;
      if (bLower.contains('executive') && !aLower.contains('executive')) return 1;
      if (aLower.contains('deluxe') && !bLower.contains('deluxe')) return -1;
      if (bLower.contains('deluxe') && !aLower.contains('deluxe')) return 1;
      return aLower.compareTo(bLower);
    });

  pdf.addPage(
    pw.MultiPage(
      pageTheme: pw.PageTheme(
        pageFormat: PdfPageFormat.a4.landscape,
        margin: const pw.EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      ),
      build: (pw.Context ctx) {
        return [
          // FamousGate Branding Header
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              if (logoImage != null)
                pw.Image(logoImage, width: 72, height: 45)
              else
                pw.Container(width: 72),
              pw.SizedBox(width: 14),
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('FamousGate Hotels',
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 16)),
                    pw.Text('Bomet, Kenya | Tel: 0706782828 | Email: famousgatesbmt@gmail.com',
                        style: const pw.TextStyle(
                            fontSize: 9, color: PdfColors.grey700)),
                    pw.Text('www.famousgatehotels.com',
                        style: pw.TextStyle(
                            fontSize: 9,
                            fontWeight: pw.FontWeight.bold,
                            color: PdfColors.blue800)),
                  ],
                ),
              ),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text('ROOM LIST & OCCUPANCY REPORT',
                      style: pw.TextStyle(
                          fontSize: 16,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColors.grey900)),
                  pw.Text('CATEGORIZED BY ROOM TYPE & GUEST PAX',
                      style: pw.TextStyle(
                          fontSize: 10,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColors.blue800)),
                  pw.SizedBox(height: 2),
                  pw.Text('Printed: $nowStr',
                      style: const pw.TextStyle(
                          fontSize: 8, color: PdfColors.grey700)),
                ],
              ),
            ],
          ),
          pw.SizedBox(height: 8),
          pw.Divider(color: PdfColors.grey400, thickness: 0.5),
          pw.SizedBox(height: 8),

          // Operational & Pax KPI Summary Box
          pw.Container(
            padding: const pw.EdgeInsets.symmetric(vertical: 8, horizontal: 12),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: PdfColors.grey400, width: 0.5),
              color: PdfColors.grey100,
              borderRadius: const pw.BorderRadius.all(pw.Radius.circular(4)),
            ),
            child: pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceAround,
              children: [
                _pdfKpiItem('Total Rooms', '$totalRooms', PdfColors.black),
                _pdfKpiItem('Occupied', '$occupiedRooms', PdfColors.blue800),
                _pdfKpiItem('Available', '$availableRooms', PdfColors.green800),
                _pdfKpiItem('Cleaning', '$cleaningRooms', PdfColors.orange800),
                _pdfKpiItem('Maintenance', '$maintenanceRooms', PdfColors.red800),
                _pdfKpiItem('Adult Pax', '$totalAdultPax', PdfColors.purple800),
                _pdfKpiItem('Child Pax', '$totalChildrenPax', PdfColors.teal800),
                _pdfKpiItem('Total Guest Pax', '$totalGuestPax', PdfColors.blue900),
                _pdfKpiItem('Occupancy Rate', '$occupancyRate%', PdfColors.purple900),
              ],
            ),
          ),
          pw.SizedBox(height: 12),

          // Render tables grouped by Category
          ...sortedCategories.map((category) {
            final categoryRooms = groupedRooms[category] ?? [];
            final catTotalRooms = categoryRooms.length;
            final catOccupiedList =
                categoryRooms.where((r) => r.status == 'occupied').toList();
            final catOccupiedCount = catOccupiedList.length;
            final catAdultPax = catOccupiedList.fold<int>(0, (sum, r) => sum + r.adults);
            final catChildPax = catOccupiedList.fold<int>(0, (sum, r) => sum + r.children);
            final catTotalPax = catOccupiedList.fold<int>(
                0, (sum, r) => sum + (r.totalPax ?? (r.adults + r.children)));

            return pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                // Category Banner
                pw.Container(
                  width: double.infinity,
                  padding: const pw.EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                  decoration: const pw.BoxDecoration(
                    color: PdfColors.blue900,
                    borderRadius: pw.BorderRadius.only(
                      topLeft: pw.Radius.circular(3),
                      topRight: pw.Radius.circular(3),
                    ),
                  ),
                  child: pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: [
                      pw.Text(
                        '${category.toUpperCase()} CATEGORY (${catTotalRooms} ROOMS)',
                        style: pw.TextStyle(
                          color: PdfColors.white,
                          fontSize: 10,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                      pw.Text(
                        'Occupied: $catOccupiedCount | Adults: $catAdultPax | Children: $catChildPax | Total Category Pax: $catTotalPax',
                        style: pw.TextStyle(
                          color: PdfColors.white,
                          fontSize: 9,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),

                // Category Data Table
                pw.Table(
                  border: pw.TableBorder.all(color: PdfColors.grey400, width: 0.5),
                  columnWidths: const {
                    0: pw.FlexColumnWidth(1.0), // Room #
                    1: pw.FlexColumnWidth(2.8), // Guest Name
                    2: pw.FlexColumnWidth(2.0), // Meal Plan
                    3: pw.FlexColumnWidth(2.2), // Check-in Date & Time
                    4: pw.FlexColumnWidth(1.8), // Check-out Date
                    5: pw.FlexColumnWidth(0.9), // Adults
                    6: pw.FlexColumnWidth(0.9), // Children
                    7: pw.FlexColumnWidth(1.0), // Total Pax
                    8: pw.FlexColumnWidth(1.5), // Status
                  },
                  children: [
                    // Table Header
                    pw.TableRow(
                      decoration: const pw.BoxDecoration(color: PdfColors.grey300),
                      children: [
                        _pdfHeaderCell('Room #'),
                        _pdfHeaderCell('Guest Name'),
                        _pdfHeaderCell('Meal Plan'),
                        _pdfHeaderCell('Check-In Date & Time'),
                        _pdfHeaderCell('Check-Out Date'),
                        _pdfHeaderCell('Adults', align: pw.TextAlign.center),
                        _pdfHeaderCell('Children', align: pw.TextAlign.center),
                        _pdfHeaderCell('Total Pax', align: pw.TextAlign.center),
                        _pdfHeaderCell('Status', align: pw.TextAlign.center),
                      ],
                    ),

                    // Data Rows
                    ...categoryRooms.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final r = entry.value;
                      final isOccupied = r.status == 'occupied';

                      final guestName = isOccupied
                          ? (r.guestName ?? 'Occupied Guest')
                          : '-';
                      final mealPlanStr = isOccupied
                          ? r.effectiveMealPlan
                          : (r.effectiveMealPlan != 'Room Only'
                              ? '${r.effectiveMealPlan} (Included)'
                              : '-');

                      final checkInStr = isOccupied
                          ? (r.checkedInAt != null
                              ? DateFormat('dd/MM/yyyy HH:mm').format(r.checkedInAt!)
                              : (r.checkInDate != null
                                  ? DateFormat('dd/MM/yyyy').format(r.checkInDate!)
                                  : '-'))
                          : '-';

                      final checkOutStr = isOccupied
                          ? (r.checkOutDate != null
                              ? DateFormat('dd/MM/yyyy').format(r.checkOutDate!)
                              : '-')
                          : '-';

                      final adultPaxStr = isOccupied ? '${r.adults}' : '0';
                      final childPaxStr = isOccupied ? '${r.children}' : '0';
                      final totalPaxStr = isOccupied
                          ? '${r.totalPax ?? (r.adults + r.children)}'
                          : '0';

                      return pw.TableRow(
                        decoration: pw.BoxDecoration(
                          color: idx.isOdd ? PdfColors.grey100 : PdfColors.white,
                        ),
                        children: [
                          _pdfRoomDataCell(r.displayNumber, isBold: true),
                          _pdfRoomDataCell(guestName, isBold: isOccupied),
                          _pdfRoomDataCell(mealPlanStr),
                          _pdfRoomDataCell(checkInStr),
                          _pdfRoomDataCell(checkOutStr),
                          _pdfRoomDataCell(adultPaxStr, align: pw.TextAlign.center),
                          _pdfRoomDataCell(childPaxStr, align: pw.TextAlign.center),
                          _pdfRoomDataCell(totalPaxStr,
                              isBold: isOccupied, align: pw.TextAlign.center),
                          _pdfRoomDataCell(
                            r.status.toUpperCase(),
                            align: pw.TextAlign.center,
                            color: isOccupied
                                ? PdfColors.blue800
                                : (r.status == 'available'
                                    ? PdfColors.green800
                                    : (r.status == 'maintenance'
                                        ? PdfColors.red800
                                        : PdfColors.orange800)),
                            isBold: true,
                          ),
                        ],
                      );
                    }),

                    // Category Totals Summary Row
                    pw.TableRow(
                      decoration: const pw.BoxDecoration(color: PdfColors.grey200),
                      children: [
                        _pdfRoomDataCell('TOTALS', isBold: true),
                        _pdfRoomDataCell(
                            '${category.toUpperCase()} CATEGORY SUMMARY',
                            isBold: true),
                        _pdfRoomDataCell('Occupied: $catOccupiedCount / $catTotalRooms',
                            isBold: true),
                        _pdfRoomDataCell('-'),
                        _pdfRoomDataCell('-'),
                        _pdfRoomDataCell('$catAdultPax',
                            isBold: true, align: pw.TextAlign.center),
                        _pdfRoomDataCell('$catChildPax',
                            isBold: true, align: pw.TextAlign.center),
                        _pdfRoomDataCell('$catTotalPax',
                            isBold: true,
                            color: PdfColors.blue900,
                            align: pw.TextAlign.center),
                        _pdfRoomDataCell('-', align: pw.TextAlign.center),
                      ],
                    ),
                  ],
                ),
                pw.SizedBox(height: 14),
              ],
            );
          }),

          pw.SizedBox(height: 16),

          // Signatures Block
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Container(
                      width: 220,
                      child: pw.Divider(
                          color: PdfColors.grey400, thickness: 0.5)),
                  pw.SizedBox(height: 2),
                  pw.Text('Reception Officer Signature & Stamp',
                      style: const pw.TextStyle(
                          fontSize: 8, color: PdfColors.grey700)),
                ],
              ),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Container(
                      width: 220,
                      child: pw.Divider(
                          color: PdfColors.grey400, thickness: 0.5)),
                  pw.SizedBox(height: 2),
                  pw.Text('Front Office Manager Signature & Stamp',
                      style: const pw.TextStyle(
                          fontSize: 8, color: PdfColors.grey700)),
                ],
              ),
            ],
          ),
        ];
      },
      footer: (pw.Context ctx) {
        return pw.Container(
          margin: const pw.EdgeInsets.only(top: 8),
          padding: const pw.EdgeInsets.only(top: 4),
          decoration: const pw.BoxDecoration(
            border: pw.Border(
              top: pw.BorderSide(color: PdfColors.grey300, width: 0.5),
            ),
          ),
          child: pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(
                  'FamousGate Hotels - Reception System | Room List & Guest Pax Manifest | www.famousgatehotels.com',
                  style: const pw.TextStyle(
                      fontSize: 7, color: PdfColors.grey600)),
              pw.Text('Page ${ctx.pageNumber} of ${ctx.pagesCount}',
                  style: const pw.TextStyle(
                      fontSize: 7, color: PdfColors.grey600)),
            ],
          ),
        );
      },
    ),
  );

  await Printing.layoutPdf(
    onLayout: (PdfPageFormat format) async => pdf.save(),
    format: PdfPageFormat.a4.landscape,
    name:
        'Room_List_Occupancy_Pax_Report_${DateFormat('yyyyMMdd').format(DateTime.now())}.pdf',
  );
}

pw.Widget _pdfKpiItem(String label, String value, PdfColor color) {
  return pw.Column(
    children: [
      pw.Text(label,
          style: const pw.TextStyle(fontSize: 7, color: PdfColors.grey700)),
      pw.SizedBox(height: 2),
      pw.Text(value,
          style: pw.TextStyle(
              fontSize: 11, fontWeight: pw.FontWeight.bold, color: color)),
    ],
  );
}

pw.Widget _pdfRoomDataCell(
  String text, {
  bool isBold = false,
  PdfColor? color,
  pw.TextAlign align = pw.TextAlign.left,
}) {
  return pw.Padding(
    padding: const pw.EdgeInsets.all(5),
    child: pw.Text(
      text,
      textAlign: align,
      style: pw.TextStyle(
        fontSize: 8,
        color: color ?? PdfColors.black,
        fontWeight: isBold ? pw.FontWeight.bold : pw.FontWeight.normal,
      ),
    ),
  );
}

pw.Widget _pdfSummaryRow(String label, String value,
    {bool isBold = false, double fontSize = 9, PdfColor? color}) {
  return pw.Padding(
    padding: const pw.EdgeInsets.symmetric(vertical: 2),
    child: pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      children: [
        pw.Text(label,
            style: pw.TextStyle(
                fontSize: fontSize,
                fontWeight:
                    isBold ? pw.FontWeight.bold : pw.FontWeight.normal)),
        pw.Text(value,
            style: pw.TextStyle(
                fontSize: fontSize,
                fontWeight:
                    isBold ? pw.FontWeight.bold : pw.FontWeight.normal,
                color: color ?? PdfColors.black)),
      ],
    ),
  );
}

Future<void> printReceptionPaymentReceipt({
  required WidgetRef ref,
  required Booking booking,
  required num paymentAmount,
  required String paymentMethod,
  String? cashierName,
  String? referenceCode,
}) async {
  final nights = booking.checkOut.difference(booking.checkIn).inDays;
  final String refCode = referenceCode ??
      booking.confirmationNumber ??
      'REC-${booking.id.substring(0, 8)}';
  final String roomStr = booking.roomNumber ?? 'Unassigned';
  final String guestNameStr = booking.guestName ?? 'Guest';

  await printCustomerDocument(
    ref,
    templateKey: 'customer_receipt',
    fallbackTitle: 'CUSTOMER RECEIPT',
    branchId: booking.raw['branch_id']?.toString() ?? '1',
    sale: SaleResult(
      transactionId: refCode,
      createdAt: DateTime.now(),
      receiptNumber: refCode,
      cashierName: cashierName ?? 'Reception',
      total: paymentAmount.toDouble(),
      paymentMethod: _label(paymentMethod),
    ),
    items: [
      CartItem(
        productId: 'room_stay_${booking.id}',
        name:
            'Room $roomStr Accommodation Stay (${nights > 0 ? nights : 1} Night(s))',
        unitPrice: paymentAmount.toDouble(),
        qty: 1,
      )
    ],
    branchName: 'FamousGate Hotels',
    roomNumber: roomStr,
    customerName: guestNameStr,
    publicCode: refCode,
    amountTendered: paymentAmount,
    changeGiven: 0,
  );
}

Future<void> _downloadCheckoutBill(
    BuildContext context, WidgetRef ref, Booking booking) async {
  try {
    final total = (booking.totalAmount ?? 0) > 0
        ? booking.totalAmount!
        : booking.balance + (booking.amountPaid ?? 0);
    final nights = booking.checkOut.difference(booking.checkIn).inDays;
    final String invNo =
        booking.confirmationNumber ?? 'INV-${booking.id.substring(0, 8)}';
    final String todayStr = DateFormat('dd/MM/yyyy').format(DateTime.now());
    final String checkOutStr =
        DateFormat('dd/MM/yyyy').format(booking.checkOut);

    await printBookingInvoicePDF(
      context: context,
      invoiceNumber: invNo,
      invoiceDate: todayStr,
      dueDate: checkOutStr,
      clientName: booking.guestName ?? 'Guest',
      clientPhone: booking.guestPhone,
      clientDetails:
          'Room: ${booking.roomNumber ?? 'Unassigned'} • Stay: ${nights > 0 ? nights : 1} Night(s)',
      items: [
        {
          'description':
              'Accommodation - Room ${booking.roomNumber ?? '-'} (${nights > 0 ? nights : 1} Night stay)',
          'qty': nights > 0 ? nights : 1,
          'unitPrice': nights > 0 ? (total / nights) : total,
          'totalAmount': total,
        }
      ],
      totalAmount: total,
      amountPaid: booking.amountPaid ?? 0.0,
      balanceDue: booking.balance,
      notes:
          'Thank you for staying at FamousGate Hotels! Visit www.famousgatehotels.com',
    );
  } catch (error) {
    if (context.mounted) {
      _snack(context, 'Checkout bill print failed: $error', error: true);
    }
  }
}

Future<void> _downloadConferenceInvoice(
    BuildContext context, WidgetRef ref, String id) async {
  try {
    final String todayStr = DateFormat('dd/MM/yyyy').format(DateTime.now());
    await printBookingInvoicePDF(
      context: context,
      invoiceNumber: 'CONF-$id',
      invoiceDate: todayStr,
      dueDate: todayStr,
      clientName: 'Conference Booking Client',
      clientDetails: 'Conference Hall Reservation Ref: #$id',
      items: [
        {
          'description': 'Conference Hall Rental & Event Services',
          'qty': 1,
          'unitPrice': 0.0,
          'totalAmount': 0.0,
        }
      ],
      totalAmount: 0.0,
      amountPaid: 0.0,
      notes:
          'Conference Hall Invoice. FamousGate Hotels | www.famousgatehotels.com',
    );
  } catch (error) {
    if (context.mounted) {
      _snack(context, 'Invoice print failed: $error', error: true);
    }
  }
}

Future<void> _showFolioDialog(
    BuildContext context, WidgetRef ref, Booking booking) async {
  List<Map<String, dynamic>> folioTransactions = [];
  bool loadingTransactions = true;

  try {
    final dio = ref.read(dioProvider);
    final res = await dio.get(
      '/room-charge/reports',
      queryParameters: {
        'room_number': booking.roomNumber,
        'status': 'all',
      },
    );
    if (res.data['success'] == true) {
      folioTransactions =
          List<Map<String, dynamic>>.from(res.data['transactions'] ?? []);
    }
  } catch (_) {}
  loadingTransactions = false;

  await showDialog<void>(
    context: context,
    builder: (dialogCtx) => StatefulBuilder(
      builder: (context, setFolioState) {
        return AlertDialog(
          title: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.receipt_long, color: AppColors.kPrimary),
                  const SizedBox(width: 8),
                  Text(
                      'Guest Folio — Room ${booking.roomNumber ?? ''} (${booking.guestName ?? 'Guest'})'),
                ],
              ),
            ],
          ),
          content: SizedBox(
            width: 720,
            height: 520,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.blue.shade200),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Booking Ref: ${booking.confirmationNumber ?? '-'}',
                          style: const TextStyle(fontWeight: FontWeight.bold)),
                      Text('Total: ${_money(booking.totalAmount ?? 0)}'),
                      Text('Paid: ${_money(booking.amountPaid ?? 0)}'),
                      Text('Balance Due: ${_money(booking.balance)}',
                          style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: AppColors.kPrimary)),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text('FOLIO CHARGES BREAKDOWN',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey,
                        letterSpacing: 0.8)),
                const SizedBox(height: 8),
                Expanded(
                  child: loadingTransactions
                      ? const Center(child: CircularProgressIndicator())
                      : folioTransactions.isEmpty
                          ? Center(
                              child: Text(
                                'No external outlet charges posted yet. Accommodation charges only.',
                                style: TextStyle(color: Colors.grey.shade600),
                              ),
                            )
                          : ListView.separated(
                              itemCount: folioTransactions.length,
                              separatorBuilder: (_, __) =>
                                  const Divider(height: 1),
                              itemBuilder: (context, idx) {
                                final trans = folioTransactions[idx];
                                final isReversed =
                                    trans['status'] == 'reversed';
                                final desc =
                                    trans['description'] ?? 'Charge';
                                final cat = trans['category'] ?? 'Outlet';
                                final amt = _money(trans['amount'] ?? 0);
                                final dateStr = trans['created_at'] != null
                                    ? DateFormat('dd MMM, HH:mm').format(
                                        DateTime.parse(trans['created_at']))
                                    : '-';
                                final List items =
                                    trans['items_snapshot'] is List
                                        ? trans['items_snapshot']
                                        : [];

                                return ExpansionTile(
                                  leading: Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: BoxDecoration(
                                      color: isReversed
                                          ? Colors.red.shade50
                                          : AppColors.kPrimary
                                              .withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Icon(
                                      isReversed ? Icons.undo : Icons.store,
                                      size: 18,
                                      color: isReversed
                                          ? Colors.red
                                          : AppColors.kPrimary,
                                    ),
                                  ),
                                  title: Text(
                                    desc,
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      decoration: isReversed
                                          ? TextDecoration.lineThrough
                                          : null,
                                      color: isReversed
                                          ? Colors.grey
                                          : Colors.black87,
                                    ),
                                  ),
                                  subtitle: Text(
                                      '$dateStr • Category: $cat • Posted by: ${trans['posted_by_name'] ?? 'Staff'}'),
                                  trailing: Text(
                                    amt,
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                      color: isReversed
                                          ? Colors.red
                                          : AppColors.kPrimary,
                                    ),
                                  ),
                                  children: [
                                    if (items.isNotEmpty)
                                      Padding(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 16, vertical: 8),
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            const Text('Item Snapshot:',
                                                style: TextStyle(
                                                    fontWeight:
                                                        FontWeight.bold,
                                                    fontSize: 12)),
                                            const SizedBox(height: 4),
                                            ...items.map((it) {
                                              final iName = it['name'] ??
                                                  it['product_name'] ??
                                                  'Item';
                                              final iQty = it['qty'] ??
                                                  it['quantity'] ??
                                                  1;
                                              final iPrice = _money(
                                                  it['unitPrice'] ??
                                                      it['price'] ??
                                                      0);
                                              return Padding(
                                                padding: const EdgeInsets.only(
                                                    left: 8, bottom: 2),
                                                child: Text(
                                                    '• $iQty × $iName @ $iPrice',
                                                    style: const TextStyle(
                                                        fontSize: 12)),
                                              );
                                            }),
                                          ],
                                        ),
                                      ),
                                  ],
                                );
                              },
                            ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogCtx),
              child: const Text('Close'),
            ),
            OutlinedButton.icon(
              icon: const Icon(Icons.receipt, size: 16),
              label: const Text('Print Receipt (Thermal)'),
              onPressed: () async {
                Navigator.pop(dialogCtx);
                await printReceptionPaymentReceipt(
                  ref: ref,
                  booking: booking,
                  paymentAmount: booking.amountPaid ?? 0,
                  paymentMethod: 'card_or_cash',
                );
              },
            ),
            ElevatedButton.icon(
              icon: const Icon(Icons.picture_as_pdf, size: 16),
              label: const Text('Print Bill / Invoice (PDF)'),
              onPressed: () {
                Navigator.pop(dialogCtx);
                _downloadCheckoutBill(context, ref, booking);
              },
            ),
          ],
        );
      },
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
          final price = _num(h, [
            'base_price_per_day',
            'price_per_day',
            'rate',
            'price',
            'amount'
          ]);
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

void _openReceptionCashier(
  BuildContext context, {
  String? billRef,
  String? amount,
  String? method,
}) {
  final query = <String, String>{
    if (billRef != null && billRef.trim().isNotEmpty) 'billId': billRef.trim(),
    if (amount != null && amount.trim().isNotEmpty) 'amount': amount.trim(),
    if (method != null && method.trim().isNotEmpty) 'method': method.trim(),
  };
  context
      .go(Uri(path: '/reception/cashier', queryParameters: query).toString());
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
                  _snack(
                      context, apiErrorMessage(e, fallback: 'Payment failed'),
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
