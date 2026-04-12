import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { useAuthStore } from '../../stores/auth.store';
import { dispatchApi } from '../../api/dispatch.api';
import { inventoryApi } from '../../api/inventory.api';

interface Stats {
  total_items: number;
  low_stock_count: number;
  pending_dispatches: number;
  today_dispatches: number;
}

const CSDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats>({ total_items: 0, low_stock_count: 0, pending_dispatches: 0, today_dispatches: 0 });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboard, lowStock] = await Promise.all([
        dispatchApi.centralDashboard().catch(() => ({})),
        inventoryApi.lowStock().catch(() => []),
      ]);
      setStats({
        total_items: dashboard.total_items ?? dashboard.totalItems ?? 0,
        low_stock_count: Array.isArray(lowStock) ? lowStock.length : (dashboard.low_stock_count ?? 0),
        pending_dispatches: dashboard.pending_dispatches ?? dashboard.pendingDispatches ?? 0,
        today_dispatches: dashboard.today_dispatches ?? dashboard.todayDispatches ?? 0,
      });
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const actions = [
    { icon: 'barcode-scan', label: 'Stock Intake', screen: 'StockIntake', color: colors.success.DEFAULT },
    { icon: 'truck-delivery', label: 'Create Dispatch', screen: 'CreateDispatch', color: colors.accent.DEFAULT },
    { icon: 'clipboard-list', label: 'Stock Take', screen: 'StockTake', color: colors.info.DEFAULT },
    { icon: 'package-variant', label: 'GRN', screen: 'GRN', color: colors.primary.DEFAULT },
    { icon: 'delete-variant', label: 'Waste Log', screen: 'WasteLog', color: colors.danger.DEFAULT },
    { icon: 'history', label: 'Dispatch History', screen: 'DispatchHistory', color: colors.warm[600] },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{user?.first_name} {user?.last_name}</Text>
            <Text style={styles.role}>Central Storekeeper</Text>
          </View>
          <MaterialCommunityIcons name="warehouse" size={44} color={colors.primary.DEFAULT} />
        </View>

        <View style={styles.grid}>
          {[
            { icon: 'package-variant', label: 'Total Items', value: stats.total_items, color: colors.primary.DEFAULT },
            { icon: 'alert-circle', label: 'Low Stock', value: stats.low_stock_count, color: stats.low_stock_count > 0 ? colors.danger.DEFAULT : colors.text.tertiary, alert: stats.low_stock_count > 0 },
            { icon: 'clock-outline', label: 'Pending', value: stats.pending_dispatches, color: colors.warning.DEFAULT },
            { icon: 'truck-check', label: 'Today', value: stats.today_dispatches, color: colors.success.DEFAULT },
          ].map((s, i) => (
            <Card key={i} style={[styles.statCard, s.alert && styles.statAlert]}>
              <Card.Content>
                <MaterialCommunityIcons name={s.icon as any} size={28} color={s.color} />
                <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </Card.Content>
            </Card>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {actions.map((a, i) => (
            <TouchableOpacity key={i} style={styles.actionCard} onPress={() => navigation.navigate(a.screen)}>
              <View style={[styles.actionIcon, { backgroundColor: `${a.color}18` }]}>
                <MaterialCommunityIcons name={a.icon as any} size={26} color={a.color} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {stats.low_stock_count > 0 && (
          <Card style={styles.alertCard}>
            <Card.Content>
              <View style={styles.alertRow}>
                <MaterialCommunityIcons name="alert" size={22} color={colors.danger.DEFAULT} />
                <Text style={styles.alertTitle}>{stats.low_stock_count} items running low</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('LowStock')}>
                <Text style={styles.alertLink}>View Low Stock Items →</Text>
              </TouchableOpacity>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      <FAB icon="barcode-scan" label="Scan" style={styles.fab} onPress={() => navigation.navigate('StockIntake')} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  greeting: { fontSize: 15, color: colors.text.tertiary },
  name: { fontSize: 24, fontWeight: '700', color: colors.text.primary, marginTop: 2 },
  role: { fontSize: 13, color: colors.accent.DEFAULT, marginTop: 2, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs, marginBottom: spacing.xl },
  statCard: { width: '48%', margin: spacing.xs, backgroundColor: colors.card, ...shadows.sm },
  statAlert: { borderColor: colors.danger.DEFAULT, borderWidth: 1 },
  statVal: { fontSize: 30, fontWeight: '700', marginTop: spacing.sm },
  statLabel: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs, marginBottom: spacing.xl },
  actionCard: { width: '31%', margin: spacing.xs, backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, alignItems: 'center', ...shadows.sm },
  actionIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  actionLabel: { fontSize: 11, fontWeight: '500', color: colors.text.secondary, textAlign: 'center' },
  alertCard: { backgroundColor: colors.danger.DEFAULT + '12', borderColor: colors.danger.DEFAULT, borderWidth: 1 },
  alertRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  alertTitle: { fontSize: 15, fontWeight: '600', color: colors.danger.DEFAULT, marginLeft: spacing.sm },
  alertLink: { fontSize: 14, fontWeight: '600', color: colors.danger.DEFAULT },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, backgroundColor: colors.primary.DEFAULT },
});

export default CSDashboardScreen;
