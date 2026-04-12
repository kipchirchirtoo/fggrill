import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { useAuthStore } from '../../stores/auth.store';
import { cashierApi } from '../../api/cashier.api';

const CashierDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>({});
  const [activeShift, setActiveShift] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, shiftsData] = await Promise.all([
        cashierApi.stats().catch(() => ({})),
        cashierApi.shifts().catch(() => []),
      ]);
      setStats(statsData);
      const shifts = Array.isArray(shiftsData) ? shiftsData : [];
      const open = shifts.find((s: any) => s.status === 'open' || !s.closed_at);
      setActiveShift(open || null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const actions = [
    { icon: 'barcode-scan', label: 'Scan Receipt', screen: 'ScanReceipt', color: colors.primary.DEFAULT },
    { icon: 'cash-multiple', label: 'Unpaid Bills', screen: 'UnpaidBills', color: colors.warning.DEFAULT },
    { icon: 'clock-outline', label: 'Shift', screen: 'Shift', color: colors.info.DEFAULT },
    { icon: 'history', label: 'History', screen: 'UnpaidBills', color: colors.warm[600] },
  ];

  const shiftTotal = activeShift
    ? (activeShift.total_cash || 0) + (activeShift.total_mpesa || 0) + (activeShift.total_card || 0)
    : 0;

  return (
    <View style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{user?.first_name} {user?.last_name}</Text>
            <Text style={styles.branch}>{user?.branch_name || 'Cashier'}</Text>
          </View>
          <MaterialCommunityIcons name="cash-register" size={44} color={colors.primary.DEFAULT} />
        </View>

        {activeShift ? (
          <Card style={styles.shiftCard}>
            <Card.Content>
              <View style={styles.shiftHeader}>
                <MaterialCommunityIcons name="clock-check" size={24} color={colors.success.DEFAULT} />
                <Text style={styles.shiftActive}>Shift Active</Text>
              </View>
              <Text style={styles.shiftTotal}>KES {shiftTotal.toLocaleString()}</Text>
              <Text style={styles.shiftLabel}>Total Collected Today</Text>
            </Card.Content>
          </Card>
        ) : (
          <Card style={styles.noShiftCard}>
            <Card.Content>
              <View style={styles.shiftHeader}>
                <MaterialCommunityIcons name="clock-alert" size={24} color={colors.warning.DEFAULT} />
                <Text style={styles.noShiftText}>No Active Shift</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Shift')}>
                <Text style={styles.startShiftLink}>Start a shift to process payments →</Text>
              </TouchableOpacity>
            </Card.Content>
          </Card>
        )}

        <View style={styles.grid}>
          {[
            { icon: 'receipt', label: 'Transactions', value: stats.total_transactions ?? stats.transactions_today ?? 0, color: colors.primary.DEFAULT },
            { icon: 'alert-circle', label: 'Unpaid Bills', value: stats.unpaid_bills ?? stats.pending_bills ?? 0, color: colors.warning.DEFAULT, alert: (stats.unpaid_bills ?? 0) > 0 },
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
      <FAB icon="barcode-scan" label="Scan" style={styles.fab} onPress={() => navigation.navigate('ScanReceipt')} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  greeting: { fontSize: 15, color: colors.text.tertiary },
  name: { fontSize: 24, fontWeight: '700', color: colors.text.primary, marginTop: 2 },
  branch: { fontSize: 13, color: colors.accent.DEFAULT, marginTop: 2, fontWeight: '500' },
  shiftCard: { marginBottom: spacing.lg, backgroundColor: colors.success.DEFAULT + '10', borderWidth: 2, borderColor: colors.success.DEFAULT, ...shadows.md },
  noShiftCard: { marginBottom: spacing.lg, backgroundColor: colors.warning.DEFAULT + '10', borderWidth: 1, borderColor: colors.warning.DEFAULT },
  shiftHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  shiftActive: { fontSize: 14, fontWeight: '600', color: colors.success.DEFAULT, marginLeft: spacing.sm },
  noShiftText: { fontSize: 14, fontWeight: '600', color: colors.warning.DEFAULT, marginLeft: spacing.sm },
  shiftTotal: { fontSize: 32, fontWeight: '700', color: colors.text.primary },
  shiftLabel: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  startShiftLink: { fontSize: 14, fontWeight: '600', color: colors.warning.DEFAULT },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs, marginBottom: spacing.xl },
  statCard: { width: '48%', margin: spacing.xs, backgroundColor: colors.card, ...shadows.sm },
  statAlert: { borderColor: colors.warning.DEFAULT, borderWidth: 1 },
  statVal: { fontSize: 30, fontWeight: '700', marginTop: spacing.sm },
  statLabel: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs },
  actionCard: { width: '48%', margin: spacing.xs, backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, alignItems: 'center', ...shadows.sm },
  actionIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  actionLabel: { fontSize: 12, fontWeight: '500', color: colors.text.secondary, textAlign: 'center' },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, backgroundColor: colors.primary.DEFAULT },
});

export default CashierDashboardScreen;
