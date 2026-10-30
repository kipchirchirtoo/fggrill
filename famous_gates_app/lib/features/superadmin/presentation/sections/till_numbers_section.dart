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
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('POS Till Numbers',
                  style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.kTextPrimary)),
              SizedBox(height: 4),
              Text(
                  'Set a till number, or a paybill number with its account number, per POS outlet. The branch default is used when an outlet has none. Whatever is set is shown on every customer bill & receipt — if nothing is set, the box is silently omitted from print.',
                  style:
                      TextStyle(fontSize: 13, color: AppColors.kTextSecondary)),
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
            data: (branches) {
              if (branches.isEmpty) {
                return const Center(child: Text('No branches found'));
              }
              final missing = branches.where((b) {
                bool has(Object? a, Object? b) =>
                    '${a ?? ''}'.trim().isNotEmpty ||
                    '${b ?? ''}'.trim().isNotEmpty;
                final branchSet =
                    has(b['default_till_number'], b['default_paybill_number']);
                final outlets = (b['outlets'] as List?) ?? [];
                final allOutletsSet = outlets.isNotEmpty &&
                    outlets.every((o) {
                      final m = Map<String, dynamic>.from(o as Map);
                      return has(m['till_number'], m['paybill_number']);
                    });
                return !branchSet && !allOutletsSet;
              }).length;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (missing > 0)
                    Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.red.shade200),
                      ),
                      child: Row(children: [
                        Icon(Icons.warning_amber_rounded,
                            color: Colors.red.shade700, size: 22),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            '$missing branch(es) have no till or paybill set (neither a branch default nor one on every outlet). '
                            'Customer bills/receipts for those branches print without a payment box.',
                            style: TextStyle(
                                color: Colors.red.shade900,
                                fontSize: 13,
                                fontWeight: FontWeight.w600),
                          ),
                        ),
                      ]),
                    ),
                  Expanded(
                    child: ListView.separated(
                      itemCount: branches.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 16),
                      itemBuilder: (_, i) =>
                          _BranchTillCard(branch: branches[i]),
                    ),
                  ),
                ],
              );
            },
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
    final branchDefault = '${branch['default_till_number'] ?? ''}'.trim();
    final branchPaybill = '${branch['default_paybill_number'] ?? ''}'.trim();
    final branchPaybillAccount =
        '${branch['default_paybill_account'] ?? ''}'.trim();
    final branchHasDefault =
        branchDefault.isNotEmpty || branchPaybill.isNotEmpty;
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
            value: branchDefault,
            onSave: (v) async {
              final branchId = branch['branch_id'];
              if (branchId == null) return;
              await ref
                  .read(templateRepositoryProvider)
                  .updateBranchTill('$branchId', v);
              ref.invalidate(tillNumbersProvider);
              if (context.mounted) {
                AppNotifier.showSnackBar(context,
                    const SnackBar(content: Text('Branch default till saved')));
              }
            },
          ),
        ]),
        const SizedBox(height: 10),
        _PaybillField(
          label: 'Branch default paybill',
          paybill: branchPaybill,
          account: branchPaybillAccount,
          onSave: (p, a) async {
            final branchId = branch['branch_id'];
            if (branchId == null) return;
            await ref
                .read(templateRepositoryProvider)
                .updateBranchPaybill('$branchId', p, a);
            ref.invalidate(tillNumbersProvider);
            if (context.mounted) {
              AppNotifier.showSnackBar(
                  context,
                  const SnackBar(
                      content: Text('Branch default paybill saved')));
            }
          },
        ),
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
            final outletTill = '${outlet['till_number'] ?? ''}'.trim();
            final outletPaybill = '${outlet['paybill_number'] ?? ''}'.trim();
            final outletPaybillAccount =
                '${outlet['paybill_account'] ?? ''}'.trim();
            final outletHasOwn =
                outletTill.isNotEmpty || outletPaybill.isNotEmpty;
            final hasEffectiveTill = outletHasOwn || branchHasDefault;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(children: [
                if (!hasEffectiveTill)
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: Tooltip(
                      message:
                          'No till or paybill — outlet has none and branch has no default. Bills/receipts print without a payment box.',
                      child: Icon(Icons.error_outline,
                          color: Colors.red.shade600, size: 18),
                    ),
                  ),
                Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${outlet['outlet_name'] ?? ''}',
                            style: const TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 13.5)),
                        Text(
                          !outletHasOwn && branchHasDefault
                              ? '${outlet['outlet_type'] ?? ''} · using branch default'
                              : '${outlet['outlet_type'] ?? ''}',
                          style: TextStyle(
                              fontSize: 11,
                              color: !hasEffectiveTill
                                  ? Colors.red.shade600
                                  : AppColors.kTextSecondary,
                              fontWeight: !hasEffectiveTill
                                  ? FontWeight.w700
                                  : FontWeight.normal),
                        ),
                      ]),
                ),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                _TillField(
                  label: 'Till number',
                  value: outletTill,
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
                const SizedBox(height: 6),
                _PaybillField(
                  label: 'Paybill',
                  paybill: outletPaybill,
                  account: outletPaybillAccount,
                  onSave: (p, a) async {
                    await ref
                        .read(templateRepositoryProvider)
                        .updateOutletPaybill('${outlet['outlet_id']}', p, a);
                    ref.invalidate(tillNumbersProvider);
                    if (context.mounted) {
                      AppNotifier.showSnackBar(
                          context,
                          const SnackBar(
                              content: Text('Outlet paybill saved')));
                    }
                  },
                ),
                ]),
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
  void didUpdateWidget(_TillField oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Sync the controller when the parent rebuilds with a new value (e.g.
    // after a successful save + provider invalidation fetches fresh data).
    // Only update when the field is not currently focused to avoid clobbering
    // text the user is actively editing.
    if (oldWidget.value != widget.value &&
        !(_ctrl.selection.isCollapsed &&
            FocusScope.of(context).hasFocus &&
            _ctrl.text == oldWidget.value)) {
      _ctrl.text = widget.value;
    }
  }

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
                  final value = _ctrl.text.trim();
                  // Validate: allow empty (clears the till) but reject
                  // values that contain non-numeric characters when not empty.
                  if (value.isNotEmpty &&
                      !RegExp(r'^\d+$').hasMatch(value)) {
                    AppNotifier.showSnackBar(
                      context,
                      const SnackBar(
                          content: Text(
                              'Till number must contain digits only (e.g. 1, 12, 001)')),
                    );
                    return;
                  }
                  setState(() => _busy = true);
                  try {
                    await widget.onSave(value.isEmpty ? null : value);
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
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.save, color: AppColors.kPrimary),
        ),
      ]),
    );
  }
}

/// Paybill number + account number. Both are required together; both empty clears them.
class _PaybillField extends StatefulWidget {
  const _PaybillField(
      {required this.label,
      required this.paybill,
      required this.account,
      required this.onSave});
  final String label;
  final String paybill;
  final String account;
  final Future<void> Function(String? paybill, String? account) onSave;

  @override
  State<_PaybillField> createState() => _PaybillFieldState();
}

class _PaybillFieldState extends State<_PaybillField> {
  late final _paybill = TextEditingController(text: widget.paybill);
  late final _account = TextEditingController(text: widget.account);
  bool _busy = false;

  @override
  void didUpdateWidget(_PaybillField old) {
    super.didUpdateWidget(old);
    if (old.paybill != widget.paybill) _paybill.text = widget.paybill;
    if (old.account != widget.account) _account.text = widget.account;
  }

  @override
  void dispose() {
    _paybill.dispose();
    _account.dispose();
    super.dispose();
  }

  void _warn(String message) =>
      AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));

  Future<void> _save() async {
    final p = _paybill.text.trim();
    final a = _account.text.trim();
    if (p.isEmpty && a.isEmpty) {
      // both empty clears the paybill
    } else if (p.isEmpty) {
      _warn('Enter the paybill number as well as the account number.');
      return;
    } else if (a.isEmpty) {
      _warn('A paybill number must have an account number.');
      return;
    } else if (!RegExp(r'^\d{5,7}$').hasMatch(p)) {
      _warn('Paybill number must be 5 to 7 digits.');
      return;
    }
    setState(() => _busy = true);
    try {
      await widget.onSave(p.isEmpty ? null : p, a.isEmpty ? null : a);
    } catch (e) {
      if (mounted) _warn(apiErrorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      SizedBox(
        width: 120,
        child: TextField(
          controller: _paybill,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: '${widget.label} no.',
            isDense: true,
            border: const OutlineInputBorder(),
          ),
        ),
      ),
      const SizedBox(width: 6),
      SizedBox(
        width: 150,
        child: TextField(
          controller: _account,
          decoration: const InputDecoration(
            labelText: 'Account number',
            isDense: true,
            border: OutlineInputBorder(),
          ),
        ),
      ),
      const SizedBox(width: 6),
      IconButton(
        tooltip: 'Save paybill (needs an account number)',
        onPressed: _busy ? null : _save,
        icon: _busy
            ? const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2))
            : const Icon(Icons.save, color: AppColors.kPrimary),
      ),
    ]);
  }
}
