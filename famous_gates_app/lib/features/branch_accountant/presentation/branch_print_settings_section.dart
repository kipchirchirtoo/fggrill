import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/api_error_message.dart';
import '../../../core/widgets/app_notifier.dart';
import '../../auth/domain/auth_notifier.dart';
import '../../superadmin/presentation/sections/document_templates_section.dart';
import '../../templates/domain/template_providers.dart';

/// Branch Accountant → Bills & Receipts. Lets the accountant customise the customer bill and
/// customer receipt of THEIR OWN branch: layout and promotional text (template editor), and the
/// phone, email, address and till numbers printed on them.
class BranchPrintSettingsSection extends ConsumerStatefulWidget {
  const BranchPrintSettingsSection({super.key});

  @override
  ConsumerState<BranchPrintSettingsSection> createState() =>
      _BranchPrintSettingsSectionState();
}

class _BranchPrintSettingsSectionState
    extends ConsumerState<BranchPrintSettingsSection> {
  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authNotifierProvider).valueOrNull;
    final branchId = int.tryParse(user?.branchId ?? '');
    if (branchId == null) {
      return const Center(
        child: Text('Your account is not assigned to a branch.',
            style: TextStyle(color: AppColors.kTextSecondary)),
      );
    }
    return DefaultTabController(
      length: 2,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const TabBar(
            isScrollable: true,
            tabs: [
              Tab(text: 'Contact & Till Numbers'),
              Tab(text: 'Bill & Receipt Layout / Promo'),
            ],
          ),
          Expanded(
            child: TabBarView(
              children: [
                const _ContactAndTillTab(),
                DocumentTemplatesSection(
                  branchId: branchId,
                  title: 'Bill & Receipt Layout',
                  subtitle:
                      'Edit the customer bill, customer receipt, credit bill and void slip for ${user?.branchName ?? 'your branch'}. '
                      'Use a Footer or Text block for promotional messages. Changes apply to this branch only.',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ContactAndTillTab extends ConsumerStatefulWidget {
  const _ContactAndTillTab();

  @override
  ConsumerState<_ContactAndTillTab> createState() => _ContactAndTillTabState();
}

class _ContactAndTillTabState extends ConsumerState<_ContactAndTillTab> {
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _address = TextEditingController();
  final _defaultTill = TextEditingController();
  final Map<String, TextEditingController> _outletTills = {};
  List<Map<String, dynamic>> _outlets = const [];
  String _branchName = '';
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _phone.dispose();
    _email.dispose();
    _address.dispose();
    _defaultTill.dispose();
    for (final c in _outletTills.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data =
          await ref.read(templateRepositoryProvider).getBranchPrintSettings();
      _branchName = '${data['branch_name'] ?? ''}';
      _phone.text = '${data['phone'] ?? ''}';
      _email.text = '${data['email'] ?? ''}';
      _address.text = '${data['address'] ?? ''}';
      _defaultTill.text = '${data['default_till_number'] ?? ''}';
      final outlets = (data['outlets'] is List)
          ? (data['outlets'] as List)
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList()
          : <Map<String, dynamic>>[];
      for (final c in _outletTills.values) {
        c.dispose();
      }
      _outletTills.clear();
      for (final o in outlets) {
        _outletTills['${o['outlet_id']}'] =
            TextEditingController(text: '${o['till_number'] ?? ''}');
      }
      _outlets = outlets;
    } catch (e) {
      _error = apiErrorMessage(e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ref.read(templateRepositoryProvider).saveBranchPrintSettings({
        'phone': _phone.text.trim(),
        'email': _email.text.trim(),
        'address': _address.text.trim(),
        'default_till_number': _defaultTill.text.trim(),
        'outlets': [
          for (final o in _outlets)
            {
              'outlet_id': o['outlet_id'],
              'till_number': _outletTills['${o['outlet_id']}']?.text.trim() ?? '',
            },
        ],
      });
      // Printers re-fetch the branch details on the next bill or receipt.
      ref.read(resolvedTemplateCacheProvider).clear();
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            const SnackBar(
                content: Text('Saved. New bills and receipts use these details.')));
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text(apiErrorMessage(e))));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _field(String label, TextEditingController controller,
      {TextInputType? keyboard, String? hint}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: controller,
        keyboardType: keyboard,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          border: const OutlineInputBorder(),
          isDense: true,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(_error!),
          const SizedBox(height: 8),
          OutlinedButton(onPressed: _load, child: const Text('Retry')),
        ]),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text('$_branchName bills & receipts',
            style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.kTextPrimary)),
        const SizedBox(height: 4),
        const Text(
            'These details are printed on customer bills and receipts for this branch. '
            'Leave a box empty to keep the standard FamousGate detail.',
            style: TextStyle(fontSize: 13, color: AppColors.kTextSecondary)),
        const SizedBox(height: 18),
        _field('Phone number', _phone,
            keyboard: TextInputType.phone, hint: 'e.g. +254 7xx xxx xxx'),
        _field('Email', _email, keyboard: TextInputType.emailAddress),
        _field('Address / location', _address),
        const SizedBox(height: 6),
        const Text('Till numbers',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
        const SizedBox(height: 4),
        const Text(
            'A POS station uses its own till number when set, otherwise the branch default.',
            style: TextStyle(fontSize: 12, color: AppColors.kTextSecondary)),
        const SizedBox(height: 10),
        _field('Branch default till number', _defaultTill,
            keyboard: TextInputType.number),
        for (final o in _outlets)
          _field(
            '${o['outlet_name'] ?? 'Station'} till number',
            _outletTills['${o['outlet_id']}']!,
            keyboard: TextInputType.number,
          ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerLeft,
          child: FilledButton.icon(
            onPressed: _saving ? null : _save,
            icon: _saving
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.save_outlined, size: 18),
            label: const Text('Save'),
          ),
        ),
      ],
    );
  }
}
