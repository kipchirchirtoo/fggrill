import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { auditorApi } from '../../api/auditor.api';
import { colors, spacing, shadows } from '../../theme';

const ACTION_ICONS: Record<string, { icon: string; color: string }> = {
  create: { icon: 'plus-circle', color: colors.success.DEFAULT },
  update: { icon: 'pencil-circle', color: colors.info.DEFAULT },
  delete: { icon: 'delete-circle', color: colors.danger.DEFAULT },
  login: { icon: 'login', color: colors.primary.DEFAULT },
  logout: { icon: 'logout', color: colors.text.tertiary },
  verify_otp: { icon: 'shield-check', color: colors.success.DEFAULT },
  override_otp: { icon: 'shield-alert', color: colors.warning.DEFAULT },
  dispatch: { icon: 'truck-delivery', color: colors.info.DEFAULT },
  confirm_delivery: { icon: 'check-circle', color: colors.success.DEFAULT },
  audit_approved: { icon: 'check-decagram', color: colors.success.DEFAULT },
  audit_rejected: { icon: 'close-octagon', color: colors.danger.DEFAULT },
};

const AuditorAuditLogScreen: React.FC = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (nextPage = 1, replace = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const data = await auditorApi.logs({ page: nextPage, limit: 30 });
      const list = Array.isArray(data) ? data : [];
      setEntries((prev) => (replace ? list : [...prev, ...list]));
      setHasMore(list.length === 30);
      setPage(nextPage);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    load(1, true);
  }, [load]);

  const renderItem = ({ item }: { item: any }) => {
    const actionKey = String(item.action || 'update').toLowerCase();
    const actionConfig = ACTION_ICONS[actionKey] || { icon: 'file-document-outline', color: colors.info.DEFAULT };
    const entityLabel = item.table_name || item.entity_type || item.resource || 'system';
    const userName = [item.user?.first_name, item.user?.last_name].filter(Boolean).join(' ').trim() || item.user?.email || item.user_name || item.performed_by || 'Unknown user';
    const roleLabel = item.user?.role ? String(item.user.role).replace(/_/g, ' ') : '';
    const detailParts = [
      item.record_id ? `Record: ${item.record_id}` : '',
      item.ip_address ? `IP: ${item.ip_address}` : '',
      item.user_agent ? String(item.user_agent) : '',
    ].filter(Boolean);
    const changes = item.new_values || item.old_values || item.details || item.description || null;

    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: `${actionConfig.color}18` }]}>
              <MaterialCommunityIcons name={actionConfig.icon as any} size={20} color={actionConfig.color} />
            </View>
            <View style={styles.info}>
              <Text style={styles.actionText}>{actionKey.replace(/_/g, ' ')}</Text>
              <Text style={styles.entityText}>{entityLabel.replace(/_/g, ' ')}</Text>
              <Text style={styles.userText}>
                {userName}{roleLabel ? ` (${roleLabel})` : ''}
              </Text>
            </View>
            <Text style={styles.timeText}>{item.created_at ? new Date(item.created_at).toLocaleTimeString() : ''}</Text>
          </View>
          {detailParts.length > 0 ? <Text style={styles.metaText}>{detailParts.join(' • ')}</Text> : null}
          {changes ? (
            <Text style={styles.changeText} numberOfLines={3}>
              {typeof changes === 'object' ? JSON.stringify(changes) : String(changes)}
            </Text>
          ) : null}
          {item.created_at ? <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text> : null}
        </Card.Content>
      </Card>
    );
  };

  const emptyMessage = useMemo(() => (loading ? 'Loading audit logs…' : 'No audit activity found for this auditor view.'), [loading]);

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(item, index) => item.id || `${item.created_at || 'entry'}-${index}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading && page === 1} onRefresh={() => load(1, true)} />}
        onEndReached={() => {
          if (hasMore && !loading) {
            load(page + 1, false);
          }
        }}
        onEndReachedThreshold={0.25}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="file-document-outline" size={56} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: 100 },
  card: { marginBottom: spacing.sm, ...shadows.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  info: { flex: 1 },
  actionText: { fontSize: 14, fontWeight: '700', color: colors.text.primary, textTransform: 'capitalize' },
  entityText: { fontSize: 12, color: colors.info.DEFAULT, marginTop: 2, textTransform: 'capitalize' },
  userText: { fontSize: 12, color: colors.text.secondary, marginTop: 4 },
  timeText: { fontSize: 11, color: colors.text.tertiary },
  metaText: { fontSize: 11, color: colors.text.tertiary, marginTop: spacing.sm },
  changeText: { fontSize: 12, color: colors.text.secondary, marginTop: spacing.sm },
  dateText: { fontSize: 11, color: colors.text.tertiary, marginTop: spacing.sm },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: 14, color: colors.text.tertiary, marginTop: spacing.md, textAlign: 'center' },
});

export default AuditorAuditLogScreen;
