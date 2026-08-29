import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import 'package:famous_gates_app/core/widgets/safe_asset_image.dart';
import '../domain/auth_notifier.dart';
import '../domain/models.dart';
import '../domain/role_routes.dart';

final _terminalPinProvider = StateProvider.autoDispose<String>((ref) => '');
final _terminalLoadingProvider =
    StateProvider.autoDispose<bool>((ref) => false);
final _terminalClockProvider = StreamProvider.autoDispose<DateTime>((ref) {
  return Stream.periodic(const Duration(seconds: 1), (_) => DateTime.now())
      .startWith(DateTime.now());
});

final _terminalFocusNodeProvider = Provider.autoDispose<FocusNode>((ref) {
  final node = FocusNode();
  ref.onDispose(() => node.dispose());
  return node;
});

const _kGold = Color(0xFFD4A843);

class TerminalScreen extends ConsumerWidget {
  const TerminalScreen({super.key});

  static const _minPinLength = 5;
  static const _maxPinLength = 5;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pin = ref.watch(_terminalPinProvider);
    final isLoading = ref.watch(_terminalLoadingProvider);
    final now = ref.watch(_terminalClockProvider).valueOrNull ?? DateTime.now();
    final selectedPrefix = pin.isNotEmpty ? pin[0] : null;

    final focusNode = ref.watch(_terminalFocusNodeProvider);

    return KeyboardListener(
      focusNode: focusNode,
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
        backgroundColor: const Color(0xFF070B16),
        body: Stack(
          fit: StackFit.expand,
          children: [
            // 0 — Deep dark luxury base layer (guarantees no white background under any condition)
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFF060B18),
                    Color(0xFF0D1B2A),
                    Color(0xFF050811),
                  ],
                ),
              ),
            ),
            // 1 — Background photo
            const SafeAssetImage(
              'assets/frontend_public/IMG_8704.JPG',
              fit: BoxFit.cover,
            ),
            // 2 — Dark gradient overlay
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.80),
                    Colors.black.withValues(alpha: 0.55),
                    Colors.black.withValues(alpha: 0.82),
                  ],
                  stops: const [0.0, 0.5, 1.0],
                ),
              ),
            ),
            // 5 — BACKOFFICE button pinned to true top-right edge (outside the 24px padding)
            const Positioned(
              top: 0,
              right: 0,
              child: SafeArea(
                child: Padding(
                  padding: EdgeInsets.only(top: 18),
                  child: _BackOfficeButton(),
                ),
              ),
            ),
            // Terminal registration entry (installers) — discreet, top-left.
            Positioned(
              top: 0,
              left: 0,
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.only(top: 18, left: 8),
                  child: TextButton.icon(
                    onPressed: () => context.go('/terminal-setup'),
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.white70,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                    ),
                    icon: const Icon(Icons.point_of_sale, size: 14),
                    label: const Text('SETUP',
                        style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.2)),
                  ),
                ),
              ),
            ),
            // 4 — UI content
            SafeArea(
              child: Padding(
                padding:
                    const EdgeInsets.only(left: 24, right: 24, top: 18, bottom: 8),
                child: Column(
                  children: [
                    const SizedBox(
                      width: double.infinity,
                      child: _TopBarLogo(),
                    ),
                    Expanded(
                      child: LayoutBuilder(
                        builder: (context, constraints) =>
                            SingleChildScrollView(
                          physics: const ClampingScrollPhysics(),
                          child: ConstrainedBox(
                            constraints: BoxConstraints(
                                minHeight: constraints.maxHeight),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                _BrandClock(now: now),
                                const SizedBox(height: 8),
                                _PinDots(
                                    pinLength: pin.length,
                                    isLoading: isLoading),
                                const SizedBox(height: 8),
                                _PinPad(
                                  selectedPrefix: selectedPrefix,
                                  onKey: (v) => _appendPin(ref, v, context),
                                  onDelete: () => _deletePin(ref),
                                  onStaff: () => context.go('/hr-terminal'),
                                  disabled: isLoading,
                                ),
                                const SizedBox(height: 8),
                                const _FooterBranding(),
                              ],
                            ),
                          ),
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

  static void _appendPin(WidgetRef ref, String value, BuildContext context) {
    final pin = ref.read(_terminalPinProvider);
    if (ref.read(_terminalLoadingProvider)) return;

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
      final route = _routeForPosUser(user, pin);
      debugPrint(
          'Terminal login role=${user.role} outlet=${user.outletType} route=$route');
      if (context.mounted) {
        ref.read(_terminalPinProvider.notifier).state = '';
        context.go(route);
      }
    } catch (error) {
      if (context.mounted) {
        ref.read(_terminalPinProvider.notifier).state = '';
        AppNotifier.showSnackBar(context, SnackBar(content: Text('$error')));
      }
    } finally {
      if (context.mounted) {
        ref.read(_terminalLoadingProvider.notifier).state = false;
      }
    }
  }

  static String _routeForPosUser(User user, String pin) {
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
    switch (user.outletType) {
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
        return getUserHomeRoute(user);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Top bar
// ─────────────────────────────────────────────────────────────────────────────

// Logo + title only — BACKOFFICE button is a separate Positioned widget at the
// true screen edge, outside the 24px horizontal padding.
class _TopBarLogo extends StatelessWidget {
  const _TopBarLogo();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        // FG logo badge — white pill so logo reads on dark overlay
        Container(
          width: 42,
          height: 42,
          padding: const EdgeInsets.all(5),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(11),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.30),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: const SafeAssetImage(
            'assets/frontend_public/fglogo.png',
            fit: BoxFit.contain,
          ),
        ),
        const SizedBox(width: 12),
        const Flexible(
          child: Text(
            'Famous Gates Terminal',
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
              fontSize: 14,
              letterSpacing: 0.2,
            ),
          ),
        ),
      ],
    );
  }
}

class _BackOfficeButton extends StatelessWidget {
  const _BackOfficeButton();

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: () => context.go('/login'),
      style: TextButton.styleFrom(
        foregroundColor: Colors.white,
        backgroundColor: Colors.white.withValues(alpha: 0.10),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: Colors.white.withValues(alpha: 0.28)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('BACKOFFICE',
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.5)),
          SizedBox(width: 5),
          Icon(Icons.arrow_forward_rounded, size: 13),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Clock
// ─────────────────────────────────────────────────────────────────────────────

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
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            time,
            style: const TextStyle(
              color: Colors.white,
              fontFamily: 'SF Pro Display',
              fontSize: 62,
              fontWeight: FontWeight.w700,
              height: 1,
              letterSpacing: -1.5,
            ),
          ),
        ),
        const SizedBox(height: 8),
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            date.toUpperCase(),
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.45),
              fontWeight: FontWeight.w600,
              fontSize: 11,
              letterSpacing: 2.0,
            ),
          ),
        ),
        const SizedBox(height: 12),
        // Instruction hint
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.07),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                  color: Colors.white.withValues(alpha: 0.10), width: 1),
            ),
            child: Text(
              'Select your station  •  Enter your PIN',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.38),
                fontSize: 11,
                fontWeight: FontWeight.w500,
                letterSpacing: 0.4,
              ),
            ),
          ),
        ),
      ],
    );
  }

  static String _weekday(int v) => const [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday'
      ][v - 1];

  static String _month(int v) => const [
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
      ][v - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// PIN dots
// ─────────────────────────────────────────────────────────────────────────────

class _PinDots extends StatelessWidget {
  const _PinDots({required this.pinLength, required this.isLoading});

  final int pinLength;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(PhosphorIcons.shieldCheck(), size: 14, color: Colors.white38),
              const SizedBox(width: 7),
              const Text(
                'ENTER PIN',
                style: TextStyle(
                  color: Colors.white38,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 2.8,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: List.generate(TerminalScreen._maxPinLength, (i) {
            final active = pinLength > i;
            // FIX: always keep boxShadow with same blurRadius (never lerps to
            // negative). Only the *color* alpha transitions — safe to interpolate.
            return AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              // Do NOT use easeOutBack — it overshoots t=1 and makes
              // blurRadius go negative during BoxDecoration.lerp.
              curve: Curves.easeOut,
              margin: const EdgeInsets.symmetric(horizontal: 7),
              width: active ? 14 : 10,
              height: active ? 14 : 10,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: active ? Colors.white : Colors.transparent,
                border: Border.all(
                  color: active
                      ? Colors.white
                      : Colors.white.withValues(alpha: 0.28),
                  width: 1.5,
                ),
                // Always present, same blurRadius — avoids negative lerp
                boxShadow: [
                  BoxShadow(
                    color: active
                        ? Colors.white.withValues(alpha: 0.45)
                        : Colors.transparent,
                    blurRadius: 8.0, // constant — never changes during lerp
                  ),
                ],
              ),
            );
          }),
        ),
        SizedBox(
          height: 28,
          child: AnimatedOpacity(
            duration: const Duration(milliseconds: 150),
            opacity: isLoading ? 1 : 0,
            child: const Padding(
              padding: EdgeInsets.only(top: 10),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 13,
                    height: 13,
                    child: CircularProgressIndicator(
                        strokeWidth: 1.8, color: Colors.white60),
                  ),
                  SizedBox(width: 9),
                  Text('Authenticating…',
                      style: TextStyle(color: Colors.white54, fontSize: 12)),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PIN pad card
// ─────────────────────────────────────────────────────────────────────────────

class _PinPad extends StatelessWidget {
  const _PinPad({
    required this.selectedPrefix,
    required this.onKey,
    required this.onDelete,
    required this.onStaff,
    required this.disabled,
  });

  final String? selectedPrefix;
  final ValueChanged<String> onKey;
  final VoidCallback onDelete;
  final VoidCallback onStaff;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final screenW = MediaQuery.of(context).size.width;
    // Responsive card width: tablet ≤1024 → 560, desktop → 640. Shrink gracefully below 600.
    final cardW = screenW >= 1100
        ? 640.0
        : (screenW >= 600 ? 560.0 : screenW - 32);

    final isCompact = screenW < 580;

    // Wrap in Center + SizedBox so the card doesn't inherit the Column's
    // tight full-width constraint (which ConstrainedBox cannot shrink below).
    return Center(
      child: SizedBox(
        width: cardW,
        child: ClipRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.09),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.14),
                  width: 1,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.38),
                    blurRadius: 48,
                    offset: const Offset(0, 20),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Gold accent top line
                  Container(
                    height: 2,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [
                        Colors.transparent,
                        _kGold.withValues(alpha: 0.75),
                        Colors.transparent,
                      ]),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 16, 18, 20),
                    child: isCompact
                        ? Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _StationColumn(
                                selectedPrefix: selectedPrefix,
                                onKey: onKey,
                                disabled: disabled,
                              ),
                              const SizedBox(height: 16),
                              Container(
                                height: 1,
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      Colors.transparent,
                                      Colors.white.withValues(alpha: 0.15),
                                      Colors.transparent,
                                    ],
                                  ),
                                ),
                              ),
                              const SizedBox(height: 16),
                              _NumberColumn(
                                onKey: onKey,
                                onDelete: onDelete,
                                onStaff: onStaff,
                                disabled: disabled,
                              ),
                            ],
                          )
                        : Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Station column
                              Expanded(
                                flex: 10,
                                child: _StationColumn(
                                  selectedPrefix: selectedPrefix,
                                  onKey: onKey,
                                  disabled: disabled,
                                ),
                              ),
                              // Gradient divider
                              Container(
                                width: 1,
                                height: 290,
                                margin: const EdgeInsets.symmetric(horizontal: 16),
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                    colors: [
                                      Colors.transparent,
                                      Colors.white.withValues(alpha: 0.15),
                                      Colors.white.withValues(alpha: 0.15),
                                      Colors.transparent,
                                    ],
                                    stops: const [0, 0.1, 0.9, 1],
                                  ),
                                ),
                              ),
                              // Number pad column
                              Expanded(
                                flex: 11,
                                child: _NumberColumn(
                                  onKey: onKey,
                                  onDelete: onDelete,
                                  onStaff: onStaff,
                                  disabled: disabled,
                                ),
                              ),
                            ],
                          ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Station definitions
// ─────────────────────────────────────────────────────────────────────────────

class _Station {
  const _Station(this.prefix, this.label, this.color);
  final String prefix;
  final String label;
  final Color color;
}

const _kStations = [
  _Station('R', 'Restaurant', Color(0xFFFF9F43)),
  _Station('M', 'Main Bar', Color(0xFF748FFC)),
  _Station('E', 'Executive Bar', Color(0xFFDA77F2)),
  _Station('N', 'Non-consumables', Color(0xFF4DABF7)),
  _Station('C', 'Cashier Station', Color(0xFF69DB7C)),
];

// ─────────────────────────────────────────────────────────────────────────────
// Station column
// ─────────────────────────────────────────────────────────────────────────────

class _StationColumn extends StatelessWidget {
  const _StationColumn({
    required this.selectedPrefix,
    required this.onKey,
    required this.disabled,
  });

  final String? selectedPrefix;
  final ValueChanged<String> onKey;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _Label('STATION'),
        const SizedBox(height: 10),
        for (int i = 0; i < _kStations.length; i++) ...[
          _StationTile(
            station: _kStations[i],
            isActive: selectedPrefix == _kStations[i].prefix,
            disabled: disabled,
            onTap: () => onKey(_kStations[i].prefix),
          ),
          if (i < _kStations.length - 1) const SizedBox(height: 8),
        ],
      ],
    );
  }
}

class _StationTile extends StatelessWidget {
  const _StationTile({
    required this.station,
    required this.isActive,
    required this.onTap,
    required this.disabled,
  });

  final _Station station;
  final bool isActive;
  final VoidCallback onTap;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(14),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        height: 50,
        decoration: BoxDecoration(
          color: isActive
              ? station.color.withValues(alpha: 0.18)
              : Colors.white.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isActive
                ? station.color.withValues(alpha: 0.55)
                : Colors.white.withValues(alpha: 0.09),
            width: isActive ? 1.5 : 1.0,
          ),
          // Keep boxShadow always present (same blurRadius) — only alpha changes
          boxShadow: [
            BoxShadow(
              color: isActive
                  ? station.color.withValues(alpha: 0.28)
                  : Colors.transparent,
              blurRadius: 14.0, // constant — no negative lerp risk
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: InkWell(
          onTap: disabled ? null : onTap,
          borderRadius: BorderRadius.circular(14),
          splashColor: station.color.withValues(alpha: 0.18),
          highlightColor: station.color.withValues(alpha: 0.09),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Row(
              children: [
                // Circular colour badge
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: station.color.withValues(alpha: 0.16),
                    border: Border.all(
                      color: station.color.withValues(alpha: 0.45),
                      width: 1.5,
                    ),
                  ),
                  child: Center(
                    child: Text(
                      station.prefix,
                      style: TextStyle(
                        color: station.color,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        height: 1,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    station.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: isActive
                          ? Colors.white
                          : Colors.white.withValues(alpha: 0.78),
                      fontSize: 13,
                      fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
                    ),
                  ),
                ),
                // Checkmark when active
                AnimatedOpacity(
                  duration: const Duration(milliseconds: 200),
                  opacity: isActive ? 1.0 : 0.0,
                  child: Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: station.color.withValues(alpha: 0.18),
                      border: Border.all(
                          color: station.color.withValues(alpha: 0.50),
                          width: 1.2),
                    ),
                    child: Icon(
                      Icons.check_rounded,
                      color: station.color,
                      size: 13,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Number column
// ─────────────────────────────────────────────────────────────────────────────

class _NumberColumn extends StatelessWidget {
  const _NumberColumn({
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _Label('PIN'),
        const SizedBox(height: 10),
        GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: 3,
          crossAxisSpacing: 9,
          mainAxisSpacing: 9,
          childAspectRatio: 1.18,
          children: [
            for (final n in [1, 2, 3, 4, 5, 6, 7, 8, 9])
              _NumKey(
                  label: '$n', onTap: () => onKey('$n'), disabled: disabled),
            _NumKey(
                label: 'Staff',
                isSpecial: true,
                onTap: onStaff,
                disabled: disabled),
            _NumKey(label: '0', onTap: () => onKey('0'), disabled: disabled),
            _NumKey(
                icon: Icons.backspace_rounded,
                isDelete: true,
                onTap: onDelete,
                disabled: disabled),
          ],
        ),
        const SizedBox(height: 10),
        // Auto-submit hint
        Text(
          'Submits automatically at 5 digits',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.22),
            fontSize: 9.5,
            fontWeight: FontWeight.w500,
            letterSpacing: 0.3,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

class _NumKey extends StatefulWidget {
  const _NumKey({
    this.label,
    this.icon,
    this.isSpecial = false,
    this.isDelete = false,
    required this.onTap,
    required this.disabled,
  });

  final String? label;
  final IconData? icon;
  final bool isSpecial;
  final bool isDelete;
  final VoidCallback onTap;
  final bool disabled;

  @override
  State<_NumKey> createState() => _NumKeyState();
}

class _NumKeyState extends State<_NumKey> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final bgAlpha = widget.isDelete
        ? 0.05
        : widget.isSpecial
            ? 0.07
            : 0.12;
    final borderAlpha = widget.isDelete
        ? 0.06
        : widget.isSpecial
            ? 0.08
            : 0.14;

    return AnimatedScale(
      scale: _pressed ? 0.88 : 1.0,
      duration: const Duration(milliseconds: 80),
      curve: Curves.easeOut,
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: bgAlpha),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: Colors.white.withValues(alpha: borderAlpha),
              width: 1,
            ),
          ),
          child: InkWell(
            onTapDown:
                widget.disabled ? null : (_) => setState(() => _pressed = true),
            onTapUp: widget.disabled
                ? null
                : (_) => setState(() => _pressed = false),
            onTapCancel: () => setState(() => _pressed = false),
            onTap: widget.disabled ? null : widget.onTap,
            borderRadius: BorderRadius.circular(14),
            splashColor: Colors.white.withValues(alpha: 0.15),
            highlightColor: Colors.white.withValues(alpha: 0.08),
            child: Center(
              child: widget.icon != null
                  ? Icon(widget.icon,
                      color: Colors.white.withValues(alpha: 0.42), size: 22)
                  : Text(
                      widget.label!,
                      style: TextStyle(
                        color: widget.isSpecial
                            ? Colors.white.withValues(alpha: 0.38)
                            : Colors.white.withValues(alpha: 0.92),
                        fontSize: widget.isSpecial ? 11 : 26,
                        fontWeight: widget.isSpecial
                            ? FontWeight.w700
                            : FontWeight.w300,
                        letterSpacing: widget.isSpecial ? 1.0 : 0,
                      ),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

class _Label extends StatelessWidget {
  const _Label(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        color: Colors.white.withValues(alpha: 0.35),
        fontSize: 9.5,
        fontWeight: FontWeight.w800,
        letterSpacing: 2.5,
      ),
    );
  }
}

class _FooterBranding extends StatelessWidget {
  const _FooterBranding();

  @override
  Widget build(BuildContext context) {
    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Column(
        children: [
          Text(
            'FAMOUS GATES HOTELS',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.28),
              fontWeight: FontWeight.w800,
              fontSize: 9,
              letterSpacing: 3.5,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            'HIRALL SYSTEMS',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.16),
              fontFamily: 'monospace',
              fontSize: 8,
              letterSpacing: 3,
            ),
          ),
        ],
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
