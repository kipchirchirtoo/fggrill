/**
 * DiscrepancyAlertsScreen — Superadmin
 *
 * Shows all deliveries that have discrepancies reported by branch storekeepers.
 * Superadmin can mark them as resolved.
 *
 * API: GET /api/storekeeping/dispatch-notes (filter status === 'discrepancy')
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { dispatchApi } from '../../api/dispatch.api';
import apiClient from '../../api/client';

const DiscrepancyAlertsScreen: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dispatchApi.list();
      const list = Array.isArray(data) ? data : [];
      // Filter to discrepancy status
      setAlerts(list.filter((d: any) => d.status === 'discrepancy'));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markResolved = async (dispatch: any) => {
    Alert.alert(
      'Mark as Resolved',
      `Mark discrepancy for dispatch ${dispatch.dispatch_number || dispatch.id?.slice(0, 8)} as resolved?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: async () => {
            try {
              // Update dispatch status via logistics update
              await apiClient.put(`/storekeeping/dispatch-notes/${dispatch.id}/logistics`, {
                status: 'delivered',
                resolution_note: 'Discrepancy resolved by superadmin',
              });
              setAlerts(prev => prev.filter(a => a.id !== dispatch.id));
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.message || 'Failed to resolve');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const dispatchNum = item.dispatch_number || item.reference_number || item.id?.slice(0, 8);
    const toBranch = item.to_branch?.name || item.to_branch_name || '—';
    const driver = item.driver_name || item.logistics?.driver_name || '—';
    const date = item.dispatched_at || item.created_at;
    const discNote = item.discrepancy_note || item.notes || 'No details provided';

    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.row}>
            <MaterialCommunityIcons name="alert-circle" size={26} color={colors.warning.DEFAULT} />
            <View style={styles.info}>
              <Text style={styles.dispatchNum}>{dispatchNum}</Text>
              <Text style={styles.branch}>{toBranch}</Text>
            </View>
            <Button
              mode="contained"
              compact
              onPress={() => markResolved(item)}
              style={styles.resolveBtn}
              labelStyle={{ fontSize: 11 }}
            >
              Resolve
            </Button>
          </View>

          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Discrepancy Note:</Text>
            <Text style={styles.noteText}>{discNote}</Text>
          </View>

          <View style={styles.meta}>
            <MaterialCommunityIcons name="account" size={13} color={colors.text.tertiary} />
            <Text style={styles.metaText}>{driver}</Text>
            {date && (
              <>
                <MaterialCommunityIcons name="clock-outline" size={13} color={colors.text.tertiary} style={{ marginLeft: spacing.md }} />
                <Text style={styles.metaText}>{new Date(date).toLocaleDateString()}</Text>
              </>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={alerts}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListHeaderComponent={
          <Text style={styles.header}>
            {alerts.length} unresolved {alerts.length === 1 ? 'discrepancy' : 'discrepancies'}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="check-all" size={60} color={colors.success.DEFAULT} />
            <Text style={styles.emptyTitle}>{loading ? 'Loading…' : 'No Discrepancies'}</Text>
            <Text style={styles.emptyText}>All deliveries are confirmed without issues</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: 100 },
  header: { fontSize: 13, color: colors.text.tertiary, marginBottom: spacing.md },
  card: { marginBottom: spacing.md, ...shadows.sm, borderLeftWidth: 4, borderLeftColor: colors.warning.DEFAULT },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  info: { flex: 1, marginLeft: spacing.md },
  dispatchNum: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
  branch: { fontSize: 13, color: colors.text.tertiary, marginTop: 2 },
  resolveBtn: { backgroundColor: colors.success.DEFAULT },
  noteBox: { backgroundColor: colors.warning.DEFAULT + '10', padding: spacing.md, borderRadius: 8, marginBottom: spacing.md },
  noteLabel: { fontSize: 11, fontWeight: '700', color: colors.warning.DEFAULT, marginBottom: 4 },
  noteText: { fontSize: 13, color: colors.text.secondary, lineHeight: 18 },
  meta: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 12, color: colors.text.tertiary, marginLeft: 4 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text.primary, marginTop: spacing.lg },
  emptyText: { fontSize: 14, color: colors.text.tertiary, marginTop: spacing.sm },
});

export default DiscrepancyAlertsScreen;
