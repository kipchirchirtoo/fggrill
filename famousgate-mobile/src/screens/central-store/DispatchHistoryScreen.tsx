import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, Card, Searchbar, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { dispatchApi } from '../../api/dispatch.api';

const STATUS_COLORS: Record<string, { color: string; icon: string }> = {
  draft: { color: colors.text.tertiary, icon: 'file-outline' },
  pending: { color: colors.warning.DEFAULT, icon: 'clock-outline' },
  dispatched: { color: colors.info.DEFAULT, icon: 'truck-delivery' },
  in_transit: { color: colors.info.DEFAULT, icon: 'truck-fast' },
  delivered: { color: colors.success.DEFAULT, icon: 'check-circle' },
  confirmed: { color: colors.success.DEFAULT, icon: 'check-circle' },
  discrepancy: { color: colors.danger.DEFAULT, icon: 'alert-circle' },
};

const DispatchHistoryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [all, setAll] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dispatchApi.list();
      const list = Array.isArray(data) ? data : [];
      setAll(list);
      setFiltered(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (!q) { setFiltered(all); return; }
    setFiltered(all.filter(d =>
      (d.dispatch_number || d.reference_number || '').toLowerCase().includes(q.toLowerCase()) ||
      (d.to_branch?.name || d.to_branch_name || '').toLowerCase().includes(q.toLowerCase())
    ));
  };

  const renderItem = ({ item }: { item: any }) => {
    const status = item.status || 'draft';
    const cfg = STATUS_COLORS[status] || STATUS_COLORS.draft;
    const dispatchNum = item.dispatch_number || item.reference_number || item.id?.slice(0, 8);
    const branchName = item.to_branch?.name || item.to_branch_name || 'Unknown Branch';
    const driver = item.driver_name || item.logistics?.driver_name || '—';
    const itemCount = item.items?.length ?? item.items_count ?? 0;
    const date = item.dispatched_at || item.created_at;

    return (
      <TouchableOpacity onPress={() => navigation.navigate('DispatchOTP', { dispatchId: item.id, otp: item.otp_code })}>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.dispatchNum}>{dispatchNum}</Text>
                <Text style={styles.branch}>→ {branchName}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: `${cfg.color}18` }]}>
                <MaterialCommunityIcons name={cfg.icon as any} size={13} color={cfg.color} />
                <Text style={[styles.badgeText, { color: cfg.color }]}>{status.replace('_', ' ').toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.meta}>
              <MaterialCommunityIcons name="account" size={13} color={colors.text.tertiary} />
              <Text style={styles.metaText}>{driver}</Text>
              <MaterialCommunityIcons name="package-variant" size={13} color={colors.text.tertiary} style={{ marginLeft: spacing.md }} />
              <Text style={styles.metaText}>{itemCount} items</Text>
              {date && <>
                <MaterialCommunityIcons name="clock-outline" size={13} color={colors.text.tertiary} style={{ marginLeft: spacing.md }} />
                <Text style={styles.metaText}>{new Date(date).toLocaleDateString()}</Text>
              </>}
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Searchbar placeholder="Search dispatches…" value={search} onChangeText={handleSearch} style={styles.search} />
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListHeaderComponent={<Text style={styles.header}>{filtered.length} dispatches</Text>}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="truck-outline" size={60} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>{loading ? 'Loading…' : 'No dispatches found'}</Text>
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
  dispatchNum: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
  branch: { fontSize: 13, color: colors.text.tertiary, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '700', marginLeft: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: colors.text.tertiary, marginLeft: 4 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: 15, color: colors.text.tertiary, marginTop: spacing.md },
});

export default DispatchHistoryScreen;
