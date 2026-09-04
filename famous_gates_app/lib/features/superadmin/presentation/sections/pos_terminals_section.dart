import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../pos_terminal/data/pos_terminal_admin_repository.dart';

const _terminalTypes = <String>[
  'cashier', 'restaurant', 'main_bar', 'executive_bar', 'non_consumables',
  'choma_zone', 'spa', 'sports_bar', 'reception', 'pool', 'carwash',
  'global',
];

String _apiError(Object e) {
  if (e is DioException) {
    final data = e.response?.data;
    if (data is Map && data['message'] != null) return '${data['message']}';
    return e.message ?? 'Network error';
  }
  return '$e';
}

Color _statusColor(String status) {
  switch (status) {
    case 'active':
      return const Color(0xFF16A34A);
    case 'pending_registration':
      return const Color(0xFFB45309);
    case 'suspended':
      return const Color(0xFFEA580C);
    case 'revoked':
      return const Color(0xFFDC2626);
    default:
      return Colors.grey;
  }
}

class PosTerminalsSection extends ConsumerWidget {
  const PosTerminalsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final terminalsAsync = ref.watch(posTerminalsListProvider);
    final branchesAsync = ref.watch(posTerminalBranchesProvider);

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('POS Terminals',
                        style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                    SizedBox(height: 4),
                    Text('Register and manage the POS computers bound to each branch.',
                        style: TextStyle(color: Colors.black54)),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Refresh',
                onPressed: () => ref.invalidate(posTerminalsListProvider),
                icon: const Icon(Icons.refresh),
              ),
              const SizedBox(width: 8),
              FilledButton.icon(
                onPressed: () => _showCreateDialog(context, ref),
                icon: const Icon(Icons.add),
                label: const Text('Add Terminal'),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Expanded(
            child: terminalsAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Failed to load terminals: ${_apiError(e)}')),
              data: (terminals) {
                if (terminals.isEmpty) {
                  return const Center(
                    child: Text('No terminals yet. Click "Add Terminal" to register the first POS computer.',
                        style: TextStyle(color: Colors.black54)),
                  );
                }
                final branchNames = <int, String>{};
                for (final b in branchesAsync.valueOrNull ?? const <Map<String, dynamic>>[]) {
                  final id = int.tryParse('${b['id']}');
                  if (id != null) branchNames[id] = '${b['name'] ?? 'Branch $id'}';
                }
                return ListView.separated(
                  itemCount: terminals.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _terminalCard(context, ref, terminals[i], branchNames),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _terminalCard(BuildContext context, WidgetRef ref, Map<String, dynamic> t, Map<int, String> branchNames) {
    final status = '${t['status'] ?? ''}';
    final branchId = int.tryParse('${t['branchId'] ?? t['branch_id'] ?? 0}') ?? 0;
    final branchName = branchNames[branchId] ?? 'Branch $branchId';

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 10, height: 10,
              decoration: BoxDecoration(color: _statusColor(status), shape: BoxShape.circle),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${t['terminalName'] ?? t['terminal_name'] ?? '—'}',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  const SizedBox(height: 2),
                  Text(
                    '${t['terminalCode'] ?? t['terminal_code'] ?? ''}  •  ${t['terminalType'] ?? t['terminal_type'] ?? ''}  •  $branchName',
                    style: const TextStyle(color: Colors.black54, fontSize: 12),
                  ),
                ],
              ),
            ),
            _statusChip(status),
            const SizedBox(width: 8),
            PopupMenuButton<String>(
              onSelected: (v) => _onAction(context, ref, v, t),
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'code', child: Text('Regenerate enrollment code')),
                const PopupMenuItem(value: 'rename', child: Text('Rename')),
                if (status == 'active')
                  const PopupMenuItem(value: 'suspend', child: Text('Suspend'))
                else if (status == 'suspended')
                  const PopupMenuItem(value: 'activate', child: Text('Activate')),
                const PopupMenuItem(value: 'transfer', child: Text('Transfer to branch…')),
                const PopupMenuItem(value: 'revoke', child: Text('Revoke device', style: TextStyle(color: Color(0xFFDC2626)))),
              ],
              child: const Icon(Icons.more_vert),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statusChip(String status) {
    final c = _statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: c.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Text(status.replaceAll('_', ' ').toUpperCase(),
          style: TextStyle(color: c, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
    );
  }

  Future<void> _onAction(BuildContext context, WidgetRef ref, String action, Map<String, dynamic> t) async {
    final repo = ref.read(posTerminalAdminRepositoryProvider);
    final id = '${t['id']}';
    final messenger = ScaffoldMessenger.of(context);
    try {
      switch (action) {
        case 'code':
          final res = await repo.regenerateCode(id);
          if (context.mounted) await _showCodeDialog(context, res, terminalName: '${t['terminalName'] ?? t['terminal_name']}');
          break;
        case 'rename':
          final name = await _promptText(context, 'Rename terminal', '${t['terminalName'] ?? t['terminal_name'] ?? ''}');
          if (name != null && name.trim().isNotEmpty) {
            await repo.updateTerminal(id, terminalName: name.trim());
            messenger.showSnackBar(const SnackBar(content: Text('Terminal renamed')));
          }
          break;
        case 'suspend':
          await repo.updateTerminal(id, status: 'suspended');
          messenger.showSnackBar(const SnackBar(content: Text('Terminal suspended')));
          break;
        case 'activate':
          await repo.updateTerminal(id, status: 'active');
          messenger.showSnackBar(const SnackBar(content: Text('Terminal activated')));
          break;
        case 'transfer':
          if (context.mounted) await _showTransferDialog(context, ref, t);
          return; // dialog handles its own refresh
        case 'revoke':
          final ok = await _confirm(context, 'Revoke device?',
              'This terminal can no longer authenticate. The computer must be re-registered to use it again.');
          if (ok == true) {
            await repo.revokeTerminal(id);
            messenger.showSnackBar(const SnackBar(content: Text('Terminal revoked')));
          } else {
            return;
          }
          break;
      }
      ref.invalidate(posTerminalsListProvider);
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Failed: ${_apiError(e)}')));
    }
  }

  // ---- dialogs ---------------------------------------------------

  Future<void> _showCreateDialog(BuildContext context, WidgetRef ref) async {
    List<Map<String, dynamic>> branches;
    try {
      branches = ref.read(posTerminalBranchesProvider).valueOrNull ??
          await ref.read(posTerminalAdminRepositoryProvider).listBranches();
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to load branches: ${_apiError(e)}')));
      }
      return;
    }
    if (!context.mounted) return;
    final nameCtrl = TextEditingController();
    String type = _terminalTypes.first;
    int? branchId = branches.isNotEmpty ? int.tryParse('${branches.first['id']}') : null;
    bool busy = false;
    String? error;

    await showDialog<void>(
      context: context,
      builder: (dctx) => StatefulBuilder(
        builder: (dctx, setSt) => AlertDialog(
          title: const Text('Register POS Terminal'),
          content: SizedBox(
            width: 380,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Terminal name', hintText: 'e.g. Bomet Main Counter POS 01'),
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  initialValue: type,
                  decoration: const InputDecoration(labelText: 'Terminal type'),
                  items: _terminalTypes.map((t) => DropdownMenuItem(value: t, child: Text(t.replaceAll('_', ' ')))).toList(),
                  onChanged: (v) => setSt(() => type = v ?? type),
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<int>(
                  initialValue: branchId,
                  decoration: const InputDecoration(labelText: 'Branch'),
                  items: branches
                      .map((b) => DropdownMenuItem(
                            value: int.tryParse('${b['id']}'),
                            child: Text('${b['name'] ?? b['id']}'),
                          ))
                      .toList(),
                  onChanged: (v) => setSt(() => branchId = v),
                ),
                if (error != null) ...[
                  const SizedBox(height: 12),
                  Text(error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: busy ? null : () => Navigator.pop(dctx), child: const Text('Cancel')),
            FilledButton(
              onPressed: busy
                  ? null
                  : () async {
                      if (nameCtrl.text.trim().isEmpty || branchId == null) {
                        setSt(() => error = 'Name and branch are required');
                        return;
                      }
                      setSt(() {
                        busy = true;
                        error = null;
                      });
                      try {
                        final res = await ref.read(posTerminalAdminRepositoryProvider).createTerminal(
                              branchId: branchId!,
                              terminalName: nameCtrl.text.trim(),
                              terminalType: type,
                            );
                        ref.invalidate(posTerminalsListProvider);
                        if (dctx.mounted) Navigator.pop(dctx);
                        if (context.mounted) await _showCodeDialog(context, res, terminalName: nameCtrl.text.trim());
                      } catch (e) {
                        setSt(() {
                          busy = false;
                          error = _apiError(e);
                        });
                      }
                    },
              child: busy
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Create'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showTransferDialog(BuildContext context, WidgetRef ref, Map<String, dynamic> t) async {
    List<Map<String, dynamic>> branches;
    try {
      branches = ref.read(posTerminalBranchesProvider).valueOrNull ??
          await ref.read(posTerminalAdminRepositoryProvider).listBranches();
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to load branches: ${_apiError(e)}')));
      }
      return;
    }
    if (!context.mounted) return;
    int? branchId;
    bool busy = false;
    String? error;
    await showDialog<void>(
      context: context,
      builder: (dctx) => StatefulBuilder(
        builder: (dctx, setSt) => AlertDialog(
          title: Text('Transfer ${t['terminalName'] ?? t['terminal_name']}'),
          content: SizedBox(
            width: 360,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('The device binding is revoked and a new enrollment code is issued. The terminal must be re-registered at the new branch.',
                    style: TextStyle(fontSize: 12, color: Colors.black54)),
                const SizedBox(height: 14),
                DropdownButtonFormField<int>(
                  initialValue: branchId,
                  decoration: const InputDecoration(labelText: 'Move to branch'),
                  items: branches
                      .map((b) => DropdownMenuItem(value: int.tryParse('${b['id']}'), child: Text('${b['name'] ?? b['id']}')))
                      .toList(),
                  onChanged: (v) => setSt(() => branchId = v),
                ),
                if (error != null) ...[
                  const SizedBox(height: 12),
                  Text(error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: busy ? null : () => Navigator.pop(dctx), child: const Text('Cancel')),
            FilledButton(
              onPressed: busy
                  ? null
                  : () async {
                      if (branchId == null) {
                        setSt(() => error = 'Select a branch');
                        return;
                      }
                      setSt(() {
                        busy = true;
                        error = null;
                      });
                      try {
                        final res = await ref.read(posTerminalAdminRepositoryProvider).transferTerminal('${t['id']}', branchId!);
                        ref.invalidate(posTerminalsListProvider);
                        if (dctx.mounted) Navigator.pop(dctx);
                        if (context.mounted) await _showCodeDialog(context, res, terminalName: '${t['terminalName'] ?? t['terminal_name']}');
                      } catch (e) {
                        setSt(() {
                          busy = false;
                          error = _apiError(e);
                        });
                      }
                    },
              child: busy
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Transfer'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showCodeDialog(BuildContext context, Map<String, dynamic> res, {String? terminalName}) async {
    final code = '${res['enrollment_code'] ?? ''}';
    if (code.isEmpty) return;
    await showDialog<void>(
      context: context,
      builder: (dctx) => AlertDialog(
        title: const Text('Enrollment code'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (terminalName != null) Text(terminalName, style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 18),
              decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(12)),
              child: Center(
                child: SelectableText(
                  code,
                  style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w800, letterSpacing: 10),
                ),
              ),
            ),
            const SizedBox(height: 12),
            const Text('Give this to the installer. It is shown only once, is single-use, and expires in 30 minutes.',
                style: TextStyle(fontSize: 12, color: Colors.black54)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: code));
              if (dctx.mounted) ScaffoldMessenger.of(dctx).showSnackBar(const SnackBar(content: Text('Copied')));
            },
            child: const Text('Copy'),
          ),
          FilledButton(onPressed: () => Navigator.pop(dctx), child: const Text('Done')),
        ],
      ),
    );
  }

  Future<String?> _promptText(BuildContext context, String title, String initial) async {
    final ctrl = TextEditingController(text: initial);
    return showDialog<String>(
      context: context,
      builder: (dctx) => AlertDialog(
        title: Text(title),
        content: TextField(controller: ctrl, autofocus: true),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(dctx, ctrl.text), child: const Text('Save')),
        ],
      ),
    );
  }

  Future<bool?> _confirm(BuildContext context, String title, String message) {
    return showDialog<bool>(
      context: context,
      builder: (dctx) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dctx, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            onPressed: () => Navigator.pop(dctx, true),
            child: const Text('Revoke'),
          ),
        ],
      ),
    );
  }
}
