import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { auditorApi } from '../../api/auditor.api';
import { colors, spacing, shadows } from '../../theme';

const AuditorWatchlistScreen: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await auditorApi.watchlist({ status: 'open' });
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleResolve = (item: any, status: 'resolved' | 'dismissed') => {
    Alert.alert(
      status === 'resolved' ? 'Resolve Watchlist Item' : 'Dismiss Watchlist Item',
      `Do you want to mark this item as ${status}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: status === 'resolved' ? 'Resolve' : 'Dismiss',
          style: status === 'resolved' ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setActingId(item.id);
              await auditorApi.resolveWatchlistItem(item.id, {
                status,
                resolution_notes: `${status} from mobile auditor review`,
              });
              await load();
            } catch (error: any) {
              Alert.alert('Action Failed', error?.response?.data?.message || error?.message || 'Unable to update watchlist item.');
            } finally {
              setActingId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name="shield-alert-outline" size={22} color={colors.warning.DEFAULT} />
          </View>
          <View style={styles.info}>
            <Text style={styles.title}>{String(item.entity_type || 'Flagged item').replace(/_/g, ' ')}</Text>
            <Text style={styles.subtitle}>{item.reason || item.metadata?.reason || 'Flagged for auditor review'}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Status: {String(item.status || 'open').replace(/_/g, ' ')}</Text>
          {item.flagged_by_user ? <Text style={styles.metaText}>By: {`${item.flagged_by_user.first_name || ''} ${item.flagged_by_user.last_name || ''}`.trim()}</Text> : null}
          {item.created_at ? <Text style={styles.metaText}>Date: {new Date(item.created_at).toLocaleDateString()}</Text> : null}
        </View>

        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={() => handleResolve(item, 'dismissed')}
            disabled={actingId === item.id}
            textColor={colors.text.secondary}
          >
            Dismiss
          </Button>
          <Button
            mode="contained"
            onPress={() => handleResolve(item, 'resolved')}
            loading={actingId === item.id}
            disabled={actingId === item.id}
            style={styles.resolveBtn}
          >
            Resolve
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item, index) => item.id || String(index)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="shield-check-outline" size={56} color={colors.success.DEFAULT} />
            <Text style={styles.emptyText}>{loading ? 'Loading watchlist…' : 'No open watchlist items.'}</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: 100 },
  card: { marginBottom: spacing.md, ...shadows.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  iconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: `${colors.warning.DEFAULT}16`, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text.primary, textTransform: 'capitalize' },
  subtitle: { fontSize: 13, color: colors.text.secondary, marginTop: 4 },
  metaRow: { marginTop: spacing.md, gap: 4 },
  metaText: { fontSize: 12, color: colors.text.tertiary, textTransform: 'capitalize' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  resolveBtn: { backgroundColor: colors.warning.DEFAULT },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: 15, color: colors.text.tertiary, marginTop: spacing.md },
});

export default AuditorWatchlistScreen;
