import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput, Card, RadioButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { useAuthStore } from '../../stores/auth.store';
import { wasteApi } from '../../api/wasteLogs.api';
import { inventoryApi } from '../../api/inventory.api';

const REASONS = [
  { value: 'expired', label: 'Expired', icon: 'calendar-remove' },
  { value: 'damaged', label: 'Damaged', icon: 'package-variant-remove' },
  { value: 'spilled', label: 'Spilled', icon: 'water-alert' },
  { value: 'theft_suspected', label: 'Theft Suspected', icon: 'alert-octagon' },
  { value: 'other', label: 'Other', icon: 'dots-horizontal' },
];

const BranchWasteLogScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [itemName, setItemName] = useState('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('expired');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const searchItem = async (q: string) => {
    setItemName(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const res = await inventoryApi.search(q);
      setSearchResults(Array.isArray(res) ? res.slice(0, 6) : []);
    } catch { setSearchResults([]); }
  };

  const selectItem = (item: any) => {
    setSelectedItem(item);
    setItemName(item.name);
    setSearchResults([]);
  };

  const handleSubmit = async () => {
    if (!selectedItem || !qty) { Alert.alert('Error', 'Select an item and enter quantity'); return; }
    const quantity = parseFloat(qty);
    if (isNaN(quantity) || quantity <= 0) { Alert.alert('Error', 'Enter a valid quantity'); return; }

    setLoading(true);
    try {
      // POST /api/wastage
      await wasteApi.create({
        item_id: selectedItem.id,
        item_name: selectedItem.name,
        quantity,
        unit: selectedItem.unit,
        reason,
        notes: notes || undefined,
        branch_id: user?.branch_id,
        waste_date: new Date().toISOString(),
      });
      Alert.alert('Waste Logged', `${quantity} ${selectedItem.unit} of ${selectedItem.name} logged.`, [
        { text: 'Log Another', onPress: () => { setSelectedItem(null); setItemName(''); setQty(''); setNotes(''); } },
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to log waste');
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Item</Text>
        <TextInput
          label="Search item…"
          value={itemName}
          onChangeText={searchItem}
          mode="outlined"
          style={styles.input}
          left={<TextInput.Icon icon="magnify" />}
          right={selectedItem ? <TextInput.Icon icon="check-circle" color={colors.success.DEFAULT} /> : undefined}
        />
        {searchResults.length > 0 && (
          <Card style={styles.results}>
            {searchResults.map(r => (
              <TouchableOpacity key={r.id} style={styles.resultRow} onPress={() => selectItem(r)}>
                <Text style={styles.resultName}>{r.name}</Text>
                <Text style={styles.resultUnit}>{r.unit}</Text>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        <Text style={styles.sectionTitle}>Reason</Text>
        <Card style={styles.reasonCard}>
          <Card.Content>
            <RadioButton.Group onValueChange={setReason} value={reason}>
              {REASONS.map(r => (
                <TouchableOpacity key={r.value} style={styles.reasonRow} onPress={() => setReason(r.value)}>
                  <MaterialCommunityIcons name={r.icon as any} size={22} color={reason === r.value ? colors.danger.DEFAULT : colors.text.tertiary} />
                  <Text style={[styles.reasonLabel, reason === r.value && styles.reasonActive]}>{r.label}</Text>
                  <RadioButton value={r.value} />
                </TouchableOpacity>
              ))}
            </RadioButton.Group>
          </Card.Content>
        </Card>

        <TextInput
          label={`Quantity${selectedItem ? ` (${selectedItem.unit})` : ''}`}
          value={qty}
          onChangeText={setQty}
          keyboardType="numeric"
          mode="outlined"
          right={selectedItem ? <TextInput.Affix text={selectedItem.unit} /> : undefined}
          style={styles.input}
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
          onPress={handleSubmit}
          loading={loading}
          disabled={loading || !selectedItem || !qty}
          style={styles.submitBtn}
          icon="delete-variant"
        >
          Log Waste
        </Button>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md, marginTop: spacing.sm },
  input: { marginBottom: spacing.md, backgroundColor: colors.card },
  results: { marginBottom: spacing.md },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultName: { fontSize: 14, fontWeight: '500', color: colors.text.primary },
  resultUnit: { fontSize: 13, color: colors.text.tertiary },
  reasonCard: { marginBottom: spacing.lg, ...shadows.sm },
  reasonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  reasonLabel: { flex: 1, fontSize: 15, color: colors.text.secondary, marginLeft: spacing.md },
  reasonActive: { color: colors.danger.DEFAULT, fontWeight: '600' },
  submitBtn: { backgroundColor: colors.danger.DEFAULT },
});

export default BranchWasteLogScreen;
