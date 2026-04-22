/**
 * GRNScreen - Goods Receiving Note
 * 
 * Matches web app central-store/receiving exactly:
 * - Step 0: Setup (Supplier, PO, Invoice, Delivery Note)
 * - Step 1: Scanning (Barcode scan, manual catalog search)
 * - Unknown barcode handling with item creation
 * - Professional UI matching web dashboard
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  TextInput as RNTextInput,
} from 'react-native';
import { Text, TextInput, ActivityIndicator, Portal, Modal, Button } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { inventoryApi } from '../../api/inventory.api';
import apiClient from '../../api/client';
import { useAuthStore } from '../../stores/auth.store';

interface ScannedGRNItem {
  id: string;
  item_id: string;
  item_name: string;
  sku: string;
  unit: string;
  scanned_quantity: number;
  cost_price: number;
  added_via: 'scan' | 'manual';
}

interface Props {
  navigation: any;
}

const GRNScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [permission, requestPermission] = useCameraPermissions();
  
  // Steps: 0 = Setup, 1 = Scanning
  const [currentStep, setCurrentStep] = useState(0);
  
  // Camera Scanner State
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  
  // Setup State
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  
  // Form Data
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [poNumber, setPoNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  
  // Scanning State
  const [scannedItems, setScannedItems] = useState<ScannedGRNItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [lastScannedItem, setLastScannedItem] = useState<{ name: string; status: 'success' | 'error' } | null>(null);
  const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const barcodeInputRef = useRef<any>(null);
  
  // Master Catalog
  const [allCatalogItems, setAllCatalogItems] = useState<any[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [showCatalogResults, setShowCatalogResults] = useState(false);
  
  // Item Lookup Modal
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  // New Item Creation Form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [newItemCostPrice, setNewItemCostPrice] = useState('');
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  
  // Modals
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  
  // Loading & Success
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [grnData, setGrnData] = useState<any>(null);
  
  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
    
    loadSuppliers();
    loadCatalog();
  }, []);

  const loadSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      const data = await inventoryApi.suppliers();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load suppliers:', e);
      Alert.alert('Error', 'Failed to load suppliers');
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const loadCatalog = async () => {
    setIsLoadingCatalog(true);
    try {
      const data = await inventoryApi.list({ limit: 1000 });
      setAllCatalogItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load catalog:', e);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const handleStartScanning = () => {
    if (!selectedSupplier) {
      Alert.alert('Required', 'Please select a supplier');
      return;
    }
    setCurrentStep(1);
  };

  const handleBarcodeSubmit = async () => {
    const barcode = barcodeInput.trim();
    if (!barcode) return;

    console.log('🔍 Scanning barcode:', barcode);

    try {
      // Use 'search' parameter which searches across name, SKU, and barcode
      const data = await inventoryApi.list({ search: barcode, limit: 10 });
      const items = Array.isArray(data) ? data : [];

      console.log('📦 Found items:', items.length);

      if (items.length === 0) {
        console.log('❌ No items found for barcode:', barcode);
        // Barcode not found - show option to add to catalog
        Alert.alert(
          'Barcode Not Found',
          `Barcode "${barcode}" is not in the catalog. Would you like to add it as a new item?`,
          [
            {
              text: 'Add to Catalog',
              onPress: () => {
                setUnknownBarcode(barcode);
                setIsLookupOpen(true);
              }
            },
            {
              text: 'Try Again',
              onPress: () => {
                setBarcodeInput('');
              }
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
        return;
      }

      // Prioritize exact barcode match (case-insensitive)
      let item = items.find(i => i.barcode?.toLowerCase() === barcode.toLowerCase());
      
      console.log('🎯 Exact barcode match:', item ? item.name : 'none');
      
      // If no exact barcode match, try exact SKU match
      if (!item) {
        item = items.find(i => i.sku?.toLowerCase() === barcode.toLowerCase());
        console.log('🏷️ Exact SKU match:', item ? item.name : 'none');
      }
      
      // If still no match, use first result
      if (!item) {
        item = items[0];
        console.log('⚠️ Using first result:', item.name);
      }

      console.log('✅ Selected item:', item.name, '| SKU:', item.sku, '| Barcode:', item.barcode);

      processItemScan(item);
      setBarcodeInput('');
    } catch (err) {
      console.error('❌ Barcode scan error:', err);
      Alert.alert('Error', 'Failed to search for item');
    }
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setScanning(false);
    
    console.log('📷 Camera scanned barcode:', data);
    
    // Put the scanned barcode in the input box
    setBarcodeInput(data);
    
    // Automatically trigger search
    try {
      const items = await inventoryApi.list({ search: data, limit: 10 });
      const itemsArray = Array.isArray(items) ? items : [];

      if (itemsArray.length === 0) {
        // Barcode not found - show option to add to catalog
        Alert.alert(
          'Barcode Not Found',
          `Barcode "${data}" is not in the catalog. Would you like to add it as a new item?`,
          [
            {
              text: 'Add to Catalog',
              onPress: () => {
                setUnknownBarcode(data);
                setIsLookupOpen(true);
              }
            },
            {
              text: 'Scan Again',
              onPress: () => {
                setBarcodeInput('');
                setScanned(false);
                setScanning(true);
              }
            },
            {
              text: 'Cancel',
              onPress: () => {
                setBarcodeInput('');
                setScanned(false);
              },
              style: 'cancel'
            }
          ]
        );
        return;
      }

      // Prioritize exact barcode match
      let item = itemsArray.find(i => i.barcode?.toLowerCase() === data.toLowerCase());
      if (!item) {
        item = itemsArray.find(i => i.sku?.toLowerCase() === data.toLowerCase());
      }
      if (!item) {
        item = itemsArray[0];
      }

      // Auto-add the item
      processItemScan(item);
      setBarcodeInput('');
      setScanned(false);
    } catch (err) {
      console.error('Camera scan error:', err);
      Alert.alert('Error', 'Failed to process scanned barcode');
      setScanned(false);
    }
  };

  const processItemScan = (item: any) => {
    // For GRN, we're receiving items, so no stock validation needed
    addItemToSession(item);
    setScanStatus('success');
    setLastScannedItem({ name: item.name + ' (+1)', status: 'success' });
    setTimeout(() => setScanStatus('idle'), 500);
  };

  const addItemToSession = (item: any) => {
    // For GRN, we're receiving items, so no stock validation needed
    // item_id should be SKU (store_grn_items.item_id is VARCHAR accepting SKUs)
    const itemSku = item.sku || item.item_code;
    
    setScannedItems(prev => {
      const idx = prev.findIndex(i => i.item_id === itemSku);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], scanned_quantity: updated[idx].scanned_quantity + 1 };
        return updated;
      } else {
        return [...prev, {
          id: Math.random().toString(36).substr(2, 9),
          item_id: itemSku, // Use SKU as item_id
          item_name: item.name || item.item_name,
          sku: itemSku,
          unit: item.unit || item.unit_of_measure,
          scanned_quantity: 1,
          cost_price: Number(item.cost_price || item.unit_price || 0),
          added_via: 'scan' as const
        }];
      }
    });
  };

  const handleManualLookup = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    try {
      const data = await inventoryApi.list({ search: searchQuery });
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
      Alert.alert('Error', 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const selectItemFromLookup = async (item: any) => {
    setIsSearching(true);
    try {
      const fullItem = await inventoryApi.getById(item.id);
      if (fullItem) {
        processItemScan(fullItem);
        setIsLookupOpen(false);
        setSearchQuery('');
        setSearchResults([]);
        setShowCreateForm(false);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to load item details');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateNewItem = async () => {
    // Validate form
    if (!newItemName.trim()) {
      Alert.alert('Required', 'Please enter item name');
      return;
    }
    if (!newItemCategory.trim()) {
      Alert.alert('Required', 'Please enter category');
      return;
    }
    if (!newItemUnit.trim()) {
      Alert.alert('Required', 'Please enter unit of measure');
      return;
    }
    if (!newItemCostPrice.trim() || isNaN(Number(newItemCostPrice))) {
      Alert.alert('Required', 'Please enter valid cost price');
      return;
    }

    setIsCreatingItem(true);
    try {
      const payload = {
        item_name: newItemName.trim(),
        name: newItemName.trim(),
        description: newItemName.trim(),
        category: newItemCategory.trim(),
        unit_of_measure: newItemUnit.trim(),
        unit: newItemUnit.trim(),
        cost_price: Number(newItemCostPrice),
        retail_price: Number(newItemCostPrice),
        barcode: unknownBarcode,
        quantity: 0,
        reorder_level: 10,
        supplier: selectedSupplier?.name,
      };

      console.log('📝 Creating new item with payload:', JSON.stringify(payload, null, 2));
      const response = await inventoryApi.receiveItem(payload);
      console.log('✅ Item created response:', JSON.stringify(response, null, 2));
      
      // Backend returns: { success: true, data: { sku, item_name, ... } }
      // The simple_items table uses SKU as primary key, not UUID id
      // The store_grn_items.item_id field was migrated to VARCHAR to accept SKUs
      const createdItem = response.data || response;
      const createdItemSku = createdItem.sku;
      
      console.log('🔍 Extracted SKU:', createdItemSku);
      
      if (!createdItemSku) {
        console.error('❌ No SKU in response. Full response:', JSON.stringify(response, null, 2));
        Alert.alert('Error', 'Item created but SKU not returned. Please try adding it manually.');
        return;
      }
      
      // Add the newly created item to the scanned items
      // item_id should be the SKU (store_grn_items.item_id is VARCHAR, not UUID)
      const newItem: ScannedGRNItem = {
        id: Math.random().toString(36).substr(2, 9),
        item_id: createdItemSku, // Use SKU as item_id (store_grn_items.item_id accepts VARCHAR)
        item_name: newItemName.trim(),
        sku: createdItemSku,
        unit: newItemUnit.trim(),
        scanned_quantity: 1,
        cost_price: Number(newItemCostPrice),
        added_via: 'manual',
      };
      
      console.log('➕ Adding item to scanned list:', JSON.stringify(newItem, null, 2));
      setScannedItems(prev => [...prev, newItem]);
      
      // Reset form and close modal
      setNewItemName('');
      setNewItemCategory('');
      setNewItemUnit('');
      setNewItemCostPrice('');
      setShowCreateForm(false);
      setIsLookupOpen(false);
      setUnknownBarcode('');
      
      Alert.alert('Success', `Item "${newItemName}" created and added to receiving list`);
    } catch (err: any) {
      console.error('❌ Failed to create item:', err);
      console.error('Error response:', err.response?.data);
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to create item');
    } finally {
      setIsCreatingItem(false);
    }
  };

  const filteredCatalogItems = catalogSearch.trim()
    ? allCatalogItems.filter(i =>
        i.name?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
        i.sku?.toLowerCase().includes(catalogSearch.toLowerCase())
      ).slice(0, 10)
    : [];

  // Camera Scanner View
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
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraFrame} />
          <Text style={styles.cameraScanHint}>Align barcode within the frame</Text>
        </View>
        <Button
          mode="contained"
          onPress={() => {
            setScanning(false);
            setScanned(false);
          }}
          style={styles.cameraCancelBtn}
        >
          Cancel
        </Button>
      </View>
    );
  }

  const handleSubmit = async () => {
    if (scannedItems.length === 0) {
      Alert.alert('No Items', 'Please add items to receive');
      return;
    }

    console.log('📋 Submitting GRN with scanned items:', JSON.stringify(scannedItems, null, 2));

    // Validate that all items have item_id
    const itemsWithoutId = scannedItems.filter(item => !item.item_id);
    if (itemsWithoutId.length > 0) {
      console.error('❌ Items without item_id:', JSON.stringify(itemsWithoutId, null, 2));
      Alert.alert(
        'Invalid Items',
        `${itemsWithoutId.length} item(s) are missing item ID. Please remove them and try again.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        supplier_id: selectedSupplier?.id,
        grn_date: new Date().toISOString().split('T')[0],
        delivery_note_number: deliveryNote || undefined,
        invoice_number: invoiceNumber || undefined,
        po_number: poNumber || undefined,
        items: scannedItems.map(item => {
          const mappedItem = {
            item_id: item.item_id,
            quantity_received: item.scanned_quantity,
            unit_price: item.cost_price,
            unit_of_measure: item.unit,
            quantity_accepted: item.scanned_quantity,
            quality_status: 'accepted'
          };
          console.log('🔄 Mapping item:', JSON.stringify({ original: item, mapped: mappedItem }, null, 2));
          return mappedItem;
        })
      };

      console.log('📤 GRN Payload:', JSON.stringify(payload, null, 2));

      const res = await apiClient.post('/procurement/grn', payload);
      setGrnData(res.data);
      setShowSuccess(true);
    } catch (e: any) {
      console.error('❌ Failed to create GRN:', e);
      console.error('Error details:', e.response?.data);
      Alert.alert('Error', e.response?.data?.error || 'Failed to create GRN');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => currentStep === 0 ? navigation.goBack() : setCurrentStep(0)}
            style={styles.backBtn}
          >
            <MaterialCommunityIcons name='arrow-left' size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Goods Receiving</Text>
            <Text style={styles.headerSubtitle}>
              {currentStep === 0 ? 'Setup delivery details' : 'Scan items to receive'}
            </Text>
          </View>
          {currentStep === 1 && (
            <View style={styles.stepIndicator}>
              <Text style={styles.stepText}>Step 2/2</Text>
            </View>
          )}
        </View>

        {/* STEP 0: SETUP */}
        {currentStep === 0 && (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps='handled'
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.setupCard}>
              <View style={styles.setupHeader}>
                <MaterialCommunityIcons name='package-variant' size={28} color={colors.primary.DEFAULT} />
                <Text style={styles.setupTitle}>Delivery Details</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Supplier *</Text>
                <TouchableOpacity
                  style={styles.selector}
                  onPress={() => setShowSupplierPicker(true)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name='store' size={20} color={colors.text.secondary} />
                  <Text style={[styles.selectorText, !selectedSupplier && styles.selectorPlaceholder]}>
                    {selectedSupplier 
                      ? selectedSupplier.name
                      : 'Select supplier'}
                  </Text>
                  <MaterialCommunityIcons name='chevron-down' size={20} color={colors.text.tertiary} />
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>PO Number (Optional)</Text>
                <TextInput
                  value={poNumber}
                  onChangeText={setPoNumber}
                  placeholder='e.g. PO-2024-001'
                  style={styles.notesInput}
                  mode='outlined'
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary.DEFAULT}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Invoice Number (Optional)</Text>
                <TextInput
                  value={invoiceNumber}
                  onChangeText={setInvoiceNumber}
                  placeholder='e.g. INV-2024-001'
                  style={styles.notesInput}
                  mode='outlined'
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary.DEFAULT}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Delivery Note (Optional)</Text>
                <TextInput
                  value={deliveryNote}
                  onChangeText={setDeliveryNote}
                  placeholder='e.g. DN-9988'
                  style={styles.notesInput}
                  mode='outlined'
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary.DEFAULT}
                />
              </View>

              <TouchableOpacity
                style={[styles.startBtn, !selectedSupplier && styles.startBtnDisabled]}
                onPress={handleStartScanning}
                disabled={!selectedSupplier}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name='barcode-scan' size={20} color='#fff' />
                <Text style={styles.startBtnText}>Start Scanning Items</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* STEP 1: SCANNING */}
        {currentStep === 1 && (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Scanner Card */}
            <View style={[
              styles.scannerCard,
              scanStatus === 'success' && styles.scannerCardSuccess,
              scanStatus === 'error' && styles.scannerCardError,
            ]}>
              <MaterialCommunityIcons
                name="barcode-scan"
                size={48}
                color={scanStatus === 'success' ? colors.success.DEFAULT : scanStatus === 'error' ? colors.danger.DEFAULT : colors.primary.DEFAULT}
              />
              <Text style={styles.scannerTitle}>Scan to Receive</Text>
              <Text style={styles.scannerSubtitle}>Add items to goods receiving note</Text>

              {/* Catalog Search */}
              <View style={styles.catalogSearchContainer}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.text.tertiary} style={styles.catalogSearchIcon} />
                <RNTextInput
                  value={catalogSearch}
                  onChangeText={(text) => {
                    setCatalogSearch(text);
                    setShowCatalogResults(text.trim().length > 0);
                  }}
                  placeholder="Search master catalog..."
                  style={styles.catalogSearchInput}
                  placeholderTextColor={colors.text.tertiary}
                />
                {catalogSearch && (
                  <TouchableOpacity onPress={() => { setCatalogSearch(''); setShowCatalogResults(false); }}>
                    <MaterialCommunityIcons name="close-circle" size={20} color={colors.text.tertiary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Catalog Results Dropdown */}
              {showCatalogResults && filteredCatalogItems.length > 0 && (
                <View style={styles.catalogResults}>
                  {filteredCatalogItems.map(item => (
                    <React.Fragment key={item.id}>
                      <TouchableOpacity
                        style={styles.catalogResultItem}
                        onPress={() => {
                          processItemScan(item);
                          setCatalogSearch('');
                          setShowCatalogResults(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.catalogResultContent}>
                          <Text style={styles.catalogResultName}>{item.name}</Text>
                          <Text style={styles.catalogResultMeta}>
                            {item.sku} | Stock: {item.stock_quantity || item.current_stock || 0}
                          </Text>
                        </View>
                        <MaterialCommunityIcons name="plus-circle" size={24} color={colors.primary.DEFAULT} />
                      </TouchableOpacity>
                    </React.Fragment>
                  ))}
                </View>
              )}

              <Text style={styles.orText}>SCAN WITH CAMERA</Text>

              {/* Barcode Scanner Button */}
              <TouchableOpacity
                style={styles.scannerButton}
                onPress={() => {
                  if (!permission) {
                    Alert.alert('Camera Permission', 'Requesting camera permission...');
                    requestPermission();
                    return;
                  }
                  if (!permission.granted) {
                    Alert.alert(
                      'Camera Permission Required',
                      'Please grant camera permission to scan barcodes',
                      [
                        { text: 'Cancel' },
                        { text: 'Grant Permission', onPress: requestPermission },
                      ]
                    );
                    return;
                  }
                  setScanning(true);
                  setScanned(false);
                }}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="camera" size={32} color="#fff" />
                <Text style={styles.scannerButtonText}>Open Camera Scanner</Text>
              </TouchableOpacity>

              <Text style={styles.orText}>OR TYPE MANUALLY</Text>

              {/* Barcode Input */}
              <View style={styles.barcodeInputContainer}>
                <MaterialCommunityIcons name="barcode-scan" size={24} color={colors.text.tertiary} style={styles.barcodeIcon} />
                <RNTextInput
                  ref={barcodeInputRef}
                  value={barcodeInput}
                  onChangeText={setBarcodeInput}
                  onSubmitEditing={handleBarcodeSubmit}
                  placeholder="Scan or type barcode..."
                  style={styles.barcodeInput}
                  placeholderTextColor={colors.text.tertiary}
                  returnKeyType="done"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus={true}
                />
                {barcodeInput.length > 0 && (
                  <TouchableOpacity onPress={() => setBarcodeInput('')} style={styles.barcodeClearBtn}>
                    <MaterialCommunityIcons name="close-circle" size={20} color={colors.text.tertiary} />
                  </TouchableOpacity>
                )}
              </View>

              {lastScannedItem && (
                <View style={[
                  styles.lastScannedBadge,
                  lastScannedItem.status === 'error' && styles.lastScannedBadgeError,
                ]}>
                  <Text style={styles.lastScannedText}>{lastScannedItem.name}</Text>
                </View>
              )}
            </View>

            {/* Scanned Items List */}
            <View style={styles.scannedItemsCard}>
              <View style={styles.scannedItemsHeader}>
                <Text style={styles.scannedItemsTitle}>Received Items</Text>
                <Text style={styles.scannedItemsCount}>{scannedItems.length} items</Text>
              </View>

              {scannedItems.length === 0 ? (
                <View style={styles.emptyScannedItems}>
                  <MaterialCommunityIcons name="package-variant-closed" size={48} color={colors.text.tertiary} />
                  <Text style={styles.emptyScannedText}>No items scanned yet</Text>
                </View>
              ) : (
                <>
                  {scannedItems.map(item => (
                    <React.Fragment key={item.id}>
                      <View style={styles.scannedItem}>
                        <View style={styles.scannedItemIcon}>
                          <MaterialCommunityIcons name="package-variant" size={20} color={colors.primary.DEFAULT} />
                        </View>
                        <View style={styles.scannedItemContent}>
                          <Text style={styles.scannedItemName}>{item.item_name}</Text>
                          <Text style={styles.scannedItemMeta}>
                            SKU: {item.sku} | Cost: ${item.cost_price.toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.quantityControls}>
                          <TouchableOpacity
                            onPress={() => {
                              if (item.scanned_quantity > 1) {
                                setScannedItems(prev => prev.map(i =>
                                  i.id === item.id ? { ...i, scanned_quantity: i.scanned_quantity - 1 } : i
                                ));
                              } else {
                                setScannedItems(prev => prev.filter(i => i.id !== item.id));
                              }
                            }}
                            style={styles.quantityBtn}
                            activeOpacity={0.7}
                          >
                            <MaterialCommunityIcons name="minus" size={16} color={colors.text.secondary} />
                          </TouchableOpacity>
                          <Text style={styles.quantityValue}>{item.scanned_quantity}</Text>
                          <TouchableOpacity
                            onPress={() => {
                              setScannedItems(prev => prev.map(i =>
                                i.id === item.id ? { ...i, scanned_quantity: i.scanned_quantity + 1 } : i
                              ));
                            }}
                            style={styles.quantityBtn}
                            activeOpacity={0.7}
                          >
                            <MaterialCommunityIcons name="plus" size={16} color={colors.text.secondary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </React.Fragment>
                  ))}
                </>
              )}
            </View>

            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>GRN Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Supplier</Text>
                <Text style={styles.summaryValue}>
                  {selectedSupplier?.name}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Items</Text>
                <Text style={styles.summaryValue}>
                  {scannedItems.reduce((a, b) => a + b.scanned_quantity, 0)}
                </Text>
              </View>
              {invoiceNumber && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Invoice</Text>
                  <Text style={styles.summaryValue}>{invoiceNumber}</Text>
                </View>
              )}
              {deliveryNote && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery Note</Text>
                  <Text style={styles.summaryValue}>{deliveryNote}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.createBtn, (scannedItems.length === 0 || isSubmitting) && styles.createBtnDisabled]}
                onPress={handleSubmit}
                disabled={scannedItems.length === 0 || isSubmitting}
                activeOpacity={0.7}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
                    <Text style={styles.createBtnText}>Complete Receiving</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </Animated.View>

      {/* Supplier Picker Modal */}
      <Portal>
        <Modal
          visible={showSupplierPicker}
          onDismiss={() => setShowSupplierPicker(false)}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Supplier</Text>
            <TouchableOpacity onPress={() => setShowSupplierPicker(false)}>
              <MaterialCommunityIcons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {loadingSuppliers ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
              </View>
            ) : (
              <>
                {suppliers.map(supplier => (
                  <React.Fragment key={supplier.id}>
                    <TouchableOpacity
                      style={[
                        styles.modalItem,
                        selectedSupplier?.id === supplier.id && styles.modalItemSelected,
                      ]}
                      onPress={() => {
                        setSelectedSupplier(supplier);
                        setShowSupplierPicker(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name="store"
                        size={24}
                        color={selectedSupplier?.id === supplier.id ? colors.primary.DEFAULT : colors.text.tertiary}
                      />
                      <Text style={[
                        styles.modalItemText,
                        selectedSupplier?.id === supplier.id && styles.modalItemTextSelected,
                      ]}>
                        {supplier.name}
                      </Text>
                      {selectedSupplier?.id === supplier.id && (
                        <MaterialCommunityIcons name="check-circle" size={24} color={colors.primary.DEFAULT} />
                      )}
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </>
            )}
          </ScrollView>
        </Modal>
      </Portal>

      {/* Unknown Barcode Lookup Modal */}
      <Portal>
        <Modal
          visible={isLookupOpen}
          onDismiss={() => {
            setIsLookupOpen(false);
            setShowCreateForm(false);
            setNewItemName('');
            setNewItemCategory('');
            setNewItemUnit('');
            setNewItemCostPrice('');
          }}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {showCreateForm ? 'Create New Item' : 'Barcode Not Found'}
            </Text>
            <TouchableOpacity onPress={() => {
              setIsLookupOpen(false);
              setShowCreateForm(false);
              setNewItemName('');
              setNewItemCategory('');
              setNewItemUnit('');
              setNewItemCostPrice('');
            }}>
              <MaterialCommunityIcons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.lookupContent} showsVerticalScrollIndicator={false}>
            <View style={styles.lookupBarcodeDisplay}>
              <MaterialCommunityIcons name="barcode" size={48} color={colors.text.tertiary} />
              <Text style={styles.lookupBarcodeText}>{unknownBarcode}</Text>
            </View>

            {!showCreateForm ? (
              <>
                {/* Initial Options */}
                <Text style={styles.lookupText}>
                  This barcode is not in the catalog. You can:
                </Text>

                {/* Option 1: Create New Item */}
                <TouchableOpacity
                  style={styles.lookupCreateBtn}
                  onPress={() => setShowCreateForm(true)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="plus-circle" size={24} color="#fff" />
                  <Text style={styles.lookupCreateBtnText}>Create New Item with this Barcode</Text>
                </TouchableOpacity>

                <Text style={styles.lookupOrText}>OR</Text>

                {/* Option 2: Search Existing Items */}
                <Text style={styles.lookupText}>
                  Search for an existing item to assign this barcode:
                </Text>
                <View style={styles.lookupSearchContainer}>
                  <MaterialCommunityIcons name="magnify" size={20} color={colors.text.tertiary} style={styles.lookupSearchIcon} />
                  <RNTextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search item..."
                    style={styles.lookupSearchInput}
                    placeholderTextColor={colors.text.tertiary}
                    onSubmitEditing={handleManualLookup}
                    returnKeyType="search"
                  />
                </View>
                <TouchableOpacity
                  style={styles.lookupSearchBtn}
                  onPress={handleManualLookup}
                  disabled={isSearching}
                  activeOpacity={0.7}
                >
                  {isSearching ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="magnify" size={20} color="#fff" />
                      <Text style={styles.lookupSearchBtnText}>Search</Text>
                    </>
                  )}
                </TouchableOpacity>
                <View style={styles.lookupResults}>
                  {searchResults.map(item => (
                    <React.Fragment key={item.id}>
                      <TouchableOpacity
                        style={styles.lookupResultItem}
                        onPress={() => selectItemFromLookup(item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.lookupResultContent}>
                          <Text style={styles.lookupResultName}>{item.name}</Text>
                          <Text style={styles.lookupResultMeta}>
                            {item.sku} | Stock: {item.stock_quantity || item.current_stock || 0}
                          </Text>
                        </View>
                        <MaterialCommunityIcons name="plus-circle" size={24} color={colors.primary.DEFAULT} />
                      </TouchableOpacity>
                    </React.Fragment>
                  ))}
                </View>
              </>
            ) : (
              <>
                {/* Create New Item Form */}
                <Text style={styles.lookupText}>
                  Enter details for the new item:
                </Text>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Item Name *</Text>
                  <RNTextInput
                    value={newItemName}
                    onChangeText={setNewItemName}
                    placeholder="e.g. Fresh Tomatoes"
                    style={styles.formInput}
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Category *</Text>
                  <RNTextInput
                    value={newItemCategory}
                    onChangeText={setNewItemCategory}
                    placeholder="e.g. Vegetables, Meat, Dairy"
                    style={styles.formInput}
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Unit of Measure *</Text>
                  <RNTextInput
                    value={newItemUnit}
                    onChangeText={setNewItemUnit}
                    placeholder="e.g. kg, pcs, liters"
                    style={styles.formInput}
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Cost Price *</Text>
                  <RNTextInput
                    value={newItemCostPrice}
                    onChangeText={setNewItemCostPrice}
                    placeholder="0.00"
                    style={styles.formInput}
                    placeholderTextColor={colors.text.tertiary}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={styles.formBtnSecondary}
                    onPress={() => {
                      setShowCreateForm(false);
                      setNewItemName('');
                      setNewItemCategory('');
                      setNewItemUnit('');
                      setNewItemCostPrice('');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.formBtnSecondaryText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.formBtnPrimary, isCreatingItem && styles.formBtnDisabled]}
                    onPress={handleCreateNewItem}
                    disabled={isCreatingItem}
                    activeOpacity={0.7}
                  >
                    {isCreatingItem ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.formBtnPrimaryText}>Create & Add</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </Modal>
      </Portal>

      {/* Success Modal */}
      <Portal>
        <Modal
          visible={showSuccess}
          onDismiss={() => setShowSuccess(false)}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.successContent}>
            <View style={styles.successIcon}>
              <MaterialCommunityIcons name="check-circle" size={80} color={colors.success.DEFAULT} />
            </View>
            <Text style={styles.successTitle}>GRN Created!</Text>
            <Text style={styles.successMessage}>
              Goods Receiving Note #{grnData?.grn_number || grnData?.id} has been created successfully
            </Text>
            
            <View style={styles.grnInfoCard}>
              <View style={styles.grnInfoRow}>
                <MaterialCommunityIcons name="store" size={20} color={colors.primary.DEFAULT} />
                <Text style={styles.grnInfoLabel}>Supplier:</Text>
                <Text style={styles.grnInfoValue}>{selectedSupplier?.name}</Text>
              </View>
              <View style={styles.grnInfoRow}>
                <MaterialCommunityIcons name="package-variant" size={20} color={colors.primary.DEFAULT} />
                <Text style={styles.grnInfoLabel}>Items:</Text>
                <Text style={styles.grnInfoValue}>{scannedItems.reduce((a, b) => a + b.scanned_quantity, 0)}</Text>
              </View>
            </View>

            <View style={styles.successActions}>
              <TouchableOpacity
                style={styles.successBtnSecondary}
                onPress={() => {
                  setShowSuccess(false);
                  setCurrentStep(0);
                  setScannedItems([]);
                  setSelectedSupplier(null);
                  setPoNumber('');
                  setInvoiceNumber('');
                  setDeliveryNote('');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.successBtnSecondaryText}>Receive More</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.successBtnPrimary}
                onPress={() => {
                  setShowSuccess(false);
                  navigation.goBack();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.successBtnPrimaryText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </Portal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    marginRight: spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  stepIndicator: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary.DEFAULT + '20',
    borderRadius: 16,
  },
  stepText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary.DEFAULT,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  setupCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.xl,
    ...shadows.md,
  },
  setupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  setupTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  selectorText: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
  },
  selectorPlaceholder: {
    color: colors.text.tertiary,
  },
  notesInput: {
    backgroundColor: '#fff',
    fontSize: 15,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 12,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  startBtnDisabled: {
    backgroundColor: colors.muted.DEFAULT,
    opacity: 0.5,
  },
  startBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  scannerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary.DEFAULT,
    ...shadows.md,
  },
  scannerCardSuccess: {
    borderColor: colors.success.DEFAULT,
    backgroundColor: colors.success.DEFAULT + '10',
  },
  scannerCardError: {
    borderColor: colors.danger.DEFAULT,
    backgroundColor: colors.danger.DEFAULT + '10',
  },
  scannerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  scannerSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  catalogSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.muted.DEFAULT,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  catalogSearchIcon: {
    marginRight: spacing.sm,
  },
  catalogSearchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    backgroundColor: 'transparent',
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
    height: 40,
  },
  catalogResults: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: spacing.sm,
    maxHeight: 250,
    ...shadows.lg,
    overflow: 'hidden',
  },
  catalogResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  catalogResultContent: {
    flex: 1,
  },
  catalogResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  catalogResultMeta: {
    fontSize: 11,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
  },
  orText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    marginVertical: spacing.sm,
  },
  scannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.DEFAULT,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: 16,
    marginVertical: spacing.md,
    gap: spacing.md,
    ...shadows.md,
  },
  scannerButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  barcodeInputContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary.DEFAULT,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  barcodeIcon: {
    marginRight: spacing.sm,
  },
  barcodeInput: {
    flex: 1,
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.text.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  barcodeClearBtn: {
    padding: spacing.xs,
  },
  lastScannedBadge: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: '#fff',
    borderRadius: 8,
    ...shadows.sm,
  },
  lastScannedBadgeError: {
    backgroundColor: colors.danger.DEFAULT + '20',
  },
  lastScannedText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  scannedItemsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    ...shadows.md,
    overflow: 'hidden',
  },
  scannedItemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scannedItemsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  scannedItemsCount: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  emptyScannedItems: {
    alignItems: 'center',
    padding: spacing.xl * 2,
  },
  emptyScannedText: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: spacing.md,
  },
  scannedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  scannedItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.muted.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  scannedItemContent: {
    flex: 1,
  },
  scannedItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  scannedItemMeta: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted.DEFAULT,
    borderRadius: 8,
    padding: 4,
    gap: spacing.sm,
  },
  quantityBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary.DEFAULT,
    minWidth: 40,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.xl,
    ...shadows.md,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.success.DEFAULT,
    borderRadius: 12,
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  createBtnDisabled: {
    backgroundColor: colors.muted.DEFAULT,
    opacity: 0.5,
  },
  createBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  modal: {
    backgroundColor: '#fff',
    marginHorizontal: spacing.lg,
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalLoading: {
    padding: spacing.xl * 2,
    alignItems: 'center',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  modalItemSelected: {
    backgroundColor: colors.primary.DEFAULT + '10',
  },
  modalItemText: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
  },
  modalItemTextSelected: {
    fontWeight: '600',
    color: colors.primary.DEFAULT,
  },
  lookupContent: {
    padding: spacing.lg,
  },
  lookupBarcodeDisplay: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.muted.DEFAULT,
    borderRadius: 12,
    marginBottom: spacing.lg,
  },
  lookupBarcodeText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: spacing.sm,
  },
  lookupText: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  lookupCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.success.DEFAULT,
    borderRadius: 12,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  lookupCreateBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  lookupOrText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.tertiary,
    textAlign: 'center',
    marginVertical: spacing.md,
  },
  lookupSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted.DEFAULT,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  lookupSearchIcon: {
    marginRight: spacing.sm,
  },
  lookupSearchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    backgroundColor: 'transparent',
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
    height: 40,
  },
  lookupSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 12,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  lookupSearchBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  lookupResults: {
    maxHeight: 250,
  },
  lookupResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.muted.DEFAULT,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  lookupResultContent: {
    flex: 1,
  },
  lookupResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  lookupResultMeta: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  // Create Item Form Styles
  formGroup: {
    marginBottom: spacing.md,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  formInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text.primary,
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  formBtnSecondary: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary.DEFAULT,
    alignItems: 'center',
  },
  formBtnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.DEFAULT,
  },
  formBtnPrimary: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.success.DEFAULT,
    alignItems: 'center',
  },
  formBtnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  formBtnDisabled: {
    opacity: 0.5,
  },
  successContent: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  successMessage: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  grnInfoCard: {
    width: '100%',
    padding: spacing.lg,
    backgroundColor: colors.primary.DEFAULT + '10',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary.DEFAULT + '30',
    marginBottom: spacing.xl,
  },
  grnInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  grnInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  grnInfoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
    textAlign: 'right',
  },
  successActions: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  successBtnSecondary: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary.DEFAULT,
    alignItems: 'center',
  },
  successBtnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.DEFAULT,
  },
  successBtnPrimary: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.primary.DEFAULT,
    alignItems: 'center',
  },
  successBtnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  // Camera Scanner Styles
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  cameraScanHint: {
    marginTop: spacing.xl,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  cameraCancelBtn: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    minWidth: 200,
  },
});

export default GRNScreen;
