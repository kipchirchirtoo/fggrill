import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, TextInput, Card, ActivityIndicator } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { inventoryApi } from '../../api/inventory.api';

const StockIntakeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [item, setItem] = useState<any>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [scanned, setScanned] = useState(false);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setScanning(false);
    setLookupLoading(true);
    try {
      const found = await inventoryApi.searchByBarcode(data);
      if (!found) {
        Alert.alert('Not Found', `No item found for barcode: ${data}`, [
          { text: 'Try Again', onPress: () => { setScanned(false); setScanning(true); } },
          { text: 'Cancel' },
        ]);
        return;
      }
      setItem(found);
      setQuantity('');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Item not found');
      setScanned(false);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!item || !quantity) { Alert.alert('Error', 'Scan an item and enter quantity'); return; }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) { Alert.alert('Error', 'Enter a valid quantity'); return; }
    setLoading(true);
    try {
      await inventoryApi.addStock(item.id, qty, notes || undefined);
      Alert.alert('Success', `Added ${qty} ${item.unit} of ${item.name}`, [
        { text: 'Scan Another', onPress: () => { setItem(null); setQuantity(''); setNotes(''); setScanned(false); } },
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to record intake');
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary.DEFAULT} /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="camera-off" size={60} color={colors.danger.DEFAULT} />
        <Text style={styles.permText}>Camera access is required to scan barcodes</Text>
        <Button mode="contained" onPress={requestPermission} style={{ marginTop: 16 }}>
          Grant Permission
        </Button>
      </View>
    );
  }

  if (scanning) {
    return (
      <View style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'] }}
        />
        <View style={styles.overlay}>
          <View style={styles.frame} />
          <Text style={styles.scanHint}>Align barcode within the frame</Text>
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
        {lookupLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary.DEFAULT} />
            <Text style={styles.loadingText}>Looking up item…</Text>
          </View>
        ) : item ? (
          <Card style={styles.itemCard}>
            <Card.Content>
              <View style={styles.itemRow}>
                <MaterialCommunityIcons name="package-variant" size={36} color={colors.primary.DEFAULT} />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemSku}>{item.sku || item.barcode || ''}</Text>
                  <Text style={styles.itemStock}>
                    Current stock: {item.quantity ?? item.current_stock ?? '—'} {item.unit}
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        ) : (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="barcode-scan" size={80} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>Scan a Barcode</Text>
            <Text style={styles.emptyText}>Tap the button below to scan an inventory item barcode</Text>
          </View>
        )}

        <Button
          mode={item ? 'outlined' : 'contained'}
          icon="barcode-scan"
          onPress={() => { setScanned(false); setScanning(true); }}
          style={[styles.scanBtn, !item && { backgroundColor: colors.primary.DEFAULT }]}
          labelStyle={!item ? { color: colors.primary.foreground } : {}}
        >
          {item ? 'Scan Different Item' : 'Start Scanning'}
        </Button>

        {item && (
          <>
            <TextInput
              label={`Quantity Received (${item.unit})`}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              mode="outlined"
              style={styles.input}
              right={<TextInput.Affix text={item.unit} />}
            />
            <TextInput
              label="Notes (Optional)"
              value={notes}
              onChangeText={setNotes}
              mode="outlined"
              multiline
              numberOfLines={2}
              style={styles.input}
            />
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading || !quantity}
              style={styles.submitBtn}
              icon="check-circle"
            >
              Record Stock Intake
            </Button>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permText: { fontSize: 15, color: colors.text.secondary, textAlign: 'center', marginTop: 12 },
  scroll: { padding: 16, paddingBottom: 100 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  frame: { width: 260, height: 260, borderWidth: 3, borderColor: '#fff', borderRadius: 12 },
  scanHint: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 24, textAlign: 'center', paddingHorizontal: 24 },
  cancelBtn: { position: 'absolute', bottom: 32, left: 16, right: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: colors.text.primary, marginTop: 16 },
  emptyText: { fontSize: 14, color: colors.text.tertiary, marginTop: 8, textAlign: 'center' },
  itemCard: { marginBottom: 16, ...shadows.md },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemName: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
  itemSku: { fontSize: 13, color: colors.text.tertiary, marginTop: 2 },
  itemStock: { fontSize: 14, color: colors.success.DEFAULT, marginTop: 4, fontWeight: '500' },
  scanBtn: { marginBottom: 16 },
  input: { marginBottom: 12, backgroundColor: colors.card },
  submitBtn: { backgroundColor: colors.success.DEFAULT },
  loadingText: { fontSize: 14, color: colors.text.tertiary, marginTop: 12 },
});

export default StockIntakeScreen;
