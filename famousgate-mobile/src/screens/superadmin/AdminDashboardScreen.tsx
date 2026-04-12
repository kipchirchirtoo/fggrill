import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { useAuthStore } from '../../stores/auth.store';
import { dispatchApi } from '../../api/dispatch.api';
import { inventoryApi } from '../../api/inventory.api';
import { systemApi } from '../../api/system.api';

const AdminDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({ branches: 0, active_deliveries: 0, discrepancies: 0, low_stock: 0 });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [branches, dispatches, lowStock] = await Promise.all([
        systemApi.branches().catch(() => []),
        dispatchApi.list().catch(() => []),
        inventoryApi.lowStock().catch(() => []),
      ]);
      const dispatchList = Array.isArray(dispatches) ? dispatches : [];
      setStats({
        branches: Array.isArray(branches) ? branches.length : 0,
        active_deliveries: dispatchList.filter((d: any) => ['dispatched', 'in_transit'].includes(d.status)).length,
        discrepancies: dispatchList.filter((d: any) => d.status === 'discrepancy').length,
        low_stock: Array.isArray(lowStock) ? lowStock.length : 0,
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const actions = [
    { icon: 'truck-fast', label: 'Live Deliveries', screen: 'LiveDelivery', color: colors.info.DEFAULT },
    { icon: 'delete-alert', label: 'Waste Reports', screen: 'WasteReport', color: colors.danger.DEFAULT },
    { icon: 'alert-circle', label: 'Discrepancies', screen: 'DiscrepancyAlerts', color: colors.warning.DEFAULT },
    { icon: 'account-group', label: 'Users', screen: 'UserManagement', color: colors.primary.DEFAULT },
    { icon: 'file-document', label: 'Audit Logs', screen: 'AuditLog', color: colors.warm[600] },
    { icon: 'shield-key', label: 'OTP Override', screen: 'OTPOverride', color: colors.accent.DEFAULT },
  ];

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Superadmin</Text>
            <Text style={styles.name}>{user?.first_name} {user?.last_name}</Text>
          </View>
          <View style={[styles.healthBadge, { backgroundColor: colors.success.DEFAULT + '20' }]}>
            <MaterialCommunityIcons name="heart-pulse" size={20} color={colors.success.DEFAULT} />
            <Text style={[styles.healthText, { color: colors.success.DEFAULT }]}>ONLINE</Text>
          </View>
        </View>

        <View style={styles.grid}>
          {[
            { icon: 'store', label: 'Branches', value: stats.branches, color: colors.primary.DEFAULT },
            { icon: 'truck-delivery', label: 'Active Deliveries', value: stats.active_deliveries, color: colors.info.DEFAULT, alert: stats.active_deliveries > 0 },
            { icon: 'alert-circle', label: 'Discrepancies', value: stats.discrepancies, color: stats.discrepancies > 0 ? colors.warning.DEFAULT : colors.text.tertiary, alert: stats.discrepancies > 0 },
            { icon: 'package-variant-remove', label: 'Low Stock', value: stats.low_stock, color: stats.low_stock > 0 ? colors.danger.DEFAULT : colors.text.tertiary },
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
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  greeting: { fontSize: 15, color: colors.text.tertiary },
  name: { fontSize: 24, fontWeight: '700', color: colors.text.primary, marginTop: 2 },
  healthBadge: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, borderRadius: 8 },
  healthText: { fontSize: 12, fontWeight: '700', marginLeft: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs, marginBottom: spacing.xl },
  statCard: { width: '48%', margin: spacing.xs, backgroundColor: colors.card, ...shadows.sm },
  statAlert: { borderColor: colors.warning.DEFAULT, borderWidth: 1 },
  statVal: { fontSize: 30, fontWeight: '700', marginTop: spacing.sm },
  statLabel: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  actionCard: { width: '31%', margin: spacing.xs, backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, alignItems: 'center', ...shadows.sm },
  actionIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  actionLabel: { fontSize: 11, fontWeight: '500', color: colors.text.secondary, textAlign: 'center' },
});

export default AdminDashboardScreen;
