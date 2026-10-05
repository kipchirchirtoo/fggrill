const fs = require('fs');
const path = require('path');

// 1. Update stock_take_item.dart
const itemFile = path.join(__dirname, '../../famous_gates_app/lib/features/branch_storekeeper/stock_take/models/stock_take_item.dart');
let itemContent = fs.readFileSync(itemFile, 'utf-8');

const oldAllowed = `bool isAllowedStoreStocktakeItem({
  required String category,
  required String sku,
  required String name,
  String storeType = '',
}) {
  final normalizedStoreType = _normalizedInventoryText(storeType);
  if (normalizedStoreType == 'bar store') return false;
  if (normalizedStoreType.isNotEmpty && normalizedStoreType != 'foodstuffs') {
    return false;
  }

  if (_hasStoreStocktakeBarKeyword(category) ||
      _hasStoreStocktakeBarKeyword(sku) ||
      _hasStoreStocktakeBarKeyword(name)) {
    return false;
  }

  return true;
}`;

const newAllowed = `bool isAllowedStoreStocktakeItem({
  required String category,
  required String sku,
  required String name,
  String storeType = '',
  int? branchId,
  String branchName = '',
}) {
  // In Kaplong branch (branch_id = 3), the storekeeper manages and audits
  // the bar stock in the store. Store stocktake includes bar stock/items.
  final isKaplong = branchId == 3 || branchName.toLowerCase().contains('kaplong');
  if (isKaplong) {
    final normalizedCategory = _normalizedInventoryText(category);
    if (normalizedCategory.contains('kitchen menu')) return false;
    return true;
  }

  final normalizedStoreType = _normalizedInventoryText(storeType);
  if (normalizedStoreType == 'bar store') return false;
  if (normalizedStoreType.isNotEmpty && normalizedStoreType != 'foodstuffs') {
    return false;
  }

  if (_hasStoreStocktakeBarKeyword(category) ||
      _hasStoreStocktakeBarKeyword(sku) ||
      _hasStoreStocktakeBarKeyword(name)) {
    return false;
  }

  return true;
}`;

let normItemContent = itemContent.replace(/\r\n/g, '\n');
let normOldAllowed = oldAllowed.replace(/\r\n/g, '\n');

if (!normItemContent.includes(normOldAllowed)) {
  console.error('Could not find oldAllowed in stock_take_item.dart');
  process.exit(1);
}

normItemContent = normItemContent.replace(normOldAllowed, newAllowed);
if (itemContent.includes('\r\n')) normItemContent = normItemContent.replace(/\n/g, '\r\n');
fs.writeFileSync(itemFile, normItemContent, 'utf-8');
console.log('Updated stock_take_item.dart');

// 2. Update stock_take_page.dart
const pageFile = path.join(__dirname, '../../famous_gates_app/lib/features/branch_storekeeper/stock_take/stock_take_page.dart');
let pageContent = fs.readFileSync(pageFile, 'utf-8');

const oldPageFilter = `    final scopedItems = widget.stockTakeType == StockTakeType.store
        ? state.items.where((item) {
            return isAllowedStoreStocktakeItem(
              category: item.category,
              sku: item.sku,
              name: item.productName,
            );
          }).toList()
        : state.items;`;

const newPageFilter = `    final scopedItems = widget.stockTakeType == StockTakeType.store
        ? state.items.where((item) {
            return isAllowedStoreStocktakeItem(
              category: item.category,
              sku: item.sku,
              name: item.productName,
              branchId: user?.branchId,
              branchName: branchName,
            );
          }).toList()
        : state.items;`;

let normPageContent = pageContent.replace(/\r\n/g, '\n');
let normOldPageFilter = oldPageFilter.replace(/\r\n/g, '\n');

if (!normPageContent.includes(normOldPageFilter)) {
  console.error('Could not find oldPageFilter in stock_take_page.dart');
  process.exit(1);
}

normPageContent = normPageContent.replace(normOldPageFilter, newPageFilter);
if (pageContent.includes('\r\n')) normPageContent = normPageContent.replace(/\n/g, '\r\n');
fs.writeFileSync(pageFile, normPageContent, 'utf-8');
console.log('Updated stock_take_page.dart');

// 3. Update stock_take_provider.dart
const providerFile = path.join(__dirname, '../../famous_gates_app/lib/features/branch_storekeeper/stock_take/providers/stock_take_provider.dart');
let provContent = fs.readFileSync(providerFile, 'utf-8');

const oldProvFilter = `        loadedItems = records
            .where((r) {
              final category =
                  '\${r['category'] ?? r['item']?['category'] ?? 'Other'}';
              final sku = '\${r['sku'] ?? r['item']?['sku'] ?? ''}';
              final name = '\${r['item_name'] ?? r['name'] ?? 'Item'}';
              final storeType =
                  '\${r['store_type'] ?? r['item']?['store_type'] ?? ''}';
              return isAllowedStoreStocktakeItem(
                category: category,
                sku: sku,
                name: name,
                storeType: storeType,
              );
            })`;

const newProvFilter = `        final user = _ref.read(authNotifierProvider).valueOrNull;
        final branchId = user?.branchId;
        final branchName = user?.branchName ?? '';

        loadedItems = records
            .where((r) {
              final category =
                  '\${r['category'] ?? r['item']?['category'] ?? 'Other'}';
              final sku = '\${r['sku'] ?? r['item']?['sku'] ?? ''}';
              final name = '\${r['item_name'] ?? r['name'] ?? 'Item'}';
              final storeType =
                  '\${r['store_type'] ?? r['item']?['store_type'] ?? ''}';
              return isAllowedStoreStocktakeItem(
                category: category,
                sku: sku,
                name: name,
                storeType: storeType,
                branchId: branchId,
                branchName: branchName,
              );
            })`;

let normProvContent = provContent.replace(/\r\n/g, '\n');
let normOldProvFilter = oldProvFilter.replace(/\r\n/g, '\n');

// Also ensure authNotifierProvider is imported in stock_take_provider.dart if not present
if (!normProvContent.includes('auth_notifier.dart')) {
  normProvContent = `import '../../../auth/presentation/providers/auth_notifier.dart';\n` + normProvContent;
}

if (!normProvContent.includes(normOldProvFilter)) {
  console.error('Could not find oldProvFilter in stock_take_provider.dart');
  process.exit(1);
}

normProvContent = normProvContent.replace(normOldProvFilter, newProvFilter);
if (provContent.includes('\r\n')) normProvContent = normProvContent.replace(/\n/g, '\r\n');
fs.writeFileSync(providerFile, normProvContent, 'utf-8');
console.log('Updated stock_take_provider.dart');

// 4. Update branch_storekeeper_dashboard.dart _isStoreStockItem
const dashFile = path.join(__dirname, '../../famous_gates_app/lib/features/branch_storekeeper/presentation/branch_storekeeper_dashboard.dart');
let dashContent = fs.readFileSync(dashFile, 'utf-8');

const oldDashFilter = `  bool _isStoreStockItem(Map<String, dynamic> item) {
    final storeType =
        _normalized(item['store_type'] ?? item['item']?['store_type'] ?? '');
    final category =
        _normalized(item['category'] ?? item['item']?['category'] ?? '');
    final sku = _normalized(item['item_sku'] ?? item['sku'] ?? '');
    final name = _normalized(_itemName(item));

    if (storeType == 'bar_store') return false;
    if (storeType.isNotEmpty && storeType != 'foodstuffs') return false;
    if (_hasBarKeyword(category) || _hasBarKeyword(sku) || _hasBarKeyword(name)) {
      return false;
    }
    return true;
  }`;

const newDashFilter = `  bool _isStoreStockItem(Map<String, dynamic> item) {
    final user = ref.read(authNotifierProvider).valueOrNull;
    final isKaplong = user?.branchId == 3 ||
        (user?.branchName ?? '').toLowerCase().contains('kaplong');
    if (isKaplong) {
      final category =
          _normalized(item['category'] ?? item['item']?['category'] ?? '');
      if (category.contains('kitchen menu')) return false;
      return true;
    }

    final storeType =
        _normalized(item['store_type'] ?? item['item']?['store_type'] ?? '');
    final category =
        _normalized(item['category'] ?? item['item']?['category'] ?? '');
    final sku = _normalized(item['item_sku'] ?? item['sku'] ?? '');
    final name = _normalized(_itemName(item));

    if (storeType == 'bar_store') return false;
    if (storeType.isNotEmpty && storeType != 'foodstuffs') return false;
    if (_hasBarKeyword(category) || _hasBarKeyword(sku) || _hasBarKeyword(name)) {
      return false;
    }
    return true;
  }`;

let normDashContent = dashContent.replace(/\r\n/g, '\n');
let normOldDashFilter = oldDashFilter.replace(/\r\n/g, '\n');

if (!normDashContent.includes(normOldDashFilter)) {
  console.error('Could not find oldDashFilter in branch_storekeeper_dashboard.dart');
  process.exit(1);
}

normDashContent = normDashContent.replace(normOldDashFilter, newDashFilter);
if (dashContent.includes('\r\n')) normDashContent = normDashContent.replace(/\n/g, '\r\n');
fs.writeFileSync(dashFile, normDashContent, 'utf-8');
console.log('Updated branch_storekeeper_dashboard.dart');
