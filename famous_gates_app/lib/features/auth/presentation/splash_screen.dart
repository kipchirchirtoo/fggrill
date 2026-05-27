import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../domain/auth_notifier.dart';
import '../domain/role_routes.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    );
    _animation = CurvedAnimation(parent: _controller, curve: Curves.easeIn);
    _controller.forward();

    _checkInitialStatus();
  }

  Future<void> _checkInitialStatus() async {
    final minimumSplash = Future<void>.delayed(const Duration(seconds: 2));
    final userFuture = ref.read(authNotifierProvider.future);
    await minimumSplash;
    final user = await userFuture;
    if (!mounted) return;

    if (user != null) {
      context.go(getRoleRoute(user.role));
      return;
    }

    final hasLicense = await ref.read(hasStoredLicenseProvider.future);
    if (!mounted) return;
    context.go(hasLicense ? '/login' : '/license');
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.kPrimary,
      body: Center(
        child: FadeTransition(
          opacity: _animation,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: AppColors.kAccent,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: const Icon(Icons.hotel, size: 64, color: Colors.white),
              ),
              const SizedBox(height: 24),
              Text(
                'FAMOUS GATES',
                style: Theme.of(context).textTheme.displaySmall?.copyWith(
                      color: Colors.white,
                      letterSpacing: 4,
                    ),
              ),
              const SizedBox(height: 8),
              const Text(
                'HOTEL & RESTAURANT',
                style: TextStyle(
                  color: AppColors.kAccent,
                  fontSize: 12,
                  letterSpacing: 2,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
