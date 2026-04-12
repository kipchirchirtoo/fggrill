import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { systemApi } from '../../api/system.api';

const ACTION_ICONS: Record<string, { icon: string; color: string }> = {
  create: { icon: 'plus-circle', color: colors.success.DEFAULT },
  update: { icon: 'pencil-circle', color: colors.info.DEFAULT },
  delete: { icon: 'minus-circle', color: colors.danger.DEFAULT },
  login: { icon: 'login', color: colors.primary.DEFAULT },
  logout: { icon: 'logout', color: colors.text.tertiary },
  verify_otp: { icon: 'shield-check', color: colors.success.DEFAULT },
  override_otp: { icon: 'shield-alert', color: colors.warning.DEFAULT },
  dispatch: { icon: 'truck-delivery', color: colors.info.DEFAULT },
  confirm_delivery: { icon: 'check-circle', color: colors.success.DEFAULT },
};

const AuditLogScreen: React.FC = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (p = 1) => {
    if (loading) return;
    setLoading(true);
    try {
      // GET /api/audit
      const data = await systemApi.auditLogs({ page: p, limit: 30 });
      const list = Array.isArray(data) ? data : [];
      if (p === 1) {
        setEntries(list);
      } else {
        setEntries(prev => [...prev, ...list]);
      }
      setHasMore(list.length === 30);
      setPage(p);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [loading]);

  useEffect(() => { load(1); }, []);

  const renderItem = ({ item }: { item: any }) => {
    const action = item.action || item.event_type || 'update';
    const cfg = ACTION_ICONS[action] || { icon: 'information', color: colors.text.tertiary };
    const userName = item.user?.name || item.user_name || item.performed_by || '—';
    const userRole = item.user?.role || item.user_role || '';
    const entityType = item.entity_type || item.resource || '';
    const details = item.details || item.description || item.changes || '';
    const date = item.created_at || item.timestamp;

    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.row}>
            <MaterialCommunityIcons name={cfg.icon as any} size={20} color={cfg.color} />
            <View style={styles.info}>
              <Text style={styles.action}>
                {action.replace(/_/g, ' ').toUpperCase()}
                {entityType ? ` — ${entityType}` : ''}
              </Text>
              <Text style={styles.user}>
                {userName}{userRole ? ` (${userRole.replace(/_/g, ' ')})` : ''}
              </Text>
            </View>
            {date && <Text style={styles.time}>{new Date(date).toLocaleTimeString()}</Text>}
          </View>
          {details ? (
            <Text style={styles.details} numberOfLines={2}>
              {typeof details === 'object' ? JSON.stringify(details) : String(details)}
            </Text>
          ) : null}
          {date && <Text style={styles.date}>{new Date(date).toLocaleDateString()}</Text>}
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(i, idx) => i.id || String(idx)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading && page === 1} onRefresh={() => load(1)} />}
        onEndReached={() => { if (hasMore && !loading) load(page + 1); }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="file-document-outline" size={60} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>{loading ? 'Loading…' : 'No audit logs'}</Text>
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
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xs },
  info: { flex: 1, marginLeft: spacing.sm },
  action: { fontSize: 12, fontWeight: '700', color: colors.text.primary },
  user: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
  time: { fontSize: 11, color: colors.text.tertiary },
  details: { fontSize: 12, color: colors.text.tertiary, fontStyle: 'italic', marginTop: spacing.xs },
  date: { fontSize: 11, color: colors.text.tertiary, marginTop: spacing.xs },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: 15, color: colors.text.tertiary, marginTop: spacing.md },
});

export default AuditLogScreen;
