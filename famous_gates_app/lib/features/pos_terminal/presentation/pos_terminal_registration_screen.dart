import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/pos_terminal_service.dart';

/// First-run terminal registration: the installer types the one-time code the
/// administrator generated, confirms the branch/terminal, and binds this
/// device. After this, the terminal supplies its branch on every request and
/// the cashier never picks a branch again.
class PosTerminalRegistrationScreen extends ConsumerStatefulWidget {
  const PosTerminalRegistrationScreen({super.key, this.onComplete});

  /// Called after a successful registration (e.g. to route on to the PIN hub).
  final VoidCallback? onComplete;

  @override
  ConsumerState<PosTerminalRegistrationScreen> createState() => _PosTerminalRegistrationScreenState();
}

enum _Step { enterCode, confirm, done }

class _PosTerminalRegistrationScreenState extends ConsumerState<PosTerminalRegistrationScreen> {
  final _codeController = TextEditingController();
  _Step _step = _Step.enterCode;
  bool _busy = false;
  String? _error;
  Map<String, dynamic>? _verified;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  String _apiError(Object e) {
    if (e is DioException) {
      final data = e.response?.data;
      if (data is Map && data['message'] != null) return '${data['message']}';
      return e.message ?? 'Network error';
    }
    return '$e';
  }

  Future<void> _verify() async {
    final code = _codeController.text.replaceAll(RegExp(r'\s+'), '');
    if (!RegExp(r'^\d{6}$').hasMatch(code)) {
      setState(() => _error = 'Enter the 6-digit code');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final data = await ref.read(posTerminalServiceProvider).verifyCode(code);
      setState(() {
        _verified = data;
        _step = _Step.confirm;
      });
    } catch (e) {
      setState(() => _error = _apiError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _register() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(posTerminalServiceProvider).register(
            code: _codeController.text.replaceAll(RegExp(r'\s+'), ''),
          );
      ref.invalidate(posTerminalIdentityProvider);
      if (mounted) setState(() => _step = _Step.done);
    } catch (e) {
      setState(() {
        _error = _apiError(e);
        _step = _Step.enterCode; // let them retry with a fresh code if consumed
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Card(
              color: Colors.white,
              elevation: 8,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: switch (_step) {
                  _Step.enterCode => _buildEnterCode(),
                  _Step.confirm => _buildConfirm(),
                  _Step.done => _buildDone(),
                },
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(String title, String subtitle) => Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const Text('FAMOUSGATE HOTELS',
              style: TextStyle(fontSize: 13, letterSpacing: 2, fontWeight: FontWeight.w700, color: Color(0xFFB45309))),
          const SizedBox(height: 4),
          const Text('POS TERMINAL SETUP', style: TextStyle(fontSize: 12, letterSpacing: 1.5, color: Colors.black54)),
          const SizedBox(height: 20),
          Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
          const SizedBox(height: 8),
          Text(subtitle, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: Colors.black54)),
          const SizedBox(height: 20),
        ],
      );

  Widget _buildEnterCode() => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildHeader('Register this terminal',
              'This computer must be registered before it can be used. Enter the enrollment code from your administrator.'),
          TextField(
            controller: _codeController,
            autofocus: true,
            textAlign: TextAlign.center,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
            style: const TextStyle(fontSize: 28, letterSpacing: 8, fontWeight: FontWeight.w700),
            decoration: InputDecoration(
              hintText: '••••••',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              contentPadding: const EdgeInsets.symmetric(vertical: 18),
            ),
            onSubmitted: (_) => _busy ? null : _verify(),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13), textAlign: TextAlign.center),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: FilledButton(
              onPressed: _busy ? null : _verify,
              child: _busy
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('VERIFY CODE'),
            ),
          ),
        ],
      );

  Widget _buildConfirm() {
    final v = _verified ?? const {};
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.verified_user, color: Color(0xFF16A34A), size: 44),
        const SizedBox(height: 12),
        _buildHeader('Terminal verified', 'This computer will be permanently associated with this branch.'),
        _row('Branch', '${v['branch_name'] ?? v['branch_id'] ?? '—'}'),
        _row('Terminal', '${v['terminal_name'] ?? '—'}'),
        _row('Type', '${v['terminal_type'] ?? '—'}'),
        if (v['already_registered'] == true) ...[
          const SizedBox(height: 10),
          const Text('Note: this terminal was already registered. Completing setup will re-bind it to this device.',
              style: TextStyle(color: Color(0xFFB45309), fontSize: 12), textAlign: TextAlign.center),
        ],
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13), textAlign: TextAlign.center),
        ],
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: FilledButton(
            onPressed: _busy ? null : _register,
            child: _busy
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('COMPLETE SETUP'),
          ),
        ),
        TextButton(
          onPressed: _busy ? null : () => setState(() => _step = _Step.enterCode),
          child: const Text('Back'),
        ),
      ],
    );
  }

  Widget _buildDone() {
    final v = _verified ?? const {};
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.check_circle, color: Color(0xFF16A34A), size: 56),
        const SizedBox(height: 16),
        _buildHeader('Setup complete', 'This terminal is now bound to ${v['branch_name'] ?? 'its branch'}.'),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: FilledButton(
            onPressed: () {
              if (widget.onComplete != null) {
                widget.onComplete!();
              } else if (Navigator.of(context).canPop()) {
                Navigator.of(context).pop(true);
              }
            },
            child: const Text('CONTINUE TO LOGIN'),
          ),
        ),
      ],
    );
  }

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            SizedBox(width: 90, child: Text(label, style: const TextStyle(color: Colors.black54, fontSize: 13))),
            Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14))),
          ],
        ),
      );
}
