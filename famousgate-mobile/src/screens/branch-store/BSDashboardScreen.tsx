import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { useAuthStore } from '../../stores/auth.store';
import { dispatchApi } from '../../api/dispatch.api';
import { inventoryApi } from '../../api/inventory.api';

const BSDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({ pending_deliveries: 0, today_receipts: 0, stock_items: 0, low_stock: 0 });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboard, incoming, lowStock] = await Promise.all([
        dispatchApi.branchDashboard().catch(() => ({})),
        dispatchApi.incoming().catch(() => []),
        inventoryApi.lowStock().catch(() => []),
      ]);
      const pending = Array.isArray(incoming)
        ? incoming.filter((d: any) => !['delivered', 'confirmed'].includes(d.status)).length
        : (dashboard.pending_deliveries ?? 0);
      setStats({
        pending_deliveries: pending,
        today_receipts: dashboard.today_receipts ?? dashboard.todayReceipts ?? 0,
        stock_items: dashboard.total_items ?? dashboard.totalItems ?? 0,
        low_stock: Array.isArray(lowStock) ? lowStock.length : 0,
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const actions = [
    { icon: 'truck-delivery', label: 'Receive Delivery', screen: 'ReceiveDelivery', color: colors.success.DEFAULT },
    { icon: 'package-variant', label: 'Branch Stock', screen: 'BranchStock', color: colors.info.DEFAULT },
    { icon: 'file-document-edit', label: 'Raise Requisition', screen: 'RaiseRequisition', color: colors.accent.DEFAULT },
    { icon: 'delete-variant', label: 'Log Waste', screen: 'WasteLog', color: colors.danger.DEFAULT },
    { icon: 'history', label: 'Receipt History', screen: 'ReceiptHistory', color: colors.warm[600] },
    { icon: 'alert-circle', label: 'Discrepancies', screen: 'Discrepancy', color: colors.warning.DEFAULT },
  ];

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{user?.first_name} {user?.last_name}</Text>
            <Text style={styles.branch}>{user?.branch_name || 'Branch Store'}</Text>
          </View>
          <MaterialCommunityIcons name="store" size={44} color={colors.primary.DEFAULT} />
        </View>

        <View style={styles.grid}>
          {[
            { icon: 'truck-delivery', label: 'Pending Deliveries', value: stats.pending_deliveries, color: stats.pending_deliveries > 0 ? colors.warning.DEFAULT : colors.text.tertiary, alert: stats.pending_deliveries > 0 },
            { icon: 'check-circle', label: "Today's Receipts", value: stats.today_receipts, color: colors.success.DEFAULT },
            { icon: 'package-variant', label: 'Stock Items', value: stats.stock_items, color: colors.info.DEFAULT },
            { icon: 'alert-circle', label: 'Low Stock', value: stats.low_stock, color: stats.low_stock > 0 ? colors.danger.DEFAULT : colors.text.tertiary },
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

        {stats.pending_deliveries > 0 && (
          <Card style={styles.alertCard}>
            <Card.Content>
              <View style={styles.alertRow}>
                <MaterialCommunityIcons name="truck-remove" size={22} color={colors.warning.DEFAULT} />
                <Text style={styles.alertTitle}>{stats.pending_deliveries} deliveries waiting</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('ReceiveDelivery')}>
                <Text style={styles.alertLink}>Receive Deliveries →</Text>
              </TouchableOpacity>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
      <FAB icon="truck-delivery" label="Receive" style={styles.fab} onPress={() => navigation.navigate('ReceiveDelivery')} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  greeting: { fontSize: 15, color: colors.text.tertiary },
  name: { fontSize: 24, fontWeight: '700', color: colors.text.primary, marginTop: 2 },
  branch: { fontSize: 13, color: colors.accent.DEFAULT, marginTop: 2, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs, marginBottom: spacing.xl },
  statCard: { width: '48%', margin: spacing.xs, backgroundColor: colors.card, ...shadows.sm },
  statAlert: { borderColor: colors.warning.DEFAULT, borderWidth: 1 },
  statVal: { fontSize: 30, fontWeight: '700', marginTop: spacing.sm },
  statLabel: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs, marginBottom: spacing.xl },
  actionCard: { width: '31%', margin: spacing.xs, backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, alignItems: 'center', ...shadows.sm },
  actionIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  actionLabel: { fontSize: 11, fontWeight: '500', color: colors.text.secondary, textAlign: 'center' },
  alertCard: { backgroundColor: colors.warning.DEFAULT + '12', borderColor: colors.warning.DEFAULT, borderWidth: 1 },
  alertRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  alertTitle: { fontSize: 15, fontWeight: '600', color: colors.warning.DEFAULT, marginLeft: spacing.sm },
  alertLink: { fontSize: 14, fontWeight: '600', color: colors.warning.DEFAULT },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, backgroundColor: colors.success.DEFAULT },
});

export default BSDashboardScreen;
