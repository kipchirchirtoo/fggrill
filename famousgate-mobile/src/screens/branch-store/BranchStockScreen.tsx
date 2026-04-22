import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, Searchbar, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { useAuthStore } from '../../stores/auth.store';
import { inventoryApi } from '../../api/inventory.api';

interface StockItem {
  id: string;
  name: string;
  unit: string;
  category: string;
  current_stock: number;
  reorder_level: number;
}

const CATEGORIES = ['All', 'Food', 'Beverage', 'Cleaning', 'Stationery', 'Other'];

const BranchStockScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [items, setItems] = useState<StockItem[]>([]);
  const [filtered, setFiltered] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const load = async () => {
    setLoading(true);
    try {
      const data = await inventoryApi.branchStock(user?.branch_id ? String(user.branch_id) : undefined);
      const list = Array.isArray(data) ? data : [];
      setItems(list);
      setFiltered(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const applyFilters = (q: string, cat: string) => {
    let result = items;
    if (q) result = result.filter(i => i.name.toLowerCase().includes(q.toLowerCase()));
    if (cat !== 'All') result = result.filter(i => i.category === cat);
    setFiltered(result);
  };

  const getStockStatus = (item: StockItem) => {
    if (item.current_stock <= 0) return { color: colors.danger.DEFAULT, icon: 'close-circle' };
    if (item.current_stock <= item.reorder_level) return { color: colors.warning.DEFAULT, icon: 'alert-circle' };
    return { color: colors.success.DEFAULT, icon: 'check-circle' };
  };

  const renderItem = ({ item }: { item: StockItem }) => {
    const status = getStockStatus(item);
    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.category}>{item.category}</Text>
            </View>
            <View style={styles.stockInfo}>
              <MaterialCommunityIcons name={status.icon as any} size={20} color={status.color} />
              <Text style={[styles.stockQty, { color: status.color }]}>
                {item.current_stock} {item.unit}
              </Text>
            </View>
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, {
              width: `${Math.min(100, (item.current_stock / Math.max(item.reorder_level * 2, 1)) * 100)}%` as any,
              backgroundColor: status.color,
            }]} />
          </View>
          <Text style={styles.reorderText}>Reorder at: {item.reorder_level} {item.unit}</Text>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search stock..."
        value={search}
        onChangeText={q => { setSearch(q); applyFilters(q, category); }}
        style={styles.search}
      />
      <View style={styles.categories}>
        {CATEGORIES.map(cat => (
          <Chip
            key={cat}
            selected={category === cat}
            onPress={() => { setCategory(cat); applyFilters(search, cat); }}
            style={styles.chip}
            textStyle={{ fontSize: 12 }}
          >
            {cat}
          </Chip>
        ))}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListHeaderComponent={<Text style={styles.header}>{filtered.length} items</Text>}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="package-variant-closed" size={60} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No items found</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  search: { margin: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.card },
  categories: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm, flexWrap: 'wrap' },
  chip: { marginRight: spacing.xs },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  header: { fontSize: 13, color: colors.text.tertiary, marginBottom: spacing.md },
  card: { marginBottom: spacing.sm, ...shadows.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  flex: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  category: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  stockInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stockQty: { fontSize: 14, fontWeight: '700' },
  barBg: { height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden', marginBottom: spacing.xs },
  barFill: { height: 4, borderRadius: 2 },
  reorderText: { fontSize: 11, color: colors.text.tertiary },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: 15, color: colors.text.tertiary, marginTop: spacing.md },
});

export default BranchStockScreen;
