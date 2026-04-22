import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Dimensions } from 'react-native';
import { Text, Card, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { useAuthStore } from '../../stores/auth.store';
import { cashierApi } from '../../api/cashier.api';
import DashboardHeader from '../../components/common/DashboardHeader';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - spacing.lg * 3) / 2;

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

  const shiftTotal = activeShift
    ? (activeShift.total_cash || 0) + (activeShift.total_mpesa || 0) + (activeShift.total_card || 0)
    : 0;

  const quickActions = [
    { 
      icon: 'barcode-scan', 
      label: 'Scan Receipt', 
      screen: 'Scan', 
      gradient: ['#10b981', '#059669'],
      description: 'Scan bill barcode'
    },
    { 
      icon: 'cash-multiple', 
      label: 'Unpaid Bills', 
      screen: 'Bills', 
      gradient: ['#f59e0b', '#d97706'],
      description: 'View pending bills',
      badge: stats.unpaid_bills || 0
    },
    { 
      icon: 'clock-outline', 
      label: 'Shift', 
      screen: 'Shift', 
      gradient: ['#3b82f6', '#2563eb'],
      description: activeShift ? 'Manage shift' : 'Start shift'
    },
    { 
      icon: 'history', 
      label: 'History', 
      screen: 'Bills', 
      params: { tab: 'history' },
      gradient: ['#8b5cf6', '#7c3aed'],
      description: 'View transactions'
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView 
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />} 
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <DashboardHeader
          navigation={navigation}
          eyebrow="Cashier Station"
          title={`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Cashier'}
          subtitle={user?.branch_name || 'Process payments and manage shifts'}
          icon="cash-register"
          accentColor={colors.primary.DEFAULT}
          badgeLabel={activeShift ? 'Shift Active' : 'No Active Shift'}
          badgeIcon={activeShift ? 'clock-check-outline' : 'clock-alert-outline'}
          badgeColor={activeShift ? colors.success.DEFAULT : colors.text.tertiary}
        />

        {/* Active Shift Card */}
        {activeShift ? (
          <Card style={styles.shiftCard}>
            <Card.Content>
              <View style={styles.shiftHeader}>
                <View style={styles.shiftIconContainer}>
                  <MaterialCommunityIcons name="clock-check" size={24} color={colors.success.DEFAULT} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.shiftActive}>Active Shift</Text>
                  <Text style={styles.shiftNumber}>{activeShift.shift_number || 'Current'}</Text>
                </View>
                <View style={styles.pulseDot} />
              </View>
              
              <View style={styles.shiftStats}>
                <View style={styles.shiftStat}>
                  <Text style={styles.shiftStatLabel}>Total Sales</Text>
                  <Text style={styles.shiftStatValue}>KES {shiftTotal.toLocaleString()}</Text>
                </View>
                <View style={styles.shiftDivider} />
                <View style={styles.shiftStat}>
                  <Text style={styles.shiftStatLabel}>Transactions</Text>
                  <Text style={styles.shiftStatValue}>{activeShift.transaction_count || 0}</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.viewShiftButton} 
                onPress={() => navigation.navigate('Shift')}
              >
                <Text style={styles.viewShiftText}>View Shift Details</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.success.DEFAULT} />
              </TouchableOpacity>
            </Card.Content>
          </Card>
        ) : (
          <Card style={styles.noShiftCard}>
            <Card.Content>
              <View style={styles.noShiftContent}>
                <MaterialCommunityIcons name="clock-alert-outline" size={48} color={colors.warning.DEFAULT} />
                <Text style={styles.noShiftTitle}>No Active Shift</Text>
                <Text style={styles.noShiftSubtitle}>Start a shift to begin processing payments</Text>
                <TouchableOpacity 
                  style={styles.startShiftButton} 
                  onPress={() => navigation.navigate('Shift')}
                >
                  <MaterialCommunityIcons name="play-circle" size={20} color="#fff" />
                  <Text style={styles.startShiftText}>Start New Shift</Text>
                </TouchableOpacity>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="receipt" size={24} color={colors.primary.DEFAULT} />
            <Text style={styles.statValue}>{stats.total_transactions || 0}</Text>
            <Text style={styles.statLabel}>Today's Transactions</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="alert-circle" size={24} color={colors.warning.DEFAULT} />
            <Text style={styles.statValue}>{stats.unpaid_bills || 0}</Text>
            <Text style={styles.statLabel}>Unpaid Bills</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={styles.actionCard}
              onPress={() => navigation.navigate(action.screen, action.params)}
              activeOpacity={0.7}
            >
              <View style={[styles.actionGradient, { backgroundColor: action.gradient[0] }]}>
                <MaterialCommunityIcons name={action.icon as any} size={32} color="#fff" />
                {action.badge > 0 && (
                  <View style={styles.actionBadge}>
                    <Text style={styles.actionBadgeText}>{action.badge}</Text>
                  </View>
                )}
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionLabel}>{action.label}</Text>
                <Text style={styles.actionDescription}>{action.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      
      <FAB 
        icon="barcode-scan" 
        label="Scan" 
        style={styles.fab} 
        onPress={() => navigation.navigate('Scan')} 
        color="#fff"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  flex: { flex: 1 },
  
  // Shift Card Styles
  shiftCard: { 
    marginBottom: spacing.lg, 
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.success.DEFAULT + '30',
    ...shadows.lg 
  },
  shiftHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  shiftIconContainer: { 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    backgroundColor: colors.success.DEFAULT, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: spacing.md
  },
  shiftActive: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
  shiftNumber: { fontSize: 13, color: colors.text.tertiary, marginTop: 2 },
  pulseDot: { 
    width: 10, 
    height: 10, 
    borderRadius: 5, 
    backgroundColor: colors.success.DEFAULT,
    marginLeft: 'auto'
  },
  shiftStats: { 
    flexDirection: 'row', 
    marginBottom: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.md
  },
  shiftStat: { flex: 1, alignItems: 'center' },
  shiftStatLabel: { fontSize: 12, color: colors.text.tertiary, marginBottom: 6, fontWeight: '600' },
  shiftStatValue: { fontSize: 28, fontWeight: '800', color: colors.text.primary },
  shiftDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  viewShiftButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.success.DEFAULT + '10',
    borderRadius: 12,
    marginTop: spacing.sm
  },
  viewShiftText: { fontSize: 15, fontWeight: '700', color: colors.success.DEFAULT, marginRight: spacing.xs },
  
  // No Shift Card
  noShiftCard: { 
    marginBottom: spacing.lg, 
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md 
  },
  noShiftContent: { alignItems: 'center', paddingVertical: spacing.xl },
  noShiftTitle: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginTop: spacing.md },
  noShiftSubtitle: { fontSize: 14, color: colors.text.tertiary, marginTop: spacing.sm, textAlign: 'center', paddingHorizontal: spacing.lg },
  startShiftButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.primary.DEFAULT, 
    paddingHorizontal: spacing.xl, 
    paddingVertical: spacing.md + 2, 
    borderRadius: 16, 
    marginTop: spacing.xl,
    ...shadows.md
  },
  startShiftText: { fontSize: 16, fontWeight: '700', color: '#fff', marginLeft: spacing.sm },
  
  // Stats Row
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  statCard: { 
    flex: 1, 
    backgroundColor: '#fff', 
    padding: spacing.lg, 
    borderRadius: 16, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm 
  },
  statValue: { fontSize: 32, fontWeight: '800', color: colors.text.primary, marginTop: spacing.sm },
  statLabel: { fontSize: 12, color: colors.text.tertiary, marginTop: spacing.xs, textAlign: 'center', fontWeight: '600' },
  
  // Quick Actions
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.text.primary, marginBottom: spacing.lg },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  actionCard: { 
    width: CARD_WIDTH,
    backgroundColor: '#fff', 
    borderRadius: 20, 
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md 
  },
  actionGradient: { 
    height: 120, 
    justifyContent: 'center', 
    alignItems: 'center',
    position: 'relative'
  },
  actionBadge: { 
    position: 'absolute', 
    top: spacing.md, 
    right: spacing.md, 
    backgroundColor: '#fff', 
    borderRadius: 14, 
    minWidth: 28, 
    height: 28, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    ...shadows.sm
  },
  actionBadgeText: { fontSize: 13, fontWeight: '800', color: colors.danger.DEFAULT },
  actionContent: { padding: spacing.md + 2 },
  actionLabel: { fontSize: 16, fontWeight: '700', color: colors.text.primary, marginBottom: 4 },
  actionDescription: { fontSize: 13, color: colors.text.tertiary, fontWeight: '500' },
  
  // FAB
  fab: { 
    position: 'absolute', 
    right: spacing.lg, 
    bottom: spacing.lg, 
    backgroundColor: colors.primary.DEFAULT 
  },
});

export default CashierDashboardScreen;
