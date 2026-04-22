import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Animated } from 'react-native';
import { Text, Searchbar, Chip, ActivityIndicator } from 'react-native-paper';
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
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dispatchApi.getDispatchNotes();
      const list = Array.isArray(data) ? data : [];
      setAll(list);
      setFiltered(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    load();
  }, [load]);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (!q) { setFiltered(all); return; }
    setFiltered(all.filter(d =>
      (d.dispatch_number || '').toLowerCase().includes(q.toLowerCase()) ||
      (d.to_branch?.name || '').toLowerCase().includes(q.toLowerCase())
    ));
  };

  const renderItem = ({ item }: { item: any }) => {
    const status = item.status || 'draft';
    const cfg = STATUS_COLORS[status] || STATUS_COLORS.draft;
    const dispatchNum = item.dispatch_number || item.reference_number || item.id?.slice(0, 8);
    const branchName = item.to_branch?.name || 'Unknown Branch';
    const driver = item.driver?.name || '—';
    const itemCount = item.items?.length ?? 0;
    const date = item.dispatched_at || item.created_at;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('DispatchOTP', { dispatchId: item.id, otp: item.otp_code })}
        activeOpacity={0.7}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.statusIcon, { backgroundColor: cfg.color + '15' }]}>
              <MaterialCommunityIcons name={cfg.icon as any} size={24} color={cfg.color} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.dispatchNum}>{dispatchNum}</Text>
              <Text style={styles.branch}>→ {branchName}</Text>
            </View>
            <Chip
              icon={cfg.icon}
              style={[styles.statusChip, { backgroundColor: cfg.color + '15' }]}
              textStyle={[styles.statusText, { color: cfg.color }]}
            >
              {status.replace('_', ' ').toUpperCase()}
            </Chip>
          </View>
          <View style={styles.cardMeta}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="account" size={14} color={colors.text.tertiary} />
              <Text style={styles.metaText}>{driver}</Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons name="package-variant" size={14} color={colors.text.tertiary} />
              <Text style={styles.metaText}>{itemCount} items</Text>
            </View>
            {date && (
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="clock-outline" size={14} color={colors.text.tertiary} />
                <Text style={styles.metaText}>{new Date(date).toLocaleDateString()}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Dispatch History</Text>
          <Text style={styles.headerSubtitle}>{filtered.length} dispatches</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search dispatches..."
          value={search}
          onChangeText={handleSearch}
          style={styles.search}
          inputStyle={styles.searchInput}
          iconColor={colors.text.tertiary}
        />
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[colors.primary.DEFAULT]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="truck-outline" size={64} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>{loading ? 'Loading...' : 'No dispatches found'}</Text>
            <Text style={styles.emptyText}>
              {search ? 'Try adjusting your search' : 'Create your first dispatch to get started'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerContent: {},
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  searchContainer: {
    padding: spacing.md,
    backgroundColor: '#fff',
  },
  search: {
    backgroundColor: colors.muted.DEFAULT,
    elevation: 0,
  },
  searchInput: {
    fontSize: 15,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardContent: { flex: 1 },
  dispatchNum: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  branch: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  statusChip: {
    height: 28,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

export default DispatchHistoryScreen;
