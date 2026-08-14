import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_notifier.dart';
import '../../../shared/presentation/guest_invoice_pdf.dart';
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
    _tabCtrl = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  void _showCreateDialog() {
    showDialog(
      context: context,
      builder: (context) => const _CorporateAccountDialog(),
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
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Corporate Accounts & Folio', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                  SizedBox(height: 2),
                  Text('Manage corporate clients, itemized folios, credit billing & official invoices',
                      style: TextStyle(color: AppColors.kTextSecondary, fontSize: 13)),
                ],
              ),
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
            Tab(text: 'Companies', icon: Icon(Icons.business_outlined, size: 18)),
            Tab(text: 'Corporate Folio', icon: Icon(Icons.receipt_long_outlined, size: 18)),
            Tab(text: 'Uninvoiced Bills', icon: Icon(Icons.pending_actions_outlined, size: 18)),
            Tab(text: 'Invoices', icon: Icon(Icons.description_outlined, size: 18)),
          ],
        ),
        Expanded(
          child: TabBarView(
            controller: _tabCtrl,
            children: [
              const _CompaniesTab(),
              const _CorporateFolioTab(),
              _PendingBillsTab(onInvoiceGenerated: () => _tabCtrl.animateTo(3)),
              const _InvoicesTab(),
            ],
          ),
        ),
      ],
    );
  }
}

class _CorporateAccountDialog extends ConsumerStatefulWidget {
  const _CorporateAccountDialog({this.customer});

  final Map<String, dynamic>? customer;

  @override
  ConsumerState<_CorporateAccountDialog> createState() => _CorporateAccountDialogState();
}

class _CorporateAccountDialogState extends ConsumerState<_CorporateAccountDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameCtrl;
  late final TextEditingController _contactCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _emailCtrl;
  late final TextEditingController _limitCtrl;
  late final TextEditingController _periodCtrl;
  late bool _isActive;
  bool _submitting = false;

  bool get _isEditing => widget.customer != null;

  @override
  void initState() {
    super.initState();
    final c = widget.customer;
    _nameCtrl = TextEditingController(text: c?['name']?.toString() ?? '');
    _contactCtrl = TextEditingController(text: c?['contact_person']?.toString() ?? '');
    _phoneCtrl = TextEditingController(text: c?['phone']?.toString() ?? '');
    _emailCtrl = TextEditingController(text: c?['email']?.toString() ?? '');
    _limitCtrl = TextEditingController(text: c?['credit_limit']?.toString() ?? '500000');
    _periodCtrl = TextEditingController(text: c?['credit_period_days']?.toString() ?? '30');
    _isActive = c?['is_active'] ?? true;
  }

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
      final payload = {
        'name': _nameCtrl.text.trim(),
        'contact_person': _contactCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'email': _emailCtrl.text.trim(),
        'credit_limit': double.tryParse(_limitCtrl.text.trim()) ?? 500000.0,
        'credit_period_days': int.tryParse(_periodCtrl.text.trim()) ?? 30,
        'is_active': _isActive,
      };

      if (_isEditing) {
        await repo.updateCorporateCustomer('${widget.customer!['id']}', payload);
      } else {
        await repo.createCorporateCustomer(payload);
      }

      ref.invalidate(corporateCustomersProvider);
      ref.invalidate(corporateFolioBillsProvider);
      if (mounted) {
        Navigator.pop(context);
        AppNotifier.showSnackBar(
          context,
          SnackBar(
            content: Text(_isEditing
                ? 'Corporate Account "${_nameCtrl.text.trim()}" Updated Successfully!'
                : 'Corporate Account Created Successfully!'),
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
            content: Text('Failed to ${_isEditing ? 'update' : 'create'} corporate account: $e'),
            backgroundColor: AppColors.kError,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Row(
        children: [
          Icon(_isEditing ? Icons.edit_note : Icons.add_business, color: AppColors.kPrimary),
          const SizedBox(width: 8),
          Text(_isEditing ? 'Edit Corporate Account' : 'Create Corporate Account'),
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
                const SizedBox(height: 14),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Account Active Status', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                  subtitle: Text(_isActive ? 'Active — can be charged for corporate bills' : 'Inactive — cannot be charged',
                      style: const TextStyle(fontSize: 12, color: AppColors.kTextSecondary)),
                  value: _isActive,
                  activeThumbColor: AppColors.kPrimary,
                  onChanged: (v) => setState(() => _isActive = v),
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
              : Text(_isEditing ? 'Save Changes' : 'Create Account'),
        ),
      ],
    );
  }
}

class _CompaniesTab extends ConsumerStatefulWidget {
  const _CompaniesTab();

  @override
  ConsumerState<_CompaniesTab> createState() => _CompaniesTabState();
}

class _CompaniesTabState extends ConsumerState<_CompaniesTab> {
  String _search = '';

  Future<void> _deleteCompany(Map<String, dynamic> company) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: AppColors.kError),
            SizedBox(width: 8),
            Text('Delete Corporate Account?'),
          ],
        ),
        content: Text(
          'Are you sure you want to delete "${company['name']}"?\n\n'
          'Note: If this account has past transaction records or invoices, it will safely be deactivated instead of deleted.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.kError,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete Account'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      final repo = ref.read(branchAccountantRepositoryProvider);
      final res = await repo.deleteCorporateCustomer('${company['id']}');
      ref.invalidate(corporateCustomersProvider);
      ref.invalidate(corporateFolioBillsProvider);
      if (mounted) {
        final isSoft = res['softDeleted'] == true;
        AppNotifier.showSnackBar(
          context,
          SnackBar(
            content: Text(isSoft
                ? 'Corporate Account "${company['name']}" has past records and was deactivated.'
                : 'Corporate Account "${company['name']}" deleted successfully.'),
            backgroundColor: isSoft ? Colors.orange.shade700 : AppColors.kSuccess,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(
            content: Text('Failed to delete corporate account: $e'),
            backgroundColor: AppColors.kError,
          ),
        );
      }
    }
  }

  void _editCompany(Map<String, dynamic> company) {
    showDialog(
      context: context,
      builder: (_) => _CorporateAccountDialog(customer: company),
    );
  }

  @override
  Widget build(BuildContext context) {
    final asyncData = ref.watch(corporateCustomersProvider);
    return asyncData.when(
      data: (customers) {
        if (customers.isEmpty) {
          return const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.business_center_outlined, size: 64, color: AppColors.kTextSecondary),
                SizedBox(height: 12),
                Text('No Corporate Companies Created Yet', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                SizedBox(height: 6),
                Text('Click "New Corporate Account" at the top right to add a company.', style: TextStyle(color: AppColors.kTextSecondary)),
              ],
            ),
          );
        }

        final query = _search.trim().toLowerCase();
        final filtered = query.isEmpty
            ? customers
            : customers.where((c) {
                final name = '${c['name'] ?? ''}'.toLowerCase();
                final contact = '${c['contact_person'] ?? ''}'.toLowerCase();
                final phone = '${c['phone'] ?? ''}'.toLowerCase();
                final email = '${c['email'] ?? ''}'.toLowerCase();
                return name.contains(query) || contact.contains(query) || phone.contains(query) || email.contains(query);
              }).toList();

        final activeCount = customers.where((c) => c['is_active'] == true || c['is_active'] == 1).length;

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      decoration: InputDecoration(
                        hintText: 'Search companies by name, contact, phone, or email…',
                        prefixIcon: const Icon(Icons.search, size: 20),
                        isDense: true,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      ),
                      onChanged: (v) => setState(() => _search = v),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.kPrimary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.kPrimary.withValues(alpha: 0.2)),
                    ),
                    child: Text(
                      '$activeCount / ${customers.length} Active',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.kPrimary),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: filtered.isEmpty
                  ? Center(
                      child: Text(
                        'No companies match "$_search"',
                        style: const TextStyle(color: AppColors.kTextSecondary, fontSize: 14),
                      ),
                    )
                  : ListView.builder(
                      itemCount: filtered.length,
                      padding: const EdgeInsets.all(12),
                      itemBuilder: (context, index) {
                        final c = filtered[index];
                        final limit = double.tryParse(c['credit_limit']?.toString() ?? '0') ?? 0.0;
                        final period = c['credit_period_days'] ?? 30;
                        final isActive = c['is_active'] ?? true;
                        return Card(
                          elevation: 1.5,
                          margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                            side: BorderSide(
                              color: isActive ? Colors.transparent : Colors.grey.shade300,
                            ),
                          ),
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                            leading: CircleAvatar(
                              backgroundColor: isActive
                                  ? AppColors.kPrimary.withValues(alpha: 0.1)
                                  : Colors.grey.withValues(alpha: 0.1),
                              child: Icon(Icons.business, color: isActive ? AppColors.kPrimary : Colors.grey),
                            ),
                            title: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    c['name'] ?? '',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                      color: isActive ? null : AppColors.kTextSecondary,
                                    ),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: isActive
                                        ? Colors.green.withValues(alpha: 0.12)
                                        : Colors.grey.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    isActive ? 'ACTIVE' : 'INACTIVE',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      color: isActive ? Colors.green.shade800 : Colors.grey.shade700,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            subtitle: Padding(
                              padding: const EdgeInsets.only(top: 6.0),
                              child: Text(
                                'Contact: ${c['contact_person'] ?? 'N/A'} | Phone: ${c['phone'] ?? 'N/A'} | Credit Limit: KES ${limit.toStringAsFixed(0)} (${period}d terms)${c['email'] != null && '${c['email']}'.isNotEmpty ? '\nEmail: ${c['email']}' : ''}',
                                style: const TextStyle(fontSize: 13),
                              ),
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Tooltip(
                                  message: isActive ? 'Deactivate Account' : 'Activate Account',
                                  child: Switch(
                                    value: isActive,
                                    activeThumbColor: AppColors.kPrimary,
                                    onChanged: (v) async {
                                      await ref
                                          .read(branchAccountantRepositoryProvider)
                                          .updateCorporateCustomer(c['id'], {'is_active': v});
                                      ref.invalidate(corporateCustomersProvider);
                                      ref.invalidate(corporateFolioBillsProvider);
                                    },
                                  ),
                                ),
                                const SizedBox(width: 4),
                                IconButton(
                                  icon: const Icon(Icons.edit_outlined, color: AppColors.kPrimary, size: 20),
                                  tooltip: 'Edit Corporate Account',
                                  onPressed: () => _editCompany(c),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline, color: AppColors.kError, size: 20),
                                  tooltip: 'Delete Corporate Account',
                                  onPressed: () => _deleteCompany(c),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(child: Text('Error loading corporate accounts: $err')),
    );
  }
}

// -------------------------------------------------------------
// CORPORATE FOLIO TAB (Detailed bills with item breakdown)
// -------------------------------------------------------------
class _CorporateFolioTab extends ConsumerStatefulWidget {
  const _CorporateFolioTab();

  @override
  ConsumerState<_CorporateFolioTab> createState() => _CorporateFolioTabState();
}

class _CorporateFolioTabState extends ConsumerState<_CorporateFolioTab> {
  String? _selectedCustomerId;
  String _statusFilter = 'ALL';
  String _searchQuery = '';

  Future<void> _printBillReceipt(BuildContext context, Map<String, dynamic> bill) async {
    final comp = bill['corporate_customers'] as Map<String, dynamic>? ?? {};
    final compName = comp['name']?.toString() ?? 'Corporate Client';
    final billNumber = bill['bill_number']?.toString() ?? 'BILL-${bill['id']?.toString().substring(0, 8)}';
    final amount = double.tryParse(bill['amount']?.toString() ?? '0') ?? 0.0;
    final dateStr = bill['created_at'] != null ? bill['created_at'].toString().split('T')[0] : 'N/A';
    final rawItems = bill['items'] as List? ?? [];

    final invoiceItems = rawItems.map((it) {
      final name = it['name']?.toString() ?? 'Item';
      final qty = (it['quantity'] as num?)?.toInt() ?? 1;
      final unitPrice = (it['unit_price'] as num?)?.toDouble() ?? 0.0;
      final total = (it['total_price'] as num?)?.toDouble() ?? (qty * unitPrice);
      return {
        'description': name,
        'qty': qty,
        'unitPrice': unitPrice,
        'totalAmount': total,
      };
    }).toList();

    if (invoiceItems.isEmpty) {
      invoiceItems.add({
        'description': 'POS Settlement ($billNumber)',
        'qty': 1,
        'unitPrice': amount,
        'totalAmount': amount,
      });
    }

    await printBookingInvoicePDF(
      context: context,
      invoiceNumber: billNumber,
      invoiceDate: dateStr,
      dueDate: dateStr,
      clientName: compName,
      clientPhone: comp['phone']?.toString(),
      clientDetails: 'Corporate Credit Bill | Status: ${bill['status'] ?? 'UNINVOICED'}',
      items: invoiceItems,
      totalAmount: amount,
      amountPaid: bill['status'] == 'PAID' ? amount : 0.0,
      balanceDue: bill['status'] == 'PAID' ? 0.0 : amount,
      asReceipt: bill['status'] == 'PAID',
    );
  }

  Future<void> _printCompanyFolio(BuildContext context, String customerId, String customerName, List<Map<String, dynamic>> bills) async {
    if (bills.isEmpty) {
      AppNotifier.showSnackBar(context, const SnackBar(content: Text('No bills to print in this folio.')));
      return;
    }

    final totalAmount = bills.fold<double>(0.0, (sum, b) => sum + (double.tryParse(b['amount']?.toString() ?? '0') ?? 0.0));
    final paidAmount = bills.where((b) => b['status'] == 'PAID').fold<double>(0.0, (sum, b) => sum + (double.tryParse(b['amount']?.toString() ?? '0') ?? 0.0));

    final folioItems = <Map<String, dynamic>>[];
    for (final b in bills) {
      final bNum = b['bill_number'] ?? 'BILL';
      final rawItems = b['items'] as List? ?? [];
      if (rawItems.isNotEmpty) {
        for (final it in rawItems) {
          folioItems.add({
            'description': '$bNum · ${it['name']}',
            'qty': (it['quantity'] as num?)?.toInt() ?? 1,
            'unitPrice': (it['unit_price'] as num?)?.toDouble() ?? 0.0,
            'totalAmount': (it['total_price'] as num?)?.toDouble() ?? 0.0,
          });
        }
      } else {
        folioItems.add({
          'description': '$bNum · POS Bill Settlement',
          'qty': 1,
          'unitPrice': double.tryParse(b['amount']?.toString() ?? '0') ?? 0.0,
          'totalAmount': double.tryParse(b['amount']?.toString() ?? '0') ?? 0.0,
        });
      }
    }

    final dateStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
    await printBookingInvoicePDF(
      context: context,
      invoiceNumber: 'FOLIO-${DateTime.now().millisecondsSinceEpoch.toString().substring(5)}',
      invoiceDate: dateStr,
      dueDate: dateStr,
      clientName: customerName,
      clientDetails: 'Corporate Folio Statement (${bills.length} Bills)',
      items: folioItems,
      totalAmount: totalAmount,
      amountPaid: paidAmount,
      balanceDue: totalAmount - paidAmount,
      asReceipt: (totalAmount - paidAmount) <= 0.01,
    );
  }

  @override
  Widget build(BuildContext context) {
    final customersAsync = ref.watch(corporateCustomersProvider);
    final billsAsync = ref.watch(corporateFolioBillsProvider);

    return customersAsync.when(
      data: (customers) {
        return billsAsync.when(
          data: (allBills) {
            final query = _searchQuery.trim().toLowerCase();
            final filtered = allBills.where((b) {
              if (_selectedCustomerId != null && _selectedCustomerId!.isNotEmpty) {
                if (b['corporate_customer_id'] != _selectedCustomerId) return false;
              }
              if (_statusFilter != 'ALL') {
                if (b['status'] != _statusFilter) return false;
              }
              if (query.isNotEmpty) {
                final billNum = '${b['bill_number'] ?? ''}'.toLowerCase();
                final compName = '${b['corporate_customers']?['name'] ?? ''}'.toLowerCase();
                final waiter = '${b['waiter_name'] ?? ''}'.toLowerCase();
                final itemsMatch = (b['items'] as List? ?? []).any((it) => '${it['name'] ?? ''}'.toLowerCase().contains(query));
                if (!billNum.contains(query) && !compName.contains(query) && !waiter.contains(query) && !itemsMatch) {
                  return false;
                }
              }
              return true;
            }).toList();

            // Summary metrics
            final totalBilled = filtered.fold<double>(0.0, (s, b) => s + (double.tryParse(b['amount']?.toString() ?? '0') ?? 0.0));
            final uninvoiced = filtered.where((b) => b['status'] == 'UNINVOICED').fold<double>(0.0, (s, b) => s + (double.tryParse(b['amount']?.toString() ?? '0') ?? 0.0));
            final invoiced = filtered.where((b) => b['status'] == 'INVOICED').fold<double>(0.0, (s, b) => s + (double.tryParse(b['amount']?.toString() ?? '0') ?? 0.0));
            final paid = filtered.where((b) => b['status'] == 'PAID').fold<double>(0.0, (s, b) => s + (double.tryParse(b['amount']?.toString() ?? '0') ?? 0.0));

            final currentCompName = _selectedCustomerId != null
                ? customers.firstWhere((c) => '${c['id']}' == _selectedCustomerId, orElse: () => {'name': 'Selected Company'})['name']
                : 'All Companies';

            return Column(
              children: [
                // Top Filter & Action Bar
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: Row(
                    children: [
                      // Customer Dropdown
                      Expanded(
                        flex: 3,
                        child: DropdownButtonFormField<String?>(
                          initialValue: _selectedCustomerId,
                          isDense: true,
                          decoration: InputDecoration(
                            labelText: 'Filter Company',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            prefixIcon: const Icon(Icons.business, size: 20),
                          ),
                          items: [
                            const DropdownMenuItem(value: null, child: Text('All Companies (All Folios)')),
                            ...customers.map((c) => DropdownMenuItem(
                                  value: '${c['id']}',
                                  child: Text('${c['name']}', overflow: TextOverflow.ellipsis),
                                )),
                          ],
                          onChanged: (v) => setState(() => _selectedCustomerId = v),
                        ),
                      ),
                      const SizedBox(width: 10),
                      // Status Filter
                      Expanded(
                        flex: 2,
                        child: DropdownButtonFormField<String>(
                          initialValue: _statusFilter,
                          isDense: true,
                          decoration: InputDecoration(
                            labelText: 'Status',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          ),
                          items: const [
                            DropdownMenuItem(value: 'ALL', child: Text('All Statuses')),
                            DropdownMenuItem(value: 'UNINVOICED', child: Text('Uninvoiced')),
                            DropdownMenuItem(value: 'INVOICED', child: Text('Invoiced')),
                            DropdownMenuItem(value: 'PAID', child: Text('Paid')),
                          ],
                          onChanged: (v) => setState(() => _statusFilter = v ?? 'ALL'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      // Search box
                      Expanded(
                        flex: 3,
                        child: TextField(
                          decoration: InputDecoration(
                            hintText: 'Search bill #, item, waiter…',
                            prefixIcon: const Icon(Icons.search, size: 20),
                            isDense: true,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          ),
                          onChanged: (v) => setState(() => _searchQuery = v),
                        ),
                      ),
                      if (_selectedCustomerId != null && _selectedCustomerId!.isNotEmpty) ...[
                        const SizedBox(width: 10),
                        ElevatedButton.icon(
                          onPressed: () => _printCompanyFolio(context, _selectedCustomerId!, currentCompName, filtered),
                          icon: const Icon(Icons.print_outlined, size: 18),
                          label: const Text('Print Folio'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.kPrimary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

                // KPI Metric Summary Bar
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  child: Row(
                    children: [
                      _kpiChip('Total Billed', totalBilled, Colors.blue.shade900, Colors.blue.shade50),
                      const SizedBox(width: 8),
                      _kpiChip('Uninvoiced', uninvoiced, Colors.orange.shade900, Colors.orange.shade50),
                      const SizedBox(width: 8),
                      _kpiChip('Invoiced', invoiced, Colors.indigo.shade900, Colors.indigo.shade50),
                      const SizedBox(width: 8),
                      _kpiChip('Paid', paid, Colors.green.shade900, Colors.green.shade50),
                      const SizedBox(width: 8),
                      _kpiChip('Balance Due', totalBilled - paid, Colors.red.shade900, Colors.red.shade50, isBold: true),
                    ],
                  ),
                ),
                const SizedBox(height: 8),

                // Bills Folio List
                Expanded(
                  child: filtered.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.receipt_long_outlined, size: 64, color: AppColors.kTextSecondary),
                              const SizedBox(height: 12),
                              const Text('No Corporate Bills Recorded in Folio', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 6),
                              Text(
                                _selectedCustomerId != null
                                    ? 'No bills found for $currentCompName with selected filters.'
                                    : 'When cashiers charge bills to corporate credit, they will appear here.',
                                style: const TextStyle(color: AppColors.kTextSecondary),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          itemCount: filtered.length,
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                          itemBuilder: (context, index) {
                            final b = filtered[index];
                            final comp = b['corporate_customers'] as Map<String, dynamic>? ?? {};
                            final billNumber = b['bill_number'] ?? 'BILL';
                            final amount = double.tryParse(b['amount']?.toString() ?? '0') ?? 0.0;
                            final dateStr = b['created_at'] != null ? b['created_at'].toString().split('T')[0] : 'N/A';
                            final timeStr = b['created_at'] != null && b['created_at'].toString().contains('T')
                                ? b['created_at'].toString().split('T')[1].substring(0, 5)
                                : '';
                            final status = b['status'] ?? 'UNINVOICED';
                            final waiter = b['waiter_name'];
                            final table = b['table_number'];
                            final room = b['room_number'];
                            final items = b['items'] as List? ?? [];

                            return Card(
                              margin: const EdgeInsets.only(bottom: 12),
                              elevation: 2,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                                side: BorderSide(
                                  color: status == 'PAID'
                                      ? Colors.green.shade200
                                      : status == 'INVOICED'
                                          ? Colors.blue.shade200
                                          : Colors.orange.shade200,
                                ),
                              ),
                              child: ExpansionTile(
                                leading: CircleAvatar(
                                  backgroundColor: status == 'PAID'
                                      ? Colors.green.withValues(alpha: 0.1)
                                      : status == 'INVOICED'
                                          ? Colors.blue.withValues(alpha: 0.1)
                                          : Colors.orange.withValues(alpha: 0.1),
                                  child: Icon(
                                    Icons.receipt_outlined,
                                    color: status == 'PAID'
                                        ? Colors.green
                                        : status == 'INVOICED'
                                            ? Colors.blue
                                            : Colors.orange.shade800,
                                  ),
                                ),
                                title: Row(
                                  children: [
                                    Text(billNumber, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                    const SizedBox(width: 8),
                                    Text('· ${comp['name'] ?? 'Corporate Customer'}',
                                        style: const TextStyle(fontSize: 13, color: AppColors.kTextSecondary)),
                                    const Spacer(),
                                    _statusPill(status),
                                    const SizedBox(width: 12),
                                    Text('KES ${NumberFormat('#,##0.00').format(amount)}',
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.kPrimary)),
                                  ],
                                ),
                                subtitle: Padding(
                                  padding: const EdgeInsets.only(top: 4.0),
                                  child: Text(
                                    'Date: $dateStr $timeStr${waiter != null ? ' | Waiter: $waiter' : ''}${table != null ? ' | Table: $table' : ''}${room != null ? ' | Room: $room' : ''} | ${items.length} Distinct Item${items.length == 1 ? '' : 's'}',
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                ),
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(12),
                                    color: Colors.grey.shade50,
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.stretch,
                                      children: [
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            const Text('POS Itemized Breakdown',
                                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.kPrimary)),
                                            ElevatedButton.icon(
                                              onPressed: () => _printBillReceipt(context, b),
                                              icon: const Icon(Icons.print_outlined, size: 16),
                                              label: const Text('Print Official Bill / Receipt'),
                                              style: ElevatedButton.styleFrom(
                                                backgroundColor: AppColors.kPrimary,
                                                foregroundColor: Colors.white,
                                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                                textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        Table(
                                          border: TableBorder.all(color: Colors.grey.shade300, width: 0.8),
                                          columnWidths: const {
                                            0: FlexColumnWidth(4),
                                            1: FlexColumnWidth(1),
                                            2: FlexColumnWidth(2),
                                            3: FlexColumnWidth(2),
                                          },
                                          children: [
                                            TableRow(
                                              decoration: BoxDecoration(color: Colors.grey.shade200),
                                              children: const [
                                                Padding(padding: EdgeInsets.all(6), child: Text('Item Name', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                                                Padding(padding: EdgeInsets.all(6), child: Text('Qty', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                                                Padding(padding: EdgeInsets.all(6), child: Text('Unit Price (KES)', textAlign: TextAlign.right, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                                                Padding(padding: EdgeInsets.all(6), child: Text('Total (KES)', textAlign: TextAlign.right, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                                              ],
                                            ),
                                            ...items.map((it) {
                                              final name = it['name'] ?? 'Item';
                                              final qty = it['quantity'] ?? 1;
                                              final unitPrice = double.tryParse(it['unit_price']?.toString() ?? '0') ?? 0.0;
                                              final tot = double.tryParse(it['total_price']?.toString() ?? '0') ?? (qty * unitPrice);
                                              return TableRow(
                                                children: [
                                                  Padding(padding: const EdgeInsets.all(6), child: Text('$name', style: const TextStyle(fontSize: 12))),
                                                  Padding(padding: const EdgeInsets.all(6), child: Text('$qty', textAlign: TextAlign.center, style: const TextStyle(fontSize: 12))),
                                                  Padding(padding: const EdgeInsets.all(6), child: Text(NumberFormat('#,##0.00').format(unitPrice), textAlign: TextAlign.right, style: const TextStyle(fontSize: 12))),
                                                  Padding(padding: const EdgeInsets.all(6), child: Text(NumberFormat('#,##0.00').format(tot), textAlign: TextAlign.right, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
                                                ],
                                              );
                                            }),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, _) => Center(child: Text('Error loading corporate folio: $err')),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(child: Text('Error loading corporate customers: $err')),
    );
  }

  Widget _kpiChip(String label, double amount, Color textColor, Color bgColor, {bool isBold = false}) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: textColor.withValues(alpha: 0.2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: textColor.withValues(alpha: 0.8))),
            const SizedBox(height: 2),
            Text(
              'KES ${NumberFormat('#,##0.00').format(amount)}',
              style: TextStyle(
                fontSize: 13,
                fontWeight: isBold ? FontWeight.w900 : FontWeight.w700,
                color: textColor,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statusPill(String status) {
    Color bg;
    Color fg;
    if (status == 'PAID') {
      bg = Colors.green.shade100;
      fg = Colors.green.shade900;
    } else if (status == 'INVOICED') {
      bg = Colors.blue.shade100;
      fg = Colors.blue.shade900;
    } else {
      bg = Colors.orange.shade100;
      fg = Colors.orange.shade900;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(status, style: TextStyle(color: fg, fontWeight: FontWeight.bold, fontSize: 10)),
    );
  }
}

// -------------------------------------------------------------
// UNINVOICED BILLS TAB
// -------------------------------------------------------------
class _PendingBillsTab extends ConsumerStatefulWidget {
  const _PendingBillsTab({this.onInvoiceGenerated});

  final VoidCallback? onInvoiceGenerated;

  @override
  ConsumerState<_PendingBillsTab> createState() => _PendingBillsTabState();
}

class _PendingBillsTabState extends ConsumerState<_PendingBillsTab> {
  final Set<String> _selectedBills = {};
  bool _generating = false;

  Future<void> _generateInvoice(String customerId) async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    setState(() => _generating = true);
    try {
      await repo.generateCorporateInvoice({
        'corporate_customer_id': customerId,
        'bill_ids': _selectedBills.toList(),
      });
      ref.invalidate(pendingCorporateBillsProvider);
      ref.invalidate(corporateInvoicesProvider);
      ref.invalidate(corporateFolioBillsProvider);
      if (mounted) {
        setState(() {
          _generating = false;
          _selectedBills.clear();
        });
        AppNotifier.showSnackBar(context, const SnackBar(content: Text('Corporate Invoice Generated Successfully!'), backgroundColor: AppColors.kSuccess));
        widget.onInvoiceGenerated?.call();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _generating = false);
        AppNotifier.showSnackBar(context, SnackBar(content: Text('Failed to generate invoice: $e'), backgroundColor: AppColors.kError));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final asyncData = ref.watch(pendingCorporateBillsProvider);
    return asyncData.when(
      data: (bills) {
        if (bills.isEmpty) {
          return const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.check_circle_outline, size: 64, color: AppColors.kSuccess),
                SizedBox(height: 12),
                Text('All Corporate Bills Are Invoiced!', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                SizedBox(height: 6),
                Text('No pending uninvoiced bills remaining.', style: TextStyle(color: AppColors.kTextSecondary)),
              ],
            ),
          );
        }

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
            final cName = cBills.first['corporate_customers']?['name'] ?? 'Unknown Company';
            final cTotal = cBills.fold<double>(0.0, (sum, b) => sum + (double.tryParse(b['amount']?.toString() ?? '0') ?? 0.0));

            final selectedForCustomer = cBills.where((b) => _selectedBills.contains('${b['id']}')).toList();
            final selectedTotal = selectedForCustomer.fold<double>(0.0, (sum, b) => sum + (double.tryParse(b['amount']?.toString() ?? '0') ?? 0.0));
            final allSelected = cBills.every((b) => _selectedBills.contains('${b['id']}'));

            return Card(
              elevation: 2,
              margin: const EdgeInsets.only(bottom: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              child: ExpansionTile(
                initiallyExpanded: true,
                title: Row(
                  children: [
                    Expanded(
                      child: Text(
                        cName,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.orange.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'Uninvoiced: KES ${NumberFormat('#,##0.00').format(cTotal)}',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.orange.shade900),
                      ),
                    ),
                  ],
                ),
                subtitle: Text('${cBills.length} pending bill${cBills.length == 1 ? '' : 's'}', style: const TextStyle(fontSize: 13)),
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        TextButton.icon(
                          onPressed: () {
                            setState(() {
                              if (allSelected) {
                                for (final b in cBills) {
                                  _selectedBills.remove('${b['id']}');
                                }
                              } else {
                                for (final b in cBills) {
                                  _selectedBills.add('${b['id']}');
                                }
                              }
                            });
                          },
                          icon: Icon(allSelected ? Icons.deselect : Icons.select_all, size: 18),
                          label: Text(allSelected ? 'Deselect All' : 'Select All (${cBills.length})'),
                        ),
                        if (selectedForCustomer.isNotEmpty)
                          Text('Selected: ${selectedForCustomer.length} bills · KES ${NumberFormat('#,##0.00').format(selectedTotal)}',
                              style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.kPrimary)),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  ...cBills.map((b) {
                    final bId = '${b['id']}';
                    final bNum = b['bill_number'] ?? 'BILL';
                    final bAmt = double.tryParse(b['amount']?.toString() ?? '0') ?? 0.0;
                    final bDate = b['created_at'] != null ? b['created_at'].toString().split('T')[0] : 'N/A';
                    final items = b['items'] as List? ?? [];
                    final isChecked = _selectedBills.contains(bId);

                    return Column(
                      children: [
                        CheckboxListTile(
                          value: isChecked,
                          activeColor: AppColors.kPrimary,
                          title: Row(
                            children: [
                              Text(bNum, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                              const Spacer(),
                              Text('KES ${NumberFormat('#,##0.00').format(bAmt)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.kPrimary)),
                            ],
                          ),
                          subtitle: Text(
                            'Date: $bDate${b['waiter_name'] != null ? ' | Waiter: ${b['waiter_name']}' : ''} | Items: ${items.map((i) => "${i['quantity']}x ${i['name']}").join(", ")}',
                            style: const TextStyle(fontSize: 12),
                          ),
                          onChanged: (v) {
                            setState(() {
                              if (v == true) {
                                _selectedBills.add(bId);
                              } else {
                                _selectedBills.remove(bId);
                              }
                            });
                          },
                        ),
                        const Divider(height: 1, indent: 16, endIndent: 16),
                      ],
                    );
                  }),
                  if (selectedForCustomer.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Invoice Total: KES ${NumberFormat('#,##0.00').format(selectedTotal)} (${selectedForCustomer.length} Bills)',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                          ElevatedButton.icon(
                            onPressed: _generating ? null : () => _generateInvoice(cId),
                            icon: const Icon(Icons.receipt_long),
                            label: _generating
                                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : const Text('Generate Corporate Invoice'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.kPrimary,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                            ),
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
      error: (err, _) => Center(child: Text('Error loading pending bills: $err')),
    );
  }
}

// -------------------------------------------------------------
// INVOICES TAB (Uses Official Guest Invoice PDF with Logo)
// -------------------------------------------------------------
class _InvoicesTab extends ConsumerWidget {
  const _InvoicesTab();

  Future<void> _exportGuestInvoicePdf(BuildContext context, Map<String, dynamic> inv) async {
    final invNum = inv['invoice_number']?.toString() ?? 'INV-000';
    final comp = inv['corporate_customers'] as Map<String, dynamic>? ?? {};
    final compName = comp['name']?.toString() ?? 'Corporate Client';
    final compPhone = comp['phone']?.toString();
    final compEmail = comp['email']?.toString();
    final amountDue = double.tryParse(inv['amount_due']?.toString() ?? '0') ?? 0.0;
    final amountPaid = double.tryParse(inv['amount_paid']?.toString() ?? '0') ?? 0.0;
    final balance = amountDue - amountPaid;
    final invDate = inv['created_at'] != null ? inv['created_at'].toString().split('T')[0] : 'N/A';
    final dueDate = inv['due_date'] != null ? inv['due_date'].toString().split('T')[0] : 'N/A';
    final status = inv['status']?.toString() ?? 'UNPAID';

    // Format item lines using non-duplicated items from bills
    final rawItems = inv['items'] as List? ?? [];
    final invoiceItems = rawItems.map((it) {
      final desc = it['description'] ?? it['item_name'] ?? it['name'] ?? 'POS Item';
      final qty = (it['qty'] ?? it['quantity'] as num?)?.toInt() ?? 1;
      final unitPrice = (it['unitPrice'] ?? it['unit_price'] as num?)?.toDouble() ?? 0.0;
      final total = (it['totalAmount'] ?? it['total_price'] as num?)?.toDouble() ?? (qty * unitPrice);
      return {
        'description': desc,
        'qty': qty,
        'unitPrice': unitPrice,
        'totalAmount': total,
      };
    }).toList();

    if (invoiceItems.isEmpty) {
      invoiceItems.add({
        'description': 'Corporate Bill Settlement ($invNum)',
        'qty': 1,
        'unitPrice': amountDue,
        'totalAmount': amountDue,
      });
    }

    try {
      await printBookingInvoicePDF(
        context: context,
        invoiceNumber: invNum,
        invoiceDate: invDate,
        dueDate: dueDate,
        clientName: compName,
        clientPhone: compPhone,
        clientDetails: 'Corporate Credit Account${compEmail != null && compEmail.isNotEmpty ? ' | $compEmail' : ''}',
        items: invoiceItems,
        totalAmount: amountDue,
        amountPaid: amountPaid,
        balanceDue: balance,
        asReceipt: status == 'PAID',
      );
    } catch (e) {
      if (context.mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text('Error printing invoice PDF: $e'), backgroundColor: AppColors.kError));
      }
    }
  }

  Future<void> _payInvoice(BuildContext context, WidgetRef ref, String id, double amountDue) async {
    final amountCtrl = TextEditingController(text: amountDue.toStringAsFixed(0));
    final confirmed = await showDialog<double>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.payments, color: AppColors.kPrimary),
            SizedBox(width: 8),
            Text('Record Invoice Payment'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Outstanding Amount: KES ${NumberFormat('#,##0.00').format(amountDue)}', style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 14),
            TextField(
              controller: amountCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Amount Paying Now (KES)',
                prefixIcon: Icon(Icons.attach_money),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.kPrimary, foregroundColor: Colors.white),
            onPressed: () {
              final val = double.tryParse(amountCtrl.text.trim());
              if (val != null && val > 0) {
                Navigator.pop(ctx, val);
              }
            },
            child: const Text('Confirm Payment'),
          ),
        ],
      ),
    );

    if (confirmed == null || confirmed <= 0) return;

    final repo = ref.read(branchAccountantRepositoryProvider);
    try {
      await repo.payCorporateInvoice(id, {'amount': confirmed});
      ref.invalidate(corporateInvoicesProvider);
      ref.invalidate(corporateFolioBillsProvider);
      if (context.mounted) {
        AppNotifier.showSnackBar(context, const SnackBar(content: Text('Payment recorded successfully!'), backgroundColor: AppColors.kSuccess));
      }
    } catch (e) {
      if (context.mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text('Payment failed: $e'), backgroundColor: AppColors.kError));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(corporateInvoicesProvider);
    return asyncData.when(
      data: (invoices) {
        if (invoices.isEmpty) {
          return const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.description_outlined, size: 64, color: AppColors.kTextSecondary),
                SizedBox(height: 12),
                Text('No Corporate Invoices Generated Yet', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                SizedBox(height: 6),
                Text('Go to "Uninvoiced Bills" tab to select bills and generate an invoice.', style: TextStyle(color: AppColors.kTextSecondary)),
              ],
            ),
          );
        }

        return ListView.builder(
          itemCount: invoices.length,
          padding: const EdgeInsets.all(16),
          itemBuilder: (context, index) {
            final inv = invoices[index];
            final status = inv['status'] ?? 'UNPAID';
            final comp = inv['corporate_customers'] as Map<String, dynamic>? ?? {};
            final amountDue = double.tryParse(inv['amount_due']?.toString() ?? '0') ?? 0.0;
            final amountPaid = double.tryParse(inv['amount_paid']?.toString() ?? '0') ?? 0.0;
            final balance = amountDue - amountPaid;
            final dueDate = inv['due_date'] != null ? inv['due_date'].toString().split('T')[0] : 'N/A';
            final invDate = inv['created_at'] != null ? inv['created_at'].toString().split('T')[0] : 'N/A';
            final bills = inv['bills'] as List? ?? [];

            return Card(
              elevation: 2,
              margin: const EdgeInsets.only(bottom: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
                side: BorderSide(
                  color: status == 'PAID' ? Colors.green.shade200 : Colors.grey.shade300,
                ),
              ),
              child: ExpansionTile(
                leading: CircleAvatar(
                  backgroundColor: status == 'PAID'
                      ? Colors.green.withValues(alpha: 0.1)
                      : status == 'PARTIAL'
                          ? Colors.orange.withValues(alpha: 0.1)
                          : Colors.red.withValues(alpha: 0.1),
                  child: Icon(
                    Icons.description_outlined,
                    color: status == 'PAID'
                        ? Colors.green
                        : status == 'PARTIAL'
                            ? Colors.orange.shade800
                            : Colors.red.shade800,
                  ),
                ),
                title: Row(
                  children: [
                    Text(inv['invoice_number'] ?? 'INV', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(width: 8),
                    Text('· ${comp['name'] ?? 'Corporate Account'}', style: const TextStyle(fontSize: 14, color: AppColors.kTextSecondary)),
                    const Spacer(),
                    _invoiceStatusChip(status),
                    const SizedBox(width: 12),
                    Text('KES ${NumberFormat('#,##0.00').format(amountDue)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.kPrimary)),
                  ],
                ),
                subtitle: Padding(
                  padding: const EdgeInsets.only(top: 4.0),
                  child: Text(
                    'Date: $invDate | Due: $dueDate | Paid: KES ${NumberFormat('#,##0.00').format(amountPaid)} | Balance: KES ${NumberFormat('#,##0.00').format(balance)}',
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.print_outlined, color: AppColors.kPrimary, size: 22),
                      tooltip: 'Print Official Guest Invoice (with Logo)',
                      onPressed: () => _exportGuestInvoicePdf(context, inv),
                    ),
                    if (status != 'PAID') ...[
                      const SizedBox(width: 4),
                      IconButton(
                        icon: const Icon(Icons.payment, color: Colors.green, size: 22),
                        tooltip: 'Record Payment',
                        onPressed: () => _payInvoice(context, ref, '${inv['id']}', balance),
                      ),
                    ],
                  ],
                ),
                children: [
                  if (bills.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.all(12),
                      color: Colors.grey.shade50,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Included POS Bills & Items:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.kPrimary)),
                          const SizedBox(height: 8),
                          ...bills.map((b) {
                            final bNum = b['bill_number'] ?? 'BILL';
                            final bAmt = double.tryParse(b['amount']?.toString() ?? '0') ?? 0.0;
                            final bItems = b['items'] as List? ?? [];
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 6.0),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(Icons.check_circle_outline, size: 14, color: AppColors.kPrimary),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      '$bNum — KES ${NumberFormat('#,##0.00').format(bAmt)} (${bItems.map((it) => "${it['quantity']}x ${it['name']}").join(", ")})',
                                      style: const TextStyle(fontSize: 12),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                ],
              ),
            );
          },
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(child: Text('Error loading invoices: $err')),
    );
  }

  Widget _invoiceStatusChip(String status) {
    Color bg;
    Color fg;
    if (status == 'PAID') {
      bg = Colors.green.shade100;
      fg = Colors.green.shade900;
    } else if (status == 'PARTIAL') {
      bg = Colors.orange.shade100;
      fg = Colors.orange.shade900;
    } else {
      bg = Colors.red.shade100;
      fg = Colors.red.shade900;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(status, style: TextStyle(color: fg, fontWeight: FontWeight.bold, fontSize: 10)),
    );
  }
}
