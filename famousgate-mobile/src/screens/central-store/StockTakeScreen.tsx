import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, Button, TextInput, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import apiClient from '../../api/client';

interface StockItem {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  counted_qty: number | null;
}

const StockTakeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [items, setItems] = useState<StockItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const startSession = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post('/stock-take/sessions');
      setSessionId(res.data.id);
      const itemsRes = await apiClient.get('/mobile/inventory?limit=200');
      setItems(itemsRes.data.map((i: any) => ({ ...i, counted_qty: null })));
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to start session');
    } finally {
      setLoading(false);
    }
  };

  const updateCount = (id: string, qty: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, counted_qty: parseFloat(qty) || 0 } : i));
  };

  const handleSubmit = async () => {
    const counted = items.filter(i => i.counted_qty !== null);
    if (counted.length === 0) { Alert.alert('Error', 'Count at least one item'); return; }
    setSubmitting(true);
    try {
      await apiClient.post(`/stock-take/sessions/${sessionId}/submit`, {
        entries: counted.map(i => ({
          inventory_item_id: i.id,
          system_qty: i.current_stock,
          counted_qty: i.counted_qty,
          variance: (i.counted_qty ?? 0) - i.current_stock,
        })),
      });
      Alert.alert('Success', `Stock take submitted. ${counted.length} items counted.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const countedCount = items.filter(i => i.counted_qty !== null).length;

  if (!sessionId) {
    return (
      <View style={styles.startContainer}>
        <MaterialCommunityIcons name="clipboard-list" size={80} color={colors.primary.DEFAULT} />
        <Text style={styles.startTitle}>Start Stock Take</Text>
        <Text style={styles.startSubtitle}>
          A new stock take session will be created. Count all items and submit when done.
        </Text>
        <Button mode="contained" onPress={startSession} loading={loading} style={styles.startBtn}>
          Start Session
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.progressBar}>
        <Text style={styles.progressText}>{countedCount} / {items.length} items counted</Text>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${items.length ? (countedCount / items.length) * 100 : 0}%` as any }]} />
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.systemQty}>System: {item.current_stock} {item.unit}</Text>
                </View>
                <TextInput
                  value={item.counted_qty !== null ? item.counted_qty.toString() : ''}
                  onChangeText={v => updateCount(item.id, v)}
                  keyboardType="numeric"
                  mode="outlined"
                  placeholder="Count"
                  style={styles.countInput}
                  dense
                />
              </View>
              {item.counted_qty !== null && item.counted_qty !== item.current_stock && (
                <View style={styles.variance}>
                  <MaterialCommunityIcons name="alert" size={14} color={colors.warning.DEFAULT} />
                  <Text style={styles.varianceText}>
                    Variance: {item.counted_qty - item.current_stock > 0 ? '+' : ''}
                    {item.counted_qty - item.current_stock} {item.unit}
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>
        )}
      />

      <FAB
        icon="check"
        label={`Submit (${countedCount})`}
        style={styles.fab}
        onPress={handleSubmit}
        loading={submitting}
        disabled={submitting || countedCount === 0}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  startContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  startTitle: { fontSize: 24, fontWeight: '700', color: colors.text.primary, marginTop: spacing.lg, textAlign: 'center' },
  startSubtitle: { fontSize: 15, color: colors.text.tertiary, marginTop: spacing.sm, textAlign: 'center', lineHeight: 22 },
  startBtn: { marginTop: spacing.xl, backgroundColor: colors.primary.DEFAULT, width: '100%' },
  progressBar: { padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  progressText: { fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.sm },
  barBg: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: colors.success.DEFAULT, borderRadius: 4 },
  list: { padding: spacing.lg, paddingBottom: 100 },
  card: { marginBottom: spacing.sm, ...shadows.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flex: { flex: 1, marginRight: spacing.md },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  systemQty: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  countInput: { width: 90, backgroundColor: colors.card },
  variance: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, padding: spacing.xs, backgroundColor: colors.warning.DEFAULT + '15', borderRadius: 6 },
  varianceText: { fontSize: 12, fontWeight: '600', color: colors.warning.DEFAULT, marginLeft: 4 },
  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, backgroundColor: colors.success.DEFAULT },
});

export default StockTakeScreen;
