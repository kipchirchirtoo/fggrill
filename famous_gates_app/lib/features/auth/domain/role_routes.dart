import 'models.dart';

String getRoleRoute(String role, {String contextType = 'branch'}) {
  switch (role) {
    case 'super_admin':
    case 'global':
      return '/superadmin';
    case 'general_manager':
      return '/gm';
    case 'director':
      return '/director';
    case 'auditor':
    case 'night_auditor':
      return '/auditor';
    case 'hr_manager':
      return '/hr';
    case 'facilities_manager':
      return '/facilities';
    case 'central_storekeeper':
    case 'central_operations_manager':
      return '/central-store';
    case 'finance_manager':
    case 'accountant':
      return '/accounting';
    case 'branch_accountant':
      return '/branch-accountant';
    case 'procurement':
    case 'procurement_manager':
    case 'purchasing_manager':
      return '/procurement';
    case 'branch_manager':
      return '/branch-manager';
    case 'branch_operations_manager':
      return '/branch-operations';
    case 'receptionist':
    case 'branch_receptionist':
    case 'front_desk_supervisor':
    case 'concierge':
      return '/reception';
    case 'cashier':
    case 'restaurant_cashier':
    case 'main_bar_cashier':
    case 'executive_bar_cashier':
    case 'non_consumables_cashier':
      return '/cashier';
    case 'kyogong_reception_cashier':
      return '/pos/kyogong-reception';
    case 'kyogong_spa_staff':
    case 'kyogong_spa_cashier':
      return '/pos/kyogong-spa';
    case 'bartender':
    case 'bar_manager':
    case 'barman':
    case 'barmaid':
      return '/bar-pos';
    case 'kyogong_executive_bar_cashier':
      return '/pos/kyogong-executive-bar';
    case 'kyogong_sports_bar_cashier':
      return '/pos/kyogong-sports-bar';
    case 'choma_zone_cashier':
      return '/pos/choma-zone';
    case 'choma_zone_kds':
      return '/kitchen/choma-zone';
    case 'waiter':
    case 'waitress':
    case 'head_waiter':
    case 'food_runner':
    case 'host_hostess':
    case 'restaurant':
      return '/restaurant';
    case 'kitchen':
    case 'head_chef':
    case 'sous_chef':
    case 'chef':
    case 'cook':
    case 'pos_kitchen':
      return '/kitchen';
    case 'kitchen_operations':
      return '/kitchen-operations';
    case 'housekeeping':
    case 'housekeeping_supervisor':
    case 'room_attendant':
    case 'laundry_attendant':
      return '/housekeeping';
    case 'maintenance':
    case 'maintenance_supervisor':
    case 'electrician':
    case 'plumber':
      return '/maintenance';
    case 'branch_storekeeper':
    case 'storekeeper':
    case 'inventory_clerk':
      return '/store';
    case 'employee':
      return '/employee';
    case 'driver':
      return '/driver';
    default:
      // Unmapped role: send to the PIN terminal (the system's main screen)
      // rather than the back-office login, since most callers of this
      // fallback are PIN-authenticated POS staff with no email/password
      // account to log into there.
      return '/terminal';
  }
}

String getUserHomeRoute(User user) {
  if (user.role == 'choma_zone_kds' || user.roles.contains('choma_zone_kds')) {
    return '/kitchen/choma-zone';
  }

  if (user.role == 'central_storekeeper' ||
      user.role == 'central_operations_manager' ||
      user.roles.contains('central_storekeeper') ||
      user.roles.contains('central_operations_manager')) {
    return '/central-store';
  }

  if (user.role == 'cashier' || user.roles.contains('cashier')) {
    return '/cashier';
  }

  switch (user.outletType) {
    case 'restaurant':
      return '/pos/restaurant';
    case 'main_bar':
      return '/pos/main-bar';
    case 'executive_bar':
      return '/pos/executive-bar';
    case 'non_consumables':
      return '/pos/non-consumables';
    case 'choma_zone':
      return '/pos/choma-zone';
    case 'kyogong_reception':
      return '/pos/kyogong-reception';
    case 'kyogong_spa':
      return '/pos/kyogong-spa';
    case 'kyogong_executive_bar':
      return '/pos/kyogong-executive-bar';
    case 'kyogong_sports_bar':
      return '/pos/kyogong-sports-bar';
    default:
      return getRoleRoute(user.role, contextType: user.contextType);
  }
}
