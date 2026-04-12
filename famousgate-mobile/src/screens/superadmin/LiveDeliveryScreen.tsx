/**
 * LiveDeliveryScreen — Superadmin
 *
 * Real-time view of all active deliveries across all branches.
 * Auto-refreshes every 30 seconds.
 *
 * API: GET /api/storekeeping/dispatch-notes (filtered to active statuses)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { dispatchApi } from '../../api/dispatch.api';

const STATUS_CFG: Record<string, { color: string; icon: string; label: string }> = {
  dispatched: { color: colors.warning.DEFAULT, icon: 'truck-delivery', label: 'Dispatched' },
  in_transit: { color: colors.info.DEFAULT, icon: 'truck-fast', label: 'In Transit' },
  delivered: { color: colors.success.DEFAULT, icon: 'check-circle', label: 'Delivered' },
  confirmed: { color: colors.success.DEFAULT, icon: 'check-circle', label: 'Confirmed' },
  discrepancy: { color: colors.danger.DEFAULT, icon: 'alert-circle', label: 'Discrepancy' },
  pending: { color: colors.warning.DEFAULT, icon: 'clock-outline', label: 'Pending' },
};

const LiveDeliveryScreen: React.FC = () => {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // GET /api/storekeeping/dispatch-notes
      const data = await dispatchApi.list();
      const list = Array.isArray(data) ? data : [];
      // Show all non-draft dispatches
      setDeliveries(list.filter((d: any) => d.status !== 'draft'));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    // Auto-refresh every 30 seconds
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  const renderItem = ({ item }: { item: any }) => {
    const status = item.status || 'pending';
    const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
    const dispatchNum = item.dispatch_number || item.reference_number || item.id?.slice(0, 8);
    const fromBranch = item.from_branch?.name || item.from_branch_name || 'Central Store';
    const toBranch = item.to_branch?.name || item.to_branch_name || '—';
    const driver = item.driver_name || item.logistics?.driver_name || '—';
    const itemCount = item.items?.length ?? item.items_count ?? 0;
    const date = item.dispatched_at || item.created_at;

    return (
      <Card style={[styles.card, status === 'discrepancy' && styles.cardDisc]}>
        <Card.Content>
          <View style={styles.row}>
            <MaterialCommunityIcons name={cfg.icon as any} size={26} color={cfg.color} />
            <View style={styles.info}>
              <Text style={styles.dispatchNum}>{dispatchNum}</Text>
              <Text style={styles.route}>{fromBranch} → {toBranch}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: `${cfg.color}18` }]}>
              <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label.toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.meta}>
            <MaterialCommunityIcons name="account" size={13} color={colors.text.tertiary} />
            <Text style={styles.metaText}>{driver}</Text>
            <MaterialCommunityIcons name="package-variant" size={13} color={colors.text.tertiary} style={{ marginLeft: spacing.md }} />
            <Text style={styles.metaText}>{itemCount} items</Text>
            {date && (
              <>
                <MaterialCommunityIcons name="clock-outline" size={13} color={colors.text.tertiary} style={{ marginLeft: spacing.md }} />
                <Text style={styles.metaText}>{new Date(date).toLocaleTimeString()}</Text>
              </>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  const activeCount = deliveries.filter(d => ['dispatched', 'in_transit', 'pending'].includes(d.status)).length;

  return (
    <View style={styles.container}>
      {/* Live indicator */}
      <View style={styles.liveBar}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>LIVE — Auto-refreshes every 30s</Text>
        <Text style={styles.liveCount}>{activeCount} active</Text>
      </View>

      <FlatList
        data={deliveries}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListHeaderComponent={
          <Text style={styles.header}>{deliveries.length} total dispatches</Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="truck-check" size={60} color={colors.success.DEFAULT} />
            <Text style={styles.emptyText}>{loading ? 'Loading…' : 'No active deliveries'}</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  liveBar: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, paddingHorizontal: spacing.lg,
    backgroundColor: colors.success.DEFAULT + '10',
    borderBottomWidth: 1, borderBottomColor: colors.success.DEFAULT + '30',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success.DEFAULT, marginRight: spacing.sm },
  liveText: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.success.DEFAULT },
  liveCount: { fontSize: 12, fontWeight: '700', color: colors.success.DEFAULT },
  list: { padding: spacing.lg, paddingBottom: 100 },
  header: { fontSize: 13, color: colors.text.tertiary, marginBottom: spacing.md },
  card: { marginBottom: spacing.md, ...shadows.sm },
  cardDisc: { borderLeftWidth: 3, borderLeftColor: colors.danger.DEFAULT },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  info: { flex: 1, marginLeft: spacing.md },
  dispatchNum: { fontSize: 14, fontWeight: '700', color: colors.text.primary },
  route: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: colors.text.tertiary, marginLeft: 4 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: 15, color: colors.text.tertiary, marginTop: spacing.md },
});

export default LiveDeliveryScreen;
