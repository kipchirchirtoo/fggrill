/**
 * RootNavigator — Role-based navigation for FamousGate Hotels Mobile App
 *
 * Flow:
 *  Unauthenticated → LoginScreen
 *  central_storekeeper → CentralStoreNavigator (tabs: Dashboard | Dispatches | Stock)
 *  branch_storekeeper  → BranchStoreNavigator  (tabs: Dashboard | Deliveries | Stock | History)
 *  cashier             → CashierNavigator       (tabs: Dashboard | Scan | Bills | Shift)
 *  superadmin          → SuperadminNavigator    (tabs: Dashboard | Deliveries | Alerts | Users)
 */

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore, UserRole } from '../stores/auth.store';
import { colors } from '../theme';

// ── Auth ──────────────────────────────────────────────────────────────────────
import LoginScreen from '../screens/auth/LoginScreen';
import ProfileScreen from '../screens/account/ProfileScreen';
import SettingsScreen from '../screens/account/SettingsScreen';

// ── Central Store ─────────────────────────────────────────────────────────────
import CSDashboardScreen from '../screens/central-store/CSDashboardScreen';
import RequisitionsScreen from '../screens/central-store/RequisitionsScreen';
import PackingStationScreen from '../screens/central-store/PackingStationScreen';
import DispatchManagementScreen from '../screens/central-store/DispatchManagementScreen';
import StockIntakeScreen from '../screens/central-store/StockIntakeScreen';
import DispatchOTPScreen from '../screens/central-store/DispatchOTPScreen';
import DispatchHistoryScreen from '../screens/central-store/DispatchHistoryScreen';
import GRNScreen from '../screens/central-store/GRNScreen';
import StockTakeScreen from '../screens/central-store/StockTakeScreen';
import WasteLogScreen from '../screens/central-store/WasteLogScreen';
import LowStockScreen from '../screens/central-store/LowStockScreen';
import ReceivingScreen from '../screens/central-store/ReceivingScreen';

// ── Branch Store ──────────────────────────────────────────────────────────────
import BSDashboardScreen from '../screens/branch-store/BSDashboardScreen';
import ReceiveDeliveryScreen from '../screens/branch-store/ReceiveDeliveryScreen';
import OTPEntryScreen from '../screens/branch-store/OTPEntryScreen';
import CountItemsScreen from '../screens/branch-store/CountItemsScreen';
import DiscrepancyScreen from '../screens/branch-store/DiscrepancyScreen';
import BranchStockScreen from '../screens/branch-store/BranchStockScreen';
import RaiseRequisitionScreen from '../screens/branch-store/RaiseRequisitionScreen';
import ReceiptHistoryScreen from '../screens/branch-store/ReceiptHistoryScreen';
import BranchWasteLogScreen from '../screens/branch-store/WasteLogScreen';
import CompleteDeliveryScreen from '../screens/branch-store/CompleteDeliveryScreen';

// ── Cashier ───────────────────────────────────────────────────────────────────
import CashierDashboardScreen from '../screens/cashier/CashierDashboardScreen';
import ScanReceiptScreen from '../screens/cashier/ScanReceiptScreen';
import BillDetailScreen from '../screens/cashier/BillDetailScreen';
import PaymentScreen from '../screens/cashier/PaymentScreen';
import ShiftScreen from '../screens/cashier/ShiftScreen';
import BillsScreen from '../screens/cashier/BillsScreen';

// ── Auditor ───────────────────────────────────────────────────────────────────
import AuditorDashboardScreen from '../screens/auditor/AuditorDashboardScreen';
import AuditorApprovalsScreen from '../screens/auditor/AuditorApprovalsScreen';
import AuditorDailyLogsScreen from '../screens/auditor/AuditorDailyLogsScreen';
import AuditorWatchlistScreen from '../screens/auditor/AuditorWatchlistScreen';
import AuditorAuditLogScreen from '../screens/auditor/AuditorAuditLogScreen';
import AuditorDeliveriesScreen from '../screens/auditor/AuditorDeliveriesScreen';
import AuditorDeliveryDetailScreen from '../screens/auditor/AuditorDeliveryDetailScreen';

// ── Superadmin ────────────────────────────────────────────────────────────────
import AdminDashboardScreen from '../screens/superadmin/AdminDashboardScreen';
import LiveDeliveryScreen from '../screens/superadmin/LiveDeliveryScreen';
import WasteReportScreen from '../screens/superadmin/WasteReportScreen';
import DiscrepancyAlertsScreen from '../screens/superadmin/DiscrepancyAlertsScreen';
import UserManagementScreen from '../screens/superadmin/UserManagementScreen';
import AuditLogScreen from '../screens/superadmin/AuditLogScreen';
import OTPOverrideScreen from '../screens/superadmin/OTPOverrideScreen';

// ── Driver ────────────────────────────────────────────────────────────────────
import DriverDashboardScreen from '../screens/driver/DriverDashboardScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const HEADER = {
  headerStyle: { backgroundColor: colors.primary.DEFAULT },
  headerTintColor: colors.primary.foreground,
  headerTitleStyle: { fontWeight: '600' as const },
  headerBackTitleVisible: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL STORE
// Flow: Dashboard → CreateDispatch → DispatchOTP
//       Dashboard → StockIntake
//       Dashboard → DispatchHistory → DispatchOTP
//       Dashboard → GRN | StockTake | WasteLog | LowStock
// ─────────────────────────────────────────────────────────────────────────────
function CentralStoreTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, string> = {
            Dashboard: 'view-dashboard',
            Dispatches: 'truck-delivery',
            'Low Stock': 'alert-circle-outline',
          };
          return <MaterialCommunityIcons name={(icons[route.name] || 'circle') as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary.DEFAULT,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: { borderTopColor: colors.border },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={CSDashboardScreen} />
      <Tab.Screen name="Dispatches" component={DispatchHistoryScreen} />
      <Tab.Screen name="Low Stock" component={LowStockScreen} />
    </Tab.Navigator>
  );
}

function CentralStoreNavigator() {
  return (
    <Stack.Navigator screenOptions={HEADER}>
      <Stack.Screen name="CSTabs" component={CentralStoreTabs} options={{ headerShown: false }} />
      {/* New workflow screens matching web app */}
      <Stack.Screen name="Requisitions" component={RequisitionsScreen} options={{ title: 'Branch Requisitions' }} />
      <Stack.Screen name="PackingStation" component={PackingStationScreen} options={{ title: 'Packing Station' }} />
      <Stack.Screen name="DispatchManagement" component={DispatchManagementScreen} options={{ title: 'Dispatch & Logistics' }} />
      {/* Existing screens */}
      <Stack.Screen name="StockIntake" component={StockIntakeScreen} options={{ title: 'Stock Intake' }} />
      <Stack.Screen name="ReceivingScreen" component={ReceivingScreen} options={{ title: 'Receive Items' }} />
      {/* DispatchOTP receives: { dispatchId, otp, expiresAt, dispatchNumber } */}
      <Stack.Screen name="DispatchOTP" component={DispatchOTPScreen as any} options={{ title: 'Delivery Code', headerLeft: () => null }} />
      <Stack.Screen name="DispatchHistory" component={DispatchHistoryScreen} options={{ title: 'Dispatch History' }} />
      <Stack.Screen name="GRN" component={GRNScreen} options={{ title: 'Goods Received Note' }} />
      <Stack.Screen name="StockTake" component={StockTakeScreen} options={{ title: 'Stock Take' }} />
      <Stack.Screen name="WasteLog" component={WasteLogScreen} options={{ title: 'Log Waste' }} />
      <Stack.Screen name="LowStock" component={LowStockScreen} options={{ title: 'Low Stock Alerts' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BRANCH STORE
// Flow: Dashboard → ReceiveDelivery → OTPEntry → CountItems → (Discrepancy)?
//       Dashboard → BranchStock
//       Dashboard → RaiseRequisition
//       Dashboard → WasteLog
//       History tab → ReceiptHistory
// ─────────────────────────────────────────────────────────────────────────────
function BranchStoreTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, string> = {
            Dashboard: 'view-dashboard',
            Deliveries: 'truck-delivery',
            Stock: 'package-variant',
            History: 'history',
          };
          return <MaterialCommunityIcons name={(icons[route.name] || 'circle') as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary.DEFAULT,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: { borderTopColor: colors.border },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={BSDashboardScreen} />
      <Tab.Screen name="Deliveries" component={ReceiveDeliveryScreen} />
      <Tab.Screen name="Stock" component={BranchStockScreen} />
      <Tab.Screen name="History" component={ReceiptHistoryScreen} />
    </Tab.Navigator>
  );
}

function BranchStoreNavigator() {
  return (
    <Stack.Navigator screenOptions={HEADER}>
      <Stack.Screen name="BSTabs" component={BranchStoreTabs} options={{ headerShown: false }} />
      <Stack.Screen name="ReceiveDelivery" component={ReceiveDeliveryScreen} options={{ title: 'Pending Deliveries' }} />
      {/* OTPEntry receives: { dispatchId, dispatchNum } */}
      <Stack.Screen name="OTPEntry" component={OTPEntryScreen as any} options={{ title: 'Enter Delivery Code' }} />
      {/* CountItems receives: { dispatchId, dispatchNum } */}
      <Stack.Screen name="CountItems" component={CountItemsScreen as any} options={{ title: 'Count Received Items' }} />
      {/* Discrepancy receives: { dispatchId, items: DispatchItem[] } */}
      <Stack.Screen name="Discrepancy" component={DiscrepancyScreen as any} options={{ title: 'Report Discrepancy' }} />
      {/* CompleteDelivery receives: { dispatchId, dispatchNum } */}
      <Stack.Screen name="CompleteDelivery" component={CompleteDeliveryScreen as any} options={{ title: 'Complete Delivery' }} />
      <Stack.Screen name="BranchStock" component={BranchStockScreen} options={{ title: 'Branch Stock' }} />
      <Stack.Screen name="RaiseRequisition" component={RaiseRequisitionScreen} options={{ title: 'Raise Requisition' }} />
      <Stack.Screen name="ReceiptHistory" component={ReceiptHistoryScreen} options={{ title: 'Receipt History' }} />
      <Stack.Screen name="WasteLog" component={BranchWasteLogScreen} options={{ title: 'Log Waste' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CASHIER
// Flow: Dashboard → ScanReceipt → BillDetail → Payment
//       Dashboard → UnpaidBills → BillDetail → Payment
//       Shift tab → ShiftScreen (start/end shift)
// ─────────────────────────────────────────────────────────────────────────────
function CashierTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, string> = {
            Dashboard: 'view-dashboard',
            Scan: 'barcode-scan',
            Bills: 'cash-multiple',
            Shift: 'clock-outline',
          };
          return <MaterialCommunityIcons name={(icons[route.name] || 'circle') as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary.DEFAULT,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: { borderTopColor: colors.border },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={CashierDashboardScreen} />
      <Tab.Screen name="Scan" component={ScanReceiptScreen} />
      <Tab.Screen name="Bills" component={BillsScreen} />
      <Tab.Screen name="Shift" component={ShiftScreen} />
    </Tab.Navigator>
  );
}

function CashierNavigator() {
  return (
    <Stack.Navigator screenOptions={HEADER}>
      <Stack.Screen name="CashierTabs" component={CashierTabs} options={{ headerShown: false }} />
      {/* BillDetail receives: { booking: BookingBill } */}
      <Stack.Screen name="BillDetail" component={BillDetailScreen as any} options={{ title: 'Bill Details' }} />
      {/* Payment receives: { booking: BookingBill } */}
      <Stack.Screen name="Payment" component={PaymentScreen as any} options={{ title: 'Process Payment', headerLeft: () => null }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDITOR
// Flow: Dashboard → Approvals | Daily Logs | Watchlist | Audit Log
// ─────────────────────────────────────────────────────────────────────────────
function AuditorTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, string> = {
            Dashboard: 'shield-check-outline',
            Approvals: 'clipboard-check-outline',
            Watchlist: 'shield-search',
            Logs: 'file-document-outline',
          };
          return <MaterialCommunityIcons name={(icons[route.name] || 'circle') as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary.DEFAULT,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: { borderTopColor: colors.border },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={AuditorDashboardScreen} />
      <Tab.Screen name="Approvals" component={AuditorApprovalsScreen} />
      <Tab.Screen name="Watchlist" component={AuditorWatchlistScreen} />
      <Tab.Screen name="Logs" component={AuditorAuditLogScreen} />
    </Tab.Navigator>
  );
}

function AuditorNavigator() {
  return (
    <Stack.Navigator screenOptions={HEADER}>
      <Stack.Screen name="AuditorTabs" component={AuditorTabs} options={{ headerShown: false }} />
      <Stack.Screen name="AuditorApprovals" component={AuditorApprovalsScreen} options={{ title: 'Pending Approvals' }} />
      <Stack.Screen name="AuditorDailyLogs" component={AuditorDailyLogsScreen} options={{ title: 'Daily Log Verification' }} />
      <Stack.Screen name="AuditorWatchlist" component={AuditorWatchlistScreen} options={{ title: 'Audit Watchlist' }} />
      <Stack.Screen name="AuditLog" component={AuditorAuditLogScreen} options={{ title: 'Audit Logs' }} />
      <Stack.Screen name="AuditorDeliveries" component={AuditorDeliveriesScreen} options={{ title: 'Delivery Reviews' }} />
      {/* AuditorDeliveryDetail receives: { dispatchId } */}
      <Stack.Screen name="AuditorDeliveryDetail" component={AuditorDeliveryDetailScreen as any} options={{ title: 'Delivery Details' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPERADMIN
// Flow: Dashboard → LiveDelivery | WasteReport | DiscrepancyAlerts | UserManagement | AuditLog | OTPOverride
// ─────────────────────────────────────────────────────────────────────────────
function SuperadminTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, string> = {
            Dashboard: 'view-dashboard',
            Deliveries: 'truck-fast',
            Alerts: 'alert-circle',
            Users: 'account-group',
          };
          return <MaterialCommunityIcons name={(icons[route.name] || 'circle') as any} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary.DEFAULT,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: { borderTopColor: colors.border },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} />
      <Tab.Screen name="Deliveries" component={LiveDeliveryScreen} />
      <Tab.Screen name="Alerts" component={DiscrepancyAlertsScreen} />
      <Tab.Screen name="Users" component={UserManagementScreen} />
    </Tab.Navigator>
  );
}

function SuperadminNavigator() {
  return (
    <Stack.Navigator screenOptions={HEADER}>
      <Stack.Screen name="AdminTabs" component={SuperadminTabs} options={{ headerShown: false }} />
      <Stack.Screen name="LiveDelivery" component={LiveDeliveryScreen} options={{ title: 'Live Deliveries' }} />
      <Stack.Screen name="WasteReport" component={WasteReportScreen} options={{ title: 'Waste Reports' }} />
      <Stack.Screen name="DiscrepancyAlerts" component={DiscrepancyAlertsScreen} options={{ title: 'Discrepancy Alerts' }} />
      <Stack.Screen name="UserManagement" component={UserManagementScreen} options={{ title: 'User Management' }} />
      <Stack.Screen name="AuditLog" component={AuditLogScreen} options={{ title: 'Audit Logs' }} />
      <Stack.Screen name="OTPOverride" component={OTPOverrideScreen} options={{ title: 'Emergency OTP Override' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER
// Flow: Dashboard (enter dispatch code, GPS tracking)
// ─────────────────────────────────────────────────────────────────────────────
function DriverNavigator() {
  return (
    <Stack.Navigator screenOptions={HEADER}>
      <Stack.Screen name="DriverDashboard" component={DriverDashboardScreen} options={{ title: 'Driver Dashboard', headerShown: false }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Stack.Navigator>
  );
}

const CENTRAL_ROLE_ALIASES = new Set<string>([
  UserRole.CENTRAL_STOREKEEPER,
  'storekeeper',
  'inventory_clerk',
  'purchasing_manager',
  'procurement',
]);

const BRANCH_ROLE_ALIASES = new Set<string>([
  UserRole.BRANCH_STOREKEEPER,
  'branch_manager',
  'branch_accountant',
]);

const CASHIER_ROLE_ALIASES = new Set<string>([
  UserRole.CASHIER,
  'receptionist',
  'kyogong_spa_cashier',
  'kyogong_executive_bar_cashier',
  'kyogong_sports_bar_cashier',
  'kyogong_reception_cashier',
]);

const AUDITOR_ROLE_ALIASES = new Set<string>([
  UserRole.AUDITOR,
  'auditor',
]);

const ADMIN_ROLE_ALIASES = new Set<string>([
  UserRole.SUPERADMIN,
  'general_manager',
]);

const DRIVER_ROLE_ALIASES = new Set<string>([
  UserRole.DRIVER,
  'driver',
]);

const resolveNavigatorForRole = (role?: string, branchId?: string) => {
  const normalizedRole = String(role || '').trim().toLowerCase();

  console.log('🔍 [NAVIGATION] Resolving navigator for role:', role);
  console.log('🔍 [NAVIGATION] Normalized role:', normalizedRole);
  console.log('🔍 [NAVIGATION] Branch ID:', branchId);

  if (!normalizedRole) {
    console.log('❌ [NAVIGATION] No role provided');
    return null;
  }

  if (AUDITOR_ROLE_ALIASES.has(normalizedRole)) {
    console.log('✅ [NAVIGATION] Routing to AuditorNavigator');
    return <AuditorNavigator />;
  }

  if (ADMIN_ROLE_ALIASES.has(normalizedRole)) {
    console.log('✅ [NAVIGATION] Routing to SuperadminNavigator');
    return <SuperadminNavigator />;
  }

  if (DRIVER_ROLE_ALIASES.has(normalizedRole) || normalizedRole.includes('driver')) {
    console.log('✅ [NAVIGATION] Routing to DriverNavigator');
    return <DriverNavigator />;
  }

  if (CASHIER_ROLE_ALIASES.has(normalizedRole) || normalizedRole.includes('cashier')) {
    console.log('✅ [NAVIGATION] Routing to CashierNavigator');
    return <CashierNavigator />;
  }

  if (BRANCH_ROLE_ALIASES.has(normalizedRole)) {
    console.log('✅ [NAVIGATION] Routing to BranchStoreNavigator');
    return <BranchStoreNavigator />;
  }

  if (CENTRAL_ROLE_ALIASES.has(normalizedRole)) {
    console.log('✅ [NAVIGATION] Routing to CentralStoreNavigator');
    return <CentralStoreNavigator />;
  }

  if (normalizedRole.includes('storekeeper')) {
    const navigator = branchId ? <BranchStoreNavigator /> : <CentralStoreNavigator />;
    console.log('✅ [NAVIGATION] Routing to', branchId ? 'BranchStoreNavigator' : 'CentralStoreNavigator');
    return navigator;
  }

  console.log('❌ [NAVIGATION] No matching navigator found for role:', normalizedRole);
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────
const RootNavigator: React.FC = () => {
  const { user, isAuthenticated, isLoading, loadUser } = useAuthStore();
  const [navigationKey, setNavigationKey] = React.useState(0);

  useEffect(() => { loadUser(); }, []);

  useEffect(() => {
    console.log('🔄 [ROOT] Auth state changed:', {
      isAuthenticated,
      isLoading,
      hasUser: !!user,
      userId: user?.id,
      userRole: user?.role,
      userEmail: user?.email,
    });
    
    // Force navigation re-render when auth state changes
    if (isAuthenticated && user) {
      console.log('🔄 [ROOT] Forcing navigation re-render');
      setNavigationKey(prev => prev + 1);
    }
  }, [isAuthenticated, isLoading, user]);

  if (isLoading) {
    console.log('⏳ [ROOT] Loading auth state...');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  const getNavigator = () => {
    console.log('🎯 [ROOT] Getting navigator - isAuthenticated:', isAuthenticated, 'user:', user?.email);
    
    if (!isAuthenticated || !user) {
      console.log('❌ [ROOT] Not authenticated, showing Login');
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      );
    }

    console.log('✅ [ROOT] User authenticated, resolving navigator for role:', user.role);
    const roleNavigator = resolveNavigatorForRole(user.role, user.branch_id);

    if (roleNavigator) {
      console.log('✅ [ROOT] Navigator resolved successfully');
      return roleNavigator;
    }

    console.log('❌ [ROOT] No navigator found for role, showing Login');
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  };

  const containerKey = `nav-${navigationKey}-${isAuthenticated ? 'auth' : 'guest'}-${user?.id || 'none'}`;
  console.log('🔑 [ROOT] Navigation container key:', containerKey);

  return <NavigationContainer key={containerKey}>{getNavigator()}</NavigationContainer>;
};

export default RootNavigator;
