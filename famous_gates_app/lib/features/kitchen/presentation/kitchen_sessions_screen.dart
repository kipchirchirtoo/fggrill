import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../domain/session_models.dart';
import '../domain/session_providers.dart';
import '../data/repository.dart';
import '../../auth/domain/auth_notifier.dart';

class KitchenSessionsScreen extends ConsumerStatefulWidget {
  const KitchenSessionsScreen({super.key});

  @override
  ConsumerState<KitchenSessionsScreen> createState() => _KitchenSessionsScreenState();
}

class _KitchenSessionsScreenState extends ConsumerState<KitchenSessionsScreen> {
  final _uuid = const Uuid();
  bool _isSubmitting = false;

  @override
  @override
  Widget build(BuildContext context) {
    final configAsync = ref.watch(shiftConfigProvider);
    final user = ref.watch(authNotifierProvider).valueOrNull;
    final userRole = user?.role ?? '';
    const writeRoles = {'kitchen_operations', 'branch_storekeeper', 'storekeeper'};
    final isWriteUser = writeRoles.contains(userRole) || user?.roles.any(writeRoles.contains) == true;

    return configAsync.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, stack) => Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('Error loading shift configuration: $error', style: const TextStyle(color: Colors.red)),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref.invalidate(shiftConfigProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
      data: (config) {
        if (!config.enabled) {
          return Scaffold(
            appBar: AppBar(title: const Text('Kitchen Shift Sessions')),
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(32.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.block, size: 64, color: Colors.red),
                    const SizedBox(height: 16),
                    const Text(
                      'Kitchen Sessions Disabled',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'This branch is not configured for Kitchen Sessions pilot operations.\nReason: ${config.reason ?? "KITCHEN_SESSIONS_NOT_CONFIGURED"}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.grey),
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        final activeShiftAsync = ref.watch(activeKitchenShiftProvider);

        return Scaffold(
          appBar: AppBar(
            title: const Text('Kitchen Shift Sessions'),
            actions: [
              IconButton(
                icon: const Icon(Icons.refresh),
                onPressed: () {
                  ref.read(activeKitchenShiftProvider.notifier).refresh();
                  ref.invalidate(shiftConfigProvider);
                },
              ),
            ],
          ),
          body: activeShiftAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, stack) => Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('Error: $error', style: const TextStyle(color: Colors.red)),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => ref.read(activeKitchenShiftProvider.notifier).refresh(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
            data: (activeShift) {
              if (activeShift == null) {
                if (!isWriteUser) {
                  return Center(
                    child: Card(
                      elevation: 2,
                      margin: const EdgeInsets.all(24.0),
                      child: Padding(
                        padding: const EdgeInsets.all(32.0),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.info_outline, size: 48, color: Colors.blue.shade700),
                            const SizedBox(height: 16),
                            const Text(
                              'No Active Kitchen Session',
                              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'There is no active kitchen shift open for today. A kitchen storekeeper must open a shift to begin recording sessions.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Colors.grey),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }
                return _buildOpenShiftView(config);
              }
              return _buildActiveShiftDashboard(activeShift, isWriteUser);
            },
          ),
        );
      },
    );
  }

  // ── OPEN SHIFT VIEW ────────────────────────────────────────────────────────
  Widget _buildOpenShiftView(KitchenShiftConfig config) {
    final staffAsync = ref.watch(staffProfilesProvider);

    String selectedShiftType = 'breakfast';
    String? selectedSubShiftType;
    List<String> selectedChefIds = [];
    String selectedDept = 'KITCHEN';

    return StatefulBuilder(
      builder: (context, setLocalState) {
        return SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Center(
            child: Container(
              constraints: const BoxConstraints(maxWidth: 600),
              child: Card(
                elevation: 4,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                child: Padding(
                  padding: const EdgeInsets.all(32.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.kitchen, size: 32, color: Colors.amber),
                          SizedBox(width: 12),
                          Text(
                            'Open Kitchen Shift',
                            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Morning shifts must have the morning stocktake submitted before opening. Afternoon shifts (Sub-shift B) will carry forward closing counts.',
                        style: TextStyle(color: Colors.grey),
                      ),
                      const Divider(height: 32),

                      // Shift Type
                      const Text('Shift Type', style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        initialValue: selectedShiftType,
                        decoration: InputDecoration(
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        items: const [
                          DropdownMenuItem(value: 'breakfast', child: Text('Breakfast')),
                          DropdownMenuItem(value: 'lunch', child: Text('Lunch')),
                          DropdownMenuItem(value: 'dinner', child: Text('Dinner')),
                          DropdownMenuItem(value: 'overnight', child: Text('Overnight')),
                        ],
                        onChanged: (val) {
                          if (val != null) {
                            setLocalState(() => selectedShiftType = val);
                          }
                        },
                      ),
                      const SizedBox(height: 20),

                      // Sub Shift Type (if enabled by branch shift config)
                      () {
                        if (config.shiftMode == 'SINGLE_SHIFT') {
                          selectedSubShiftType = null;
                          return const SizedBox.shrink();
                        }
                        selectedSubShiftType ??= 'A';
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Sub-shift (Session)', style: TextStyle(fontWeight: FontWeight.bold)),
                              const SizedBox(height: 8),
                              DropdownButtonFormField<String>(
                                initialValue: selectedSubShiftType,
                                decoration: InputDecoration(
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                                items: const [
                                  DropdownMenuItem(value: 'A', child: Text('Sub-shift A (Morning)')),
                                  DropdownMenuItem(value: 'B', child: Text('Sub-shift B (Afternoon)')),
                                ],
                                onChanged: (val) {
                                  if (val != null) {
                                    setLocalState(() => selectedSubShiftType = val);
                                  }
                                },
                              ),
                              const SizedBox(height: 20),
                            ],
                          );
                        }(),

                      // Department
                      const Text('Department', style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        initialValue: selectedDept,
                        decoration: InputDecoration(
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        items: const [
                          DropdownMenuItem(value: 'KITCHEN', child: Text('Kitchen')),
                          DropdownMenuItem(value: 'PASTRY', child: Text('Pastry')),
                          DropdownMenuItem(value: 'BUTCHERY', child: Text('Butchery')),
                        ],
                        onChanged: (val) {
                          if (val != null) {
                            setLocalState(() => selectedDept = val);
                          }
                        },
                      ),
                      const SizedBox(height: 20),

                      // Staff Assignment
                      const Text('Assigned Chef(s)', style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      staffAsync.when(
                        loading: () => const CircularProgressIndicator(),
                        error: (err, _) => Text('Error loading staff: $err'),
                        data: (staffList) {
                          return Container(
                            decoration: BoxDecoration(
                              border: Border.all(color: Colors.grey.shade300),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            constraints: const BoxConstraints(maxHeight: 150),
                            child: ListView(
                              shrinkWrap: true,
                              children: staffList.map((staff) {
                                final id = staff['id']?.toString() ?? '';
                                final name = '${staff['first_name'] ?? ''} ${staff['last_name'] ?? ''}'.trim();
                                final isSelected = selectedChefIds.contains(id);

                                return CheckboxListTile(
                                  value: isSelected,
                                  title: Text(name.isNotEmpty ? name : id),
                                  onChanged: (checked) {
                                    setLocalState(() {
                                      if (checked == true) {
                                        selectedChefIds.add(id);
                                      } else {
                                        selectedChefIds.remove(id);
                                      }
                                    });
                                  },
                                );
                              }).toList(),
                            ),
                          );
                        },
                      ),
                      const SizedBox(height: 32),

                      // Open Session Submit
                      SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: ElevatedButton(
                          onPressed: _isSubmitting
                              ? null
                              : () async {
                                  setLocalState(() => _isSubmitting = true);
                                  try {
                                    await ref.read(activeKitchenShiftProvider.notifier).openShift(
                                          shiftType: selectedShiftType,
                                          assignedChefIds: selectedChefIds,
                                          subShiftType: selectedSubShiftType,
                                          department: selectedDept,
                                        );
                                    if (!context.mounted) return;
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('Kitchen shift opened successfully.')),
                                    );
                                  } catch (e) {
                                    if (!context.mounted) return;
                                    showDialog(
                                      context: context,
                                      builder: (ctx) => AlertDialog(
                                        title: const Text('Cannot Open Shift'),
                                        content: Text(e.toString()),
                                        actions: [
                                          TextButton(
                                            onPressed: () => Navigator.pop(ctx),
                                            child: const Text('OK'),
                                          ),
                                        ],
                                      ),
                                    );
                                  } finally {
                                    if (mounted) {
                                      setLocalState(() => _isSubmitting = false);
                                    }
                                  }
                                },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.amber.shade700,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          child: _isSubmitting
                              ? const CircularProgressIndicator(color: Colors.white)
                              : const Text('OPEN KITCHEN SESSION', style: TextStyle(fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  // ── ACTIVE SHIFT DASHBOARD ──────────────────────────────────────────────────
  Widget _buildActiveShiftDashboard(KitchenShift activeShift, bool isWriteUser) {
    final detailsAsync = ref.watch(shiftDetailsProvider(activeShift.id));

    return detailsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(child: Text('Error loading shift details: $error')),
      data: (details) {
        final List<KitchenShiftItem> items = (details['items'] as List? ?? [])
            .map((json) => KitchenShiftItem.fromJson(Map<String, dynamic>.from(json)))
            .toList();

        final List<dynamic> rawProductions = details['productions'] as List? ?? [];

        return DefaultTabController(
          length: 3,
          child: Column(
            children: [
              // Header Shift details card
              _buildHeaderCard(activeShift, items, isWriteUser),
              const TabBar(
                tabs: [
                  Tab(icon: Icon(Icons.inventory), text: 'Active Stock items'),
                  Tab(icon: Icon(Icons.restaurant), text: 'Production Events'),
                  Tab(icon: Icon(Icons.history), text: 'Mid-session Additions'),
                ],
              ),
              Expanded(
                child: TabBarView(
                  children: [
                    _buildItemsTab(activeShift, items),
                    _buildProductionsTab(activeShift, rawProductions),
                    _buildAdditionsTab(activeShift),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildHeaderCard(KitchenShift shift, List<KitchenShiftItem> items, bool isWriteUser) {
    return Card(
      margin: const EdgeInsets.all(16),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Shift: ${shift.shiftNumber}',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Date: ${shift.shiftDate} | Type: ${shift.shiftType.toUpperCase()} ${shift.subShiftType != null ? '(Sub-shift ${shift.subShiftType})' : ''}',
                      style: TextStyle(color: Colors.grey.shade600),
                    ),
                  ],
                ),
                Chip(
                  label: Text(
                    shift.status.toUpperCase(),
                    style: TextStyle(color: Colors.green.shade800, fontWeight: FontWeight.bold),
                  ),
                  backgroundColor: Colors.green.shade100,
                ),
              ],
            ),
            if (isWriteUser) ...[
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  ElevatedButton.icon(
                    onPressed: () => _showLogProductionDialog(shift, items),
                    icon: const Icon(Icons.add),
                    label: const Text('Log Production'),
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white),
                  ),
                  ElevatedButton.icon(
                    onPressed: () => _showAddStockDialog(shift),
                    icon: const Icon(Icons.add_shopping_cart),
                    label: const Text('Add Mid-session Stock'),
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.blue, foregroundColor: Colors.white),
                  ),
                  ElevatedButton.icon(
                    onPressed: () => _showCloseShiftDialog(shift, items),
                    icon: const Icon(Icons.close),
                    label: const Text('Close shift / Handover'),
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
                  ),
                ],
              ),
              const Divider(height: 24),
            ],
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (isWriteUser)
                  TextButton.icon(
                    onPressed: () => _triggerSyncRetry(shift.id),
                    icon: const Icon(Icons.sync),
                    label: const Text('Retry Sync Report'),
                  )
                else
                  const Row(
                    children: [
                      Icon(Icons.lock_outline, size: 16, color: Colors.grey),
                      SizedBox(width: 4),
                      Text('Read-Only Session View', style: TextStyle(color: Colors.grey, fontSize: 12)),
                    ],
                  ),
                Text(
                  'Department: ${shift.department ?? 'KITCHEN'}',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── ACTIVE STOCK ITEMS TAB ──────────────────────────────────────────────────
  Widget _buildItemsTab(KitchenShift shift, List<KitchenShiftItem> items) {
    if (items.isEmpty) {
      return const Center(child: Text('No items in this shift.'));
    }
    return ListView.builder(
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        final balance = item.openingStock + item.additions - item.soldQuantity - item.spoilageQuantity;

        return ListTile(
          title: Text(item.itemName, style: const TextStyle(fontWeight: FontWeight.bold)),
          subtitle: Text('SKU: ${item.itemSku}'),
          trailing: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${balance.toStringAsFixed(2)} ${item.unitOfMeasure}',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              Text(
                'Open: ${item.openingStock} | Add: ${item.additions} | Sold: ${item.soldQuantity}',
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
            ],
          ),
        );
      },
    );
  }

  // ── PRODUCTION EVENTS TAB ───────────────────────────────────────────────────
  Widget _buildProductionsTab(KitchenShift shift, List<dynamic> rawProductions) {
    if (rawProductions.isEmpty) {
      return const Center(child: Text('No production logged yet.'));
    }
    return ListView.builder(
      itemCount: rawProductions.length,
      itemBuilder: (context, index) {
        final p = rawProductions[index];
        final rawUsed = (p['raw_quantity_used'] as num?)?.toDouble() ?? 0.0;
        final rawUnit = p['raw_unit']?.toString() ?? 'units';
        final prodQty = (p['produced_quantity'] as num?)?.toDouble() ?? 0.0;
        final prodUnit = p['produced_unit']?.toString() ?? 'portions';

        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: ListTile(
            title: Text('Produced: ${p['produced_item_name']} ($prodQty $prodUnit)'),
            subtitle: Text(
              'Used: ${p['raw_item_name']} ($rawUsed $rawUnit)\nIdempotency Key: ${p['idempotency_key'] ?? ''}',
            ),
            trailing: p['variance_flagged'] == true
                ? const Icon(Icons.warning, color: Colors.amber)
                : const Icon(Icons.check_circle, color: Colors.green),
          ),
        );
      },
    );
  }

  // ── MID-SESSION ADDITIONS TAB ───────────────────────────────────────────────
  Widget _buildAdditionsTab(KitchenShift shift) {
    final additionsAsync = ref.watch(shiftAdditionsProvider(shift.id));

    return additionsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (err, _) => Center(child: Text('Error loading additions: $err')),
      data: (additions) {
        if (additions.isEmpty) {
          return const Center(child: Text('No additions logged yet.'));
        }
        return ListView.builder(
          itemCount: additions.length,
          itemBuilder: (context, index) {
            final add = additions[index];
            return ListTile(
              leading: const Icon(Icons.add_shopping_cart, color: Colors.blue),
              title: Text('${add.itemName ?? add.itemSku} (+${add.quantity} ${add.unit ?? ''})'),
              subtitle: Text(
                'Type: ${add.foodControlType}\nResponsibility: ${add.responsibleStaffIds.join(", ")}',
              ),
              trailing: Text(
                add.addedAt.length > 10 ? add.addedAt.substring(11, 16) : add.addedAt,
                style: const TextStyle(color: Colors.grey),
              ),
            );
          },
        );
      },
    );
  }

  // ── LOG PRODUCTION DIALOG ──────────────────────────────────────────────────
  void _showLogProductionDialog(KitchenShift shift, List<KitchenShiftItem> items) {
    final recipesAsync = ref.watch(recipesListProvider);
    final staffAsync = ref.watch(staffProfilesProvider);

    showDialog(
      context: context,
      builder: (ctx) {
        KitchenProductionRecipe? selectedRecipe;
        double actualProducedQty = 0;
        double rawQtyUsed = 0;
        String? selectedChefId;
        final noteController = TextEditingController();
        String idempotencyKey = _uuid.v4();
        bool isSubmitting = false;

        return StatefulBuilder(
          builder: (context, setLocalState) {
            return AlertDialog(
              title: const Text('Log Batch Production Event'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Select Recipe
                    recipesAsync.when(
                      loading: () => const CircularProgressIndicator(),
                      error: (err, _) => Text('Error loading recipes: $err'),
                      data: (recipes) {
                        return DropdownButtonFormField<KitchenProductionRecipe>(
                          hint: const Text('Select Production Recipe'),
                          initialValue: selectedRecipe,
                          items: recipes.map((r) {
                            return DropdownMenuItem(
                              value: r,
                              child: Text(r.recipeName),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) {
                              setLocalState(() {
                                selectedRecipe = val;
                                rawQtyUsed = val.rawQuantity;
                                actualProducedQty = val.producedQuantity;
                              });
                            }
                          },
                        );
                      },
                    ),
                    const SizedBox(height: 16),

                    if (selectedRecipe != null) ...[
                      // Input actual yield
                      TextFormField(
                        initialValue: actualProducedQty.toString(),
                        decoration: InputDecoration(
                          labelText: 'Actual Produced Quantity (${selectedRecipe!.producedUnit})',
                        ),
                        keyboardType: TextInputType.number,
                        onChanged: (val) {
                          actualProducedQty = double.tryParse(val) ?? 0;
                        },
                      ),
                      const SizedBox(height: 16),

                      // Input raw qty used
                      TextFormField(
                        initialValue: rawQtyUsed.toString(),
                        decoration: InputDecoration(
                          labelText: 'Raw Material Used (${selectedRecipe!.rawUnit})',
                        ),
                        keyboardType: TextInputType.number,
                        onChanged: (val) {
                          rawQtyUsed = double.tryParse(val) ?? 0;
                        },
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Select produced by
                    staffAsync.when(
                      loading: () => const SizedBox.shrink(),
                      error: (_, __) => const SizedBox.shrink(),
                      data: (staffList) {
                        return DropdownButtonFormField<String>(
                          hint: const Text('Select Chef / Cook'),
                          initialValue: selectedChefId,
                          items: staffList.map((s) {
                            final name = '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();
                            return DropdownMenuItem(
                              value: s['id']?.toString(),
                              child: Text(name.isNotEmpty ? name : (s['id']?.toString() ?? '')),
                            );
                          }).toList(),
                          onChanged: (val) {
                            selectedChefId = val;
                          },
                        );
                      },
                    ),
                    const SizedBox(height: 16),

                    TextFormField(
                      controller: noteController,
                      decoration: const InputDecoration(
                        labelText: 'Variance / Production notes',
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          if (selectedRecipe == null || actualProducedQty <= 0 || rawQtyUsed <= 0 || selectedChefId == null) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Please select recipe, quantities, and chef.')),
                            );
                            return;
                          }

                          setLocalState(() => isSubmitting = true);
                          try {
                            final payload = {
                              'kitchen_shift_id': shift.id,
                              'output_item_id': selectedRecipe!.producedItemId,
                              'production_recipe_id': selectedRecipe!.id,
                              'consumed_inputs': [
                                {
                                  'raw_item_id': selectedRecipe!.rawItemId,
                                  'quantity_used': rawQtyUsed,
                                  'unit': selectedRecipe!.rawUnit,
                                }
                              ],
                              'actual_produced_qty': actualProducedQty,
                              'output_unit': selectedRecipe!.producedUnit,
                              'produced_by': selectedChefId,
                              'idempotency_key': idempotencyKey,
                              'reason_note': noteController.text,
                            };

                            final repo = ref.read(kitchenRepositoryProvider);
                            await repo.logProductionEvent(payload);
                            ref.invalidate(shiftDetailsProvider(shift.id));
                            if (!context.mounted) return;
                            Navigator.pop(ctx);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Production event successfully logged.')),
                            );
                          } catch (e) {
                            if (!context.mounted) return;
                            showDialog(
                              context: context,
                              builder: (c) => AlertDialog(
                                title: const Text('Logging Failed'),
                                content: Text(e.toString()),
                                actions: [
                                  TextButton(onPressed: () => Navigator.pop(c), child: const Text('OK')),
                                ],
                              ),
                            );
                          } finally {
                            setLocalState(() => isSubmitting = false);
                          }
                        },
                  child: const Text('LOG PRODUCTION'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // ── ADD STOCK DIALOG ────────────────────────────────────────────────────────
  void _showAddStockDialog(KitchenShift shift) {
    showDialog(
      context: context,
      builder: (ctx) {
        final skuController = TextEditingController();
        final qtyController = TextEditingController();
        final unitController = TextEditingController();
        final nameController = TextEditingController();
        String? selectedStaffId;
        bool isSubmitting = false;

        final staffAsync = ref.watch(staffProfilesProvider);

        return StatefulBuilder(
          builder: (context, setLocalState) {
            return AlertDialog(
              title: const Text('Issue Mid-session Stock to Kitchen'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: skuController,
                    decoration: const InputDecoration(labelText: 'Item SKU'),
                  ),
                  TextFormField(
                    controller: nameController,
                    decoration: const InputDecoration(labelText: 'Item Name'),
                  ),
                  TextFormField(
                    controller: qtyController,
                    decoration: const InputDecoration(labelText: 'Quantity to Add'),
                    keyboardType: TextInputType.number,
                  ),
                  TextFormField(
                    controller: unitController,
                    decoration: const InputDecoration(labelText: 'Unit (e.g. kg, pcs)'),
                  ),
                  const SizedBox(height: 16),
                  staffAsync.when(
                    loading: () => const SizedBox.shrink(),
                    error: (_, __) => const SizedBox.shrink(),
                    data: (staffList) {
                      return DropdownButtonFormField<String>(
                        hint: const Text('Responsible Staff'),
                        initialValue: selectedStaffId,
                        items: staffList.map((s) {
                          final name = '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();
                          return DropdownMenuItem(
                            value: s['id']?.toString(),
                            child: Text(name.isNotEmpty ? name : (s['id']?.toString() ?? '')),
                          );
                        }).toList(),
                        onChanged: (val) {
                          selectedStaffId = val;
                        },
                      );
                    },
                  ),
                ],
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                ElevatedButton(
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          if (skuController.text.isEmpty || qtyController.text.isEmpty || selectedStaffId == null) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('SKU, Quantity, and Staff are required.')),
                            );
                            return;
                          }
                          setLocalState(() => isSubmitting = true);
                          try {
                            final repo = ref.read(kitchenRepositoryProvider);
                            await repo.addStock(shift.id, [
                              {
                                'sku': skuController.text,
                                'name': nameController.text,
                                'quantity': double.tryParse(qtyController.text) ?? 0.0,
                                'unit': unitController.text,
                                'responsible_staff_ids': [selectedStaffId],
                              }
                            ]);
                            ref.invalidate(shiftDetailsProvider(shift.id));
                            if (!context.mounted) return;
                            Navigator.pop(ctx);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Stock successfully issued.')),
                            );
                          } catch (e) {
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Error: $e')),
                            );
                          } finally {
                            if (mounted) {
                              setLocalState(() => isSubmitting = false);
                            }
                          }
                        },
                  child: const Text('ADD STOCK'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // ── CLOSE SHIFT DIALOG ──────────────────────────────────────────────────────
  void _showCloseShiftDialog(KitchenShift shift, List<KitchenShiftItem> items) {
    showDialog(
      context: context,
      builder: (ctx) {
        final countsMap = <String, double>{};
        final notesMap = <String, String>{};
        List<String> outgoingWitnesses = [];
        List<String> incomingWitnesses = [];
        final notesController = TextEditingController();
        bool isSubmitting = false;

        final staffAsync = ref.watch(staffProfilesProvider);

        for (final it in items) {
          final balance = it.openingStock + it.additions - it.soldQuantity - it.spoilageQuantity;
          countsMap[it.itemSku] = balance;
        }

        return StatefulBuilder(
          builder: (context, setLocalState) {
            return AlertDialog(
              title: const Text('Close Session & Record Physical Counts'),
              content: SizedBox(
                width: 600,
                child: SingleChildScrollView(
                  child: Column(
                    children: [
                      // Active items stocktake fields
                      const Text(
                        'Confirm physical stock counts to evaluate variances. Large/extreme variances will be highlighted.',
                        style: TextStyle(color: Colors.grey, fontSize: 12),
                      ),
                      const SizedBox(height: 16),
                      ...items.map((it) {
                        final sysClose = it.openingStock + it.additions - it.soldQuantity - it.spoilageQuantity;
                        return Row(
                          children: [
                            Expanded(child: Text('${it.itemName} ($sysClose ${it.unitOfMeasure})')),
                            const SizedBox(width: 12),
                            SizedBox(
                              width: 80,
                              child: TextFormField(
                                initialValue: sysClose.toString(),
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(labelText: 'Physical'),
                                onChanged: (val) {
                                  countsMap[it.itemSku] = double.tryParse(val) ?? 0.0;
                                },
                              ),
                            ),
                            const SizedBox(width: 12),
                            SizedBox(
                              width: 120,
                              child: TextFormField(
                                decoration: const InputDecoration(labelText: 'Notes'),
                                onChanged: (val) {
                                  notesMap[it.itemSku] = val;
                                },
                              ),
                            ),
                          ],
                        );
                      }),
                      const Divider(height: 32),

                      // Witness Selectors
                      const Text('Shift Handover Witnesses', style: TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      staffAsync.when(
                        loading: () => const CircularProgressIndicator(),
                        error: (err, _) => Text('Error loading witnesses: $err'),
                        data: (staffList) {
                          return Column(
                            children: [
                              // Outgoing Witnesses
                              DropdownButtonFormField<String>(
                                hint: const Text('Select Outgoing Witness'),
                                items: staffList.map((s) {
                                  final name = '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();
                                  return DropdownMenuItem(
                                    value: s['id']?.toString(),
                                    child: Text(name.isNotEmpty ? name : (s['id']?.toString() ?? '')),
                                  );
                                }).toList(),
                                onChanged: (val) {
                                  if (val != null) {
                                    setLocalState(() {
                                      outgoingWitnesses = [val];
                                    });
                                  }
                                },
                              ),
                              const SizedBox(height: 12),
                              // Incoming Witnesses
                              DropdownButtonFormField<String>(
                                hint: const Text('Select Incoming Witness'),
                                items: staffList.map((s) {
                                  final name = '${s['first_name'] ?? ''} ${s['last_name'] ?? ''}'.trim();
                                  return DropdownMenuItem(
                                    value: s['id']?.toString(),
                                    child: Text(name.isNotEmpty ? name : (s['id']?.toString() ?? '')),
                                  );
                                }).toList(),
                                onChanged: (val) {
                                  if (val != null) {
                                    setLocalState(() {
                                      incomingWitnesses = [val];
                                    });
                                  }
                                },
                              ),
                            ],
                          );
                        },
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: notesController,
                        decoration: const InputDecoration(labelText: 'Closing summary notes'),
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
                ElevatedButton(
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          if (shift.subShiftType != null && (outgoingWitnesses.isEmpty || incomingWitnesses.isEmpty)) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Both outgoing and incoming witnesses are required.')),
                            );
                            return;
                          }

                          setLocalState(() => isSubmitting = true);
                          try {
                            final physicalCounts = countsMap.entries.map((e) => {
                                  'sku': e.key,
                                  'quantity': e.value,
                                  'notes': notesMap[e.key] ?? '',
                                }).toList();

                            final repo = ref.read(kitchenRepositoryProvider);
                            await repo.closeShift(
                              shiftId: shift.id,
                              physicalCounts: physicalCounts,
                              outgoingWitnessIds: outgoingWitnesses,
                              incomingWitnessIds: incomingWitnesses,
                              closingNotes: notesController.text,
                            );

                            ref.read(activeKitchenShiftProvider.notifier).clearActiveShift();
                            ref.invalidate(shiftDetailsProvider(shift.id));
                            if (!context.mounted) return;
                            Navigator.pop(ctx);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Kitchen shift closed successfully.')),
                            );
                          } catch (e) {
                            if (!context.mounted) return;
                            showDialog(
                              context: context,
                              builder: (c) => AlertDialog(
                                title: const Text('Closure Failed'),
                                content: Text(e.toString()),
                                actions: [
                                  TextButton(onPressed: () => Navigator.pop(c), child: const Text('OK')),
                                ],
                              ),
                            );
                          } finally {
                            setLocalState(() => isSubmitting = false);
                          }
                        },
                  child: const Text('SUBMIT STOCKTAKE & CLOSE'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // ── SYNC RETRY ──────────────────────────────────────────────────────────────
  Future<void> _triggerSyncRetry(String shiftId) async {
    try {
      final repo = ref.read(kitchenRepositoryProvider);
      await repo.retrySync(shiftId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sync report retry successfully triggered.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Sync retry failed: $e')),
      );
    }
  }
}
