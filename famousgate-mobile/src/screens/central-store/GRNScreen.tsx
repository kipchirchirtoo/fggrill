import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput, Card, Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import apiClient from '../../api/client';

interface Supplier { id: string; name: string; }
interface GRNItem { inventory_item_id: string; name: string; unit: string; qty_received: number; unit_cost: number; }

const GRNScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [poNumber, setPoNumber] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [items, setItems] = useState<GRNItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiClient.get('/suppliers').then(r => setSuppliers(r.data)).catch(console.error);
  }, []);

  const searchInventory = async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const r = await apiClient.get(`/mobile/inventory/search?q=${q}`);
      setSearchResults(r.data);
    } catch { setSearchResults([]); }
  };

  const addItem = (inv: any) => {
    if (items.find(i => i.inventory_item_id === inv.id)) return;
    setItems([...items, { inventory_item_id: inv.id, name: inv.name, unit: inv.unit, qty_received: 1, unit_cost: 0 }]);
    setSearch(''); setSearchResults([]);
  };

  const updateItem = (id: string, field: 'qty_received' | 'unit_cost', val: string) => {
    setItems(items.map(i => i.inventory_item_id === id ? { ...i, [field]: parseFloat(val) || 0 } : i));
  };

  const handleSubmit = async () => {
    if (!selectedSupplier) { Alert.alert('Error', 'Select a supplier'); return; }
    if (items.length === 0) { Alert.alert('Error', 'Add at least one item'); return; }
    setLoading(true);
    try {
      await apiClient.post('/grn', {
        supplier_id: selectedSupplier.id,
        po_number: poNumber,
        items: items.map(i => ({ inventory_item_id: i.inventory_item_id, qty_received: i.qty_received, unit_cost: i.unit_cost })),
      });
      Alert.alert('Success', 'GRN created successfully', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to create GRN');
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Supplier</Text>
        <View style={styles.supplierGrid}>
          {suppliers.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[styles.supplierCard, selectedSupplier?.id === s.id && styles.supplierSelected]}
              onPress={() => setSelectedSupplier(s)}
            >
              <MaterialCommunityIcons name="domain" size={20} color={selectedSupplier?.id === s.id ? colors.primary.DEFAULT : colors.text.tertiary} />
              <Text style={[styles.supplierName, selectedSupplier?.id === s.id && styles.supplierNameActive]}>{s.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput label="PO Number (Optional)" value={poNumber} onChangeText={setPoNumber} mode="outlined" style={styles.input} />

        <Text style={styles.sectionTitle}>Add Items</Text>
        <Searchbar placeholder="Search inventory..." value={search} onChangeText={q => { setSearch(q); searchInventory(q); }} style={styles.searchbar} />
        {searchResults.length > 0 && (
          <Card style={styles.results}>
            {searchResults.map(r => (
              <TouchableOpacity key={r.id} style={styles.resultRow} onPress={() => addItem(r)}>
                <Text style={styles.resultName}>{r.name}</Text>
                <Text style={styles.resultUnit}>{r.unit}</Text>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {items.map(item => (
          <Card key={item.inventory_item_id} style={styles.itemCard}>
            <Card.Content>
              <View style={styles.itemHeader}>
                <Text style={styles.itemName}>{item.name}</Text>
                <TouchableOpacity onPress={() => setItems(items.filter(i => i.inventory_item_id !== item.inventory_item_id))}>
                  <MaterialCommunityIcons name="close" size={20} color={colors.danger.DEFAULT} />
                </TouchableOpacity>
              </View>
              <View style={styles.itemFields}>
                <TextInput label="Qty" value={item.qty_received.toString()} onChangeText={v => updateItem(item.inventory_item_id, 'qty_received', v)} keyboardType="numeric" mode="outlined" style={styles.fieldInput} dense />
                <TextInput label="Unit Cost (KES)" value={item.unit_cost.toString()} onChangeText={v => updateItem(item.inventory_item_id, 'unit_cost', v)} keyboardType="numeric" mode="outlined" style={styles.fieldInput} dense />
              </View>
            </Card.Content>
          </Card>
        ))}

        <Button mode="contained" onPress={handleSubmit} loading={loading} disabled={loading || !selectedSupplier || items.length === 0} style={styles.submitBtn}>
          Create GRN
        </Button>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md, marginTop: spacing.lg },
  supplierGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs, marginBottom: spacing.md },
  supplierCard: { margin: spacing.xs, padding: spacing.md, backgroundColor: colors.card, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', minWidth: 100, ...shadows.sm },
  supplierSelected: { borderColor: colors.primary.DEFAULT, backgroundColor: colors.primary.DEFAULT + '10' },
  supplierName: { fontSize: 12, color: colors.text.secondary, marginTop: 4, textAlign: 'center' },
  supplierNameActive: { color: colors.primary.DEFAULT, fontWeight: '600' },
  input: { marginBottom: spacing.md, backgroundColor: colors.card },
  searchbar: { backgroundColor: colors.card, marginBottom: spacing.md },
  results: { marginBottom: spacing.md },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultName: { fontSize: 14, fontWeight: '500', color: colors.text.primary },
  resultUnit: { fontSize: 13, color: colors.text.tertiary },
  itemCard: { marginBottom: spacing.md, ...shadows.sm },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.text.primary, flex: 1 },
  itemFields: { flexDirection: 'row', gap: spacing.md },
  fieldInput: { flex: 1, backgroundColor: colors.card },
  submitBtn: { backgroundColor: colors.primary.DEFAULT, marginTop: spacing.lg },
});

export default GRNScreen;
