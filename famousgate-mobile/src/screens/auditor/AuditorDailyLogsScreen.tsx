import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { auditorApi } from '../../api/auditor.api';
import { colors, spacing, shadows } from '../../theme';

const AuditorDailyLogsScreen: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await auditorApi.dailyLogs('pending_audit');
      setLogs(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDecision = (log: any, action: 'verified' | 'rejected') => {
    Alert.alert(
      action === 'verified' ? 'Verify Daily Log' : 'Reject Daily Log',
      `Do you want to mark this daily log as ${action}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'verified' ? 'Verify' : 'Reject',
          style: action === 'verified' ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setActingId(log.id);
              await auditorApi.verifyDailyLog(log.id, action, action === 'verified' ? 'Verified from mobile auditor review' : 'Rejected from mobile auditor review');
              await load();
            } catch (error: any) {
              Alert.alert('Action Failed', error?.response?.data?.message || error?.message || 'Unable to update daily log.');
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
            <MaterialCommunityIcons name="book-check-outline" size={22} color={colors.success.DEFAULT} />
          </View>
          <View style={styles.info}>
            <Text style={styles.title}>{item.branch_name || 'Unknown Branch'}</Text>
            <Text style={styles.subtitle}>{item.log_date ? new Date(item.log_date).toLocaleDateString() : 'No log date'}</Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <Text style={styles.metric}>Opening: {Number(item.opening_balance || 0).toLocaleString()}</Text>
          <Text style={styles.metric}>Closing: {Number(item.closing_balance || 0).toLocaleString()}</Text>
          <Text style={styles.metric}>Payments: {Number(item.total_payments || 0).toLocaleString()}</Text>
          <Text style={styles.metric}>Expenses: {Number(item.total_expenses || 0).toLocaleString()}</Text>
        </View>

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
            onPress={() => handleDecision(item, 'verified')}
            loading={actingId === item.id}
            disabled={actingId === item.id}
            style={styles.approveBtn}
          >
            Verify
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={logs}
        keyExtractor={(item, index) => item.id || String(index)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="book-check" size={56} color={colors.success.DEFAULT} />
            <Text style={styles.emptyText}>{loading ? 'Loading daily logs…' : 'No daily logs pending verification.'}</Text>
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
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: `${colors.success.DEFAULT}16`, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
  subtitle: { fontSize: 13, color: colors.text.secondary, marginTop: 4 },
  metricsRow: { marginTop: spacing.md, gap: 4 },
  metric: { fontSize: 12, color: colors.text.tertiary },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
  rejectBtn: { borderColor: `${colors.danger.DEFAULT}55` },
  approveBtn: { backgroundColor: colors.success.DEFAULT },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: 15, color: colors.text.tertiary, marginTop: spacing.md, textAlign: 'center' },
});

export default AuditorDailyLogsScreen;
