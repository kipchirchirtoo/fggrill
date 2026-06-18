import 'package:flutter/material.dart';
import 'package:printing/printing.dart';

import '../services/silent_printer.dart';

Future<void> showPrinterSettingsDialog(BuildContext context) {
  return showDialog<void>(
    context: context,
    builder: (_) => const _PrinterSettingsDialog(),
  );
}

class _PrinterSettingsDialog extends StatefulWidget {
  const _PrinterSettingsDialog();

  @override
  State<_PrinterSettingsDialog> createState() => _PrinterSettingsDialogState();
}

class _PrinterSettingsDialogState extends State<_PrinterSettingsDialog> {
  bool _loading = true;
  String? _error;
  List<Printer> _printers = const [];
  Printer? _saved;
  String? _selectedUrl;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final saved = await SilentPrinter.getSavedPrinter();
      final printers = await SilentPrinter.listAvailable();
      if (!mounted) return;
      setState(() {
        _printers = printers;
        _saved = saved;
        _selectedUrl = saved?.url ??
            printers
                .firstWhere(
                  (p) => p.isDefault,
                  orElse: () => printers.isEmpty
                      ? const Printer(url: '')
                      : printers.first,
                )
                .url;
        if (_selectedUrl?.isEmpty ?? true) _selectedUrl = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    final url = _selectedUrl;
    if (url == null) return;
    final printer = _printers.firstWhere((p) => p.url == url);
    await SilentPrinter.savePrinter(printer);
    if (mounted) Navigator.pop(context);
  }

  Future<void> _clear() async {
    await SilentPrinter.clearSavedPrinter();
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Printer Settings'),
      content: SizedBox(
        width: 420,
        child: _loading
            ? const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(child: CircularProgressIndicator()),
              )
            : _error != null
                ? Text('Could not list printers: $_error',
                    style: const TextStyle(color: Colors.red))
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Bills, receipts and kitchen tickets print directly '
                        'to this printer on this device — no print dialog. '
                        'If this device has more than one printer (e.g. a '
                        'kitchen printer and a front desk printer), pick the '
                        'right one here.',
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                      const SizedBox(height: 16),
                      if (_printers.isEmpty)
                        const Text(
                          'No printers found on this device/network.',
                          style: TextStyle(color: Colors.red),
                        )
                      else
                        ..._printers.map((p) => RadioListTile<String>(
                              dense: true,
                              value: p.url,
                              groupValue: _selectedUrl,
                              onChanged: (v) =>
                                  setState(() => _selectedUrl = v),
                              title: Text(p.name,
                                  style: const TextStyle(fontSize: 13)),
                              subtitle: Text(
                                [
                                  if (p.isDefault) 'OS default',
                                  if (p.location?.isNotEmpty ?? false)
                                    p.location!,
                                ].join(' · '),
                                style: const TextStyle(fontSize: 11),
                              ),
                            )),
                      if (_saved != null) ...[
                        const SizedBox(height: 8),
                        Text('Currently saved: ${_saved!.name}',
                            style: const TextStyle(
                                fontSize: 11, fontStyle: FontStyle.italic)),
                      ],
                    ],
                  ),
      ),
      actions: [
        if (_saved != null)
          TextButton(
            onPressed: _clear,
            child: const Text('Clear override'),
          ),
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _selectedUrl == null ? null : _save,
          child: const Text('Save'),
        ),
      ],
    );
  }
}
