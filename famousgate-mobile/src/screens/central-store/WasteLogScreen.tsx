import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput, Card, RadioButton, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, spacing, shadows } from '../../theme';
import { wasteApi } from '../../api/wasteLogs.api';
import { inventoryApi } from '../../api/inventory.api';

const REASONS = [
  { value: 'expired', label: 'Expired', icon: 'calendar-remove' },
  { value: 'damaged', label: 'Damaged', icon: 'package-variant-remove' },
  { value: 'spilled', label: 'Spilled', icon: 'water-alert' },
  { value: 'theft_suspected', label: 'Theft Suspected', icon: 'alert-octagon' },
  { value: 'other', label: 'Other', icon: 'dots-horizontal' },
];

const WasteLogScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [item, setItem] = useState<any>(null);
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('expired');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleScan = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setScanning(false);
    try {
      const found = await inventoryApi.searchByBarcode(data);
      if (!found) { Alert.alert('Not Found', 'No item found for that barcode'); setScanned(false); return; }
      setItem(found);
    } catch {
      Alert.alert('Error', 'Item not found');
      setScanned(false);
    }
  };

  const handleSubmit = async () => {
    if (!item || !qty) { Alert.alert('Error', 'Scan an item and enter quantity'); return; }
    const quantity = parseFloat(qty);
    if (isNaN(quantity) || quantity <= 0) { Alert.alert('Error', 'Enter a valid quantity'); return; }
    setLoading(true);
    try {
      await wasteApi.create({
        item_id: item.id,
        item_name: item.name,
        quantity,
        unit: item.unit,
        reason,
        notes: notes || undefined,
        waste_date: new Date().toISOString(),
      });
      Alert.alert('Waste Logged', `${quantity} ${item.unit} of ${item.name} logged as waste.`, [
        { text: 'Log Another', onPress: () => { setItem(null); setQty(''); setNotes(''); setScanned(false); } },
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to log waste');
    } finally {
      setLoading(false);
    }
  };

  if (scanning) {
    if (!permission?.granted) {
      requestPermission();
      return <View style={styles.center}><ActivityIndicator color={colors.primary.DEFAULT} /></View>;
    }
    return (
      <View style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleScan}
          barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'] }}
        />
        <View style={styles.overlay}>
          <View style={styles.frame} />
          <Text style={styles.scanHint}>Scan item barcode</Text>
        </View>
        <Button mode="contained" onPress={() => { setScanning(false); setScanned(false); }} style={styles.cancelBtn}>
          Cancel
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Button
          mode="contained"
          icon="barcode-scan"
          onPress={() => { setScanned(false); setScanning(true); }}
          style={styles.scanBtn}
        >
          {item ? 'Scan Different Item' : 'Scan Item Barcode'}
        </Button>

        {item && (
          <Card style={styles.itemCard}>
            <Card.Content>
              <View style={styles.itemRow}>
                <MaterialCommunityIcons name="package-variant" size={32} color={colors.danger.DEFAULT} />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemUnit}>{item.unit} • {item.sku || item.barcode || ''}</Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        <Text style={styles.sectionTitle}>Reason for Waste</Text>
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
          label={`Quantity Wasted${item ? ` (${item.unit})` : ''}`}
          value={qty}
          onChangeText={setQty}
          keyboardType="numeric"
          mode="outlined"
          right={item ? <TextInput.Affix text={item.unit} /> : undefined}
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
          disabled={loading || !item || !qty}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  frame: { width: 260, height: 200, borderWidth: 3, borderColor: '#fff', borderRadius: 12 },
  scanHint: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: spacing.xl },
  cancelBtn: { position: 'absolute', bottom: spacing.xl, left: spacing.lg, right: spacing.lg },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  scanBtn: { backgroundColor: colors.primary.DEFAULT, marginBottom: spacing.lg },
  itemCard: { marginBottom: spacing.lg, ...shadows.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemInfo: { marginLeft: spacing.md },
  itemName: { fontSize: 17, fontWeight: '600', color: colors.text.primary },
  itemUnit: { fontSize: 13, color: colors.text.tertiary, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md },
  reasonCard: { marginBottom: spacing.lg, ...shadows.sm },
  reasonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  reasonLabel: { flex: 1, fontSize: 15, color: colors.text.secondary, marginLeft: spacing.md },
  reasonActive: { color: colors.danger.DEFAULT, fontWeight: '600' },
  input: { marginBottom: spacing.md, backgroundColor: colors.card },
  submitBtn: { backgroundColor: colors.danger.DEFAULT },
});

export default WasteLogScreen;
