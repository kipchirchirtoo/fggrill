import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { cashierApi } from '../../api/cashier.api';

const ShiftScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [shift, setShift] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // GET /api/cashier/shifts — find the open one
      const data = await cashierApi.shifts();
      const list = Array.isArray(data) ? data : [];
      const open = list.find((s: any) => s.status === 'open' || !s.closed_at);
      setShift(open || null);
    } catch { setShift(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startShift = async () => {
    setActionLoading(true);
    try {
      // POST /api/cashier/shifts/start
      const newShift = await cashierApi.startShift();
      setShift(newShift.data || newShift);
      Alert.alert('Shift Started', 'Your shift has started. Good luck!');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to start shift');
    } finally { setActionLoading(false); }
  };

  const endShift = () => {
    if (!shift) return;
    Alert.alert('End Shift', 'Are you sure you want to end your current shift?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Shift', style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            // PUT /api/cashier/shifts/:id/close
            const closed = await cashierApi.closeShift(shift.id);
            setShift(null);
            const total = (closed.total_cash || 0) + (closed.total_mpesa || 0) + (closed.total_card || 0);
            Alert.alert('Shift Ended', `Total collected: KES ${total.toLocaleString()}`, [
                { text: 'OK', onPress: () => navigation.navigate('CashierTabs') },
              ]);
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to end shift');
          } finally { setActionLoading(false); }
        },
      },
    ]);
  };

  const shiftTotal = shift
    ? (shift.total_cash || 0) + (shift.total_mpesa || 0) + (shift.total_card || 0)
    : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {shift ? (
          <>
            <Card style={styles.activeCard}>
              <Card.Content>
                <View style={styles.activeHeader}>
                  <MaterialCommunityIcons name="clock-check" size={32} color={colors.success.DEFAULT} />
                  <View style={styles.activeInfo}>
                    <Text style={styles.activeTitle}>Shift Active</Text>
                    <Text style={styles.activeTime}>
                      Started: {new Date(shift.started_at || shift.created_at).toLocaleTimeString()}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>

            <Text style={styles.sectionTitle}>Today's Summary</Text>
            <View style={styles.grid}>
              {[
                { label: 'Cash', value: shift.total_cash || 0, icon: 'cash', color: colors.success.DEFAULT },
                { label: 'M-Pesa', value: shift.total_mpesa || 0, icon: 'cellphone', color: colors.info.DEFAULT },
                { label: 'Card', value: shift.total_card || 0, icon: 'credit-card', color: colors.accent.DEFAULT },
                { label: 'Transactions', value: shift.total_transactions || shift.transaction_count || 0, icon: 'receipt', color: colors.primary.DEFAULT, isCount: true },
              ].map((s, i) => (
                <Card key={i} style={styles.statCard}>
                  <Card.Content>
                    <MaterialCommunityIcons name={s.icon as any} size={26} color={s.color} />
                    <Text style={[styles.statVal, { color: s.color }]}>
                      {s.isCount ? s.value : `KES ${Number(s.value).toLocaleString()}`}
                    </Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </Card.Content>
                </Card>
              ))}
            </View>

            <Card style={styles.totalCard}>
              <Card.Content>
                <Text style={styles.totalLabel}>Total Collected</Text>
                <Text style={styles.totalValue}>KES {shiftTotal.toLocaleString()}</Text>
              </Card.Content>
            </Card>

            <Button mode="contained" onPress={endShift} loading={actionLoading} style={styles.endBtn} icon="stop-circle">
              End Shift
            </Button>
          </>
        ) : (
          <View style={styles.noShift}>
            <MaterialCommunityIcons name="clock-outline" size={80} color={colors.text.tertiary} />
            <Text style={styles.noShiftTitle}>No Active Shift</Text>
            <Text style={styles.noShiftText}>Start a shift to begin processing payments</Text>
            <Button mode="contained" onPress={startShift} loading={actionLoading} style={styles.startBtn} icon="play-circle">
              Start Shift
            </Button>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  activeCard: { marginBottom: spacing.lg, backgroundColor: colors.success.DEFAULT + '10', borderWidth: 2, borderColor: colors.success.DEFAULT, ...shadows.md },
  activeHeader: { flexDirection: 'row', alignItems: 'center' },
  activeInfo: { marginLeft: spacing.md },
  activeTitle: { fontSize: 18, fontWeight: '700', color: colors.success.DEFAULT },
  activeTime: { fontSize: 13, color: colors.text.tertiary, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs, marginBottom: spacing.lg },
  statCard: { width: '48%', margin: spacing.xs, ...shadows.sm },
  statVal: { fontSize: 17, fontWeight: '700', marginTop: spacing.sm },
  statLabel: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  totalCard: { marginBottom: spacing.xl, backgroundColor: colors.primary.DEFAULT + '10', borderWidth: 1, borderColor: colors.primary.DEFAULT },
  totalLabel: { fontSize: 14, color: colors.text.tertiary },
  totalValue: { fontSize: 28, fontWeight: '700', color: colors.primary.DEFAULT, marginTop: spacing.sm },
  endBtn: { backgroundColor: colors.danger.DEFAULT },
  noShift: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl * 2 },
  noShiftTitle: { fontSize: 22, fontWeight: '700', color: colors.text.primary, marginTop: spacing.lg },
  noShiftText: { fontSize: 14, color: colors.text.tertiary, marginTop: spacing.sm, textAlign: 'center' },
  startBtn: { marginTop: spacing.xl, backgroundColor: colors.success.DEFAULT, width: '100%' },
});

export default ShiftScreen;
