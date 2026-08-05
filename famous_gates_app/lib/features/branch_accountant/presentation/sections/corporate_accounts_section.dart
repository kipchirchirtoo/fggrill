import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:printing/printing.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_notifier.dart';
import '../../domain/providers.dart';
import '../../data/repository.dart';

class CorporateAccountsSection extends ConsumerStatefulWidget {
  const CorporateAccountsSection({super.key});

  @override
  ConsumerState<CorporateAccountsSection> createState() => _CorporateAccountsSectionState();
}

class _CorporateAccountsSectionState extends ConsumerState<CorporateAccountsSection> with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  void _showCreateDialog() {
    showDialog(
      context: context,
      builder: (context) => const _CreateCorporateDialog(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Corporate Accounts', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
              ElevatedButton.icon(
                onPressed: _showCreateDialog,
                icon: const Icon(Icons.add_business),
                label: const Text('New Corporate Account'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.kPrimary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
              ),
            ],
          ),
        ),
        TabBar(
          controller: _tabCtrl,
          isScrollable: true,
          labelColor: AppColors.kPrimary,
          unselectedLabelColor: AppColors.kTextSecondary,
          tabs: const [
            Tab(text: 'Companies'),
            Tab(text: 'Uninvoiced Bills'),
            Tab(text: 'Invoices'),
          ],
        ),
        Expanded(
          child: TabBarView(
            controller: _tabCtrl,
            children: const [
              _CompaniesTab(),
              _PendingBillsTab(),
              _InvoicesTab(),
            ],
          ),
        ),
      ],
    );
  }
}

class _CreateCorporateDialog extends ConsumerStatefulWidget {
  const _CreateCorporateDialog();

  @override
  ConsumerState<_CreateCorporateDialog> createState() => _CreateCorporateDialogState();
}

class _CreateCorporateDialogState extends ConsumerState<_CreateCorporateDialog> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _contactCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _limitCtrl = TextEditingController(text: '500000');
  final _periodCtrl = TextEditingController(text: '30');
  bool _submitting = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _contactCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _limitCtrl.dispose();
    _periodCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    try {
      final repo = ref.read(branchAccountantRepositoryProvider);
      await repo.createCorporateCustomer({
        'name': _nameCtrl.text.trim(),
        'contact_person': _contactCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'email': _emailCtrl.text.trim(),
        'credit_limit': double.tryParse(_limitCtrl.text.trim()) ?? 500000.0,
        'credit_period_days': int.tryParse(_periodCtrl.text.trim()) ?? 30,
        'is_active': true,
      });

      ref.invalidate(corporateCustomersProvider);
      if (mounted) {
        Navigator.pop(context);
        AppNotifier.showSnackBar(
          context,
          const SnackBar(
            content: Text('Corporate Account Created Successfully!'),
            backgroundColor: AppColors.kSuccess,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        AppNotifier.showSnackBar(
          context,
          SnackBar(
            content: Text('Failed to create corporate account: $e'),
            backgroundColor: AppColors.kError,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Row(
        children: [
          Icon(Icons.add_business, color: AppColors.kPrimary),
          SizedBox(width: 8),
          Text('Create Corporate Account'),
        ],
      ),
      content: SingleChildScrollView(
        child: SizedBox(
          width: 480,
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: _nameCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Company / Organization Name *',
                    hintText: 'e.g. Safaricom PLC, Bomet County Government',
                    prefixIcon: Icon(Icons.business),
                  ),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Company name is required' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _contactCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Contact Person / Manager',
                    hintText: 'e.g. John Doe (Finance)',
                    prefixIcon: Icon(Icons.person),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _phoneCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Phone Number',
                          hintText: 'e.g. 0712345678',
                          prefixIcon: Icon(Icons.phone),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _emailCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Email Address',
                          hintText: 'accounts@company.com',
                          prefixIcon: Icon(Icons.email),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _limitCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Credit Limit (KES)',
                          prefixIcon: Icon(Icons.payments),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _periodCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Credit Period (Days)',
                          prefixIcon: Icon(Icons.calendar_today),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: _submitting ? null : _submit,
          style: ElevatedButton.styleFrom(backgroundColor: AppColors.kPrimary, foregroundColor: Colors.white),
          child: _submitting
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Create Account'),
        ),
      ],
    );
  }
}

class _CompaniesTab extends ConsumerWidget {
  const _CompaniesTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(corporateCustomersProvider);
    return asyncData.when(
      data: (customers) {
        if (customers.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.business_center_outlined, size: 64, color: AppColors.kTextSecondary),
                const SizedBox(height: 12),
                const Text('No Corporate Companies Created Yet', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                const Text('Click "New Corporate Account" at the top right to add a company.', style: TextStyle(color: AppColors.kTextSecondary)),
              ],
            ),
          );
        }
        return ListView.builder(
          itemCount: customers.length,
          padding: const EdgeInsets.all(12),
          itemBuilder: (context, index) {
            final c = customers[index];
            final limit = double.tryParse(c['credit_limit']?.toString() ?? '0') ?? 0.0;
            final period = c['credit_period_days'] ?? 30;
            return Card(
              elevation: 1.5,
              margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
                  child: const Icon(Icons.business, color: AppColors.kPrimary),
                ),
                title: Text(c['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                subtitle: Padding(
                  padding: const EdgeInsets.only(top: 4.0),
                  child: Text(
                    'Contact: ${c['contact_person'] ?? 'N/A'} | Phone: ${c['phone'] ?? 'N/A'} | Credit Limit: KES ${limit.toStringAsFixed(0)} (${period}d terms)',
                    style: const TextStyle(fontSize: 13),
                  ),
                ),
                trailing: Switch(
                  value: c['is_active'] ?? true,
                  activeColor: AppColors.kPrimary,
                  onChanged: (v) async {
                    await ref.read(branchAccountantRepositoryProvider).updateCorporateCustomer(c['id'], {'is_active': v});
                    ref.invalidate(corporateCustomersProvider);
                  },
                ),
              ),
            );
          },
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(child: Text('Error loading corporate accounts: $err')),
    );
  }
}

class _PendingBillsTab extends ConsumerStatefulWidget {
  const _PendingBillsTab();
  @override
  ConsumerState<_PendingBillsTab> createState() => _PendingBillsTabState();
}

class _PendingBillsTabState extends ConsumerState<_PendingBillsTab> {
  final Set<String> _selectedBills = {};

  Future<void> _generateInvoice(String customerId) async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    try {
      await repo.generateCorporateInvoice({
        'corporate_customer_id': customerId,
        'bill_ids': _selectedBills.toList(),
      });
      ref.invalidate(pendingCorporateBillsProvider);
      ref.invalidate(corporateInvoicesProvider);
      if (mounted) {
        AppNotifier.showSnackBar(context, const SnackBar(content: Text('Invoice Generated!'), backgroundColor: AppColors.kSuccess));
        setState(() => _selectedBills.clear());
      }
    } catch (e) {
      if (mounted) AppNotifier.showSnackBar(context, SnackBar(content: Text('Error: $e'), backgroundColor: AppColors.kError));
    }
  }

  @override
  Widget build(BuildContext context) {
    final asyncData = ref.watch(pendingCorporateBillsProvider);
    return asyncData.when(
      data: (bills) {
        if (bills.isEmpty) return const Center(child: Text('No pending corporate bills.'));
        
        // Group by customer
        final grouped = <String, List<Map<String, dynamic>>>{};
        for (final b in bills) {
          final cId = b['corporate_customer_id'] as String;
          if (!grouped.containsKey(cId)) grouped[cId] = [];
          grouped[cId]!.add(b);
        }

        return ListView(
          padding: const EdgeInsets.all(16),
          children: grouped.entries.map((entry) {
            final cId = entry.key;
            final cBills = entry.value;
            final cName = cBills.first['corporate_customers']?['name'] ?? 'Unknown';
            final cTotal = cBills.fold<double>(0.0, (sum, b) => sum + (double.tryParse(b['amount'].toString()) ?? 0.0));
            
            final selectedForCustomer = cBills.where((b) => _selectedBills.contains(b['id'])).toList();
            final selectedTotal = selectedForCustomer.fold<double>(0.0, (sum, b) => sum + (double.tryParse(b['amount'].toString()) ?? 0.0));

            return Card(
              margin: const EdgeInsets.only(bottom: 16),
              child: ExpansionTile(
                title: Text('$cName - Uninvoiced: KES ${cTotal.toStringAsFixed(0)}'),
                subtitle: Text('${cBills.length} pending bills'),
                children: [
                  ...cBills.map((b) => CheckboxListTile(
                    title: Text('Bill: ${b['master_bills']?['bill_number'] ?? 'N/A'} - KES ${b['amount']}'),
                    subtitle: Text('Cashier: ${b['auth_users']?['full_name'] ?? 'N/A'} | Date: ${b['created_at'].toString().split('T')[0]}'),
                    value: _selectedBills.contains(b['id']),
                    onChanged: (v) {
                      setState(() {
                        if (v == true) _selectedBills.add(b['id']);
                        else _selectedBills.remove(b['id']);
                      });
                    },
                  )),
                  if (selectedForCustomer.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Selected Total: KES ${selectedTotal.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.bold)),
                          ElevatedButton(
                            onPressed: () => _generateInvoice(cId),
                            style: ElevatedButton.styleFrom(backgroundColor: AppColors.kPrimary, foregroundColor: Colors.white),
                            child: const Text('Generate Invoice'),
                          )
                        ],
                      ),
                    )
                ],
              ),
            );
          }).toList(),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(child: Text('Error: $err')),
    );
  }
}

class _InvoicesTab extends ConsumerWidget {
  const _InvoicesTab();

  Future<void> _exportInvoicePdf(BuildContext context, WidgetRef ref, Map<String, dynamic> inv) async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    final invNum = inv['invoice_number'] ?? 'INV-000';
    final compName = inv['corporate_customers']?['name'] ?? 'Corporate Account';
    final amountDue = double.tryParse(inv['amount_due']?.toString() ?? '0') ?? 0.0;
    final amountPaid = double.tryParse(inv['amount_paid']?.toString() ?? '0') ?? 0.0;
    final balance = amountDue - amountPaid;
    final dueDate = inv['due_date'] != null ? inv['due_date'].toString().split('T')[0] : 'N/A';
    final status = inv['status'] ?? 'UNPAID';

    final payload = {
      'title': 'CORPORATE INVOICE - $invNum',
      'period': 'Due Date: $dueDate',
      'branch': inv['branches']?['name'] ?? 'All Branches',
      'columns': const [
        {'header': 'Invoice Number', 'align': 'center', 'weight': 2.0},
        {'header': 'Corporate Account', 'align': 'left', 'weight': 3.0},
        {'header': 'Amount Due (KES)', 'align': 'right', 'weight': 1.8},
        {'header': 'Amount Paid (KES)', 'align': 'right', 'weight': 1.8},
        {'header': 'Balance Due (KES)', 'align': 'right', 'weight': 1.8},
        {'header': 'Status', 'align': 'center', 'weight': 1.5},
      ],
      'rows': [
        [
          invNum,
          compName,
          NumberFormat('#,##0.00').format(amountDue),
          NumberFormat('#,##0.00').format(amountPaid),
          NumberFormat('#,##0.00').format(balance),
          status,
        ],
      ],
      'summary': [
        {'label': 'Invoice Number', 'value': invNum},
        {'label': 'Corporate Customer', 'value': compName},
        {'label': 'Total Amount Due', 'value': 'KES ${NumberFormat('#,##0.00').format(amountDue)}'},
        {'label': 'Outstanding Balance', 'value': 'KES ${NumberFormat('#,##0.00').format(balance)}'},
      ],
      'totals': ['TOTALS', '', NumberFormat('#,##0.00').format(amountDue), NumberFormat('#,##0.00').format(amountPaid), NumberFormat('#,##0.00').format(balance), ''],
    };

    try {
      final file = await repo.generateStatementPdf(payload);
      await Printing.layoutPdf(onLayout: (format) async => file.readAsBytes());
    } catch (e) {
      if (context.mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text('Error printing invoice PDF: $e'), backgroundColor: AppColors.kError));
      }
    }
  }

  Future<void> _payInvoice(BuildContext context, WidgetRef ref, String id, double amountDue) async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    try {
      await repo.payCorporateInvoice(id, {'amount': amountDue});
      ref.invalidate(corporateInvoicesProvider);
      if (context.mounted) {
        AppNotifier.showSnackBar(context, const SnackBar(content: Text('Payment recorded!'), backgroundColor: AppColors.kSuccess));
      }
    } catch (e) {
      if (context.mounted) AppNotifier.showSnackBar(context, SnackBar(content: Text('Error: $e'), backgroundColor: AppColors.kError));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(corporateInvoicesProvider);
    return asyncData.when(
      data: (invoices) {
        if (invoices.isEmpty) return const Center(child: Text('No invoices found.'));
        return ListView.builder(
          itemCount: invoices.length,
          itemBuilder: (context, index) {
            final inv = invoices[index];
            final status = inv['status'] ?? 'UNPAID';
            return Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: ListTile(
                title: Text('${inv['corporate_customers']?['name']} - ${inv['invoice_number']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text('Due: ${inv['due_date'].toString().split('T')[0]} | KES ${inv['amount_due']} (Paid: KES ${inv['amount_paid']})'),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.picture_as_pdf, color: Colors.redAccent),
                      tooltip: 'Print / Export Branded PDF Invoice',
                      onPressed: () => _exportInvoicePdf(context, ref, inv),
                    ),
                    const SizedBox(width: 4),
                    Chip(
                      label: Text(status), 
                      backgroundColor: status == 'PAID' ? Colors.green.withValues(alpha: 0.2) : Colors.orange.withValues(alpha: 0.2)
                    ),
                    if (status != 'PAID') ...[
                      const SizedBox(width: 4),
                      IconButton(
                        icon: const Icon(Icons.payment, color: AppColors.kPrimary),
                        tooltip: 'Record Payment',
                        onPressed: () => _payInvoice(context, ref, inv['id'], (double.tryParse(inv['amount_due'].toString()) ?? 0.0) - (double.tryParse(inv['amount_paid'].toString()) ?? 0.0)),
                      )
                    ]
                  ],
                ),
              ),
            );
          },
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(child: Text('Error: $err')),
    );
  }
}
