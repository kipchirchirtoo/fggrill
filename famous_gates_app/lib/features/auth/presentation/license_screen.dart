import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../core/theme/app_theme.dart';
import '../domain/auth_notifier.dart';

class LicenseScreen extends ConsumerStatefulWidget {
  const LicenseScreen({super.key});

  @override
  ConsumerState<LicenseScreen> createState() => _LicenseScreenState();
}

class _LicenseScreenState extends ConsumerState<LicenseScreen> {
  final _licenseController = TextEditingController();
  final _branchController = TextEditingController();
  bool _isLoading = false;

  Future<void> _validateLicense() async {
    final license = _licenseController.text.trim();
    final branch = _branchController.text.trim();
    if (license.isEmpty || branch.isEmpty) {
      AppNotifier.showSnackBar(
        context,
        const SnackBar(content: Text('Enter license key and branch code.')),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      await ref
          .read(authNotifierProvider.notifier)
          .validateLicense(license, branch);
      if (mounted) context.go('/login');
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
    return Scaffold(
      body: Center(
        child: Container(
          constraints: const BoxConstraints(maxWidth: 400),
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Activate System',
                style: Theme.of(context).textTheme.displaySmall,
              ),
              const SizedBox(height: 8),
              const Text(
                'Enter your license key and branch code to continue.',
                style: TextStyle(color: AppColors.kTextSecondary),
              ),
              const SizedBox(height: 32),
              TextField(
                controller: _licenseController,
                decoration: const InputDecoration(
                  labelText: 'License Key',
                  hintText: 'XXXX-XXXX-XXXX-XXXX',
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _branchController,
                decoration: const InputDecoration(
                  labelText: 'Branch Code',
                  hintText: 'e.g. FGB-HQ',
                ),
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: _isLoading ? null : _validateLicense,
                child: _isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Text('Validate & Activate'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _licenseController.dispose();
    _branchController.dispose();
    super.dispose();
  }
}
