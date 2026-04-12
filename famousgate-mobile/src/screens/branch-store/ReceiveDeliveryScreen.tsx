/**
 * ReceiveDeliveryScreen
 *
 * Branch storekeeper sees all pending incoming deliveries.
 * Tapping a delivery starts the OTP verification flow.
 *
 * Flow: ReceiveDelivery → OTPEntry → CountItems → (Discrepancy)?
 *
 * API: GET /api/storekeeping/incoming-dispatches
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { dispatchApi } from '../../api/dispatch.api';

const STATUS_COLORS: Record<string, string> = {
  dispatched: colors.warning.DEFAULT,
  in_transit: colors.info.DEFAULT,
  pending: colors.warning.DEFAULT,
};

const ReceiveDeliveryScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // GET /api/storekeeping/incoming-dispatches
      const data = await dispatchApi.incoming();
      const list = Array.isArray(data) ? data : [];
      // Only show ones that haven't been confirmed yet
      setDeliveries(list.filter((d: any) => !['delivered', 'confirmed'].includes(d.status)));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }: { item: any }) => {
    const dispatchNum = item.dispatch_number || item.reference_number || item.id?.slice(0, 8);
    const fromBranch = item.from_branch?.name || item.from_branch_name || 'Central Store';
    const driver = item.driver_name || item.logistics?.driver_name || '—';
    const itemCount = item.items?.length ?? item.items_count ?? 0;
    const date = item.dispatched_at || item.created_at;
    const statusColor = STATUS_COLORS[item.status] || colors.text.tertiary;

    return (
      <Card style={styles.card}>
        <Card.Content>
          {/* Header row */}
          <View style={styles.cardHeader}>
            <View style={styles.flex}>
              <Text style={styles.dispatchNum}>{dispatchNum}</Text>
              <View style={[styles.badge, { backgroundColor: `${statusColor}18` }]}>
                <Text style={[styles.badgeText, { color: statusColor }]}>
                  {(item.status || 'pending').replace('_', ' ').toUpperCase()}
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons name="truck-delivery" size={32} color={colors.primary.DEFAULT} />
          </View>

          {/* Details */}
          {[
            { icon: 'store', text: `From: ${fromBranch}` },
            { icon: 'account', text: `Driver: ${driver}` },
            { icon: 'package-variant', text: `${itemCount} item${itemCount !== 1 ? 's' : ''}` },
            ...(date ? [{ icon: 'clock-outline', text: new Date(date).toLocaleString() }] : []),
          ].map((row, i) => (
            <View key={i} style={styles.infoRow}>
              <MaterialCommunityIcons name={row.icon as any} size={14} color={colors.text.tertiary} />
              <Text style={styles.infoText}>{row.text}</Text>
            </View>
          ))}

          {/* CTA */}
          <Button
            mode="contained"
            icon="shield-check"
            onPress={() =>
              navigation.navigate('OTPEntry', {
                dispatchId: item.id,
                dispatchNum,
              })
            }
            style={styles.receiveBtn}
          >
            Enter Delivery Code
          </Button>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={deliveries}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListHeaderComponent={
          deliveries.length > 0 ? (
            <Text style={styles.header}>
              {deliveries.length} pending {deliveries.length === 1 ? 'delivery' : 'deliveries'}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="truck-check" size={70} color={colors.success.DEFAULT} />
            <Text style={styles.emptyTitle}>{loading ? 'Loading…' : 'No Pending Deliveries'}</Text>
            <Text style={styles.emptyText}>All deliveries have been received</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: 100 },
  header: { fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.lg },
  card: { marginBottom: spacing.lg, ...shadows.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  flex: { flex: 1 },
  dispatchNum: { fontSize: 17, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.xs },
  badge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  infoText: { fontSize: 13, color: colors.text.secondary, marginLeft: spacing.sm },
  receiveBtn: { marginTop: spacing.md, backgroundColor: colors.success.DEFAULT },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl * 2 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: colors.text.primary, marginTop: spacing.lg },
  emptyText: { fontSize: 14, color: colors.text.tertiary, marginTop: spacing.sm },
});

export default ReceiveDeliveryScreen;
