import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../theme/app_theme.dart';
import '../utils/api_error_message.dart';
import 'app_notifier.dart';
import 'loading_skeleton.dart';

class ErrorState extends StatefulWidget {
  const ErrorState({
    super.key,
    required this.message,
    this.onRetry,
    this.icon,
  });

  final String message;
  final VoidCallback? onRetry;
  final IconData? icon;

  @override
  State<ErrorState> createState() => _ErrorStateState();
}

class _ErrorStateState extends State<ErrorState> {
  String? _notifiedMessage;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _notifyOnce();
  }

  @override
  void didUpdateWidget(covariant ErrorState oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.message != widget.message) {
      _notifiedMessage = null;
      _notifyOnce();
    }
  }

  void _notifyOnce() {
    if (_notifiedMessage == widget.message) return;
    _notifiedMessage = widget.message;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      AppNotifier.show(context, widget.message, isError: true);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              widget.icon ?? PhosphorIcons.warning(),
              size: 48,
              color: AppColors.kError,
            ),
            const SizedBox(height: 16),
            Text(
              widget.message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 16,
                color: AppColors.kTextSecondary,
              ),
            ),
            if (widget.onRetry != null) ...[
              const SizedBox(height: 24),
              OutlinedButton.icon(
                onPressed: widget.onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.kPrimary,
                  side: const BorderSide(color: AppColors.kPrimary),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 12,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.message,
    this.icon,
    this.actionLabel,
    this.onAction,
  });

  final String message;
  final IconData? icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon ?? PhosphorIcons.package(),
              size: 48,
              color: AppColors.kDivider,
            ),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 16,
                color: AppColors.kTextSecondary,
              ),
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: onAction,
                icon: const Icon(Icons.add),
                label: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class AsyncValueWidget<T> extends StatelessWidget {
  const AsyncValueWidget({
    super.key,
    required this.value,
    required this.data,
    this.loading,
    this.onRetry,
    this.errorMessage,
  });

  final AsyncValue<T> value;
  final Widget Function(T data) data;
  final Widget? loading;
  final VoidCallback? onRetry;
  final String Function(Object error)? errorMessage;

  @override
  Widget build(BuildContext context) {
    return value.when(
      loading: () => loading ?? const LoadingSkeleton(),
      error: (error, _) => ErrorState(
        message: errorMessage?.call(error) ?? apiErrorMessage(error),
        onRetry: onRetry,
      ),
      data: data,
    );
  }
}
