import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { inventoryApi } from '../../api/inventory.api';

interface LowStockItem {
  id: string;
  name: string;
  barcode: string;
  unit: string;
  category: string;
  current_stock: number;
  reorder_level: number;
}

const LowStockScreen: React.FC = () => {
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [filtered, setFiltered] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await inventoryApi.lowStock();
      const list = Array.isArray(data) ? data : [];
      setItems(list);
      setFiltered(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (q: string) => {
    setSearch(q);
    setFiltered(!q ? items : items.filter(i =>
      i.name.toLowerCase().includes(q.toLowerCase()) ||
      i.category.toLowerCase().includes(q.toLowerCase())
    ));
  };

  const getStockLevel = (item: LowStockItem) => {
    const pct = item.current_stock / item.reorder_level;
    if (pct <= 0) return { color: colors.danger.DEFAULT, label: 'OUT OF STOCK' };
    if (pct <= 0.5) return { color: colors.danger.DEFAULT, label: 'CRITICAL' };
    return { color: colors.warning.DEFAULT, label: 'LOW' };
  };

  const renderItem = ({ item }: { item: LowStockItem }) => {
    const level = getStockLevel(item);
    const pct = Math.min(100, (item.current_stock / item.reorder_level) * 100);
    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.category}>{item.category}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: `${level.color}15` }]}>
              <Text style={[styles.badgeText, { color: level.color }]}>{level.label}</Text>
            </View>
          </View>
          <View style={styles.stockRow}>
            <Text style={styles.stockLabel}>Current:</Text>
            <Text style={[styles.stockValue, { color: level.color }]}>
              {item.current_stock} {item.unit}
            </Text>
            <Text style={styles.stockLabel}>Reorder at:</Text>
            <Text style={styles.stockValue}>{item.reorder_level} {item.unit}</Text>
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: level.color }]} />
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search items..."
        value={search}
        onChangeText={handleSearch}
        style={styles.search}
      />
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListHeaderComponent={
          <Text style={styles.header}>{filtered.length} items need attention</Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="check-circle" size={60} color={colors.success.DEFAULT} />
            <Text style={styles.emptyText}>All stock levels are healthy</Text>
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
  header: { fontSize: 14, fontWeight: '600', color: colors.text.tertiary, marginBottom: spacing.md },
  card: { marginBottom: spacing.md, ...shadows.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  flex: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  category: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  stockLabel: { fontSize: 12, color: colors.text.tertiary },
  stockValue: { fontSize: 13, fontWeight: '600', color: colors.text.primary },
  barBg: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: 16, color: colors.text.tertiary, marginTop: spacing.md },
});

export default LowStockScreen;
