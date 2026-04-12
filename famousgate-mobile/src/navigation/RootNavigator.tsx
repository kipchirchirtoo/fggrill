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

// ── Central Store ─────────────────────────────────────────────────────────────
import CSDashboardScreen from '../screens/central-store/CSDashboardScreen';
import CreateDispatchScreen from '../screens/central-store/CreateDispatchScreen';
import StockIntakeScreen from '../screens/central-store/StockIntakeScreen';
import DispatchOTPScreen from '../screens/central-store/DispatchOTPScreen';
import DispatchHistoryScreen from '../screens/central-store/DispatchHistoryScreen';
import GRNScreen from '../screens/central-store/GRNScreen';
import StockTakeScreen from '../screens/central-store/StockTakeScreen';
import WasteLogScreen from '../screens/central-store/WasteLogScreen';
import LowStockScreen from '../screens/central-store/LowStockScreen';

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

// ── Cashier ───────────────────────────────────────────────────────────────────
import CashierDashboardScreen from '../screens/cashier/CashierDashboardScreen';
import ScanReceiptScreen from '../screens/cashier/ScanReceiptScreen';
import BillDetailScreen from '../screens/cashier/BillDetailScreen';
import PaymentScreen from '../screens/cashier/PaymentScreen';
import ShiftScreen from '../screens/cashier/ShiftScreen';
import UnpaidBillsScreen from '../screens/cashier/UnpaidBillsScreen';

// ── Superadmin ────────────────────────────────────────────────────────────────
import AdminDashboardScreen from '../screens/superadmin/AdminDashboardScreen';
import LiveDeliveryScreen from '../screens/superadmin/LiveDeliveryScreen';
import WasteReportScreen from '../screens/superadmin/WasteReportScreen';
import DiscrepancyAlertsScreen from '../screens/superadmin/DiscrepancyAlertsScreen';
import UserManagementScreen from '../screens/superadmin/UserManagementScreen';
import AuditLogScreen from '../screens/superadmin/AuditLogScreen';
import OTPOverrideScreen from '../screens/superadmin/OTPOverrideScreen';

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
      <Stack.Screen name="CreateDispatch" component={CreateDispatchScreen} options={{ title: 'Create Dispatch' }} />
      <Stack.Screen name="StockIntake" component={StockIntakeScreen} options={{ title: 'Stock Intake' }} />
      {/* DispatchOTP receives: { dispatchId, otp, expiresAt, dispatchNumber } */}
      <Stack.Screen name="DispatchOTP" component={DispatchOTPScreen as any} options={{ title: 'Delivery Code', headerLeft: () => null }} />
      <Stack.Screen name="DispatchHistory" component={DispatchHistoryScreen} options={{ title: 'Dispatch History' }} />
      <Stack.Screen name="GRN" component={GRNScreen} options={{ title: 'Goods Received Note' }} />
      <Stack.Screen name="StockTake" component={StockTakeScreen} options={{ title: 'Stock Take' }} />
      <Stack.Screen name="WasteLog" component={WasteLogScreen} options={{ title: 'Log Waste' }} />
      <Stack.Screen name="LowStock" component={LowStockScreen} options={{ title: 'Low Stock Alerts' }} />
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
      <Stack.Screen name="BranchStock" component={BranchStockScreen} options={{ title: 'Branch Stock' }} />
      <Stack.Screen name="RaiseRequisition" component={RaiseRequisitionScreen} options={{ title: 'Raise Requisition' }} />
      <Stack.Screen name="ReceiptHistory" component={ReceiptHistoryScreen} options={{ title: 'Receipt History' }} />
      <Stack.Screen name="WasteLog" component={BranchWasteLogScreen} options={{ title: 'Log Waste' }} />
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
      <Tab.Screen name="Bills" component={UnpaidBillsScreen} />
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
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────
const RootNavigator: React.FC = () => {
  const { user, isAuthenticated, isLoading, loadUser } = useAuthStore();

  useEffect(() => { loadUser(); }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
  }

  const getNavigator = () => {
    if (!isAuthenticated || !user) {
      return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      );
    }
    switch (user.role) {
      case UserRole.CENTRAL_STOREKEEPER: return <CentralStoreNavigator />;
      case UserRole.BRANCH_STOREKEEPER:  return <BranchStoreNavigator />;
      case UserRole.CASHIER:             return <CashierNavigator />;
      case UserRole.SUPERADMIN:          return <SuperadminNavigator />;
      default:
        return (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
          </Stack.Navigator>
        );
    }
  };

  return <NavigationContainer>{getNavigator()}</NavigationContainer>;
};

export default RootNavigator;
