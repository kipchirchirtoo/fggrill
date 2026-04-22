/**
 * ReceivingScreen
 * 
 * Central Store Receiving Module
 * Allows central storekeepers to:
 * - Select existing items or create new items
 * - Scan existing barcodes or generate new ones
 * - Print barcode labels
 * - Record item receipt
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, TextInput, Card, ActivityIndicator, Chip, Divider, Menu } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { inventoryApi } from '../../api/inventory.api';

interface Props {
  navigation: any;
}

type ReceivingMode = 'select' | 'create';

const ReceivingScreen: React.FC<Props> = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ReceivingMode>('select');
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  
  // Item selection/creation
  const [items, setItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  
  // New item form
  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemUnit, setItemUnit] = useState('');
  const [itemQuantity, setItemQuantity] = useState('');
  
  // Barcode
  const [barcode, setBarcode] = useState('');
  const [barcodeGenerated, setBarcodeGenerated] = useState(false);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [generatingBarcode, setGeneratingBarcode] = useState(false);

  // Load items for selection
  useEffect(() => {
    if (mode === 'select') {
      loadItems();
    }
  }, [mode]);

  const loadItems = async () => {
    setItemsLoading(true);
    try {
      const data = await inventoryApi.list();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load items:', e);
    } finally {
      setItemsLoading(false);
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setScanning(false);
    setBarcode(data);
    
    // Check if barcode already exists
    try {
      const found = await inventoryApi.searchByBarcode(data);
      if (found) {
        Alert.alert(
          'Barcode Exists',
          `This barcode is already assigned to: ${found.name}`,
          [
            { text: 'Use This Item', onPress: () => { setSelectedItem(found); setMode('select'); } },
            { text: 'Scan Different', onPress: () => { setBarcode(''); setScanned(false); setScanning(true); } },
            { text: 'Cancel' },
          ]
        );
      }
    } catch (e) {
      // Barcode not found, can use it
      console.log('Barcode available for use');
    }
  };

  const handleGenerateBarcode = async () => {
    setGeneratingBarcode(true);
    try {
      // Call API to generate unique barcode
      const response = await inventoryApi.generateBarcode();
      setBarcode(response.barcode || response.barcode_value);
      setBarcodeGenerated(true);
      Alert.alert('Success', 'Barcode generated successfully');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to generate barcode');
    } finally {
      setGeneratingBarcode(false);
    }
  };

  const handlePrintLabel = () => {
    Alert.alert(
      'Print Label',
      'Barcode label printing will be available when connected to a label printer.',
      [{ text: 'OK' }]
    );
  };

  const handleSubmit = async () => {
    if (mode === 'create') {
      // Validate new item form
      if (!itemName || !itemCategory || !itemUnit || !itemQuantity) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }
      if (!barcode) {
        Alert.alert('Error', 'Please scan or generate a barcode');
        return;
      }
    } else {
      // Validate item selection
      if (!selectedItem) {
        Alert.alert('Error', 'Please select an item');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'create') {
        // Create new item with barcode
        const payload = {
          name: itemName,
          description: itemDescription,
          category: itemCategory,
          unit: itemUnit,
          quantity: parseFloat(itemQuantity),
          barcode: barcode,
        };
        await inventoryApi.receiveItem(payload);
        Alert.alert('Success', `Item "${itemName}" received successfully`, [
          { text: 'Receive Another', onPress: resetForm },
          { text: 'Done', onPress: () => navigation.goBack() },
        ]);
      } else {
        // Receive existing item
        const payload = {
          item_id: selectedItem.id,
          barcode: barcode || selectedItem.barcode,
        };
        await inventoryApi.receiveItem(payload);
        Alert.alert('Success', `Item "${selectedItem.name}" received successfully`, [
          { text: 'Receive Another', onPress: resetForm },
          { text: 'Done', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to receive item');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedItem(null);
    setItemName('');
    setItemDescription('');
    setItemCategory('');
    setItemUnit('');
    setItemQuantity('');
    setBarcode('');
    setBarcodeGenerated(false);
    setScanned(false);
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      </View>
    );
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
          barcodeScannerSettings={{
            barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'],
          }}
        />
        <View style={styles.overlay}>
          <View style={styles.frame} />
          <Text style={styles.scanHint}>Align barcode within the frame</Text>
        </View>
        <Button
          mode="contained"
          onPress={() => {
            setScanning(false);
            setScanned(false);
          }}
          style={styles.cancelBtn}
        >
          Cancel
        </Button>
      </View>
    );
  }

  const filteredItems = items.filter((item) =>
    item.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Mode Selection */}
        <Card style={styles.modeCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Receiving Mode</Text>
            <View style={styles.modeRow}>
              <Chip
                selected={mode === 'select'}
                onPress={() => setMode('select')}
                style={[styles.modeChip, mode === 'select' && styles.modeChipSelected]}
                textStyle={mode === 'select' ? styles.modeChipTextSelected : {}}
              >
                Select Existing Item
              </Chip>
              <Chip
                selected={mode === 'create'}
                onPress={() => setMode('create')}
                style={[styles.modeChip, mode === 'create' && styles.modeChipSelected]}
                textStyle={mode === 'create' ? styles.modeChipTextSelected : {}}
              >
                Create New Item
              </Chip>
            </View>
          </Card.Content>
        </Card>

        {/* Select Existing Item Mode */}
        {mode === 'select' && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Select Item</Text>
              <TextInput
                label="Search items"
                value={searchQuery}
                onChangeText={setSearchQuery}
                mode="outlined"
                style={styles.input}
                left={<TextInput.Icon icon="magnify" />}
              />
              {itemsLoading ? (
                <ActivityIndicator color={colors.primary.DEFAULT} style={{ marginTop: 16 }} />
              ) : (
                <View style={styles.itemsList}>
                  {filteredItems.slice(0, 5).map((item) => (
                    <Card
                      key={item.id}
                      style={[
                        styles.itemCard,
                        selectedItem?.id === item.id && styles.itemCardSelected,
                      ]}
                      onPress={() => setSelectedItem(item)}
                    >
                      <Card.Content>
                        <View style={styles.itemRow}>
                          <MaterialCommunityIcons
                            name="package-variant"
                            size={24}
                            color={
                              selectedItem?.id === item.id
                                ? colors.primary.DEFAULT
                                : colors.text.tertiary
                            }
                          />
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            <Text style={styles.itemDetails}>
                              {item.category} • {item.unit}
                            </Text>
                          </View>
                          {selectedItem?.id === item.id && (
                            <MaterialCommunityIcons
                              name="check-circle"
                              size={24}
                              color={colors.primary.DEFAULT}
                            />
                          )}
                        </View>
                      </Card.Content>
                    </Card>
                  ))}
                </View>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Create New Item Mode */}
        {mode === 'create' && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>New Item Details</Text>
              <TextInput
                label="Item Name *"
                value={itemName}
                onChangeText={setItemName}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label="Description"
                value={itemDescription}
                onChangeText={setItemDescription}
                mode="outlined"
                multiline
                numberOfLines={2}
                style={styles.input}
              />
              <TextInput
                label="Category *"
                value={itemCategory}
                onChangeText={setItemCategory}
                mode="outlined"
                style={styles.input}
                right={<TextInput.Icon icon="chevron-down" />}
              />
              <TextInput
                label="Unit *"
                value={itemUnit}
                onChangeText={setItemUnit}
                mode="outlined"
                style={styles.input}
                placeholder="e.g., kg, pcs, liters"
              />
              <TextInput
                label="Initial Quantity *"
                value={itemQuantity}
                onChangeText={setItemQuantity}
                mode="outlined"
                keyboardType="numeric"
                style={styles.input}
              />
            </Card.Content>
          </Card>
        )}

        {/* Barcode Section */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Barcode</Text>
            {barcode ? (
              <View style={styles.barcodeDisplay}>
                <MaterialCommunityIcons name="barcode" size={48} color={colors.success.DEFAULT} />
                <Text style={styles.barcodeValue}>{barcode}</Text>
                {barcodeGenerated && (
                  <Chip icon="check" style={styles.generatedChip}>
                    Generated
                  </Chip>
                )}
              </View>
            ) : (
              <View style={styles.emptyBarcode}>
                <MaterialCommunityIcons
                  name="barcode-scan"
                  size={48}
                  color={colors.text.tertiary}
                />
                <Text style={styles.emptyBarcodeText}>No barcode assigned</Text>
              </View>
            )}

            <View style={styles.barcodeActions}>
              <Button
                mode="outlined"
                icon="barcode-scan"
                onPress={() => {
                  setScanned(false);
                  setScanning(true);
                }}
                style={styles.barcodeBtn}
              >
                Scan Barcode
              </Button>
              <Button
                mode="outlined"
                icon="auto-fix"
                onPress={handleGenerateBarcode}
                loading={generatingBarcode}
                disabled={generatingBarcode}
                style={styles.barcodeBtn}
              >
                Generate
              </Button>
            </View>

            {barcode && (
              <Button
                mode="text"
                icon="printer"
                onPress={handlePrintLabel}
                style={{ marginTop: 8 }}
              >
                Print Label
              </Button>
            )}
          </Card.Content>
        </Card>

        {/* Submit Button */}
        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading || (mode === 'select' && !selectedItem) || !barcode}
          style={styles.submitBtn}
          icon="check-circle"
        >
          Receive Item
        </Button>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permText: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: 12,
  },
  scroll: { padding: 16, paddingBottom: 100 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  frame: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 12,
  },
  scanHint: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  cancelBtn: { position: 'absolute', bottom: 32, left: 16, right: 16 },
  modeCard: { marginBottom: 16, ...shadows.sm },
  card: { marginBottom: 16, ...shadows.sm },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeChip: { flex: 1 },
  modeChipSelected: { backgroundColor: colors.primary.DEFAULT },
  modeChipTextSelected: { color: colors.primary.foreground },
  input: { marginBottom: 12, backgroundColor: colors.card },
  itemsList: { marginTop: 8 },
  itemCard: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemCardSelected: {
    borderColor: colors.primary.DEFAULT,
    borderWidth: 2,
    backgroundColor: colors.primary.DEFAULT + '10',
  },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  itemDetails: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  barcodeDisplay: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.success.DEFAULT + '10',
    borderRadius: 8,
    marginBottom: 12,
  },
  barcodeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 8,
    letterSpacing: 2,
  },
  generatedChip: {
    marginTop: 8,
    backgroundColor: colors.success.DEFAULT + '20',
  },
  emptyBarcode: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.muted.DEFAULT,
    borderRadius: 8,
    marginBottom: 12,
  },
  emptyBarcodeText: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: 8,
  },
  barcodeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  barcodeBtn: { flex: 1 },
  submitBtn: {
    backgroundColor: colors.success.DEFAULT,
    marginTop: 8,
  },
});

export default ReceivingScreen;
