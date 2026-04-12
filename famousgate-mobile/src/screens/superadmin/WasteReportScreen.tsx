import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { wasteApi } from '../../api/wasteLogs.api';

const REASONS = ['All', 'expired', 'damaged', 'spilled', 'theft_suspected', 'other'];
const REASON_COLORS: Record<string, string> = {
  expired: colors.warning.DEFAULT,
  damaged: colors.danger.DEFAULT,
  spilled: colors.info.DEFAULT,
  theft_suspected: '#7C3AED',
  other: colors.text.tertiary,
};

const WasteReportScreen: React.FC = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReason, setSelectedReason] = useState('All');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // GET /api/wastage
      const data = await wasteApi.list({ limit: 100 });
      const list = Array.isArray(data) ? data : [];
      setEntries(list);
      setFiltered(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filterByReason = (r: string) => {
    setSelectedReason(r);
    setFiltered(r === 'All' ? entries : entries.filter(e => e.reason === r));
  };

  const renderItem = ({ item }: { item: any }) => {
    const color = REASON_COLORS[item.reason] || colors.text.tertiary;
    const itemName = item.item_name || item.item?.name || 'Unknown Item';
    const branchName = item.branch?.name || item.branch_name || '—';
    const loggedBy = item.logged_by?.name || item.user?.name || item.created_by || '—';
    const date = item.waste_date || item.logged_at || item.created_at;

    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.itemName}>{itemName}</Text>
              <Text style={styles.branch}>{branchName}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: `${color}15` }]}>
              <Text style={[styles.badgeText, { color }]}>{(item.reason || 'other').replace('_', ' ').toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.meta}>
            <MaterialCommunityIcons name="delete-variant" size={14} color={colors.danger.DEFAULT} />
            <Text style={[styles.metaText, { color: colors.danger.DEFAULT, fontWeight: '600' }]}>
              {item.quantity} {item.unit}
            </Text>
            <MaterialCommunityIcons name="account" size={14} color={colors.text.tertiary} style={{ marginLeft: spacing.md }} />
            <Text style={styles.metaText}>{loggedBy}</Text>
            {date && <>
              <MaterialCommunityIcons name="clock-outline" size={14} color={colors.text.tertiary} style={{ marginLeft: spacing.md }} />
              <Text style={styles.metaText}>{new Date(date).toLocaleDateString()}</Text>
            </>}
          </View>
          {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        {REASONS.map(r => (
          <Chip key={r} selected={selectedReason === r} onPress={() => filterByReason(r)} style={styles.chip} textStyle={{ fontSize: 11 }}>
            {r === 'All' ? 'All' : r.replace('_', ' ')}
          </Chip>
        ))}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(i, idx) => i.id || String(idx)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListHeaderComponent={<Text style={styles.header}>{filtered.length} waste entries</Text>}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="delete-off" size={60} color={colors.success.DEFAULT} />
            <Text style={styles.emptyText}>{loading ? 'Loading…' : 'No waste entries'}</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filters: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  chip: { marginRight: spacing.xs },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  header: { fontSize: 13, color: colors.text.tertiary, marginBottom: spacing.md },
  card: { marginBottom: spacing.md, ...shadows.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  flex: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  branch: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: colors.text.tertiary, marginLeft: 4 },
  notes: { fontSize: 12, color: colors.text.tertiary, fontStyle: 'italic', marginTop: spacing.sm },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: 15, color: colors.text.tertiary, marginTop: spacing.md },
});

export default WasteReportScreen;
