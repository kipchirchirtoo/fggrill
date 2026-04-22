/**
 * PackingStationScreen - Central Store
 * 
 * Pack approved requisitions before dispatch
 * Matches web app: /dashboard/central-store/packing
 * 
 * Workflow:
 * - Shows only APPROVED requests
 * - Select request to pack
 * - Scan/verify items
 * - Create dispatch note
 * - Redirect to Dispatch Management
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
import { Text, Card, Button, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { dispatchApi } from '../../api/dispatch.api';

interface RequestItem {
  id: string;
  item_sku: string;
  item_name: string;
  requested_quantity: number;
  approved_quantity: number;
  unit: string;
  packed?: boolean;
}

interface StockRequest {
  id: string;
  request_number: string;
  branch_name: string;
  branch_id: string;
  status: string;
  created_at: string;
  items: RequestItem[];
}

interface Props {
  navigation: any;
  route?: any;
}

const PackingStationScreen: React.FC<Props> = ({ navigation, route }) => {
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
  const [packingItems, setPackingItems] = useState<RequestItem[]>([]);
  const [isCreatingDispatch, setIsCreatingDispatch] = useState(false);

  const fetchApprovedRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await dispatchApi.getStockRequests({ status: 'APPROVED' });
      
      if (response.success) {
        setRequests(response.data || []);
        
        // If coming from Requisitions screen with requestId
        if (route?.params?.requestId) {
          const request = (response.data || []).find(
            (r: StockRequest) => r.id === route.params.requestId
          );
          if (request) {
            handleSelectRequest(request);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching approved requests:', error);
      Alert.alert('Error', 'Failed to load approved requests');
    } finally {
      setLoading(false);
    }
  }, [route?.params?.requestId]);

  useEffect(() => {
    fetchApprovedRequests();
  }, [fetchApprovedRequests]);

  const handleSelectRequest = (request: StockRequest) => {
    setSelectedRequest(request);
    // Initialize packing items with approved quantities
    setPackingItems(
      request.items.map(item => ({
        ...item,
        packed: false,
      }))
    );
  };

  const toggleItemPacked = (index: number) => {
    const newItems = [...packingItems];
    newItems[index].packed = !newItems[index].packed;
    setPackingItems(newItems);
  };

  const handleCreateDispatch = async () => {
    if (!selectedRequest) return;

    // Check if all items are packed
    const allPacked = packingItems.every(item => item.packed);
    if (!allPacked) {
      Alert.alert(
        'Incomplete Packing',
        'Not all items are marked as packed. Continue anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => createDispatch() },
        ]
      );
      return;
    }

    createDispatch();
  };

  const createDispatch = async () => {
    if (!selectedRequest) return;

    setIsCreatingDispatch(true);
    try {
      // Create dispatch from approved request
      const response = await dispatchApi.createDispatch({
        request_id: selectedRequest.id,
        to_branch_id: selectedRequest.branch_id,
        items: packingItems.map(item => ({
          item_sku: item.item_sku,
          quantity: item.approved_quantity,
        })),
      });

      if (response.success) {
        Alert.alert(
          'Success',
          'Dispatch note created successfully',
          [
            {
              text: 'OK',
              onPress: () => {
                setSelectedRequest(null);
                setPackingItems([]);
                navigation.navigate('DispatchManagement');
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to create dispatch');
      }
    } catch (error: any) {
      console.error('Error creating dispatch:', error);
      Alert.alert('Error', error.message || 'Failed to create dispatch');
    } finally {
      setIsCreatingDispatch(false);
    }
  };

  const packedCount = packingItems.filter(item => item.packed).length;
  const totalItems = packingItems.length;

  return (
    <View style={styles.container}>
      {!selectedRequest ? (
        // Request Selection View
        <ScrollView
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchApprovedRequests} />}
          contentContainerStyle={styles.content}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Packing Station</Text>
              <Text style={styles.subtitle}>Pack approved requisitions for dispatch</Text>
            </View>
          </View>

          {loading && requests.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="loading" size={48} color={colors.text.tertiary} />
              <Text style={styles.emptyText}>Loading approved requests...</Text>
            </View>
          ) : requests.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="package-variant-closed" size={64} color={colors.text.tertiary} />
              <Text style={styles.emptyText}>No Approved Requests</Text>
              <Text style={styles.emptySubtext}>
                All approved requests have been packed or there are no pending approvals
              </Text>
            </View>
          ) : (
            <View style={styles.requestsList}>
              {requests.map((request) => (
                <TouchableOpacity
                  key={request.id}
                  onPress={() => handleSelectRequest(request)}
                >
                  <Card style={styles.requestCard}>
                    <Card.Content>
                      <View style={styles.cardHeader}>
                        <View style={styles.iconContainer}>
                          <MaterialCommunityIcons 
                            name="package-variant-closed" 
                            size={32} 
                            color={colors.success.DEFAULT} 
                          />
                        </View>
                        <View style={styles.requestInfo}>
                          <Text style={styles.requestNumber}>{request.request_number}</Text>
                          <Text style={styles.branchName}>{request.branch_name}</Text>
                          <View style={styles.itemCount}>
                            <MaterialCommunityIcons name="package-variant" size={14} color={colors.text.secondary} />
                            <Text style={styles.itemCountText}>{request.items?.length || 0} items to pack</Text>
                          </View>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.text.tertiary} />
                      </View>
                    </Card.Content>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        // Packing View
        <View style={styles.packingContainer}>
          {/* Header */}
          <View style={styles.packingHeader}>
            <TouchableOpacity
              onPress={() => {
                setSelectedRequest(null);
                setPackingItems([]);
              }}
              style={styles.backButton}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.packingHeaderInfo}>
              <Text style={styles.packingTitle}>{selectedRequest.request_number}</Text>
              <Text style={styles.packingSubtitle}>{selectedRequest.branch_name}</Text>
            </View>
          </View>

          {/* Progress */}
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${(packedCount / totalItems) * 100}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {packedCount} of {totalItems} items packed
            </Text>
          </View>

          {/* Items List */}
          <ScrollView style={styles.itemsList}>
            {packingItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => toggleItemPacked(index)}
                style={[
                  styles.packingItem,
                  item.packed && styles.packingItemPacked,
                ]}
              >
                <View style={styles.packingItemLeft}>
                  <View style={[
                    styles.checkbox,
                    item.packed && styles.checkboxChecked,
                  ]}>
                    {item.packed && (
                      <MaterialCommunityIcons name="check" size={18} color={colors.success.foreground} />
                    )}
                  </View>
                  <View style={styles.itemDetails}>
                    <Text style={[
                      styles.itemName,
                      item.packed && styles.itemNamePacked,
                    ]}>
                      {item.item_name}
                    </Text>
                    <Text style={styles.itemSku}>{item.item_sku}</Text>
                  </View>
                </View>
                <View style={styles.packingItemRight}>
                  <Text style={styles.quantityLabel}>Qty</Text>
                  <Text style={styles.quantityValue}>
                    {item.approved_quantity} {item.unit}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Actions */}
          <View style={styles.packingActions}>
            <Button
              mode="contained"
              onPress={handleCreateDispatch}
              loading={isCreatingDispatch}
              disabled={isCreatingDispatch || packedCount === 0}
              style={styles.createDispatchButton}
              buttonColor={colors.success.DEFAULT}
              icon="truck-fast"
            >
              Create Dispatch Note
            </Button>
            <Text style={styles.actionHint}>
              {packedCount === 0 
                ? 'Mark items as packed to continue'
                : packedCount < totalItems
                ? `${totalItems - packedCount} items remaining`
                : 'All items packed! Ready to dispatch'}
            </Text>
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
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  requestsList: {
    gap: spacing.md,
  },
  requestCard: {
    backgroundColor: colors.card,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.success.DEFAULT + '15',
    justifyContent: 'center',
    alignItems: 'center',
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
  itemCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  itemCountText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  packingContainer: {
    flex: 1,
  },
  packingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.sm,
  },
  backButton: {
    marginRight: spacing.md,
  },
  packingHeaderInfo: {
    flex: 1,
  },
  packingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  packingSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  progressSection: {
    padding: spacing.lg,
    backgroundColor: colors.card,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success.DEFAULT,
  },
  progressText: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  itemsList: {
    flex: 1,
    padding: spacing.lg,
  },
  packingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.sm,
  },
  packingItemPacked: {
    backgroundColor: colors.success.DEFAULT + '10',
    borderColor: colors.success.DEFAULT,
  },
  packingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.success.DEFAULT,
    borderColor: colors.success.DEFAULT,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  itemNamePacked: {
    color: colors.success.DEFAULT,
  },
  itemSku: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  packingItemRight: {
    alignItems: 'flex-end',
  },
  quantityLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
  },
  quantityValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: 'monospace',
  },
  packingActions: {
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.lg,
  },
  createDispatchButton: {
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  actionHint: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default PackingStationScreen;
