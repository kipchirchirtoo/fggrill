import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput, Card, Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { stockRequestApi } from '../../api/dispatch.api';
import { inventoryApi } from '../../api/inventory.api';

interface ReqItem { item_id: string; name: string; unit: string; quantity_requested: number; }

const RaiseRequisitionScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [items, setItems] = useState<ReqItem[]>([]);
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [loading, setLoading] = useState(false);

  const doSearch = async (q: string) => {
    setSearch(q);
    if (q.length < 2) { setResults([]); return; }
    try {
      const res = await inventoryApi.search(q);
      setResults(Array.isArray(res) ? res.slice(0, 8) : []);
    } catch { setResults([]); }
  };

  const addItem = (inv: any) => {
    if (items.find(i => i.item_id === inv.id)) return;
    setItems(prev => [...prev, { item_id: inv.id, name: inv.name, unit: inv.unit, quantity_requested: 1 }]);
    setSearch(''); setResults([]);
  };

  const updateQty = (id: string, qty: number) =>
    setItems(prev => prev.map(i => i.item_id === id ? { ...i, quantity_requested: Math.max(1, qty) } : i));

  const handleSubmit = async () => {
    if (items.length === 0) { Alert.alert('Error', 'Add at least one item'); return; }
    setLoading(true);
    try {
      // POST /api/storekeeping/stock-requests
      await stockRequestApi.create({
        items: items.map(i => ({ item_id: i.item_id, quantity_requested: i.quantity_requested, unit: i.unit })),
        notes: notes || undefined,
        priority,
      });
      Alert.alert('Requisition Submitted', 'Your request has been sent to the central store.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to submit requisition');
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card style={styles.infoCard}>
          <Card.Content>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="information" size={20} color={colors.info.DEFAULT} />
              <Text style={styles.infoText}>Request stock from the central store. Your request will be reviewed and dispatched.</Text>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.priorityRow}>
          <Text style={styles.sectionTitle}>Priority</Text>
          <View style={styles.priorityBtns}>
            {(['normal', 'urgent'] as const).map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.priorityBtn, priority === p && styles.priorityBtnActive]}
                onPress={() => setPriority(p)}
              >
                <Text style={[styles.priorityBtnText, priority === p && styles.priorityBtnTextActive]}>
                  {p.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Add Items</Text>
        <Searchbar
          placeholder="Search items to request…"
          value={search}
          onChangeText={doSearch}
          style={styles.searchbar}
        />
        {results.length > 0 && (
          <Card style={styles.results}>
            {results.map(r => (
              <TouchableOpacity key={r.id} style={styles.resultRow} onPress={() => addItem(r)}>
                <View style={styles.flex}>
                  <Text style={styles.resultName}>{r.name}</Text>
                  {r.sku && <Text style={styles.resultSku}>{r.sku}</Text>}
                </View>
                <Text style={styles.resultUnit}>{r.unit}</Text>
                <MaterialCommunityIcons name="plus-circle" size={22} color={colors.success.DEFAULT} style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {items.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Requested Items ({items.length})</Text>
            {items.map(item => (
              <Card key={item.item_id} style={styles.itemCard}>
                <Card.Content>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <TouchableOpacity onPress={() => setItems(prev => prev.filter(i => i.item_id !== item.item_id))}>
                      <MaterialCommunityIcons name="close-circle" size={22} color={colors.danger.DEFAULT} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.qtyRow}>
                    <TouchableOpacity onPress={() => updateQty(item.item_id, item.quantity_requested - 1)} style={styles.qtyBtn}>
                      <MaterialCommunityIcons name="minus" size={20} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity_requested} {item.unit}</Text>
                    <TouchableOpacity onPress={() => updateQty(item.item_id, item.quantity_requested + 1)} style={styles.qtyBtn}>
                      <MaterialCommunityIcons name="plus" size={20} color={colors.text.primary} />
                    </TouchableOpacity>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </>
        )}

        <TextInput label="Notes (Optional)" value={notes} onChangeText={setNotes} mode="outlined" multiline numberOfLines={3} style={styles.input} />

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading || items.length === 0}
          style={styles.submitBtn}
          icon="send"
        >
          Submit Requisition
        </Button>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  infoCard: { marginBottom: spacing.lg, backgroundColor: colors.info.DEFAULT + '10', borderWidth: 1, borderColor: colors.info.DEFAULT },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 13, color: colors.text.secondary, marginLeft: spacing.sm, lineHeight: 20 },
  priorityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  priorityBtns: { flexDirection: 'row', gap: spacing.sm },
  priorityBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  priorityBtnActive: { backgroundColor: colors.primary.DEFAULT, borderColor: colors.primary.DEFAULT },
  priorityBtnText: { fontSize: 12, fontWeight: '600', color: colors.text.secondary },
  priorityBtnTextActive: { color: colors.primary.foreground },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md },
  searchbar: { backgroundColor: colors.card, marginBottom: spacing.md },
  results: { marginBottom: spacing.md },
  resultRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  flex: { flex: 1 },
  resultName: { fontSize: 14, fontWeight: '500', color: colors.text.primary },
  resultSku: { fontSize: 11, color: colors.text.tertiary },
  resultUnit: { fontSize: 13, color: colors.text.tertiary },
  itemCard: { marginBottom: spacing.md, ...shadows.sm },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.text.primary, flex: 1 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  qtyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.input, justifyContent: 'center', alignItems: 'center' },
  qtyText: { fontSize: 16, fontWeight: '600', color: colors.text.primary, marginHorizontal: spacing.xl, minWidth: 80, textAlign: 'center' },
  input: { marginBottom: spacing.md, backgroundColor: colors.card },
  submitBtn: { backgroundColor: colors.primary.DEFAULT },
});

export default RaiseRequisitionScreen;
