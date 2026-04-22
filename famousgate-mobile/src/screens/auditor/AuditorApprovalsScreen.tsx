import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { auditorApi, AuditorApprovalItem } from '../../api/auditor.api';
import { colors, spacing, shadows } from '../../theme';
import { useAuthStore } from '../../stores/auth.store';

const AuditorApprovalsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [items, setItems] = useState<AuditorApprovalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await auditorApi.pendingApprovals(user?.branch_id);
      setItems(Array.isArray(response.items) ? response.items : []);
      setSummary(response.summary || {});
    } finally {
      setLoading(false);
    }
  }, [user?.branch_id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDecision = (item: AuditorApprovalItem, status: 'approved' | 'rejected') => {
    Alert.alert(
      status === 'approved' ? 'Approve Request' : 'Reject Request',
      `Are you sure you want to ${status === 'approved' ? 'approve' : 'reject'} this item?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: status === 'approved' ? 'Approve' : 'Reject',
          style: status === 'approved' ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setActingId(item.id);
              await auditorApi.handleApproval(
                item.id,
                status,
                status === 'approved' ? 'Approved from mobile auditor review' : 'Rejected from mobile auditor review'
              );
              await load();
            } catch (error: any) {
              Alert.alert('Action Failed', error?.response?.data?.message || error?.message || 'Unable to complete review.');
            } finally {
              setActingId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: AuditorApprovalItem }) => {
    const category = item.category || item.request_type || 'Approval';
    const metaBranch = item.metadata?.branch_name || item.branch_name || item.metadata?.branch_id;
    const canHandleDirectly = item.category === 'General Request' && Boolean(item.request_type);
    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.headerRow}>
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={22} color={colors.primary.DEFAULT} />
            </View>
            <View style={styles.info}>
              <Text style={styles.title}>{category}</Text>
              <Text style={styles.subtitle}>{item.notes || item.reason || 'Awaiting auditor sign-off'}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Status: {String(item.status || 'pending').replace(/_/g, ' ')}</Text>
            {metaBranch ? <Text style={styles.metaText}>Branch: {String(metaBranch)}</Text> : null}
            {item.created_at ? <Text style={styles.metaText}>Date: {new Date(item.created_at).toLocaleDateString()}</Text> : null}
            {!canHandleDirectly ? <Text style={styles.metaText}>Review action available on web workflow.</Text> : null}
          </View>

          {canHandleDirectly ? (
            <View style={styles.actions}>
              <Button
                mode="outlined"
                onPress={() => handleDecision(item, 'rejected')}
                disabled={actingId === item.id}
                textColor={colors.danger.DEFAULT}
                style={styles.rejectBtn}
              >
                Reject
              </Button>
              <Button
                mode="contained"
                onPress={() => handleDecision(item, 'approved')}
                loading={actingId === item.id}
                disabled={actingId === item.id}
                style={styles.approveBtn}
              >
                Approve
              </Button>
            </View>
          ) : null}
        </Card.Content>
      </Card>
    );
  };

  const summaryLabel = Object.entries(summary)
    .filter(([, value]) => Number(value) > 0)
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`)
    .join(' • ');

  return (
    <View style={styles.container}>
      {summaryLabel ? <Text style={styles.summary}>{summaryLabel}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item, index) => item.id || String(index)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="check-decagram-outline" size={56} color={colors.success.DEFAULT} />
            <Text style={styles.emptyText}>{loading ? 'Loading approvals…' : 'No pending approvals.'}</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  summary: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, fontSize: 12, color: colors.text.secondary, textTransform: 'capitalize' },
  list: { padding: spacing.lg, paddingBottom: 100 },
  card: { marginBottom: spacing.md, ...shadows.sm },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  iconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: `${colors.primary.DEFAULT}16`, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text.primary, textTransform: 'capitalize' },
  subtitle: { fontSize: 13, color: colors.text.secondary, marginTop: 4 },
  metaRow: { marginTop: spacing.md, gap: 4 },
  metaText: { fontSize: 12, color: colors.text.tertiary, textTransform: 'capitalize' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  rejectBtn: { borderColor: `${colors.danger.DEFAULT}55` },
  approveBtn: { backgroundColor: colors.primary.DEFAULT },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: 15, color: colors.text.tertiary, marginTop: spacing.md },
});

export default AuditorApprovalsScreen;
