import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/theme/app_theme.dart';
import '../domain/providers.dart';
// Note: We avoid importing non-existent glass_card / animated_button, using standard widgets instead.

class CollectionsTab extends ConsumerStatefulWidget {
  const CollectionsTab({super.key});

  @override
  ConsumerState<CollectionsTab> createState() => _CollectionsTabState();
}

class _CollectionsTabState extends ConsumerState<CollectionsTab> {
  final _searchController = TextEditingController();
  List<dynamic> _searchResults = [];
  bool _isLoading = false;
  String _selectedSource = 'INVOICE'; // 'INVOICE', 'POS_BILL', etc.

  final List<String> _sources = ['INVOICE', 'POS_BILL', 'STAFF_CREDIT', 'ROOM_ACCOUNT', 'ADVANCE', 'EVENT', 'MISC'];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    if (_searchController.text.trim().isEmpty) return;
    setState(() => _isLoading = true);
    try {
      final dio = ref.read(dioProvider);
      if (_selectedSource == 'INVOICE') {
        final res = await dio.get('/payments/invoices/search?search=${_searchController.text.trim()}');
        if (res.data['success'] == true) {
          setState(() => _searchResults = res.data['data']);
        }
      } else {
        setState(() => _searchResults = []);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _receivePayment(dynamic item) {
    showDialog(
      context: context,
      builder: (context) => _ReceivePaymentDialog(
        source: _selectedSource,
        targetId: item['id'],
        targetLabel: item['invoice_number'] ?? item['name'] ?? item['company_name'] ?? 'Payment',
        amountDue: item['amount_due'] != null ? double.parse(item['amount_due'].toString()) - (item['amount_paid'] != null ? double.parse(item['amount_paid'].toString()) : 0) : 0,
        customerName: item['corporate_customer']?['name'] ?? item['corporate_customer']?['company_name'] ?? '',
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Receive Payment', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          Row(
            children: [
              SizedBox(
                width: 200,
                child: DropdownButtonFormField<String>(
                  value: _selectedSource,
                  decoration: const InputDecoration(labelText: 'Payment Source', border: OutlineInputBorder()),
                  items: _sources.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
                  onChanged: (val) {
                    if (val != null) setState(() {
                      _selectedSource = val;
                      _searchResults = [];
                    });
                  },
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: TextField(
                  controller: _searchController,
                  decoration: const InputDecoration(
                    labelText: 'Search Invoice No, Company Name...',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.search),
                  ),
                  onSubmitted: (_) => _search(),
                ),
              ),
              const SizedBox(width: 16),
              ElevatedButton.icon(
                onPressed: _isLoading ? null : _search,
                label: const Text('Search'),
                icon: const Icon(Icons.search),
              ),
            ],
          ),
          const SizedBox(height: 24),
          if (_isLoading) const Center(child: CircularProgressIndicator()),
          if (!_isLoading && _searchResults.isNotEmpty)
            Expanded(
              child: ListView.builder(
                itemCount: _searchResults.length,
                itemBuilder: (context, index) {
                  final item = _searchResults[index];
                  final due = double.parse(item['amount_due'].toString());
                  final paid = item['amount_paid'] != null ? double.parse(item['amount_paid'].toString()) : 0.0;
                  final balance = due - paid;
                  
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      title: Text('${item['invoice_number'] ?? 'N/A'} - ${item['corporate_customer']?['name'] ?? item['corporate_customer']?['company_name'] ?? 'Unknown'}'),
                      subtitle: Text('Status: ${item['status']} | Balance: KSh ${balance.toStringAsFixed(2)}'),
                      trailing: ElevatedButton.icon(
                        onPressed: balance > 0 ? () => _receivePayment(item) : null,
                        icon: const Icon(Icons.payments),
                        label: const Text('Receive'),
                      ),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _ReceivePaymentDialog extends ConsumerStatefulWidget {
  final String source;
  final String targetId;
  final String targetLabel;
  final double amountDue;
  final String customerName;

  const _ReceivePaymentDialog({
    required this.source,
    required this.targetId,
    required this.targetLabel,
    required this.amountDue,
    required this.customerName,
  });

  @override
  ConsumerState<_ReceivePaymentDialog> createState() => _ReceivePaymentDialogState();
}

class _ReceivePaymentDialogState extends ConsumerState<_ReceivePaymentDialog> {
  final _amountController = TextEditingController();
  final _notesController = TextEditingController();
  String _paymentMethod = 'cash';
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _amountController.text = widget.amountDue.toString();
  }

  Future<void> _submit() async {
    final amount = double.tryParse(_amountController.text.trim()) ?? 0;
    if (amount <= 0) return;

    setState(() => _isSubmitting = true);
    try {
      final shift = ref.read(cashierCurrentShiftProvider).value;
      if (shift == null) throw Exception('No open shift found');

      final payload = {
        'shift_id': shift['id'],
        'receiving_branch_id': shift['branch_id'],
        'customer_name': widget.customerName,
        'total_amount': amount,
        'notes': _notesController.text.trim(),
        'tenders': [
          {
            'payment_method': _paymentMethod,
            'payment_reference': '',
            'amount': amount,
          }
        ],
        'allocations': [
          {
            'allocation_type': widget.source,
            'target_id': widget.targetId,
            'amount': amount,
          }
        ]
      };

      final dio = ref.read(dioProvider);
      final res = await dio.post('/payments/receive', data: payload);
      if (res.data['success'] == true) {
        if (mounted) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Payment received successfully')));
        }
      } else {
        throw Exception(res.data['message']);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Receive Payment: ${widget.targetLabel}'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Amount Due: KSh ${widget.amountDue.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            TextField(
              controller: _amountController,
              decoration: const InputDecoration(labelText: 'Amount to Pay (KSh)', border: OutlineInputBorder()),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _paymentMethod,
              decoration: const InputDecoration(labelText: 'Payment Method', border: OutlineInputBorder()),
              items: const [
                DropdownMenuItem(value: 'cash', child: Text('Cash')),
                DropdownMenuItem(value: 'mpesa', child: Text('M-Pesa')),
                DropdownMenuItem(value: 'card', child: Text('Card / PDQ')),
                DropdownMenuItem(value: 'bank_transfer', child: Text('Bank Transfer')),
              ],
              onChanged: (val) {
                if (val != null) setState(() => _paymentMethod = val);
              },
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _notesController,
              decoration: const InputDecoration(labelText: 'Notes / Reference', border: OutlineInputBorder()),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        ElevatedButton(
          onPressed: _isSubmitting ? null : _submit,
          child: _isSubmitting ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Confirm Payment'),
        ),
      ],
    );
  }
}
