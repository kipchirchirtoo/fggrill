/**
 * CountItemsScreen
 *
 * Branch storekeeper counts each item in the delivery.
 * Pre-fills with dispatched quantities. User adjusts received quantities.
 * If all match → confirm delivery directly.
 * If discrepancy → offer to report or confirm anyway.
 *
 * Receives: { dispatchId, dispatchNum? }
 * Navigates to: Discrepancy (if discrepancy) or BSTabs (success)
 *
 * API: GET /api/storekeeping/incoming-dispatches (to load items)
 *      PUT /api/storekeeping/dispatch-notes/:id/confirm (to confirm)
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, Button, TextInput, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { dispatchApi } from '../../api/dispatch.api';

interface CountItem {
  item_id: string;
  name: string;
  unit: string;
  qty_dispatched: number;
  qty_received: number;
}

interface Props {
  route: { params: { dispatchId: string; dispatchNum?: string } };
  navigation: any;
}

const CountItemsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { dispatchId, dispatchNum } = route.params;
  const [items, setItems] = useState<CountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadItems = async () => {
      try {
        // Load from incoming dispatches list
        const incoming = await dispatchApi.incoming();
        const dispatch = Array.isArray(incoming)
          ? incoming.find((d: any) => d.id === dispatchId)
          : null;

        if (dispatch?.items?.length) {
          setItems(
            dispatch.items.map((i: any) => ({
              item_id: i.item_id || i.id,
              name: i.item?.name || i.name || `Item`,
              unit: i.unit || 'units',
              qty_dispatched: i.quantity || i.qty_dispatched || 0,
              qty_received: i.quantity || i.qty_dispatched || 0,
            }))
          );
        } else {
          // Fallback: load all dispatches and find by id
          const all = await dispatchApi.list();
          const found = Array.isArray(all) ? all.find((d: any) => d.id === dispatchId) : null;
          if (found?.items?.length) {
            setItems(
              found.items.map((i: any) => ({
                item_id: i.item_id || i.id,
                name: i.item?.name || i.name || `Item`,
                unit: i.unit || 'units',
                qty_dispatched: i.quantity || i.qty_dispatched || 0,
                qty_received: i.quantity || i.qty_dispatched || 0,
              }))
            );
          }
        }
      } catch (e) {
        console.error('Failed to load dispatch items:', e);
      } finally {
        setLoading(false);
      }
    };
    loadItems();
  }, [dispatchId]);

  const updateQty = (itemId: string, val: string) => {
    setItems(prev =>
      prev.map(i => i.item_id === itemId ? { ...i, qty_received: parseFloat(val) || 0 } : i)
    );
  };

  const hasDiscrepancy = items.some(i => i.qty_received !== i.qty_dispatched);

  const confirmDelivery = async (reportDiscrepancy = false) => {
    setSubmitting(true);
    try {
      // PUT /api/storekeeping/dispatch-notes/:id/confirm
      await dispatchApi.confirmDelivery(dispatchId, {
        items_received: items.map(i => ({
          item_id: i.item_id,
          quantity_received: i.qty_received,
        })),
        has_discrepancy: hasDiscrepancy,
        discrepancy_note: hasDiscrepancy ? 'Quantity discrepancy reported by branch storekeeper' : undefined,
      });

      Alert.alert(
        'Delivery Confirmed!',
        `${items.length} items received. Stock has been updated.`,
        [{ text: 'Done', onPress: () => navigation.navigate('BSTabs') }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to confirm delivery');
    } finally {
      setSubmitting(false); }
  };

  const handleConfirm = () => {
    if (hasDiscrepancy) {
      Alert.alert(
        'Discrepancy Detected',
        'Some quantities differ from what was dispatched. What would you like to do?',
        [
          {
            text: 'Report Discrepancy',
            onPress: () =>
              navigation.navigate('Discrepancy', {
                dispatchId,
                dispatchNum,
                items: items.map(i => ({
                  ...i,
                  inventory_item_id: i.item_id,
                })),
              }),
          },
          { text: 'Confirm Anyway', style: 'destructive', onPress: () => confirmDelivery(false) },
          { text: 'Go Back & Recount', style: 'cancel' },
        ]
      );
    } else {
      Alert.alert(
        'Confirm Receipt',
        `All ${items.length} items match. Confirm delivery?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm', onPress: () => confirmDelivery(false) },
        ]
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
        <Text style={styles.loadingText}>Loading items…</Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="package-variant-closed" size={60} color={colors.text.tertiary} />
        <Text style={styles.emptyText}>No items found for this dispatch.</Text>
        <Button mode="outlined" onPress={() => navigation.goBack()} style={{ marginTop: spacing.lg }}>
          Go Back
        </Button>
      </View>
    );
  }

  const countedCorrectly = items.filter(i => i.qty_received === i.qty_dispatched).length;

  return (
    <View style={styles.container}>
      {/* Progress header */}
      <View style={styles.progressHeader}>
        <Text style={styles.progressText}>
          {countedCorrectly}/{items.length} items match
        </Text>
        {hasDiscrepancy && (
          <View style={styles.discBadge}>
            <MaterialCommunityIcons name="alert" size={14} color={colors.warning.DEFAULT} />
            <Text style={styles.discBadgeText}>Discrepancy</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.infoCard}>
          <Card.Content>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="information" size={20} color={colors.info.DEFAULT} />
              <Text style={styles.infoText}>
                Count each item physically. Update the "Received" quantity if it differs from dispatched.
              </Text>
            </View>
          </Card.Content>
        </Card>

        {items.map((item) => {
          const diff = item.qty_received - item.qty_dispatched;
          const hasItemDisc = item.qty_received !== item.qty_dispatched;
          return (
            <Card key={item.item_id} style={[styles.itemCard, hasItemDisc && styles.itemCardDisc]}>
              <Card.Content>
                <Text style={styles.itemName}>{item.name}</Text>
                <View style={styles.qtyRow}>
                  {/* Dispatched (read-only) */}
                  <View style={styles.qtyBox}>
                    <Text style={styles.qtyLabel}>Dispatched</Text>
                    <Text style={styles.qtyValue}>{item.qty_dispatched} {item.unit}</Text>
                  </View>

                  <MaterialCommunityIcons name="arrow-right" size={20} color={colors.text.tertiary} />

                  {/* Received (editable) */}
                  <View style={styles.qtyBox}>
                    <Text style={styles.qtyLabel}>Received</Text>
                    <View style={styles.qtyControl}>
                      <TouchableOpacity
                        onPress={() => updateQty(item.item_id, String(Math.max(0, item.qty_received - 1)))}
                        style={styles.qtyBtn}
                      >
                        <MaterialCommunityIcons name="minus" size={16} color={colors.text.primary} />
                      </TouchableOpacity>
                      <TextInput
                        value={item.qty_received.toString()}
                        onChangeText={v => updateQty(item.item_id, v)}
                        keyboardType="numeric"
                        mode="outlined"
                        style={styles.qtyInput}
                        dense
                      />
                      <TouchableOpacity
                        onPress={() => updateQty(item.item_id, String(item.qty_received + 1))}
                        style={styles.qtyBtn}
                      >
                        <MaterialCommunityIcons name="plus" size={16} color={colors.text.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {hasItemDisc && (
                  <View style={styles.diffBadge}>
                    <MaterialCommunityIcons name="alert" size={13} color={colors.warning.DEFAULT} />
                    <Text style={styles.diffText}>
                      {diff > 0 ? `+${diff}` : diff} {item.unit} difference
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>
          );
        })}

        <Button
          mode="contained"
          onPress={handleConfirm}
          loading={submitting}
          disabled={submitting}
          style={[styles.confirmBtn, hasDiscrepancy && styles.confirmBtnWarn]}
          icon={hasDiscrepancy ? 'alert-circle' : 'check-circle'}
        >
          {hasDiscrepancy ? 'Confirm (Discrepancy Detected)' : 'Confirm All Items Received'}
        </Button>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  loadingText: { fontSize: 14, color: colors.text.tertiary, marginTop: spacing.md },
  emptyText: { fontSize: 15, color: colors.text.tertiary, marginTop: spacing.md, textAlign: 'center' },
  progressHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg, backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  progressText: { fontSize: 14, fontWeight: '600', color: colors.text.secondary },
  discBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.warning.DEFAULT + '15', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 6 },
  discBadgeText: { fontSize: 11, fontWeight: '700', color: colors.warning.DEFAULT, marginLeft: 4 },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  infoCard: { marginBottom: spacing.lg, backgroundColor: colors.info.DEFAULT + '10', borderWidth: 1, borderColor: colors.info.DEFAULT },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 13, color: colors.text.secondary, marginLeft: spacing.sm, lineHeight: 20 },
  itemCard: { marginBottom: spacing.md, ...shadows.sm },
  itemCardDisc: { borderLeftWidth: 3, borderLeftColor: colors.warning.DEFAULT },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyBox: { flex: 1 },
  qtyLabel: { fontSize: 11, color: colors.text.tertiary, marginBottom: 4 },
  qtyValue: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  qtyControl: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.input, justifyContent: 'center', alignItems: 'center' },
  qtyInput: { width: 60, marginHorizontal: spacing.xs, backgroundColor: colors.card },
  diffBadge: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, padding: spacing.sm, backgroundColor: colors.warning.DEFAULT + '15', borderRadius: 6 },
  diffText: { fontSize: 12, fontWeight: '600', color: colors.warning.DEFAULT, marginLeft: 4 },
  confirmBtn: { backgroundColor: colors.success.DEFAULT, marginTop: spacing.lg },
  confirmBtnWarn: { backgroundColor: colors.warning.DEFAULT },
});

export default CountItemsScreen;
