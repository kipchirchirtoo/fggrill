import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../domain/admin_providers.dart';
import '../../data/models/supplier.dart';
import '../widgets/admin_table.dart';
import 'package:famous_gates_app/features/admin/data/admin_repository.dart';

final _suppliersSearchProvider = StateProvider<String>((ref) => '');

class SuppliersSection extends ConsumerStatefulWidget {
  const SuppliersSection({super.key});

  @override
  ConsumerState<SuppliersSection> createState() => _SuppliersSectionState();
}

class _SuppliersSectionState extends ConsumerState<SuppliersSection> {
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final suppliersAsync = ref.watch(adminSuppliersProvider);
    final search = ref.watch(_suppliersSearchProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: AppColors.kDivider)),
          ),
          child: Row(
            children: [
              SizedBox(
                width: 300,
                child: TextField(
                  controller: _searchCtrl,
                  decoration: InputDecoration(
                    hintText: 'Search suppliers...',
                    prefixIcon: Icon(PhosphorIcons.magnifyingGlass(), size: 18),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                  ),
                  onChanged: (v) =>
                      ref.read(_suppliersSearchProvider.notifier).state = v,
                ),
              ),
              const Spacer(),
              ElevatedButton.icon(
                onPressed: () => _showSupplierDialog(),
                icon: Icon(PhosphorIcons.plus(), size: 18),
                label: const Text('Add Supplier'),
                style:
                    ElevatedButton.styleFrom(minimumSize: const Size(160, 40)),
              ),
            ],
          ),
        ),
        Expanded(
          child: suppliersAsync.when(
            loading: () => const LoadingSkeleton(type: SkeletonType.table),
            error: (e, _) => ErrorState(
              message: '$e',
              onRetry: () => ref.invalidate(adminSuppliersProvider),
            ),
            data: (suppliers) {
              final filtered = search.isEmpty
                  ? suppliers
                  : suppliers
                      .where((s) =>
                          s.name.toLowerCase().contains(search.toLowerCase()) ||
                          s.contactPerson
                              .toLowerCase()
                              .contains(search.toLowerCase()) ||
                          s.email
                              .toLowerCase()
                              .contains(search.toLowerCase()) ||
                          s.phone.contains(search))
                      .toList();

              if (filtered.isEmpty) {
                return Center(
                  child: EmptyState(
                      message: 'No suppliers found',
                      icon: PhosphorIcons.truck()),
                );
              }

              return SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Suppliers',
                        style: Theme.of(context).textTheme.displaySmall),
                    const SizedBox(height: 16),
                    AdminTable(
                      columns: const [
                        'Name',
                        'Contact Person',
                        'Phone',
                        'Email',
                        'Items Supplied',
                        'Balance',
                        'Status',
                        'Actions'
                      ],
                      rows: filtered
                          .map((s) => [
                                Text(s.name,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w500)),
                                Text(s.contactPerson,
                                    style: const TextStyle(fontSize: 12)),
                                Text(s.phone,
                                    style: const TextStyle(fontSize: 12)),
                                Text(s.email,
                                    style: const TextStyle(fontSize: 12)),
                                Text('${s.itemCount} items'),
                                Text('KES ${s.balance.toStringAsFixed(0)}',
                                    style: TextStyle(
                                        color: s.balance > 0
                                            ? AppColors.kError
                                            : AppColors.kSuccess,
                                        fontSize: 12)),
                                StatusBadge(status: s.status),
                                IconButton(
                                  icon: Icon(PhosphorIcons.pencilLine(),
                                      size: 16),
                                  onPressed: () =>
                                      _showSupplierDialog(supplier: s),
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(),
                                ),
                              ])
                          .toList(),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  void _showSupplierDialog({AdminSupplier? supplier}) {
    final nameCtrl = TextEditingController(text: supplier?.name ?? '');
    final contactCtrl =
        TextEditingController(text: supplier?.contactPerson ?? '');
    final phoneCtrl = TextEditingController(text: supplier?.phone ?? '');
    final emailCtrl = TextEditingController(text: supplier?.email ?? '');
    final addressCtrl = TextEditingController(text: supplier?.address ?? '');
    final termsCtrl = TextEditingController(text: supplier?.paymentTerms ?? '');
    final itemsCtrl =
        TextEditingController(text: '${supplier?.itemCount ?? 0}');

    final isEditing = supplier != null;
    final title = isEditing ? 'Edit Supplier' : 'Add Supplier';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Company Name')),
              const SizedBox(height: 12),
              TextField(
                  controller: contactCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Contact Person')),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                      child: TextField(
                          controller: phoneCtrl,
                          decoration: const InputDecoration(labelText: 'Phone'),
                          keyboardType: TextInputType.phone)),
                  const SizedBox(width: 12),
                  Expanded(
                      child: TextField(
                          controller: emailCtrl,
                          decoration: const InputDecoration(labelText: 'Email'),
                          keyboardType: TextInputType.emailAddress)),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                  controller: addressCtrl,
                  decoration: const InputDecoration(labelText: 'Address')),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                      child: TextField(
                          controller: termsCtrl,
                          decoration: const InputDecoration(
                              labelText: 'Payment Terms'))),
                  const SizedBox(width: 12),
                  Expanded(
                      child: TextField(
                          controller: itemsCtrl,
                          decoration: const InputDecoration(
                              labelText: 'Items Supplied'),
                          keyboardType: TextInputType.number)),
                ],
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (nameCtrl.text.isEmpty) return;
              final data = {
                'name': nameCtrl.text,
                'contact_person': contactCtrl.text,
                'phone': phoneCtrl.text,
                'email': emailCtrl.text,
                'address': addressCtrl.text,
                'payment_terms': termsCtrl.text,
              };
              if (isEditing) {
                await ref
                    .read(adminRepositoryProvider)
                    .updateSupplier(supplier.id, data);
              } else {
                await ref.read(adminRepositoryProvider).createSupplier(data);
              }
              if (ctx.mounted) Navigator.pop(ctx);
              ref.invalidate(adminSuppliersProvider);
            },
            child: Text(isEditing ? 'Update' : 'Save'),
          ),
        ],
      ),
    );
  }
}
