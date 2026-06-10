import 'package:dio/dio.dart';
import '../../../core/utils/api_error_message.dart';

/// One menu item's pricing for a specific branch: the shared base price/cost
/// plus the branch override (if any) and the resolved effective values.
class BranchMenuItemPricing {
  BranchMenuItemPricing({
    required this.itemType,
    required this.itemId,
    required this.name,
    required this.category,
    required this.unit,
    required this.basePrice,
    required this.baseCost,
    required this.overrideCost,
    required this.overrideSelling,
    required this.hasOverride,
    required this.effectiveCost,
    required this.effectiveSelling,
    required this.margin,
    required this.marginPct,
    required this.isAvailable,
  });

  final String itemType; // 'restaurant' | 'bar'
  final String itemId;
  final String name;
  final String? category;
  final String? unit;
  final double basePrice;
  final double baseCost;
  final double? overrideCost;
  final double? overrideSelling;
  final bool hasOverride;
  final double effectiveCost;
  final double effectiveSelling;
  final double margin;
  final double marginPct;
  final bool isAvailable;

  static double _d(dynamic v) {
    if (v is num) return v.toDouble();
    return double.tryParse(v?.toString() ?? '') ?? 0;
  }

  static double? _dn(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString());
  }

  factory BranchMenuItemPricing.fromJson(Map<String, dynamic> j) {
    return BranchMenuItemPricing(
      itemType: j['item_type']?.toString() ?? 'restaurant',
      itemId: j['item_id']?.toString() ?? '',
      name: j['name']?.toString() ?? 'Item',
      category: j['category']?.toString(),
      unit: j['unit']?.toString(),
      basePrice: _d(j['base_price']),
      baseCost: _d(j['base_cost']),
      overrideCost: _dn(j['override_cost']),
      overrideSelling: _dn(j['override_selling']),
      hasOverride: j['has_override'] == true,
      effectiveCost: _d(j['effective_cost']),
      effectiveSelling: _d(j['effective_selling']),
      margin: _d(j['margin']),
      marginPct: _d(j['margin_pct']),
      isAvailable: j['is_available'] != false,
    );
  }

  String get key => '$itemType:$itemId';
}

class BranchPricingResult {
  BranchPricingResult({required this.items, required this.summary});
  final List<BranchMenuItemPricing> items;
  final Map<String, dynamic> summary;
}

class MenuPricingRepository {
  MenuPricingRepository(this._dio);
  final Dio _dio;

  Future<BranchPricingResult> getBranchPricing(int branchId, {String? type}) async {
    try {
      final r = await _dio.get(
        '/menu-pricing/branch/$branchId',
        queryParameters: {if (type != null) 'type': type},
      );
      final data = (r.data['data'] ?? r.data) as Map<String, dynamic>;
      final rawItems = (data['items'] as List?) ?? const [];
      final items = rawItems
          .whereType<Map>()
          .map((e) => BranchMenuItemPricing.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      final summary = Map<String, dynamic>.from(data['summary'] ?? const {});
      return BranchPricingResult(items: items, summary: summary);
    } on DioException catch (e) {
      throw apiErrorMessage(e, fallback: 'Failed to load menu pricing');
    }
  }

  Future<void> saveItem(
    int branchId, {
    required String itemType,
    required String itemId,
    required double costPrice,
    double? sellingPrice,
  }) async {
    try {
      await _dio.put('/menu-pricing/branch/$branchId/item', data: {
        'item_type': itemType,
        'item_id': itemId,
        'cost_price': costPrice,
        'selling_price': sellingPrice,
      });
    } on DioException catch (e) {
      throw apiErrorMessage(e, fallback: 'Failed to save price');
    }
  }

  Future<int> saveBulk(int branchId, List<Map<String, dynamic>> items) async {
    try {
      final r = await _dio.put('/menu-pricing/branch/$branchId/bulk', data: {'items': items});
      final data = (r.data['data'] ?? r.data) as Map<String, dynamic>;
      return (data['saved'] as num?)?.toInt() ?? items.length;
    } on DioException catch (e) {
      throw apiErrorMessage(e, fallback: 'Failed to save prices');
    }
  }

  Future<void> resetItem(int branchId, String itemType, String itemId) async {
    try {
      await _dio.delete('/menu-pricing/branch/$branchId/item/$itemType/$itemId');
    } on DioException catch (e) {
      throw apiErrorMessage(e, fallback: 'Failed to reset price');
    }
  }
}
