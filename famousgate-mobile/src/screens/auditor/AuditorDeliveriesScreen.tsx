/**
 * AuditorDeliveriesScreen
 *
 * Auditor view of all deliveries requiring review.
 * Shows completed deliveries with uploaded documents.
 * Allows filtering by status, branch, and date range.
 *
 * Flow: AuditorDeliveries → AuditorDeliveryDetail (review/approve/flag)
 *
 * API: GET /api/auditor/deliveries
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Button, Chip, Searchbar, Menu } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { dispatchApi } from '../../api/dispatch.api';

interface Props {
  navigation: any;
}

const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  completed: { color: colors.success.DEFAULT, icon: 'check-circle', label: 'Completed' },
  audited: { color: colors.info.DEFAULT, icon: 'shield-check', label: 'Audited' },
  flagged: { color: colors.danger.DEFAULT, icon: 'flag', label: 'Flagged' },
  in_transit: { color: colors.warning.DEFAULT, icon: 'truck-delivery', label: 'In Transit' },
};

const AuditorDeliveriesScreen: React.FC<Props> = ({ navigation }) => {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [filteredDeliveries, setFilteredDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [menuVisible, setMenuVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dispatchApi.getAuditorDeliveries();
      const list = Array.isArray(data) ? data : [];
      setDeliveries(list);
      applyFilters(list, statusFilter, searchQuery);
    } catch (e) {
      console.error('Failed to load deliveries:', e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    load();
  }, [load]);

  const applyFilters = (list: any[], status: string, query: string) => {
    let filtered = list;

    // Status filter
    if (status !== 'all') {
      filtered = filtered.filter((d) => d.status === status);
    }

    // Search filter
    if (query) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.dispatch_number?.toLowerCase().includes(lowerQuery) ||
          d.destination_branch?.toLowerCase().includes(lowerQuery) ||
          d.driver_name?.toLowerCase().includes(lowerQuery)
      );
    }

    setFilteredDeliveries(filtered);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setMenuVisible(false);
    applyFilters(deliveries, status, searchQuery);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    applyFilters(deliveries, statusFilter, query);
  };

  const renderItem = ({ item }: { item: any }) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.completed;
    const dispatchNum = item.dispatch_number || item.id?.slice(0, 8);
    const branch = item.destination_branch || '—';
    const driver = item.driver_name || '—';
    const itemCount = item.items?.length ?? item.items_count ?? 0;
    const docCount = item.documents_count ?? 0;
    const date = item.completed_at || item.created_at;

    return (
      <Card
        style={styles.card}
        onPress={() =>
          navigation.navigate('AuditorDeliveryDetail', {
            dispatchId: item.id,
            dispatchNum,
          })
        }
      >
        <Card.Content>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={styles.flex}>
              <Text style={styles.dispatchNum}>{dispatchNum}</Text>
              <Chip
                icon={statusConfig.icon}
                style={[styles.statusChip, { backgroundColor: statusConfig.color + '20' }]}
                textStyle={[styles.statusText, { color: statusConfig.color }]}
              >
                {statusConfig.label}
              </Chip>
            </View>
            <MaterialCommunityIcons
              name={statusConfig.icon as any}
              size={32}
              color={statusConfig.color}
            />
          </View>

          {/* Details */}
          <View style={styles.detailsGrid}>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="store" size={16} color={colors.text.tertiary} />
              <Text style={styles.detailText}>Branch: {branch}</Text>
            </View>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="account" size={16} color={colors.text.tertiary} />
              <Text style={styles.detailText}>Driver: {driver}</Text>
            </View>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="package-variant" size={16} color={colors.text.tertiary} />
              <Text style={styles.detailText}>
                {itemCount} item{itemCount !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="file-document" size={16} color={colors.text.tertiary} />
              <Text style={styles.detailText}>
                {docCount} document{docCount !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {date && (
            <View style={styles.dateRow}>
              <MaterialCommunityIcons name="clock-outline" size={14} color={colors.text.tertiary} />
              <Text style={styles.dateText}>{new Date(date).toLocaleString()}</Text>
            </View>
          )}

          {/* Action Button */}
          <Button
            mode="outlined"
            icon="eye"
            onPress={() =>
              navigation.navigate('AuditorDeliveryDetail', {
                dispatchId: item.id,
                dispatchNum,
              })
            }
            style={styles.reviewBtn}
            compact
          >
            Review Delivery
          </Button>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search and Filter */}
      <View style={styles.filterBar}>
        <Searchbar
          placeholder="Search deliveries..."
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchBar}
        />
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              icon="filter-variant"
              onPress={() => setMenuVisible(true)}
              style={styles.filterBtn}
            >
              {statusFilter === 'all' ? 'All' : STATUS_CONFIG[statusFilter]?.label || statusFilter}
            </Button>
          }
        >
          <Menu.Item onPress={() => handleStatusFilter('all')} title="All Deliveries" />
          <Menu.Item onPress={() => handleStatusFilter('completed')} title="Completed" />
          <Menu.Item onPress={() => handleStatusFilter('audited')} title="Audited" />
          <Menu.Item onPress={() => handleStatusFilter('flagged')} title="Flagged" />
        </Menu>
      </View>

      {/* Deliveries List */}
      <FlatList
        data={filteredDeliveries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListHeaderComponent={
          filteredDeliveries.length > 0 ? (
            <Text style={styles.header}>
              {filteredDeliveries.length} {statusFilter !== 'all' ? statusFilter : ''} deliver
              {filteredDeliveries.length === 1 ? 'y' : 'ies'}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="clipboard-check-outline"
              size={70}
              color={colors.text.tertiary}
            />
            <Text style={styles.emptyTitle}>
              {loading ? 'Loading…' : 'No Deliveries Found'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'All deliveries have been reviewed'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filterBar: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: { flex: 1 },
  filterBtn: { minWidth: 100 },
  list: { padding: 16, paddingBottom: 100 },
  header: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 16,
  },
  card: { marginBottom: 16, ...shadows.md },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  flex: { flex: 1 },
  dispatchNum: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 6,
  },
  statusChip: {
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  detailsGrid: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 13,
    color: colors.text.secondary,
    marginLeft: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateText: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginLeft: 6,
  },
  reviewBtn: {
    marginTop: 4,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default AuditorDeliveriesScreen;
