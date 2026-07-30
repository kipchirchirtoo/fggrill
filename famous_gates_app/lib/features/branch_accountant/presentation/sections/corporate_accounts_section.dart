import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.all(16.0),
          child: Text('Corporate Accounts', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
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

class _CompaniesTab extends ConsumerWidget {
  const _CompaniesTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(corporateCustomersProvider);
    return asyncData.when(
      data: (customers) {
        if (customers.isEmpty) return const Center(child: Text('No Corporate Companies.'));
        return ListView.builder(
          itemCount: customers.length,
          itemBuilder: (context, index) {
            final c = customers[index];
            return Card(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: ListTile(
                title: Text(c['name'] ?? ''),
                subtitle: Text('Credit Limit: KES ${c['credit_limit']} | Terms: ${c['credit_period_days']} Days'),
                trailing: Switch(
                  value: c['is_active'] ?? true,
                  onChanged: (v) async {
                    // Quick toggle active status
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
      error: (err, _) => Center(child: Text('Error: $err')),
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
                title: Text('${inv['corporate_customers']?['name']} - ${inv['invoice_number']}'),
                subtitle: Text('Due: ${inv['due_date'].toString().split('T')[0]} | KES ${inv['amount_due']} (Paid: KES ${inv['amount_paid']})'),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Chip(
                      label: Text(status), 
                      backgroundColor: status == 'PAID' ? Colors.green.withValues(alpha: 0.2) : Colors.orange.withValues(alpha: 0.2)
                    ),
                    if (status != 'PAID')
                      IconButton(
                        icon: const Icon(Icons.payment, color: AppColors.kPrimary),
                        onPressed: () => _payInvoice(context, ref, inv['id'], (double.tryParse(inv['amount_due'].toString()) ?? 0.0) - (double.tryParse(inv['amount_paid'].toString()) ?? 0.0)),
                      )
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
