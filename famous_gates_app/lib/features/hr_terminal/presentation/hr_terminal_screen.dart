import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';

final _dateProvider = Provider((ref) {
  final now = DateTime.now();
  return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
});

final _staffNameProvider = StateProvider<String>((ref) => '');
final _clockStatusProvider = StateProvider<AsyncValue<String>?>((ref) => null);

class HRTerminalScreen extends ConsumerStatefulWidget {
  const HRTerminalScreen({super.key});

  @override
  ConsumerState<HRTerminalScreen> createState() => _HRTerminalScreenState();
}

class _HRTerminalScreenState extends ConsumerState<HRTerminalScreen> {
  final _staffController = TextEditingController();
  final _pinController = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _staffController.dispose();
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _clockInOut() async {
    final staffName = ref.read(_staffNameProvider.notifier).state;
    if (staffName.isEmpty || _pinController.text.isEmpty) return;

    setState(() => _loading = true);
    try {
      // Ensure we have a JWT; if not, login via POS PIN first
      final storage = ref.read(secureStorageProvider);
      final token = await storage.read(key: AuthRepository.jwtKey);
      if (token == null || token.isEmpty) {
        await ref.read(authRepositoryProvider).posLogin(_pinController.text);
      }

      final dio = ref.read(dioProvider);

      // Try to clock OUT first; if no active shift, then clock IN
      try {
        final respOut = await dio.post('/employee-portal/clock', data: {
          'action': 'clock_out',
        });
        final action = (respOut.data is Map)
            ? (respOut.data['data'] != null ? 'clocked_out' : 'clocked_out')
            : 'clocked_out';
        ref.read(_clockStatusProvider.notifier).state = AsyncValue.data(action);
      } on DioException catch (err) {
        final status = err.response?.statusCode ?? 0;
        final message = (err.response?.data is Map)
            ? (err.response?.data['message']?.toString() ?? '')
            : '';
        final noActive =
            status == 400 && message.contains('No active clock-in');
        final unauthorized = status == 401;
        if (unauthorized) {
          // Token may have expired; try login again then retry
          await ref.read(authRepositoryProvider).posLogin(_pinController.text);
        }
        if (noActive || unauthorized) {
          final respIn = await dio.post('/employee-portal/clock', data: {
            'action': 'clock_in',
          });
          final action = (respIn.data is Map)
              ? (respIn.data['data'] != null ? 'clocked_in' : 'clocked_in')
              : 'clocked_in';
          ref.read(_clockStatusProvider.notifier).state =
              AsyncValue.data(action);
        } else {
          rethrow;
        }
      }

      _pinController.clear();
    } catch (e) {
      ref.read(_clockStatusProvider.notifier).state =
          AsyncValue.error(e, StackTrace.current);
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final today = ref.watch(_dateProvider);
    ref.watch(_staffNameProvider);
    final clockStatus = ref.watch(_clockStatusProvider);
    final staffName = _staffController.text;

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
                      today,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: Colors.white70,
                          ),
                    ),
                    const SizedBox(height: 48),
                    Card(
                      margin: EdgeInsets.zero,
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            TextField(
                              controller: _staffController,
                              decoration: InputDecoration(
                                labelText: 'Staff Name or ID',
                                prefixIcon:
                                    Icon(PhosphorIcons.identificationBadge()),
                              ),
                              onChanged: (v) => ref
                                  .read(_staffNameProvider.notifier)
                                  .state = v,
                            ),
                            const SizedBox(height: 16),
                            TextField(
                              controller: _pinController,
                              decoration: InputDecoration(
                                labelText: 'PIN',
                                prefixIcon: Icon(PhosphorIcons.lock()),
                              ),
                              obscureText: true,
                              keyboardType: TextInputType.number,
                              maxLength: 4,
                            ),
                            const SizedBox(height: 24),
                            SizedBox(
                              height: 48,
                              child: ElevatedButton.icon(
                                onPressed: (_loading || staffName.isEmpty)
                                    ? null
                                    : _clockInOut,
                                icon: _loading
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Colors.white,
                                        ),
                                      )
                                    : Icon(PhosphorIcons.fingerprint()),
                                label: Text(_loading
                                    ? 'Processing...'
                                    : 'Clock In / Out'),
                              ),
                            ),
                            if (clockStatus != null)
                              clockStatus.when(
                                data: (action) => Padding(
                                  padding: const EdgeInsets.only(top: 16),
                                  child: Text(
                                    action == 'clocked_in'
                                        ? '✅ Clocked In'
                                        : '✅ Clocked Out',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      color: action == 'clocked_in'
                                          ? AppColors.kSuccess
                                          : AppColors.kWarning,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                                loading: () => const SizedBox.shrink(),
                                error: (e, _) => Padding(
                                  padding: const EdgeInsets.only(top: 16),
                                  child: Text(
                                    'Error: ${e.toString()}',
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                        color: AppColors.kError),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
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
