/**
 * DispatchManagementScreen - Central Store
 * 
 * Manage dispatches with proper workflow tabs
 * Matches web app: /dashboard/central-store/dispatch
 * 
 * Tabs:
 * - READY: Dispatches ready for vehicle/driver assignment
 * - IN_TRANSIT: Dispatches currently being delivered
 * - DELIVERED: Completed deliveries
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
import { Text, Card, Button, Portal, Modal } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { dispatchApi } from '../../api/dispatch.api';

interface DispatchItem {
  id: string;
  item_sku: string;
  item_name: string;
  quantity: number;
  unit: string;
}

interface Dispatch {
  id: string;
  dispatch_number: string;
  status: string;
  to_branch_name: string;
  to_branch?: { name: string };
  created_at: string;
  dispatched_at?: string;
  confirmed_at?: string;
  items: DispatchItem[];
  vehicle_registration?: string;
  vehicle_number?: string;
  driver_name?: string;
}

interface Vehicle {
  id: string;
  registration_number: string;
  model: string;
}

interface Driver {
  id: string;
  name: string;
  license_number: string;
}

interface Props {
  navigation: any;
}

type TabType = 'READY' | 'IN_TRANSIT' | 'DELIVERED';

const DispatchManagementScreen: React.FC<Props> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<TabType>('READY');
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDispatch, setSelectedDispatch] = useState<Dispatch | null>(null);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Map tab to API status
      const statusMap: Record<TabType, string> = {
        'READY': 'READY',
        'IN_TRANSIT': 'IN_TRANSIT',
        'DELIVERED': 'CONFIRMED', // CONFIRMED means delivered in backend
      };

      const [dispatchesRes, vehiclesRes, driversRes] = await Promise.all([
        dispatchApi.getDispatchNotes(statusMap[activeTab]),
        dispatchApi.getVehicles().catch(() => ({ success: false, data: [] })),
        dispatchApi.getDrivers().catch(() => ({ success: false, data: [] })),
      ]);

      if (dispatchesRes.success) {
        let data = dispatchesRes.data || [];
        
        // For DELIVERED tab, also include DELIVERED and DISPUTED statuses
        if (activeTab === 'DELIVERED') {
          const [deliveredRes, disputedRes] = await Promise.all([
            dispatchApi.getDispatchNotes('DELIVERED'),
            dispatchApi.getDispatchNotes('DISPUTED'),
          ]);
          if (deliveredRes.success) data = [...data, ...(deliveredRes.data || [])];
          if (disputedRes.success) data = [...data, ...(disputedRes.data || [])];
          
          // Remove duplicates
          const seen = new Set<string>();
          data = data.filter((d: Dispatch) => {
            if (seen.has(d.id)) return false;
            seen.add(d.id);
            return true;
          });
        }
        
        setDispatches(data);
      }

      if (vehiclesRes.success) setVehicles(vehiclesRes.data || []);
      if (driversRes.success) setDrivers(driversRes.data || []);
    } catch (error) {
      console.error('Error fetching dispatches:', error);
      Alert.alert('Error', 'Failed to load dispatches');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAssignVehicleDriver = (dispatch: Dispatch) => {
    setSelectedDispatch(dispatch);
    setSelectedVehicle('');
    setSelectedDriver('');
    setAssignModalVisible(true);
  };

  const handleConfirmAssignment = async () => {
    if (!selectedDispatch || !selectedVehicle || !selectedDriver) {
      Alert.alert('Required', 'Please select both vehicle and driver');
      return;
    }

    setIsAssigning(true);
    try {
      const response = await dispatchApi.assignVehicleDriver(selectedDispatch.id, {
        vehicle_id: selectedVehicle,
        driver_id: selectedDriver,
      });

      if (response.success) {
        Alert.alert('Success', 'Vehicle and driver assigned successfully');
        setAssignModalVisible(false);
        setSelectedDispatch(null);
        setActiveTab('IN_TRANSIT'); // Switch to IN_TRANSIT tab
        fetchData();
      } else {
        Alert.alert('Error', response.message || 'Failed to assign');
      }
    } catch (error: any) {
      console.error('Error assigning:', error);
      Alert.alert('Error', error.message || 'Failed to assign vehicle and driver');
    } finally {
      setIsAssigning(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'READY': return colors.warning.DEFAULT;
      case 'IN_TRANSIT': return colors.info.DEFAULT;
      case 'CONFIRMED': return colors.success.DEFAULT;
      case 'DELIVERED': return colors.success.DEFAULT;
      case 'DISPUTED': return colors.danger.DEFAULT;
      default: return colors.text.tertiary;
    }
  };

  const tabs: TabType[] = ['READY', 'IN_TRANSIT', 'DELIVERED'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Dispatch & Logistics</Text>
          <Text style={styles.subtitle}>Manage branch deliveries and fleet tracking</Text>
        </View>
        <TouchableOpacity onPress={fetchData} disabled={loading}>
          <MaterialCommunityIcons 
            name="refresh" 
            size={24} 
            color={colors.primary.DEFAULT}
            style={loading ? styles.rotating : undefined}
          />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && styles.tabActive,
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[
              styles.tabText,
              activeTab === tab && styles.tabTextActive,
            ]}>
              {tab.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} />}
        contentContainerStyle={styles.content}
      >
        {loading && dispatches.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="loading" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>Loading dispatches...</Text>
          </View>
        ) : dispatches.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="truck-delivery" size={64} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>Queue Clear</Text>
            <Text style={styles.emptySubtext}>
              No shipments currently in {activeTab.toLowerCase().replace('_', ' ')} status
            </Text>
          </View>
        ) : (
          <View style={styles.dispatchList}>
            {dispatches.map((dispatch) => (
              <Card key={dispatch.id} style={styles.dispatchCard}>
                <Card.Content>
                  <View style={styles.dispatchHeader}>
                    <View style={styles.dispatchInfo}>
                      <View style={styles.dispatchNumberRow}>
                        <Text style={styles.dispatchNumber}>{dispatch.dispatch_number}</Text>
                        <View style={[
                          styles.statusBadge,
                          { backgroundColor: getStatusBadgeColor(dispatch.status) + '20' }
                        ]}>
                          <Text style={[
                            styles.statusText,
                            { color: getStatusBadgeColor(dispatch.status) }
                          ]}>
                            {dispatch.status === 'CONFIRMED' ? 'DELIVERED' : dispatch.status}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.branchName}>
                        {dispatch.to_branch_name || dispatch.to_branch?.name}
                      </Text>
                      <View style={styles.metaRow}>
                        <MaterialCommunityIcons name="calendar" size={14} color={colors.text.tertiary} />
                        <Text style={styles.metaText}>
                          {new Date(dispatch.confirmed_at || dispatch.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Items Preview */}
                  <View style={styles.itemsPreview}>
                    <Text style={styles.itemsTitle}>Shipment Contents</Text>
                    <View style={styles.itemsGrid}>
                      {(dispatch.items || []).slice(0, 3).map((item, idx) => (
                        <View key={idx} style={styles.itemChip}>
                          <Text style={styles.itemChipText} numberOfLines={1}>
                            {item.item_name}
                          </Text>
                          <Text style={styles.itemChipQty}>
                            {item.quantity} {item.unit}
                          </Text>
                        </View>
                      ))}
                      {(dispatch.items?.length || 0) > 3 && (
                        <Text style={styles.moreItems}>
                          +{(dispatch.items?.length || 0) - 3} more
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Vehicle/Driver Info (for IN_TRANSIT and DELIVERED) */}
                  {(activeTab === 'IN_TRANSIT' || activeTab === 'DELIVERED') && (
                    <View style={styles.transportInfo}>
                      {dispatch.driver_name && (
                        <View style={styles.transportRow}>
                          <MaterialCommunityIcons name="account" size={16} color={colors.text.secondary} />
                          <Text style={styles.transportText}>{dispatch.driver_name}</Text>
                        </View>
                      )}
                      {(dispatch.vehicle_registration || dispatch.vehicle_number) && (
                        <View style={styles.transportRow}>
                          <MaterialCommunityIcons name="truck" size={16} color={colors.text.secondary} />
                          <Text style={styles.transportText}>
                            {dispatch.vehicle_registration || dispatch.vehicle_number}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Actions */}
                  <View style={styles.actions}>
                    {activeTab === 'READY' && (
                      <Button
                        mode="contained"
                        onPress={() => handleAssignVehicleDriver(dispatch)}
                        style={styles.actionButton}
                        buttonColor={colors.primary.DEFAULT}
                        icon="truck-fast"
                      >
                        Assign Vehicle & Driver
                      </Button>
                    )}
                    <Button
                      mode="outlined"
                      onPress={() => {/* TODO: Print delivery note */}}
                      style={styles.actionButton}
                      icon="printer"
                    >
                      Print Note
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Assignment Modal */}
      <Portal>
        <Modal
          visible={assignModalVisible}
          onDismiss={() => setAssignModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Assign Transport</Text>
            <Text style={styles.modalSubtitle}>
              {selectedDispatch?.dispatch_number}
            </Text>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.inputLabel}>Select Vehicle</Text>
            <ScrollView style={styles.optionsList}>
              {vehicles.map((vehicle) => (
                <TouchableOpacity
                  key={vehicle.id}
                  style={[
                    styles.optionItem,
                    selectedVehicle === vehicle.id && styles.optionItemSelected,
                  ]}
                  onPress={() => setSelectedVehicle(vehicle.id)}
                >
                  <MaterialCommunityIcons 
                    name={selectedVehicle === vehicle.id ? "radiobox-marked" : "radiobox-blank"} 
                    size={20} 
                    color={selectedVehicle === vehicle.id ? colors.primary.DEFAULT : colors.text.tertiary} 
                  />
                  <Text style={styles.optionText}>
                    {vehicle.registration_number} — {vehicle.model}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Select Driver</Text>
            <ScrollView style={styles.optionsList}>
              {drivers.map((driver) => (
                <TouchableOpacity
                  key={driver.id}
                  style={[
                    styles.optionItem,
                    selectedDriver === driver.id && styles.optionItemSelected,
                  ]}
                  onPress={() => setSelectedDriver(driver.id)}
                >
                  <MaterialCommunityIcons 
                    name={selectedDriver === driver.id ? "radiobox-marked" : "radiobox-blank"} 
                    size={20} 
                    color={selectedDriver === driver.id ? colors.primary.DEFAULT : colors.text.tertiary} 
                  />
                  <Text style={styles.optionText}>{driver.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setAssignModalVisible(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleConfirmAssignment}
              loading={isAssigning}
              disabled={!selectedVehicle || !selectedDriver || isAssigning}
              style={styles.modalButton}
              buttonColor={colors.primary.DEFAULT}
            >
              Confirm
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.DEFAULT,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  rotating: {
    // Add rotation animation if needed
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary.DEFAULT,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
  },
  tabTextActive: {
    color: colors.primary.foreground,
  },
  content: {
    padding: spacing.lg,
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
  },
  dispatchList: {
    gap: spacing.md,
  },
  dispatchCard: {
    backgroundColor: colors.card,
    ...shadows.sm,
  },
  dispatchHeader: {
    marginBottom: spacing.md,
  },
  dispatchInfo: {
    gap: spacing.xs,
  },
  dispatchNumberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dispatchNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: 'monospace',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  branchName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  itemsPreview: {
    marginBottom: spacing.md,
  },
  itemsTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  itemChip: {
    backgroundColor: colors.background.DEFAULT,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemChipText: {
    fontSize: 11,
    color: colors.text.primary,
    fontWeight: '500',
  },
  itemChipQty: {
    fontSize: 10,
    color: colors.text.tertiary,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  moreItems: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  transportInfo: {
    backgroundColor: colors.background.DEFAULT,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  transportText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  actions: {
    gap: spacing.sm,
  },
  actionButton: {
    borderRadius: 8,
  },
  modal: {
    backgroundColor: colors.card,
    margin: spacing.lg,
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalHeader: {
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
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  optionsList: {
    maxHeight: 150,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.xs,
    backgroundColor: colors.background.DEFAULT,
  },
  optionItemSelected: {
    backgroundColor: colors.primary.DEFAULT + '10',
  },
  optionText: {
    fontSize: 14,
    color: colors.text.primary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
  },
});

export default DispatchManagementScreen;
