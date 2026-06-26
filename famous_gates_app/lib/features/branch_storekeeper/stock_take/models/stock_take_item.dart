class StockTakeItem {
  final String id;
  final String sku;
  final String productName;
  final String imageUrl;
  final int openingStock;
  final int sales;
  final int sdds;
  final int? physicalCount;
  final String? reason;
  final String category;

  const StockTakeItem({
    required this.id,
    required this.sku,
    required this.productName,
    required this.imageUrl,
    required this.openingStock,
    required this.sales,
    required this.sdds,
    this.physicalCount,
    this.reason,
    required this.category,
  });

  int get closingStock => openingStock - sales - sdds;
  int get variance => (physicalCount ?? 0) - closingStock;

  StockTakeItem copyWith({
    String? id,
    String? sku,
    String? productName,
    String? imageUrl,
    int? openingStock,
    int? sales,
    int? sdds,
    int? physicalCount,
    String? reason,
    String? category,
  }) {
    return StockTakeItem(
      id: id ?? this.id,
      sku: sku ?? this.sku,
      productName: productName ?? this.productName,
      imageUrl: imageUrl ?? this.imageUrl,
      openingStock: openingStock ?? this.openingStock,
      sales: sales ?? this.sales,
      sdds: sdds ?? this.sdds,
      physicalCount: physicalCount ?? this.physicalCount,
      reason: reason ?? this.reason,
      category: category ?? this.category,
    );
  }
}
