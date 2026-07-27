enum KitchenDisplayScope { restaurant, chomaZone }

extension KitchenDisplayScopeX on KitchenDisplayScope {
  String get apiValue =>
      this == KitchenDisplayScope.chomaZone ? 'choma_zone' : 'restaurant';

  String get shellTitle =>
      this == KitchenDisplayScope.chomaZone ? 'Choma Zone' : 'Kitchen Display';

  String get shellSubtitle => this == KitchenDisplayScope.chomaZone
      ? 'Grill captain orders from Choma Zone POS outlets'
      : 'Restaurant orders only';

  String get initials =>
      this == KitchenDisplayScope.chomaZone ? 'CZ' : 'KD';

  String get ordersTitle => this == KitchenDisplayScope.chomaZone
      ? 'Choma Zone Captain Orders'
      : 'Restaurant Kitchen Orders';

  String get ordersSubtitle => this == KitchenDisplayScope.chomaZone
      ? 'Live grill captain-order queue from Choma Zone POS outlets for this branch.'
      : 'Live restaurant order queue from POS. Bar orders are excluded by using restaurant order tables only.';

  String get emptyOrdersMessage => this == KitchenDisplayScope.chomaZone
      ? 'No active Choma Zone captain orders.'
      : 'No active restaurant orders.';

  String get historyTitle => this == KitchenDisplayScope.chomaZone
      ? 'Past Choma Zone Orders'
      : 'Past Restaurant Orders';

  String get historySubtitle => this == KitchenDisplayScope.chomaZone
      ? 'Served, paid, cancelled, and completed Choma Zone captain orders for the current branch.'
      : 'Served, delivered, paid and completed restaurant orders for the current branch.';

  String get emptyHistoryMessage => this == KitchenDisplayScope.chomaZone
      ? 'No past Choma Zone orders found.'
      : 'No past restaurant orders found.';

  String get analyticsSubtitle => this == KitchenDisplayScope.chomaZone
      ? 'Demand, rush windows, and preparation pressure from Choma Zone captain orders.'
      : 'Local machine-learning style order analysis from restaurant order names, quantities and timing.';

  String get intelligenceSubtitle => this == KitchenDisplayScope.chomaZone
      ? 'Branch-specific grill demand, rush windows, and preparation pressure from Choma Zone POS orders.'
      : 'Branch-specific kitchen demand, rush windows, and preparation pressure from restaurant POS orders.';

  String get routeBase => this == KitchenDisplayScope.chomaZone
      ? '/kitchen/choma-zone'
      : '/kitchen';
}
