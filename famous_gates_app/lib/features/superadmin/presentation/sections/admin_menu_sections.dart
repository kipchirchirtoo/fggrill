import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:printing/printing.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';

import '../../../../core/services/services.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/api_error_message.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/loading_skeleton.dart';

List<dynamic> _rowsFrom(Map<String, dynamic> response) {
  final data = response['data'];
  if (data is List) return data;
  if (data is Map && data['data'] is List) return data['data'] as List;
  return const [];
}

String _text(Map<String, dynamic> row, String key, [String fallback = '']) {
  final value = row[key];
  if (value == null) return fallback;
  return value.toString();
}

double _number(Map<String, dynamic> row, String key) {
  final value = row[key];
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '') ?? 0;
}

Widget _dropdownText(String value) {
  return Text(
    value,
    overflow: TextOverflow.ellipsis,
    maxLines: 1,
  );
}

class RestaurantMenuAdminSection extends ConsumerStatefulWidget {
  const RestaurantMenuAdminSection({super.key});

  @override
  ConsumerState<RestaurantMenuAdminSection> createState() =>
      _RestaurantMenuAdminSectionState();
}

class _RestaurantMenuAdminSectionState
    extends ConsumerState<RestaurantMenuAdminSection> {
  String search = '';
  String categoryId = '';
  int? branchId;

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(_restaurantCategoriesProvider(branchId));
    final items = ref.watch(_restaurantMenuItemsProvider((
      categoryId.isEmpty ? null : categoryId,
      branchId,
    )));
    return _MenuScaffold(
      title: 'Restaurant Menu',
      subtitle: 'Manage restaurant menu items by branch and category',
      icon: PhosphorIcons.forkKnife(),
      actionLabel: 'Add Item',
      onAdd: () => _showRestaurantDialog(),
      filters: _buildFilters(categories),
      child: items.when(
        data: (response) {
          final rows = _rowsFrom(response).whereType<Map>().map((e) {
            return Map<String, dynamic>.from(e);
          }).where((item) {
            final name = _text(item, 'name').toLowerCase();
            return search.isEmpty || name.contains(search.toLowerCase());
          }).toList();
          return _AdminDataTable(
            emptyTitle: 'No restaurant menu items found',
            columns: const [
              DataColumn(label: Text('Name')),
              DataColumn(label: Text('Category')),
              DataColumn(label: Text('Branch')),
              DataColumn(label: Text('Price')),
              DataColumn(label: Text('Available')),
              DataColumn(label: Text('Actions')),
            ],
            rows: rows
                .map((item) => DataRow(cells: [
                      DataCell(Text(_text(item, 'name', '-'))),
                      DataCell(Text(_text(
                          item['category'] is Map
                              ? Map<String, dynamic>.from(item['category'])
                              : item,
                          'name',
                          _text(item, 'category_name', '-')))),
                      DataCell(Text(_text(item, 'branch_name', 'All'))),
                      DataCell(Text(
                          "KES ${_number(item, 'price').toStringAsFixed(2)}")),
                      DataCell(
                          _StatusChip(active: item['is_available'] != false)),
                      DataCell(_RowActions(
                        onEdit: () => _showRestaurantDialog(item: item),
                        onToggle: () => _toggleRestaurant(item),
                        onDelete: () => _deleteRestaurant(item),
                      )),
                    ]))
                .toList(),
          );
        },
        loading: () => const LoadingSkeleton(height: 420),
        error: (e, _) => ErrorState(
          message: apiErrorMessage(e),
          onRetry: () => ref.invalidate(_restaurantMenuItemsProvider),
        ),
      ),
    );
  }

  Widget _buildFilters(AsyncValue<Map<String, dynamic>> categories) {
    final branchRows = ref.watch(_adminBranchesProvider).maybeWhen(
          data: _rowsFrom,
          orElse: () => const <dynamic>[],
        );
    final categoryRows = categories.maybeWhen(
      data: _rowsFrom,
      orElse: () => const <dynamic>[],
    );
    return Wrap(spacing: 12, runSpacing: 12, children: [
      SizedBox(
        width: 260,
        child: TextField(
          decoration: const InputDecoration(
            prefixIcon: Icon(Icons.search),
            labelText: 'Search menu',
          ),
          onChanged: (value) => setState(() => search = value),
        ),
      ),
      SizedBox(
        width: 220,
        child: DropdownButtonFormField<String>(
          initialValue: categoryId.isEmpty ? '' : categoryId,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Category'),
          items: [
            DropdownMenuItem(value: '', child: _dropdownText('All categories')),
            ...categoryRows.whereType<Map>().map((row) {
              final item = Map<String, dynamic>.from(row);
              return DropdownMenuItem(
                value: _text(item, 'id'),
                child: _dropdownText(_text(item, 'name', 'Unnamed')),
              );
            }),
          ],
          onChanged: (value) => setState(() => categoryId = value ?? ''),
        ),
      ),
      SizedBox(
        width: 220,
        child: DropdownButtonFormField<int?>(
          initialValue: branchId,
          decoration: const InputDecoration(labelText: 'Branch'),
          items: [
            const DropdownMenuItem<int?>(
                value: null, child: Text('All branches')),
            ...branchRows.whereType<Map>().map((row) {
              final branch = Map<String, dynamic>.from(row);
              return DropdownMenuItem<int?>(
                value: int.tryParse(_text(branch, 'id')),
                child: Text(_text(branch, 'name', 'Branch')),
              );
            }),
          ],
          onChanged: (value) => setState(() => branchId = value),
        ),
      ),
    ]);
  }

  Future<void> _toggleRestaurant(Map<String, dynamic> item) async {
    try {
      await ref
          .read(restaurantServiceProvider)
          .toggleAdminMenuItemAvailability('${item['id']}');
      if (!mounted) return;
      ref.invalidate(_restaurantMenuItemsProvider);
    } catch (e) {
      if (!mounted) return;
      _snack(context, apiErrorMessage(e), error: true);
    }
  }

  Future<void> _deleteRestaurant(Map<String, dynamic> item) async {
    if (!await _confirm(context, 'Delete ${_text(item, 'name')}?')) return;
    try {
      await ref
          .read(restaurantServiceProvider)
          .deleteAdminMenuItem('${item['id']}');
      if (!mounted) return;
      ref.invalidate(_restaurantMenuItemsProvider);
    } catch (e) {
      if (!mounted) return;
      _snack(context, apiErrorMessage(e), error: true);
    }
  }

  Future<void> _showRestaurantDialog({Map<String, dynamic>? item}) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _RestaurantMenuDialog(item: item),
    );
    if (saved == true) ref.invalidate(_restaurantMenuItemsProvider);
  }
}

class BarMenuAdminSection extends ConsumerStatefulWidget {
  const BarMenuAdminSection({super.key});

  @override
  ConsumerState<BarMenuAdminSection> createState() =>
      _BarMenuAdminSectionState();
}

class _BarMenuAdminSectionState extends ConsumerState<BarMenuAdminSection> {
  String search = '';
  String categoryId = '';
  int? branchId;

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(_barCategoriesProvider(branchId));
    final drinks = ref.watch(_barDrinksProvider((
      categoryId.isEmpty ? null : categoryId,
      branchId,
    )));
    return _MenuScaffold(
      title: 'Bar Menu',
      subtitle: 'Manage bar drinks, prices, units and availability',
      icon: PhosphorIcons.wine(),
      actionLabel: 'Add Drink',
      onAdd: () => _showDrinkDialog(),
      filters: _buildFilters(categories),
      child: drinks.when(
        data: (response) {
          final rows = _rowsFrom(response).whereType<Map>().map((e) {
            return Map<String, dynamic>.from(e);
          }).where((item) {
            return search.isEmpty ||
                _text(item, 'name')
                    .toLowerCase()
                    .contains(search.toLowerCase());
          }).toList();
          return _AdminDataTable(
            emptyTitle: 'No bar drinks found',
            columns: const [
              DataColumn(label: Text('Drink')),
              DataColumn(label: Text('Category')),
              DataColumn(label: Text('Unit')),
              DataColumn(label: Text('Branch')),
              DataColumn(label: Text('Price')),
              DataColumn(label: Text('Available')),
              DataColumn(label: Text('Actions')),
            ],
            rows: rows
                .map((drink) => DataRow(cells: [
                      DataCell(Text(_text(drink, 'name', '-'))),
                      DataCell(Text(_text(drink, 'category_name', '-'))),
                      DataCell(Text(_text(drink, 'unit', '-'))),
                      DataCell(Text(_text(drink, 'branch_name', 'All'))),
                      DataCell(Text(
                          "KES ${_number(drink, 'price').toStringAsFixed(2)}")),
                      DataCell(
                          _StatusChip(active: drink['is_available'] != false)),
                      DataCell(_RowActions(
                        onEdit: () => _showDrinkDialog(drink: drink),
                        onToggle: () => _toggleDrink(drink),
                        onDelete: () => _deleteDrink(drink),
                      )),
                    ]))
                .toList(),
          );
        },
        loading: () => const LoadingSkeleton(height: 420),
        error: (e, _) => ErrorState(
          message: apiErrorMessage(e),
          onRetry: () => ref.invalidate(_barDrinksProvider),
        ),
      ),
    );
  }

  Widget _buildFilters(AsyncValue<Map<String, dynamic>> categories) {
    final branchRows = ref.watch(_adminBranchesProvider).maybeWhen(
          data: _rowsFrom,
          orElse: () => const <dynamic>[],
        );
    final categoryRows = categories.maybeWhen(
      data: _rowsFrom,
      orElse: () => const <dynamic>[],
    );
    return Wrap(spacing: 12, runSpacing: 12, children: [
      SizedBox(
        width: 260,
        child: TextField(
          decoration: const InputDecoration(
            prefixIcon: Icon(Icons.search),
            labelText: 'Search drinks',
          ),
          onChanged: (value) => setState(() => search = value),
        ),
      ),
      SizedBox(
        width: 220,
        child: DropdownButtonFormField<String>(
          initialValue: categoryId.isEmpty ? '' : categoryId,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Category'),
          items: [
            DropdownMenuItem(value: '', child: _dropdownText('All categories')),
            ...categoryRows.whereType<Map>().map((row) {
              final item = Map<String, dynamic>.from(row);
              return DropdownMenuItem(
                value: _text(item, 'id'),
                child: _dropdownText(_text(item, 'name', 'Unnamed')),
              );
            }),
          ],
          onChanged: (value) => setState(() => categoryId = value ?? ''),
        ),
      ),
      SizedBox(
        width: 220,
        child: DropdownButtonFormField<int?>(
          initialValue: branchId,
          decoration: const InputDecoration(labelText: 'Branch'),
          items: [
            const DropdownMenuItem<int?>(
                value: null, child: Text('All branches')),
            ...branchRows.whereType<Map>().map((row) {
              final branch = Map<String, dynamic>.from(row);
              return DropdownMenuItem<int?>(
                value: int.tryParse(_text(branch, 'id')),
                child: Text(_text(branch, 'name', 'Branch')),
              );
            }),
          ],
          onChanged: (value) => setState(() => branchId = value),
        ),
      ),
    ]);
  }

  Future<void> _toggleDrink(Map<String, dynamic> drink) async {
    try {
      await ref
          .read(barServiceProvider)
          .toggleDrinkAvailability('${drink['id']}');
      if (!mounted) return;
      ref.invalidate(_barDrinksProvider);
    } catch (e) {
      if (!mounted) return;
      _snack(context, apiErrorMessage(e), error: true);
    }
  }

  Future<void> _deleteDrink(Map<String, dynamic> drink) async {
    if (!await _confirm(context, 'Delete ${_text(drink, 'name')}?')) return;
    try {
      await ref.read(barServiceProvider).deleteDrink('${drink['id']}');
      if (!mounted) return;
      ref.invalidate(_barDrinksProvider);
    } catch (e) {
      if (!mounted) return;
      _snack(context, apiErrorMessage(e), error: true);
    }
  }

  Future<void> _showDrinkDialog({Map<String, dynamic>? drink}) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _BarDrinkDialog(drink: drink),
    );
    if (saved == true) ref.invalidate(_barDrinksProvider);
  }
}

class KyogongServicesAdminSection extends ConsumerStatefulWidget {
  const KyogongServicesAdminSection({super.key});

  @override
  ConsumerState<KyogongServicesAdminSection> createState() =>
      _KyogongServicesAdminSectionState();
}

class _KyogongServicesAdminSectionState
    extends ConsumerState<KyogongServicesAdminSection> {
  String search = '';
  String type = 'all';

  @override
  Widget build(BuildContext context) {
    final services = ref.watch(_kyogongDynamicServicesProvider);
    return _MenuScaffold(
      title: 'Kyogong Services',
      subtitle:
          'Manage dynamic Spa, Executive Bar, Sports Bar and Reception services',
      icon: PhosphorIcons.sparkle(),
      actionLabel: 'Add Service',
      onAdd: () => _showServiceDialog(),
      filters: Wrap(spacing: 12, runSpacing: 12, children: [
        SizedBox(
          width: 280,
          child: TextField(
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              labelText: 'Search services',
            ),
            onChanged: (value) => setState(() => search = value),
          ),
        ),
        SizedBox(
          width: 220,
          child: DropdownButtonFormField<String>(
            initialValue: type,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Service type'),
            items: [
              DropdownMenuItem(
                  value: 'all', child: _dropdownText('All services')),
              DropdownMenuItem(value: 'spa', child: _dropdownText('Spa')),
              DropdownMenuItem(
                  value: 'executive-bar',
                  child: _dropdownText('Executive Bar')),
              DropdownMenuItem(
                  value: 'sports-bar', child: _dropdownText('Sports Bar')),
              DropdownMenuItem(
                  value: 'reception', child: _dropdownText('Reception')),
            ],
            onChanged: (value) => setState(() => type = value ?? 'all'),
          ),
        ),
      ]),
      child: services.when(
        data: (response) {
          final rows = _rowsFrom(response).whereType<Map>().map((e) {
            return Map<String, dynamic>.from(e);
          }).where((service) {
            final matchesSearch = search.isEmpty ||
                _text(service, 'name')
                    .toLowerCase()
                    .contains(search.toLowerCase());
            final matchesType =
                type == 'all' || _text(service, 'service_type') == type;
            return matchesSearch && matchesType;
          }).toList();
          return _AdminDataTable(
            emptyTitle: 'No Kyogong services found',
            columns: const [
              DataColumn(label: Text('Service')),
              DataColumn(label: Text('Type')),
              DataColumn(label: Text('Pricing')),
              DataColumn(label: Text('Base Price')),
              DataColumn(label: Text('Per Hour')),
              DataColumn(label: Text('Active')),
              DataColumn(label: Text('Actions')),
            ],
            rows: rows
                .map((service) => DataRow(cells: [
                      DataCell(Text(_text(service, 'name', '-'))),
                      DataCell(Text(_text(service, 'service_type', '-'))),
                      DataCell(Text(_text(service, 'pricing_model', '-'))),
                      DataCell(Text(
                          "KES ${_number(service, 'base_price').toStringAsFixed(2)}")),
                      DataCell(Text(_number(service, 'price_per_hour') == 0
                          ? '-'
                          : "KES ${_number(service, 'price_per_hour').toStringAsFixed(2)}")),
                      DataCell(
                          _StatusChip(active: service['is_active'] != false)),
                      DataCell(_RowActions(
                        onEdit: () => _showServiceDialog(service: service),
                        onToggle: () => _toggleService(service),
                      )),
                    ]))
                .toList(),
          );
        },
        loading: () => const LoadingSkeleton(height: 420),
        error: (e, _) => ErrorState(
          message: apiErrorMessage(e),
          onRetry: () => ref.invalidate(_kyogongDynamicServicesProvider),
        ),
      ),
    );
  }

  Future<void> _toggleService(Map<String, dynamic> service) async {
    try {
      await ref.read(kyogongServiceProvider).updateDynamicService(
        '${service['id']}',
        {'is_active': service['is_active'] != true},
      );
      if (!mounted) return;
      ref.invalidate(_kyogongDynamicServicesProvider);
    } catch (e) {
      if (!mounted) return;
      _snack(context, apiErrorMessage(e), error: true);
    }
  }

  Future<void> _showServiceDialog({Map<String, dynamic>? service}) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _KyogongServiceDialog(service: service),
    );
    if (saved == true) ref.invalidate(_kyogongDynamicServicesProvider);
  }
}

class IDCardsAdminSection extends ConsumerStatefulWidget {
  const IDCardsAdminSection({super.key});

  @override
  ConsumerState<IDCardsAdminSection> createState() =>
      _IDCardsAdminSectionState();
}

class _IDCardsAdminSectionState extends ConsumerState<IDCardsAdminSection> {
  String search = '';
  int? branchId;
  bool batchPrinting = false;

  @override
  Widget build(BuildContext context) {
    final staff = ref.watch(_staffForCardsProvider);
    final branchRows = ref.watch(_adminBranchesProvider).maybeWhen(
          data: _rowsFrom,
          orElse: () => const <dynamic>[],
        );
    final branchNames = _branchNameMap(branchRows);
    return _MenuScaffold(
      title: 'ID Cards',
      subtitle: 'Preview, generate, print and maintain staff ID cards',
      icon: PhosphorIcons.identificationCard(),
      actionLabel: batchPrinting ? 'Printing...' : 'Batch Print',
      onAdd: batchPrinting ? null : _batchPrint,
      filters: _buildFilters(),
      child: staff.when(
        data: (response) {
          final rows = _rowsFrom(response).whereType<Map>().map((e) {
            return _normalizeIdCardStaff(
              Map<String, dynamic>.from(e),
              branchNames,
            );
          }).where((employee) {
            final haystack =
                '${_employeeName(employee)} ${_text(employee, 'employee_id')} ${_text(employee, 'id_number')}'
                    .toLowerCase();
            final matchesSearch =
                search.isEmpty || haystack.contains(search.toLowerCase());
            final matchesBranch = branchId == null ||
                _text(employee, 'branch_id') == branchId.toString();
            return matchesSearch && matchesBranch;
          }).toList();
          return _AdminDataTable(
            emptyTitle: 'No employees found for ID cards',
            columns: const [
              DataColumn(label: Text('Employee')),
              DataColumn(label: Text('Employee ID')),
              DataColumn(label: Text('Role')),
              DataColumn(label: Text('Branch')),
              DataColumn(label: Text('Phone')),
              DataColumn(label: Text('Photo')),
              DataColumn(label: Text('Actions')),
            ],
            rows: rows
                .map((employee) => DataRow(cells: [
                      DataCell(Text(_employeeName(employee))),
                      DataCell(Text(_text(employee, 'employee_id', '-'))),
                      DataCell(Text(_text(
                          employee, 'role', _text(employee, 'position', '-')))),
                      DataCell(Text(_text(employee, 'branch_name', '-'))),
                      DataCell(Text(_text(employee, 'phone_number', '-'))),
                      DataCell(_StatusChip(
                          active: _text(employee, 'profile_photo_url',
                                  _text(employee, 'profile_photo'))
                              .isNotEmpty,
                          activeText: 'Yes',
                          inactiveText: 'Missing')),
                      DataCell(Row(mainAxisSize: MainAxisSize.min, children: [
                        IconButton(
                          tooltip: 'Preview',
                          icon: Icon(PhosphorIcons.eye()),
                          onPressed: () => _preview(employee),
                        ),
                        IconButton(
                          tooltip: 'Download',
                          icon: Icon(PhosphorIcons.downloadSimple()),
                          onPressed: () => _download(employee),
                        ),
                        IconButton(
                          tooltip: 'Edit',
                          icon: Icon(PhosphorIcons.pencilSimple()),
                          onPressed: () => _edit(employee),
                        ),
                      ])),
                    ]))
                .toList(),
          );
        },
        loading: () => const LoadingSkeleton(height: 420),
        error: (e, _) => ErrorState(
          message: apiErrorMessage(e),
          onRetry: () => ref.invalidate(_staffForCardsProvider),
        ),
      ),
    );
  }

  Widget _buildFilters() {
    final branchRows = ref.watch(_adminBranchesProvider).maybeWhen(
          data: _rowsFrom,
          orElse: () => const <dynamic>[],
        );
    return Wrap(spacing: 12, runSpacing: 12, children: [
      SizedBox(
        width: 280,
        child: TextField(
          decoration: const InputDecoration(
            prefixIcon: Icon(Icons.search),
            labelText: 'Search staff',
          ),
          onChanged: (value) => setState(() => search = value),
        ),
      ),
      SizedBox(
        width: 220,
        child: DropdownButtonFormField<int?>(
          initialValue: branchId,
          decoration: const InputDecoration(labelText: 'Branch'),
          items: [
            const DropdownMenuItem<int?>(
                value: null, child: Text('All branches')),
            ...branchRows.whereType<Map>().map((row) {
              final branch = Map<String, dynamic>.from(row);
              return DropdownMenuItem<int?>(
                value: int.tryParse(_text(branch, 'id')),
                child: Text(_text(branch, 'name', 'Branch')),
              );
            }),
          ],
          onChanged: (value) => setState(() => branchId = value),
        ),
      ),
    ]);
  }

  Map<String, dynamic> _cardPayload(Map<String, dynamic> employee) => {
        'id': employee['id'],
        'employee_id': _text(employee, 'employee_id'),
        'name': _employeeName(employee),
        'role': _text(employee, 'role', _text(employee, 'position')),
        'department': _text(employee, 'department'),
        'branch': _text(employee, 'branch_name'),
        'phone': _text(employee, 'phone_number'),
        'photo_url': _text(
            employee, 'profile_photo_url', _text(employee, 'profile_photo')),
      };

  Future<void> _preview(Map<String, dynamic> employee) async {
    await _showPdf(employee, preview: true);
  }

  Future<void> _download(Map<String, dynamic> employee) async {
    await _showPdf(employee, preview: false);
  }

  Future<void> _showPdf(Map<String, dynamic> employee,
      {required bool preview}) async {
    try {
      final service = ref.read(idCardsServiceProvider);
      final bytes = preview
          ? await service.preview(_cardPayload(employee))
          : await service.generate(_cardPayload(employee));
      if (!mounted) return;
      if (preview) {
        await Printing.layoutPdf(onLayout: (_) async => bytes);
      } else {
        await Printing.sharePdf(
          bytes: bytes,
          filename: 'id-card-${_text(employee, 'employee_id', 'staff')}.pdf',
        );
      }
    } catch (e) {
      if (!mounted) return;
      _snack(context, apiErrorMessage(e), error: true);
    }
  }

  Future<void> _batchPrint() async {
    setState(() => batchPrinting = true);
    try {
      final response =
          await ref.read(staffServiceProvider).getStaff(limit: 5000);
      final branchRows = ref.read(_adminBranchesProvider).maybeWhen(
            data: _rowsFrom,
            orElse: () => const <dynamic>[],
          );
      final branchNames = _branchNameMap(branchRows);
      final rows = _rowsFrom(response)
          .whereType<Map>()
          .map((row) => _normalizeIdCardStaff(
              Map<String, dynamic>.from(row), branchNames))
          .take(25)
          .toList();
      if (rows.isEmpty) {
        if (!mounted) return;
        AppNotifier.showSnackBar(
          context,
          const SnackBar(content: Text('No staff records available')),
        );
        return;
      }
      final first = Map<String, dynamic>.from(rows.first);
      final bytes =
          await ref.read(idCardsServiceProvider).generate(_cardPayload(first));
      if (!mounted) return;
      await Printing.layoutPdf(onLayout: (_) async => bytes);
      if (!mounted) return;
      AppNotifier.showSnackBar(
        context,
        SnackBar(
          content: Text(
            'Printing ID card for ${_employeeName(first)}…',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      AppNotifier.showSnackBar(
        context,
        SnackBar(
          content: Text(apiErrorMessage(e)),
          backgroundColor: AppColors.kError,
        ),
      );
    } finally {
      if (mounted) setState(() => batchPrinting = false);
    }
  }

  Future<void> _edit(Map<String, dynamic> employee) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _StaffIdCardDialog(employee: employee),
    );
    if (saved == true) ref.invalidate(_staffForCardsProvider);
  }
}

final _adminBranchesProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.read(systemServiceProvider).getBranches();
});

final _restaurantCategoriesProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, int?>((ref, branchId) {
  return ref
      .read(restaurantServiceProvider)
      .getMenuCategories(branchId: branchId);
});

final _restaurantMenuItemsProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, (String?, int?)>((ref, args) {
  return ref.read(restaurantServiceProvider).getAdminMenuItems(
        categoryId: args.$1,
        branchId: args.$2,
      );
});

final _barCategoriesProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, int?>((ref, branchId) {
  return ref.read(barServiceProvider).getAdminCategories(branchId: branchId);
});

final _barDrinksProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, (String?, int?)>((ref, args) {
  return ref.read(barServiceProvider).getDrinks(
        categoryId: args.$1,
        branchId: args.$2,
      );
});

final _kyogongDynamicServicesProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.read(kyogongServiceProvider).getDynamicServices();
});

final _staffForCardsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.read(staffServiceProvider).getStaff(limit: 5000);
});

class _MenuScaffold extends StatelessWidget {
  const _MenuScaffold({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.actionLabel,
    required this.onAdd,
    required this.filters,
    required this.child,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final String actionLabel;
  final VoidCallback? onAdd;
  final Widget filters;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: AppColors.kPrimary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: AppColors.kPrimary, size: 26),
          ),
          const SizedBox(width: 16),
          Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title,
                  style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      letterSpacing: -0.5)),
              const SizedBox(height: 4),
              Text(subtitle,
                  style: TextStyle(fontSize: 14, color: Colors.grey.shade600)),
            ]),
          ),
          ElevatedButton.icon(
            onPressed: onAdd,
            icon: Icon(PhosphorIcons.plus(), size: 18),
            label: Text(actionLabel),
          ),
        ]),
        const SizedBox(height: 20),
        filters,
        const SizedBox(height: 20),
        child,
      ]),
    );
  }
}

class _AdminDataTable extends StatelessWidget {
  const _AdminDataTable({
    required this.columns,
    required this.rows,
    required this.emptyTitle,
  });

  final List<DataColumn> columns;
  final List<DataRow> rows;
  final String emptyTitle;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(48),
        decoration: _cardDecoration(),
        child: Column(children: [
          Icon(PhosphorIcons.package(), color: Colors.grey.shade400, size: 42),
          const SizedBox(height: 12),
          Text(emptyTitle,
              style:
                  const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        ]),
      );
    }
    return Container(
      width: double.infinity,
      decoration: _cardDecoration(),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(columns: columns, rows: rows),
      ),
    );
  }
}

class _RowActions extends StatelessWidget {
  const _RowActions({this.onEdit, this.onToggle, this.onDelete});

  final VoidCallback? onEdit;
  final VoidCallback? onToggle;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      if (onEdit != null)
        IconButton(
          tooltip: 'Edit',
          onPressed: onEdit,
          icon: Icon(PhosphorIcons.pencilSimple(), size: 18),
        ),
      if (onToggle != null)
        IconButton(
          tooltip: 'Toggle availability',
          onPressed: onToggle,
          icon: Icon(PhosphorIcons.arrowsClockwise(), size: 18),
        ),
      if (onDelete != null)
        IconButton(
          tooltip: 'Delete',
          onPressed: onDelete,
          icon: Icon(PhosphorIcons.trash(), color: AppColors.kError, size: 18),
        ),
    ]);
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.active,
    this.activeText = 'Active',
    this.inactiveText = 'Inactive',
  });

  final bool active;
  final String activeText;
  final String inactiveText;

  @override
  Widget build(BuildContext context) {
    final color = active ? const Color(0xFF059669) : AppColors.kError;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(active ? activeText : inactiveText,
          style: TextStyle(
              color: color, fontWeight: FontWeight.w700, fontSize: 12)),
    );
  }
}

class _RestaurantMenuDialog extends ConsumerStatefulWidget {
  const _RestaurantMenuDialog({this.item});
  final Map<String, dynamic>? item;

  @override
  ConsumerState<_RestaurantMenuDialog> createState() =>
      _RestaurantMenuDialogState();
}

class _RestaurantMenuDialogState extends ConsumerState<_RestaurantMenuDialog> {
  final formKey = GlobalKey<FormState>();
  late final name =
      TextEditingController(text: _text(widget.item ?? {}, 'name'));
  late final description =
      TextEditingController(text: _text(widget.item ?? {}, 'description'));
  late final price = TextEditingController(
      text: widget.item == null
          ? ''
          : _number(widget.item!, 'price') > 0
              ? _number(widget.item!, 'price').toStringAsFixed(2)
              : '');
  String? categoryId;
  int? branchId;
  bool saving = false;

  @override
  void initState() {
    super.initState();
    categoryId = _text(widget.item ?? {}, 'category_id').isEmpty
        ? null
        : _text(widget.item ?? {}, 'category_id');
    branchId = int.tryParse(_text(widget.item ?? {}, 'branch_id'));
  }

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(_restaurantCategoriesProvider(branchId));
    final branches = ref.watch(_adminBranchesProvider);
    return AlertDialog(
      title: Text(
          widget.item == null ? 'Add Restaurant Item' : 'Edit Restaurant Item'),
      content: SizedBox(
        width: 520,
        child: Form(
          key: formKey,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextFormField(
                controller: name,
                decoration: const InputDecoration(labelText: 'Name *'),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: description,
                decoration: const InputDecoration(labelText: 'Description'),
                maxLines: 2,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: price,
                decoration: const InputDecoration(labelText: 'Price *'),
                keyboardType: TextInputType.number,
                validator: (v) => (double.tryParse(v ?? '') == null)
                    ? 'Enter valid price'
                    : null,
              ),
              const SizedBox(height: 12),
              _BranchSelect(
                branches: branches,
                value: branchId,
                onChanged: (v) => setState(() => branchId = v),
              ),
              const SizedBox(height: 12),
              _CategorySelect(
                categories: categories,
                value: categoryId,
                onChanged: (v) => setState(() => categoryId = v),
              ),
            ]),
          ),
        ),
      ),
      actions: _dialogActions(
        context,
        saving,
        () async {
          if (!formKey.currentState!.validate()) return;
          setState(() => saving = true);
          try {
            final payload = {
              'name': name.text.trim(),
              'description': description.text.trim(),
              'price': double.parse(price.text),
              'category_id': categoryId,
              'branch_id': branchId,
            };
            if (widget.item == null) {
              await ref
                  .read(restaurantServiceProvider)
                  .createAdminMenuItem(payload);
            } else {
              await ref
                  .read(restaurantServiceProvider)
                  .updateAdminMenuItem('${widget.item!['id']}', payload);
            }
            if (context.mounted) Navigator.pop(context, true);
          } catch (e) {
            if (context.mounted) {
              _snack(context, apiErrorMessage(e), error: true);
            }
          } finally {
            if (mounted) setState(() => saving = false);
          }
        },
      ),
    );
  }
}

class _BarDrinkDialog extends ConsumerStatefulWidget {
  const _BarDrinkDialog({this.drink});
  final Map<String, dynamic>? drink;

  @override
  ConsumerState<_BarDrinkDialog> createState() => _BarDrinkDialogState();
}

class _BarDrinkDialogState extends ConsumerState<_BarDrinkDialog> {
  final formKey = GlobalKey<FormState>();
  late final name =
      TextEditingController(text: _text(widget.drink ?? {}, 'name'));
  late final description =
      TextEditingController(text: _text(widget.drink ?? {}, 'description'));
  late final price = TextEditingController(
      text: widget.drink == null
          ? ''
          : _number(widget.drink!, 'price') > 0
              ? _number(widget.drink!, 'price').toStringAsFixed(2)
              : '');
  late final unit =
      TextEditingController(text: _text(widget.drink ?? {}, 'unit', 'bottle'));
  String? categoryId;
  int? branchId;
  bool saving = false;

  @override
  void initState() {
    super.initState();
    categoryId = _text(widget.drink ?? {}, 'category_id').isEmpty
        ? null
        : _text(widget.drink ?? {}, 'category_id');
    branchId = int.tryParse(_text(widget.drink ?? {}, 'branch_id'));
  }

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(_barCategoriesProvider(branchId));
    final branches = ref.watch(_adminBranchesProvider);
    return AlertDialog(
      title: Text(widget.drink == null ? 'Add Drink' : 'Edit Drink'),
      content: SizedBox(
        width: 520,
        child: Form(
          key: formKey,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextFormField(
                controller: name,
                decoration: const InputDecoration(labelText: 'Name *'),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: description,
                decoration: const InputDecoration(labelText: 'Description'),
                maxLines: 2,
              ),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                  child: TextFormField(
                    controller: price,
                    decoration: const InputDecoration(labelText: 'Price *'),
                    keyboardType: TextInputType.number,
                    validator: (v) => (double.tryParse(v ?? '') == null)
                        ? 'Enter valid price'
                        : null,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: unit,
                    decoration: const InputDecoration(labelText: 'Unit *'),
                    validator: (v) =>
                        (v == null || v.trim().isEmpty) ? 'Required' : null,
                  ),
                ),
              ]),
              const SizedBox(height: 12),
              _BranchSelect(
                branches: branches,
                value: branchId,
                onChanged: (v) => setState(() => branchId = v),
              ),
              const SizedBox(height: 12),
              _CategorySelect(
                categories: categories,
                value: categoryId,
                onChanged: (v) => setState(() => categoryId = v),
              ),
            ]),
          ),
        ),
      ),
      actions: _dialogActions(context, saving, () async {
        if (!formKey.currentState!.validate()) return;
        setState(() => saving = true);
        try {
          final payload = {
            'name': name.text.trim(),
            'description': description.text.trim(),
            'price': double.parse(price.text),
            'unit': unit.text.trim(),
            'category_id': categoryId,
            'branch_id': branchId,
          };
          if (widget.drink == null) {
            await ref.read(barServiceProvider).createDrink(payload);
          } else {
            await ref
                .read(barServiceProvider)
                .updateDrink('${widget.drink!['id']}', payload);
          }
          if (context.mounted) Navigator.pop(context, true);
        } catch (e) {
          if (context.mounted) _snack(context, apiErrorMessage(e), error: true);
        } finally {
          if (mounted) setState(() => saving = false);
        }
      }),
    );
  }
}

class _KyogongServiceDialog extends ConsumerStatefulWidget {
  const _KyogongServiceDialog({this.service});
  final Map<String, dynamic>? service;

  @override
  ConsumerState<_KyogongServiceDialog> createState() =>
      _KyogongServiceDialogState();
}

class _KyogongServiceDialogState extends ConsumerState<_KyogongServiceDialog> {
  final formKey = GlobalKey<FormState>();
  late final name =
      TextEditingController(text: _text(widget.service ?? {}, 'name'));
  late final basePrice = TextEditingController(
      text: widget.service == null
          ? ''
          : _number(widget.service!, 'base_price') > 0
              ? _number(widget.service!, 'base_price').toStringAsFixed(2)
              : '');
  late final pricePerHour = TextEditingController(
      text: _number(widget.service ?? {}, 'price_per_hour') == 0
          ? ''
          : _number(widget.service!, 'price_per_hour').toStringAsFixed(2));
  String serviceType = 'spa';
  String pricingModel = 'fixed';
  bool active = true;
  bool saving = false;

  @override
  void initState() {
    super.initState();
    serviceType = _text(widget.service ?? {}, 'service_type', 'spa');
    pricingModel = _text(widget.service ?? {}, 'pricing_model', 'fixed');
    active = widget.service?['is_active'] != false;
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.service == null ? 'Add Service' : 'Edit Service'),
      content: SizedBox(
        width: 520,
        child: Form(
          key: formKey,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextFormField(
                controller: name,
                decoration: const InputDecoration(labelText: 'Service Name *'),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: serviceType,
                    isExpanded: true,
                    decoration:
                        const InputDecoration(labelText: 'Service Type'),
                    items: [
                      DropdownMenuItem(
                          value: 'spa', child: _dropdownText('Spa')),
                      DropdownMenuItem(
                          value: 'executive-bar',
                          child: _dropdownText('Executive Bar')),
                      DropdownMenuItem(
                          value: 'sports-bar',
                          child: _dropdownText('Sports Bar')),
                      DropdownMenuItem(
                          value: 'reception',
                          child: _dropdownText('Reception')),
                    ],
                    onChanged: (v) =>
                        setState(() => serviceType = v ?? serviceType),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: pricingModel,
                    isExpanded: true,
                    decoration:
                        const InputDecoration(labelText: 'Pricing Model'),
                    items: [
                      DropdownMenuItem(
                          value: 'fixed', child: _dropdownText('Fixed Price')),
                      DropdownMenuItem(
                          value: 'hourly', child: _dropdownText('Hourly Rate')),
                    ],
                    onChanged: (v) =>
                        setState(() => pricingModel = v ?? pricingModel),
                  ),
                ),
              ]),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                  child: TextFormField(
                    controller: basePrice,
                    decoration:
                        const InputDecoration(labelText: 'Base Price *'),
                    keyboardType: TextInputType.number,
                    validator: (v) => (double.tryParse(v ?? '') == null)
                        ? 'Enter valid price'
                        : null,
                  ),
                ),
                if (pricingModel == 'hourly') ...[
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: pricePerHour,
                      decoration:
                          const InputDecoration(labelText: 'Price Per Hour'),
                      keyboardType: TextInputType.number,
                      validator: (v) {
                        if (v != null &&
                            v.trim().isNotEmpty &&
                            double.tryParse(v.trim()) == null) {
                          return 'Enter a valid price';
                        }
                        return null;
                      },
                    ),
                  ),
                ],
              ]),
              SwitchListTile(
                value: active,
                contentPadding: EdgeInsets.zero,
                title: const Text('This service is currently active'),
                onChanged: (v) => setState(() => active = v),
              ),
            ]),
          ),
        ),
      ),
      actions: _dialogActions(context, saving, () async {
        if (!formKey.currentState!.validate()) return;
        setState(() => saving = true);
        try {
          final payload = {
            'name': name.text.trim(),
            'service_type': serviceType,
            'pricing_model': pricingModel,
            'base_price': double.parse(basePrice.text),
            if (pricePerHour.text.trim().isNotEmpty)
              'price_per_hour': double.tryParse(pricePerHour.text.trim()) ?? 0.0,
            'is_active': active,
          };
          if (widget.service == null) {
            await ref
                .read(kyogongServiceProvider)
                .createDynamicService(payload);
          } else {
            await ref
                .read(kyogongServiceProvider)
                .updateDynamicService('${widget.service!['id']}', payload);
          }
          if (context.mounted) Navigator.pop(context, true);
        } catch (e) {
          if (context.mounted) _snack(context, apiErrorMessage(e), error: true);
        } finally {
          if (mounted) setState(() => saving = false);
        }
      }),
    );
  }
}

class _StaffIdCardDialog extends ConsumerStatefulWidget {
  const _StaffIdCardDialog({required this.employee});
  final Map<String, dynamic> employee;

  @override
  ConsumerState<_StaffIdCardDialog> createState() => _StaffIdCardDialogState();
}

class _StaffIdCardDialogState extends ConsumerState<_StaffIdCardDialog> {
  final formKey = GlobalKey<FormState>();
  late final firstName =
      TextEditingController(text: _text(widget.employee, 'first_name'));
  late final lastName =
      TextEditingController(text: _text(widget.employee, 'last_name'));
  late final employeeId =
      TextEditingController(text: _text(widget.employee, 'employee_id'));
  late final phone =
      TextEditingController(text: _text(widget.employee, 'phone_number'));
  late final department =
      TextEditingController(text: _text(widget.employee, 'department'));
  final photoPath = TextEditingController();
  bool saving = false;
  bool uploadingPhoto = false;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Edit ID Card Details'),
      content: SizedBox(
        width: 520,
        child: Form(
          key: formKey,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Row(children: [
                Expanded(
                    child: TextFormField(
                        controller: firstName,
                        decoration:
                            const InputDecoration(labelText: 'First Name'))),
                const SizedBox(width: 12),
                Expanded(
                    child: TextFormField(
                        controller: lastName,
                        decoration:
                            const InputDecoration(labelText: 'Last Name'))),
              ]),
              const SizedBox(height: 12),
              TextFormField(
                  controller: employeeId,
                  decoration: const InputDecoration(labelText: 'Employee ID')),
              const SizedBox(height: 12),
              TextFormField(
                  controller: phone,
                  decoration: const InputDecoration(labelText: 'Phone')),
              const SizedBox(height: 12),
              TextFormField(
                  controller: department,
                  decoration: const InputDecoration(labelText: 'Department')),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                  child: TextField(
                    controller: photoPath,
                    decoration: const InputDecoration(
                      labelText: 'Photo file path',
                      helperText: 'Uploads to /api/staff/:id/photo',
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                OutlinedButton.icon(
                  onPressed: uploadingPhoto ? null : _uploadPhoto,
                  icon: uploadingPhoto
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Icon(PhosphorIcons.uploadSimple(), size: 18),
                  label: const Text('Upload'),
                ),
              ]),
            ]),
          ),
        ),
      ),
      actions: _dialogActions(context, saving, () async {
        setState(() => saving = true);
        try {
          await ref.read(staffServiceProvider).updateStaffMember(
            '${widget.employee['id']}',
            {
              'first_name': firstName.text.trim(),
              'last_name': lastName.text.trim(),
              'employee_id': employeeId.text.trim(),
              'phone_number': phone.text.trim(),
              'department': department.text.trim(),
            },
          );
          if (context.mounted) Navigator.pop(context, true);
        } catch (e) {
          if (context.mounted) _snack(context, apiErrorMessage(e), error: true);
        } finally {
          if (mounted) setState(() => saving = false);
        }
      }),
    );
  }

  Future<void> _uploadPhoto() async {
    if (photoPath.text.trim().isEmpty) {
      _snack(context, 'Enter a photo file path', error: true);
      return;
    }
    setState(() => uploadingPhoto = true);
    try {
      await ref
          .read(staffServiceProvider)
          .uploadStaffPhoto('${widget.employee['id']}', photoPath.text.trim());
      if (mounted) {
        _snack(context, 'Photo uploaded');
      }
    } catch (e) {
      if (mounted) {
        _snack(context, apiErrorMessage(e), error: true);
      }
    } finally {
      if (mounted) {
        setState(() => uploadingPhoto = false);
      }
    }
  }
}

class _BranchSelect extends StatelessWidget {
  const _BranchSelect({
    required this.branches,
    required this.value,
    required this.onChanged,
  });

  final AsyncValue<Map<String, dynamic>> branches;
  final int? value;
  final ValueChanged<int?> onChanged;

  @override
  Widget build(BuildContext context) {
    final rows =
        branches.maybeWhen(data: _rowsFrom, orElse: () => const <dynamic>[]);
    return DropdownButtonFormField<int?>(
      initialValue: value,
      decoration: const InputDecoration(labelText: 'Branch'),
      items: [
        const DropdownMenuItem<int?>(value: null, child: Text('All branches')),
        ...rows.whereType<Map>().map((row) {
          final branch = Map<String, dynamic>.from(row);
          return DropdownMenuItem<int?>(
            value: int.tryParse(_text(branch, 'id')),
            child: Text(_text(branch, 'name', 'Branch')),
          );
        }),
      ],
      onChanged: onChanged,
    );
  }
}

class _CategorySelect extends StatelessWidget {
  const _CategorySelect({
    required this.categories,
    required this.value,
    required this.onChanged,
  });

  final AsyncValue<Map<String, dynamic>> categories;
  final String? value;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    final rows =
        categories.maybeWhen(data: _rowsFrom, orElse: () => const <dynamic>[]);
    return DropdownButtonFormField<String?>(
      initialValue: value,
      decoration: const InputDecoration(labelText: 'Category'),
      items: [
        const DropdownMenuItem<String?>(
            value: null, child: Text('Select category')),
        ...rows.whereType<Map>().map((row) {
          final category = Map<String, dynamic>.from(row);
          return DropdownMenuItem<String?>(
            value: _text(category, 'id'),
            child: Text(_text(category, 'name', 'Category')),
          );
        }),
      ],
      onChanged: onChanged,
    );
  }
}

List<Widget> _dialogActions(
    BuildContext context, bool saving, Future<void> Function() onSave) {
  return [
    TextButton(
      onPressed: saving ? null : () => Navigator.pop(context, false),
      child: const Text('Cancel'),
    ),
    ElevatedButton.icon(
      onPressed: saving ? null : onSave,
      icon: saving
          ? const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Icon(PhosphorIcons.check(), size: 18),
      label: Text(saving ? 'Saving...' : 'Save'),
    ),
  ];
}

BoxDecoration _cardDecoration() => BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: Colors.grey.shade200),
    );

Future<bool> _confirm(BuildContext context, String message) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Confirm Action'),
      content: Text(message),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel')),
        ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Confirm')),
      ],
    ),
  );
  return result == true;
}

void _snack(BuildContext context, String message, {bool error = false}) {
  AppNotifier.showSnackBar(
      context,
      SnackBar(
        content: Text(message),
        backgroundColor: error ? AppColors.kError : null,
      ));
}

String _employeeName(Map<String, dynamic> employee) {
  final fullName = _text(employee, 'full_name');
  if (fullName.isNotEmpty) return fullName;
  final first = _text(employee, 'first_name');
  final last = _text(employee, 'last_name');
  final combined = '$first $last'.trim();
  return combined.isEmpty ? _text(employee, 'name', 'Unknown Staff') : combined;
}

Map<String, String> _branchNameMap(List<dynamic> branchRows) {
  final result = <String, String>{};
  for (final row in branchRows.whereType<Map>()) {
    final branch = Map<String, dynamic>.from(row);
    final id = _text(branch, 'id');
    final name = _text(branch, 'name');
    if (id.isNotEmpty && name.isNotEmpty) result[id] = name;
  }
  return result;
}

Map<String, dynamic>? _childMap(Map<String, dynamic> row, String key) {
  final value = row[key];
  if (value is Map) return Map<String, dynamic>.from(value);
  if (value is List && value.isNotEmpty && value.first is Map) {
    return Map<String, dynamic>.from(value.first as Map);
  }
  return null;
}

Map<String, dynamic> _normalizeIdCardStaff(
  Map<String, dynamic> row,
  Map<String, String> branchNames,
) {
  final user = _childMap(row, 'user');
  final branch = _childMap(row, 'branch') ?? _childMap(row, 'branches');
  final firstName = _text(row, 'first_name', _text(user ?? {}, 'first_name'));
  final lastName = _text(row, 'last_name', _text(user ?? {}, 'last_name'));
  final name = _text(
      row, 'full_name', _text(row, 'name', '$firstName $lastName'.trim()));
  final branchId = _text(row, 'branch_id', _text(row, 'branchId'));
  final branchName = _text(
    row,
    'branch_name',
    _text(row, 'branchName',
        _text(branch ?? {}, 'name', branchNames[branchId] ?? '-')),
  );
  final employeeId = _text(
    row,
    'employee_id',
    _text(row, 'id_number', _text(row, 'staff_code', _text(row, 'id'))),
  );
  final profilePhoto = _text(
    row,
    'profile_photo_url',
    _text(
      row,
      'photo_url',
      _text(row, 'profile_photo',
          _text(row, 'avatar', _text(user ?? {}, 'avatar'))),
    ),
  );

  return {
    ...row,
    'first_name': firstName,
    'last_name': lastName,
    'full_name': name,
    'name': name,
    'employee_id': employeeId,
    'branch_id': branchId,
    'branch_name': branchName,
    'role':
        _text(row, 'role', _text(row, 'position', _text(user ?? {}, 'role'))),
    'phone_number': _text(
      row,
      'phone_number',
      _text(row, 'phone', _text(user ?? {}, 'phone_number')),
    ),
    'profile_photo': profilePhoto,
    'profile_photo_url': profilePhoto,
  };
}
