import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import 'package:intl/intl.dart';
import '../domain/session_models.dart';
import '../domain/session_providers.dart';
import '../data/repository.dart';
import '../../auth/domain/auth_notifier.dart';
import '../../branch_storekeeper/data/branch_storekeeper_repository.dart';
import '../../branch_storekeeper/presentation/kitchen_production_logging_screen.dart';
import '../../branch_storekeeper/presentation/kitchen_stocktake_screen.dart';
import '../../branch_storekeeper/presentation/record_spoilage_screen.dart';
import '../../../core/widgets/app_notifier.dart';
import 'kitchen_prep_batches_screen.dart';

class KitchenSessionsScreen extends ConsumerStatefulWidget {
  const KitchenSessionsScreen({super.key});

  @override
  ConsumerState<KitchenSessionsScreen> createState() =>
      _KitchenSessionsScreenState();
}

class _KitchenSessionsScreenState extends ConsumerState<KitchenSessionsScreen> {
  final _uuid = const Uuid();
  bool _isSubmitting = false;

  String _kitchenShiftLabel(KitchenShift shift) {
    final subShift = shift.subShiftType?.trim();
    if (subShift != null && subShift.isNotEmpty) {
      return subShift;
    }
    return 'A';
  }

  String? _eventTypeForChannel(String channelCode) {
    switch (channelCode) {
      case 'conference_event':
        return 'conference';
      case 'buffet':
        return 'buffet';
      case 'outside_catering':
        return 'outside_catering';
      case 'group_meal':
        return 'group_meal';
      default:
        return null;
    }
  }

  Future<void> _openKitchenSpoilage(KitchenShift shift) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => RecordSpoilageScreen(
          initialArea: 'kitchen',
          initialShift: _kitchenShiftLabel(shift),
          initialKitchenShiftId: shift.id,
        ),
      ),
    );
  }

  Future<void> _openKitchenStocktake() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const KitchenStocktakeScreen(),
      ),
    );
  }

  Future<void> _openProductionLogging() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const KitchenProductionLoggingScreen(),
      ),
    );
  }

  Future<void> _openPrepBatches(KitchenShift shift) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => KitchenPrepBatchesScreen(shift: shift),
      ),
    );
  }

  Future<void> _openSessionHistory() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const _KitchenSessionHistoryScreen(),
      ),
    );
  }

  Future<void> _openIssueStockScreen(KitchenShift shift,
      {required String channelCode}) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => _KitchenIssueStockScreen(
          shift: shift,
          channelCode: channelCode,
        ),
      ),
    );
    ref.invalidate(shiftDetailsProvider(shift.id));
  }

  String _formatSessionDate(String rawDate) {
    try {
      final parsed = DateTime.parse(rawDate);
      return DateFormat('EEE, d MMM yyyy').format(parsed);
    } catch (_) {
      return rawDate;
    }
  }

  String _formatSessionTime(String rawDateTime) {
    try {
      final parsed = DateTime.parse(rawDateTime).toLocal();
      return DateFormat('d MMM - HH:mm').format(parsed);
    } catch (_) {
      return rawDateTime;
    }
  }

  ({Color fg, Color bg, Color border}) _statusPalette(String status) {
    switch (status.toLowerCase()) {
      case 'open':
        return (
          fg: const Color(0xFF2E7D32),
          bg: const Color(0xFFE8F5E9),
          border: const Color(0xFFA5D6A7),
        );
      case 'closed':
        return (
          fg: const Color(0xFF6A1B9A),
          bg: const Color(0xFFF3E5F5),
          border: const Color(0xFFCE93D8),
        );
      default:
        return (
          fg: const Color(0xFF8D6E63),
          bg: const Color(0xFFEFEBE9),
          border: const Color(0xFFBCAAA4),
        );
    }
  }

  Widget _metaChip({
    required IconData icon,
    required String label,
    required String value,
    Color? tint,
  }) {
    final color = tint ?? const Color(0xFF23476A);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.18)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          RichText(
            text: TextSpan(
              style: TextStyle(
                color: Colors.blueGrey.shade800,
                fontSize: 13,
              ),
              children: [
                TextSpan(
                  text: '$label: ',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                TextSpan(text: value),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _sessionStatTile({
    required String label,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      constraints: const BoxConstraints(minWidth: 160),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.16)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label.toUpperCase(),
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: Colors.blueGrey.shade500,
                  letterSpacing: 0.4,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _sectionShell({
    required String title,
    String? subtitle,
    Widget? trailing,
    required Widget child,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
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
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        subtitle,
                        style: TextStyle(
                          color: Colors.blueGrey.shade600,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: 12),
                trailing,
              ],
            ],
          ),
          const SizedBox(height: 18),
          child,
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final configAsync = ref.watch(shiftConfigProvider);
    final user = ref.watch(authNotifierProvider).valueOrNull;
    final userRole = user?.role ?? '';
    const writeRoles = {
      'kitchen_operations',
      'branch_storekeeper',
      'storekeeper'
    };
    final isWriteUser = writeRoles.contains(userRole) ||
        user?.roles.any(writeRoles.contains) == true;
    const accountantRoles = {
      'branch_accountant',
      'accountant',
      'super_admin',
      'director',
      'general_manager',
      'branch_manager',
    };
    final isAccountant = accountantRoles.contains(userRole) ||
        user?.roles.any(accountantRoles.contains) == true;

    return configAsync.when(
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, stack) => Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('Error loading shift configuration: $error',
                  style: const TextStyle(color: Colors.red)),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref.invalidate(shiftConfigProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
      data: (config) {
        if (!config.enabled) {
          return Scaffold(
            appBar: AppBar(title: const Text('Kitchen Shift Sessions')),
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(32.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.block, size: 64, color: Colors.red),
                    const SizedBox(height: 16),
                    const Text(
                      'Kitchen Sessions Disabled',
                      style:
                          TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      isAccountant
                          ? 'Kitchen Sessions has not been configured for this branch yet. Select a shift operating model below to activate kitchen sessions.'
                          : 'Kitchen Shift Sessions have not been activated for this branch yet.\nPlease contact your Branch Accountant to perform initial shift mode configuration.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.grey),
                    ),
                    if (isAccountant) ...[
                      const SizedBox(height: 32),
                      const Text(
                        'Activate Kitchen Shift Session Mode',
                        style: TextStyle(
                            fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 16,
                        runSpacing: 16,
                        alignment: WrapAlignment.center,
                        children: [
                          ElevatedButton.icon(
                            icon: const Icon(Icons.looks_one),
                            label: const Text('Single Shift (All Day)'),
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 24, vertical: 16),
                              backgroundColor: Theme.of(context).primaryColor,
                              foregroundColor: Colors.white,
                            ),
                            onPressed: () async {
                              try {
                                await ref
                                    .read(kitchenRepositoryProvider)
                                    .configureShiftMode('SINGLE_SHIFT');
                                ref.invalidate(shiftConfigProvider);
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                          'Single Shift mode activated successfully!'),
                                      backgroundColor: Colors.green,
                                    ),
                                  );
                                }
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('Error: $e'),
                                      backgroundColor: Colors.red,
                                    ),
                                  );
                                }
                              }
                            },
                          ),
                          ElevatedButton.icon(
                            icon: const Icon(Icons.looks_two),
                            label: const Text('Two Shifts (Shift A / Shift B)'),
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 24, vertical: 16),
                              backgroundColor: Colors.blue.shade700,
                              foregroundColor: Colors.white,
                            ),
                            onPressed: () async {
                              try {
                                await ref
                                    .read(kitchenRepositoryProvider)
                                    .configureShiftMode('TWO_SHIFT');
                                ref.invalidate(shiftConfigProvider);
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                          'Two Shifts mode activated successfully!'),
                                      backgroundColor: Colors.green,
                                    ),
                                  );
                                }
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('Error: $e'),
                                      backgroundColor: Colors.red,
                                    ),
                                  );
                                }
                              }
                            },
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        }

        final activeShiftAsync = ref.watch(activeKitchenShiftProvider);

        return Scaffold(
          appBar: AppBar(
            title: const Text('Kitchen Shift Sessions'),
              IconButton(
                icon: const Icon(Icons.history_outlined),
                tooltip: 'Kitchen Session History',
                onPressed: _openSessionHistory,
              ),
              if (isAccountant)
                IconButton(
                  icon: const Icon(Icons.settings),
                  tooltip: 'Configure Kitchen Sessions',
                  onPressed: () =>
                      _showConfigDialog(context, ref, config.shiftMode),
                ),
              IconButton(
                icon: const Icon(Icons.refresh),
                onPressed: () {
                  ref.read(activeKitchenShiftProvider.notifier).refresh();
                  ref.invalidate(shiftConfigProvider);
                },
              ),
            ],
          ),
          body: activeShiftAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, stack) => Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('Error: $error',
                      style: const TextStyle(color: Colors.red)),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () =>
                        ref.read(activeKitchenShiftProvider.notifier).refresh(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
            data: (activeShift) {
              if (activeShift == null) {
                if (!isWriteUser) {
                  return Center(
                    child: Card(
                      elevation: 2,
                      margin: const EdgeInsets.all(24.0),
                      child: Padding(
                        padding: const EdgeInsets.all(32.0),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.info_outline,
                                size: 48, color: Colors.blue.shade700),
                            const SizedBox(height: 16),
                            const Text(
                              'No Active Kitchen Session',
                              style: TextStyle(
                                  fontSize: 18, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'There is no active kitchen shift open for today. A kitchen storekeeper must open a shift to begin recording sessions.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Colors.grey),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }
                return _buildOpenShiftView(config);
              }
              return _buildActiveShiftDashboard(activeShift, isWriteUser);
            },
          ),
        );
      },
    );
  }

  // ── OPEN SHIFT VIEW ────────────────────────────────────────────────────────
  Widget _buildOpenShiftView(KitchenShiftConfig config) {
    final staffAsync = ref.watch(staffProfilesProvider);

    String selectedShiftType = 'morning';
    final String? selectedSubShiftType =
        config.shiftMode == 'TWO_SHIFT' ? 'A' : null;
    List<String> selectedChefIds = [];
    List<String> selectedDispenseIds = [];
    final chefSearchController = TextEditingController();
    final dispenseSearchController = TextEditingController();
    String selectedDept = 'KITCHEN';

    return StatefulBuilder(
      builder: (context, setLocalState) {
        final requiresOpeningStocktake = config.openingStocktakeRequired &&
            (config.shiftMode == 'SINGLE_SHIFT' || selectedSubShiftType == 'A');
        final canOpenNow =
            !requiresOpeningStocktake || config.openingStocktakeReady;

        return SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Center(
            child: Container(
              constraints: const BoxConstraints(maxWidth: 600),
              child: Card(
                elevation: 4,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
                child: Padding(
                  padding: const EdgeInsets.all(32.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.kitchen, size: 32, color: Colors.amber),
                          SizedBox(width: 12),
                          Text(
                            'Open Kitchen Shift',
                            style: TextStyle(
                                fontSize: 24, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        config.shiftMode == 'TWO_SHIFT'
                            ? 'Shift A requires Kitchen Stocktake Shift A to be submitted. Shift B carries forward the witnessed closing counts from Shift A.'
                            : 'This branch uses a single kitchen session. Kitchen Stocktake Shift A must be submitted before the session can open.',
                        style: const TextStyle(color: Colors.grey),
                      ),
                      const Divider(height: 32),

                      // Shift Selection / Lock
                      if (config.shiftMode == 'TWO_SHIFT') ...[
                        const Text('Shift (Session)',
                            style: TextStyle(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 8),
                        TextFormField(
                          initialValue: 'Shift A',
                          readOnly: true,
                          decoration: InputDecoration(
                            border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8)),
                            suffixIcon: const Icon(Icons.lock_outline),
                            helperText:
                                'Shift B is opened automatically after Shift A handover.',
                          ),
                        ),
                        const SizedBox(height: 20),
                      ] else ...[
                        const Text('Session',
                            style: TextStyle(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 8),
                        TextFormField(
                          initialValue: 'Single Shift',
                          readOnly: true,
                          decoration: InputDecoration(
                            border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8)),
                            suffixIcon: const Icon(Icons.lock_outline),
                          ),
                        ),
                        const SizedBox(height: 20),
                      ],

                      if (requiresOpeningStocktake) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: canOpenNow
                                ? Colors.green.shade50
                                : Colors.orange.shade50,
                            border: Border.all(
                              color: canOpenNow
                                  ? Colors.green.shade200
                                  : Colors.orange.shade200,
                            ),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(
                                canOpenNow
                                    ? Icons.check_circle_outline
                                    : Icons.warning_amber_rounded,
                                color: canOpenNow
                                    ? Colors.green.shade700
                                    : Colors.orange.shade800,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      canOpenNow
                                          ? 'Kitchen stocktake ready'
                                          : 'Kitchen stocktake required',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w700,
                                        color: canOpenNow
                                            ? Colors.green.shade800
                                            : Colors.orange.shade900,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      canOpenNow
                                          ? 'Kitchen Stocktake Shift ${config.openingStocktakeShift ?? 'A'} has been submitted and the opening session can proceed.'
                                          : (config.openingStocktakeMessage
                                                      ?.isNotEmpty ==
                                                  true
                                              ? config.openingStocktakeMessage!
                                              : 'Storekeeper must submit Kitchen Stocktake Shift ${config.openingStocktakeShift ?? 'A'} before opening this session.'),
                                      style: TextStyle(
                                        color: canOpenNow
                                            ? Colors.green.shade900
                                            : Colors.orange.shade900,
                                      ),
                                    ),
                                    if ((config.openingStocktakeStatus ?? '')
                                        .isNotEmpty) ...[
                                      const SizedBox(height: 4),
                                      Text(
                                        'Current stocktake status: ${config.openingStocktakeStatus}',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: canOpenNow
                                              ? Colors.green.shade800
                                              : Colors.orange.shade800,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),
                      ],

                      // Staff Assignment
                      const Text('Assigned Chef(s)',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      staffAsync.when(
                        loading: () => const CircularProgressIndicator(),
                        error: (err, _) => Text('Error loading staff: $err'),
                        data: (staffList) {
                          final allSelectedIds = {
                            ...selectedChefIds,
                            ...selectedDispenseIds,
                          };
                          final selectedChefs = staffList
                              .where((staff) => selectedChefIds
                                  .contains(staff['id']?.toString() ?? ''))
                              .toList();
                          final selectedDispensers = staffList
                              .where((staff) => selectedDispenseIds
                                  .contains(staff['id']?.toString() ?? ''))
                              .toList();
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _StaffAutocompleteField(
                                label: 'Search and add chef',
                                controller: chefSearchController,
                                staffList: staffList,
                                selectedIds: allSelectedIds,
                                onSelected: (staff) {
                                  final id = staff['id']?.toString() ?? '';
                                  if (id.isEmpty || allSelectedIds.contains(id))
                                    return;
                                  setLocalState(() {
                                    selectedChefIds = [...selectedChefIds, id];
                                    chefSearchController.clear();
                                  });
                                },
                              ),
                              if (selectedChefs.isNotEmpty) ...[
                                const SizedBox(height: 12),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: selectedChefs.map((staff) {
                                    final id = staff['id']?.toString() ?? '';
                                    return Chip(
                                      label: Text(_staffDisplayName(staff)),
                                      deleteIcon:
                                          const Icon(Icons.close, size: 18),
                                      onDeleted: () {
                                        setLocalState(() {
                                          selectedChefIds = selectedChefIds
                                              .where((chefId) => chefId != id)
                                              .toList();
                                        });
                                      },
                                    );
                                  }).toList(),
                                ),
                              ],
                              const SizedBox(height: 20),
                              const Text('Assigned Dispense',
                                  style:
                                      TextStyle(fontWeight: FontWeight.bold)),
                              const SizedBox(height: 8),
                              _StaffAutocompleteField(
                                label: 'Search and add dispense staff',
                                controller: dispenseSearchController,
                                staffList: staffList,
                                selectedIds: allSelectedIds,
                                onSelected: (staff) {
                                  final id = staff['id']?.toString() ?? '';
                                  if (id.isEmpty || allSelectedIds.contains(id))
                                    return;
                                  setLocalState(() {
                                    selectedDispenseIds = [
                                      ...selectedDispenseIds,
                                      id
                                    ];
                                    dispenseSearchController.clear();
                                  });
                                },
                              ),
                              if (selectedDispensers.isNotEmpty) ...[
                                const SizedBox(height: 12),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: selectedDispensers.map((staff) {
                                    final id = staff['id']?.toString() ?? '';
                                    return Chip(
                                      label: Text(_staffDisplayName(staff)),
                                      deleteIcon:
                                          const Icon(Icons.close, size: 18),
                                      onDeleted: () {
                                        setLocalState(() {
                                          selectedDispenseIds =
                                              selectedDispenseIds
                                                  .where((staffId) =>
                                                      staffId != id)
                                                  .toList();
                                        });
                                      },
                                    );
                                  }).toList(),
                                ),
                              ],
                            ],
                          );
                        },
                      ),
                      const SizedBox(height: 32),

                      // Open Session Submit
                      SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: ElevatedButton(
                          onPressed: !canOpenNow || _isSubmitting
                              ? null
                              : () async {
                                  setLocalState(() => _isSubmitting = true);
                                  try {
                                    await ref
                                        .read(
                                            activeKitchenShiftProvider.notifier)
                                        .openShift(
                                          shiftType: selectedShiftType,
                                          assignedChefIds: selectedChefIds,
                                          assignedDispenseIds:
                                              selectedDispenseIds,
                                          subShiftType: selectedSubShiftType,
                                          department: selectedDept,
                                        );
                                    if (!context.mounted) return;
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(
                                          content: Text(
                                              'Kitchen shift opened successfully.')),
                                    );
                                  } catch (e) {
                                    if (!context.mounted) return;
                                    showDialog(
                                      context: context,
                                      builder: (ctx) => AlertDialog(
                                        title: const Text('Cannot Open Shift'),
                                        content: Text(e.toString()),
                                        actions: [
                                          TextButton(
                                            onPressed: () => Navigator.pop(ctx),
                                            child: const Text('OK'),
                                          ),
                                        ],
                                      ),
                                    );
                                  } finally {
                                    if (mounted) {
                                      setLocalState(
                                          () => _isSubmitting = false);
                                    }
                                  }
                                },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.amber.shade700,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8)),
                          ),
                          child: _isSubmitting
                              ? const CircularProgressIndicator(
                                  color: Colors.white)
                              : const Text('OPEN KITCHEN SESSION',
                                  style:
                                      TextStyle(fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  // ── ACTIVE SHIFT DASHBOARD ──────────────────────────────────────────────────
  Widget _buildActiveShiftDashboard(
      KitchenShift activeShift, bool isWriteUser) {
    final detailsAsync = ref.watch(shiftDetailsProvider(activeShift.id));
    final user = ref.watch(authNotifierProvider).valueOrNull;
    final userRole = user?.role ?? '';
    const accountantRoles = {
      'branch_accountant',
      'super_admin',
      'director',
      'general_manager'
    };
    final isAccountant = accountantRoles.contains(userRole) ||
        user?.roles.any(accountantRoles.contains) == true;

    return detailsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) =>
          Center(child: Text('Error loading shift details: $error')),
      data: (details) {
        final List<KitchenShiftItem> items = (details['items'] as List? ?? [])
            .map((json) =>
                KitchenShiftItem.fromJson(Map<String, dynamic>.from(json)))
            .toList();

        if (isAccountant) {
          return SingleChildScrollView(
            child: Column(
              children: [
                _buildHeaderCard(activeShift, items, isWriteUser),
                _buildChannelStockIssuanceDashboard(
                  activeShift,
                  items,
                  isWriteUser: false,
                ),
                const SizedBox(height: 24),
              ],
            ),
          );
        }

        return SingleChildScrollView(
          child: Column(
            children: [
              _buildHeaderCard(activeShift, items, isWriteUser),
              _buildChannelStockIssuanceDashboard(
                activeShift,
                items,
                isWriteUser: isWriteUser,
              ),
              const SizedBox(height: 24),
            ],
          ),
        );
      },
    );
  }

  Widget _buildHeaderCard(
      KitchenShift shift, List<KitchenShiftItem> items, bool isWriteUser) {
    final status = _statusPalette(shift.status);
    final trackedItems = items.length;
    final openingQty = items.fold<double>(0, (sum, item) => sum + item.openingStock);
    final issuedQty = items.fold<double>(0, (sum, item) => sum + item.additions);
    final spoilageQty =
        items.fold<double>(0, (sum, item) => sum + item.spoilageQuantity);

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: _sectionShell(
        title: 'Shift ${shift.shiftNumber}',
        subtitle:
            '${_formatSessionDate(shift.shiftDate)} - ${shift.shiftType.toUpperCase()}${shift.subShiftType != null ? ' (Shift ${shift.subShiftType})' : ''}',
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: status.bg,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: status.border),
          ),
          child: Text(
            shift.status.toUpperCase(),
            style: TextStyle(
              color: status.fg,
              fontWeight: FontWeight.w800,
              fontSize: 13,
            ),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                _metaChip(
                  icon: Icons.calendar_today_outlined,
                  label: 'Date',
                  value: _formatSessionDate(shift.shiftDate),
                ),
                _metaChip(
                  icon: Icons.schedule_outlined,
                  label: 'Shift',
                  value: shift.subShiftType == null || shift.subShiftType!.isEmpty
                      ? shift.shiftType.toUpperCase()
                      : 'Shift ${shift.subShiftType}',
                ),
                _metaChip(
                  icon: Icons.apartment_outlined,
                  label: 'Department',
                  value: shift.department ?? 'KITCHEN',
                ),
                _metaChip(
                  icon: Icons.person_outline,
                  label: 'Opened by',
                  value: () {
                    final raw = shift.openedBy;
                    if (raw.contains('-') && raw.length > 20) {
                      final staffList =
                          ref.watch(staffProfilesProvider).valueOrNull ?? [];
                      final match = staffList.where((s) {
                        final id = (s['id'] ?? s['user_id'])?.toString();
                        return id == raw;
                      }).firstOrNull;
                      if (match != null) {
                        final fn =
                            '${match['first_name'] ?? ''} ${match['last_name'] ?? ''}'
                                .trim();
                        if (fn.isNotEmpty) return fn;
                      }
                    }
                    return raw;
                  }(),
                ),
              ],
            ),
            const SizedBox(height: 18),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _sessionStatTile(
                    label: 'Tracked Items',
                    value: '$trackedItems',
                    icon: Icons.inventory_2_outlined,
                    color: const Color(0xFF23476A),
                  ),
                  const SizedBox(width: 12),
                  _sessionStatTile(
                    label: 'Opening Qty',
                    value: openingQty.toStringAsFixed(
                        openingQty % 1 == 0 ? 0 : 2),
                    icon: Icons.stacked_bar_chart_outlined,
                    color: const Color(0xFF1976D2),
                  ),
                  const SizedBox(width: 12),
                  _sessionStatTile(
                    label: 'Issued Qty',
                    value:
                        issuedQty.toStringAsFixed(issuedQty % 1 == 0 ? 0 : 2),
                    icon: Icons.outbox_outlined,
                    color: const Color(0xFF2E7D32),
                  ),
                  const SizedBox(width: 12),
                  _sessionStatTile(
                    label: 'Spoilage',
                    value: spoilageQty.toStringAsFixed(
                        spoilageQty % 1 == 0 ? 0 : 2),
                    icon: Icons.warning_amber_rounded,
                    color: const Color(0xFFD84315),
                  ),
                ],
              ),
            ),
            if (isWriteUser && shift.status == 'open') ...[
              const SizedBox(height: 20),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        FilledButton.icon(
                          onPressed: () => _showCloseShiftDialog(shift, items),
                          icon: const Icon(Icons.close_rounded),
                          label: const Text('Close shift / Handover'),
                          style: FilledButton.styleFrom(
                            backgroundColor: Colors.red,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 18,
                              vertical: 14,
                            ),
                          ),
                        ),
                        Text(
                          'Quick actions',
                          style: TextStyle(
                            color: Colors.blueGrey.shade700,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        OutlinedButton.icon(
                          onPressed: () => _openPrepBatches(shift),
                          icon: const Icon(Icons.move_down_outlined),
                          label: const Text('Prep Returns'),
                        ),
                        OutlinedButton.icon(
                          onPressed: _openProductionLogging,
                          icon: const Icon(Icons.blender_outlined),
                          label: const Text('Production Logging'),
                        ),
                        OutlinedButton.icon(
                          onPressed: () => _openKitchenSpoilage(shift),
                          icon: const Icon(Icons.report_problem_outlined),
                          label: const Text('Record Spoilage'),
                        ),
                        OutlinedButton.icon(
                          onPressed: _openKitchenStocktake,
                          icon: const Icon(Icons.kitchen_outlined),
                          label: const Text('Kitchen Stocktake'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Wrap(
                spacing: 16,
                runSpacing: 10,
                crossAxisAlignment: WrapCrossAlignment.center,
                alignment: WrapAlignment.spaceBetween,
                children: [
                  if (isWriteUser)
                    TextButton.icon(
                      onPressed: () => _triggerSyncRetry(shift.id),
                      icon: const Icon(Icons.sync),
                      label: const Text('Retry Sync Report'),
                    )
                  else
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.lock_outline,
                            size: 16, color: Colors.grey),
                        const SizedBox(width: 6),
                        Text(
                          'Read-only session view',
                          style: TextStyle(
                            color: Colors.blueGrey.shade500,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  Text(
                    'Department: ${shift.department ?? 'KITCHEN'}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildChannelStockIssuanceDashboard(
      KitchenShift shift, List<KitchenShiftItem> items,
      {required bool isWriteUser}) {
    final additionsAsync = ref.watch(shiftAdditionsProvider(shift.id));
    final numberFmt = NumberFormat('#,##0.00');

    return additionsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(child: Text('Error loading additions: $err')),
      data: (additions) {
        final channels = [
          {
            'code': 'pos_restaurant',
            'name': 'POS Restaurant',
            'icon': Icons.restaurant,
            'color': Colors.orange,
            'description': 'Restaurant service issues for active food sales.'
          },
          {
            'code': 'accommodation_breakfast',
            'name': 'Accommodation Breakfast',
            'icon': Icons.free_breakfast,
            'color': Colors.blue,
            'description': 'Breakfast allocations for staying guests.'
          },
          {
            'code': 'buffet',
            'name': 'Buffet',
            'icon': Icons.brunch_dining,
            'color': Colors.purple,
            'description': 'Buffet preparation and serving sessions.'
          },
          {
            'code': 'conference_event',
            'name': 'Conference',
            'icon': Icons.meeting_room,
            'color': Colors.teal,
            'description': 'Conference or event catering consumption.'
          },
          {
            'code': 'outside_catering',
            'name': 'Outside Catering',
            'icon': Icons.local_shipping,
            'color': Colors.indigo,
            'description': 'External catering dispatches and event support.'
          },
          {
            'code': 'group_meal',
            'name': 'Group Meal',
            'icon': Icons.groups_outlined,
            'color': Colors.cyan,
            'description': 'Group bookings, tours, and special meal plans.'
          },
          {
            'code': 'staff_meal',
            'name': 'Staff Meals',
            'icon': Icons.badge,
            'color': Colors.green,
            'description': 'Internal staff meal issues for the shift.'
          },
          {
            'code': 'wastage',
            'name': 'Wastage / Spoilage',
            'icon': Icons.delete_outline,
            'color': Colors.red,
            'description': 'Record damaged, expired, or wasted stock.'
          },
        ];
        final totalIssues = additions.length;
        final totalQty =
            additions.fold<double>(0, (sum, item) => sum + item.quantity);
        final activeChannels = additions
            .map((item) => item.purposeChannel)
            .where((value) => value.isNotEmpty)
            .toSet()
            .length;

        return Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _sectionShell(
                title: 'Issue Stock to Channels',
                subtitle:
                    'Select a kitchen channel below to issue stock into the active session, or jump straight to spoilage logging.',
                trailing: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Text(
                    '${channels.length} channels',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          _sessionStatTile(
                            label: 'Issues Logged',
                            value: '$totalIssues',
                            icon: Icons.fact_check_outlined,
                            color: const Color(0xFF23476A),
                          ),
                          const SizedBox(width: 12),
                          _sessionStatTile(
                            label: 'Total Quantity',
                            value: numberFmt.format(totalQty),
                            icon: Icons.stacked_line_chart_outlined,
                            color: const Color(0xFF0F9D58),
                          ),
                          const SizedBox(width: 12),
                          _sessionStatTile(
                            label: 'Active Channels',
                            value: '$activeChannels',
                            icon: Icons.hub_outlined,
                            color: const Color(0xFF8E24AA),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                    LayoutBuilder(
                      builder: (context, constraints) {
                        final crossAxisCount = constraints.maxWidth > 1180
                            ? 4
                            : constraints.maxWidth > 860
                                ? 3
                                : constraints.maxWidth > 560
                                    ? 2
                                    : 1;
                        return GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          gridDelegate:
                              SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: crossAxisCount,
                            crossAxisSpacing: 16,
                            mainAxisSpacing: 16,
                            mainAxisExtent: 220,
                          ),
                          itemCount: channels.length,
                          itemBuilder: (context, idx) {
                            final ch = channels[idx];
                            final code = ch['code'] as String;
                            final name = ch['name'] as String;
                            final description = ch['description'] as String;
                            final icon = ch['icon'] as IconData;
                            final color = ch['color'] as MaterialColor;

                            final channelAdds = additions
                                .where((a) => a.purposeChannel == code)
                                .toList();
                            final channelQty = channelAdds.fold<double>(
                              0,
                              (sum, a) => sum + a.quantity,
                            );

                            return Container(
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(22),
                                border:
                                    Border.all(color: color.shade100, width: 1),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.03),
                                    blurRadius: 14,
                                    offset: const Offset(0, 6),
                                  ),
                                ],
                              ),
                              child: Padding(
                                padding: const EdgeInsets.all(18),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Container(
                                          width: 48,
                                          height: 48,
                                          decoration: BoxDecoration(
                                            color: color.shade50,
                                            borderRadius:
                                                BorderRadius.circular(16),
                                          ),
                                          child: Icon(icon,
                                              color: color.shade700, size: 22),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                name,
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.w800,
                                                  fontSize: 15,
                                                ),
                                                maxLines: 2,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                              const SizedBox(height: 4),
                                              Text(
                                                description,
                                                style: TextStyle(
                                                  color: Colors.blueGrey.shade600,
                                                  fontSize: 12,
                                                  height: 1.3,
                                                ),
                                                maxLines: 2,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                    const Spacer(),
                                    Wrap(
                                      spacing: 8,
                                      runSpacing: 8,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 10, vertical: 6),
                                          decoration: BoxDecoration(
                                            color: color.shade50,
                                            borderRadius:
                                                BorderRadius.circular(12),
                                          ),
                                          child: Text(
                                            '${channelAdds.length} logged',
                                            style: TextStyle(
                                              color: color.shade700,
                                              fontWeight: FontWeight.w700,
                                              fontSize: 12,
                                            ),
                                          ),
                                        ),
                                        if (channelQty > 0)
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 10, vertical: 6),
                                            decoration: BoxDecoration(
                                              color: Colors.grey.shade100,
                                              borderRadius:
                                                  BorderRadius.circular(12),
                                            ),
                                            child: Text(
                                              'Qty ${numberFmt.format(channelQty)}',
                                              style: TextStyle(
                                                color:
                                                    Colors.blueGrey.shade700,
                                                fontWeight: FontWeight.w700,
                                                fontSize: 12,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                    const SizedBox(height: 14),
                                    SizedBox(
                                      width: double.infinity,
                                      child: isWriteUser && shift.status == 'open'
                                          ? FilledButton.icon(
                                              onPressed: () {
                                                if (code == 'wastage') {
                                                  _openKitchenSpoilage(shift);
                                                  return;
                                                }
                                                _openIssueStockScreen(
                                                  shift,
                                                  channelCode: code,
                                                );
                                              },
                                              icon: Icon(
                                                code == 'wastage'
                                                    ? Icons.open_in_new
                                                    : Icons.add,
                                                size: 16,
                                              ),
                                              label: Text(
                                                code == 'wastage'
                                                    ? 'Open Spoilage'
                                                    : 'Issue Stock',
                                              ),
                                              style: FilledButton.styleFrom(
                                                backgroundColor: color.shade50,
                                                foregroundColor:
                                                    color.shade700,
                                                elevation: 0,
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                  vertical: 12,
                                                ),
                                              ),
                                            )
                                          : OutlinedButton.icon(
                                              onPressed: null,
                                              icon: const Icon(Icons.lock_outline,
                                                  size: 16),
                                              label: const Text('Read-only'),
                                            ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        );
                      },
                    ),
                  ],
                ),
              ),
              if (isWriteUser && shift.status == 'open') ...[
                const SizedBox(height: 32),
                const Divider(),
                const SizedBox(height: 16),
                _KitchenProductionLogSection(
                  shift: shift,
                  shiftItems: items,
                ),
                const SizedBox(height: 16),
                const Divider(),
                const SizedBox(height: 16),
                _PrepBatchSection(
                  shift: shift,
                  shiftItems: items,
                ),
                const SizedBox(height: 16),
                const Divider(),
              ],
              const SizedBox(height: 32),
              _sectionShell(
                title: 'Recent Stock Issues',
                subtitle: 'Latest stock movements recorded under this kitchen session.',
                trailing: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Text(
                    '${additions.length} entries',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                child: additions.isEmpty
                    ? Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(28),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade50,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: Colors.grey.shade200),
                        ),
                        child: Center(
                          child: Text(
                            'No stock issues logged yet for this shift.',
                            style: TextStyle(color: Colors.blueGrey.shade500),
                          ),
                        ),
                      )
                    : Column(
                        children: additions.map((add) {
                          final channel = channels.firstWhere(
                            (c) => c['code'] == add.purposeChannel,
                            orElse: () => {
                              'name': add.purposeChannel,
                              'color': Colors.blueGrey,
                            },
                          );
                          final channelName = channel['name'] as String;
                          final channelColor =
                              channel['color'] as MaterialColor? ??
                                  Colors.blueGrey;
                          final staffName = add.responsibleStaffIds.isEmpty
                              ? '—'
                              : add.responsibleStaffIds.join(', ');

                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: Colors.grey.shade200),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  width: 44,
                                  height: 44,
                                  decoration: BoxDecoration(
                                    color: channelColor.shade50,
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  child: Icon(
                                    Icons.inventory_2_outlined,
                                    color: channelColor.shade700,
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Wrap(
                                        spacing: 8,
                                        runSpacing: 8,
                                        crossAxisAlignment:
                                            WrapCrossAlignment.center,
                                        children: [
                                          Text(
                                            add.itemName ?? add.itemSku,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w800,
                                              fontSize: 15,
                                            ),
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 8, vertical: 4),
                                            decoration: BoxDecoration(
                                              color: Colors.grey.shade100,
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                            ),
                                            child: Text(
                                              add.itemSku,
                                              style: TextStyle(
                                                fontFamily: 'monospace',
                                                fontSize: 11,
                                                color:
                                                    Colors.blueGrey.shade700,
                                              ),
                                            ),
                                          ),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 8, vertical: 4),
                                            decoration: BoxDecoration(
                                              color: channelColor.shade50,
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                            ),
                                            child: Text(
                                              channelName,
                                              style: TextStyle(
                                                color: channelColor.shade700,
                                                fontSize: 11,
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        'Staff: $staffName - ${_formatSessionTime(add.addedAt)}',
                                        style: TextStyle(
                                          color: Colors.blueGrey.shade600,
                                          fontSize: 12,
                                        ),
                                      ),
                                      if (add.notes != null ||
                                          add.wastageReason != null) ...[
                                        const SizedBox(height: 6),
                                        Text(
                                          add.notes ?? add.wastageReason!,
                                          style: TextStyle(
                                            color: Colors.blueGrey.shade700,
                                            fontSize: 12,
                                            fontStyle: FontStyle.italic,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 10),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF8FAFC),
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  child: Text(
                                    '${numberFmt.format(add.quantity)} ${add.unit ?? "pcs"}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 14,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
              ),
            ],
          ),
        );
      },
    );
  }

  // ── FOOD CONTROL REVIEW TAB ────────────────────────────────────────────────
  Widget _buildFoodControlReviewTab(KitchenShift shift) {
    final currencyFmt = NumberFormat.currency(symbol: 'KES ', decimalDigits: 2);
    final numberFmt = NumberFormat('#,##0.00');

    return FutureBuilder<Map<String, dynamic>>(
      future:
          ref.read(kitchenRepositoryProvider).getReconciliationReport(shift.id),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError || snapshot.data == null) {
          return Center(
            child: Text(
              'Error loading report: ${snapshot.error ?? "No data available"}',
              style: const TextStyle(color: Colors.red),
            ),
          );
        }

        final report = snapshot.data!;
        final double totalExpected =
            (report['total_expected_cost'] as num?)?.toDouble() ?? 0.0;
        final double totalActual =
            (report['total_actual_cost'] as num?)?.toDouble() ?? 0.0;
        final double totalVariance =
            (report['total_variance_cost'] as num?)?.toDouble() ?? 0.0;
        final channels = report['channels'] as List? ?? [];

        return SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Summary cards Row
              Row(
                children: [
                  Expanded(
                    child: _buildReviewSummaryCard(
                      'Expected Cost',
                      currencyFmt.format(totalExpected),
                      Colors.amber.shade700,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildReviewSummaryCard(
                      'Actual Cost',
                      currencyFmt.format(totalActual),
                      Colors.blue.shade700,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildReviewSummaryCard(
                      'Variance Cost',
                      currencyFmt.format(totalVariance),
                      totalVariance > 0
                          ? Colors.red.shade700
                          : Colors.green.shade700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              const Text(
                'Channel Breakdown',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              if (channels.isEmpty)
                const Center(
                    child: Text('No channel consumption records logged.'))
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: channels.length,
                  itemBuilder: (context, idx) {
                    final ch = channels[idx];
                    final double chExpected =
                        (ch['expected_cost'] as num?)?.toDouble() ?? 0.0;
                    final double chActual =
                        (ch['actual_cost'] as num?)?.toDouble() ?? 0.0;
                    final double chVariance =
                        (ch['variance_cost'] as num?)?.toDouble() ?? 0.0;
                    final chItems = ch['items'] as List? ?? [];

                    return Card(
                      margin: const EdgeInsets.symmetric(vertical: 6.0),
                      child: ExpansionTile(
                        title: Text(
                          ch['channel_name'] ?? 'Unnamed Channel',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        subtitle: Text(
                          'Expected: ${currencyFmt.format(chExpected)} | Actual: ${currencyFmt.format(chActual)} | Var: ${currencyFmt.format(chVariance)}',
                          style: TextStyle(
                            fontSize: 13,
                            color: chVariance > 0
                                ? Colors.red.shade600
                                : Colors.green.shade600,
                          ),
                        ),
                        children: [
                          if (chItems.isEmpty)
                            const Padding(
                              padding: EdgeInsets.all(16.0),
                              child: Text(
                                  'No item transactions logged for this channel.'),
                            )
                          else
                            SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: DataTable(
                                columns: const [
                                  DataColumn(label: Text('Item / SKU')),
                                  DataColumn(label: Text('Expected Qty')),
                                  DataColumn(label: Text('Actual Qty')),
                                  DataColumn(label: Text('Variance Qty')),
                                  DataColumn(label: Text('Cost Price')),
                                  DataColumn(label: Text('Variance Cost')),
                                ],
                                rows: chItems.map<DataRow>((it) {
                                  final double expectedQty =
                                      (it['expected_qty'] as num?)
                                              ?.toDouble() ??
                                          0.0;
                                  final double actualQty =
                                      (it['actual_qty'] as num?)?.toDouble() ??
                                          0.0;
                                  final double varianceQty =
                                      (it['variance_qty'] as num?)
                                              ?.toDouble() ??
                                          0.0;
                                  final double costPrice =
                                      (it['cost_price'] as num?)?.toDouble() ??
                                          0.0;
                                  final double varianceCost =
                                      (it['variance_cost'] as num?)
                                              ?.toDouble() ??
                                          0.0;

                                  return DataRow(
                                    cells: [
                                      DataCell(
                                        Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          mainAxisAlignment:
                                              MainAxisAlignment.center,
                                          children: [
                                            Text(it['item_name'] ?? '',
                                                style: const TextStyle(
                                                    fontWeight:
                                                        FontWeight.bold)),
                                            Text(it['sku'] ?? '',
                                                style: const TextStyle(
                                                    color: Colors.grey,
                                                    fontSize: 11)),
                                          ],
                                        ),
                                      ),
                                      DataCell(Text(
                                          '${numberFmt.format(expectedQty)} ${it['unit'] ?? ""}')),
                                      DataCell(Text(
                                          '${numberFmt.format(actualQty)} ${it['unit'] ?? ""}')),
                                      DataCell(
                                        Text(
                                          '${varianceQty > 0 ? "+" : ""}${numberFmt.format(varianceQty)}',
                                          style: TextStyle(
                                            color: varianceQty > 0
                                                ? Colors.red.shade600
                                                : (varianceQty < 0
                                                    ? Colors.green.shade600
                                                    : Colors.black),
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                      DataCell(
                                          Text(currencyFmt.format(costPrice))),
                                      DataCell(
                                        Text(
                                          currencyFmt.format(varianceCost),
                                          style: TextStyle(
                                            color: varianceCost > 0
                                                ? Colors.red.shade600
                                                : (varianceCost < 0
                                                    ? Colors.green.shade600
                                                    : Colors.black),
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                    ],
                                  );
                                }).toList(),
                              ),
                            ),
                        ],
                      ),
                    );
                  },
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildReviewSummaryCard(
      String label, String value, Color accentColor) {
    return Card(
      elevation: 2,
      child: Container(
        decoration: BoxDecoration(
          border: Border(left: BorderSide(color: accentColor, width: 4)),
        ),
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(color: Colors.grey, fontSize: 13),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  // ── LOG PRODUCTION DIALOG ──────────────────────────────────────────────────
  void _showLogProductionDialog(
      KitchenShift shift, List<KitchenShiftItem> items) {
    final recipesAsync = ref.watch(recipesListProvider);
    final staffAsync = ref.watch(staffProfilesProvider);

    showDialog(
      context: context,
      builder: (ctx) {
        KitchenProductionRecipe? selectedRecipe;
        double actualProducedQty = 0;
        double rawQtyUsed = 0;
        String? selectedChefId;
        final noteController = TextEditingController();
        String idempotencyKey = _uuid.v4();
        bool isSubmitting = false;

        return StatefulBuilder(
          builder: (context, setLocalState) {
            return AlertDialog(
              title: const Text('Log Batch Production Event'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Select Recipe
                    recipesAsync.when(
                      loading: () => const CircularProgressIndicator(),
                      error: (err, _) => Text('Error loading recipes: $err'),
                      data: (recipes) {
                        return DropdownButtonFormField<KitchenProductionRecipe>(
                          hint: const Text('Select Production Recipe'),
                          initialValue: selectedRecipe,
                          items: recipes.map((r) {
                            return DropdownMenuItem(
                              value: r,
                              child: Text(r.recipeName),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) {
                              setLocalState(() {
                                selectedRecipe = val;
                                rawQtyUsed = val.rawQuantity;
                                actualProducedQty = val.producedQuantity;
                              });
                            }
                          },
                        );
                      },
                    ),
                    const SizedBox(height: 16),

                    if (selectedRecipe != null) ...[
                      // Input actual yield
                      TextFormField(
                        initialValue: actualProducedQty.toString(),
                        decoration: InputDecoration(
                          labelText:
                              'Actual Produced Quantity (${selectedRecipe!.producedUnit})',
                        ),
                        keyboardType: TextInputType.number,
                        onChanged: (val) {
                          actualProducedQty = double.tryParse(val) ?? 0;
                        },
                      ),
                      const SizedBox(height: 16),

                      // Input raw qty used
                      TextFormField(
                        initialValue: rawQtyUsed.toString(),
                        decoration: InputDecoration(
                          labelText:
                              'Raw Material Used (${selectedRecipe!.rawUnit})',
                        ),
                        keyboardType: TextInputType.number,
                        onChanged: (val) {
                          rawQtyUsed = double.tryParse(val) ?? 0;
                        },
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Select produced by
                    staffAsync.when(
                      loading: () => const SizedBox.shrink(),
                      error: (_, __) => const SizedBox.shrink(),
                      data: (staffList) {
                        return DropdownButtonFormField<String>(
                          hint: const Text('Select Chef / Cook'),
                          initialValue: selectedChefId,
                          items: staffList.map((s) {
                            final name =
                                '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'
                                    .trim();
                            return DropdownMenuItem(
                              value: s['id']?.toString(),
                              child: Text(name.isNotEmpty
                                  ? name
                                  : (s['id']?.toString() ?? '')),
                            );
                          }).toList(),
                          onChanged: (val) {
                            selectedChefId = val;
                          },
                        );
                      },
                    ),
                    const SizedBox(height: 16),

                    TextFormField(
                      controller: noteController,
                      decoration: const InputDecoration(
                        labelText: 'Variance / Production notes',
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
                ElevatedButton(
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          if (selectedRecipe == null ||
                              actualProducedQty <= 0 ||
                              rawQtyUsed <= 0 ||
                              selectedChefId == null) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                  content: Text(
                                      'Please select recipe, quantities, and chef.')),
                            );
                            return;
                          }

                          setLocalState(() => isSubmitting = true);
                          try {
                            final payload = {
                              'kitchen_shift_id': shift.id,
                              'output_item_id': selectedRecipe!.producedInventoryItemId ?? '',
                              'production_recipe_id': selectedRecipe!.id,
                              'consumed_inputs': [
                                {
                                  'raw_item_sku': selectedRecipe!.rawItemSku,
                                  'raw_item_name': selectedRecipe!.rawItemName,
                                  'quantity_used': rawQtyUsed,
                                  'unit': selectedRecipe!.rawUnit,
                                }
                              ],
                              'actual_produced_qty': actualProducedQty,
                              'output_unit': selectedRecipe!.producedUnit,
                              'produced_by': selectedChefId,
                              'idempotency_key': idempotencyKey,
                              'reason_note': noteController.text,
                            };

                            final repo = ref.read(kitchenRepositoryProvider);
                            await repo.logProductionEvent(payload);
                            ref.invalidate(shiftDetailsProvider(shift.id));
                            if (!context.mounted) return;
                            Navigator.pop(ctx);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                  content: Text(
                                      'Production event successfully logged.')),
                            );
                          } catch (e) {
                            if (!context.mounted) return;
                            showDialog(
                              context: context,
                              builder: (c) => AlertDialog(
                                title: const Text('Logging Failed'),
                                content: Text(e.toString()),
                                actions: [
                                  TextButton(
                                      onPressed: () => Navigator.pop(c),
                                      child: const Text('OK')),
                                ],
                              ),
                            );
                          } finally {
                            setLocalState(() => isSubmitting = false);
                          }
                        },
                  child: const Text('LOG PRODUCTION'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // ── ADD STOCK DIALOG ────────────────────────────────────────────────────────
  void _showAddStockDialog(KitchenShift shift, {String? defaultChannel}) {
    showDialog(
      context: context,
      builder: (ctx) {
        final skuController = TextEditingController();
        final qtyController = TextEditingController();
        final unitController = TextEditingController();
        final nameController = TextEditingController();
        final staffSearchController = TextEditingController();
        String selectedPurposeChannel = defaultChannel ?? 'pos_restaurant';
        String? selectedReferenceId;
        String? selectedStaffId;
        bool isSubmitting = false;

        final staffAsync = ref.watch(staffProfilesProvider);
        final repo = ref.read(kitchenRepositoryProvider);

        final channelChoices = [
          {'code': 'pos_restaurant', 'name': 'POS Restaurant'},
          {
            'code': 'accommodation_breakfast',
            'name': 'Accommodation Breakfast'
          },
          {'code': 'buffet', 'name': 'Buffet'},
          {'code': 'conference_event', 'name': 'Conference'},
          {'code': 'outside_catering', 'name': 'Outside Catering'},
          {'code': 'group_meal', 'name': 'Group Meal'},
          {'code': 'staff_meal', 'name': 'Staff Meals'},
        ];

        return StatefulBuilder(
          builder: (context, setLocalState) {
            final showReferenceDropdown = [
              'buffet',
              'conference_event',
              'outside_catering',
              'group_meal',
            ].contains(selectedPurposeChannel);
            final showBreakfastControl =
                selectedPurposeChannel == 'accommodation_breakfast';
            final eventType = _eventTypeForChannel(selectedPurposeChannel);

            return AlertDialog(
              title: const Text('Issue Stock to Active Kitchen Session'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextFormField(
                      controller: skuController,
                      decoration: const InputDecoration(labelText: 'Item SKU'),
                    ),
                    TextFormField(
                      controller: nameController,
                      decoration: const InputDecoration(labelText: 'Item Name'),
                    ),
                    TextFormField(
                      controller: qtyController,
                      decoration:
                          const InputDecoration(labelText: 'Quantity to Add'),
                      keyboardType: TextInputType.number,
                    ),
                    TextFormField(
                      controller: unitController,
                      decoration: const InputDecoration(
                          labelText: 'Unit (e.g. kg, pcs)'),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: selectedPurposeChannel,
                      decoration:
                          const InputDecoration(labelText: 'Purpose / Channel'),
                      items: channelChoices.map((c) {
                        return DropdownMenuItem(
                          value: c['code'],
                          child: Text(c['name']!),
                        );
                      }).toList(),
                      onChanged: defaultChannel != null
                          ? null
                          : (val) {
                              if (val != null) {
                                setLocalState(() {
                                  selectedPurposeChannel = val;
                                  selectedReferenceId = null;
                                });
                              }
                            },
                    ),
                    if (showReferenceDropdown) ...[
                      const SizedBox(height: 12),
                      FutureBuilder<List<Map<String, dynamic>>>(
                        future: repo.getActiveEventOrders(eventType: eventType),
                        builder: (context, snapshot) {
                          if (snapshot.connectionState ==
                              ConnectionState.waiting) {
                            return const Padding(
                              padding: EdgeInsets.symmetric(vertical: 8.0),
                              child: CircularProgressIndicator(),
                            );
                          }
                          final list = snapshot.data ?? [];
                          if (list.isEmpty) {
                            return const Text(
                                'No active event orders found for this channel. Close completed event orders from Branch Accountant so only active ones remain here.',
                                style: TextStyle(
                                    color: Colors.redAccent, fontSize: 13));
                          }
                          return DropdownButtonFormField<String>(
                            value: selectedReferenceId,
                            decoration: InputDecoration(
                              labelText: 'Select Event Order',
                            ),
                            items: list.map((item) {
                              final eventNumber =
                                  item['event_number']?.toString() ?? 'EO';
                              final name = item['event_name']?.toString() ??
                                  'Unnamed Event';
                              final client = item['client_name']?.toString() ??
                                  'Unknown Client';
                              final display = '$eventNumber - $name ($client)';
                              return DropdownMenuItem(
                                value: item['id']?.toString(),
                                child: Text(display,
                                    overflow: TextOverflow.ellipsis),
                              );
                            }).toList(),
                            onChanged: (val) {
                              setLocalState(() {
                                selectedReferenceId = val;
                              });
                            },
                          );
                        },
                      ),
                      FutureBuilder<List<Map<String, dynamic>>>(
                        future: repo.getActiveEventOrders(eventType: eventType),
                        builder: (context, snapshot) {
                          final list = snapshot.data ?? const [];
                          Map<String, dynamic>? selectedEvent;
                          for (final item in list) {
                            if (item['id']?.toString() == selectedReferenceId) {
                              selectedEvent = item;
                              break;
                            }
                          }
                          if (selectedEvent == null) {
                            return const SizedBox.shrink();
                          }
                          return Container(
                            width: double.infinity,
                            margin: const EdgeInsets.only(top: 12),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade50,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.grey.shade300),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  selectedEvent['event_number']?.toString() ??
                                      'Event Order',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                    'Event: ${selectedEvent['event_name'] ?? '-'}'),
                                Text(
                                    'Client: ${selectedEvent['client_name'] ?? '-'}'),
                                Text(
                                    'Date: ${selectedEvent['event_date'] ?? '-'}'),
                                Text(
                                    'Pax: ${selectedEvent['pax']?.toString() ?? '0'}'),
                                if ((selectedEvent['menu_package'] ?? '')
                                    .toString()
                                    .isNotEmpty)
                                  Text(
                                      'Menu / Package: ${selectedEvent['menu_package']}'),
                                Text(
                                    'Payment: ${selectedEvent['payment_status'] ?? 'pending'}'),
                                Text(
                                    'Amount: KES ${selectedEvent['total_amount'] ?? 0}'),
                              ],
                            ),
                          );
                        },
                      ),
                    ],
                    if (showBreakfastControl) ...[
                      const SizedBox(height: 12),
                      FutureBuilder<Map<String, dynamic>>(
                        future:
                            repo.getBreakfastPaxSnapshot(date: shift.shiftDate),
                        builder: (context, snapshot) {
                          if (snapshot.connectionState ==
                              ConnectionState.waiting) {
                            return const Padding(
                              padding: EdgeInsets.symmetric(vertical: 8),
                              child: LinearProgressIndicator(),
                            );
                          }
                          final data = snapshot.data ?? const {};
                          final status =
                              (data['status']?.toString() ?? 'unconfirmed')
                                  .toLowerCase();
                          final confirmed =
                              (data['confirmed_pax'] as num?)?.toInt() ?? 0;
                          final calculated =
                              (data['calculated_pax'] as num?)?.toInt() ?? 0;
                          final ready =
                              status == 'confirmed' || status == 'locked';
                          return Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: ready
                                  ? Colors.green.shade50
                                  : Colors.orange.shade50,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: ready
                                    ? Colors.green.shade200
                                    : Colors.orange.shade200,
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  ready
                                      ? 'Daily Breakfast Pax confirmed'
                                      : 'Daily Breakfast Pax not yet confirmed',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: ready
                                        ? Colors.green.shade900
                                        : Colors.orange.shade900,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                    'Date: ${data['breakfast_date'] ?? shift.shiftDate}'),
                                Text('Calculated pax: $calculated'),
                                Text('Confirmed pax: $confirmed'),
                                Text('Status: ${status.replaceAll('_', ' ')}'),
                                if (!ready)
                                  const Padding(
                                    padding: EdgeInsets.only(top: 6),
                                    child: Text(
                                      'Reception must confirm Daily Breakfast Pax before stock can be issued to this channel.',
                                      style: TextStyle(fontSize: 12),
                                    ),
                                  ),
                              ],
                            ),
                          );
                        },
                      ),
                    ],
                    const SizedBox(height: 12),
                    staffAsync.when(
                      loading: () => const SizedBox.shrink(),
                      error: (_, __) => const SizedBox.shrink(),
                      data: (staffList) {
                        Map<String, dynamic>? selectedStaff;
                        for (final staff in staffList) {
                          if (staff['id']?.toString() == selectedStaffId) {
                            selectedStaff = staff;
                            break;
                          }
                        }

                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _StaffAutocompleteField(
                              label: 'Search responsible staff',
                              controller: staffSearchController,
                              staffList: staffList,
                              selectedIds: selectedStaffId == null
                                  ? const {}
                                  : {selectedStaffId!},
                              onSelected: (staff) {
                                setLocalState(() {
                                  selectedStaffId = staff['id']?.toString();
                                  staffSearchController.text =
                                      _staffDisplayName(staff);
                                });
                              },
                            ),
                            if (selectedStaff != null) ...[
                              const SizedBox(height: 12),
                              Chip(
                                label: Text(_staffDisplayName(selectedStaff)),
                                deleteIcon: const Icon(Icons.close, size: 18),
                                onDeleted: () {
                                  setLocalState(() {
                                    selectedStaffId = null;
                                    staffSearchController.clear();
                                  });
                                },
                              ),
                            ],
                          ],
                        );
                      },
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Cancel')),
                ElevatedButton(
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          if (selectedPurposeChannel ==
                              'accommodation_breakfast') {
                            final breakfastSnapshot = await repo
                                .getBreakfastPaxSnapshot(date: shift.shiftDate);
                            final status =
                                (breakfastSnapshot['status']?.toString() ??
                                        'unconfirmed')
                                    .toLowerCase();
                            if (!(status == 'confirmed' ||
                                status == 'locked')) {
                              if (!context.mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                      'Reception must confirm Daily Breakfast Pax before issuing Accommodation Breakfast stock.'),
                                ),
                              );
                              return;
                            }
                          }
                          if (skuController.text.isEmpty ||
                              qtyController.text.isEmpty ||
                              selectedStaffId == null) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                  content: Text(
                                      'SKU, Quantity, and Staff are required.')),
                            );
                            return;
                          }
                          if (showReferenceDropdown &&
                              selectedReferenceId == null) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                  content: Text(
                                      'Please select an active event booking.')),
                            );
                            return;
                          }
                          setLocalState(() => isSubmitting = true);
                          try {
                            await repo.addStock(shift.id, [
                              {
                                'sku': skuController.text,
                                'name': nameController.text,
                                'quantity':
                                    double.tryParse(qtyController.text) ?? 0.0,
                                'unit': unitController.text,
                                'responsible_staff_ids': [selectedStaffId],
                                'purpose_channel': selectedPurposeChannel,
                                'reference_id': selectedReferenceId,
                              }
                            ]);
                            ref.invalidate(shiftDetailsProvider(shift.id));
                            if (!context.mounted) return;
                            Navigator.pop(ctx);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                  content: Text('Stock successfully issued.')),
                            );
                          } catch (e) {
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Error: $e')),
                            );
                          } finally {
                            if (mounted) {
                              setLocalState(() => isSubmitting = false);
                            }
                          }
                        },
                  child: const Text('ADD STOCK'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // ── CLOSE SHIFT DIALOG ──────────────────────────────────────────────────────
  void _showCloseShiftDialog(KitchenShift shift, List<KitchenShiftItem> items) {
    showDialog(
      context: context,
      builder: (ctx) {
        final countsMap = <String, double>{};
        final notesMap = <String, String>{};
        List<String> outgoingWitnesses = [];
        List<String> incomingWitnesses = [];
        final notesController = TextEditingController();
        final breakfastPaxController = TextEditingController(text: '0');
        final staffMealPaxController = TextEditingController(text: '0');
        bool isSubmitting = false;

        ref.read(kitchenRepositoryProvider).getBreakfastPax().then((pax) {
          breakfastPaxController.text = pax.toString();
        }).catchError((_) {});

        final staffAsync = ref.watch(staffProfilesProvider);

        for (final it in items) {
          final balance = it.openingStock +
              it.additions -
              it.soldQuantity -
              it.spoilageQuantity;
          countsMap[it.itemSku] = balance;
        }

        return StatefulBuilder(
          builder: (context, setLocalState) {
            return AlertDialog(
              title: const Text('Close Session & Record Physical Counts'),
              content: SizedBox(
                width: 600,
                child: SingleChildScrollView(
                  child: Column(
                    children: [
                      // Active items stocktake fields
                      const Text(
                        'Confirm physical stock counts to evaluate variances. Large/extreme variances will be highlighted.',
                        style: TextStyle(color: Colors.grey, fontSize: 12),
                      ),
                      const SizedBox(height: 16),
                      ...items.map((it) {
                        final sysClose = it.openingStock +
                            it.additions -
                            it.soldQuantity -
                            it.spoilageQuantity;
                        return Row(
                          children: [
                            Expanded(
                                child: Text(
                                    '${it.itemName} ($sysClose ${it.unitOfMeasure})')),
                            const SizedBox(width: 12),
                            SizedBox(
                              width: 80,
                              child: TextFormField(
                                initialValue: sysClose.toString(),
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                    labelText: 'Physical'),
                                onChanged: (val) {
                                  countsMap[it.itemSku] =
                                      double.tryParse(val) ?? 0.0;
                                },
                              ),
                            ),
                            const SizedBox(width: 12),
                            SizedBox(
                              width: 120,
                              child: TextFormField(
                                decoration:
                                    const InputDecoration(labelText: 'Notes'),
                                onChanged: (val) {
                                  notesMap[it.itemSku] = val;
                                },
                              ),
                            ),
                          ],
                        );
                      }),
                      const Divider(height: 32),

                      // Pax Inputs
                      const Text('Shift Pax Counts',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: breakfastPaxController,
                              decoration: const InputDecoration(
                                labelText: 'Breakfast Pax',
                                border: OutlineInputBorder(),
                                contentPadding: EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 8),
                              ),
                              keyboardType: TextInputType.number,
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: TextFormField(
                              controller: staffMealPaxController,
                              decoration: const InputDecoration(
                                labelText: 'Staff Meal Pax',
                                border: OutlineInputBorder(),
                                contentPadding: EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 8),
                              ),
                              keyboardType: TextInputType.number,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),

                      // Witness Selectors
                      const Text('Shift Handover Witnesses',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      staffAsync.when(
                        loading: () => const CircularProgressIndicator(),
                        error: (err, _) =>
                            Text('Error loading witnesses: $err'),
                        data: (staffList) {
                          return Column(
                            children: [
                              // Outgoing Witnesses
                              DropdownButtonFormField<String>(
                                hint: const Text('Select Outgoing Witness'),
                                items: staffList.map((s) {
                                  final name =
                                      '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'
                                          .trim();
                                  return DropdownMenuItem(
                                    value: s['id']?.toString(),
                                    child: Text(name.isNotEmpty
                                        ? name
                                        : (s['id']?.toString() ?? '')),
                                  );
                                }).toList(),
                                onChanged: (val) {
                                  if (val != null) {
                                    setLocalState(() {
                                      outgoingWitnesses = [val];
                                    });
                                  }
                                },
                              ),
                              const SizedBox(height: 12),
                              // Incoming Witnesses
                              DropdownButtonFormField<String>(
                                hint: const Text('Select Incoming Witness'),
                                items: staffList.map((s) {
                                  final name =
                                      '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'
                                          .trim();
                                  return DropdownMenuItem(
                                    value: s['id']?.toString(),
                                    child: Text(name.isNotEmpty
                                        ? name
                                        : (s['id']?.toString() ?? '')),
                                  );
                                }).toList(),
                                onChanged: (val) {
                                  if (val != null) {
                                    setLocalState(() {
                                      incomingWitnesses = [val];
                                    });
                                  }
                                },
                              ),
                            ],
                          );
                        },
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: notesController,
                        decoration: const InputDecoration(
                            labelText: 'Closing summary notes'),
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
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          if (shift.subShiftType != null &&
                              (outgoingWitnesses.isEmpty ||
                                  incomingWitnesses.isEmpty)) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                  content: Text(
                                      'Both outgoing and incoming witnesses are required.')),
                            );
                            return;
                          }

                          setLocalState(() => isSubmitting = true);
                          try {
                            final physicalCounts = countsMap.entries
                                .map((e) => {
                                      'sku': e.key,
                                      'quantity': e.value,
                                      'notes': notesMap[e.key] ?? '',
                                    })
                                .toList();

                            final repo = ref.read(kitchenRepositoryProvider);
                            await repo.closeShift(
                              shiftId: shift.id,
                              physicalCounts: physicalCounts,
                              outgoingWitnessIds: outgoingWitnesses,
                              incomingWitnessIds: incomingWitnesses,
                              closingNotes: notesController.text,
                              breakfastPax:
                                  int.tryParse(breakfastPaxController.text) ??
                                      0,
                              staffMealPax:
                                  int.tryParse(staffMealPaxController.text) ??
                                      0,
                            );
                            await ref
                                .read(activeKitchenShiftProvider.notifier)
                                .refresh();
                            ref.invalidate(shiftDetailsProvider(shift.id));
                            if (!context.mounted) return;
                            Navigator.pop(ctx);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                  content: Text(shift.subShiftType == 'A'
                                      ? 'Shift A closed. Shift B has been opened automatically.'
                                      : 'Kitchen shift closed successfully.')),
                            );
                          } catch (e) {
                            if (!context.mounted) return;
                            showDialog(
                              context: context,
                              builder: (c) => AlertDialog(
                                title: const Text('Closure Failed'),
                                content: Text(e.toString()),
                                actions: [
                                  TextButton(
                                      onPressed: () => Navigator.pop(c),
                                      child: const Text('OK')),
                                ],
                              ),
                            );
                          } finally {
                            setLocalState(() => isSubmitting = false);
                          }
                        },
                  child: const Text('SUBMIT STOCKTAKE & CLOSE'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // ── SYNC RETRY ──────────────────────────────────────────────────────────────
  Future<void> _triggerSyncRetry(String shiftId) async {
    try {
      final repo = ref.read(kitchenRepositoryProvider);
      await repo.retrySync(shiftId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Sync report retry successfully triggered.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Sync retry failed: $e')),
      );
    }
  }

  void _showConfigDialog(
      BuildContext context, WidgetRef ref, String? currentMode) {
    showDialog(
      context: context,
      builder: (ctx) {
        String selected = currentMode ?? 'SINGLE_SHIFT';
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: const Text('Configure Shift Mode'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  RadioListTile<String>(
                    title: const Text('Single Shift (All Day)'),
                    value: 'SINGLE_SHIFT',
                    groupValue: selected,
                    onChanged: (v) => setState(() => selected = v!),
                  ),
                  RadioListTile<String>(
                    title: const Text('Two Shifts (Shift A / Shift B)'),
                    value: 'TWO_SHIFT',
                    groupValue: selected,
                    onChanged: (v) => setState(() => selected = v!),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: () async {
                    Navigator.pop(ctx);
                    try {
                      await ref
                          .read(kitchenRepositoryProvider)
                          .configureShiftMode(selected);
                      ref.invalidate(shiftConfigProvider);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content:
                                    Text('Shift mode updated successfully.')));
                      }
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context)
                            .showSnackBar(SnackBar(content: Text('Error: $e')));
                      }
                    }
                  },
                  child: const Text('Save Changes'),
                ),
              ],
            );
          },
        );
      },
    );
  }
}

class _KitchenIssueStockScreen extends ConsumerStatefulWidget {
  const _KitchenIssueStockScreen({
    required this.shift,
    required this.channelCode,
  });

  final KitchenShift shift;
  final String channelCode;

  @override
  ConsumerState<_KitchenIssueStockScreen> createState() =>
      _KitchenIssueStockScreenState();
}

class _KitchenIssueStockScreenState
    extends ConsumerState<_KitchenIssueStockScreen> {
  final List<_KitchenIssueLine> _lines = [];
  final ScrollController _tableScrollController = ScrollController();
  bool _isLoading = true;
  bool _isSaving = false;
  List<Map<String, dynamic>> _inventoryItems = const [];
  List<Map<String, dynamic>> _eventOrders = const [];
  Map<String, dynamic> _breakfastSnapshot = const {};
  List<KitchenProductionRecipe> _recipes = const [];
  String? _selectedReferenceId;

  bool get _requiresEventOrder => const {
        'buffet',
        'conference_event',
        'outside_catering',
        'group_meal',
      }.contains(widget.channelCode);

  bool get _isBreakfast => widget.channelCode == 'accommodation_breakfast';

  String get _channelLabel {
    switch (widget.channelCode) {
      case 'pos_restaurant':
        return 'POS Restaurant';
      case 'accommodation_breakfast':
        return 'Accommodation Breakfast';
      case 'buffet':
        return 'Buffet';
      case 'conference_event':
        return 'Conference';
      case 'outside_catering':
        return 'Outside Catering';
      case 'group_meal':
        return 'Group Meal';
      case 'staff_meal':
        return 'Staff Meals';
      default:
        return widget.channelCode.replaceAll('_', ' ');
    }
  }

  String get _shiftLabel {
    if ((widget.shift.subShiftType ?? '').isNotEmpty) {
      return 'Shift ${widget.shift.subShiftType}';
    }
    return 'Single Shift';
  }

  String? get _eventType {
    switch (widget.channelCode) {
      case 'conference_event':
        return 'conference';
      case 'buffet':
        return 'buffet';
      case 'outside_catering':
        return 'outside_catering';
      case 'group_meal':
        return 'group_meal';
      default:
        return null;
    }
  }

  Map<String, dynamic>? get _selectedEventOrder {
    for (final item in _eventOrders) {
      if (item['id']?.toString() == _selectedReferenceId) {
        return item;
      }
    }
    return null;
  }

  @override
  void initState() {
    super.initState();
    _lines.add(_KitchenIssueLine());
    _loadData();
  }

  @override
  void dispose() {
    _tableScrollController.dispose();
    for (final line in _lines) {
      line.dispose();
    }
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final repo = ref.read(kitchenRepositoryProvider);
    try {
      final futures = await Future.wait([
        repo.getStoreInventoryItems(limit: 500),
        _requiresEventOrder
            ? repo.getActiveEventOrders(eventType: _eventType)
            : Future.value(<Map<String, dynamic>>[]),
        _isBreakfast
            ? repo.getBreakfastPaxSnapshot(date: widget.shift.shiftDate)
            : Future.value(<String, dynamic>{}),
        repo.getRecipesList(),
        repo.getLinkableMenuItems(),
        // Also fetch kitchen ledger items — produced sub-assembly items from
        // PRODUCTION and COMPLEX yield-type food control recipes.
        repo.getKitchenLedgerItems(limit: 500),
      ]);

      if (!mounted) return;
      
      final storeItems = List<Map<String, dynamic>>.from(futures[0] as List);
      final menuItems = List<Map<String, dynamic>>.from(futures[4] as List);
      final kitchenLedgerItems = List<Map<String, dynamic>>.from(futures[5] as List);
      
      final Map<String, Map<String, dynamic>> merged = {};
      for (final item in storeItems) {
        final sku = (item['sku'] ?? '').toString().trim();
        if (sku.isNotEmpty) {
          merged[sku] = item;
        }
      }
      for (final item in menuItems) {
        final sku = (item['sku'] ?? '').toString().trim();
        if (sku.isNotEmpty) {
          merged[sku] = {
            ...merged[sku] ?? {},
            ...item,
          };
        }
      }
      // Merge kitchen ledger (produced sub-assembly) items — these are the
      // output items from PRODUCTION/COMPLEX food control standards.
      for (final item in kitchenLedgerItems) {
        final sku = (item['sku'] ?? '').toString().trim();
        if (sku.isNotEmpty) {
          merged[sku] = {
            ...merged[sku] ?? {},
            ...item,
          };
        }
      }

      setState(() {
        _inventoryItems = merged.values.toList();
        _eventOrders = List<Map<String, dynamic>>.from(futures[1] as List);
        _breakfastSnapshot = Map<String, dynamic>.from(futures[2] as Map);
        _recipes = futures[3] as List<KitchenProductionRecipe>;
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _isLoading = false);
    }
  }

  void _addLine() {
    setState(() {
      _lines.add(_KitchenIssueLine());
    });
  }

  void _removeLine(int index) {
    setState(() {
      if (_lines.length == 1) {
        _lines.first.clear();
        return;
      }
      final line = _lines.removeAt(index);
      line.dispose();
    });
  }

  Set<String> _selectedSkusExcluding(int index) {
    final skus = <String>{};
    for (var i = 0; i < _lines.length; i++) {
      if (i == index) continue;
      final sku = _lines[i].selectedItem?['sku']?.toString();
      if (sku != null && sku.isNotEmpty) {
        skus.add(sku);
      }
    }
    return skus;
  }

  List<String> _responsibleStaffIds() {
    final ids = widget.shift.assignedDispenseIds.isNotEmpty
        ? widget.shift.assignedDispenseIds
        : widget.shift.assignedChefIds.isNotEmpty
            ? widget.shift.assignedChefIds
            : <String>[
                ref.watch(authNotifierProvider).valueOrNull?.id ?? '',
              ];
    return ids.where((e) => e.trim().isNotEmpty).toList();
  }

  Future<void> _saveBatch() async {
    final messenger = ScaffoldMessenger.of(context);
    final responsibleStaffIds = _responsibleStaffIds();
    if (responsibleStaffIds.isEmpty) {
      messenger.showSnackBar(
        const SnackBar(
          content: Text(
              'No assigned dispense or chef staff found on this shift. Reopen the shift with assigned staff first.'),
        ),
      );
      return;
    }

    if (_requiresEventOrder && (_selectedReferenceId ?? '').isEmpty) {
      messenger.showSnackBar(
        const SnackBar(
          content: Text('Select an active Event Order for this channel.'),
        ),
      );
      return;
    }

    if (_isBreakfast) {
      final status = (_breakfastSnapshot['status']?.toString() ?? 'unconfirmed')
          .toLowerCase();
      if (!(status == 'confirmed' || status == 'locked')) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text(
                'Reception must confirm Daily Breakfast Pax before stock can be issued to Accommodation Breakfast.'),
          ),
        );
        return;
      }
    }

    final payload = <Map<String, dynamic>>[];
    for (final line in _lines) {
      final item = line.selectedItem;
      if (item == null) continue;

      final qty = double.tryParse(line.quantityController.text.trim()) ?? 0.0;
      final available = ((item['quantity'] as num?) ?? 0).toDouble();
      final unit = (item['unit_of_measure'] ??
              item['unit'] ??
              item['unit_of_measure'] ??
              '')
          .toString()
          .trim();

      if (qty <= 0) {
        messenger.showSnackBar(
          SnackBar(
            content: Text(
                'Issue quantity must be greater than 0 for ${item['item_name'] ?? item['sku']}.'),
          ),
        );
        return;
      }
      if (qty > available) {
        messenger.showSnackBar(
          SnackBar(
            content: Text(
                'Issue quantity cannot exceed available stock for ${item['item_name'] ?? item['sku']}.'),
          ),
        );
        return;
      }
      if (unit.isEmpty) {
        messenger.showSnackBar(
          SnackBar(
            content: Text(
                'Unit is missing for ${item['item_name'] ?? item['sku']}.'),
          ),
        );
        return;
      }

      payload.add({
        'sku': item['sku'],
        'name': item['item_name'] ?? item['description'] ?? item['sku'],
        'quantity': qty,
        'unit': unit,
        'cost_price': item['cost_price'] ?? item['default_unit_cost'] ?? 0,
        'notes': line.notesController.text.trim(),
        'responsible_staff_ids': responsibleStaffIds,
        'purpose_channel': widget.channelCode,
        if (_selectedReferenceId != null) 'reference_id': _selectedReferenceId,
        if (line.selectedRecipeId != null) 'recipe_id': line.selectedRecipeId,
      });
    }

    if (payload.isEmpty) {
      messenger.showSnackBar(
        const SnackBar(
          content: Text('Add at least one valid item line to issue stock.'),
        ),
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      await ref
          .read(kitchenRepositoryProvider)
          .addStock(widget.shift.id, payload);
      if (!mounted) return;
      Navigator.of(context).pop(true);
      messenger.showSnackBar(
        const SnackBar(content: Text('Stock successfully issued to kitchen.')),
      );
    } catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authNotifierProvider).valueOrNull;
    final dateFmt = DateFormat('yyyy-MM-dd');
    final selectedEvent = _selectedEventOrder;
    final rawBranchName = (user?.branchName ?? '').trim();
    final branchName = rawBranchName.isEmpty ? 'Branch' : rawBranchName;
    final rawStorekeeperName =
        (user?.name ?? user?.email ?? widget.shift.openedBy).trim();
    final storekeeperName =
        rawStorekeeperName.isEmpty ? widget.shift.openedBy : rawStorekeeperName;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 28),
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Issue Stock to $_channelLabel',
                              style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F2E5E),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Select inventory items from the database and issue them against the active kitchen shift.',
                              style: TextStyle(
                                color: Colors.grey.shade700,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      OutlinedButton.icon(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.arrow_back, size: 18),
                        label: const Text('Back to Shift Sessions'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: BorderSide(color: Colors.grey.shade200),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Wrap(
                        spacing: 24,
                        runSpacing: 16,
                        children: [
                          _IssueSummaryTile(
                            icon: Icons.storefront_outlined,
                            iconBg: const Color(0xFFF4F7FB),
                            iconColor: const Color(0xFF0F2E5E),
                            label: 'Branch',
                            value: branchName,
                          ),
                          _IssueSummaryTile(
                            icon: Icons.widgets_outlined,
                            iconBg: const Color(0xFFFFF1E9),
                            iconColor: const Color(0xFFFF8A3D),
                            label: 'Channel',
                            value: _channelLabel,
                          ),
                          _IssueSummaryTile(
                            icon: Icons.hub_outlined,
                            iconBg: const Color(0xFFF4F7FB),
                            iconColor: const Color(0xFF0F2E5E),
                            label: 'Shift',
                            value: widget.shift.shiftNumber,
                            trailing: _shiftLabel.toUpperCase(),
                          ),
                          _IssueSummaryTile(
                            icon: Icons.calendar_today_outlined,
                            iconBg: const Color(0xFFF4F7FB),
                            iconColor: const Color(0xFF0F2E5E),
                            label: 'Date',
                            value: dateFmt
                                .format(DateTime.parse(widget.shift.shiftDate)),
                          ),
                          _IssueSummaryTile(
                            icon: Icons.apartment_outlined,
                            iconBg: const Color(0xFFF4F7FB),
                            iconColor: const Color(0xFF0F2E5E),
                            label: 'Department',
                            value: widget.shift.department ?? 'KITCHEN',
                          ),
                          _IssueSummaryTile(
                            icon: Icons.person_outline,
                            iconBg: const Color(0xFFF4F7FB),
                            iconColor: const Color(0xFF0F2E5E),
                            label: 'Storekeeper',
                            value: storekeeperName,
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 18, vertical: 10),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE7F7E6),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Text(
                              'OPEN',
                              style: TextStyle(
                                color: Color(0xFF2E7D32),
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (_requiresEventOrder) ...[
                    Card(
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(color: Colors.grey.shade200),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Event Order Selection',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 16,
                                color: Color(0xFF0F2E5E),
                              ),
                            ),
                            const SizedBox(height: 12),
                            if (_eventOrders.isEmpty)
                              const Text(
                                'No active event orders found for this channel. Close completed ones from Branch Accountant so only active event orders remain selectable here.',
                                style: TextStyle(color: Colors.redAccent),
                              )
                            else ...[
                              DropdownButtonFormField<String>(
                                value: _selectedReferenceId,
                                decoration: const InputDecoration(
                                  labelText: 'Select Event Order',
                                  border: OutlineInputBorder(),
                                ),
                                items: _eventOrders.map((item) {
                                  final eventNumber =
                                      item['event_number']?.toString() ?? 'EO';
                                  final eventName =
                                      item['event_name']?.toString() ??
                                          'Unnamed Event';
                                  final client =
                                      item['client_name']?.toString() ??
                                          'Unknown Client';
                                  return DropdownMenuItem(
                                    value: item['id']?.toString(),
                                    child: Text(
                                      '$eventNumber - $eventName ($client)',
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  );
                                }).toList(),
                                onChanged: (value) {
                                  setState(() => _selectedReferenceId = value);
                                },
                              ),
                              if (selectedEvent != null) ...[
                                const SizedBox(height: 14),
                                Wrap(
                                  spacing: 12,
                                  runSpacing: 12,
                                  children: [
                                    _IssueMetaChip('Client',
                                        '${selectedEvent['client_name'] ?? '-'}'),
                                    _IssueMetaChip('Pax',
                                        '${selectedEvent['pax'] ?? '0'}'),
                                    _IssueMetaChip('Payment',
                                        '${selectedEvent['payment_status'] ?? 'pending'}'),
                                    if ((selectedEvent['menu_package'] ?? '')
                                        .toString()
                                        .isNotEmpty)
                                      _IssueMetaChip('Package',
                                          '${selectedEvent['menu_package']}'),
                                  ],
                                ),
                              ],
                            ],
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  if (_isBreakfast) ...[
                    _BreakfastStatusCard(snapshot: _breakfastSnapshot),
                    const SizedBox(height: 16),
                  ],
                  Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: BorderSide(color: Colors.grey.shade200),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(minWidth: 1280),
                              child: Column(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 20, vertical: 16),
                                    decoration: const BoxDecoration(
                                      color: Color(0xFF0F2E5E),
                                      borderRadius: BorderRadius.only(
                                        topLeft: Radius.circular(16),
                                        topRight: Radius.circular(16),
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        _IssueHeaderCell('#', 56),
                                        _IssueHeaderCell(
                                            'Item Search (from DB)', 360),
                                        _IssueHeaderCell('Item Name', 300),
                                        _IssueHeaderCell('Unit', 110),
                                        _IssueHeaderCell(
                                            'Quantity to Issue', 190),
                                        _IssueHeaderCell(
                                            'Current Available Stock', 200),
                                        _IssueHeaderCell('Remove', 100),
                                      ],
                                    ),
                                  ),
                                  ...List.generate(_lines.length, (index) {
                                    final line = _lines[index];
                                    final selectedItem = line.selectedItem;
                                    final itemName =
                                        (selectedItem?['item_name'] ??
                                                selectedItem?['description'] ??
                                                '–')
                                            .toString();
                                    final unit = (selectedItem?[
                                                    'unit_of_measure'] ??
                                                selectedItem?['unit'] ??
                                                '–')
                                            .toString()
                                            .isEmpty
                                        ? '–'
                                        : (selectedItem?['unit_of_measure'] ??
                                                selectedItem?['unit'])
                                            .toString();
                                    final availableQty = selectedItem == null
                                        ? '–'
                                        : NumberFormat('#,##0.00').format(
                                            ((selectedItem['quantity']
                                                        as num?) ??
                                                    0)
                                                .toDouble(),
                                          );
                                    return Container(
                                      decoration: BoxDecoration(
                                        color: index.isEven
                                            ? Colors.white
                                            : const Color(0xFFF9FBFE),
                                        border: Border(
                                          bottom: BorderSide(
                                              color: Colors.grey.shade200),
                                        ),
                                      ),
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 20, vertical: 18),
                                      child: Row(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.center,
                                        children: [
                                          SizedBox(
                                            width: 56,
                                            child: Text(
                                              '${index + 1}',
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w700,
                                                fontSize: 18,
                                                color: Color(0xFF0F172A),
                                              ),
                                            ),
                                          ),
                                          Row(
                                            children: [
                                              SizedBox(
                                                width: 360,
                                                child: _InventoryAutocompleteField(
                                                  line: line,
                                                  items: _inventoryItems,
                                                  selectedSkus:
                                                      _selectedSkusExcluding(index),
                                                  onSelected: (item) {
                                                    final itemSku = item['sku']?.toString() ?? '';
                                                    line.matchingRecipes = _recipes
                                                        .where((r) => r.rawItemSku.isNotEmpty && r.rawItemSku == itemSku)
                                                        .toList();
                                                    if (line.matchingRecipes.isNotEmpty) {
                                                      line.selectedRecipeId =
                                                          line.matchingRecipes.first.id;
                                                    } else {
                                                      line.selectedRecipeId = null;
                                                    }
                                                    setState(() {});
                                                  },
                                                ),
                                              ),
                                              if (line.matchingRecipes.isNotEmpty) ...[
                                                const SizedBox(width: 12),
                                                SizedBox(
                                                  width: 240,
                                                  child: DropdownButtonFormField<String>(
                                                    value: line.selectedRecipeId,
                                                    decoration: const InputDecoration(
                                                      labelText: 'Link to Recipe Standard',
                                                      isDense: true,
                                                      border: OutlineInputBorder(),
                                                      contentPadding: EdgeInsets.symmetric(
                                                          horizontal: 10, vertical: 12),
                                                    ),
                                                    style: const TextStyle(
                                                        fontSize: 13, color: Colors.black87),
                                                    items: line.matchingRecipes.map((r) {
                                                      return DropdownMenuItem(
                                                        value: r.id,
                                                        child: Text(r.recipeName,
                                                            overflow: TextOverflow.ellipsis),
                                                      );
                                                    }).toList(),
                                                    onChanged: (val) {
                                                      setState(() {
                                                        line.selectedRecipeId = val;
                                                      });
                                                    },
                                                  ),
                                                ),
                                              ],
                                            ],
                                          ),
                                          const SizedBox(width: 18),
                                          SizedBox(
                                            width: 300,
                                            child: Text(
                                              itemName == 'â€“' ||
                                                      itemName.isEmpty
                                                  ? 'Select an item from search'
                                                  : itemName,
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                              style: TextStyle(
                                                fontWeight: FontWeight.w600,
                                                fontSize: 15,
                                                color: (itemName == 'â€“' ||
                                                        itemName.isEmpty)
                                                    ? const Color(0xFF64748B)
                                                    : const Color(0xFF0F172A),
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 18),
                                          SizedBox(
                                            width: 110,
                                            child: _IssuePill(value: unit),
                                          ),
                                          const SizedBox(width: 18),
                                          SizedBox(
                                            width: 190,
                                            child: TextFormField(
                                              controller:
                                                  line.quantityController,
                                              keyboardType: const TextInputType
                                                  .numberWithOptions(
                                                  decimal: true),
                                              decoration: const InputDecoration(
                                                border: OutlineInputBorder(),
                                                isDense: true,
                                                hintText: '0.00',
                                                contentPadding:
                                                    EdgeInsets.symmetric(
                                                        horizontal: 16,
                                                        vertical: 18),
                                              ),
                                              style: const TextStyle(
                                                fontSize: 15,
                                                fontWeight: FontWeight.w600,
                                                color: Color(0xFF0F172A),
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 18),
                                          SizedBox(
                                            width: 200,
                                            child: Text(
                                              availableQty == 'â€“'
                                                  ? '-'
                                                  : availableQty,
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w600,
                                                fontSize: 15,
                                                color: Color(0xFF0F172A),
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 18),
                                          SizedBox(
                                            width: 100,
                                            child: Align(
                                              alignment: Alignment.center,
                                              child: IconButton(
                                                onPressed: () =>
                                                    _removeLine(index),
                                                style: IconButton.styleFrom(
                                                  foregroundColor: Colors.red,
                                                  side: BorderSide(
                                                      color:
                                                          Colors.grey.shade300),
                                                  minimumSize:
                                                      const Size(52, 52),
                                                ),
                                                icon: const Icon(
                                                    Icons.delete_outline),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    );
                                  }),
                                  if (_lines.isEmpty ||
                                      _lines.last.selectedItem != null)
                                    Container(
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFFCFDFF),
                                        border: Border(
                                          bottom: BorderSide(
                                              color: Colors.grey.shade200),
                                        ),
                                      ),
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 20, vertical: 18),
                                      child: Row(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.center,
                                        children: [
                                          SizedBox(
                                            width: 56,
                                            child: Text(
                                              '${_lines.length + 1}',
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w700,
                                                fontSize: 18,
                                                color: Color(0xFF94A3B8),
                                              ),
                                            ),
                                          ),
                                          const SizedBox(
                                            width: 360,
                                            child: Text(
                                              'Add another issue line below when you need more items.',
                                              style: TextStyle(
                                                color: Color(0xFF64748B),
                                                fontSize: 13,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 318),
                                          const SizedBox(width: 128),
                                          const SizedBox(width: 208),
                                          const SizedBox(width: 218),
                                          const SizedBox(width: 100),
                                        ],
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ),
                          Container(
                            width: double.infinity,
                            margin: const EdgeInsets.fromLTRB(20, 18, 20, 20),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(14),
                              border:
                                  Border.all(color: const Color(0xFFD7E3F7)),
                              color: Colors.white,
                            ),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(14),
                              onTap: _addLine,
                              child: const Padding(
                                padding: EdgeInsets.symmetric(
                                    horizontal: 20, vertical: 18),
                                child: Row(
                                  children: [
                                    CircleAvatar(
                                      radius: 16,
                                      backgroundColor: Color(0xFFF2F7FF),
                                      child: Icon(Icons.add,
                                          color: Color(0xFF1E5CC6)),
                                    ),
                                    SizedBox(width: 12),
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Add Item Row',
                                          style: TextStyle(
                                            fontWeight: FontWeight.w700,
                                            color: Color(0xFF1E5CC6),
                                          ),
                                        ),
                                        SizedBox(height: 2),
                                        Text(
                                          'Search and select an inventory item to add to this issue',
                                          style: TextStyle(
                                            color: Color(0xFF51627A),
                                            fontSize: 12,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      OutlinedButton.icon(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close),
                        label: const Text('Cancel'),
                      ),
                      const Spacer(),
                      OutlinedButton.icon(
                        onPressed: null,
                        icon: const Icon(Icons.save_outlined),
                        label: const Text('Save as Draft'),
                      ),
                      const SizedBox(width: 16),
                      FilledButton.icon(
                        onPressed: _isSaving ? null : _saveBatch,
                        icon: _isSaving
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(Icons.check),
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFFFF9800),
                          foregroundColor: Colors.white,
                        ),
                        label:
                            Text(_isSaving ? 'Submitting...' : 'Submit Issue'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
    );
  }
}

class _KitchenIssueLine {
  _KitchenIssueLine();

  Map<String, dynamic>? selectedItem;
  String? selectedRecipeId;
  List<KitchenProductionRecipe> matchingRecipes = [];
  final TextEditingController searchController = TextEditingController();
  final TextEditingController quantityController = TextEditingController();
  final TextEditingController notesController = TextEditingController();
  final FocusNode focusNode = FocusNode();

  void clear() {
    selectedItem = null;
    selectedRecipeId = null;
    matchingRecipes = [];
    searchController.clear();
    quantityController.clear();
    notesController.clear();
  }

  void dispose() {
    searchController.dispose();
    quantityController.dispose();
    notesController.dispose();
    focusNode.dispose();
  }
}

class _IssueMetaChip extends StatelessWidget {
  const _IssueMetaChip(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _IssueSummaryTile extends StatelessWidget {
  const _IssueSummaryTile({
    required this.icon,
    required this.iconBg,
    required this.iconColor,
    required this.label,
    required this.value,
    this.trailing,
  });

  final IconData icon;
  final Color iconBg;
  final Color iconColor;
  final String label;
  final String value;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircleAvatar(
          radius: 22,
          backgroundColor: iconBg,
          child: Icon(icon, color: iconColor, size: 20),
        ),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 2),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  value,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F2E5E),
                  ),
                ),
                if (trailing != null) ...[
                  const SizedBox(width: 10),
                  Text(
                    trailing!,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1E5CC6),
                      fontSize: 12,
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ],
    );
  }
}

class _IssueHeaderCell extends StatelessWidget {
  const _IssueHeaderCell(this.label, this.width);

  final String label;
  final double width;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w700,
          fontSize: 13,
        ),
      ),
    );
  }
}

class _IssuePill extends StatelessWidget {
  const _IssuePill({required this.value});

  final String value;

  @override
  Widget build(BuildContext context) {
    final displayValue = value.trim().isEmpty ||
            value.trim().toLowerCase() == 'null' ||
            value.trim() == 'â€“'
        ? '-'
        : value.trim();

    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFFF2F5FA),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          displayValue,
          style: const TextStyle(
            fontWeight: FontWeight.w700,
            color: Color(0xFF334155),
            fontSize: 15,
          ),
        ),
      ),
    );
  }
}

class _BreakfastStatusCard extends StatelessWidget {
  const _BreakfastStatusCard({required this.snapshot});

  final Map<String, dynamic> snapshot;

  @override
  Widget build(BuildContext context) {
    final status =
        (snapshot['status']?.toString() ?? 'unconfirmed').toLowerCase();
    final ready = status == 'confirmed' || status == 'locked';
    final confirmed = (snapshot['confirmed_pax'] as num?)?.toInt() ?? 0;
    final calculated = (snapshot['calculated_pax'] as num?)?.toInt() ?? 0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ready ? Colors.green.shade50 : Colors.orange.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: ready ? Colors.green.shade200 : Colors.orange.shade200,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            ready
                ? 'Daily Breakfast Pax confirmed'
                : 'Daily Breakfast Pax not yet confirmed',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: ready ? Colors.green.shade900 : Colors.orange.shade900,
            ),
          ),
          const SizedBox(height: 8),
          Text('Calculated pax: $calculated'),
          Text('Confirmed pax: $confirmed'),
          Text('Status: ${status.replaceAll('_', ' ')}'),
          if (!ready)
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Text(
                'Reception must confirm Daily Breakfast Pax before stock can be issued to this channel.',
                style: TextStyle(fontSize: 12),
              ),
            ),
        ],
      ),
    );
  }
}

class _InventoryAutocompleteField extends StatelessWidget {
  const _InventoryAutocompleteField({
    required this.line,
    required this.items,
    required this.selectedSkus,
    this.onSelected,
  });

  final _KitchenIssueLine line;
  final List<Map<String, dynamic>> items;
  final Set<String> selectedSkus;
  final ValueChanged<Map<String, dynamic>>? onSelected;

  @override
  Widget build(BuildContext context) {
    return Autocomplete<Map<String, dynamic>>(
      textEditingController: line.searchController,
      focusNode: line.focusNode,
      displayStringForOption: (item) =>
          '${item['item_name'] ?? item['description'] ?? item['sku']}',
      optionsBuilder: (textEditingValue) {
        final query = textEditingValue.text.trim().toLowerCase();
        if (query.isEmpty) return const Iterable<Map<String, dynamic>>.empty();
        return items.where((item) {
          final sku = item['sku']?.toString() ?? '';
          if (selectedSkus.contains(sku)) return false;
          final haystack = [
            item['sku']?.toString() ?? '',
            item['item_name']?.toString() ?? '',
            item['description']?.toString() ?? '',
            item['category']?.toString() ?? '',
          ].join(' ').toLowerCase();
          return haystack.contains(query);
        }).take(12);
      },
      onSelected: (item) {
        line.selectedItem = item;
        line.searchController.text =
            '${item['sku']} - ${item['item_name'] ?? item['description'] ?? ''}';
        if (onSelected != null) {
          onSelected!(item);
        }
      },
      fieldViewBuilder: (context, textEditingController, focusNode, _) {
        if (textEditingController.text != line.searchController.text) {
          textEditingController.value = line.searchController.value;
        }

        return TextFormField(
          controller: textEditingController,
          focusNode: focusNode,
          decoration: const InputDecoration(
            hintText: 'Search item by SKU, name, or category',
            isDense: true,
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.search, size: 18),
            contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 18),
          ),
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w500,
            color: Color(0xFF0F172A),
          ),
          onChanged: (value) {
            if (line.searchController.text != value) {
              line.searchController.value = textEditingController.value;
            }
            if (line.selectedItem != null) {
              final selectedLabel =
                  '${line.selectedItem!['sku']} - ${line.selectedItem!['item_name'] ?? line.selectedItem!['description'] ?? ''}';
              if (value != selectedLabel) {
                line.selectedItem = null;
              }
            }
          },
        );
      },
      optionsViewBuilder: (context, onSelected, options) {
        final list = options.toList();
        return Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 4,
            borderRadius: BorderRadius.circular(8),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520, maxHeight: 260),
              child: ListView.separated(
                padding: EdgeInsets.zero,
                shrinkWrap: true,
                itemCount: list.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final item = list[index];
                  final qty =
                      NumberFormat('#,##0.###').format(item['quantity'] ?? 0);
                  final unit = item['unit_of_measure'] ?? item['unit'] ?? '';
                  return ListTile(
                    dense: true,
                    title: Text(
                      '${item['item_name'] ?? item['description'] ?? item['sku']}',
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      '${item['sku']}  |  ${item['category'] ?? 'Uncategorised'}  |  $qty $unit',
                      overflow: TextOverflow.ellipsis,
                    ),
                    onTap: () => onSelected(item),
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }
}

String _staffDisplayName(Map<String, dynamic> staff) {
  final first = (staff['first_name'] ?? '').toString().trim();
  final last = (staff['last_name'] ?? '').toString().trim();
  final fullName = '$first $last'.trim();
  if (fullName.isNotEmpty) return fullName;
  return (staff['name'] ?? staff['id'] ?? 'Unknown Staff').toString();
}

class _KitchenSessionHistoryScreen extends ConsumerStatefulWidget {
  const _KitchenSessionHistoryScreen();

  @override
  ConsumerState<_KitchenSessionHistoryScreen> createState() =>
      _KitchenSessionHistoryScreenState();
}

class _KitchenSessionHistoryScreenState
    extends ConsumerState<_KitchenSessionHistoryScreen> {
  String? _selectedShiftId;

  @override
  Widget build(BuildContext context) {
    final closedShiftsAsync = ref.watch(closedKitchenShiftsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      appBar: AppBar(
        title: const Text('Kitchen Sessions History'),
        actions: [
          IconButton(
            onPressed: () => ref.invalidate(closedKitchenShiftsProvider),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: closedShiftsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Text('Failed to load kitchen history: $error'),
        ),
        data: (shifts) {
          if (shifts.isEmpty) {
            return const Center(
              child: Text('No past kitchen sessions found.'),
            );
          }

          final selectedShiftId =
              shifts.any((shift) => shift.id == _selectedShiftId)
                  ? _selectedShiftId
                  : shifts.first.id;
          final selectedShift =
              shifts.firstWhere((shift) => shift.id == selectedShiftId);

          return Row(
            children: [
              Container(
                width: 320,
                margin: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: ListView.separated(
                  padding: const EdgeInsets.all(12),
                  itemCount: shifts.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final shift = shifts[index];
                    final isSelected = shift.id == selectedShift.id;
                    return InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () => setState(() => _selectedShiftId = shift.id),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? const Color(0xFFEAF2FF)
                              : const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: isSelected
                                ? const Color(0xFF1E5CC6)
                                : const Color(0xFFE2E8F0),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              shift.shiftNumber,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${shift.shiftDate} | ${shift.shiftType.toUpperCase()}${shift.subShiftType != null ? ' (Shift ${shift.subShiftType})' : ''}',
                              style: TextStyle(
                                color: Colors.grey.shade700,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Department: ${shift.department ?? 'KITCHEN'}',
                              style: TextStyle(
                                color: Colors.grey.shade700,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(0, 16, 16, 16),
                  child: _KitchenSessionHistoryDetail(shift: selectedShift),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _KitchenSessionHistoryDetail extends ConsumerWidget {
  const _KitchenSessionHistoryDetail({required this.shift});

  final KitchenShift shift;

  String _historyChannelLabel(String channelCode) {
    switch (channelCode) {
      case 'pos_restaurant':
        return 'POS Restaurant';
      case 'accommodation_breakfast':
        return 'Accommodation Breakfast';
      case 'conference_event':
        return 'Conference';
      case 'outside_catering':
        return 'Outside Catering';
      case 'group_meal':
        return 'Group Meal';
      case 'staff_meal':
        return 'Staff Meal';
      case 'wastage':
      case 'wastage_spoilage':
        return 'Wastage / Spoilage';
      default:
        return channelCode
            .replaceAll('_', ' ')
            .split(' ')
            .map((part) => part.isEmpty
                ? part
                : '${part[0].toUpperCase()}${part.substring(1)}')
            .join(' ');
    }
  }

  double _closingQty(Map<String, dynamic> item) {
    final physical = (item['physical_count'] as num?)?.toDouble();
    if (physical != null) return physical;
    final systemClosing = (item['system_closing_stock'] as num?)?.toDouble();
    if (systemClosing != null) return systemClosing;
    final opening = (item['opening_stock'] as num?)?.toDouble() ?? 0;
    final additions = (item['additions'] as num?)?.toDouble() ?? 0;
    final sold = (item['sold_quantity'] as num?)?.toDouble() ?? 0;
    final spoilage = (item['spoilage_quantity'] as num?)?.toDouble() ?? 0;
    return opening + additions - sold - spoilage;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailsAsync = ref.watch(shiftDetailsProvider(shift.id));
    final additionsAsync = ref.watch(shiftAdditionsProvider(shift.id));
    final numberFmt = NumberFormat('#,##0.00');

    return detailsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Text('Failed to load session detail: $error'),
      ),
      data: (details) {
        final itemRows = ((details['items'] as List?) ?? const [])
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList()
          ..sort((a, b) => ((a['item_name'] ?? '') as String)
              .compareTo((b['item_name'] ?? '') as String));
        final shiftStaff = ((details['shift_staff'] as List?) ?? const [])
            .whereType<Map>()
            .map((staff) => Map<String, dynamic>.from(staff))
            .toList();
        final summary = Map<String, dynamic>.from(
          details['summary'] is Map ? details['summary'] as Map : const {},
        );
        final totalOpening = itemRows.fold<double>(
          0,
          (sum, item) =>
              sum + ((item['opening_stock'] as num?)?.toDouble() ?? 0),
        );
        final totalAdditions = itemRows.fold<double>(
          0,
          (sum, item) => sum + ((item['additions'] as num?)?.toDouble() ?? 0),
        );
        final totalClosing = itemRows.fold<double>(
          0,
          (sum, item) => sum + _closingQty(item),
        );

        return Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Session ${shift.shiftNumber}',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${shift.shiftDate} | ${shift.shiftType.toUpperCase()}${shift.subShiftType != null ? ' (Shift ${shift.subShiftType})' : ''} | ${shift.status.toUpperCase()}',
                      style: TextStyle(color: Colors.grey.shade700),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Read-only kitchen ledger view showing opening, additions during the session, and closing balances.',
                      style: TextStyle(
                        color: Colors.grey.shade700,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 12,
                        runSpacing: 12,
                        children: [
                          _HistorySummaryChip(
                            label: 'Items',
                            value: '${itemRows.length}',
                            icon: Icons.inventory_2_outlined,
                          ),
                          _HistorySummaryChip(
                            label: 'Opening Total',
                            value: numberFmt.format(totalOpening),
                            icon: Icons.lock_open_outlined,
                          ),
                          _HistorySummaryChip(
                            label: 'Additions Total',
                            value: numberFmt.format(totalAdditions),
                            icon: Icons.add_box_outlined,
                          ),
                          _HistorySummaryChip(
                            label: 'Closing Total',
                            value: numberFmt.format(totalClosing),
                            icon: Icons.fact_check_outlined,
                          ),
                          _HistorySummaryChip(
                            label: 'Variance Value',
                            value: numberFmt.format(
                              (summary['variance_value'] as num?)?.toDouble() ??
                                  0,
                            ),
                            icon: Icons.assessment_outlined,
                          ),
                        ],
                      ),
                      if (shiftStaff.isNotEmpty) ...[
                        const SizedBox(height: 18),
                        Text(
                          'Shift Staff',
                          style:
                              Theme.of(context).textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w800,
                                    color: const Color(0xFF0F172A),
                                  ),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: shiftStaff
                              .map(
                                (staff) => Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 8,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF8FAFC),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                      color: const Color(0xFFE2E8F0),
                                    ),
                                  ),
                                  child: Text(
                                    _staffDisplayName(staff),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF1E293B),
                                    ),
                                  ),
                                ),
                              )
                              .toList(),
                        ),
                      ],
                      const SizedBox(height: 20),
                      Text(
                        'Stock Ledger',
                        style:
                            Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF0F172A),
                                ),
                      ),
                      const SizedBox(height: 10),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(minWidth: 980),
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: const Color(0xFFE2E8F0),
                              ),
                            ),
                            child: Column(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 18,
                                    vertical: 14,
                                  ),
                                  decoration: const BoxDecoration(
                                    color: Color(0xFF0F2E5E),
                                    borderRadius: BorderRadius.only(
                                      topLeft: Radius.circular(14),
                                      topRight: Radius.circular(14),
                                    ),
                                  ),
                                  child: const Row(
                                    children: [
                                      _IssueHeaderCell('#', 50),
                                      _IssueHeaderCell('Item', 280),
                                      _IssueHeaderCell('Unit', 90),
                                      _IssueHeaderCell('Opening', 140),
                                      _IssueHeaderCell('Additions', 140),
                                      _IssueHeaderCell('Closing', 140),
                                      _IssueHeaderCell('Variance', 120),
                                    ],
                                  ),
                                ),
                                if (itemRows.isEmpty)
                                  const Padding(
                                    padding: EdgeInsets.all(24),
                                    child: Text(
                                      'No stock rows were captured for this session.',
                                    ),
                                  )
                                else
                                  ...List.generate(itemRows.length, (index) {
                                    final item = itemRows[index];
                                    final opening =
                                        (item['opening_stock'] as num?)
                                                ?.toDouble() ??
                                            0;
                                    final additions =
                                        (item['additions'] as num?)
                                                ?.toDouble() ??
                                            0;
                                    final closing = _closingQty(item);
                                    final variance = (item['variance'] as num?)
                                            ?.toDouble() ??
                                        0;

                                    return Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 18,
                                        vertical: 16,
                                      ),
                                      decoration: BoxDecoration(
                                        color: index.isEven
                                            ? Colors.white
                                            : const Color(0xFFF8FAFC),
                                        border: Border(
                                          bottom: BorderSide(
                                            color: Colors.grey.shade200,
                                          ),
                                        ),
                                      ),
                                      child: Row(
                                        children: [
                                          SizedBox(
                                            width: 50,
                                            child: Text('${index + 1}'),
                                          ),
                                          SizedBox(
                                            width: 280,
                                            child: Text(
                                              (item['item_name'] ??
                                                      'Unnamed Item')
                                                  .toString(),
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ),
                                          SizedBox(
                                            width: 90,
                                            child: Text(
                                              (item['unit_of_measure'] ?? '-')
                                                  .toString(),
                                            ),
                                          ),
                                          SizedBox(
                                            width: 140,
                                            child:
                                                Text(numberFmt.format(opening)),
                                          ),
                                          SizedBox(
                                            width: 140,
                                            child: Text(
                                                numberFmt.format(additions)),
                                          ),
                                          SizedBox(
                                            width: 140,
                                            child:
                                                Text(numberFmt.format(closing)),
                                          ),
                                          SizedBox(
                                            width: 120,
                                            child: Text(
                                              numberFmt.format(variance),
                                              style: TextStyle(
                                                color: variance < 0
                                                    ? Colors.red.shade700
                                                    : variance > 0
                                                        ? Colors.green.shade700
                                                        : const Color(
                                                            0xFF0F172A),
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    );
                                  }),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        'Session Additions',
                        style:
                            Theme.of(context).textTheme.titleMedium?.copyWith(
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF0F172A),
                                ),
                      ),
                      const SizedBox(height: 10),
                      additionsAsync.when(
                        loading: () => const Padding(
                          padding: EdgeInsets.symmetric(vertical: 32),
                          child: Center(child: CircularProgressIndicator()),
                        ),
                        error: (error, _) => Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF7ED),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: const Color(0xFFFED7AA),
                            ),
                          ),
                          child:
                              Text('Failed to load additions ledger: $error'),
                        ),
                        data: (additions) {
                          if (additions.isEmpty) {
                            return Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(18),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: const Color(0xFFE2E8F0),
                                ),
                              ),
                              child: const Text(
                                'No mid-session additions were logged for this shift.',
                              ),
                            );
                          }

                          return SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(minWidth: 980),
                              child: Container(
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                    color: const Color(0xFFE2E8F0),
                                  ),
                                ),
                                child: Column(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 18,
                                        vertical: 14,
                                      ),
                                      decoration: const BoxDecoration(
                                        color: Color(0xFF1E3A5F),
                                        borderRadius: BorderRadius.only(
                                          topLeft: Radius.circular(14),
                                          topRight: Radius.circular(14),
                                        ),
                                      ),
                                      child: const Row(
                                        children: [
                                          _IssueHeaderCell('Time', 170),
                                          _IssueHeaderCell('Item', 240),
                                          _IssueHeaderCell('Qty', 120),
                                          _IssueHeaderCell('Unit', 90),
                                          _IssueHeaderCell('Channel', 160),
                                          _IssueHeaderCell('Type', 140),
                                          _IssueHeaderCell('Notes', 250),
                                        ],
                                      ),
                                    ),
                                    ...List.generate(additions.length, (index) {
                                      final row = additions[index];
                                      final addedAt = row.addedAt.contains('T')
                                          ? row.addedAt
                                              .replaceFirst('T', ' ')
                                              .split('.')
                                              .first
                                          : row.addedAt;
                                      return Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 18,
                                          vertical: 16,
                                        ),
                                        decoration: BoxDecoration(
                                          color: index.isEven
                                              ? Colors.white
                                              : const Color(0xFFF8FAFC),
                                          border: Border(
                                            bottom: BorderSide(
                                              color: Colors.grey.shade200,
                                            ),
                                          ),
                                        ),
                                        child: Row(
                                          children: [
                                            SizedBox(
                                              width: 170,
                                              child: Text(addedAt),
                                            ),
                                            SizedBox(
                                              width: 240,
                                              child: Text(
                                                row.itemName ?? row.itemSku,
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.w600,
                                                ),
                                              ),
                                            ),
                                            SizedBox(
                                              width: 120,
                                              child: Text(
                                                numberFmt.format(row.quantity),
                                              ),
                                            ),
                                            SizedBox(
                                              width: 90,
                                              child: Text(row.unit ?? '-'),
                                            ),
                                            SizedBox(
                                              width: 160,
                                              child: Text(
                                                _historyChannelLabel(
                                                    row.purposeChannel),
                                              ),
                                            ),
                                            SizedBox(
                                              width: 140,
                                              child: Text(row.foodControlType),
                                            ),
                                            SizedBox(
                                              width: 250,
                                              child: Text(
                                                row.notes?.trim().isNotEmpty ==
                                                        true
                                                    ? row.notes!
                                                    : '-',
                                              ),
                                            ),
                                          ],
                                        ),
                                      );
                                    }),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _HistorySummaryChip extends StatelessWidget {
  const _HistorySummaryChip({
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
      width: 180,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFEAF2FF),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: const Color(0xFF1E5CC6)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    color: Colors.grey.shade700,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFF0F172A),
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StaffAutocompleteField extends StatelessWidget {
  const _StaffAutocompleteField({
    required this.label,
    required this.controller,
    required this.staffList,
    required this.onSelected,
    this.selectedIds = const {},
  });

  final String label;
  final TextEditingController controller;
  final List<Map<String, dynamic>> staffList;
  final ValueChanged<Map<String, dynamic>> onSelected;
  final Set<String> selectedIds;

  @override
  Widget build(BuildContext context) {
    return Autocomplete<Map<String, dynamic>>(
      displayStringForOption: _staffDisplayName,
      optionsBuilder: (textEditingValue) {
        final query = textEditingValue.text.trim().toLowerCase();
        if (query.isEmpty) return const Iterable<Map<String, dynamic>>.empty();

        return staffList.where((staff) {
          final id = staff['id']?.toString() ?? '';
          if (selectedIds.contains(id)) return false;

          final haystack = [
            _staffDisplayName(staff),
            staff['email']?.toString() ?? '',
            staff['employee_id']?.toString() ?? '',
          ].join(' ').toLowerCase();

          return haystack.contains(query);
        }).take(8);
      },
      onSelected: onSelected,
      fieldViewBuilder:
          (context, textEditingController, focusNode, onFieldSubmitted) {
        if (textEditingController.text != controller.text) {
          textEditingController.value = controller.value;
        }

        return TextFormField(
          controller: textEditingController,
          focusNode: focusNode,
          onChanged: (value) {
            if (controller.text != value) {
              controller.value = textEditingController.value;
            }
          },
          decoration: InputDecoration(
            labelText: label,
            prefixIcon: const Icon(Icons.search),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          ),
        );
      },
      optionsViewBuilder: (context, onSelected, options) {
        final matches = options.toList();
        return Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 4,
            borderRadius: BorderRadius.circular(8),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560, maxHeight: 240),
              child: ListView.separated(
                padding: EdgeInsets.zero,
                shrinkWrap: true,
                itemCount: matches.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final staff = matches[index];
                  final subtitleParts = [
                    staff['employee_id']?.toString(),
                    staff['email']?.toString(),
                  ]
                      .where((value) => value != null && value.isNotEmpty)
                      .join('  |  ');

                  return ListTile(
                    dense: true,
                    title: Text(_staffDisplayName(staff)),
                    subtitle: subtitleParts.isEmpty
                        ? null
                        : Text(subtitleParts, overflow: TextOverflow.ellipsis),
                    onTap: () => onSelected(staff),
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }
}

// ── INLINE PRODUCTION LOGGING SECTION ─────────────────────────────────────────
// Shown within the active shift dashboard. Loads all production recipes for this
// branch, lets staff pick one, see each ingredient with available kitchen stock,
// enter actual quantities used, and log the production event.

class _KitchenProductionLogSection extends ConsumerStatefulWidget {
  const _KitchenProductionLogSection({
    required this.shift,
    required this.shiftItems,
  });
  final KitchenShift shift;
  final List<KitchenShiftItem> shiftItems;

  @override
  ConsumerState<_KitchenProductionLogSection> createState() =>
      _KitchenProductionLogSectionState();
}

class _KitchenProductionLogSectionState
    extends ConsumerState<_KitchenProductionLogSection> {
  bool _loading = true;
  bool _saving = false;
  List<Map<String, dynamic>> _recipes = [];
  List<Map<String, dynamic>> _staff = [];
  List<Map<String, dynamic>> _recentIssuances = [];
  Map<String, dynamic>? _selectedRecipe;
  Map<String, dynamic>? _selectedStaff;
  final Map<String, TextEditingController> _inputCtrl = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in _inputCtrl.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final storekeeperRepo = ref.read(branchStorekeeperRepositoryProvider);
      final kitchenRepo = ref.read(kitchenRepositoryProvider);
      final results = await Future.wait([
        storekeeperRepo.getProductionRecipes(),
        kitchenRepo.getStaffProfiles(),
        storekeeperRepo.getShiftAdditions(widget.shift.id),
      ]);

      final allRecipes =
          List<Map<String, dynamic>>.from(results[0] as List<dynamic>);
      // SUB_ASSEMBLY (prep) recipes are handled by the Prep Batch section
      final eligible = allRecipes.where((r) {
        final yt = (r['yield_type_code'] ?? '').toString().toUpperCase();
        return yt == 'PRODUCTION' || yt == 'COMPLEX';
      }).toList()
        ..sort((a, b) => _recipeName(a).compareTo(_recipeName(b)));

      final staffList =
          List<Map<String, dynamic>>.from(results[1] as List<dynamic>);
      final issuances =
          List<Map<String, dynamic>>.from(results[2] as List<dynamic>);

      if (!mounted) return;
      setState(() {
        _recipes = eligible;
        _staff = staffList;
        _recentIssuances = issuances;
        _loading = false;
      });

      // Pre-select first assigned chef
      if (_selectedStaff == null && staffList.isNotEmpty) {
        final preferred = {
          ...widget.shift.assignedChefIds,
          ...widget.shift.assignedDispenseIds,
        };
        final chef = staffList.firstWhere(
          (s) => preferred.contains(s['id']?.toString()),
          orElse: () => staffList.first,
        );
        if (mounted) setState(() => _selectedStaff = chef);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        AppNotifier.show(context, 'Failed to load production recipes: $e',
            isError: true);
      }
    }
  }

  String _recipeName(Map<String, dynamic> r) =>
      (r['produced_item_name'] ?? r['recipe_name'] ?? 'Unnamed').toString();

  String _staffName(Map<String, dynamic> s) =>
      '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();

  void _selectRecipe(Map<String, dynamic>? recipe) {
    for (final c in _inputCtrl.values) {
      c.dispose();
    }
    _inputCtrl.clear();
    if (recipe != null) {
      for (final inp in _inputs(recipe)) {
        final sku = inp['raw_item_sku']?.toString() ?? '';
        final stdQty = (inp['quantity'] as num?)?.toDouble() ?? 0;
        _inputCtrl[sku] = TextEditingController(
          text: stdQty > 0 ? stdQty.toStringAsFixed(2) : '',
        );
      }
    }
    setState(() => _selectedRecipe = recipe);
  }

  List<Map<String, dynamic>> _inputs(Map<String, dynamic> recipe) =>
      ((recipe['inputs'] as List?) ?? [])
          .whereType<Map>()
          .map((i) => Map<String, dynamic>.from(i))
          .toList();

  double _available(String sku) {
    final item = widget.shiftItems
        .where((i) => i.itemSku == sku)
        .firstOrNull;
    if (item == null) return 0;
    return item.openingStock +
        item.additions -
        item.soldQuantity -
        item.spoilageQuantity;
  }

  double get _expectedOutput {
    final recipe = _selectedRecipe;
    if (recipe == null) return 0;
    final inps = _inputs(recipe);
    if (inps.isEmpty) return 0;
    final factors = <double>[];
    for (final inp in inps) {
      final sku = inp['raw_item_sku']?.toString() ?? '';
      final std = (inp['quantity'] as num?)?.toDouble() ?? 0;
      final used = double.tryParse(_inputCtrl[sku]?.text ?? '') ?? 0;
      if (std > 0 && used > 0) factors.add(used / std);
    }
    if (factors.isEmpty) return 0;
    final minFactor = factors.reduce((a, b) => a < b ? a : b);
    return ((recipe['produced_quantity'] as num?)?.toDouble() ?? 0) * minFactor;
  }

  Future<void> _issueToKitchen() async {
    final recipe = _selectedRecipe;
    if (recipe == null) {
      AppNotifier.show(context, 'Select a recipe first.', isError: true);
      return;
    }
    if (_selectedStaff == null) {
      AppNotifier.show(context, 'Select the staff issuing these ingredients.',
          isError: true);
      return;
    }

    final inps = _inputs(recipe);
    if (inps.isEmpty) {
      AppNotifier.show(context, 'Selected recipe has no ingredients to issue.',
          isError: true);
      return;
    }

    final items = <Map<String, dynamic>>[];
    for (final inp in inps) {
      final sku = inp['raw_item_sku']?.toString() ?? '';
      final issued = double.tryParse(_inputCtrl[sku]?.text.trim() ?? '') ?? 0;
      if (issued <= 0) {
        AppNotifier.show(
            context,
            'Enter quantity to issue for ${inp['raw_item_name'] ?? sku}.',
            isError: true);
        return;
      }
      final avail = _available(sku);
      if (issued > avail) {
        AppNotifier.show(
            context,
            '${inp['raw_item_name'] ?? sku} exceeds available stock '
            '(${avail.toStringAsFixed(2)} ${inp['unit'] ?? ''} available).',
            isError: true);
        return;
      }
      items.add({
        'sku': sku,
        'name': inp['raw_item_name'],
        'quantity': issued,
        'unit': inp['unit'] ?? 'unit',
        'purpose_channel': 'pos_restaurant',
        'recipe_id': recipe['id'],
        'responsible_staff_ids': [_selectedStaff!['id']?.toString()],
        'notes': 'Production batch: ${_recipeName(recipe)}',
      });
    }

    setState(() => _saving = true);
    try {
      await ref
          .read(branchStorekeeperRepositoryProvider)
          .addShiftStock(widget.shift.id, items);

      if (!mounted) return;
      AppNotifier.show(
          context,
          'Ingredients issued to kitchen. '
          'Go to Production Logging to record actual output produced.');
      _selectRecipe(null);
      await _load();
    } catch (e) {
      if (!mounted) return;
      AppNotifier.show(context, 'Failed to issue ingredients: $e',
          isError: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 32),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    final recipe = _selectedRecipe;
    final inps = recipe != null ? _inputs(recipe) : <Map<String, dynamic>>[];
    final producedUnit =
        (recipe?['produced_unit'] ?? 'pcs').toString();
    final expected = _expectedOutput;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Section header ────────────────────────────────────────────────────
        Row(
          children: [
            const Icon(Icons.inventory_2_outlined, color: Color(0xFF1D4ED8)),
            const SizedBox(width: 8),
            const Text(
              'Issue Production Batch',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const Spacer(),
            IconButton(
              icon: const Icon(Icons.refresh, size: 20),
              onPressed: _load,
              tooltip: 'Refresh',
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          'Issue raw ingredients from kitchen stock for a production batch. '
          'After issuing, record actual produced output in Production Logging.',
          style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
        ),
        const SizedBox(height: 14),

        // ── Recipe picker ─────────────────────────────────────────────────────
        if (_recipes.isEmpty)
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.grey.shade200),
            ),
            child: const Padding(
              padding: EdgeInsets.all(24),
              child: Center(
                child: Text(
                  'No batch-production standards configured yet. '
                  'Add Production (Batch) standards in Branch Accountant → Food Control Standards.',
                  style: TextStyle(color: Colors.grey),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          )
        else
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.grey.shade200),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Select Recipe',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  Autocomplete<Map<String, dynamic>>(
                    key: ValueKey(
                      'issue_batch_recipe_${recipe != null ? recipe['id'] : 'none'}_${_recipes.length}',
                    ),
                    initialValue: TextEditingValue(
                      text: recipe != null ? _recipeName(recipe) : '',
                    ),
                    displayStringForOption: (r) => _recipeName(r),
                    optionsBuilder: (textEditingValue) {
                      final query =
                          textEditingValue.text.trim().toLowerCase();
                      if (query.isEmpty) {
                        return _recipes.take(50);
                      }
                      return _recipes.where((r) {
                        final name = _recipeName(r).toLowerCase();
                        final code = '${r['recipe_code'] ?? ''}'.toLowerCase();
                        final rawName =
                            '${r['raw_item_name'] ?? ''}'.toLowerCase();
                        final prodName =
                            '${r['produced_item_name'] ?? ''}'.toLowerCase();
                        final sku =
                            '${r['produced_item_sku'] ?? r['raw_item_sku'] ?? ''}'
                                .toLowerCase();
                        return name.contains(query) ||
                            code.contains(query) ||
                            rawName.contains(query) ||
                            prodName.contains(query) ||
                            sku.contains(query);
                      }).take(50);
                    },
                    onSelected: _selectRecipe,
                    fieldViewBuilder:
                        (context, controller, focusNode, onFieldSubmitted) {
                      return TextField(
                        controller: controller,
                        focusNode: focusNode,
                        decoration: InputDecoration(
                          hintText: 'Type to search production recipe...',
                          prefixIcon: const Icon(Icons.search),
                          suffixIcon: controller.text.isNotEmpty
                              ? IconButton(
                                  icon: const Icon(Icons.clear, size: 18),
                                  tooltip: 'Clear selection',
                                  onPressed: () {
                                    controller.clear();
                                    _selectRecipe(null);
                                  },
                                )
                              : null,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 12,
                          ),
                        ),
                        onChanged: (val) {
                          if (val.isEmpty && _selectedRecipe != null) {
                            _selectRecipe(null);
                          }
                        },
                      );
                    },
                    optionsViewBuilder: (context, onSelected, options) {
                      final rows = options.toList();
                      return Align(
                        alignment: Alignment.topLeft,
                        child: Material(
                          elevation: 8,
                          borderRadius: BorderRadius.circular(12),
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(
                                maxWidth: 600, maxHeight: 300),
                            child: ListView.separated(
                              padding:
                                  const EdgeInsets.symmetric(vertical: 6),
                              shrinkWrap: true,
                              itemCount: rows.length,
                              separatorBuilder: (_, __) => const Divider(
                                  height: 1, indent: 16, endIndent: 16),
                              itemBuilder: (context, index) {
                                final r = rows[index];
                                final name = _recipeName(r);
                                final raw =
                                    '${r['raw_item_name'] ?? r['raw_item_sku'] ?? ''}'
                                        .trim();
                                final prod =
                                    '${r['produced_item_name'] ?? r['produced_item_sku'] ?? ''}'
                                        .trim();
                                final yieldType = (r['yield_type_code'] ?? '')
                                    .toString()
                                    .toUpperCase();
                                String sub = '';
                                if (raw.isNotEmpty && prod.isNotEmpty) {
                                  sub = '$raw → $prod';
                                } else if (raw.isNotEmpty) {
                                  sub = 'Raw: $raw';
                                }

                                return ListTile(
                                  dense: true,
                                  leading: CircleAvatar(
                                    radius: 16,
                                    backgroundColor: Theme.of(context)
                                        .primaryColor
                                        .withValues(alpha: 0.1),
                                    child: Icon(Icons.restaurant_menu,
                                        size: 16,
                                        color: Theme.of(context).primaryColor),
                                  ),
                                  title: Text(
                                    name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700),
                                  ),
                                  subtitle: sub.isNotEmpty
                                      ? Text(
                                          sub,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                              fontSize: 12,
                                              color: Colors.grey.shade700),
                                        )
                                      : null,
                                  trailing: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.blue.shade50,
                                      borderRadius: BorderRadius.circular(4),
                                      border:
                                          Border.all(color: Colors.blue.shade200),
                                    ),
                                    child: Text(
                                      yieldType.isEmpty ? 'BATCH' : yieldType,
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.blue.shade800,
                                      ),
                                    ),
                                  ),
                                  onTap: () => onSelected(r),
                                );
                              },
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),

        // ── Ingredients table ─────────────────────────────────────────────────
        if (recipe != null) ...[
          const SizedBox(height: 12),
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: const Color(0xFF1D4ED8).withValues(alpha: 0.25)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Recipe title + type badge
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          _recipeName(recipe),
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 16),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          (recipe['yield_type_code'] ?? '').toString(),
                          style: TextStyle(
                              fontSize: 11,
                              color: Colors.blue.shade700,
                              fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Standard yield: ${recipe['produced_quantity']} $producedUnit',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Ingredients — enter quantities to issue:',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                  // Column headers
                  Row(
                    children: const [
                      Expanded(
                          flex: 3,
                          child: Text('Ingredient',
                              style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 12,
                                  color: Colors.grey))),
                      SizedBox(width: 8),
                      SizedBox(
                          width: 82,
                          child: Text('Available',
                              textAlign: TextAlign.right,
                              style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 12,
                                  color: Colors.grey))),
                      SizedBox(width: 8),
                      SizedBox(
                          width: 82,
                          child: Text('Std Qty',
                              textAlign: TextAlign.right,
                              style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 12,
                                  color: Colors.grey))),
                      SizedBox(width: 8),
                      SizedBox(
                          width: 108,
                          child: Text('Issued Qty',
                              textAlign: TextAlign.right,
                              style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 12,
                                  color: Colors.grey))),
                    ],
                  ),
                  const Divider(height: 12),
                  for (final inp in inps) ...[
                    _IngredientInputRow(
                      input: inp,
                      available:
                          _available(inp['raw_item_sku']?.toString() ?? ''),
                      controller: _inputCtrl[
                              inp['raw_item_sku']?.toString() ?? ''] ??
                          TextEditingController(),
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 8),
                  ],
                  if (expected > 0) ...[
                    const Divider(height: 16),
                    Row(
                      children: [
                        Text(
                          'Expected output from issued amounts:',
                          style: TextStyle(
                              fontSize: 12, color: Colors.grey.shade700),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${expected.toStringAsFixed(2)} $producedUnit',
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 13),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),

          // ── Issue attribution + submit ────────────────────────────────────
          const SizedBox(height: 12),
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.grey.shade200),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Issued By',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 12),
                  Autocomplete<Map<String, dynamic>>(
                    key: ValueKey(
                      'issued_by_staff_${_selectedStaff != null ? _selectedStaff!['id'] : 'none'}_${_staff.length}',
                    ),
                    initialValue: TextEditingValue(
                      text: _selectedStaff != null
                          ? _staffName(_selectedStaff!)
                          : '',
                    ),
                    displayStringForOption: (s) => _staffName(s),
                    optionsBuilder: (textEditingValue) {
                      final query =
                          textEditingValue.text.trim().toLowerCase();
                      if (query.isEmpty) {
                        return _staff.take(50);
                      }
                      return _staff.where((s) {
                        final name = _staffName(s).toLowerCase();
                        final role = '${s['role'] ?? ''}'.toLowerCase();
                        final email = '${s['email'] ?? ''}'.toLowerCase();
                        return name.contains(query) ||
                            role.contains(query) ||
                            email.contains(query);
                      }).take(50);
                    },
                    onSelected: (s) => setState(() => _selectedStaff = s),
                    fieldViewBuilder:
                        (context, controller, focusNode, onFieldSubmitted) {
                      return TextField(
                        controller: controller,
                        focusNode: focusNode,
                        decoration: InputDecoration(
                          hintText:
                              'Type to search staff issuing to kitchen...',
                          labelText: 'Staff issuing to kitchen',
                          prefixIcon: const Icon(Icons.search),
                          suffixIcon: controller.text.isNotEmpty
                              ? IconButton(
                                  icon: const Icon(Icons.clear, size: 18),
                                  tooltip: 'Clear selection',
                                  onPressed: () {
                                    controller.clear();
                                    setState(() => _selectedStaff = null);
                                  },
                                )
                              : null,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 12,
                          ),
                        ),
                        onChanged: (val) {
                          if (val.isEmpty && _selectedStaff != null) {
                            setState(() => _selectedStaff = null);
                          }
                        },
                      );
                    },
                    optionsViewBuilder: (context, onSelected, options) {
                      final rows = options.toList();
                      return Align(
                        alignment: Alignment.topLeft,
                        child: Material(
                          elevation: 8,
                          borderRadius: BorderRadius.circular(12),
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(
                                maxWidth: 600, maxHeight: 250),
                            child: ListView.separated(
                              padding:
                                  const EdgeInsets.symmetric(vertical: 6),
                              shrinkWrap: true,
                              itemCount: rows.length,
                              separatorBuilder: (_, __) => const Divider(
                                  height: 1, indent: 16, endIndent: 16),
                              itemBuilder: (context, index) {
                                final s = rows[index];
                                final name = _staffName(s);
                                final role = (s['role'] ?? 'Staff')
                                    .toString()
                                    .replaceAll('_', ' ')
                                    .toUpperCase();

                                return ListTile(
                                  dense: true,
                                  leading: CircleAvatar(
                                    radius: 16,
                                    backgroundColor: Theme.of(context)
                                        .primaryColor
                                        .withValues(alpha: 0.1),
                                    child: Icon(Icons.person,
                                        size: 16,
                                        color: Theme.of(context).primaryColor),
                                  ),
                                  title: Text(
                                    name,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700),
                                  ),
                                  subtitle: role.isNotEmpty
                                      ? Text(
                                          role,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                              fontSize: 11,
                                              color: Colors.grey.shade700),
                                        )
                                      : null,
                                  onTap: () => onSelected(s),
                                );
                              },
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _saving ? null : _issueToKitchen,
                      icon: _saving
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.send_outlined),
                      label: Text(_saving ? 'Issuing...' : 'Issue to Kitchen'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF1D4ED8),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],

        // ── Recent issuances this shift ───────────────────────────────────────
        if (_recentIssuances.isNotEmpty) _buildIssuancesSection(),
      ],
    );
  }

  Widget _buildIssuancesSection() {
    final grouped = <String, List<Map<String, dynamic>>>{};
    for (final iss in _recentIssuances) {
      final sku = iss['item_sku']?.toString() ?? '';
      (grouped[sku] ??= []).add(iss);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 24),
        const Text(
          'Issued to Kitchen This Shift',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        for (final entry in grouped.entries)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Card(
              margin: EdgeInsets.zero,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
                side: BorderSide(color: Colors.grey.shade200),
              ),
              clipBehavior: Clip.antiAlias,
              child: _buildSkuAccordion(entry.key, entry.value),
            ),
          ),
      ],
    );
  }

  Widget _buildSkuAccordion(String sku, List<Map<String, dynamic>> issuances) {
    final first = issuances.first;
    final name = (first['item_name']?.toString() ?? '').isNotEmpty
        ? first['item_name'].toString()
        : sku;
    final unit = first['unit']?.toString() ?? '';
    final total = issuances.fold<double>(
        0, (sum, iss) => sum + ((iss['quantity'] as num?)?.toDouble() ?? 0));

    return ExpansionTile(
      leading: const Icon(Icons.inventory_2_outlined,
          size: 20, color: Color(0xFF1D4ED8)),
      title: Row(
        children: [
          Expanded(
            child: Text(
              name,
              style:
                  const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
            ),
          ),
          Text(
            '${total.toStringAsFixed(2)} $unit',
            style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 13,
                color: Color(0xFF1D4ED8)),
          ),
        ],
      ),
      subtitle: Text(
        sku,
        style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
      ),
      childrenPadding: EdgeInsets.zero,
      expandedCrossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          color: Colors.grey.shade50,
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'SKU: $sku',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: Colors.grey.shade700),
              ),
              Text(
                'Total: ${total.toStringAsFixed(2)} $unit',
                style: const TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w700),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        for (int i = 0; i < issuances.length; i++) ...[
          if (i > 0) const Divider(height: 1, indent: 16, endIndent: 16),
          _buildIssuanceRow(issuances[i], unit),
        ],
      ],
    );
  }

  Widget _buildIssuanceRow(Map<String, dynamic> iss, String unit) {
    final addedAt = iss['added_at']?.toString();
    DateTime? dt;
    if (addedAt != null) dt = DateTime.tryParse(addedAt)?.toLocal();
    final dateStr = dt == null
        ? '—'
        : '${dt.day.toString().padLeft(2, '0')}/'
            '${dt.month.toString().padLeft(2, '0')} '
            '${dt.hour.toString().padLeft(2, '0')}:'
            '${dt.minute.toString().padLeft(2, '0')}';
    final qty = (iss['quantity'] as num?)?.toDouble() ?? 0;
    final notes = iss['notes']?.toString() ?? '';
    final refId = iss['reference_id']?.toString() ?? '';
    final channel = iss['purpose_channel']?.toString() ?? '';
    final channelLabel = switch (channel) {
      'pos_restaurant' => 'POS Restaurant',
      'bar' => 'Bar',
      'kitchen' => 'Kitchen',
      _ => channel,
    };

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.access_time_outlined,
                  size: 13, color: Colors.grey.shade400),
              const SizedBox(width: 4),
              Text(
                dateStr,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
              ),
              const Spacer(),
              Text(
                '${qty.toStringAsFixed(2)} $unit',
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ],
          ),
          if (channelLabel.isNotEmpty || refId.isNotEmpty || notes.isNotEmpty)
            const SizedBox(height: 3),
          if (channelLabel.isNotEmpty)
            Text(
              channelLabel,
              style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
            ),
          if (refId.length >= 8)
            Text(
              'Ref: ${refId.substring(0, 8)}',
              style: TextStyle(
                  fontSize: 11,
                  color: Colors.grey.shade400,
                  fontFamily: 'monospace'),
            ),
          if (notes.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                notes,
                style: TextStyle(
                    fontSize: 11,
                    fontStyle: FontStyle.italic,
                    color: Colors.grey.shade600),
              ),
            ),
        ],
      ),
    );
  }
}

class _IngredientInputRow extends StatelessWidget {
  const _IngredientInputRow({
    required this.input,
    required this.available,
    required this.controller,
    required this.onChanged,
  });

  final Map<String, dynamic> input;
  final double available;
  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final name =
        input['raw_item_name']?.toString() ?? input['raw_item_sku']?.toString() ?? '';
    final unit = input['unit']?.toString() ?? '';
    final stdQty = (input['quantity'] as num?)?.toDouble() ?? 0;
    final issued = double.tryParse(controller.text) ?? 0;
    final isOver = issued > available && available >= 0;

    return Row(
      children: [
        Expanded(
          flex: 3,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name,
                  style: const TextStyle(
                      fontWeight: FontWeight.w500, fontSize: 13)),
              if (unit.isNotEmpty)
                Text(unit,
                    style: TextStyle(
                        fontSize: 11, color: Colors.grey.shade500)),
            ],
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 82,
          child: Text(
            available.toStringAsFixed(2),
            textAlign: TextAlign.right,
            style: TextStyle(
                fontSize: 13,
                color: available <= 0
                    ? Colors.red.shade700
                    : Colors.grey.shade700),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 82,
          child: Text(
            stdQty.toStringAsFixed(2),
            textAlign: TextAlign.right,
            style: TextStyle(fontSize: 13, color: Colors.grey.shade500),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 108,
          child: TextField(
            controller: controller,
            textAlign: TextAlign.right,
            decoration: InputDecoration(
              isDense: true,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(6),
                borderSide: BorderSide(
                    color: isOver
                        ? Colors.red.shade300
                        : Colors.grey.shade300),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(6),
                borderSide: BorderSide(
                    color: isOver
                        ? Colors.red.shade400
                        : Colors.grey.shade300),
              ),
              errorText: isOver ? 'Over limit' : null,
              errorStyle: const TextStyle(fontSize: 10),
            ),
            keyboardType:
                const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*'))
            ],
            onChanged: onChanged,
          ),
        ),
      ],
    );
  }
}

// ── PREP BATCH SECTION ────────────────────────────────────────────────────────
// For SUB_ASSEMBLY recipes (e.g. Peel Potatoes, Cut Potatoes).
// Issues raw ingredients AND records the prepared output in one step.

class _PrepBatchSection extends ConsumerStatefulWidget {
  const _PrepBatchSection({
    required this.shift,
    required this.shiftItems,
  });
  final KitchenShift shift;
  final List<KitchenShiftItem> shiftItems;

  @override
  ConsumerState<_PrepBatchSection> createState() => _PrepBatchSectionState();
}

class _PrepBatchSectionState extends ConsumerState<_PrepBatchSection> {
  bool _loading = true;
  bool _saving = false;
  List<Map<String, dynamic>> _recipes = [];
  List<Map<String, dynamic>> _staff = [];
  List<Map<String, dynamic>> _recentPreps = [];
  Map<String, dynamic>? _selectedRecipe;
  Map<String, dynamic>? _selectedStaff;
  final Map<String, TextEditingController> _inputCtrl = {};
  final _outputQtyCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in _inputCtrl.values) c.dispose();
    _outputQtyCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final storekeeperRepo = ref.read(branchStorekeeperRepositoryProvider);
      final kitchenRepo = ref.read(kitchenRepositoryProvider);
      final results = await Future.wait([
        storekeeperRepo.getProductionRecipes(),
        kitchenRepo.getStaffProfiles(),
        storekeeperRepo.getShiftAdditions(widget.shift.id),
      ]);

      final allRecipes = List<Map<String, dynamic>>.from(results[0] as List);
      final prepRecipes = allRecipes.where((r) {
        final yt = (r['yield_type_code'] ?? '').toString().toUpperCase();
        return yt == 'SUB_ASSEMBLY';
      }).toList()
        ..sort((a, b) => _recipeName(a).compareTo(_recipeName(b)));

      final staffList = List<Map<String, dynamic>>.from(results[1] as List);
      final prepRecipeIds =
          prepRecipes.map((r) => r['id']?.toString() ?? '').toSet();
      final recentPreps =
          List<Map<String, dynamic>>.from(results[2] as List).where((a) {
        return prepRecipeIds.contains(a['recipe_id']?.toString() ?? '');
      }).toList();

      if (!mounted) return;
      setState(() {
        _recipes = prepRecipes;
        _staff = staffList;
        _recentPreps = recentPreps;
        _loading = false;
      });

      if (_selectedStaff == null && staffList.isNotEmpty) {
        final preferred = {
          ...widget.shift.assignedChefIds,
          ...widget.shift.assignedDispenseIds,
        };
        final chef = staffList.firstWhere(
          (s) => preferred.contains(s['id']?.toString()),
          orElse: () => staffList.first,
        );
        if (mounted) setState(() => _selectedStaff = chef);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        AppNotifier.show(context, 'Failed to load prep recipes: $e',
            isError: true);
      }
    }
  }

  String _recipeName(Map<String, dynamic> r) =>
      (r['produced_item_name'] ?? r['recipe_name'] ?? 'Unnamed').toString();

  String _staffName(Map<String, dynamic> s) =>
      '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();

  List<Map<String, dynamic>> _inputs(Map<String, dynamic> recipe) =>
      ((recipe['inputs'] as List?) ?? [])
          .whereType<Map>()
          .map((i) => Map<String, dynamic>.from(i))
          .toList();

  double _available(String sku) {
    final item =
        widget.shiftItems.where((i) => i.itemSku == sku).firstOrNull;
    if (item == null) return 0;
    return item.openingStock +
        item.additions -
        item.soldQuantity -
        item.spoilageQuantity;
  }

  void _selectRecipe(Map<String, dynamic>? recipe) {
    for (final c in _inputCtrl.values) c.dispose();
    _inputCtrl.clear();
    _outputQtyCtrl.clear();
    if (recipe != null) {
      final inps = _inputs(recipe);
      if (inps.isNotEmpty) {
        for (final inp in inps) {
          final sku = inp['raw_item_sku']?.toString() ?? '';
          final stdQty = (inp['quantity'] as num?)?.toDouble() ?? 0;
          _inputCtrl[sku] = TextEditingController(
            text: stdQty > 0 ? stdQty.toStringAsFixed(2) : '',
          );
        }
      } else {
        final sku = (recipe['raw_item_sku'] ?? '').toString();
        if (sku.isNotEmpty && sku.toUpperCase() != 'MULTI') {
          final stdQty = (recipe['raw_quantity'] as num?)?.toDouble() ?? 0;
          _inputCtrl[sku] = TextEditingController(
            text: stdQty > 0 ? stdQty.toStringAsFixed(2) : '',
          );
        }
      }
      final stdOut = (recipe['produced_quantity'] as num?)?.toDouble() ?? 0;
      if (stdOut > 0) _outputQtyCtrl.text = stdOut.toStringAsFixed(2);
    }
    setState(() => _selectedRecipe = recipe);
  }

  Future<void> _recordPrep() async {
    final recipe = _selectedRecipe;
    if (recipe == null) {
      AppNotifier.show(context, 'Select a prep recipe first.', isError: true);
      return;
    }
    if (_selectedStaff == null) {
      AppNotifier.show(context, 'Select the staff doing the prep.',
          isError: true);
      return;
    }

    final outputQty = double.tryParse(_outputQtyCtrl.text.trim()) ?? 0;
    if (outputQty <= 0) {
      AppNotifier.show(context, 'Enter the prepared output quantity.',
          isError: true);
      return;
    }

    final inps = _inputs(recipe);
    final issueItems = <Map<String, dynamic>>[];

    // Build raw issuance list from inputs table or single-input fallback
    final inputDefs = inps.isNotEmpty
        ? inps.map((i) => {
              'sku': (i['raw_item_sku'] ?? '').toString(),
              'name': i['raw_item_name'],
              'std_qty': (i['quantity'] as num?)?.toDouble() ?? 0,
              'unit': (i['unit'] ?? 'kg').toString(),
            }).toList()
        : () {
            final sku = (recipe['raw_item_sku'] ?? '').toString();
            if (sku.isEmpty || sku.toUpperCase() == 'MULTI') return [];
            return [
              {
                'sku': sku,
                'name': recipe['raw_item_name'],
                'std_qty': (recipe['raw_quantity'] as num?)?.toDouble() ?? 0,
                'unit': (recipe['raw_unit'] ?? 'kg').toString(),
              }
            ];
          }();

    if (inputDefs.isEmpty) {
      AppNotifier.show(context, 'No raw inputs configured for this recipe.',
          isError: true);
      return;
    }

    for (final def in inputDefs) {
      final sku = def['sku'] as String;
      final issued =
          double.tryParse(_inputCtrl[sku]?.text.trim() ?? '') ?? 0;
      if (issued <= 0) {
        AppNotifier.show(
            context, 'Enter qty for ${def['name'] ?? sku}.', isError: true);
        return;
      }
      final avail = _available(sku);
      if (issued > avail) {
        AppNotifier.show(
            context,
            '${def['name'] ?? sku}: only ${avail.toStringAsFixed(2)} ${def['unit']} available.',
            isError: true);
        return;
      }
      issueItems.add({
        'sku': sku,
        'name': def['name'],
        'quantity': issued,
        'unit': def['unit'],
        'purpose_channel': 'pos_restaurant',
        'recipe_id': recipe['id'],
        'responsible_staff_ids': [_selectedStaff!['id']?.toString()],
        'notes': 'Prep batch: ${_recipeName(recipe)}',
      });
    }

    // Resolve output item ID: SUB_ASSEMBLY uses produced_inventory_item_id
    final outputItemId =
        (recipe['produced_inventory_item_id']?.toString() ?? '').isNotEmpty
            ? recipe['produced_inventory_item_id'].toString()
            : (recipe['pos_outlet_item_id']?.toString() ?? '');
    if (outputItemId.isEmpty) {
      AppNotifier.show(
          context,
          'Recipe has no output item linked. '
          'Configure it in Food Control Standards.',
          isError: true);
      return;
    }

    // Auto-scale consumed inputs proportionally from standard
    final stdOutput =
        (recipe['produced_quantity'] as num?)?.toDouble() ?? 0;
    final scaleFactor = stdOutput > 0 ? outputQty / stdOutput : 1.0;
    final consumedInputs = inputDefs.map((def) {
      final usedQty =
          double.parse(((def['std_qty'] as double) * scaleFactor).toStringAsFixed(4));
      return {
        'raw_item_sku': def['sku'],
        'raw_item_name': def['name'],
        'quantity_used': usedQty,
        'unit': def['unit'],
      };
    }).toList();

    setState(() => _saving = true);
    try {
      final storekeeperRepo = ref.read(branchStorekeeperRepositoryProvider);
      // Step 1: issue raw ingredients from store to kitchen
      await storekeeperRepo.addShiftStock(widget.shift.id, issueItems);
      // Step 2: log the prep output (produced peeled/cut qty)
      await storekeeperRepo.logProductionEvent({
        'kitchen_shift_id': widget.shift.id,
        'output_item_id': outputItemId,
        'production_recipe_id': recipe['id'],
        'consumed_inputs': consumedInputs,
        'actual_produced_qty': outputQty,
        'output_unit': recipe['produced_unit'] ?? 'kg',
        'produced_by': _selectedStaff!['id'],
        'idempotency_key':
            '${widget.shift.id}-prep-${recipe['id']}-${DateTime.now().millisecondsSinceEpoch}',
      });

      if (!mounted) return;
      AppNotifier.show(
          context,
          'Prep recorded: ${outputQty.toStringAsFixed(2)} '
          '${recipe['produced_unit'] ?? 'kg'} of ${_recipeName(recipe)} ready.');
      _selectRecipe(null);
      await _load();
    } catch (e) {
      if (!mounted) return;
      AppNotifier.show(context, 'Failed to record prep batch: $e',
          isError: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 32),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    final recipe = _selectedRecipe;
    final inps = recipe != null ? _inputs(recipe) : <Map<String, dynamic>>[];
    final producedUnit = (recipe?['produced_unit'] ?? 'kg').toString();
    final stdOutput = (recipe?['produced_quantity'] as num?)?.toDouble() ?? 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Header ────────────────────────────────────────────────────────────
        Row(
          children: [
            const Icon(Icons.cut_outlined, color: Color(0xFF059669)),
            const SizedBox(width: 8),
            const Text(
              'Prep Batch',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const Spacer(),
            IconButton(
              icon: const Icon(Icons.refresh, size: 20),
              onPressed: _load,
              tooltip: 'Refresh',
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          'For in-kitchen transformations already issued to the kitchen (e.g. masala, dough, sauces). '
          'Issues raw stock and records prepared output in one step.',
          style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
        ),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0xFFFFFBEB),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFFDE68A)),
          ),
          child: Row(
            children: [
              const Icon(Icons.info_outline, size: 16, color: Color(0xFFB45309)),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'NOT for potatoes. Use Prep Returns (external prep) to send raw potatoes for cutting/peeling and receive Cut Chips or Peeled Potatoes back.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF92400E)),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // ── Recipe picker ─────────────────────────────────────────────────────
        if (_recipes.isEmpty)
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.grey.shade200),
            ),
            child: const Padding(
              padding: EdgeInsets.all(24),
              child: Center(
                child: Text(
                  'No Sub-Assembly (prep) standards configured yet. '
                  'Add them in Food Control Standards with yield type "Sub-Assembly".',
                  style: TextStyle(color: Colors.grey),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          )
        else
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.grey.shade200),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Select Prep Recipe',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<Map<String, dynamic>>(
                    value: recipe,
                    isExpanded: true,
                    decoration: InputDecoration(
                      hintText:
                          'Choose prep recipe (e.g. Peel Potatoes, Cut Potatoes)...',
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8)),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 12),
                    ),
                    items: _recipes
                        .map((r) => DropdownMenuItem(
                              value: r,
                              child: Text(_recipeName(r),
                                  overflow: TextOverflow.ellipsis),
                            ))
                        .toList(),
                    onChanged: _selectRecipe,
                  ),
                ],
              ),
            ),
          ),

        // ── Prep form ─────────────────────────────────────────────────────────
        if (recipe != null) ...[
          const SizedBox(height: 12),
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(
                  color: const Color(0xFF059669).withValues(alpha: 0.3)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Recipe title
                  Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color:
                              const Color(0xFF059669).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.cut_outlined,
                            color: Color(0xFF059669), size: 18),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_recipeName(recipe),
                                style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 15)),
                            if (stdOutput > 0)
                              Text(
                                'Standard yield: $stdOutput $producedUnit',
                                style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey.shade600),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // ── Raw inputs ──────────────────────────────────────────────
                  const Text('Raw Input (from store / kitchen stock)',
                      style:
                          TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  const SizedBox(height: 8),
                  Row(
                    children: const [
                      Expanded(
                          flex: 3,
                          child: Text('Item',
                              style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 12,
                                  color: Colors.grey))),
                      SizedBox(width: 8),
                      SizedBox(
                          width: 76,
                          child: Text('Available',
                              textAlign: TextAlign.right,
                              style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 12,
                                  color: Colors.grey))),
                      SizedBox(width: 8),
                      SizedBox(
                          width: 72,
                          child: Text('Std Qty',
                              textAlign: TextAlign.right,
                              style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 12,
                                  color: Colors.grey))),
                      SizedBox(width: 8),
                      SizedBox(
                          width: 100,
                          child: Text('Issue Qty',
                              textAlign: TextAlign.right,
                              style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 12,
                                  color: Colors.grey))),
                    ],
                  ),
                  const Divider(height: 10),
                  if (inps.isNotEmpty)
                    for (final inp in inps) ...[
                      _IngredientInputRow(
                        input: inp,
                        available: _available(
                            inp['raw_item_sku']?.toString() ?? ''),
                        controller: _inputCtrl[
                                inp['raw_item_sku']?.toString() ?? ''] ??
                            TextEditingController(),
                        onChanged: (_) => setState(() {}),
                      ),
                      const SizedBox(height: 8),
                    ]
                  else if ((recipe['raw_item_sku'] ?? '').toString().isNotEmpty &&
                      (recipe['raw_item_sku'] ?? '')
                              .toString()
                              .toUpperCase() !=
                          'MULTI') ...[
                    _PrepSingleInputRow(
                      recipe: recipe,
                      available: _available(
                          (recipe['raw_item_sku'] ?? '').toString()),
                      controller: _inputCtrl[
                              (recipe['raw_item_sku'] ?? '').toString()] ??
                          TextEditingController(),
                      onChanged: (_) => setState(() {}),
                    ),
                    const SizedBox(height: 8),
                  ],

                  const SizedBox(height: 12),
                  const Divider(),
                  const SizedBox(height: 12),

                  // ── Output ──────────────────────────────────────────────────
                  const Text('Prepared Output',
                      style:
                          TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_recipeName(recipe),
                                style: const TextStyle(
                                    fontWeight: FontWeight.w500, fontSize: 13)),
                            Text(producedUnit,
                                style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.grey.shade500)),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      SizedBox(
                        width: 150,
                        child: TextField(
                          controller: _outputQtyCtrl,
                          textAlign: TextAlign.right,
                          decoration: InputDecoration(
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 10),
                            suffixText: producedUnit,
                            labelText: 'Output qty',
                            border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(6)),
                          ),
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(
                                RegExp(r'^\d*\.?\d*'))
                          ],
                          onChanged: (_) => setState(() {}),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // ── Staff + submit ─────────────────────────────────────────────────
          const SizedBox(height: 12),
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.grey.shade200),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Prepared By',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<Map<String, dynamic>>(
                    value: _selectedStaff,
                    isExpanded: true,
                    decoration: InputDecoration(
                      labelText: 'Staff doing the prep',
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8)),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 12),
                    ),
                    items: _staff
                        .map((s) => DropdownMenuItem(
                              value: s,
                              child: Text(_staffName(s),
                                  overflow: TextOverflow.ellipsis),
                            ))
                        .toList(),
                    onChanged: (s) => setState(() => _selectedStaff = s),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _saving ? null : _recordPrep,
                      icon: _saving
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.check_circle_outline),
                      label: Text(
                          _saving ? 'Recording...' : 'Record Prep Batch'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF059669),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],

        // ── Recent prep this shift ────────────────────────────────────────────
        if (_recentPreps.isNotEmpty) ...[
          const SizedBox(height: 24),
          const Text(
            'Prepped This Shift',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.grey.shade200),
            ),
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _recentPreps.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (_, i) {
                final prep = _recentPreps[i];
                final name = prep['item_name']?.toString() ??
                    prep['item_sku']?.toString() ??
                    'Item';
                final qty = (prep['quantity'] as num?)?.toDouble() ?? 0;
                final unit = prep['unit']?.toString() ?? '';
                return ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 6),
                  leading: const Icon(Icons.cut_outlined,
                      size: 20, color: Color(0xFF059669)),
                  title: Text(name,
                      style:
                          const TextStyle(fontWeight: FontWeight.w600)),
                  trailing: Text(
                    '${qty.toStringAsFixed(2)} $unit',
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                );
              },
            ),
          ),
        ],
      ],
    );
  }
}

class _PrepSingleInputRow extends StatelessWidget {
  const _PrepSingleInputRow({
    required this.recipe,
    required this.available,
    required this.controller,
    required this.onChanged,
  });

  final Map<String, dynamic> recipe;
  final double available;
  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final name =
        (recipe['raw_item_name'] ?? recipe['raw_item_sku'] ?? '').toString();
    final unit = (recipe['raw_unit'] ?? 'kg').toString();
    final stdQty = (recipe['raw_quantity'] as num?)?.toDouble() ?? 0;
    final issued = double.tryParse(controller.text) ?? 0;
    final isOver = issued > available && available >= 0;

    return Row(
      children: [
        Expanded(
          flex: 3,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name,
                  style: const TextStyle(
                      fontWeight: FontWeight.w500, fontSize: 13)),
              if (unit.isNotEmpty)
                Text(unit,
                    style: TextStyle(
                        fontSize: 11, color: Colors.grey.shade500)),
            ],
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 76,
          child: Text(
            available.toStringAsFixed(2),
            textAlign: TextAlign.right,
            style: TextStyle(
                fontSize: 13,
                color: available <= 0
                    ? Colors.red.shade700
                    : Colors.grey.shade700),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 72,
          child: Text(
            stdQty.toStringAsFixed(2),
            textAlign: TextAlign.right,
            style: TextStyle(fontSize: 13, color: Colors.grey.shade500),
          ),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 100,
          child: TextField(
            controller: controller,
            textAlign: TextAlign.right,
            decoration: InputDecoration(
              isDense: true,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(6),
                borderSide: BorderSide(
                    color: isOver
                        ? Colors.red.shade300
                        : Colors.grey.shade300),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(6),
                borderSide: BorderSide(
                    color: isOver
                        ? Colors.red.shade400
                        : Colors.grey.shade300),
              ),
              errorText: isOver ? 'Over limit' : null,
              errorStyle: const TextStyle(fontSize: 10),
            ),
            keyboardType:
                const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*'))
            ],
            onChanged: onChanged,
          ),
        ),
      ],
    );
  }
}
