/**
 * CreateDispatchScreen
 *
 * Central storekeeper creates a dispatch note and dispatches items to a branch.
 *
 * Flow:
 *  1. Select destination branch
 *  2. Search and add inventory items with quantities
 *  3. Enter driver name
 *  4. Submit → creates dispatch note → dispatches it → gets OTP
 *  5. Navigate to DispatchOTPScreen with the OTP code
 *
 * APIs:
 *  GET  /api/system/branches
 *  GET  /api/storekeeping/items?search=q
 *  POST /api/storekeeping/dispatch-notes
 *  PUT  /api/storekeeping/dispatch-notes/:id/dispatch
 */

import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, Alert, TouchableOpacity,
} from 'react-native';
import { Text, Button, TextInput, Card, Searchbar, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { dispatchApi } from '../../api/dispatch.api';
import { inventoryApi } from '../../api/inventory.api';
import { systemApi } from '../../api/system.api';

interface Branch { id: string; name: string; }
interface InvItem { id: string; name: string; sku?: string; unit: string; quantity?: number; }
interface DispatchItem { item_id: string; name: string; unit: string; quantity: number; }

const CreateDispatchScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<InvItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [items, setItems] = useState<DispatchItem[]>([]);
  const [driverName, setDriverName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    systemApi.branches()
      .then(data => setBranches(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  const doSearch = async (q: string) => {
    setSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await inventoryApi.search(q);
      setSearchResults(Array.isArray(res) ? res.slice(0, 10) : []);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  const addItem = (item: InvItem) => {
    if (items.find(i => i.item_id === item.id)) {
      Alert.alert('Already Added', `${item.name} is already in the list.`);
      return;
    }
    setItems(prev => [...prev, { item_id: item.id, name: item.name, unit: item.unit, quantity: 1 }]);
    setSearch('');
    setSearchResults([]);
  };

  const updateQty = (itemId: string, qty: number) =>
    setItems(prev => prev.map(i => i.item_id === itemId ? { ...i, quantity: Math.max(1, qty) } : i));

  const removeItem = (itemId: string) =>
    setItems(prev => prev.filter(i => i.item_id !== itemId));

  const handleCreate = async () => {
    if (!selectedBranch) { Alert.alert('Required', 'Please select a destination branch.'); return; }
    if (items.length === 0) { Alert.alert('Required', 'Please add at least one item.'); return; }
    if (!driverName.trim()) { Alert.alert('Required', 'Please enter the driver\'s name.'); return; }

    setLoading(true);
    try {
      // Step 1: Create the dispatch note
      const createRes = await dispatchApi.create({
        to_branch_id: selectedBranch.id,
        notes: notes.trim() || undefined,
        items: items.map(i => ({ item_id: i.item_id, quantity: i.quantity, unit: i.unit })),
      });
      const dispatchId = createRes.id || createRes.data?.id;
      if (!dispatchId) throw new Error('Failed to get dispatch ID from server');

      // Step 2: Dispatch it (this generates the OTP)
      const dispatchRes = await dispatchApi.dispatch(dispatchId, {
        driver_name: driverName.trim(),
      });

      // Extract OTP from response
      const otp =
        dispatchRes.otp_code ||
        dispatchRes.data?.otp_code ||
        dispatchRes.code ||
        dispatchRes.delivery_code ||
        '';

      const expiresAt =
        dispatchRes.otp_expires_at ||
        dispatchRes.data?.otp_expires_at ||
        dispatchRes.expires_at ||
        '';

      const dispatchNumber =
        createRes.dispatch_number ||
        createRes.data?.dispatch_number ||
        createRes.reference_number ||
        '';

      // Navigate to OTP screen — pass everything so no extra API call needed
      navigation.navigate('DispatchOTP', {
        dispatchId,
        otp,
        expiresAt,
        dispatchNumber,
      });
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || e.message || 'Failed to create dispatch');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !!selectedBranch && items.length > 0 && !!driverName.trim() && !loading;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Branch selection */}
        <Text style={styles.sectionTitle}>Destination Branch *</Text>
        {branches.length === 0 ? (
          <Text style={styles.hint}>Loading branches…</Text>
        ) : (
          <View style={styles.branchGrid}>
            {branches.map(b => (
              <TouchableOpacity
                key={b.id}
                style={[styles.branchCard, selectedBranch?.id === b.id && styles.branchSelected]}
                onPress={() => setSelectedBranch(b)}
              >
                <MaterialCommunityIcons
                  name="store"
                  size={22}
                  color={selectedBranch?.id === b.id ? colors.primary.DEFAULT : colors.text.tertiary}
                />
                <Text style={[styles.branchName, selectedBranch?.id === b.id && styles.branchNameActive]}>
                  {b.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Item search */}
        <Text style={styles.sectionTitle}>Add Items *</Text>
        <Searchbar
          placeholder="Search inventory items…"
          value={search}
          onChangeText={doSearch}
          style={styles.searchbar}
          right={() =>
            searching ? <ActivityIndicator size={16} color={colors.primary.DEFAULT} style={{ marginRight: 8 }} /> : null
          }
        />

        {searchResults.length > 0 && (
          <Card style={styles.results}>
            {searchResults.map(r => (
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

        {/* Items list */}
        {items.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Items to Dispatch ({items.length})</Text>
            {items.map(item => (
              <Card key={item.item_id} style={styles.itemCard}>
                <Card.Content>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <TouchableOpacity onPress={() => removeItem(item.item_id)}>
                      <MaterialCommunityIcons name="close-circle" size={22} color={colors.danger.DEFAULT} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.qtyRow}>
                    <TouchableOpacity
                      onPress={() => updateQty(item.item_id, item.quantity - 1)}
                      style={styles.qtyBtn}
                    >
                      <MaterialCommunityIcons name="minus" size={20} color={colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity} {item.unit}</Text>
                    <TouchableOpacity
                      onPress={() => updateQty(item.item_id, item.quantity + 1)}
                      style={styles.qtyBtn}
                    >
                      <MaterialCommunityIcons name="plus" size={20} color={colors.text.primary} />
                    </TouchableOpacity>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </>
        )}

        {/* Driver details */}
        <Text style={styles.sectionTitle}>Driver Details *</Text>
        <TextInput
          label="Driver Name"
          value={driverName}
          onChangeText={setDriverName}
          mode="outlined"
          style={styles.input}
          left={<TextInput.Icon icon="account" />}
        />
        <TextInput
          label="Notes (Optional)"
          value={notes}
          onChangeText={setNotes}
          mode="outlined"
          multiline
          numberOfLines={3}
          style={styles.input}
        />

        <Button
          mode="contained"
          onPress={handleCreate}
          loading={loading}
          disabled={!canSubmit}
          style={styles.submitBtn}
          icon="truck-delivery"
        >
          Create Dispatch & Get OTP
        </Button>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.text.primary, marginTop: spacing.lg, marginBottom: spacing.md },
  hint: { fontSize: 13, color: colors.text.tertiary, marginBottom: spacing.md },
  branchGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing.xs, marginBottom: spacing.sm },
  branchCard: { margin: spacing.xs, padding: spacing.md, backgroundColor: colors.card, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', minWidth: 100, ...shadows.sm },
  branchSelected: { borderColor: colors.primary.DEFAULT, backgroundColor: colors.primary.DEFAULT + '10' },
  branchName: { fontSize: 12, color: colors.text.secondary, marginTop: 4, textAlign: 'center' },
  branchNameActive: { color: colors.primary.DEFAULT, fontWeight: '600' },
  searchbar: { backgroundColor: colors.card, marginBottom: spacing.sm },
  results: { marginBottom: spacing.md },
  resultRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  flex: { flex: 1 },
  resultName: { fontSize: 14, fontWeight: '500', color: colors.text.primary },
  resultSku: { fontSize: 11, color: colors.text.tertiary },
  resultUnit: { fontSize: 13, color: colors.text.tertiary },
  itemCard: { marginBottom: spacing.sm, ...shadows.sm },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.text.primary, flex: 1 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  qtyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.input, justifyContent: 'center', alignItems: 'center' },
  qtyText: { fontSize: 16, fontWeight: '600', color: colors.text.primary, marginHorizontal: spacing.xl, minWidth: 80, textAlign: 'center' },
  input: { marginBottom: spacing.md, backgroundColor: colors.card },
  submitBtn: { backgroundColor: colors.primary.DEFAULT, marginTop: spacing.lg },
});

export default CreateDispatchScreen;
