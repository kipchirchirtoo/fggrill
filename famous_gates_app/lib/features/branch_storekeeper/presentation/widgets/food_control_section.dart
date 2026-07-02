import '../../../../core/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../data/branch_storekeeper_repository.dart';
import '../../daily_control/daily_control_page.dart';
import '../../../auth/data/auth_repository.dart';
import '../bar_stocktake_screen.dart';
import '../kitchen_stocktake_screen.dart';
import '../store_stocktake_screen.dart';
import '../record_spoilage_screen.dart';
import '../wastage_report_screen.dart';
import '../../../kitchen_operations/data/repository.dart';

// Helper for money formatting if used
String _money(num value) {
  return 'KES ${value.toStringAsFixed(2)}';
}

double _num(dynamic v) => v == null ? 0 : (double.tryParse('$v') ?? 0);

double _fcNum(dynamic v) {
  if (v == null) return 0;
  return (v is num) ? v.toDouble() : double.tryParse('$v') ?? 0;
}


class FoodControlSection extends ConsumerStatefulWidget {
  const FoodControlSection({super.key});

  @override
  ConsumerState<FoodControlSection> createState() =>
      FoodControlSectionState();
}

class FoodControlSectionState extends ConsumerState<FoodControlSection>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  int _activeTab = 0;

  List<Map<String, dynamic>> _recipes = [];
  List<Map<String, dynamic>> _stock = [];
  bool _stockLoading = false;

  Future<void> _loadStock() async {
    if (!mounted) return;
    setState(() => _stockLoading = true);
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      final data = await repo.branchStock();
      if (mounted) setState(() => _stock = data);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _stockLoading = false);
    }
  }
  bool _loading = true;
  String _stockSearch = '';
  String _recipeSearch = '';
  Map<String, dynamic>? _selectedStock;

  List<Map<String, dynamic>> _shifts = [];
  Map<String, dynamic>? _selectedShift;
  bool _loadingShifts = false;
  bool _loadingAnalytics = false;
  Map<String, dynamic> _analyticsData = {};

  List<Map<String, dynamic>> _directItems = [];
  bool _directItemsLoading = true;
  List<Map<String, dynamic>> _exemptItems = [];
  bool _exemptItemsLoading = true;
  List<Map<String, dynamic>> _poolLinks = [];
  bool _poolLinksLoading = true;
  List<Map<String, dynamic>> _unregisteredItems = [];
  bool _unregisteredLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 6, vsync: this);
    _tabController.addListener(() {
      if (_tabController.indexIsChanging) return;
      setState(() => _activeTab = _tabController.index);
    });
    _loadStock();
    _loadRecipes();
    _loadShifts();
    _loadDirectItems();
    _loadExemptItems();
    _loadPoolLinks();
    _loadUnregisteredItems();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadDirectItems() async {
    setState(() => _directItemsLoading = true);
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      final data = await repo.getDirectItems();
      if (mounted) setState(() => _directItems = data);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _directItemsLoading = false);
    }
  }

  Future<void> _loadExemptItems() async {
    setState(() => _exemptItemsLoading = true);
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      final data = await repo.getExemptItems();
      if (mounted) setState(() => _exemptItems = data);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _exemptItemsLoading = false);
    }
  }

  Future<void> _loadPoolLinks() async {
    setState(() => _poolLinksLoading = true);
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      final data = await repo.getPoolLinks();
      if (mounted) setState(() => _poolLinks = data);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _poolLinksLoading = false);
    }
  }

  Future<void> _loadUnregisteredItems() async {
    setState(() => _unregisteredLoading = true);
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      final data = await repo.getUnregisteredFoodControlItems();
      if (mounted) setState(() => _unregisteredItems = data);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _unregisteredLoading = false);
    }
  }

  Future<void> _loadShifts() async {
    setState(() => _loadingShifts = true);
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      final data = await repo.getKitchenShifts();
      if (mounted) setState(() => _shifts = data);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loadingShifts = false);
    }
  }

  Future<void> _selectShift(Map<String, dynamic> shift) async {
    setState(() {
      _selectedShift = shift;
      _loadingAnalytics = true;
    });
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      final detail = await repo.getKitchenShiftDetail('${shift['id']}');
      final posCons = await repo.getKitchenShiftPosConsumption('${shift['id']}');
      
      if (mounted) {
        setState(() {
          _analyticsData = {
            'shift': detail['shift'] ?? shift,
            'items': detail['items'] ?? [],
            'productions': detail['productions'] ?? [],
            'stock_take': detail['stock_take'] ?? [],
            'consumption': posCons['consumption'] ?? [],
            'cashier_shifts': posCons['cashier_shifts'] ?? [],
            'unmatched_summary': posCons['unmatched_summary'] ?? {},
            'summary': detail['summary'] ?? {},
          };
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load shift analytics: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loadingAnalytics = false);
    }
  }

  Future<void> _loadRecipes() async {
    setState(() => _loading = true);
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      final data = await repo.getProductionRecipes();
      if (mounted) setState(() => _recipes = data);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  static bool _isBarItem(Map<String, dynamic> s) {
    final cat = '${s['category'] ?? ''}'.toLowerCase();
    final sku = '${s['item_sku'] ?? ''}'.toLowerCase();
    final name = '${s['item_name'] ?? ''}'.toLowerCase();
    // Common bar category keywords
    return cat.contains('beer') ||
        cat.contains('spirit') ||
        cat.contains('wine') ||
        cat.contains('whisky') ||
        cat.contains('whiskey') ||
        cat.contains('vodka') ||
        cat.contains('gin') ||
        cat.contains('rum') ||
        cat.contains('brandy') ||
        cat.contains('liqueur') ||
        cat.contains('soft drink') ||
        cat.contains('soda') ||
        cat.contains('alcohol') ||
        cat.contains('bar') ||
        sku.startsWith('bar-') ||
        sku.startsWith('bev-') ||
        name.contains('beer') ||
        name.contains('soda');
  }

  /// Opens a dialog to add (receive) stock for a parent/raw ingredient into
  /// branch stock. This is the "parent stock that makes menu items" flow:
  /// the storekeeper records that e.g. 10 kg of BEEF has arrived and should
  /// be added to the branch store balance before kitchen sessions can issue it.
  Future<void> _openAddParentStockDialog(Map<String, dynamic> stockItem) async {
    final qtyCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    final itemName = '${stockItem['item_name'] ?? stockItem['item_sku'] ?? ''}';
    final sku = '${stockItem['item_sku'] ?? ''}';
    final unit = '${stockItem['unit_of_measure'] ?? stockItem['unit'] ?? 'kg'}';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            Icon(Icons.add_box_outlined, color: Colors.teal.shade700),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Add Stock — $itemName',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
        content: SizedBox(
          width: 380,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.teal.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.teal.shade100),
                ),
                child: Text(
                  'SKU: $sku · Unit: $unit\n'
                  'This will add to the branch store balance immediately. '
                  'Use this when receiving parent ingredients (BEEF, RICE, FLOUR, etc.) '
                  'that are consumed by kitchen production recipes.',
                  style: TextStyle(fontSize: 12, color: Colors.teal.shade900, height: 1.5),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: qtyCtrl,
                autofocus: true,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                  labelText: 'Quantity to add ($unit)',
                  border: const OutlineInputBorder(),
                  isDense: true,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: notesCtrl,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Notes (supplier, invoice ref, etc.)',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.pop(ctx, true),
            icon: const Icon(Icons.add, size: 16),
            label: const Text('Add to Branch Stock'),
            style: FilledButton.styleFrom(backgroundColor: Colors.teal.shade700),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    final qty = double.tryParse(qtyCtrl.text.trim()) ?? 0;
    if (qty <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a quantity greater than 0')),
      );
      return;
    }

    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      await repo.adjustBranchStock({
        'item_sku': sku,
        'quantity_change': qty,
        'adjustment_type': 'STOCK_IN',
        'notes': notesCtrl.text.trim().isNotEmpty
            ? notesCtrl.text.trim()
            : 'Stock received for kitchen production — $itemName',
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Added $qty $unit of $itemName to branch stock.'),
            backgroundColor: Colors.teal.shade700,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to add stock: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  List<Map<String, dynamic>> get _filteredStock {
    final q = _stockSearch.toLowerCase();
    return _stock.where((s) {
      if (_isBarItem(s)) return false; // bar items don't need recipes
      if (q.isEmpty) return true;
      return '${s['item_name']}'.toLowerCase().contains(q) ||
          '${s['item_sku']}'.toLowerCase().contains(q);
    }).toList();
  }

  List<Map<String, dynamic>> get _filteredRecipes {
    final q = _recipeSearch.toLowerCase();
    var list = _recipes;
    if (_selectedStock != null) {
      final sku = '${_selectedStock!['item_sku']}';
      list = list.where((r) {
        return '${r['raw_item_sku']}' == sku;
      }).toList();
    }
    if (q.isNotEmpty) {
      list = list
          .where((r) =>
              '${r['produced_item_name']}'.toLowerCase().contains(q) ||
              '${r['raw_item_name']}'.toLowerCase().contains(q))
          .toList();
    }
    return list;
  }

  /// The header "+ Add" button must match whichever tab is active — it used
  /// to always open the Type A recipe dialog regardless of tab, so on the
  /// Yield Splits / Direct Items / Exempt Items tabs there was effectively no
  /// way to add a new item from the header. Returns null on tabs with no
  /// single-item "add" action (Unregistered, Shift & Cashier Analytics).
  Widget? _addButtonForActiveTab() {
    switch (_activeTab) {
      case 0:
        return FilledButton.icon(
          onPressed: () => _openRecipeDialog(null),
          icon: const Icon(Icons.add, size: 16),
          label: const Text('Add Recipe'),
        );
      case 1:
        return FilledButton.icon(
          onPressed: _openPoolLinkDialog,
          icon: const Icon(Icons.add, size: 16),
          label: const Text('Add Yield Split'),
        );
      case 2:
        return FilledButton.icon(
          onPressed: _openDirectItemDialog,
          icon: const Icon(Icons.add, size: 16),
          label: const Text('Add Direct Item'),
        );
      case 3:
        return FilledButton.icon(
          onPressed: _openExemptItemDialog,
          icon: const Icon(Icons.add, size: 16),
          label: const Text('Add Exempt Item'),
        );
      default:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final addButton = _addButtonForActiveTab();
    return _Page(
        title: 'Food Control & Shift Analytics',
        subtitle:
            'Kitchen production engine — recipe config, yield splits, direct items, POS consumption sync, cashier shifts, and deep variance analytics.',
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              _loadRecipes();
              _loadShifts();
              _loadDirectItems();
              _loadExemptItems();
              _loadPoolLinks();
              _loadUnregisteredItems();
            },
            tooltip: 'Refresh',
          ),
          if (addButton != null) addButton,
        ],
        children: [
          Container(
            decoration: BoxDecoration(
              color: Colors.teal,
              borderRadius: BorderRadius.circular(10),
            ),
            child: TabBar(
              controller: _tabController,
              isScrollable: true,
              labelColor: Colors.white,
              unselectedLabelColor: Colors.white60,
              indicatorColor: Colors.white,
              indicatorSize: TabBarIndicatorSize.tab,
              tabs: const [
                Tab(
                  icon: Icon(Icons.restaurant_menu_outlined, size: 18),
                  text: 'Recipes & BOM (Type A)',
                ),
                Tab(
                  icon: Icon(Icons.pie_chart_outline, size: 18),
                  text: 'Yield Splits (Type B)',
                ),
                Tab(
                  icon: Icon(Icons.compare_arrows, size: 18),
                  text: 'Direct Items (Type C)',
                ),
                Tab(
                  icon: Icon(Icons.block_outlined, size: 18),
                  text: 'Exempt Items',
                ),
                Tab(
                  icon: Icon(Icons.report_gmailerrorred_outlined, size: 18),
                  text: 'Unregistered',
                ),
                Tab(
                  icon: Icon(Icons.analytics_outlined, size: 18),
                  text: 'Shift & Cashier Analytics',
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: MediaQuery.of(context).size.height - 260,
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildRecipesAndStockTab(),
                _buildYieldSplitsTab(),
                _buildDirectItemsTab(),
                _buildExemptItemsTab(),
                _buildUnregisteredTab(),
                _buildShiftUsageAnalyticsTab(),
              ],
            ),
          ),
        ],
    );
  }

  // ── Type B: Yield Splits (pool links) ──────────────────────
  Widget _buildYieldSplitsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.teal.shade50,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.teal.shade200),
            ),
            child: Text(
              'A pool item (e.g. a whole chicken) holds the physical stock. '
              'Fractional POS items (Quarter, Half) point at the pool with a fraction '
              '(0.25, 0.5) and deduct proportionally from it on every sale — no recipe needed.',
              style: TextStyle(color: Colors.teal.shade900, fontSize: 13),
            ),
          ),
          _SectionCard(
            title: 'Configured Yield Splits',
            subtitle: 'Fractional POS items currently linked to a pool parent.',
            child: _poolLinksLoading
                ? const Center(child: Padding(
                    padding: EdgeInsets.all(24),
                    child: CircularProgressIndicator()))
                : _RecordList(
                    emptyText: 'No yield splits configured yet',
                    children: _poolLinks.map((link) {
                      // PostgREST sometimes resolves a self-referencing
                      // embed (pos_outlet_items!stock_pool_item_id) as a
                      // List instead of a single object — handle both.
                      final parentRaw = link['pool_parent'];
                      final parent = parentRaw is Map
                          ? parentRaw
                          : (parentRaw is List && parentRaw.isNotEmpty
                              ? parentRaw.first as Map?
                              : null);
                      final fraction = _fcNum(link['pool_fraction']);
                      return _RecordTile(
                        icon: Icons.pie_chart_outline,
                        title: '${link['name'] ?? link['sku'] ?? 'Item'}',
                        subtitle:
                            '${(fraction * 100).toStringAsFixed(0)}% of ${parent?['name'] ?? parent?['sku'] ?? 'pool item'}',
                        trailing: _StatusChip('${(fraction * 100).toStringAsFixed(0)}%'),
                        actions: [
                          TextButton(
                            onPressed: () => _removePoolLink('${link['id']}'),
                            child: const Text('Unlink'),
                          ),
                        ],
                      );
                    }).toList(),
                  ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _openPoolLinkDialog,
            icon: const Icon(Icons.add, size: 16),
            label: const Text('Add Yield Split'),
          ),
        ],
      ),
    );
  }

  Future<void> _removePoolLink(String posOutletItemId) async {
    await ref
        .read(branchStorekeeperRepositoryProvider)
        .clearPoolLink(posOutletItemId);
    _loadPoolLinks();
  }

  Future<void> _openPoolLinkDialog() async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _PoolLinkDialog(stock: _stock),
    );
    if (saved == true) _loadPoolLinks();
  }

  // ── Type C: Direct Items ───────────────────────────────────
  Widget _buildDirectItemsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.amber.shade50,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.amber.shade200),
            ),
            child: Text(
              'Direct items pass straight from branch stock into a POS item 1:1 — '
              'no recipe, no portioning. e.g. a canned soda issued straight to the kitchen pass.',
              style: TextStyle(color: Colors.amber.shade900, fontSize: 13),
            ),
          ),
          _SectionCard(
            title: 'Registered Direct Items',
            child: _directItemsLoading
                ? const Center(child: Padding(
                    padding: EdgeInsets.all(24),
                    child: CircularProgressIndicator()))
                : _RecordList(
                    emptyText: 'No direct items registered yet',
                    children: _directItems.map((item) {
                      final posItem = item['pos_outlet_item'] as Map?;
                      return _RecordTile(
                        icon: Icons.compare_arrows,
                        title: '${item['stock_item_name'] ?? item['stock_item_sku']}',
                        subtitle:
                            '${item['stock_item_sku']} → ${posItem?['name'] ?? posItem?['sku'] ?? 'POS item'}',
                        actions: [
                          TextButton(
                            onPressed: () => _removeDirectItem('${item['id']}'),
                            child: const Text('Remove'),
                          ),
                        ],
                      );
                    }).toList(),
                  ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _openDirectItemDialog,
            icon: const Icon(Icons.add, size: 16),
            label: const Text('Add Direct Item'),
          ),
        ],
      ),
    );
  }

  Future<void> _removeDirectItem(String id) async {
    await ref
        .read(branchStorekeeperRepositoryProvider)
        .deactivateDirectItem(id);
    _loadDirectItems();
    _loadUnregisteredItems();
  }

  Future<void> _openDirectItemDialog() async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _DirectItemDialog(stock: _stock),
    );
    if (saved == true) {
      _loadDirectItems();
      _loadUnregisteredItems();
    }
  }

  // ── Exempt Items ────────────────────────────────────────────
  Widget _buildExemptItemsTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.grey.shade300),
            ),
            child: const Text(
              'Items explicitly marked out of scope for food control — bar drinks, '
              'or anything with no practical recipe (e.g. fresh fruit served as-is).',
              style: TextStyle(fontSize: 13),
            ),
          ),
          _SectionCard(
            title: 'Exempt POS Items',
            child: _exemptItemsLoading
                ? const Center(child: Padding(
                    padding: EdgeInsets.all(24),
                    child: CircularProgressIndicator()))
                : _RecordList(
                    emptyText: 'No items exempted yet',
                    children: _exemptItems.map((item) {
                      final posItem = item['pos_outlet_item'] as Map?;
                      return _RecordTile(
                        icon: Icons.block_outlined,
                        title: '${posItem?['name'] ?? posItem?['sku'] ?? 'POS item'}',
                        subtitle: '${item['reason'] ?? 'No reason given'}',
                        actions: [
                          TextButton(
                            onPressed: () => _removeExemptItem('${item['id']}'),
                            child: const Text('Remove'),
                          ),
                        ],
                      );
                    }).toList(),
                  ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _openExemptItemDialog,
            icon: const Icon(Icons.add, size: 16),
            label: const Text('Exempt an Item'),
          ),
        ],
      ),
    );
  }

  Future<void> _removeExemptItem(String id) async {
    await ref.read(branchStorekeeperRepositoryProvider).deleteExemptItem(id);
    _loadExemptItems();
    _loadUnregisteredItems();
  }

  Future<void> _openExemptItemDialog() async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => const _ExemptItemDialog(),
    );
    if (saved == true) {
      _loadExemptItems();
      _loadUnregisteredItems();
    }
  }

  // ── Unregistered (gap finder) ───────────────────────────────
  Widget _buildUnregisteredTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.red.shade50,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.red.shade200),
            ),
            child: Text(
              'Sellable POS items (excluding bar) with no recipe, yield split, direct '
              'mapping or exemption. These have no food control coverage at all.',
              style: TextStyle(color: Colors.red.shade900, fontSize: 13),
            ),
          ),
          _SectionCard(
            title: 'Unregistered Items',
            child: _unregisteredLoading
                ? const Center(child: Padding(
                    padding: EdgeInsets.all(24),
                    child: CircularProgressIndicator()))
                : _RecordList(
                    emptyText: 'Every item is classified — nothing to fix',
                    children: _unregisteredItems.map((item) {
                      return _RecordTile(
                        icon: Icons.report_gmailerrorred_outlined,
                        title: '${item['name'] ?? item['sku']}',
                        subtitle: '${item['sku']} | ${item['category'] ?? '-'}',
                        actions: [
                          TextButton(
                            onPressed: () => _openRecipeDialog(null),
                            child: const Text('Add Recipe'),
                          ),
                          TextButton(
                            onPressed: _openPoolLinkDialog,
                            child: const Text('Add Yield Split'),
                          ),
                          TextButton(
                            onPressed: _openDirectItemDialog,
                            child: const Text('Mark Direct'),
                          ),
                          TextButton(
                            onPressed: _openExemptItemDialog,
                            child: const Text('Exempt'),
                          ),
                        ],
                      );
                    }).toList(),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecipesAndStockTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.blue.shade50,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.blue.shade200),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.info_outline, color: Colors.blue.shade700, size: 22),
              const SizedBox(width: 10),
              Expanded(
                child: RichText(
                  text: TextSpan(
                    style: TextStyle(
                        color: Colors.blue.shade900, fontSize: 13, height: 1.6),
                    children: const [
                      TextSpan(
                          text: 'Restaurant items',
                          style: TextStyle(fontWeight: FontWeight.w800)),
                      TextSpan(
                          text:
                              ' (food, snacks, meals): configure a recipe here → commit daily production in Outlet Production → ingredients auto-deducted from branch stock.\n'),
                      TextSpan(
                          text: 'Bar items',
                          style: TextStyle(fontWeight: FontWeight.w800)),
                      TextSpan(
                          text:
                              ' (beers, spirits, sodas, wines): issue directly from Branch Stock via POS Outlet Issue → bar stock increases immediately. No recipe or production needed. Bar items are excluded from this page.'),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Left: Branch Stock ──
              SizedBox(
                width: 300,
                child: Card(
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.teal,
                          borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(12)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.inventory_2_outlined,
                                color: Colors.white, size: 18),
                            const SizedBox(width: 8),
                            const Expanded(
                              child: Text('Branch Stock',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700)),
                            ),
                            if (_selectedStock != null)
                              GestureDetector(
                                onTap: () =>
                                    setState(() => _selectedStock = null),
                                child: const Icon(Icons.close,
                                    color: Colors.white70, size: 16),
                              ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(8),
                        child: TextField(
                          decoration: const InputDecoration(
                            hintText: 'Search ingredients…',
                            prefixIcon: Icon(Icons.search, size: 18),
                            isDense: true,
                            border: OutlineInputBorder(),
                          ),
                          onChanged: (v) => setState(() => _stockSearch = v),
                        ),
                      ),
                      Expanded(
                        child: ListView.builder(
                          itemCount: _filteredStock.length,
                          itemBuilder: (ctx, i) {
                            final s = _filteredStock[i];
                            final selected =
                                _selectedStock?['item_sku'] == s['item_sku'];
                            final qty = _fcNum(s['quantity']);
                            return ListTile(
                              dense: true,
                              selected: selected,
                              selectedTileColor:
                                  Colors.teal.withOpacity(0.08),
                              onTap: () => setState(
                                  () => _selectedStock = selected ? null : s),
                              title: Text('${s['item_name']}',
                                  style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600)),
                              subtitle: Text(
                                  '${s['item_sku']} · ${s['unit_of_measure'] ?? s['unit'] ?? ''}',
                                  style: const TextStyle(fontSize: 11)),
                              trailing: FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                        '${qty.toStringAsFixed(1)} ${s['unit_of_measure'] ?? s['unit'] ?? ''}',
                                        style: TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 12,
                                            color: qty <= 0
                                                ? Colors.red
                                                : Colors.teal)),
                                    const SizedBox(height: 2),
                                    GestureDetector(
                                      onTap: () => _openAddParentStockDialog(s),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 6, vertical: 1),
                                        decoration: BoxDecoration(
                                          color: Colors.teal.shade50,
                                          border: Border.all(
                                              color: Colors.teal.shade300),
                                          borderRadius:
                                              BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          '+ Add',
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w700,
                                            color: Colors.teal.shade700,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              // ── Right: Recipes ──
              Expanded(
                child: Card(
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.teal.shade700,
                          borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(12)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.restaurant_outlined,
                                color: Colors.white, size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _selectedStock == null
                                    ? 'All Recipes'
                                    : 'Recipes using ${_selectedStock!['item_name']}',
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(8),
                        child: TextField(
                          decoration: const InputDecoration(
                            hintText: 'Search food controls…',
                            prefixIcon: Icon(Icons.search, size: 18),
                            isDense: true,
                            border: OutlineInputBorder(),
                          ),
                          onChanged: (v) => setState(() => _recipeSearch = v),
                        ),
                      ),
                      if (_loading)
                        const Expanded(
                            child: Center(child: CircularProgressIndicator()))
                      else if (_filteredRecipes.isEmpty)
                        Expanded(
                          child: Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.restaurant_menu_outlined,
                                    size: 48, color: Colors.grey.shade400),
                                const SizedBox(height: 12),
                                Text(
                                  _selectedStock != null
                                      ? 'No food control uses ${_selectedStock!['item_name']} yet.'
                                      : 'No food controls configured yet.',
                                  style: TextStyle(color: Colors.grey.shade600),
                                ),
                                const SizedBox(height: 12),
                                FilledButton.icon(
                                  onPressed: () => _openRecipeDialog(null),
                                  icon: const Icon(Icons.add, size: 16),
                                  label: const Text('Add Food Control'),
                                ),
                              ],
                            ),
                          ),
                        )
                      else
                        Expanded(
                          child: ListView.separated(
                            padding: const EdgeInsets.all(8),
                            itemCount: _filteredRecipes.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: 8),
                            itemBuilder: (ctx, i) {
                              final r = _filteredRecipes[i];
                              return _RecipeCard(
                                recipe: r,
                                onEdit: () => _openRecipeDialog(r),
                                onDeactivate: () => _deactivateFoodControl(r),
                              );
                            },
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildShiftUsageAnalyticsTab() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Left Side: Shift List (width: 300) ──
        SizedBox(
          width: 300,
          child: Card(
            margin: EdgeInsets.zero,
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.teal,
                    borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(12)),
                  ),
                  child: Row(
                    children: const [
                      Icon(Icons.history, color: Colors.white, size: 18),
                      SizedBox(width: 8),
                      Text(
                        'Kitchen Shifts',
                        style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: _loadingShifts && _shifts.isEmpty
                      ? const Center(child: CircularProgressIndicator())
                      : _shifts.isEmpty
                          ? Center(
                              child: Text(
                                'No shifts found',
                                style: TextStyle(color: Colors.grey.shade600),
                              ),
                            )
                          : ListView.builder(
                              itemCount: _shifts.length,
                              itemBuilder: (ctx, i) {
                                final s = _shifts[i];
                                final isSelected =
                                    _selectedShift?['id'] == s['id'];
                                final shiftNum = s['shift_number'] ??
                                    '${s['id']}'.substring(0, 8);
                                final shiftType = s['shift_type'] ?? 'Shift';
                                final status = '${s['status'] ?? ''}'.toUpperCase();
                                final dateStr = s['shift_date'] ?? '';
                                
                                return ListTile(
                                  dense: true,
                                  selected: isSelected,
                                  selectedTileColor:
                                      Colors.teal.withOpacity(0.08),
                                  onTap: () => _selectShift(s),
                                  title: Text(
                                    '$shiftType - #$shiftNum',
                                    style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600),
                                  ),
                                  subtitle: Text(
                                    dateStr,
                                    style: const TextStyle(fontSize: 11),
                                  ),
                                  trailing: _statusBadge(status),
                                );
                              },
                            ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 12),
        // ── Right Side: Analytics Details ──
        Expanded(
          child: _selectedShift == null
              ? Card(
                  margin: EdgeInsets.zero,
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.analytics_outlined,
                            size: 64, color: Colors.grey.shade300),
                        const SizedBox(height: 16),
                        Text(
                          'No Kitchen Shift Selected',
                          style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: Colors.grey.shade700),
                        ),
                        const SizedBox(height: 8),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 24),
                          child: Text(
                            'Select a kitchen shift from the list to view end-of-shift usage, linked cashier shifts, and raw ingredient variance analytics.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                fontSize: 13, color: Colors.grey.shade500),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              : _loadingAnalytics
                  ? const Card(
                      margin: EdgeInsets.zero,
                      child: Center(child: CircularProgressIndicator()),
                    )
                  : Card(
                      margin: EdgeInsets.zero,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Shift Header Info
                              _buildShiftHeaderSection(),
                              const SizedBox(height: 20),
                              // Linked Cashier Shifts
                              _buildLinkedCashierShiftsSection(),
                              const SizedBox(height: 20),
                              // Raw Ingredient Variance Table
                              _buildVarianceTableSection(),
                              const SizedBox(height: 20),
                              // Wastage Alerts
                              _buildWastageAlertsSection(),
                            ],
                          ),
                        ),
                      ),
                    ),
        ),
      ],
    );
  }

  Widget _buildShiftHeaderSection() {
    final shift = _analyticsData['shift'] ?? _selectedShift ?? {};
    final shiftNum = shift['shift_number'] ?? '${shift['id']}'.substring(0, 8);
    final shiftType = shift['shift_type'] ?? 'Shift';
    final status = '${shift['status'] ?? ''}'.toUpperCase();
    final dateStr = shift['shift_date'] ?? '';
    final openedAt = shift['opened_at'] != null ? DateTime.tryParse('${shift['opened_at']}')?.toLocal().toString().substring(0, 16) ?? '' : '—';
    final closedAt = shift['closed_at'] != null ? DateTime.tryParse('${shift['closed_at']}')?.toLocal().toString().substring(0, 16) ?? '' : '—';
    
    // Storekeeper
    String skName = '—';
    if (shift['store_keeper'] != null) {
      final sk = shift['store_keeper'];
      skName = '${sk['first_name'] ?? ''} ${sk['last_name'] ?? ''}'.trim();
    } else if (shift['opened_by_user'] != null) {
      final obu = shift['opened_by_user'];
      skName = '${obu['first_name'] ?? ''} ${obu['last_name'] ?? ''}'.trim();
    }
    
    // Chefs
    String chefsList = '—';
    final staff = _analyticsData['shift_staff'] as List?;
    if (staff != null && staff.isNotEmpty) {
      chefsList = staff.map((st) {
        final profile = st['profile'] ?? {};
        return '${profile['first_name'] ?? ''} ${profile['last_name'] ?? ''}'.trim();
      }).where((name) => name.isNotEmpty).join(', ');
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '$shiftType - Session #$shiftNum',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
              _statusBadge(status),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(),
          const SizedBox(height: 12),
          Wrap(
            spacing: 24,
            runSpacing: 12,
            children: [
              _buildHeaderDetailItem('Date', dateStr, Icons.calendar_today_outlined),
              _buildHeaderDetailItem('Opened At', openedAt, Icons.login_outlined),
              _buildHeaderDetailItem('Closed At', closedAt, Icons.logout_outlined),
              _buildHeaderDetailItem('Storekeeper', skName, Icons.person_outline),
              _buildHeaderDetailItem('Assigned Chefs', chefsList, Icons.restaurant_menu_outlined),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderDetailItem(String label, String value, IconData icon) {
    return SizedBox(
      width: 180,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: Colors.grey.shade600),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey.shade500,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLinkedCashierShiftsSection() {
    final list = _analyticsData['cashier_shifts'] as List?;
    final totalSales = list?.fold<double>(0, (sum, item) => sum + _fcNum(item['total_cost'])) ?? 0.0;
    final totalPortions = list?.fold<double>(0, (sum, item) => sum + _fcNum(item['total_portions'])) ?? 0.0;
    final unmatched = _analyticsData['unmatched_summary'] as Map?;
    final unmatchedCount = (unmatched?['count'] as num?)?.toInt() ?? 0;
    final unmatchedValue = _fcNum(unmatched?['value']);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (unmatchedCount > 0)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.red.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.red.shade200),
            ),
            child: Row(
              children: [
                Icon(Icons.report_problem_outlined, color: Colors.red.shade800),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    '$unmatchedCount sale(s) worth KES ${unmatchedValue.toStringAsFixed(2)} were sold via POS but never issued to this kitchen shift (e.g. an unissued pastry batch). Issue the matching stock before closing the shift, or this variance will show as unexplained shortage.',
                    style: TextStyle(color: Colors.red.shade900, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Linked Cashier Shifts',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
            if (list != null && list.isNotEmpty)
              Text(
                'Total Sales: KES ${totalSales.toStringAsFixed(2)} (${totalPortions.toStringAsFixed(1)} portions sold)',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Colors.teal,
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        list == null || list.isEmpty
            ? Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.amber.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.warning_amber_rounded, color: Colors.amber.shade800),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'No cashier shifts detected during this kitchen shift. Either no sales were made at POS cashier stations or POS sales were not associated with this kitchen shift yet.',
                        style: TextStyle(color: Colors.amber.shade900, fontSize: 13),
                      ),
                    ),
                  ],
                ),
              )
            : GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 8,
                  childAspectRatio: 3.2,
                ),
                itemCount: list.length,
                itemBuilder: (ctx, i) {
                  final c = list[i];
                  final shiftNum = c['shift_number'] ?? 'Shift';
                  final cashier = c['cashier_name'] ?? 'Cashier';
                  final outlet = c['outlet_name'] ?? 'Outlet';
                  final sales = _fcNum(c['total_cost']);
                  final portions = _fcNum(c['total_portions']);
                  final status = '${c['status'] ?? ''}'.toUpperCase();

                  return Card(
                    margin: EdgeInsets.zero,
                    color: Colors.grey.shade50,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                      side: BorderSide(color: Colors.grey.shade200),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  '$outlet - #$shiftNum',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              _statusBadge(status),
                            ],
                          ),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                cashier,
                                style: TextStyle(
                                  fontSize: 11,
                                  color: Colors.grey.shade600,
                                ),
                              ),
                              Text(
                                'KES ${sales.toStringAsFixed(2)} (${portions.toStringAsFixed(1)} sold)',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.green,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
      ],
    );
  }

  Widget _buildVarianceTableSection() {
    final list = _analyticsData['items'] as List?;
    if (list == null || list.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Raw Ingredient Variance',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(16),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Text(
              'No raw ingredients tracked in this kitchen shift.',
              style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Raw Ingredient Variance',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey.shade200),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Table(
            columnWidths: const {
              0: FlexColumnWidth(2.0), // Ingredient
              1: FlexColumnWidth(1.0), // Opening
              2: FlexColumnWidth(1.0), // Issued
              3: FlexColumnWidth(1.0), // POS Consumed
              4: FlexColumnWidth(1.0), // Spoilage
              5: FlexColumnWidth(1.2), // Exp Closing
              6: FlexColumnWidth(1.2), // Phy Closing
              7: FlexColumnWidth(1.0), // Variance
              8: FlexColumnWidth(1.2), // Variance Cost
              9: FlexColumnWidth(1.2), // Status
            },
            defaultVerticalAlignment: TableCellVerticalAlignment.middle,
            children: [
              // Table Header
              TableRow(
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(8)),
                ),
                children: [
                  _buildTableHeaderCell('Ingredient'),
                  _buildTableHeaderCell('Opening'),
                  _buildTableHeaderCell('Issued'),
                  _buildTableHeaderCell('POS Consumed'),
                  _buildTableHeaderCell('Spoilage'),
                  _buildTableHeaderCell('Expected'),
                  _buildTableHeaderCell('Physical'),
                  _buildTableHeaderCell('Variance'),
                  _buildTableHeaderCell('Cost (KES)'),
                  _buildTableHeaderCell('Alert'),
                ],
              ),
              // Table Data
              ...list.map((item) {
                final name = item['item_name'] ?? '';
                final sku = item['item_sku'] ?? '';
                final unit = item['unit_of_measure'] ?? '';
                final opening = _fcNum(item['opening_stock']);
                final additions = _fcNum(item['additions']);
                final posConsumed = _fcNum(item['sold_quantity']);
                final spoilage = _fcNum(item['spoilage_quantity']);
                final expected = _fcNum(item['system_closing_stock']);
                
                final hasPhysical = item['physical_count'] != null;
                final physical = hasPhysical ? _fcNum(item['physical_count']) : 0.0;
                final variance = hasPhysical ? _fcNum(item['variance']) : 0.0;
                final varianceCost = hasPhysical ? _fcNum(item['variance_value']) : 0.0;

                // Determine Alert Badge
                Widget alertBadge;
                if (!hasPhysical) {
                  alertBadge = _buildAlertBadge('UNCLOSED', Colors.grey.shade100, Colors.grey.shade700);
                } else if (variance == 0.0) {
                  alertBadge = _buildAlertBadge('OK', Colors.green.shade100, Colors.green.shade800);
                } else {
                  final alerts = _analyticsData['alerts'] as List?;
                  final matchedAlert = alerts?.firstWhere(
                    (a) => a['item_sku'] == sku,
                    orElse: () => null,
                  );
                  if (matchedAlert != null) {
                    final severity = MatchedSeverity(matchedAlert['severity']);
                    if (severity == 'critical') {
                      alertBadge = _buildAlertBadge('CRITICAL', Colors.red.shade100, Colors.red.shade800);
                    } else {
                      alertBadge = _buildAlertBadge('WARNING', Colors.amber.shade100, Colors.amber.shade800);
                    }
                  } else {
                    if (variance < 0) {
                      alertBadge = _buildAlertBadge('SHORTAGE', Colors.orange.shade100, Colors.orange.shade800);
                    } else {
                      alertBadge = _buildAlertBadge('OVERAGE', Colors.blue.shade100, Colors.blue.shade800);
                    }
                  }
                }

                return TableRow(
                  decoration: const BoxDecoration(
                    border: Border(bottom: BorderSide(color: Color(0xFFEEEEEE))),
                  ),
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '$sku · $unit',
                            style: TextStyle(fontSize: 10, color: Colors.grey.shade500),
                          ),
                        ],
                      ),
                    ),
                    _buildTableCellText(opening.toStringAsFixed(1)),
                    _buildTableCellText(additions.toStringAsFixed(1)),
                    _buildTableCellText(posConsumed.toStringAsFixed(1)),
                    _buildTableCellText(spoilage.toStringAsFixed(1)),
                    _buildTableCellText(expected.toStringAsFixed(1)),
                    _buildTableCellText(hasPhysical ? physical.toStringAsFixed(1) : '—'),
                    _buildTableCellText(
                      hasPhysical ? (variance > 0 ? '+${variance.toStringAsFixed(1)}' : variance.toStringAsFixed(1)) : '—',
                      color: hasPhysical
                          ? (variance < 0
                              ? Colors.red
                              : (variance > 0 ? Colors.blue : Colors.green))
                          : null,
                      bold: true,
                    ),
                    _buildTableCellText(
                      hasPhysical ? varianceCost.toStringAsFixed(2) : '—',
                      color: hasPhysical && varianceCost < 0 ? Colors.red : null,
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: alertBadge,
                    ),
                  ],
                );
              }),
            ],
          ),
        ),
      ],
    );
  }

  String MatchedSeverity(dynamic severity) {
    if (severity == null) return '';
    return '$severity'.toLowerCase();
  }

  Widget _buildTableHeaderCell(String text) {
    return Padding(
      padding: const EdgeInsets.all(8),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: Colors.black87,
        ),
      ),
    );
  }

  Widget _buildTableCellText(String text, {Color? color, bool bold = false}) {
    return Padding(
      padding: const EdgeInsets.all(8),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11,
          fontWeight: bold ? FontWeight.w700 : FontWeight.w600,
          color: color,
        ),
      ),
    );
  }

  Widget _buildAlertBadge(String label, Color bg, Color fg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 8.5,
          fontWeight: FontWeight.w800,
          color: fg,
        ),
      ),
    );
  }

  Widget _buildWastageAlertsSection() {
    final alerts = _analyticsData['alerts'] as List?;
    final liabilityCases = _analyticsData['liability_cases'] as List?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Wastage Alerts & Staff Liability',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        
        if (liabilityCases != null && liabilityCases.isNotEmpty) ...[
          ...liabilityCases.map((lc) {
            final status = '${lc['status'] ?? ''}'.replaceAll('_', ' ').toUpperCase();
            final action = '${lc['liability_action'] ?? ''}'.toUpperCase();
            final totalCost = _fcNum(lc['total_variance_cost']);
            final reason = lc['write_off_reason'] ?? lc['notes'] ?? '';
            final isWriteOff = lc['status'] == 'written_off';
            final allocations = lc['allocations'] as List?;

            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isWriteOff ? Colors.green.shade50 : Colors.purple.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: isWriteOff ? Colors.green.shade200 : Colors.purple.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(
                            isWriteOff ? Icons.check_circle_outline : Icons.gavel_outlined,
                            color: isWriteOff ? Colors.green.shade800 : Colors.purple.shade800,
                            size: 18,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            isWriteOff ? 'Accountant Write-off' : 'Staff Liability Billed',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: isWriteOff ? Colors.green.shade900 : Colors.purple.shade900,
                            ),
                          ),
                        ],
                      ),
                      _statusBadge(status),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Total Reconciliation Cost: KES ${totalCost.toStringAsFixed(2)}',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                  if (reason.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Reason/Notes: $reason',
                      style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic),
                    ),
                  ],
                  if (allocations != null && allocations.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    const Text(
                      'Billing Details:',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 4),
                    ...allocations.map((a) {
                      final name = a['staff_name'] ?? a['user_name'] ?? 'Chef';
                      final amt = _fcNum(a['amount']);
                      return Padding(
                        padding: const EdgeInsets.only(left: 12, bottom: 2),
                        child: Text(
                          '• $name: KES ${amt.toStringAsFixed(2)}',
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                        ),
                      );
                    }),
                  ],
                ],
              ),
            );
          }),
          const SizedBox(height: 8),
        ],

        alerts == null || alerts.isEmpty
            ? Container(
                padding: const EdgeInsets.all(16),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.green.shade200),
                ),
                child: Row(
                  children: [
                    Icon(Icons.check_circle_outline, color: Colors.green.shade700),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'No wastage alerts or shortages reported for this shift.',
                        style: TextStyle(color: Colors.green.shade900, fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              )
            : ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: alerts.length,
                itemBuilder: (ctx, i) {
                  final a = alerts[i];
                  final isCritical = a['severity'] == 'critical';
                  final isAcknowledged = a['acknowledged_by'] != null;
                  final type = '${a['alert_type'] ?? ''}'.replaceAll('_', ' ').toUpperCase();
                  final message = a['message'] ?? '';
                  final cost = _fcNum(a['variance_cost']);

                  Color cardBg = isAcknowledged
                      ? Colors.grey.shade50
                      : (isCritical ? Colors.red.shade50 : Colors.amber.shade50);
                  Color cardBorder = isAcknowledged
                      ? Colors.grey.shade200
                      : (isCritical ? Colors.red.shade200 : Colors.amber.shade200);
                  Color fgColor = isAcknowledged
                      ? Colors.grey.shade700
                      : (isCritical ? Colors.red.shade900 : Colors.amber.shade900);

                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    color: cardBg,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                      side: BorderSide(color: cardBorder),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            isAcknowledged
                                ? Icons.check_circle_outline
                                : (isCritical ? Icons.error_outline : Icons.warning_amber_rounded),
                            color: isAcknowledged
                                ? Colors.grey.shade600
                                : (isCritical ? Colors.red.shade800 : Colors.amber.shade800),
                            size: 20,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      type,
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w800,
                                        color: fgColor,
                                      ),
                                    ),
                                    if (cost > 0)
                                      Text(
                                        'Loss: KES ${cost.toStringAsFixed(2)}',
                                        style: TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          color: isAcknowledged ? Colors.grey.shade700 : Colors.red,
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  message,
                                  style: TextStyle(fontSize: 12, color: fgColor, fontWeight: FontWeight.w600),
                                ),
                                if (isAcknowledged) ...[
                                  const SizedBox(height: 6),
                                  Text(
                                    'Acknowledged',
                                    style: TextStyle(
                                      fontSize: 10,
                                      color: Colors.grey.shade500,
                                      fontStyle: FontStyle.italic,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          if (!isAcknowledged) ...[
                            const SizedBox(width: 8),
                            TextButton.icon(
                              onPressed: () => _acknowledgeAlert(a),
                              icon: const Icon(Icons.check, size: 14),
                              label: const Text('Acknowledge', style: TextStyle(fontSize: 11)),
                              style: TextButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 8),
                                minimumSize: Size.zero,
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                },
              ),
      ],
    );
  }

  Future<void> _acknowledgeAlert(Map<String, dynamic> alert) async {
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      await repo.acknowledgeWastageAlert('${alert['id']}');
      
      if (_selectedShift != null) {
        final alerts = await repo.kitchenWastageAlerts(shiftId: '${_selectedShift!['id']}');
        if (mounted) {
          setState(() {
            _analyticsData['alerts'] = alerts;
          });
        }
      }
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Wastage alert acknowledged successfully'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to acknowledge alert: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Widget _statusBadge(String raw) {
    final s = raw.toLowerCase();
    Color bg = Colors.grey.shade100;
    Color fg = Colors.grey.shade700;
    if (s == 'paid' || s == 'completed' || s == 'approved') {
      bg = Colors.green.shade100; fg = Colors.green.shade800;
    } else if (s == 'credit_bill' || s == 'credit' || s == 'pending_chef') {
      bg = Colors.purple.shade100; fg = Colors.purple.shade800;
    } else if (s == 'partial' || s == 'pending_review') {
      bg = Colors.amber.shade100; fg = Colors.amber.shade900;
    } else if (s == 'voided' || s == 'cancelled' || s == 'rejected') {
      bg = Colors.red.shade100; fg = Colors.red.shade800;
    } else if (s == 'open' || s == 'pending') {
      bg = Colors.orange.shade100; fg = Colors.orange.shade800;
    } else if (s == 'closed') {
      bg = Colors.blue.shade100; fg = Colors.blue.shade800;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg, borderRadius: BorderRadius.circular(4),
      ),
      child: Text(raw.toUpperCase(), style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: fg)),
    );
  }


  Future<void> _openRecipeDialog(Map<String, dynamic>? existing) async {
    final saved = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _FoodControlDialog(
        existing: existing,
        preselectedRawItem: existing == null ? _selectedStock : null,
        stock: _stock,
      ),
    );
    if (saved == true) _loadRecipes();
  }

  Future<void> _deactivateFoodControl(Map<String, dynamic> recipe) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Deactivate Food Control'),
        content: Text(
          'Deactivate ${recipe['raw_item_name']} to ${recipe['produced_item_name']}?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Deactivate'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await ref
        .read(branchStorekeeperRepositoryProvider)
        .deactivateProductionRecipe('${recipe['id']}');
    _loadRecipes();
  }
}

// ─── Recipe Card ────────────────────────────────────────────────────────────

class _RecipeCard extends StatelessWidget {
  const _RecipeCard({
    required this.recipe,
    required this.onEdit,
    required this.onDeactivate,
  });
  final Map<String, dynamic> recipe;
  final VoidCallback onEdit;
  final VoidCallback onDeactivate;

  @override
  Widget build(BuildContext context) {
    final rawQty = _fcNum(recipe['raw_quantity']);
    final producedQty = _fcNum(recipe['produced_quantity']);
    final cost = _fcNum(recipe['cost_per_output']);
    final variance = _fcNum(recipe['allowed_variance_percent']);
    final spoilage = _fcNum(recipe['spoilage_threshold_percent']);
    final ratio = rawQty > 0 ? producedQty / rawQty : 0;
    final requiresConfirmation = recipe['requires_yield_confirmation'] != false;

    return Card(
      elevation: 0,
      color: Colors.grey.shade50,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: Colors.grey.shade200)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.teal.shade700,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    '${recipe['produced_item_name'] ?? recipe['recipe_code'] ?? 'Food Control'}',
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 13),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.orange.shade100,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    ratio > 0 ? '1 : ${ratio.toStringAsFixed(2)}' : '—',
                    style: TextStyle(
                        color: Colors.orange.shade800,
                        fontWeight: FontWeight.w600,
                        fontSize: 11),
                  ),
                ),
                const SizedBox(width: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: requiresConfirmation
                        ? Colors.purple.shade50
                        : Colors.green.shade50,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    requiresConfirmation ? 'Confirms yield' : 'Auto-finalizes',
                    style: TextStyle(
                        color: requiresConfirmation
                            ? Colors.purple.shade700
                            : Colors.green.shade700,
                        fontWeight: FontWeight.w600,
                        fontSize: 10),
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  onPressed: onEdit,
                  tooltip: 'Edit food control',
                  style:
                      IconButton.styleFrom(foregroundColor: Colors.teal),
                ),
                IconButton(
                  icon: const Icon(Icons.block, size: 18),
                  onPressed: onDeactivate,
                  tooltip: 'Deactivate',
                  style: IconButton.styleFrom(foregroundColor: Colors.red),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              '${_qtyText(rawQty)} ${recipe['raw_unit'] ?? ''} ${recipe['raw_item_name'] ?? ''}  →  '
              '${_qtyText(producedQty)} ${recipe['produced_unit'] ?? ''} ${recipe['produced_item_name'] ?? ''}',
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 14,
              runSpacing: 4,
              children: [
                if (cost > 0)
                  Text('Cost/output: KES ${cost.toStringAsFixed(2)}',
                      style:
                          TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                Text('Variance allowed: ${variance.toStringAsFixed(0)}%',
                    style:
                        TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                Text('Spoilage threshold: ${spoilage.toStringAsFixed(0)}%',
                    style:
                        TextStyle(fontSize: 11, color: Colors.grey.shade600)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

String _qtyText(double v) =>
    v % 1 == 0 ? v.toInt().toString() : v.toStringAsFixed(2);

// ─── Food Control Create/Edit Dialog ────────────────────────────────────────

class _FoodControlDialog extends ConsumerStatefulWidget {
  const _FoodControlDialog({
    this.existing,
    this.preselectedRawItem,
    required this.stock,
  });

  final Map<String, dynamic>? existing;
  final Map<String, dynamic>? preselectedRawItem;
  final List<Map<String, dynamic>> stock;

  @override
  ConsumerState<_FoodControlDialog> createState() => _FoodControlDialogState();
}

class _FoodControlOutput {
  _FoodControlOutput({
    required this.menuItem,
    required this.name,
    required this.quantity,
    required this.unit,
    required this.costPerOutput,
    this.sku,
    this.posOutletItemId,
    this.poolItemId,
    this.poolFraction,
  });

  final Map<String, dynamic> menuItem;
  final String name;
  final String? sku;
  final String? posOutletItemId;
  final double quantity;
  final String unit;
  final double costPerOutput;
  final String? poolItemId;
  final double? poolFraction;

  Map<String, dynamic> toPayload(String rawItemName) => {
        'recipe_name': '$rawItemName to $name',
        'produced_item_name': name,
        if (sku != null && sku!.isNotEmpty) 'produced_item_sku': sku,
        'produced_quantity': quantity,
        'produced_unit': unit,
        if (posOutletItemId != null) 'pos_outlet_item_id': posOutletItemId,
        'cost_per_output': costPerOutput,
        if (poolItemId != null) 'pool_item_id': poolItemId,
        if (poolFraction != null) 'pool_fraction': poolFraction,
      };
}

class _FoodControlDialogState extends ConsumerState<_FoodControlDialog> {
  final _rawSearchCtrl = TextEditingController();
  final _rawQtyCtrl = TextEditingController(text: '1');
  final _rawUnitCtrl = TextEditingController(text: 'KG');
  final _menuCtrl = TextEditingController();
  final _yieldQtyCtrl = TextEditingController(text: '1');
  final _yieldUnitCtrl = TextEditingController(text: 'Portions');
  final _varianceCtrl = TextEditingController(text: '2');
  final _spoilageCtrl = TextEditingController(text: '1');
  final _rawCostCtrl = TextEditingController(text: '0');
  final _poolFractionCtrl = TextEditingController(text: '1');
  bool _busy = false;
  bool _menuLoading = true;
  bool _requiresConfirmation = true;
  List<Map<String, dynamic>> _menuItems = [];
  final List<_FoodControlOutput> _outputs = [];
  Map<String, dynamic>? _selectedRaw;
  Map<String, dynamic>? _selectedMenu;
  Map<String, dynamic>? _poolItem;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    if (e != null) {
      _rawSearchCtrl.text = '${e['raw_item_name'] ?? ''}';
      _rawQtyCtrl.text = '${e['raw_quantity'] ?? 1}';
      _rawUnitCtrl.text = '${e['raw_unit'] ?? 'KG'}';
      _menuCtrl.text = '${e['produced_item_name'] ?? ''}';
      _yieldQtyCtrl.text = '${e['produced_quantity'] ?? 1}';
      _yieldUnitCtrl.text = '${e['produced_unit'] ?? 'Portions'}';
      _varianceCtrl.text = '${e['allowed_variance_percent'] ?? 2}';
      _spoilageCtrl.text = '${e['spoilage_threshold_percent'] ?? 1}';
      _rawCostCtrl.text = _inferRawCost(e).toStringAsFixed(2);
      _requiresConfirmation = e['requires_yield_confirmation'] != false;
      _selectedRaw = {
        'item_sku': e['raw_item_sku'],
        'item_name': e['raw_item_name'],
        'unit_of_measure': e['raw_unit'],
      };
      _selectedMenu = {
        'id': e['pos_outlet_item_id'] ?? e['produced_item_sku'],
        'name': e['produced_item_name'],
      };
    } else if (widget.preselectedRawItem != null) {
      _applyRaw(widget.preselectedRawItem!);
    }
    _loadMenuItems();
  }

  double _inferRawCost(Map<String, dynamic> e) {
    final stored = _fcNum(e['cost_per_output']);
    final yieldQty = _fcNum(e['produced_quantity']);
    if (stored > 0 && yieldQty > 0) return stored * yieldQty;
    return 0;
  }

  Future<void> _loadMenuItems() async {
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      final items = await repo.getRecipeLinkableMenuItems();
      if (mounted) {
        setState(() {
          _menuItems = items;
          _menuLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _menuLoading = false);
    }
  }

  void _applyRaw(Map<String, dynamic> item) {
    _selectedRaw = item;
    _rawSearchCtrl.text = '${item['item_name'] ?? item['name'] ?? ''}';
    _rawUnitCtrl.text = '${item['unit_of_measure'] ?? item['unit'] ?? 'KG'}';
    final cost = _fcNum(item['cost_price'] ?? item['unit_cost']);
    if (cost > 0) _rawCostCtrl.text = cost.toStringAsFixed(2);
  }

  String? _uuid(dynamic value) {
    final text = '$value';
    final uuid = RegExp(
      r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    );
    return uuid.hasMatch(text) ? text : null;
  }

  double get _costPerOutput {
    final rawCost = _fcNum(_rawCostCtrl.text);
    final yieldQty = _fcNum(_yieldQtyCtrl.text);
    return yieldQty <= 0 ? 0 : rawCost / yieldQty;
  }

  _FoodControlOutput? _buildCurrentOutput() {
    final selected = _selectedMenu;
    final name = _menuCtrl.text.trim();
    final qty = _fcNum(_yieldQtyCtrl.text);
    if (selected == null || name.isEmpty || qty <= 0) return null;
    final sku = '${selected['sku'] ?? selected['item_sku'] ?? selected['id'] ?? ''}';
    final posId = _uuid(selected['id']);
    final poolId = _poolItem == null ? null : _uuid(_poolItem!['id']);
    final poolFraction = poolId == null ? null : _fcNum(_poolFractionCtrl.text);
    return _FoodControlOutput(
      menuItem: selected,
      name: name,
      sku: sku,
      posOutletItemId: posId,
      quantity: qty,
      unit: _yieldUnitCtrl.text.trim().isEmpty
          ? 'Portions'
          : _yieldUnitCtrl.text.trim(),
      costPerOutput: _costPerOutput,
      poolItemId: poolId,
      poolFraction: poolFraction,
    );
  }

  void _addCurrentOutput() {
    final output = _buildCurrentOutput();
    if (output == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select a POS menu item and yield quantity first')),
      );
      return;
    }
    final exists = _outputs.any((o) =>
        (o.posOutletItemId != null && o.posOutletItemId == output.posOutletItemId) ||
        o.name.toLowerCase().trim() == output.name.toLowerCase().trim());
    if (exists) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('That POS menu item is already added')),
      );
      return;
    }
    setState(() {
      _outputs.add(output);
      _selectedMenu = null;
      _menuCtrl.clear();
      _yieldQtyCtrl.text = '1';
      _poolItem = null;
      _poolFractionCtrl.text = '1';
    });
  }

  @override
  void dispose() {
    _rawSearchCtrl.dispose();
    _rawQtyCtrl.dispose();
    _rawUnitCtrl.dispose();
    _menuCtrl.dispose();
    _yieldQtyCtrl.dispose();
    _yieldUnitCtrl.dispose();
    _varianceCtrl.dispose();
    _spoilageCtrl.dispose();
    _rawCostCtrl.dispose();
    _poolFractionCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_selectedRaw == null ||
        '${_selectedRaw!['item_sku'] ?? _selectedRaw!['sku'] ?? ''}'.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Select a raw material from branch stock')),
      );
      return;
    }
    final currentOutput = _buildCurrentOutput();
    final outputs = widget.existing == null
        ? [..._outputs, if (currentOutput != null) currentOutput]
        : <_FoodControlOutput>[];
    if (widget.existing == null && outputs.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add at least one POS menu item')),
      );
      return;
    }
    if (widget.existing != null && currentOutput == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select a POS menu item')),
      );
      return;
    }
    final rawQty = _fcNum(_rawQtyCtrl.text);
    if (rawQty <= 0 || (widget.existing != null && _fcNum(_yieldQtyCtrl.text) <= 0)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Raw quantity and yield must be greater than zero')),
      );
      return;
    }

    setState(() => _busy = true);
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      final rawSku = '${_selectedRaw!['item_sku'] ?? _selectedRaw!['sku']}';
      final rawName =
          '${_selectedRaw!['item_name'] ?? _selectedRaw!['name'] ?? _rawSearchCtrl.text}';
      final primaryOutput = widget.existing == null ? outputs.first : currentOutput!;
      if (widget.existing == null) {
        await repo.createProductionRecipe(
          rawItemSku: rawSku,
          rawItemName: rawName,
          rawQuantity: rawQty,
          rawUnit: _rawUnitCtrl.text.trim(),
          producedItemName: primaryOutput.name,
          producedItemSku: primaryOutput.sku,
          producedQuantity: primaryOutput.quantity,
          producedUnit: primaryOutput.unit,
          posOutletItemId: primaryOutput.posOutletItemId,
          allowedVariancePercent: _fcNum(_varianceCtrl.text),
          spoilageThresholdPercent: _fcNum(_spoilageCtrl.text),
          costPerOutput: primaryOutput.costPerOutput,
          requiresYieldConfirmation: _requiresConfirmation,
          poolItemId: primaryOutput.poolItemId,
          poolFraction: primaryOutput.poolFraction,
          outputs: outputs.map((o) => o.toPayload(rawName)).toList(),
        );
      } else {
        await repo.updateProductionRecipe(
          id: '${widget.existing!['id']}',
          rawItemSku: rawSku,
          rawItemName: rawName,
          rawQuantity: rawQty,
          rawUnit: _rawUnitCtrl.text.trim(),
          producedItemName: primaryOutput.name,
          producedItemSku: primaryOutput.sku,
          producedQuantity: primaryOutput.quantity,
          producedUnit: primaryOutput.unit,
          posOutletItemId: primaryOutput.posOutletItemId,
          allowedVariancePercent: _fcNum(_varianceCtrl.text),
          spoilageThresholdPercent: _fcNum(_spoilageCtrl.text),
          costPerOutput: primaryOutput.costPerOutput,
          requiresYieldConfirmation: _requiresConfirmation,
          poolItemId: primaryOutput.poolItemId,
          poolFraction: primaryOutput.poolFraction,
        );
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Food control save failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.existing != null;
    return AlertDialog(
      title: Text(isEdit ? 'Edit Food Control' : 'Create Food Control'),
      contentPadding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
      content: SizedBox(
        width: 720,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Step 1: Select Raw Material',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Autocomplete<Map<String, dynamic>>(
                initialValue: TextEditingValue(text: _rawSearchCtrl.text),
                optionsBuilder: (tv) {
                  final q = tv.text.toLowerCase().trim();
                  if (q.isEmpty) return widget.stock.take(20);
                  return widget.stock.where((s) {
                    final sku =
                        '${s['item_sku'] ?? s['sku'] ?? ''}'.toLowerCase();
                    final name =
                        '${s['item_name'] ?? s['name'] ?? ''}'.toLowerCase();
                    return sku.contains(q) || name.contains(q);
                  }).take(20);
                },
                displayStringForOption: (s) =>
                    '${s['item_name'] ?? s['name'] ?? s['item_sku'] ?? ''}',
                onSelected: (s) => setState(() => _applyRaw(s)),
                fieldViewBuilder: (ctx, ctrl, focus, onSubmit) {
                  if (ctrl.text != _rawSearchCtrl.text) {
                    ctrl.text = _rawSearchCtrl.text;
                  }
                  return TextField(
                    controller: ctrl,
                    focusNode: focus,
                    decoration: const InputDecoration(
                      labelText: 'Raw Material',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    onChanged: (v) => _rawSearchCtrl.text = v,
                  );
                },
              ),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(
                    child: TextField(
                  controller: _rawQtyCtrl,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                      labelText: 'Standard Quantity',
                      border: OutlineInputBorder(),
                      isDense: true),
                  onChanged: (_) => setState(() {}),
                )),
                const SizedBox(width: 10),
                Expanded(
                    child: TextField(
                  controller: _rawUnitCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Unit',
                      border: OutlineInputBorder(),
                      isDense: true),
                )),
                const SizedBox(width: 10),
                Expanded(
                    child: TextField(
                  controller: _rawCostCtrl,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                      labelText: 'Raw Cost',
                      prefixText: 'KES ',
                      border: OutlineInputBorder(),
                      isDense: true),
                  onChanged: (_) => setState(() {}),
                )),
              ]),
              const SizedBox(height: 16),
              const Text('Step 2: Link POS Menu Item',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Autocomplete<Map<String, dynamic>>(
                initialValue: TextEditingValue(text: _menuCtrl.text),
                optionsBuilder: (tv) {
                  final q = tv.text.toLowerCase().trim();
                  final source = q.isEmpty
                      ? _menuItems.take(20)
                      : _menuItems.where((m) {
                          final name = '${m['name'] ?? m['item_name'] ?? ''}'
                              .toLowerCase();
                          final cat =
                              '${m['category_name'] ?? m['category'] ?? ''}'
                                  .toLowerCase();
                          return name.contains(q) || cat.contains(q);
                        }).take(20);
                  return source;
                },
                displayStringForOption: (m) =>
                    '${m['name'] ?? m['item_name'] ?? ''}',
                onSelected: (m) {
                  setState(() {
                    _selectedMenu = m;
                    _menuCtrl.text = '${m['name'] ?? m['item_name'] ?? ''}';
                  });
                },
                fieldViewBuilder: (ctx, ctrl, focus, onSubmit) {
                  if (ctrl.text != _menuCtrl.text) ctrl.text = _menuCtrl.text;
                  return TextField(
                    controller: ctrl,
                    focusNode: focus,
                    decoration: InputDecoration(
                      labelText: _menuLoading
                          ? 'Loading POS menu items...'
                          : 'POS Menu Item',
                      border: const OutlineInputBorder(),
                      isDense: true,
                      suffixIcon: _selectedMenu == null
                          ? null
                          : const Icon(Icons.check_circle,
                              color: Colors.green, size: 18),
                    ),
                    onChanged: (v) {
                      _menuCtrl.text = v;
                      _selectedMenu = null;
                    },
                  );
                },
              ),
              const SizedBox(height: 16),
              const Text('Step 3: Define Yield',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Row(children: [
                Expanded(
                    child: TextField(
                  controller: _yieldQtyCtrl,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                      labelText: 'Yield Quantity',
                      border: OutlineInputBorder(),
                      isDense: true),
                  onChanged: (_) => setState(() {}),
                )),
                const SizedBox(width: 10),
                Expanded(
                    child: TextField(
                  controller: _yieldUnitCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Yield Unit',
                      border: OutlineInputBorder(),
                      isDense: true),
                )),
                const SizedBox(width: 10),
                Expanded(
                    child: InputDecorator(
                  decoration: const InputDecoration(
                      labelText: 'Cost Per Output',
                      border: OutlineInputBorder(),
                      isDense: true),
                  child: Text('KES ${_costPerOutput.toStringAsFixed(2)}',
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                )),
              ]),
              if (!isEdit) ...[
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: OutlinedButton.icon(
                    onPressed: _addCurrentOutput,
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('Add this POS item'),
                  ),
                ),
                if (_outputs.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _outputs.map((output) {
                      return InputChip(
                        label: Text(
                          '${output.name} - ${_qtyText(output.quantity)} ${output.unit}',
                          overflow: TextOverflow.ellipsis,
                        ),
                        avatar: const Icon(Icons.restaurant_menu, size: 16),
                        onDeleted: () => setState(() => _outputs.remove(output)),
                      );
                    }).toList(),
                  ),
                ],
              ],
              const SizedBox(height: 16),
              const Text('Step 4: Variance & Spoilage',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Row(children: [
                Expanded(
                    child: TextField(
                  controller: _varianceCtrl,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                      labelText: 'Allowed Variance %',
                      suffixText: '%',
                      border: OutlineInputBorder(),
                      isDense: true),
                )),
                const SizedBox(width: 10),
                Expanded(
                    child: TextField(
                  controller: _spoilageCtrl,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                      labelText: 'Expected Waste %',
                      suffixText: '%',
                      border: OutlineInputBorder(),
                      isDense: true),
                )),
              ]),
              const SizedBox(height: 16),
              const Text('Step 5: Yield Confirmation & Stock Pool',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                value: _requiresConfirmation,
                title: const Text('Requires yield confirmation',
                    style: TextStyle(fontSize: 13)),
                subtitle: const Text(
                  'ON for baking/pastry items (chapati, ndazi...) — expected yield posts to POS immediately, then the storekeeper confirms actual output and any shortfall is billed to the producer. OFF for exact conversions (rice, chicken cuts) which finalize immediately.',
                  style: TextStyle(fontSize: 11),
                ),
                onChanged: (v) => setState(() => _requiresConfirmation = v),
              ),
              const SizedBox(height: 8),
              const Text(
                'Shares stock pool with (optional) — e.g. Half/Quarter Chicken share the Full Chicken pool. Selling any of them deducts the fraction below from the pool item\'s stock instead of its own.',
                style: TextStyle(fontSize: 11, color: Colors.grey),
              ),
              const SizedBox(height: 6),
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(
                  flex: 3,
                  child: Autocomplete<Map<String, dynamic>>(
                    optionsBuilder: (tv) {
                      final q = tv.text.toLowerCase().trim();
                      final source = q.isEmpty
                          ? _menuItems.take(20)
                          : _menuItems.where((m) {
                              final name =
                                  '${m['name'] ?? m['item_name'] ?? ''}'
                                      .toLowerCase();
                              return name.contains(q);
                            }).take(20);
                      return source;
                    },
                    displayStringForOption: (m) =>
                        '${m['name'] ?? m['item_name'] ?? ''}',
                    onSelected: (m) => setState(() => _poolItem = m),
                    fieldViewBuilder: (ctx, ctrl, focus, onSubmit) => TextField(
                      controller: ctrl,
                      focusNode: focus,
                      decoration: InputDecoration(
                        labelText: 'Pool base item',
                        border: const OutlineInputBorder(),
                        isDense: true,
                        suffixIcon: _poolItem == null
                            ? null
                            : IconButton(
                                icon: const Icon(Icons.close, size: 16),
                                onPressed: () {
                                  setState(() => _poolItem = null);
                                  ctrl.clear();
                                },
                              ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 1,
                  child: TextField(
                    controller: _poolFractionCtrl,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                        labelText: 'Fraction',
                        border: OutlineInputBorder(),
                        isDense: true),
                  ),
                ),
              ]),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _busy ? null : () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _busy ? null : _submit,
          child: _busy
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white))
              : Text(isEdit ? 'Save Food Control' : 'Create Food Control'),
        ),
      ],
    );
  }
}

// ─── Stock SKU Autocomplete field ────────────────────────────────────────────

class _StockAutocomplete extends StatelessWidget {
  const _StockAutocomplete({
    required this.controller,
    required this.stock,
    required this.onSelected,
    this.hint = '',
  });
  final TextEditingController controller;
  final List<Map<String, dynamic>> stock;
  final ValueChanged<Map<String, dynamic>> onSelected;
  final String hint;

  @override
  Widget build(BuildContext context) {
    return Autocomplete<Map<String, dynamic>>(
      initialValue: TextEditingValue(text: controller.text),
      optionsBuilder: (tv) {
        final q = tv.text.toLowerCase();
        if (q.isEmpty) return const [];
        return stock
            .where((s) =>
                '${s['item_sku']}'.toLowerCase().contains(q) ||
                '${s['item_name']}'.toLowerCase().contains(q))
            .take(8);
      },
      displayStringForOption: (s) => '${s['item_sku']}',
      onSelected: (s) {
        controller.text = '${s['item_sku']}';
        onSelected(s);
      },
      fieldViewBuilder: (ctx, ctrl, focusNode, _) {
        // sync external controller → internal
        ctrl.text = controller.text;
        ctrl.addListener(() => controller.text = ctrl.text);
        return TextField(
          controller: ctrl,
          focusNode: focusNode,
          decoration: InputDecoration(
              hintText: hint,
              border: const OutlineInputBorder(),
              isDense: true),
        );
      },
      optionsViewBuilder: (ctx, onSel, opts) => Align(
        alignment: Alignment.topLeft,
        child: Material(
          elevation: 4,
          borderRadius: BorderRadius.circular(8),
          child: SizedBox(
            width: 280,
            child: ListView(
              padding: EdgeInsets.zero,
              shrinkWrap: true,
              children: opts
                  .map((s) => ListTile(
                        dense: true,
                        title: Text('${s['item_name']}',
                            style: const TextStyle(fontSize: 12)),
                        subtitle: Text('${s['item_sku']}',
                            style: const TextStyle(fontSize: 10)),
                        onTap: () => onSel(s),
                      ))
                  .toList(),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────── POS ITEM AUTOCOMPLETE (Food Control config) ───────
class _PosItemAutocomplete extends StatelessWidget {
  const _PosItemAutocomplete({
    required this.controller,
    required this.items,
    required this.onSelected,
    this.hint = 'Search POS item by name or SKU',
  });
  final TextEditingController controller;
  final List<Map<String, dynamic>> items;
  final ValueChanged<Map<String, dynamic>> onSelected;
  final String hint;

  @override
  Widget build(BuildContext context) {
    return Autocomplete<Map<String, dynamic>>(
      initialValue: TextEditingValue(text: controller.text),
      optionsBuilder: (tv) {
        final q = tv.text.toLowerCase();
        if (q.isEmpty) return items.take(8);
        return items
            .where((s) =>
                '${s['name']}'.toLowerCase().contains(q) ||
                '${s['sku']}'.toLowerCase().contains(q))
            .take(8);
      },
      displayStringForOption: (s) => '${s['name'] ?? s['sku']}',
      onSelected: (s) {
        controller.text = '${s['name'] ?? s['sku']}';
        onSelected(s);
      },
      fieldViewBuilder: (ctx, ctrl, focusNode, _) {
        ctrl.text = controller.text;
        ctrl.addListener(() => controller.text = ctrl.text);
        return TextField(
          controller: ctrl,
          focusNode: focusNode,
          decoration: InputDecoration(
              hintText: hint, border: const OutlineInputBorder(), isDense: true),
        );
      },
      optionsViewBuilder: (ctx, onSel, opts) => Align(
        alignment: Alignment.topLeft,
        child: Material(
          elevation: 4,
          borderRadius: BorderRadius.circular(8),
          child: SizedBox(
            width: 320,
            child: ListView(
              padding: EdgeInsets.zero,
              shrinkWrap: true,
              children: opts
                  .map((s) => ListTile(
                        dense: true,
                        title: Text('${s['name']}',
                            style: const TextStyle(fontSize: 12)),
                        subtitle: Text('${s['sku']}',
                            style: const TextStyle(fontSize: 10)),
                        onTap: () => onSel(s),
                      ))
                  .toList(),
            ),
          ),
        ),
      ),
    );
  }
}

/// One "fractional item + fraction" row under a single pool parent — lets a
/// storekeeper add several menu items (Quarter, Half, Full...) that all
/// split the same stock item in one go, instead of repeating the whole
/// dialog per item.
class _PoolLinkRow {
  Map<String, dynamic>? fractionItem;
  final TextEditingController fractionCtrl = TextEditingController();
  final TextEditingController fractionValueCtrl = TextEditingController(text: '0.25');

  void dispose() {
    fractionCtrl.dispose();
    fractionValueCtrl.dispose();
  }
}

class _PoolLinkDialog extends ConsumerStatefulWidget {
  const _PoolLinkDialog({required this.stock});
  final List<Map<String, dynamic>> stock;
  @override
  ConsumerState<_PoolLinkDialog> createState() => _PoolLinkDialogState();
}

class _PoolLinkDialogState extends ConsumerState<_PoolLinkDialog> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  bool _saving = false;
  Map<String, dynamic>? _poolStockItem;
  final _poolCtrl = TextEditingController();
  final List<_PoolLinkRow> _rows = [_PoolLinkRow()];
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final row in _rows) {
      row.dispose();
    }
    _poolCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      final items = await repo.getRecipeLinkableMenuItems();
      if (mounted) setState(() => _items = items);
    } catch (e) {
      if (mounted) {
        setState(() => _error = 'Failed to load POS menu items: $e');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool get _canSave {
    if (_poolStockItem == null) return false;
    return _rows.any((r) {
      final fraction = double.tryParse(r.fractionValueCtrl.text) ?? 0;
      return r.fractionItem != null && fraction > 0 && fraction <= 1;
    });
  }

  Future<void> _save() async {
    if (_poolStockItem == null) return;
    final validRows = _rows.where((r) {
      final fraction = double.tryParse(r.fractionValueCtrl.text) ?? 0;
      return r.fractionItem != null && fraction > 0 && fraction <= 1;
    }).toList();
    if (validRows.isEmpty) return;

    setState(() {
      _saving = true;
      _error = null;
    });
    final failures = <String>[];
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      // The pool parent is the raw branch_stock item (central store), not a
      // POS catalog row — pass its SKU and let the backend resolve-or-create
      // the pos_outlet_items proxy that decrement_pos_outlet_item_stock
      // actually needs to target when each fractional item sells. Done
      // sequentially (not in parallel) so a failure on one item is reported
      // clearly without racing the same proxy's creation/sync.
      for (final row in validRows) {
        final fraction = double.tryParse(row.fractionValueCtrl.text) ?? 0;
        try {
          await repo.setPoolLink(
            posOutletItemId: '${row.fractionItem!['id']}',
            poolItemSku: '${_poolStockItem!['item_sku']}',
            poolItemName: '${_poolStockItem!['item_name']}',
            poolItemUnit: '${_poolStockItem!['unit_of_measure'] ?? ''}',
            poolFraction: fraction,
          );
        } catch (e) {
          failures.add('${row.fractionItem!['name'] ?? row.fractionItem!['sku']}: $e');
        }
      }
      if (failures.isEmpty) {
        if (mounted) Navigator.pop(context, true);
      } else if (mounted) {
        setState(() => _error = failures.join('\n'));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Add Yield Split'),
      content: SizedBox(
        width: 520,
        child: _loading
            ? const SizedBox(
                height: 100, child: Center(child: CircularProgressIndicator()))
            : SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Pool parent (e.g. Kuku Whole) — the central store stock item being split',
                        style: TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    _StockAutocomplete(
                      controller: _poolCtrl,
                      stock: widget.stock,
                      hint: 'Search branch stock by SKU or name',
                      onSelected: (s) => setState(() => _poolStockItem = s),
                    ),
                    const SizedBox(height: 16),
                    const Text('Fractional items split from it (e.g. Quarter, Half, Full)',
                        style: TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    for (var i = 0; i < _rows.length; i++) ...[
                      if (i > 0) const SizedBox(height: 12),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            flex: 3,
                            child: _PosItemAutocomplete(
                              controller: _rows[i].fractionCtrl,
                              items: _items,
                              onSelected: (s) => setState(() => _rows[i].fractionItem = s),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            flex: 1,
                            child: TextField(
                              controller: _rows[i].fractionValueCtrl,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                labelText: 'Fraction',
                                isDense: true,
                                border: OutlineInputBorder(),
                              ),
                              onChanged: (_) => setState(() {}),
                            ),
                          ),
                          IconButton(
                            tooltip: 'Remove row',
                            icon: const Icon(Icons.close, size: 18),
                            onPressed: _rows.length == 1
                                ? null
                                : () => setState(() {
                                      _rows[i].dispose();
                                      _rows.removeAt(i);
                                    }),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 4),
                    TextButton.icon(
                      onPressed: () => setState(() => _rows.add(_PoolLinkRow())),
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('Add another item'),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'e.g. 0.25 for a quarter, 0.5 for a half, 1.0 for whole',
                      style: TextStyle(fontSize: 11, color: Colors.grey),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          border: Border.all(color: Colors.red.shade200),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(_error!,
                            style: TextStyle(fontSize: 12, color: Colors.red.shade800)),
                      ),
                    ],
                  ],
                ),
              ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _canSave && !_saving ? _save : null,
          child: _saving
              ? const SizedBox(
                  width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Save'),
        ),
      ],
    );
  }
}

class _DirectItemDialog extends ConsumerStatefulWidget {
  const _DirectItemDialog({required this.stock});
  final List<Map<String, dynamic>> stock;
  @override
  ConsumerState<_DirectItemDialog> createState() => _DirectItemDialogState();
}

class _DirectItemDialogState extends ConsumerState<_DirectItemDialog> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  bool _saving = false;
  Map<String, dynamic>? _stockItem;
  Map<String, dynamic>? _posItem;
  final _stockCtrl = TextEditingController();
  final _posCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      final items = await repo.getRecipeLinkableMenuItems();
      if (mounted) setState(() => _items = items);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (_stockItem == null || _posItem == null) return;
    setState(() => _saving = true);
    try {
      await ref.read(branchStorekeeperRepositoryProvider).createDirectItem(
            stockItemSku: '${_stockItem!['item_sku']}',
            stockItemName: '${_stockItem!['item_name']}',
            posOutletItemId: '${_posItem!['id']}',
          );
      if (mounted) Navigator.pop(context, true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canSave = _stockItem != null && _posItem != null;
    return AlertDialog(
      title: const Text('Add Direct Item'),
      content: SizedBox(
        width: 480,
        child: _loading
            ? const SizedBox(
                height: 100, child: Center(child: CircularProgressIndicator()))
            : Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Branch stock item', style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  _StockAutocomplete(
                    controller: _stockCtrl,
                    stock: widget.stock,
                    hint: 'Search branch stock by SKU or name',
                    onSelected: (s) => setState(() => _stockItem = s),
                  ),
                  const SizedBox(height: 16),
                  const Text('POS item it is issued into',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  _PosItemAutocomplete(
                    controller: _posCtrl,
                    items: _items,
                    onSelected: (s) => setState(() => _posItem = s),
                  ),
                ],
              ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: canSave && !_saving ? _save : null,
          child: _saving
              ? const SizedBox(
                  width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Save'),
        ),
      ],
    );
  }
}

class _ExemptItemDialog extends ConsumerStatefulWidget {
  const _ExemptItemDialog();
  @override
  ConsumerState<_ExemptItemDialog> createState() => _ExemptItemDialogState();
}

class _ExemptItemDialogState extends ConsumerState<_ExemptItemDialog> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  bool _saving = false;
  Map<String, dynamic>? _posItem;
  final _posCtrl = TextEditingController();
  final _reasonCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final repo = ref.read(branchStorekeeperRepositoryProvider);
      final items = await repo.getRecipeLinkableMenuItems();
      if (mounted) setState(() => _items = items);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    if (_posItem == null) return;
    setState(() => _saving = true);
    try {
      await ref.read(branchStorekeeperRepositoryProvider).createExemptItem(
            posOutletItemId: '${_posItem!['id']}',
            reason: _reasonCtrl.text.trim().isEmpty ? null : _reasonCtrl.text.trim(),
          );
      if (mounted) Navigator.pop(context, true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Exempt an Item'),
      content: SizedBox(
        width: 480,
        child: _loading
            ? const SizedBox(
                height: 100, child: Center(child: CircularProgressIndicator()))
            : Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('POS item', style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  _PosItemAutocomplete(
                    controller: _posCtrl,
                    items: _items,
                    onSelected: (s) => setState(() => _posItem = s),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _reasonCtrl,
                    minLines: 2,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Reason (optional)',
                      hintText: 'e.g. bar drink, served as-is, no practical recipe',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
              ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _posItem != null && !_saving ? _save : null,
          child: _saving
              ? const SizedBox(
                  width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Save'),
        ),
      ],
    );
  }
}
// ─────────────────── EXTRACTED HELPERS ───────────────────

class _Page extends StatelessWidget {
  const _Page({
    required this.title,
    required this.subtitle,
    required this.children,
    this.actions = const [],
  });

  final String title;
  final String subtitle;
  final List<Widget> actions;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 16,
            runSpacing: 12,
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 760),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.displaySmall,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        color: AppColors.kTextSecondary,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
              Wrap(spacing: 8, runSpacing: 8, children: actions),
            ],
          ),
          const SizedBox(height: 24),
          ...children.expand((child) => [child, const SizedBox(height: 18)]),
        ],
      ),
    );
  }
}


class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child, this.subtitle});

  final String title;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
            if (subtitle != null && subtitle!.trim().isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                subtitle!,
                style: const TextStyle(
                  color: AppColors.kTextSecondary,
                  fontSize: 12,
                ),
              ),
            ],
            const SizedBox(height: 14),
            child,
          ],
        ),
      ),
    );
  }
}


class _RecordList extends StatelessWidget {
  const _RecordList({required this.children, required this.emptyText});

  final List<Widget> children;
  final String emptyText;

  @override
  Widget build(BuildContext context) {
    if (children.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: Colors.grey.shade50,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Center(child: Text(emptyText)),
      );
    }
    return Column(children: children);
  }
}


class _RecordTile extends StatelessWidget {
  const _RecordTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.trailing,
    this.actions = const [],
    this.meta = const [],
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final List<Widget> actions;
  final List<Widget> meta;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade200),
        borderRadius: BorderRadius.circular(8),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.kPrimary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: AppColors.kPrimary),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.kTextSecondary,
                      ),
                    ),
                    if (meta.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Wrap(spacing: 8, runSpacing: 8, children: meta),
                      ),
                    if (actions.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child:
                            Wrap(spacing: 8, runSpacing: 4, children: actions),
                      ),
                  ],
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: 12),
                trailing!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}


class _StatusChip extends StatelessWidget {
  const _StatusChip(this.label,
      {this.success = false, this.warning = false, this.error = false});

  final String label;
  final bool success;
  final bool warning;
  final bool error;

  @override
  Widget build(BuildContext context) {
    final color = success
        ? AppColors.kSuccess
        : error
            ? AppColors.kError
            : warning
                ? AppColors.kWarning
                : AppColors.kPrimary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}


