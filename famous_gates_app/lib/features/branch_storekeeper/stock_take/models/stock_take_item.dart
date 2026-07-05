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
  final String? explanation;
  final String? actionTaken;
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
    this.explanation,
    this.actionTaken,
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
    String? explanation,
    String? actionTaken,
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
      explanation: explanation ?? this.explanation,
      actionTaken: actionTaken ?? this.actionTaken,
      category: category ?? this.category,
    );
  }
}

String getBarCategory(String name) {
  final lower = name.toLowerCase();
  if (lower.contains('beer') ||
      lower.contains('tusker') ||
      lower.contains('guinness') ||
      lower.contains('heineken') ||
      lower.contains('white cap') ||
      lower.contains('whitecap') ||
      lower.contains('balozi') ||
      lower.contains('pilsner') ||
      lower.contains('summit') ||
      lower.contains('windhoek') ||
      lower.contains('black ice') ||
      lower.contains('savanna') ||
      lower.contains('guiness')) {
    return 'BEERS';
  } else if (lower.contains('wine') ||
      lower.contains('sweet red') ||
      lower.contains('sweet white') ||
      lower.contains('four cousins') ||
      lower.contains('cellar cask') ||
      lower.contains('robertson') ||
      lower.contains('frontera') ||
      lower.contains('nederburg') ||
      lower.contains('caprice') ||
      lower.contains('drostdy') ||
      lower.contains('chamdor')) {
    return 'WINES';
  } else if (lower.contains('whisky') ||
      lower.contains('whiskey') ||
      lower.contains('johnnie walker') ||
      lower.contains('red label') ||
      lower.contains('black label') ||
      lower.contains('double black') ||
      lower.contains('jack daniel') ||
      lower.contains('jameson') ||
      lower.contains('glenfiddich') ||
      lower.contains('chivas') ||
      lower.contains('ballantines') ||
      lower.contains('vat 69') ||
      lower.contains('famous grouse') ||
      lower.contains('grants') ||
      lower.contains('viceroy') ||
      lower.contains('chrome') ||
      lower.contains('gordons') ||
      lower.contains('gilbeys') ||
      lower.contains('tanqueray') ||
      lower.contains('beefeater') ||
      lower.contains('hendricks') ||
      lower.contains('chrome vodka') ||
      lower.contains('smirnoff') ||
      lower.contains('absolut') ||
      lower.contains('captain morgan') ||
      lower.contains('bacardi') ||
      lower.contains('rum') ||
      lower.contains('vodka') ||
      lower.contains('gin') ||
      lower.contains('brandy') ||
      lower.contains('cognac') ||
      lower.contains('spirit') ||
      lower.contains('liquer') ||
      lower.contains('liqueur') ||
      lower.contains('baileys') ||
      lower.contains('sheridans') ||
      lower.contains('amarula') ||
      lower.contains('jagermeister') ||
      lower.contains('tequila')) {
    return 'SPIRITS & LIQUEURS';
  } else if (lower.contains('soda') ||
      lower.contains('coke') ||
      lower.contains('fanta') ||
      lower.contains('sprite') ||
      lower.contains('water') ||
      lower.contains('keringet') ||
      lower.contains('juice') ||
      lower.contains('tonic') ||
      lower.contains('ginger ale') ||
      lower.contains('soft drink') ||
      lower.contains('red bull') ||
      lower.contains('monster')) {
    return 'SOFT DRINKS & WATER';
  }
  return 'OTHER BEVERAGES';
}
