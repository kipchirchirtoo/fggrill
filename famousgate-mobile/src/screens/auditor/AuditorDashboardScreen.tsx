import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DashboardHeader from '../../components/common/DashboardHeader';
import StatMetricCard from '../../components/common/StatMetricCard';
import { auditorApi } from '../../api/auditor.api';
import { colors, spacing, shadows } from '../../theme';
import { useAuthStore } from '../../stores/auth.store';

const AuditorDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total_actions: 0,
    pending_reviews: 0,
    open_watchlist: 0,
    pending_daily_logs: 0,
  });
  const [watchlist, setWatchlist] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [auditStats, approvals, watchItems, dailyLogs] = await Promise.all([
        auditorApi.stats().catch(() => ({})),
        auditorApi.pendingApprovals(user?.branch_id).catch(() => ({ items: [], summary: {} })),
        auditorApi.watchlist({ status: 'open' }).catch(() => []),
        auditorApi.dailyLogs('pending_audit').catch(() => []),
      ]);
      const auditStatsData: { totalActions?: number } = auditStats as { totalActions?: number };

      const approvalItems = Array.isArray(approvals.items) ? approvals.items : [];
      const watchListItems = Array.isArray(watchItems) ? watchItems : [];
      const dailyLogItems = Array.isArray(dailyLogs) ? dailyLogs : [];

      setStats({
        total_actions: Number(auditStatsData.totalActions || 0),
        pending_reviews: approvalItems.length,
        open_watchlist: watchListItems.length,
        pending_daily_logs: dailyLogItems.length,
      });
      setWatchlist(watchListItems.slice(0, 4));
    } finally {
      setLoading(false);
    }
  }, [user?.branch_id]);

  useEffect(() => {
    load();
  }, [load]);

  const quickActions = [
    { icon: 'clipboard-check-outline', label: 'Pending Approvals', screen: 'AuditorApprovals', color: colors.primary.DEFAULT },
    { icon: 'book-check-outline', label: 'Daily Logs', screen: 'AuditorDailyLogs', color: colors.success.DEFAULT },
    { icon: 'shield-search', label: 'Watchlist', screen: 'AuditorWatchlist', color: colors.warning.DEFAULT },
    { icon: 'file-document-outline', label: 'Audit Logs', screen: 'AuditLog', color: colors.info.DEFAULT },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={styles.scroll}
      >
        <DashboardHeader
          navigation={navigation}
          eyebrow="Auditor"
          title={`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Audit Control'}
          subtitle={user?.branch_name || 'Verification, approvals, and compliance review'}
          icon="shield-check-outline"
          accentColor={colors.warning.DEFAULT}
          badgeLabel={stats.pending_reviews > 0 ? `${stats.pending_reviews} approvals waiting` : 'Audit queue under control'}
          badgeIcon={stats.pending_reviews > 0 ? 'clock-outline' : 'check-decagram-outline'}
          badgeColor={stats.pending_reviews > 0 ? colors.warning.DEFAULT : colors.success.DEFAULT}
        />

        <View style={styles.metricsList}>
          <StatMetricCard
            icon="clipboard-check-outline"
            label="Pending Reviews"
            value={stats.pending_reviews}
            color={colors.primary.DEFAULT}
            caption="Approval requests awaiting sign-off"
            alert={stats.pending_reviews > 0}
            onPress={() => navigation.navigate('AuditorApprovals')}
          />
          <StatMetricCard
            icon="shield-search"
            label="Open Watchlist"
            value={stats.open_watchlist}
            color={stats.open_watchlist > 0 ? colors.danger.DEFAULT : colors.text.tertiary}
            caption="Flagged items under review"
            alert={stats.open_watchlist > 0}
            onPress={() => navigation.navigate('AuditorWatchlist')}
          />
          <StatMetricCard
            icon="book-check-outline"
            label="Daily Logs"
            value={stats.pending_daily_logs}
            color={colors.success.DEFAULT}
            caption="Submitted logs pending verification"
            onPress={() => navigation.navigate('AuditorDailyLogs')}
          />
          <StatMetricCard
            icon="file-document-multiple-outline"
            label="Audit Actions"
            value={stats.total_actions}
            color={colors.info.DEFAULT}
            caption="Logged audit trail events"
            onPress={() => navigation.navigate('AuditLog')}
          />
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action, index) => (
            <TouchableOpacity key={index} style={styles.actionCard} onPress={() => navigation.navigate(action.screen)}>
              <View style={[styles.actionIcon, { backgroundColor: `${action.color}18` }]}>
                <MaterialCommunityIcons name={action.icon as any} size={26} color={action.color} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Recent Watchlist</Text>
        {watchlist.length > 0 ? watchlist.map((item, index) => (
          <Card key={item.id || index} style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.warning.DEFAULT} />
                <View style={styles.info}>
                  <Text style={styles.itemTitle}>{String(item.entity_type || 'Flagged Item').replace(/_/g, ' ')}</Text>
                  <Text style={styles.itemSubtitle}>{item.reason || item.metadata?.reason || 'Requires auditor review'}</Text>
                </View>
              </View>
              <Text style={styles.itemMeta}>
                {item.status || 'open'}{item.created_at ? ` • ${new Date(item.created_at).toLocaleDateString()}` : ''}
              </Text>
            </Card.Content>
          </Card>
        )) : (
          <Card style={styles.card}>
            <Card.Content style={styles.emptyState}>
              <MaterialCommunityIcons name="shield-check" size={28} color={colors.success.DEFAULT} />
              <Text style={styles.emptyText}>No active watchlist items.</Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  metricsList: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs, marginBottom: spacing.xl },
  actionCard: { width: '31%', margin: spacing.xs, backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, alignItems: 'center', ...shadows.sm },
  actionIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  actionLabel: { fontSize: 11, fontWeight: '500', color: colors.text.secondary, textAlign: 'center' },
  card: { marginBottom: spacing.sm, ...shadows.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  info: { flex: 1, marginLeft: spacing.sm },
  itemTitle: { fontSize: 14, fontWeight: '700', color: colors.text.primary, textTransform: 'capitalize' },
  itemSubtitle: { fontSize: 12, color: colors.text.secondary, marginTop: 4 },
  itemMeta: { fontSize: 11, color: colors.text.tertiary, marginTop: spacing.sm, textTransform: 'capitalize' },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { fontSize: 14, color: colors.text.secondary, marginTop: spacing.sm },
});

export default AuditorDashboardScreen;
