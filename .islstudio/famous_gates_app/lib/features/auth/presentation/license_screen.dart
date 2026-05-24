import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';

class LicenseScreen extends StatefulWidget {
  const LicenseScreen({super.key});

  @override
  State<LicenseScreen> createState() => _LicenseScreenState();
}

class _LicenseScreenState extends State<LicenseScreen> {
  final _licenseController = TextEditingController();
  final _branchController = TextEditingController();
  bool _isLoading = false;

  Future<void> _validateLicense() async {
    setState(() => _isLoading = true);
    // Mock API call
    await Future.delayed(const Duration(seconds: 1));
    if (mounted) {
      context.go('/login');
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
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Validate & Activate'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
