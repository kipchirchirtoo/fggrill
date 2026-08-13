import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../auth/domain/auth_notifier.dart';
import '../../shared/presentation/branch_invoice_pdf.dart';

/// Branch Accountant → Invoice Generator. Composes an official Famous Gates
/// invoice (branded letterhead + bank footer) from free-form line items and
/// prints it as a PDF.
class InvoiceGeneratorSection extends ConsumerStatefulWidget {
  const InvoiceGeneratorSection({super.key});

  @override
  ConsumerState<InvoiceGeneratorSection> createState() =>
      _InvoiceGeneratorSectionState();
}

class _LineItem {
  final descCtrl = TextEditingController();
  final qtyCtrl = TextEditingController(text: '1');
  final priceCtrl = TextEditingController();

  double get qty => double.tryParse(qtyCtrl.text.trim()) ?? 0;
  double get price => double.tryParse(priceCtrl.text.trim()) ?? 0;
  double get amount => qty * price;

  void dispose() {
    descCtrl.dispose();
    qtyCtrl.dispose();
    priceCtrl.dispose();
  }
}

class _InvoiceGeneratorSectionState
    extends ConsumerState<InvoiceGeneratorSection> {
  final _invoiceNoCtrl = TextEditingController(
      text: 'INV-${DateFormat('yyyyMMdd').format(DateTime.now())}-'
          '${(DateTime.now().millisecondsSinceEpoch % 1000).toString().padLeft(3, '0')}');
  final _clientNameCtrl = TextEditingController();
  final _clientPhoneCtrl = TextEditingController();
  final _clientAddrCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  final _paidCtrl = TextEditingController();

  DateTime _invoiceDate = DateTime.now();
  DateTime? _dueDate;
  bool _applyVat = true;
  bool _busy = false;

  final List<_LineItem> _items = [_LineItem()];

  final _money = NumberFormat('#,##0.00', 'en_KE');

  @override
  void dispose() {
    _invoiceNoCtrl.dispose();
    _clientNameCtrl.dispose();
    _clientPhoneCtrl.dispose();
    _clientAddrCtrl.dispose();
    _notesCtrl.dispose();
    _paidCtrl.dispose();
    for (final it in _items) {
      it.dispose();
    }
    super.dispose();
  }

  double get _subtotal => _items.fold(0.0, (s, it) => s + it.amount);
  double get _vat => _applyVat ? _subtotal * 0.16 : 0.0;
  double get _total => _subtotal + _vat;

  void _addItem() => setState(() => _items.add(_LineItem()));

  void _removeItem(int i) {
    if (_items.length <= 1) return;
    setState(() {
      _items.removeAt(i).dispose();
    });
  }

  Future<void> _pickDate({required bool isDue}) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: (isDue ? _dueDate : _invoiceDate) ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked == null) return;
    setState(() {
      if (isDue) {
        _dueDate = picked;
      } else {
        _invoiceDate = picked;
      }
    });
  }

  Future<void> _generate() async {
    if (_clientNameCtrl.text.trim().isEmpty) {
      _snack('Enter the client / bill-to name.');
      return;
    }
    final lineItems = _items
        .where((it) => it.descCtrl.text.trim().isNotEmpty && it.amount > 0)
        .map((it) => {
              'description': it.descCtrl.text.trim(),
              'qty': it.qty,
              'unitPrice': it.price,
            })
        .toList();
    if (lineItems.isEmpty) {
      _snack('Add at least one line item with a description and amount.');
      return;
    }

    setState(() => _busy = true);
    try {
      final branchName =
          ref.read(authNotifierProvider).valueOrNull?.branchName ?? '';
      await generateBranchInvoicePdf(
        context: context,
        branchName: branchName,
        invoiceNumber: _invoiceNoCtrl.text.trim(),
        invoiceDate: DateFormat('dd/MM/yyyy').format(_invoiceDate),
        dueDate:
            _dueDate == null ? null : DateFormat('dd/MM/yyyy').format(_dueDate!),
        clientName: _clientNameCtrl.text.trim(),
        clientPhone: _clientPhoneCtrl.text.trim(),
        clientAddress: _clientAddrCtrl.text.trim(),
        items: lineItems,
        applyVat: _applyVat,
        amountPaid: double.tryParse(_paidCtrl.text.trim()) ?? 0,
        notes: _notesCtrl.text.trim(),
      );
    } catch (e) {
      _snack('Failed to generate invoice: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final branchName =
        ref.watch(authNotifierProvider).valueOrNull?.branchName ?? '';
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Invoice Generator',
              style: Theme.of(context)
                  .textTheme
                  .headlineSmall
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(
            'Create an official $kFgCompanyName invoice${branchName.isEmpty ? '' : ' — $branchName'}. Fill in the client and line items, then generate the branded PDF.',
            style: const TextStyle(color: AppColors.kTextSecondary),
          ),
          const SizedBox(height: 20),

          // ── Invoice + client details ──────────────────────────────────
          _card(
            title: 'Invoice & Client',
            child: Column(
              children: [
                Row(children: [
                  Expanded(child: _field(_invoiceNoCtrl, 'Invoice No.')),
                  const SizedBox(width: 12),
                  Expanded(child: _dateField('Invoice Date', _invoiceDate,
                      () => _pickDate(isDue: false))),
                  const SizedBox(width: 12),
                  Expanded(
                      child: _dateField('Due Date (optional)', _dueDate,
                          () => _pickDate(isDue: true))),
                ]),
                const SizedBox(height: 12),
                _field(_clientNameCtrl, 'Bill To (Client Name) *'),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: _field(_clientPhoneCtrl, 'Client Phone')),
                  const SizedBox(width: 12),
                  Expanded(child: _field(_clientAddrCtrl, 'Client Address')),
                ]),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ── Line items ────────────────────────────────────────────────
          _card(
            title: 'Line Items',
            trailing: TextButton.icon(
              onPressed: _addItem,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Add item'),
            ),
            child: Column(
              children: [
                for (var i = 0; i < _items.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                            flex: 5,
                            child: _field(_items[i].descCtrl, 'Description',
                                onChanged: (_) => setState(() {}))),
                        const SizedBox(width: 8),
                        Expanded(
                            flex: 2,
                            child: _numField(_items[i].qtyCtrl, 'Qty')),
                        const SizedBox(width: 8),
                        Expanded(
                            flex: 3,
                            child:
                                _numField(_items[i].priceCtrl, 'Unit Price')),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 90,
                          child: Text(
                            _money.format(_items[i].amount),
                            textAlign: TextAlign.right,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ),
                        IconButton(
                          tooltip: 'Remove',
                          onPressed: _items.length > 1
                              ? () => _removeItem(i)
                              : null,
                          icon: const Icon(Icons.close, size: 18),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ── Totals + options ──────────────────────────────────────────
          _card(
            title: 'Totals & Options',
            child: Column(
              children: [
                Row(children: [
                  Expanded(
                    child: SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      value: _applyVat,
                      onChanged: (v) => setState(() => _applyVat = v),
                      title: const Text('Add VAT (16%)'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                      child:
                          _numField(_paidCtrl, 'Amount Paid (optional)')),
                ]),
                const SizedBox(height: 8),
                _field(_notesCtrl, 'Notes / Terms (optional)', maxLines: 2),
                const Divider(height: 24),
                _totalRow('Subtotal', _subtotal),
                if (_applyVat) _totalRow('VAT (16%)', _vat),
                _totalRow('TOTAL', _total, emphasize: true),
              ],
            ),
          ),
          const SizedBox(height: 20),

          Align(
            alignment: Alignment.centerRight,
            child: ElevatedButton.icon(
              onPressed: _busy ? null : _generate,
              icon: _busy
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.picture_as_pdf_outlined),
              label: Text(_busy ? 'Generating…' : 'Generate Invoice'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kPrimary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _card({required String title, required Widget child, Widget? trailing}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.kDivider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title,
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 15)),
              if (trailing != null) trailing,
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _field(TextEditingController c, String label,
      {int maxLines = 1, ValueChanged<String>? onChanged}) {
    return TextField(
      controller: c,
      maxLines: maxLines,
      onChanged: onChanged,
      decoration: InputDecoration(
        labelText: label,
        isDense: true,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }

  Widget _numField(TextEditingController c, String label) {
    return TextField(
      controller: c,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
      ],
      onChanged: (_) => setState(() {}),
      decoration: InputDecoration(
        labelText: label,
        isDense: true,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }

  Widget _dateField(String label, DateTime? value, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          isDense: true,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          suffixIcon: const Icon(Icons.calendar_today, size: 16),
        ),
        child: Text(value == null
            ? '—'
            : DateFormat('dd/MM/yyyy').format(value)),
      ),
    );
  }

  Widget _totalRow(String label, double value, {bool emphasize = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: TextStyle(
                  fontWeight: emphasize ? FontWeight.w800 : FontWeight.w500,
                  fontSize: emphasize ? 16 : 13)),
          Text('Ksh ${_money.format(value)}',
              style: TextStyle(
                  fontWeight: emphasize ? FontWeight.w800 : FontWeight.w600,
                  fontSize: emphasize ? 16 : 13,
                  color: emphasize ? AppColors.kPrimary : null)),
        ],
      ),
    );
  }
}
