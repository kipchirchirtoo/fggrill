/**
 * RequisitionsScreen - Central Store
 * 
 * View and manage branch stock requisitions
 * Matches web app: /dashboard/central-store/requests
 * 
 * Workflow:
 * - Branch creates requisition
 * - Auditor reviews and approves/rejects
 * - Central Store views approved requests
 * - Central Store proceeds to packing station
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Text, Card, Badge, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { useAuthStore } from '../../stores/auth.store';
import { dispatchApi } from '../../api/dispatch.api';

interface RequestItem {
  id: string;
  item_sku: string;
  item_name: string;
  requested_quantity: number;
  approved_quantity?: number;
  unit: string;
}

interface StockRequest {
  id: string;
  request_number: string;
  branch_name: string;
  status: string;
  priority: string;
  created_at: string;
  items: RequestItem[];
  review_notes?: string;
}

interface Props {
  navigation: any;
}

const RequisitionsScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await dispatchApi.getStockRequests({
        status: statusFilter === 'ALL' ? undefined : statusFilter as any
      });
      
      if (response.success) {
        let data = response.data || [];
        
        // Filter based on selected tab
        if (statusFilter === 'ALL') {
          // Show active requests (not delivered/rejected/cancelled)
          data = data.filter((r: StockRequest) => 
            !['DELIVERED', 'REJECTED', 'CANCELLED'].includes(r.status)
          );
        }
        
        // Sort by created date (newest first)
        data.sort((a: StockRequest, b: StockRequest) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        setRequests(data);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      Alert.alert('Error', 'Failed to load requisitions');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return colors.warning.DEFAULT;
      case 'UNDER_REVIEW': return colors.info.DEFAULT;
      case 'APPROVED': return colors.success.DEFAULT;
      case 'PARTIALLY_APPROVED': return colors.success.DEFAULT;
      case 'REJECTED': return colors.danger.DEFAULT;
      case 'DISPATCHED': return colors.info.DEFAULT;
      case 'DELIVERED': return colors.text.tertiary;
      default: return colors.text.tertiary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return 'clock-outline';
      case 'APPROVED': return 'check-circle';
      case 'DISPATCHED': return 'truck-delivery';
      case 'REJECTED': return 'close-circle';
      default: return 'clipboard-list';
    }
  };

  const handleGoToPacking = (request: StockRequest) => {
    navigation.navigate('PackingStation', { requestId: request.id });
  };

  const stats = {
    pending: requests.filter(r => r.status === 'PENDING').length,
    approved: requests.filter(r => r.status === 'APPROVED').length,
    dispatched: requests.filter(r => r.status === 'DISPATCHED').length,
    total: requests.length,
  };

  const filters = ['ALL', 'PENDING', 'APPROVED', 'DISPATCHED'];

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchRequests} />}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Branch Requisitions</Text>
            <Text style={styles.subtitle}>Monitor stock requests from all branches</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.warning.DEFAULT + '15' }]}>
            <MaterialCommunityIcons name="clock-outline" size={24} color={colors.warning.DEFAULT} />
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.success.DEFAULT + '15' }]}>
            <MaterialCommunityIcons name="check-circle" size={24} color={colors.success.DEFAULT} />
            <Text style={styles.statValue}>{stats.approved}</Text>
            <Text style={styles.statLabel}>Approved</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.info.DEFAULT + '15' }]}>
            <MaterialCommunityIcons name="truck-delivery" size={24} color={colors.info.DEFAULT} />
            <Text style={styles.statValue}>{stats.dispatched}</Text>
            <Text style={styles.statLabel}>In Transit</Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterTab,
                statusFilter === filter && styles.filterTabActive,
              ]}
              onPress={() => setStatusFilter(filter)}
            >
              <Text
                style={[
                  styles.filterText,
                  statusFilter === filter && styles.filterTextActive,
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Requests List */}
        {loading && requests.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="loading" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>Loading requisitions...</Text>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="clipboard-list" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No requisitions found</Text>
            <Text style={styles.emptySubtext}>
              {statusFilter === 'ALL' 
                ? 'No active requisitions at the moment'
                : `No ${statusFilter.toLowerCase()} requisitions`}
            </Text>
          </View>
        ) : (
          <View style={styles.requestsList}>
            {requests.map((request) => (
              <TouchableOpacity
                key={request.id}
                onPress={() => setSelectedRequest(request)}
              >
                <Card style={styles.requestCard}>
                  <Card.Content>
                    <View style={styles.requestHeader}>
                      <View style={styles.requestInfo}>
                        <Text style={styles.requestNumber}>{request.request_number}</Text>
                        <Text style={styles.branchName}>{request.branch_name}</Text>
                        <Text style={styles.requestDate}>
                          {new Date(request.created_at).toLocaleDateString()} at{' '}
                          {new Date(request.created_at).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </Text>
                      </View>
                      <View style={styles.requestMeta}>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) + '20' }]}>
                          <MaterialCommunityIcons 
                            name={getStatusIcon(request.status) as any} 
                            size={14} 
                            color={getStatusColor(request.status)} 
                          />
                          <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                            {request.status}
                          </Text>
                        </View>
                        {request.priority === 'URGENT' && (
                          <Badge style={styles.urgentBadge}>URGENT</Badge>
                        )}
                      </View>
                    </View>

                    <View style={styles.requestFooter}>
                      <View style={styles.itemCount}>
                        <MaterialCommunityIcons name="package-variant" size={16} color={colors.text.secondary} />
                        <Text style={styles.itemCountText}>{request.items?.length || 0} items</Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.text.tertiary} />
                    </View>
                  </Card.Content>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Detail Modal */}
      {selectedRequest && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Request Details</Text>
                <Text style={styles.modalSubtitle}>{selectedRequest.request_number}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedRequest(null)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Request Info */}
              <View style={styles.infoSection}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Branch</Text>
                  <Text style={styles.infoValue}>{selectedRequest.branch_name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Status</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedRequest.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(selectedRequest.status) }]}>
                      {selectedRequest.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Created</Text>
                  <Text style={styles.infoValue}>
                    {new Date(selectedRequest.created_at).toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Review Notes */}
              {selectedRequest.review_notes && (
                <View style={styles.notesSection}>
                  <Text style={styles.notesLabel}>Auditor's Notes</Text>
                  <Text style={styles.notesText}>"{selectedRequest.review_notes}"</Text>
                </View>
              )}

              {/* Items List */}
              <View style={styles.itemsSection}>
                <Text style={styles.itemsTitle}>Requested Items</Text>
                {selectedRequest.items.map((item, index) => (
                  <View key={index} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.item_name}</Text>
                      <Text style={styles.itemSku}>{item.item_sku}</Text>
                    </View>
                    <View style={styles.itemQuantity}>
                      <Text style={styles.quantityLabel}>Requested</Text>
                      <Text style={styles.quantityValue}>
                        {item.requested_quantity} {item.unit}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActions}>
              {selectedRequest.status === 'APPROVED' && (
                <Button
                  mode="contained"
                  onPress={() => {
                    setSelectedRequest(null);
                    handleGoToPacking(selectedRequest);
                  }}
                  style={styles.actionButton}
                  buttonColor={colors.success.DEFAULT}
                  icon="package-variant-closed"
                >
                  Go to Packing
                </Button>
              )}
              {selectedRequest.status === 'PENDING' && user?.role === 'auditor' && (
                <Text style={styles.pendingNote}>
                  Auditor approval required before packing
                </Text>
              )}
              <Button
                mode="outlined"
                onPress={() => setSelectedRequest(null)}
                style={styles.closeButton}
              >
                Close
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.DEFAULT,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    ...shadows.sm,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
  },
  filterContainer: {
    marginBottom: spacing.lg,
  },
  filterTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.card,
  },
  filterTabActive: {
    backgroundColor: colors.primary.DEFAULT,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  filterTextActive: {
    color: colors.primary.foreground,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  requestsList: {
    gap: spacing.md,
  },
  requestCard: {
    backgroundColor: colors.card,
    ...shadows.sm,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  requestInfo: {
    flex: 1,
  },
  requestNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  branchName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 2,
  },
  requestDate: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  requestMeta: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  urgentBadge: {
    backgroundColor: colors.danger.DEFAULT,
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  itemCountText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  modalBody: {
    padding: spacing.lg,
  },
  infoSection: {
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  infoValue: {
    fontSize: 14,
    color: colors.text.primary,
  },
  notesSection: {
    backgroundColor: colors.warning.DEFAULT + '10',
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.lg,
  },
  notesLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.warning.DEFAULT,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  notesText: {
    fontSize: 13,
    color: colors.text.primary,
    fontStyle: 'italic',
  },
  itemsSection: {
    marginBottom: spacing.lg,
  },
  itemsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  itemSku: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  itemQuantity: {
    alignItems: 'flex-end',
  },
  quantityLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
  },
  quantityValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: 'monospace',
  },
  modalActions: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  actionButton: {
    borderRadius: 8,
  },
  closeButton: {
    borderRadius: 8,
  },
  pendingNote: {
    fontSize: 12,
    color: colors.warning.DEFAULT,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default RequisitionsScreen;
