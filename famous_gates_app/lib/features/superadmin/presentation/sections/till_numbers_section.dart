import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_notifier.dart';
import '../../../../core/utils/api_error_message.dart';
import '../../../templates/domain/template_providers.dart';

/// SuperAdmin: configure the till number for each POS outlet (with a branch
/// default fallback). These flow into every printed customer bill/receipt.
class TillNumbersSection extends ConsumerWidget {
  const TillNumbersSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tills = ref.watch(tillNumbersProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('POS Till Numbers',
                  style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.kTextPrimary)),
              SizedBox(height: 4),
              Text(
                  'Set a till number per POS outlet. Branch default is used when an outlet has none. Shown on every customer bill & receipt.',
                  style: TextStyle(
                      fontSize: 13, color: AppColors.kTextSecondary)),
            ]),
          ),
          OutlinedButton.icon(
            onPressed: () => ref.invalidate(tillNumbersProvider),
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Refresh'),
          ),
        ]),
        const SizedBox(height: 20),
        Expanded(
          child: tills.when(
            data: (branches) => branches.isEmpty
                ? const Center(child: Text('No branches found'))
                : ListView.separated(
                    itemCount: branches.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 16),
                    itemBuilder: (_, i) =>
                        _BranchTillCard(branch: branches[i]),
                  ),
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text(apiErrorMessage(e))),
          ),
        ),
      ]),
    );
  }
}

class _BranchTillCard extends ConsumerWidget {
  const _BranchTillCard({required this.branch});
  final Map<String, dynamic> branch;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final outlets = (branch['outlets'] as List?) ?? [];
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.kDivider),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.store, color: AppColors.kPrimary, size: 20),
          const SizedBox(width: 8),
          Text('${branch['branch_name'] ?? 'Branch'}',
              style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                  color: AppColors.kTextPrimary)),
          const SizedBox(width: 10),
          _TillField(
            label: 'Branch default till',
            value: '${branch['default_till_number'] ?? ''}',
            onSave: (v) async {
              await ref
                  .read(templateRepositoryProvider)
                  .updateBranchTill('${branch['branch_id']}', v);
              ref.invalidate(tillNumbersProvider);
              if (context.mounted) {
                AppNotifier.showSnackBar(context,
                    const SnackBar(content: Text('Branch default till saved')));
              }
            },
          ),
        ]),
        const Divider(height: 24),
        if (outlets.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Text('No POS outlets for this branch',
                style: TextStyle(color: AppColors.kTextSecondary)),
          )
        else
          ...outlets.map((o) {
            final outlet = Map<String, dynamic>.from(o as Map);
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(children: [
                Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${outlet['outlet_name'] ?? ''}',
                            style: const TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 13.5)),
                        Text('${outlet['outlet_type'] ?? ''}',
                            style: const TextStyle(
                                fontSize: 11, color: AppColors.kTextSecondary)),
                      ]),
                ),
                _TillField(
                  label: 'Till number',
                  value: '${outlet['till_number'] ?? ''}',
                  onSave: (v) async {
                    await ref
                        .read(templateRepositoryProvider)
                        .updateOutletTill('${outlet['outlet_id']}', v);
                    ref.invalidate(tillNumbersProvider);
                    if (context.mounted) {
                      AppNotifier.showSnackBar(context,
                          const SnackBar(content: Text('Outlet till saved')));
                    }
                  },
                ),
              ]),
            );
          }),
      ]),
    );
  }
}

class _TillField extends StatefulWidget {
  const _TillField(
      {required this.label, required this.value, required this.onSave});
  final String label;
  final String value;
  final Future<void> Function(String?) onSave;

  @override
  State<_TillField> createState() => _TillFieldState();
}

class _TillFieldState extends State<_TillField> {
  late final _ctrl = TextEditingController(text: widget.value);
  bool _busy = false;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 230,
      child: Row(children: [
        Expanded(
          child: TextField(
            controller: _ctrl,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: widget.label,
              isDense: true,
              border: const OutlineInputBorder(),
            ),
          ),
        ),
        const SizedBox(width: 6),
        IconButton(
          tooltip: 'Save',
          onPressed: _busy
              ? null
              : () async {
                  setState(() => _busy = true);
                  try {
                    await widget.onSave(_ctrl.text.trim());
                  } catch (e) {
                    if (context.mounted) {
                      AppNotifier.showSnackBar(
                          context, SnackBar(content: Text(apiErrorMessage(e))));
                    }
                  } finally {
                    if (mounted) setState(() => _busy = false);
                  }
                },
          icon: _busy
              ? const SizedBox(
                  width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.save, color: AppColors.kPrimary),
        ),
      ]),
    );
  }
}
