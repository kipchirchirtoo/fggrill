import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/mobile_shell.dart';
import '../../../../core/widgets/adaptive_stat_grid.dart';
import '../../data/repository.dart';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

final _activeDispatchesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(driverRepositoryProvider).getActiveDispatches();
});

final _readyDispatchesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(driverRepositoryProvider).getReadyDispatches();
});

final _vehiclesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(driverRepositoryProvider).getVehicles();
});

final _dispatchHistoryProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(driverRepositoryProvider).getDispatchHistory();
});

// ---------------------------------------------------------------------------
// Root screen
// ---------------------------------------------------------------------------

class MobileDriverScreen extends ConsumerWidget {
  const MobileDriverScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MobileShell(
      title: 'Driver Hub',
      tabs: const [
        MobileTab(
          label: 'Active Trip',
          icon: Icons.local_shipping_outlined,
          activeIcon: Icons.local_shipping,
          body: _ActiveTripTab(),
        ),
        MobileTab(
          label: 'Pending',
          icon: Icons.pending_outlined,
          activeIcon: Icons.pending,
          body: _PendingTab(),
        ),
        MobileTab(
          label: 'My Vehicle',
          icon: Icons.directions_car_outlined,
          activeIcon: Icons.directions_car,
          body: _VehicleTab(),
        ),
        MobileTab(
          label: 'History',
          icon: Icons.history,
          activeIcon: Icons.history,
          body: _HistoryTab(),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 1 — Active Trip
// ---------------------------------------------------------------------------

class _ActiveTripTab extends ConsumerWidget {
  const _ActiveTripTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_activeDispatchesProvider);
    return async.when(
      loading: () => const MobileLoadingView(message: 'Loading active trip…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load trip',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_activeDispatchesProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (dispatches) {
        if (dispatches.isEmpty) {
          return const MobileEmptyState(
            icon: Icons.local_shipping_outlined,
            title: 'No active delivery',
            subtitle: 'You have no dispatch currently in transit.',
          );
        }
        final dispatch = dispatches.first;
        return MobileTabBody(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _DispatchCard(dispatch: dispatch),
              const SizedBox(height: 20),
              _OtpVerifyCard(dispatch: dispatch),
            ],
          ),
        );
      },
    );
  }
}

class _DispatchCard extends StatelessWidget {
  const _DispatchCard({required this.dispatch});

  final Map<String, dynamic> dispatch;

  @override
  Widget build(BuildContext context) {
    final number = dispatch['dispatch_number'] ?? dispatch['id'] ?? '—';
    final destination =
        dispatch['to_branch'] ?? dispatch['destination_branch'] ?? '—';
    final address = dispatch['destination_address'] ?? dispatch['address'] ?? '';
    final items = dispatch['dispatch_items'] as List? ?? [];
    final itemCount = dispatch['items_count'] ?? items.length;
    final estimatedDelivery =
        dispatch['estimated_delivery'] ?? dispatch['delivery_date'] ?? '';
    final status = (dispatch['status'] ?? '').toString().toUpperCase();

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.kPrimary, AppColors.kPrimary.withOpacity(0.85)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.kPrimary.withOpacity(0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.local_shipping, color: Colors.white, size: 22),
              const SizedBox(width: 8),
              Text(
                'Dispatch $number',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  fontFamily: 'SF Pro Display',
                ),
              ),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.kAccent,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  status,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _InfoRow(icon: Icons.place, label: 'To', value: destination.toString()),
          if (address.isNotEmpty)
            _InfoRow(icon: Icons.map_outlined, label: 'Address', value: address.toString()),
          _InfoRow(
              icon: Icons.inventory_2_outlined,
              label: 'Items',
              value: '$itemCount item(s)'),
          if (estimatedDelivery.isNotEmpty)
            _InfoRow(
                icon: Icons.schedule,
                label: 'ETA',
                value: estimatedDelivery.toString()),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(
      {required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        children: [
          Icon(icon, color: Colors.white70, size: 15),
          const SizedBox(width: 6),
          Text(
            '$label: ',
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 12,
              fontFamily: 'SF Pro Display',
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                fontFamily: 'SF Pro Display',
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _OtpVerifyCard extends ConsumerStatefulWidget {
  const _OtpVerifyCard({required this.dispatch});

  final Map<String, dynamic> dispatch;

  @override
  ConsumerState<_OtpVerifyCard> createState() => _OtpVerifyCardState();
}

class _OtpVerifyCardState extends ConsumerState<_OtpVerifyCard> {
  final _otpController = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final otp = _otpController.text.trim().toUpperCase();
    if (otp.isEmpty) {
      setState(() => _error = 'Enter the D-XXXX OTP code');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final id = '${widget.dispatch['id'] ?? widget.dispatch['dispatch_id']}';
      await ref.read(driverRepositoryProvider).verifyDriverOtp(id, otp);
      ref.invalidate(_activeDispatchesProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('OTP verified — trip marked IN_TRANSIT'),
            backgroundColor: AppColors.kSuccess,
          ),
        );
        _otpController.clear();
      }
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.kCardBg,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.pin, color: AppColors.kAccent, size: 20),
              SizedBox(width: 8),
              Text(
                'Verify Driver OTP',
                style: TextStyle(
                  color: AppColors.kTextPrimary,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  fontFamily: 'SF Pro Display',
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Enter the D-XXXX code to confirm goods pickup and start your trip.',
            style: TextStyle(
              color: AppColors.kTextSecondary,
              fontSize: 12,
              fontFamily: 'SF Pro Display',
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _otpController,
            textCapitalization: TextCapitalization.characters,
            style: const TextStyle(
              letterSpacing: 4,
              fontSize: 18,
              fontWeight: FontWeight.bold,
              fontFamily: 'SF Pro Display',
            ),
            decoration: InputDecoration(
              hintText: 'D-XXXX',
              hintStyle: const TextStyle(
                letterSpacing: 2,
                color: AppColors.kTextSecondary,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: AppColors.kPrimary, width: 2),
              ),
              errorText: _error,
              suffixIcon: const Icon(Icons.lock_outlined),
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _loading ? null : _verify,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kPrimary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              icon: _loading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.verified_outlined),
              label: Text(_loading ? 'Verifying…' : 'Verify & Start Trip'),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 2 — Pending Dispatches
// ---------------------------------------------------------------------------

class _PendingTab extends ConsumerWidget {
  const _PendingTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_readyDispatchesProvider);
    return async.when(
      loading: () => const MobileLoadingView(message: 'Loading dispatches…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load dispatches',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_readyDispatchesProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (dispatches) {
        if (dispatches.isEmpty) {
          return const MobileEmptyState(
            icon: Icons.pending_outlined,
            title: 'No pending dispatches',
            subtitle: 'You have no dispatches awaiting pickup.',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: dispatches.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, i) {
            final d = dispatches[i];
            return _DispatchListTile(dispatch: d);
          },
        );
      },
    );
  }
}

class _DispatchListTile extends StatelessWidget {
  const _DispatchListTile({required this.dispatch});

  final Map<String, dynamic> dispatch;

  @override
  Widget build(BuildContext context) {
    final number = dispatch['dispatch_number'] ?? dispatch['id'] ?? '—';
    final destination =
        dispatch['to_branch'] ?? dispatch['destination_branch'] ?? '—';
    final driver = dispatch['driver_name'] ?? dispatch['assigned_driver'] ?? '';
    final vehicle = dispatch['vehicle'] ?? dispatch['vehicle_reg'] ?? '';
    final items = dispatch['dispatch_items'] as List? ?? [];
    final itemCount = dispatch['items_count'] ?? items.length;
    final status = (dispatch['status'] ?? 'READY').toString().toUpperCase();

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.kCardBg,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.kWarning.withOpacity(0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child:
                const Icon(Icons.pending, color: AppColors.kWarning, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Dispatch $number',
                  style: const TextStyle(
                    color: AppColors.kTextPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
                Text(
                  'To: $destination',
                  style: const TextStyle(
                    color: AppColors.kTextSecondary,
                    fontSize: 12,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
                if (vehicle.isNotEmpty)
                  Text(
                    'Vehicle: $vehicle',
                    style: const TextStyle(
                      color: AppColors.kTextSecondary,
                      fontSize: 11,
                      fontFamily: 'SF Pro Display',
                    ),
                  ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.kWarning.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  status,
                  style: const TextStyle(
                    color: AppColors.kWarning,
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '$itemCount item(s)',
                style: const TextStyle(
                  color: AppColors.kTextSecondary,
                  fontSize: 11,
                  fontFamily: 'SF Pro Display',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 3 — My Vehicle
// ---------------------------------------------------------------------------

class _VehicleTab extends ConsumerWidget {
  const _VehicleTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_vehiclesProvider);
    return async.when(
      loading: () => const MobileLoadingView(message: 'Loading vehicle…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load vehicle',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_vehiclesProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (vehicles) {
        if (vehicles.isEmpty) {
          return const MobileEmptyState(
            icon: Icons.directions_car_outlined,
            title: 'No vehicle assigned',
            subtitle: 'You have no vehicle currently assigned.',
          );
        }
        final v = vehicles.first;
        return MobileTabBody(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _VehicleCard(vehicle: v),
              const SizedBox(height: 16),
              _buildStatGrid(vehicles),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStatGrid(List<Map<String, dynamic>> vehicles) {
    if (vehicles.isEmpty) return const SizedBox.shrink();
    final v = vehicles.first;
    // AdaptiveStatGrid (skill: flutter-build-responsive-layout)
    return AdaptiveStatGrid(
      stats: [
        statDef(label: 'Total Trips', value: '${v['total_trips'] ?? 0}',
            icon: Icons.route, color: AppColors.kPrimary),
        statDef(label: 'Mileage',
            value: '${v['current_mileage'] ?? v['mileage'] ?? 0} km',
            icon: Icons.speed, color: AppColors.kAccent),
      ],
    );
  }
}

class _VehicleCard extends StatelessWidget {
  const _VehicleCard({required this.vehicle});

  final Map<String, dynamic> vehicle;

  @override
  Widget build(BuildContext context) {
    final reg = vehicle['registration_number'] ?? vehicle['reg_number'] ?? '—';
    final make = vehicle['make'] ?? '—';
    final model = vehicle['model'] ?? '—';
    final type = vehicle['type'] ?? vehicle['vehicle_type'] ?? '—';
    final status = (vehicle['status'] ?? 'ACTIVE').toString().toUpperCase();

    final isActive = status == 'ACTIVE' || status == 'IN_USE';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.kCardBg,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppColors.kPrimary.withOpacity(0.08),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.local_shipping,
                color: AppColors.kPrimary, size: 36),
          ),
          const SizedBox(height: 14),
          Text(
            reg,
            style: const TextStyle(
              color: AppColors.kTextPrimary,
              fontSize: 22,
              fontWeight: FontWeight.w800,
              fontFamily: 'SF Pro Display',
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '$make $model',
            style: const TextStyle(
              color: AppColors.kTextSecondary,
              fontSize: 14,
              fontFamily: 'SF Pro Display',
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _Chip(label: type.toString(), color: AppColors.kPrimary),
              const SizedBox(width: 8),
              _Chip(
                label: status,
                color: isActive ? AppColors.kSuccess : AppColors.kWarning,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w600,
          fontFamily: 'SF Pro Display',
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 4 — Trip History
// ---------------------------------------------------------------------------

class _HistoryTab extends ConsumerWidget {
  const _HistoryTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_dispatchHistoryProvider);
    return async.when(
      loading: () => const MobileLoadingView(message: 'Loading history…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load history',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_dispatchHistoryProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (dispatches) {
        if (dispatches.isEmpty) {
          return const MobileEmptyState(
            icon: Icons.history,
            title: 'No delivery history',
            subtitle: 'Completed deliveries will appear here.',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: dispatches.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, i) {
            final d = dispatches[i];
            return _HistoryTile(dispatch: d);
          },
        );
      },
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.dispatch});

  final Map<String, dynamic> dispatch;

  @override
  Widget build(BuildContext context) {
    final number = dispatch['dispatch_number'] ?? dispatch['id'] ?? '—';
    final destination =
        dispatch['to_branch'] ?? dispatch['destination_branch'] ?? '—';
    final deliveredAt = dispatch['delivered_at'] ??
        dispatch['updated_at'] ??
        dispatch['confirmed_at'] ??
        '';
    final items = dispatch['dispatch_items'] as List? ?? [];
    final itemCount = dispatch['items_count'] ?? items.length;

    String dateDisplay = '';
    if (deliveredAt.isNotEmpty) {
      try {
        final dt = DateTime.parse(deliveredAt.toString());
        dateDisplay =
            '${dt.day}/${dt.month}/${dt.year}';
      } catch (_) {
        dateDisplay = deliveredAt.toString();
      }
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.kCardBg,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.kSuccess.withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.check_circle_outline,
                color: AppColors.kSuccess, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Dispatch $number',
                  style: const TextStyle(
                    color: AppColors.kTextPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
                Text(
                  destination.toString(),
                  style: const TextStyle(
                    color: AppColors.kTextSecondary,
                    fontSize: 12,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                dateDisplay,
                style: const TextStyle(
                  color: AppColors.kTextSecondary,
                  fontSize: 11,
                  fontFamily: 'SF Pro Display',
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '$itemCount item(s)',
                style: const TextStyle(
                  color: AppColors.kSuccess,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  fontFamily: 'SF Pro Display',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
