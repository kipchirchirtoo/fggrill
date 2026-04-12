import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { useAuthStore } from '../../stores/auth.store';
import apiClient from '../../api/client';

interface Receipt {
  id: string;
  dispatch_number: string;
  from_branch_name: string;
  confirmed_at: string;
  has_discrepancy: boolean;
  items_count: number;
}

const ReceiptHistoryScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/branch-receipts/${user?.branch_id}`);
      setReceipts(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const renderItem = ({ item }: { item: Receipt }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.dispatchNum}>{item.dispatch_number}</Text>
            <Text style={styles.branch}>From: {item.from_branch_name}</Text>
          </View>
          {item.has_discrepancy ? (
            <View style={styles.discBadge}>
              <MaterialCommunityIcons name="alert" size={14} color={colors.warning.DEFAULT} />
              <Text style={styles.discText}>Discrepancy</Text>
            </View>
          ) : (
            <View style={styles.okBadge}>
              <MaterialCommunityIcons name="check" size={14} color={colors.success.DEFAULT} />
              <Text style={styles.okText}>OK</Text>
            </View>
          )}
        </View>
        <View style={styles.meta}>
          <MaterialCommunityIcons name="package-variant" size={14} color={colors.text.tertiary} />
          <Text style={styles.metaText}>{item.items_count} items</Text>
          <MaterialCommunityIcons name="clock-outline" size={14} color={colors.text.tertiary} style={{ marginLeft: spacing.md }} />
          <Text style={styles.metaText}>{new Date(item.confirmed_at).toLocaleDateString()}</Text>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={receipts}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="history" size={60} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No receipts yet</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: 100 },
  card: { marginBottom: spacing.md, ...shadows.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  flex: { flex: 1 },
  dispatchNum: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
  branch: { fontSize: 13, color: colors.text.tertiary, marginTop: 2 },
  discBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.warning.DEFAULT + '15', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 6 },
  discText: { fontSize: 11, fontWeight: '700', color: colors.warning.DEFAULT, marginLeft: 4 },
  okBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.success.DEFAULT + '15', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 6 },
  okText: { fontSize: 11, fontWeight: '700', color: colors.success.DEFAULT, marginLeft: 4 },
  meta: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 12, color: colors.text.tertiary, marginLeft: 4 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: 15, color: colors.text.tertiary, marginTop: spacing.md },
});

export default ReceiptHistoryScreen;
