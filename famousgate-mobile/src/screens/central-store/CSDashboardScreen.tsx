import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { useAuthStore } from '../../stores/auth.store';
import { dispatchApi } from '../../api/dispatch.api';
import { inventoryApi } from '../../api/inventory.api';
import DashboardHeader from '../../components/common/DashboardHeader';
import StatMetricCard from '../../components/common/StatMetricCard';

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
        dispatchApi.centralDashboard().catch(() => null),
        inventoryApi.lowStock().catch(() => []),
      ]);
      const dashboardData = dashboard || {
        total_items: 0,
        low_stock_count: 0,
        pending_dispatches: 0,
        today_dispatches: 0,
      };
      setStats({
        total_items: dashboardData.total_items ?? 0,
        low_stock_count: Array.isArray(lowStock) ? lowStock.length : (dashboardData.low_stock_count ?? 0),
        pending_dispatches: dashboardData.pending_dispatches ?? 0,
        today_dispatches: dashboardData.today_dispatches ?? 0,
      });
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const actions = [
    { icon: 'clipboard-list', label: 'Requisitions', screen: 'Requisitions', color: colors.warning.DEFAULT },
    { icon: 'package-variant-closed', label: 'Packing Station', screen: 'PackingStation', color: colors.info.DEFAULT },
    { icon: 'truck-fast', label: 'Dispatch', screen: 'DispatchManagement', color: colors.success.DEFAULT },
    { icon: 'barcode-scan', label: 'Stock Intake', screen: 'StockIntake', color: colors.primary.DEFAULT },
    { icon: 'clipboard-check', label: 'Stock Take', screen: 'StockTake', color: colors.accent.DEFAULT },
    { icon: 'delete-variant', label: 'Waste Log', screen: 'WasteLog', color: colors.danger.DEFAULT },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={styles.scroll}
      >
        <DashboardHeader
          navigation={navigation}
          eyebrow="Central store"
          title={`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Central Store'}
          subtitle="Inventory overview, dispatches, and warehouse activity"
          icon="warehouse"
          accentColor={colors.primary.DEFAULT}
          badgeLabel={stats.low_stock_count > 0 ? `${stats.low_stock_count} low stock alerts` : 'Inventory healthy'}
          badgeIcon={stats.low_stock_count > 0 ? 'alert-outline' : 'shield-check-outline'}
          badgeColor={stats.low_stock_count > 0 ? colors.danger.DEFAULT : colors.success.DEFAULT}
        />

        <View style={styles.metricsList}>
          {[
            {
              icon: 'package-variant',
              label: 'Total Items',
              value: stats.total_items,
              color: colors.primary.DEFAULT,
              caption: 'Across central inventory',
              onPress: () => navigation.navigate('StockTake'),
            },
            {
              icon: 'alert-circle',
              label: 'Low Stock',
              value: stats.low_stock_count,
              color: stats.low_stock_count > 0 ? colors.danger.DEFAULT : colors.text.tertiary,
              alert: stats.low_stock_count > 0,
              caption: 'Needs replenishment',
              onPress: () => navigation.navigate('LowStock'),
            },
            {
              icon: 'clock-outline',
              label: 'Pending Dispatches',
              value: stats.pending_dispatches,
              color: colors.warning.DEFAULT,
              caption: 'Awaiting action',
              onPress: () => navigation.navigate('DispatchHistory'),
            },
            {
              icon: 'truck-check',
              label: 'Today Dispatches',
              value: stats.today_dispatches,
              color: colors.success.DEFAULT,
              caption: 'Sent out today',
              onPress: () => navigation.navigate('DispatchHistory'),
            },
          ].map((s, i) => (
            <StatMetricCard key={i} {...s} />
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
  metricsList: { marginBottom: spacing.lg },
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
