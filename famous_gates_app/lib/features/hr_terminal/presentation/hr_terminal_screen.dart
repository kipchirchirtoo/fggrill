import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/network/dio_client.dart';

final _terminalClockProvider = StreamProvider.autoDispose<DateTime>((ref) {
  return Stream.periodic(
    const Duration(seconds: 1),
    (_) => DateTime.now(),
  ).startWith(DateTime.now());
});

extension _StartWith<T> on Stream<T> {
  Stream<T> startWith(T value) async* {
    yield value;
    yield* this;
  }
}

enum _TerminalStep { identify, action, success }

class HRTerminalScreen extends ConsumerStatefulWidget {
  const HRTerminalScreen({super.key});

  @override
  ConsumerState<HRTerminalScreen> createState() => _HRTerminalScreenState();
}

class _HRTerminalScreenState extends ConsumerState<HRTerminalScreen> {
  final _staffController = TextEditingController();
  bool _loading = false;
  _TerminalStep _step = _TerminalStep.identify;
  Map<String, dynamic>? _staffInfo;
  String? _lastAction;
  String? _error;

  @override
  void dispose() {
    _staffController.dispose();
    super.dispose();
  }

  Future<void> _identifyStaff() async {
    final identifier = _staffController.text.trim();
    if (identifier.isEmpty) return;

    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(dioProvider);
      final response = await dio.get(
        '/staff/by-identifier/${Uri.encodeComponent(identifier)}',
      );
      final payload = response.data;
      final staff = payload is Map ? payload['data'] : null;
      if (staff is! Map) {
        throw Exception('No staff profile found for that ID.');
      }

      setState(() {
        _staffInfo = Map<String, dynamic>.from(staff);
        _step = _TerminalStep.action;
      });
    } catch (error) {
      setState(() => _error = _friendlyError(error));
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _clock(String action) async {
    final staff = _staffInfo;
    final staffId = staff?['id']?.toString();
    if (staffId == null || staffId.isEmpty) return;

    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(dioProvider);
      final isClockIn = action == 'in';
      await dio.post(
        isClockIn
            ? '/staff/attendance/clock-in'
            : '/staff/attendance/clock-out',
        data: {
          'staff_id': staffId,
          'device_id': 'TERMINAL_01',
          if (isClockIn) 'in_method': 'terminal' else 'out_method': 'terminal',
        },
      );

      setState(() {
        _lastAction = action;
        _step = _TerminalStep.success;
      });
    } catch (error) {
      setState(() => _error = _friendlyError(error));
    } finally {
      setState(() => _loading = false);
    }
  }

  void _reset() {
    setState(() {
      _step = _TerminalStep.identify;
      _staffInfo = null;
      _lastAction = null;
      _error = null;
    });
    _staffController.clear();
  }

  String _staffName(Map<String, dynamic>? staff) {
    if (staff == null) return 'Staff member';
    final user = staff['user'];
    final first = (staff['first_name'] ?? user?['first_name'] ?? '').toString();
    final last = (staff['last_name'] ?? user?['last_name'] ?? '').toString();
    final full = [
      first,
      last,
    ].where((part) => part.trim().isNotEmpty).join(' ').trim();
    return full.isNotEmpty
        ? full
        : (staff['full_name'] ?? staff['name'] ?? 'Staff member').toString();
  }

  String _staffSubtitle(Map<String, dynamic>? staff) {
    if (staff == null) return '';
    final department = (staff['department'] ?? '').toString();
    final role = (staff['role'] ?? staff['position'] ?? '').toString();
    return [
      if (department.isNotEmpty) department,
      if (role.isNotEmpty) role,
    ].join(' • ');
  }

  String _staffReference(Map<String, dynamic>? staff) {
    if (staff == null) return '';
    return (staff['employee_id'] ??
            staff['id_number'] ??
            staff['national_id'] ??
            staff['staff_number'] ??
            '')
        .toString();
  }

  String _initials(String name) {
    final parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .toList();
    if (parts.isEmpty) return 'FG';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  String _formatDate(DateTime value) {
    return '${value.year}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
  }

  String _formatTime(DateTime value) {
    final hour = value.hour % 12 == 0 ? 12 : value.hour % 12;
    final minute = value.minute.toString().padLeft(2, '0');
    final suffix = value.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $suffix';
  }

  String _friendlyError(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map) {
        final message = data['message'] ?? data['error'];
        if (message != null && message.toString().trim().isNotEmpty) {
          return message.toString();
        }
      }
      if (error.response?.statusCode == 404) {
        return 'No staff profile matched that ID.';
      }
      if (error.response?.statusCode == 400) {
        return 'This clock action could not be completed.';
      }
    }
    final text = error.toString().replaceFirst('Exception: ', '').trim();
    return text.isEmpty ? 'Unable to complete the request.' : text;
  }

  Widget _errorBanner() {
    final error = _error;
    if (error == null) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.kError.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.kError.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Icon(PhosphorIcons.warningCircle(), color: AppColors.kError),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              error,
              style: const TextStyle(
                color: AppColors.kError,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _identifyCard() {
    final canIdentify = _staffController.text.trim().isNotEmpty && !_loading;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _errorBanner(),
            TextField(
              controller: _staffController,
              textInputAction: TextInputAction.done,
              decoration: InputDecoration(
                labelText: 'Staff ID, employee number, or national ID',
                prefixIcon: Icon(PhosphorIcons.identificationBadge()),
              ),
              onChanged: (_) => setState(() {}),
              onSubmitted: (_) => canIdentify ? _identifyStaff() : null,
            ),
            const SizedBox(height: 24),
            SizedBox(
              height: 50,
              child: ElevatedButton.icon(
                onPressed: canIdentify ? _identifyStaff : null,
                icon: _loading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Icon(PhosphorIcons.magnifyingGlass()),
                label: Text(_loading ? 'Identifying...' : 'Identify Personnel'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _actionCard() {
    final staff = _staffInfo;
    final name = _staffName(staff);
    final subtitle = _staffSubtitle(staff);
    final reference = _staffReference(staff);

    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _errorBanner(),
            Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: AppColors.kPrimary.withValues(alpha: 0.12),
                  child: Text(
                    _initials(name),
                    style: const TextStyle(
                      color: AppColors.kPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                      if (subtitle.isNotEmpty)
                        Text(
                          subtitle,
                          style:
                              Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    color: AppColors.kTextSecondary,
                                  ),
                        ),
                      if (reference.isNotEmpty)
                        Text(
                          reference,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: AppColors.kTextSecondary,
                                  ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 28),
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 50,
                    child: ElevatedButton.icon(
                      onPressed: _loading ? null : () => _clock('in'),
                      icon: Icon(PhosphorIcons.signIn()),
                      label: const Text('Clock In'),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: SizedBox(
                    height: 50,
                    child: OutlinedButton.icon(
                      onPressed: _loading ? null : () => _clock('out'),
                      icon: Icon(PhosphorIcons.signOut()),
                      label: const Text('Clock Out'),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _successCard() {
    final name = _staffName(_staffInfo);
    final clockedIn = _lastAction == 'in';
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Icon(
              clockedIn ? PhosphorIcons.sun() : PhosphorIcons.moon(),
              color: clockedIn ? AppColors.kSuccess : AppColors.kPrimary,
              size: 56,
            ),
            const SizedBox(height: 16),
            Text(
              clockedIn ? 'Welcome, $name' : 'Goodbye, $name',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              clockedIn
                  ? 'Clock-in recorded successfully.'
                  : 'Clock-out recorded successfully.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.kTextSecondary,
                  ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              height: 48,
              child: ElevatedButton(
                onPressed: _reset,
                child: const Text('Done'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final now = ref.watch(_terminalClockProvider).value ?? DateTime.now();
    final card = switch (_step) {
      _TerminalStep.identify => _identifyCard(),
      _TerminalStep.action => _actionCard(),
      _TerminalStep.success => _successCard(),
    };

    return Scaffold(
      backgroundColor: AppColors.kPrimary,
      body: SafeArea(
        child: Stack(
          children: [
            Positioned(
              top: 16,
              left: 16,
              child: IconButton.filledTonal(
                tooltip: 'Back to terminal',
                onPressed: () => context.go('/terminal'),
                icon: const Icon(Icons.arrow_back),
              ),
            ),
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(PhosphorIcons.clockCountdown(),
                        size: 64, color: AppColors.kAccent),
                    const SizedBox(height: 16),
                    Text(
                      'Staff Attendance Terminal',
                      style:
                          Theme.of(context).textTheme.headlineSmall?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                              ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${_formatDate(now)}  •  ${_formatTime(now)}',
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: Colors.white70,
                          ),
                    ),
                    const SizedBox(height: 48),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 720),
                      child: card,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
