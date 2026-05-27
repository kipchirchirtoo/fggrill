import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../domain/providers.dart';

class DiagnosticsScreen extends ConsumerWidget {
  const DiagnosticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final apiHealthAsync = ref.watch(apiHealthProvider);
    final servicesAsync = ref.watch(servicesHealthProvider);

    return Scaffold(
      backgroundColor: AppColors.kSurface,
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Back',
          onPressed: () {
            final router = GoRouter.of(context);
            if (router.canPop()) {
              router.pop();
            } else {
              router.go('/terminal');
            }
          },
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
        ),
        title: const Text('System Diagnostics'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: () {
              ref.invalidate(apiHealthProvider);
              ref.invalidate(servicesHealthProvider);
            },
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(apiHealthProvider);
          ref.invalidate(servicesHealthProvider);
          await Future.delayed(const Duration(milliseconds: 500));
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const _SectionHeader(title: 'API Health'),
            const SizedBox(height: 8),
            apiHealthAsync.when(
              loading: () => const _LoadingCard(height: 200),
              error: (error, _) => _ErrorCard(
                  message: '$error',
                  onRetry: () => ref.invalidate(apiHealthProvider)),
              data: (health) => _ApiHealthCard(health: health),
            ),
            const SizedBox(height: 24),
            const _SectionHeader(title: 'Services'),
            const SizedBox(height: 8),
            servicesAsync.when(
              loading: () => Column(
                children: List.generate(
                    4,
                    (_) => const Padding(
                          padding: EdgeInsets.only(bottom: 10),
                          child: _LoadingCard(height: 72),
                        )),
              ),
              error: (error, _) => _ErrorCard(
                  message: '$error',
                  onRetry: () => ref.invalidate(servicesHealthProvider)),
              data: (services) => Column(
                children: services
                    .map((s) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _ServiceCard(service: s),
                        ))
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(title.toUpperCase(),
        style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            color: AppColors.kTextSecondary,
            letterSpacing: 1.2));
  }
}

class _ApiHealthCard extends StatelessWidget {
  const _ApiHealthCard({required this.health});

  final dynamic health;

  @override
  Widget build(BuildContext context) {
    final statusOk = health.status == 'OK';
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(statusOk ? Icons.check_circle : Icons.error,
                    color: statusOk ? Colors.green : AppColors.kError,
                    size: 22),
                const SizedBox(width: 10),
                const Text('Main API',
                    style:
                        TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const Spacer(),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusOk
                        ? Colors.green.withValues(alpha: 0.1)
                        : AppColors.kError.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(health.status,
                      style: TextStyle(
                          color: statusOk ? Colors.green : AppColors.kError,
                          fontWeight: FontWeight.bold,
                          fontSize: 12)),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _infoRow('Environment', health.environment),
            _infoRow('Uptime', health.uptimeFormatted),
            const SizedBox(height: 12),
            const Text('Environment Variables',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            const SizedBox(height: 6),
            ...(health.envChecks as Map<String, bool>)
                .entries
                .map((e) => Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(
                        children: [
                          Icon(e.value ? Icons.check_circle : Icons.cancel,
                              color: e.value ? Colors.green : AppColors.kError,
                              size: 14),
                          const SizedBox(width: 8),
                          Text(e.key.replaceAll('_', ' '),
                              style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.kTextSecondary)),
                        ],
                      ),
                    )),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Text('$label: ',
              style: const TextStyle(
                  color: AppColors.kTextSecondary, fontSize: 13)),
          Text(value,
              style:
                  const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
        ],
      ),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  const _ServiceCard({required this.service});

  final dynamic service;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Icon(service.isHealthy ? Icons.check_circle : Icons.error,
                color: service.isHealthy ? Colors.green : AppColors.kError,
                size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(service.name,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14)),
                  if (service.message != null)
                    Text(service.message,
                        style: const TextStyle(
                            color: AppColors.kTextSecondary, fontSize: 12)),
                ],
              ),
            ),
            if (service.responseTimeMs != null)
              Text('${service.responseTimeMs}ms',
                  style: TextStyle(
                      fontSize: 12,
                      color: service.responseTimeMs < 500
                          ? Colors.green
                          : Colors.orange)),
          ],
        ),
      ),
    );
  }
}

class _LoadingCard extends StatelessWidget {
  const _LoadingCard({this.height = 80});
  final double height;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      child: Container(
        height: height,
        padding: const EdgeInsets.all(16),
        child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            const Icon(Icons.error_outline, color: AppColors.kError, size: 36),
            const SizedBox(height: 8),
            const Text('Failed to load',
                style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(message,
                style: const TextStyle(
                    color: AppColors.kTextSecondary, fontSize: 12)),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
