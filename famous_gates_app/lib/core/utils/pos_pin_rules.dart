const Set<String> _posPinRequiredRoles = {
  'waiter',
  'waitress',
  'head_waiter',
  'bartender',
  'barmaid',
  'barman',
  'cashier',
  'restaurant_cashier',
  'main_bar_cashier',
  'executive_bar_cashier',
  'non_consumables_cashier',
  'kyogong_spa_cashier',
  'kyogong_executive_bar_cashier',
  'kyogong_sports_bar_cashier',
  'kyogong_reception_cashier',
  'choma_zone_cashier',
};

String normalizeUserRole(String? role) => (role ?? '').trim().toLowerCase();

bool requiresPosPinForRole(String? role) =>
    _posPinRequiredRoles.contains(normalizeUserRole(role));
