import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, Button, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { cashierApi } from '../../api/cashier.api';
import { useAuthStore } from '../../stores/auth.store';

const ShiftScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [shift, setShift] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('');
  const [showStartForm, setShowStartForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // GET /api/cashier/shifts — find the open one
      const data = await cashierApi.shifts();
      console.log('📱 [Shift] Raw shifts data:', JSON.stringify(data, null, 2));
      
      const list = Array.isArray(data) ? data : [];
      const open = list.find((s: any) => s.status === 'open' || !s.closed_at || !s.shift_end);
      
      console.log('📱 [Shift] Found open shift:', JSON.stringify(open, null, 2));
      setShift(open || null);
    } catch (e) { 
      console.error('📱 [Shift] Error loading shifts:', e);
      setShift(null); 
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startShift = async () => {
    if (!openingFloat || parseFloat(openingFloat) < 0) {
      Alert.alert('Error', 'Please enter a valid opening float amount');
      return;
    }
    
    setActionLoading(true);
    try {
      console.log('📱 [Shift] Starting shift with opening float:', openingFloat);
      // POST /api/cashier/shifts/start
      const response = await cashierApi.startShift();
      console.log('📱 [Shift] Start shift response:', JSON.stringify(response, null, 2));
      
      const newShift = response.data || response;
      console.log('📱 [Shift] New shift data:', JSON.stringify(newShift, null, 2));
      
      setShift(newShift);
      setOpeningFloat('');
      setShowStartForm(false);
      Alert.alert('Shift Started', 'Your shift has started successfully!');
    } catch (e: any) {
      console.error('📱 [Shift] Error starting shift:', e);
      Alert.alert('Error', e.response?.data?.message || e.message || 'Failed to start shift');
    } finally { setActionLoading(false); }
  };

  const endShift = () => {
    if (!shift) {
      Alert.alert('Error', 'No active shift found');
      return;
    }
    
    if (!shift.id) {
      console.error('📱 [Shift] Shift object missing ID:', shift);
      Alert.alert('Error', 'Invalid shift data. Please refresh and try again.');
      return;
    }
    
    console.log('📱 [Shift] Ending shift with ID:', shift.id);
    
    Alert.alert(
      'End Shift', 
      'Are you sure you want to end your current shift? This will close all active transactions.', 
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Shift', 
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              console.log('📱 [Shift] Calling closeShift API with ID:', shift.id);
              // PUT /api/cashier/shifts/:id/close
              const closed = await cashierApi.closeShift(shift.id);
              console.log('📱 [Shift] Shift closed successfully:', closed);
              
              setShift(null);
              const total = (closed.total_cash || 0) + (closed.total_mpesa || 0) + (closed.total_card || 0);
              Alert.alert(
                'Shift Ended', 
                `Total collected: KES ${total.toLocaleString()}\n\nThank you for your work!`, 
                [{ text: 'OK', onPress: () => navigation?.navigate('CashierTabs') }]
              );
            } catch (e: any) {
              console.error('📱 [Shift] Error closing shift:', e);
              Alert.alert('Error', e.response?.data?.message || e.message || 'Failed to end shift');
            } finally { setActionLoading(false); }
          },
        },
      ]
    );
  };

  const shiftTotal = shift
    ? (shift.total_cash || 0) + (shift.total_mpesa || 0) + (shift.total_card || 0)
    : 0;

  const cashierName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Cashier';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        showsVerticalScrollIndicator={false}
      >
        {shift ? (
          <>
            {/* Active Shift Header */}
            <Card style={styles.activeCard}>
              <Card.Content>
                <View style={styles.activeHeader}>
                  <View style={styles.activeIconContainer}>
                    <MaterialCommunityIcons name="clock-check" size={28} color="#fff" />
                  </View>
                  <View style={styles.activeInfo}>
                    <Text style={styles.activeTitle}>Shift Active</Text>
                    <Text style={styles.activeSubtitle}>
                      {shift.shift_number || shift.id?.slice(0, 8) || 'Current Shift'}
                    </Text>
                  </View>
                  <View style={styles.pulseDot} />
                </View>
                <View style={styles.activeMetaRow}>
                  <View style={styles.activeMeta}>
                    <Text style={styles.activeMetaLabel}>Cashier</Text>
                    <Text style={styles.activeMetaValue}>{cashierName}</Text>
                  </View>
                  <View style={styles.activeMeta}>
                    <Text style={styles.activeMetaLabel}>Started</Text>
                    <Text style={styles.activeMetaValue}>
                      {new Date(shift.shift_start || shift.started_at || shift.created_at).toLocaleTimeString()}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>

            {/* Summary Stats */}
            <Text style={styles.sectionTitle}>Today's Summary</Text>
            <View style={styles.statsGrid}>
              {[
                { label: 'Cash', value: shift.total_cash || 0, icon: 'cash', gradient: ['#10b981', '#059669'] },
                { label: 'M-Pesa', value: shift.total_mpesa || 0, icon: 'cellphone', gradient: ['#3b82f6', '#2563eb'] },
                { label: 'Card', value: shift.total_card || 0, icon: 'credit-card', gradient: ['#f59e0b', '#d97706'] },
                { label: 'Transactions', value: shift.total_transactions || shift.transaction_count || 0, icon: 'receipt', gradient: ['#8b5cf6', '#7c3aed'], isCount: true },
              ].map((stat, index) => (
                <Card key={index} style={styles.statCard}>
                  <Card.Content style={styles.statContent}>
                    <View style={[styles.statIcon, { backgroundColor: stat.gradient[0] }]}>
                      <MaterialCommunityIcons name={stat.icon as any} size={24} color="#fff" />
                    </View>
                    <Text style={styles.statValue}>
                      {stat.isCount ? stat.value : `KES ${Number(stat.value).toLocaleString()}`}
                    </Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </Card.Content>
                </Card>
              ))}
            </View>

            {/* Total Collected */}
            <Card style={styles.totalCard}>
              <Card.Content>
                <View style={styles.totalHeader}>
                  <MaterialCommunityIcons name="wallet" size={24} color={colors.primary.DEFAULT} />
                  <Text style={styles.totalLabel}>Total Collected</Text>
                </View>
                <Text style={styles.totalValue}>KES {shiftTotal.toLocaleString()}</Text>
              </Card.Content>
            </Card>

            {/* End Shift Button */}
            <Button 
              mode="contained" 
              onPress={endShift} 
              loading={actionLoading}
              disabled={actionLoading}
              style={styles.endBtn}
              contentStyle={styles.endBtnContent}
              icon="stop-circle"
              labelStyle={styles.endBtnLabel}
            >
              End Shift
            </Button>
          </>
        ) : (
          <View style={styles.noShift}>
            {!showStartForm ? (
              <>
                <View style={styles.noShiftIconContainer}>
                  <MaterialCommunityIcons name="clock-outline" size={64} color={colors.primary.DEFAULT} />
                </View>
                <Text style={styles.noShiftTitle}>No Active Shift</Text>
                <Text style={styles.noShiftText}>
                  Start a new shift to begin processing payments and tracking transactions
                </Text>
                <Button 
                  mode="contained" 
                  onPress={() => setShowStartForm(true)}
                  style={styles.startBtn}
                  contentStyle={styles.startBtnContent}
                  icon="play-circle"
                  labelStyle={styles.startBtnLabel}
                >
                  Start New Shift
                </Button>
              </>
            ) : (
              <Card style={styles.startFormCard}>
                <Card.Content>
                  <Text style={styles.formTitle}>Start New Shift</Text>
                  <Text style={styles.formSubtitle}>Enter your opening float amount to begin</Text>
                  
                  <TextInput
                    label="Opening Float (KES)"
                    value={openingFloat}
                    onChangeText={setOpeningFloat}
                    keyboardType="numeric"
                    mode="outlined"
                    style={styles.input}
                    left={<TextInput.Icon icon="cash" />}
                    placeholder="e.g. 5000"
                  />

                  <View style={styles.formButtons}>
                    <Button 
                      mode="outlined" 
                      onPress={() => {
                        setShowStartForm(false);
                        setOpeningFloat('');
                      }}
                      style={styles.cancelBtn}
                    >
                      Cancel
                    </Button>
                    <Button 
                      mode="contained" 
                      onPress={startShift}
                      loading={actionLoading}
                      disabled={actionLoading || !openingFloat}
                      style={styles.confirmBtn}
                      icon="check"
                    >
                      Start Shift
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  
  // Active Shift Card
  activeCard: { 
    marginBottom: spacing.xl, 
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.success.DEFAULT + '30',
    ...shadows.lg 
  },
  activeHeader: { 
    flexDirection: 'row', 
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  activeIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.success.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md
  },
  activeInfo: { flex: 1 },
  activeTitle: { fontSize: 20, fontWeight: '800', color: colors.text.primary },
  activeSubtitle: { fontSize: 13, color: colors.text.tertiary, marginTop: 2, fontWeight: '600' },
  pulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success.DEFAULT
  },
  activeMetaRow: { flexDirection: 'row', gap: spacing.xl },
  activeMeta: { flex: 1 },
  activeMetaLabel: { fontSize: 12, color: colors.text.tertiary, marginBottom: 4, fontWeight: '600' },
  activeMetaValue: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
  
  // Section
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.text.primary, marginBottom: spacing.lg },
  
  // Stats Grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xl },
  statCard: { 
    width: '48%', 
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm 
  },
  statContent: { alignItems: 'center', paddingVertical: spacing.md },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.text.primary, marginBottom: 4 },
  statLabel: { fontSize: 12, color: colors.text.tertiary, fontWeight: '600' },
  
  // Total Card
  totalCard: { 
    marginBottom: spacing.xl, 
    backgroundColor: colors.primary.DEFAULT + '08',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary.DEFAULT + '30',
    ...shadows.md
  },
  totalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  totalLabel: { fontSize: 14, color: colors.text.tertiary, marginLeft: spacing.sm, fontWeight: '600' },
  totalValue: { fontSize: 36, fontWeight: '800', color: colors.primary.DEFAULT, marginTop: spacing.xs },
  
  // End Button
  endBtn: { 
    backgroundColor: colors.danger.DEFAULT,
    borderRadius: 16,
    ...shadows.md
  },
  endBtnContent: { paddingVertical: 8 },
  endBtnLabel: { fontSize: 16, fontWeight: '700' },
  
  // No Shift State
  noShift: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: spacing.xxl * 2,
    paddingHorizontal: spacing.xl
  },
  noShiftIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary.DEFAULT + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl
  },
  noShiftTitle: { fontSize: 24, fontWeight: '800', color: colors.text.primary, marginBottom: spacing.sm },
  noShiftText: { 
    fontSize: 15, 
    color: colors.text.tertiary, 
    textAlign: 'center', 
    lineHeight: 22,
    marginBottom: spacing.xl
  },
  startBtn: { 
    width: '100%',
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 16,
    ...shadows.md
  },
  startBtnContent: { paddingVertical: 8 },
  startBtnLabel: { fontSize: 16, fontWeight: '700' },
  
  // Start Form
  startFormCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.lg
  },
  formTitle: { fontSize: 22, fontWeight: '800', color: colors.text.primary, marginBottom: spacing.xs },
  formSubtitle: { fontSize: 14, color: colors.text.tertiary, marginBottom: spacing.xl },
  input: { marginBottom: spacing.xl, backgroundColor: '#fff' },
  formButtons: { flexDirection: 'row', gap: spacing.md },
  cancelBtn: { flex: 1, borderRadius: 12 },
  confirmBtn: { 
    flex: 1, 
    backgroundColor: colors.success.DEFAULT,
    borderRadius: 12
  },
});

export default ShiftScreen;
