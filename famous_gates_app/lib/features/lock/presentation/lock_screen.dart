import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';

const _storage = FlutterSecureStorage();
const _pinStorageKey = 'fg_lock_pin';

final _pinProvider = StateProvider<String>((ref) => '');
final _errorProvider = StateProvider<String?>((ref) => null);
final _storedPinProvider = FutureProvider<String>((ref) async {
  return await _storage.read(key: _pinStorageKey) ?? '';
});

/// Call this from SettingsScreen to update the lock PIN.
Future<void> setLockPin(String newPin) async {
  await _storage.write(key: _pinStorageKey, value: newPin);
}

class LockScreen extends ConsumerWidget {
  const LockScreen({super.key});

  void _onDigit(
      WidgetRef ref, String digit, BuildContext context, String correctPin) {
    final current = ref.read(_pinProvider);
    if (current.length >= 5) return;
    final nextPin = current + digit;
    ref.read(_pinProvider.notifier).state = nextPin;
    ref.read(_errorProvider.notifier).state = null;
    if (nextPin.length == 5) {
      if (nextPin.toUpperCase() == correctPin.toUpperCase()) {
        ref.read(_pinProvider.notifier).state = '';
        context.pop();
      } else {
        ref.read(_pinProvider.notifier).state = '';
        ref.read(_errorProvider.notifier).state = 'Incorrect PIN. Try again.';
      }
    }
  }

  void _onDelete(WidgetRef ref) {
    final current = ref.read(_pinProvider);
    if (current.isEmpty) return;
    ref.read(_pinProvider.notifier).state =
        current.substring(0, current.length - 1);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pin = ref.watch(_pinProvider);
    final error = ref.watch(_errorProvider);
    final storedPinAsync = ref.watch(_storedPinProvider);
    final correctPin = storedPinAsync.valueOrNull ?? '';

    if (storedPinAsync.hasValue && (correctPin.isEmpty)) {
      Future.microtask(() {
        if (context.mounted) context.pop();
      });
      return const SizedBox.shrink();
    }

    return Scaffold(
      backgroundColor: AppColors.kPrimary,
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(PhosphorIcons.lock(), size: 64, color: AppColors.kAccent),
              const SizedBox(height: 24),
              Text(
                'Screen Locked',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                'Enter PIN to unlock',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Colors.white70,
                    ),
              ),
              const SizedBox(height: 32),
              if (error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Text(error,
                      style: const TextStyle(color: AppColors.kError)),
                ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (i) {
                  final filled = i < pin.length;
                  return Container(
                    margin: const EdgeInsets.symmetric(horizontal: 8),
                    width: 16,
                    height: 16,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: filled ? AppColors.kAccent : Colors.white24,
                    ),
                  );
                }),
              ),
              const SizedBox(height: 48),
              _buildKeypad(context, ref, correctPin),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildKeypad(BuildContext context, WidgetRef ref, String correctPin) {
    return Column(
      children: [
        // Prefix Letter Row (Restaurant, Main Bar, Executive Bar, Non Consumables, Cashier)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: ['R', 'M', 'N', 'C', 'E'].map((letter) {
              return _KeyButton(
                label: letter,
                onTap: () => _onDigit(ref, letter, context, correctPin),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 8),
        for (var row = 0; row < 3; row++)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(3, (col) {
                final digit = (row * 3 + col + 1).toString();
                return _KeyButton(
                  label: digit,
                  onTap: () => _onDigit(ref, digit, context, correctPin),
                );
              }),
            ),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const SizedBox(width: 80),
              _KeyButton(
                label: '0',
                onTap: () => _onDigit(ref, '0', context, correctPin),
              ),
              _KeyButton(
                label: '⌫',
                onTap: () => _onDelete(ref),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _KeyButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _KeyButton({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 8),
      child: Material(
        color: Colors.white12,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: SizedBox(
            width: 72,
            height: 72,
            child: Center(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
