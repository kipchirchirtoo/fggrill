/**
 * BillsScreen - Tabbed view for Unpaid Bills and Transaction History
 * Matches web app cashier module structure
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Dimensions } from 'react-native';
import { Text, Card, Searchbar, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { cashierApi } from '../../api/cashier.api';
import { useAuthStore } from '../../stores/auth.store';

const { width } = Dimensions.get('window');

interface Props {
  navigation: any;
  route?: { params?: { tab?: 'unpaid' | 'history' } };
}

const BillsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'unpaid' | 'history'>(route?.params?.tab || 'unpaid');
  const [unpaidBills, setUnpaidBills] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'unpaid') {
        // GET /api/cashier/unpaid-bills?branch_id=X
        const data = await cashierApi.unpaidBills({ branch_id: user?.branch_id });
        const list = Array.isArray(data) ? data : [];
        setUnpaidBills(list);
        setFilteredData(list);
      } else {
        // GET /api/cashier/shifts - get recent transactions from shifts
        const shifts = await cashierApi.shifts();
        const shiftList = Array.isArray(shifts) ? shifts : [];
        // Flatten transactions from all shifts
        const transactions: any[] = [];
        shiftList.forEach((shift: any) => {
          if (shift.transactions && Array.isArray(shift.transactions)) {
            transactions.push(...shift.transactions.map((t: any) => ({ ...t, shift_number: shift.shift_number })));
          }
        });
        setHistory(transactions);
        setFilteredData(transactions);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeTab, user?.branch_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (!q) {
      setFilteredData(activeTab === 'unpaid' ? unpaidBills : history);
      return;
    }
    
    const source = activeTab === 'unpaid' ? unpaidBills : history;
    setFilteredData(
      source.filter((item: any) =>
        (item.booking_number || item.bill_number || item.reference || item.transaction_ref || '').toLowerCase().includes(q.toLowerCase()) ||
        (item.customer_name || item.guest_name || item.name || '').toLowerCase().includes(q.toLowerCase())
      )
    );
  };

  const renderUnpaidBill = ({ item }: { item: any }) => {
    const billNum = item.booking_number || item.bill_number || item.reference || item.id?.slice(0, 8);
    const customerName = item.customer_name || item.guest_name || item.name || 'Guest';
    const room = item.room_number || item.room?.number;
    const balance = item.balance ?? item.outstanding_amount ?? item.total_amount ?? 0;
    const total = item.total_amount ?? item.amount ?? 0;
    const billType = item.bill_type || item.type || 'BILL';

    return (
      <TouchableOpacity onPress={() => navigation.navigate('BillDetail', { booking: item })}>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <View style={styles.flex}>
                <Text style={styles.billNum}>{billNum}</Text>
                <Text style={styles.customer}>{customerName}</Text>
                {room && (
                  <View style={styles.metaRow}>
                    <MaterialCommunityIcons name="door" size={14} color={colors.text.tertiary} />
                    <Text style={styles.metaText}>Room {room}</Text>
                  </View>
                )}
              </View>
              <View style={styles.amountBox}>
                <Text style={styles.balance}>KES {Number(balance).toLocaleString()}</Text>
                <Text style={styles.balanceLabel}>Balance</Text>
              </View>
            </View>
            <View style={styles.cardFooter}>
              <Chip mode="outlined" style={styles.typeChip} textStyle={styles.typeChipText}>
                {billType}
              </Chip>
              <Text style={styles.totalText}>Total: KES {Number(total).toLocaleString()}</Text>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderHistoryItem = ({ item }: { item: any }) => {
    const ref = item.transaction_ref || item.reference || item.id?.slice(0, 8);
    const customer = item.customer_name || item.guest_name || 'Walk-in';
    const amount = item.amount || item.total_amount || 0;
    const method = item.payment_method || item.method || 'CASH';
    const timestamp = item.created_at || item.transaction_time;
    const status = item.status || 'completed';

    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.flex}>
              <Text style={styles.billNum}>{ref}</Text>
              <Text style={styles.customer}>{customer}</Text>
              {timestamp && (
                <View style={styles.metaRow}>
                  <MaterialCommunityIcons name="clock-outline" size={14} color={colors.text.tertiary} />
                  <Text style={styles.metaText}>{new Date(timestamp).toLocaleString()}</Text>
                </View>
              )}
            </View>
            <View style={styles.amountBox}>
              <Text style={[styles.balance, { color: colors.success.DEFAULT }]}>
                KES {Number(amount).toLocaleString()}
              </Text>
              <Text style={styles.balanceLabel}>Paid</Text>
            </View>
          </View>
          <View style={styles.cardFooter}>
            <Chip 
              mode="outlined" 
              style={[styles.methodChip, { borderColor: getMethodColor(method) }]} 
              textStyle={[styles.methodChipText, { color: getMethodColor(method) }]}
            >
              {method}
            </Chip>
            {status === 'pending' && (
              <Chip mode="outlined" style={styles.pendingChip} textStyle={styles.pendingChipText}>
                PENDING
              </Chip>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  const getMethodColor = (method: string) => {
    const m = method.toLowerCase();
    if (m.includes('mpesa')) return colors.success.DEFAULT;
    if (m.includes('card')) return colors.info.DEFAULT;
    return colors.text.primary;
  };

  return (
    <View style={styles.container}>
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'unpaid' && styles.tabActive]}
          onPress={() => setActiveTab('unpaid')}
        >
          <MaterialCommunityIcons 
            name="alert-circle" 
            size={20} 
            color={activeTab === 'unpaid' ? colors.primary.DEFAULT : colors.text.tertiary} 
          />
          <Text style={[styles.tabText, activeTab === 'unpaid' && styles.tabTextActive]}>
            Unpaid Bills
          </Text>
          {unpaidBills.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{unpaidBills.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <MaterialCommunityIcons 
            name="history" 
            size={20} 
            color={activeTab === 'history' ? colors.primary.DEFAULT : colors.text.tertiary} 
          />
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <Searchbar
        placeholder={activeTab === 'unpaid' ? 'Search bills...' : 'Search transactions...'}
        value={search}
        onChangeText={handleSearch}
        style={styles.search}
        iconColor={colors.primary.DEFAULT}
      />

      {/* List */}
      <FlatList
        data={filteredData}
        keyExtractor={(item, index) => item.id || `${index}`}
        renderItem={activeTab === 'unpaid' ? renderUnpaidBill : renderHistoryItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
        ListHeaderComponent={
          <Text style={styles.header}>
            {filteredData.length} {activeTab === 'unpaid' ? 'unpaid bills' : 'transactions'}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons 
              name={activeTab === 'unpaid' ? 'check-all' : 'history'} 
              size={60} 
              color={colors.text.tertiary} 
            />
            <Text style={styles.emptyTitle}>
              {loading ? 'Loading...' : activeTab === 'unpaid' ? 'No Unpaid Bills' : 'No Transactions'}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'unpaid' ? 'All bills have been settled' : 'No transaction history available'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  
  // Tabs
  tabContainer: { 
    flexDirection: 'row', 
    backgroundColor: colors.card, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md
  },
  tab: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: spacing.md,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    gap: spacing.sm
  },
  tabActive: { borderBottomColor: colors.primary.DEFAULT },
  tabText: { fontSize: 15, fontWeight: '600', color: colors.text.tertiary },
  tabTextActive: { color: colors.primary.DEFAULT },
  tabBadge: { 
    backgroundColor: colors.danger.DEFAULT, 
    borderRadius: 10, 
    minWidth: 20, 
    height: 20, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingHorizontal: spacing.xs
  },
  tabBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  
  // Search
  search: { margin: spacing.lg, backgroundColor: colors.card },
  
  // List
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  header: { fontSize: 13, color: colors.text.tertiary, marginBottom: spacing.md, fontWeight: '600' },
  
  // Card
  card: { marginBottom: spacing.md, ...shadows.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  flex: { flex: 1 },
  billNum: { fontSize: 16, fontWeight: '700', color: colors.text.primary, marginBottom: 4 },
  customer: { fontSize: 14, color: colors.text.secondary, marginBottom: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { fontSize: 12, color: colors.text.tertiary },
  amountBox: { alignItems: 'flex-end' },
  balance: { fontSize: 20, fontWeight: '700', color: colors.danger.DEFAULT },
  balanceLabel: { fontSize: 11, color: colors.text.tertiary, marginTop: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeChip: { height: 24, backgroundColor: colors.primary.DEFAULT + '10', borderColor: colors.primary.DEFAULT },
  typeChipText: { fontSize: 10, fontWeight: '700', color: colors.primary.DEFAULT, marginVertical: 0 },
  methodChip: { height: 24, backgroundColor: 'transparent' },
  methodChipText: { fontSize: 10, fontWeight: '700', marginVertical: 0 },
  pendingChip: { height: 24, backgroundColor: colors.warning.DEFAULT + '10', borderColor: colors.warning.DEFAULT },
  pendingChipText: { fontSize: 10, fontWeight: '700', color: colors.warning.DEFAULT, marginVertical: 0 },
  totalText: { fontSize: 12, color: colors.text.tertiary },
  
  // Empty State
  empty: { alignItems: 'center', paddingVertical: spacing.xxl * 2 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary, marginTop: spacing.lg },
  emptyText: { fontSize: 14, color: colors.text.tertiary, marginTop: spacing.sm, textAlign: 'center' },
});

export default BillsScreen;
