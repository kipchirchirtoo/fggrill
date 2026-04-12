import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { cashierApi } from '../../api/cashier.api';

const UnpaidBillsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [bills, setBills] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // GET /api/cashier/unpaid-bills
      const data = await cashierApi.unpaidBills();
      const list = Array.isArray(data) ? data : [];
      setBills(list);
      setFiltered(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (!q) { setFiltered(bills); return; }
    setFiltered(bills.filter(b =>
      (b.booking_number || b.reference || b.id || '').toLowerCase().includes(q.toLowerCase()) ||
      (b.customer_name || b.guest_name || b.name || '').toLowerCase().includes(q.toLowerCase())
    ));
  };

  const renderItem = ({ item }: { item: any }) => {
    const bookingNum = item.booking_number || item.reference || item.id?.slice(0, 8);
    const customerName = item.customer_name || item.guest_name || item.name || 'Guest';
    const room = item.room_number || item.room?.number;
    const balance = item.balance ?? item.outstanding_amount ?? item.total_amount ?? 0;
    const total = item.total_amount ?? item.amount ?? 0;
    const paid = item.amount_paid ?? item.paid_amount ?? 0;

    return (
      <TouchableOpacity onPress={() => navigation.navigate('BillDetail', { booking: item })}>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.bookingNum}>{bookingNum}</Text>
                <Text style={styles.customer}>{customerName}</Text>
                {room && <Text style={styles.room}>Room {room}</Text>}
              </View>
              <View style={styles.amountBox}>
                <Text style={styles.balance}>KES {Number(balance).toLocaleString()}</Text>
                <Text style={styles.balanceLabel}>Balance Due</Text>
              </View>
            </View>
            <View style={styles.meta}>
              <Text style={styles.metaText}>Total: KES {Number(total).toLocaleString()}</Text>
              <Text style={styles.metaText}>  •  Paid: KES {Number(paid).toLocaleString()}</Text>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Searchbar placeholder="Search by booking # or name…" value={search} onChangeText={handleSearch} style={styles.search} />
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListHeaderComponent={<Text style={styles.header}>{filtered.length} unpaid bills</Text>}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="check-all" size={60} color={colors.success.DEFAULT} />
            <Text style={styles.emptyTitle}>{loading ? 'Loading…' : 'No Unpaid Bills'}</Text>
            <Text style={styles.emptyText}>All bills have been settled</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  search: { margin: spacing.lg, backgroundColor: colors.card },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  header: { fontSize: 13, color: colors.text.tertiary, marginBottom: spacing.md },
  card: { marginBottom: spacing.md, ...shadows.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  flex: { flex: 1 },
  bookingNum: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
  customer: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
  room: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  amountBox: { alignItems: 'flex-end' },
  balance: { fontSize: 18, fontWeight: '700', color: colors.danger.DEFAULT },
  balanceLabel: { fontSize: 11, color: colors.text.tertiary },
  meta: { flexDirection: 'row' },
  metaText: { fontSize: 12, color: colors.text.tertiary },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text.primary, marginTop: spacing.lg },
  emptyText: { fontSize: 14, color: colors.text.tertiary, marginTop: spacing.sm },
});

export default UnpaidBillsScreen;
