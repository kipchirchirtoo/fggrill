import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../domain/auth_notifier.dart';
import '../domain/role_routes.dart';

final _terminalPinProvider = StateProvider.autoDispose<String>((ref) => '');
final _terminalLoadingProvider =
    StateProvider.autoDispose<bool>((ref) => false);
final _terminalClockProvider = StreamProvider.autoDispose<DateTime>((ref) {
  return Stream.periodic(const Duration(seconds: 1), (_) => DateTime.now())
      .startWith(DateTime.now());
});

class TerminalScreen extends ConsumerWidget {
  const TerminalScreen({super.key});

  static const _minPinLength = 5;
  static const _maxPinLength = 5;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pin = ref.watch(_terminalPinProvider);
    final isLoading = ref.watch(_terminalLoadingProvider);
    final now = ref.watch(_terminalClockProvider).valueOrNull ?? DateTime.now();

    return KeyboardListener(
      focusNode: FocusNode()..requestFocus(),
      autofocus: true,
      onKeyEvent: (event) {
        if (event is! KeyDownEvent || isLoading) return;
        final key = event.character?.toUpperCase();
        if (key != null && RegExp(r'^[0-9RMENC]$').hasMatch(key)) {
          _appendPin(ref, key, context);
        } else if (event.logicalKey == LogicalKeyboardKey.backspace) {
          _deletePin(ref);
        } else if (event.logicalKey == LogicalKeyboardKey.enter) {
          _login(context, ref);
        }
      },
      child: Scaffold(
        body: Stack(
          fit: StackFit.expand,
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    const Color(0xFF111827),
                    const Color(0xFF1A3C5E),
                    Colors.black.withValues(alpha: 0.92),
                  ],
                ),
              ),
            ),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    const _TopBar(),
                    const Spacer(),
                    _BrandClock(now: now),
                    const SizedBox(height: 24),
                    _PinDots(pinLength: pin.length, isLoading: isLoading),
                    const SizedBox(height: 22),
                    _PinPad(
                      onKey: (value) => _appendPin(ref, value, context),
                      onDelete: () => _deletePin(ref),
                      onStaff: () => context.go('/hr-terminal'),
                      disabled: isLoading,
                    ),
                    const SizedBox(height: 18),
                    const Opacity(
                      opacity: 0.42,
                      child: Column(
                        children: [
                          Text(
                            'FAMOUS GATES HOTELS',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 10,
                              letterSpacing: 4,
                            ),
                          ),
                          SizedBox(height: 6),
                          Text(
                            'HIRALL SYSTEMS',
                            style: TextStyle(
                              color: Colors.white70,
                              fontFamily: 'monospace',
                              fontSize: 9,
                              letterSpacing: 3,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static void _appendPin(WidgetRef ref, String value, BuildContext context) {
    final pin = ref.read(_terminalPinProvider);
    final loading = ref.read(_terminalLoadingProvider);
    if (loading) return;

    final isPrefix = RegExp(r'^[RMENC]$').hasMatch(value);
    final isDigit = RegExp(r'^\d$').hasMatch(value);
    if (!isPrefix && !isDigit) return;

    String next;
    if (isPrefix) {
      final existingDigits = pin.length > 1 ? pin.substring(1) : '';
      next = '$value$existingDigits';
    } else {
      if (pin.isEmpty) {
        AppNotifier.showSnackBar(
          context,
          const SnackBar(content: Text('Select the POS station first.')),
        );
        return;
      }
      if (pin.length >= _maxPinLength) return;
      next = '$pin$value';
    }

    ref.read(_terminalPinProvider.notifier).state = next;
    if (next.length == _maxPinLength) {
      unawaited(_login(context, ref));
    }
  }

  static void _deletePin(WidgetRef ref) {
    final pin = ref.read(_terminalPinProvider);
    if (pin.isEmpty || ref.read(_terminalLoadingProvider)) return;
    ref.read(_terminalPinProvider.notifier).state =
        pin.substring(0, pin.length - 1);
  }

  static Future<void> _login(BuildContext context, WidgetRef ref) async {
    if (!context.mounted) return;
    final pin = ref.read(_terminalPinProvider);
    if (pin.length < _minPinLength) {
      AppNotifier.showSnackBar(
        context,
        const SnackBar(content: Text('Enter your POS PIN.')),
      );
      return;
    }

    ref.read(_terminalLoadingProvider.notifier).state = true;
    try {
      final user = await ref.read(authNotifierProvider.notifier).posLogin(pin);
      final route = _routeForPosUser(user.outletType, user.role, pin);
      debugPrint(
          'Terminal login role=${user.role} outlet=${user.outletType} route=$route');
      if (context.mounted) {
        ref.read(_terminalPinProvider.notifier).state = '';
        context.go(route);
      }
    } catch (error) {
      if (context.mounted) {
        ref.read(_terminalPinProvider.notifier).state = '';
        AppNotifier.showSnackBar(
          context,
          SnackBar(content: Text('$error')),
        );
      }
    } finally {
      if (context.mounted) {
        ref.read(_terminalLoadingProvider.notifier).state = false;
      }
    }
  }

  static String _routeForPosUser(String? outletType, String role, String pin) {
    switch (pin.substring(0, 1).toUpperCase()) {
      case 'R':
        return '/pos/restaurant';
      case 'M':
        return '/pos/main-bar';
      case 'E':
        return '/pos/executive-bar';
      case 'N':
        return '/pos/non-consumables';
      case 'C':
        return '/cashier';
    }
    switch (outletType) {
      case 'restaurant':
        return '/pos/restaurant';
      case 'main_bar':
        return '/pos/main-bar';
      case 'executive_bar':
        return '/pos/executive-bar';
      case 'non_consumables':
        return '/pos/non-consumables';
      case 'cashier':
        return '/cashier';
      case 'kyogong_reception':
        return '/pos/kyogong-reception';
      case 'kyogong_spa':
        return '/pos/kyogong-spa';
      case 'kyogong_executive_bar':
        return '/pos/kyogong-executive-bar';
      case 'kyogong_sports_bar':
        return '/pos/kyogong-sports-bar';
      default:
        return getRoleRoute(role);
    }
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: const Color(0xFFD4A843),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Center(
            child: Text(
              'FG',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: 13,
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        const Text(
          'Famous Gates Terminal',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
        ),
        const Spacer(),
        TextButton.icon(
          onPressed: () => context.go('/login'),
          icon: const Icon(Icons.arrow_forward, size: 16),
          label: const Text('Backoffice'),
          style: TextButton.styleFrom(foregroundColor: Colors.white70),
        ),
      ],
    );
  }
}

class _BrandClock extends StatelessWidget {
  const _BrandClock({required this.now});

  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final time = TimeOfDay.fromDateTime(now).format(context);
    final date =
        '${_weekday(now.weekday)}, ${_month(now.month)} ${now.day.toString().padLeft(2, '0')}';
    return Column(
      children: [
        Text(
          time,
          style: const TextStyle(
            color: Colors.white,
            fontFamily: 'SF Pro Display',
            fontSize: 58,
            fontWeight: FontWeight.w800,
            height: 1,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          date,
          style: const TextStyle(
            color: Colors.white54,
            fontWeight: FontWeight.w700,
            fontSize: 12,
            letterSpacing: 1.4,
          ),
        ),
      ],
    );
  }

  static String _weekday(int value) {
    return const [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday'
    ][value - 1];
  }

  static String _month(int value) {
    return const [
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
    ][value - 1];
  }
}

class _PinDots extends StatelessWidget {
  const _PinDots({required this.pinLength, required this.isLoading});

  final int pinLength;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(PhosphorIcons.shieldCheck(), size: 16, color: Colors.white38),
            const SizedBox(width: 8),
            const Text(
              'ENTER PIN',
              style: TextStyle(
                color: Colors.white38,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 2.4,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(TerminalScreen._maxPinLength, (index) {
            final active = pinLength > index;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              margin: const EdgeInsets.symmetric(horizontal: 6),
              width: active ? 15 : 13,
              height: active ? 15 : 13,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: active
                    ? Colors.white
                    : Colors.white.withValues(alpha: 0.16),
                border: Border.all(color: Colors.white24),
              ),
            );
          }),
        ),
        SizedBox(
          height: 28,
          child: AnimatedOpacity(
            duration: const Duration(milliseconds: 120),
            opacity: isLoading ? 1 : 0,
            child: const Padding(
              padding: EdgeInsets.only(top: 12),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white70,
                    ),
                  ),
                  SizedBox(width: 10),
                  Text(
                    'Authenticating...',
                    style: TextStyle(color: Colors.white60),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _PinPad extends StatelessWidget {
  const _PinPad({
    required this.onKey,
    required this.onDelete,
    required this.onStaff,
    required this.disabled,
  });

  final ValueChanged<String> onKey;
  final VoidCallback onDelete;
  final VoidCallback onStaff;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 620),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.22),
              blurRadius: 28,
              offset: const Offset(0, 18),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              flex: 8,
              child: _StationPrefixPad(onKey: onKey, disabled: disabled),
            ),
            Container(
              width: 1,
              height: 246,
              margin: const EdgeInsets.symmetric(horizontal: 14),
              color: Colors.white.withValues(alpha: 0.08),
            ),
            Expanded(
              flex: 9,
              child: _NumberPad(
                onKey: onKey,
                onDelete: onDelete,
                onStaff: onStaff,
                disabled: disabled,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StationPrefixPad extends StatelessWidget {
  const _StationPrefixPad({required this.onKey, required this.disabled});

  final ValueChanged<String> onKey;
  final bool disabled;

  static const _stations = [
    _StationKey('R', 'Restaurant', Colors.orangeAccent),
    _StationKey('M', 'Main Bar', Colors.indigoAccent),
    _StationKey('E', 'Executive Bar', Colors.purpleAccent),
    _StationKey('N', 'Non-consumables', Colors.lightBlueAccent),
    _StationKey('C', 'Cashier Station', Colors.greenAccent),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const _PadSectionTitle('Station'),
        const SizedBox(height: 10),
        for (final station in _stations) ...[
          _StationButton(
            station: station,
            disabled: disabled,
            onTap: () => onKey(station.prefix),
          ),
          if (station != _stations.last) const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _NumberPad extends StatelessWidget {
  const _NumberPad({
    required this.onKey,
    required this.onDelete,
    required this.onStaff,
    required this.disabled,
  });

  final ValueChanged<String> onKey;
  final VoidCallback onDelete;
  final VoidCallback onStaff;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final keys = <Widget>[
      for (final number in [1, 2, 3, 4, 5, 6, 7, 8, 9])
        _PadButton(
          label: '$number',
          onTap: () => onKey('$number'),
          disabled: disabled,
        ),
      _PadButton(
        label: 'Staff',
        compact: true,
        onTap: onStaff,
        disabled: disabled,
      ),
      _PadButton(label: '0', onTap: () => onKey('0'), disabled: disabled),
      _PadButton(
        icon: Icons.backspace_outlined,
        onTap: onDelete,
        disabled: disabled,
      ),
    ];

    return Column(
      children: [
        const _PadSectionTitle('PIN'),
        const SizedBox(height: 10),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 3,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 1.55,
          children: keys,
        ),
      ],
    );
  }
}

class _PadSectionTitle extends StatelessWidget {
  const _PadSectionTitle(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Text(
        label.toUpperCase(),
        style: const TextStyle(
          color: Colors.white54,
          fontSize: 10,
          fontWeight: FontWeight.w900,
          letterSpacing: 2,
        ),
      ),
    );
  }
}

class _StationButton extends StatelessWidget {
  const _StationButton({
    required this.station,
    required this.onTap,
    required this.disabled,
  });

  final _StationKey station;
  final VoidCallback onTap;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: disabled ? null : onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          height: 42,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
          ),
          child: Row(
            children: [
              SizedBox(
                width: 34,
                child: Text(
                  station.prefix,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: station.color,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    height: 1,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  station.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StationKey {
  const _StationKey(this.prefix, this.label, this.color);

  final String prefix;
  final String label;
  final Color color;
}

class _PadButton extends StatelessWidget {
  const _PadButton({
    this.label,
    this.icon,
    this.compact = false,
    required this.onTap,
    required this.disabled,
  });

  final String? label;
  final IconData? icon;
  final bool compact;
  final VoidCallback onTap;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: disabled ? null : onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
          ),
          child: Center(
            child: icon != null
                ? Icon(icon, color: Colors.white54, size: 28)
                : Text(
                    label!,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: compact ? 12 : 28,
                      fontWeight: compact ? FontWeight.w800 : FontWeight.w400,
                      letterSpacing: compact ? 1.2 : 0,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

extension _StartWith<T> on Stream<T> {
  Stream<T> startWith(T value) async* {
    yield value;
    yield* this;
  }
}
