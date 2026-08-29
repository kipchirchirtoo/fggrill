import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import 'package:famous_gates_app/core/widgets/safe_asset_image.dart';
import '../../../core/theme/app_theme.dart';
import '../domain/auth_notifier.dart';
import '../domain/role_routes.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _passwordFocus = FocusNode();
  bool _isLoading = false;
  bool _rememberMe = false;
  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    _loadRememberedEmail();
  }

  /// Pre-fill email if the user previously ticked "Remember me".
  Future<void> _loadRememberedEmail() async {
    final email =
        await ref.read(authNotifierProvider.notifier).getRememberedEmail();
    if (email != null && email.isNotEmpty && mounted) {
      setState(() {
        _emailController.text = email;
        _rememberMe = true;
      });
    }
  }

  Future<void> _login() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    if (email.isEmpty || password.isEmpty) {
      AppNotifier.showSnackBar(
        context,
        const SnackBar(content: Text('Enter email and password.')),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      final user = await ref
          .read(authNotifierProvider.notifier)
          .login(email, password, rememberMe: _rememberMe);
      final route = getUserHomeRoute(user);
      debugPrint('Backoffice login role=${user.role} route=$route');
      if (mounted) context.go(route);
    } catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(content: Text('$error')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isWide = MediaQuery.of(context).size.width > 900;
    return Scaffold(
      backgroundColor: const Color(0xFF070B16),
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (!isWide) ...[
            // Fullscreen luxury branding background for tablets, POS terminals & scaled screens
            const _BrandPanel(),
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: Container(
                    padding: const EdgeInsets.all(36),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.40),
                          blurRadius: 36,
                          offset: const Offset(0, 14),
                        ),
                      ],
                    ),
                    child: _buildFormContent(isWide: false),
                  ),
                ),
              ),
            ),
          ] else ...[
            Row(
              children: [
                // ── Left panel — branding (wide screens) ──────────────
                const Expanded(child: _BrandPanel()),

                // ── Right panel — login form ───────────────────────────────
                Expanded(
                  child: Container(
                    color: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 64),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 400),
                        child: _buildFormContent(isWide: true),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
          // ── Back button overlay (Top-Left circle) ───────────────────────
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: IconButton.filledTonal(
                tooltip: 'Back to terminal',
                onPressed: () => context.go('/terminal'),
                icon: const Icon(Icons.arrow_back),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFormContent({required bool isWide}) {
    return CallbackShortcuts(
      bindings: {
        const SingleActivator(LogicalKeyboardKey.enter): () {
          if (!_isLoading) _login();
        },
      },
      child: Focus(
        autofocus: true,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Show compact logo on narrow screens
            if (!isWide) ...[
              Container(
                width: 56,
                height: 56,
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Colors.black12),
                ),
                child: const SafeAssetImage(
                  'assets/frontend_public/fglogo.png',
                  fit: BoxFit.contain,
                ),
              ),
              const SizedBox(height: 16),
            ],
            Text(
              'Login',
              style: Theme.of(context).textTheme.displaySmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF1E293B),
                  ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Sign in to your account to continue.',
              style: TextStyle(
                color: AppColors.kTextSecondary,
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 32),
            // ── Email ──────────────────────────────
            TextField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              textInputAction: TextInputAction.next,
              onSubmitted: (_) => _passwordFocus.requestFocus(),
              decoration: InputDecoration(
                labelText: 'Email Address',
                prefixIcon: const Icon(Icons.email_outlined),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                ),
              ),
            ),
            const SizedBox(height: 16),
            // ── Password ───────────────────────────
            TextField(
              controller: _passwordController,
              focusNode: _passwordFocus,
              obscureText: _obscurePassword,
              autofillHints: const [AutofillHints.password],
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _isLoading ? null : _login(),
              decoration: InputDecoration(
                labelText: 'Password',
                prefixIcon: const Icon(Icons.lock_outline),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                ),
                suffixIcon: IconButton(
                  tooltip: _obscurePassword ? 'Show password' : 'Hide password',
                  icon: Icon(
                    _obscurePassword
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                    size: 20,
                  ),
                  onPressed: () =>
                      setState(() => _obscurePassword = !_obscurePassword),
                ),
              ),
            ),
            const SizedBox(height: 12),
            // ── Remember me ────────────────────────
            Row(
              children: [
                Checkbox(
                  value: _rememberMe,
                  activeColor: AppColors.kPrimary,
                  onChanged: (v) =>
                      setState(() => _rememberMe = v ?? false),
                ),
                GestureDetector(
                  onTap: () =>
                      setState(() => _rememberMe = !_rememberMe),
                  child: const Text(
                    'Remember me',
                    style: TextStyle(
                      color: Color(0xFF374151),
                      fontSize: 14,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            // ── Login button ───────────────────────
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _login,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1A3C5E),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  elevation: 2,
                ),
                child: _isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text(
                        'Login',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }
}

// ── Brand panel (left side) ────────────────────────────────────────────────

class _BrandPanel extends StatelessWidget {
  const _BrandPanel();

  // Restaurant interior — warm amber lighting, best composition
  static const _bgImage =
      'assets/frontend_public/fggallery/294216767_538857271357927_3834486940661836835_n.jpeg';

  // Official golden gate icon — works perfectly on dark overlays
  static const _logoImage = 'assets/frontend_public/fglogo.png';

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // ── 0. Deep dark luxury base layer ─────────────────────────────
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

        // ── 1. Background photo ──────────────────────────────────────────
        const SafeAssetImage(_bgImage, fit: BoxFit.cover),

        // ── 2. Dark gradient overlay (ensures text legibility) ───────────
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                const Color(0xFF060D18).withValues(alpha: 0.65),
                const Color(0xFF0D2137).withValues(alpha: 0.50),
                const Color(0xFF060D18).withValues(alpha: 0.75),
              ],
              stops: const [0.0, 0.50, 1.0],
            ),
          ),
        ),

        // ── 3. Content ───────────────────────────────────────────────────
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 44, vertical: 40),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Logo + brand name header
                Row(
                  children: [
                    // White pill keeps the logo readable on the dark overlay
                    Container(
                      width: 56,
                      height: 56,
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.30),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child:
                          const SafeAssetImage(_logoImage, fit: BoxFit.contain),
                    ),
                    const SizedBox(width: 14),
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'FAMOUS GATES',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 2.5,
                          ),
                        ),
                        Text(
                          'Hotels & Resort',
                          style: TextStyle(
                            color: AppColors.kAccent,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1.8,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),

                const Spacer(),

                // Central headline
                const Text(
                  'Where Every\nStay Tells a\nStory.',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 40,
                    fontWeight: FontWeight.w800,
                    height: 1.15,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 18),

                // Gold accent divider
                Container(
                  width: 52,
                  height: 3,
                  decoration: BoxDecoration(
                    color: AppColors.kAccent,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 18),

                // Subtitle
                const Text(
                  'Management Information System\n'
                  'for hospitality operations.',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 13,
                    height: 1.6,
                    letterSpacing: 0.3,
                  ),
                ),

                const Spacer(),

                // Feature highlights
                const _FeatureRow(
                  icon: Icons.hotel_outlined,
                  label: 'Full property management',
                ),
                const SizedBox(height: 10),
                const _FeatureRow(
                  icon: Icons.point_of_sale_outlined,
                  label: 'Integrated POS & billing',
                ),
                const SizedBox(height: 10),
                const _FeatureRow(
                  icon: Icons.analytics_outlined,
                  label: 'Real-time analytics & reports',
                ),

                const SizedBox(height: 36),

                // Hirall Systems branding
                Container(
                  height: 1,
                  color: Colors.white12,
                  margin: const EdgeInsets.only(bottom: 16),
                ),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        border: Border.all(
                            color: AppColors.kAccent.withValues(alpha: 0.55)),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'HIRALL',
                        style: TextStyle(
                          color: AppColors.kAccent,
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 2.5,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'Powered by Hirall Systems',
                      style: TextStyle(
                        color: Colors.white38,
                        fontSize: 11,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 30,
          height: 30,
          decoration: BoxDecoration(
            color: AppColors.kAccent.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(8),
            border:
                Border.all(color: AppColors.kAccent.withValues(alpha: 0.30)),
          ),
          child: Icon(icon, color: AppColors.kAccent, size: 16),
        ),
        const SizedBox(width: 12),
        Text(
          label,
          style: const TextStyle(
            color: Colors.white60,
            fontSize: 12.5,
            letterSpacing: 0.2,
          ),
        ),
      ],
    );
  }
}
