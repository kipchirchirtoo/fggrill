/**
 * ReceivingBarcodeScreen - Professional UI/UX
 * 
 * Modern, polished receiving screen with:
 * - Smooth keyboard handling
 * - Professional design
 * - Intuitive flow
 * - Proper search UX
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  FlatList,
  Animated,
} from 'react-native';
import { Text, TextInput, ActivityIndicator, Portal, Modal } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { inventoryApi } from '../../api/inventory.api';
import { dispatchApi } from '../../api/dispatch.api';
import { useAuthStore } from '../../stores/auth.store';

interface Props {
  navigation: any;
}

type Mode = 'select' | 'create';

const ReceivingBarcodeScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuthStore();
  const [mode, setMode] = useState<Mode>('select');
  
  // Search & Items
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  
  // New Item Form
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemUnit, setItemUnit] = useState('kg');
  const [itemQuantity, setItemQuantity] = useState('');
  
  // Barcode
  const [barcode, setBarcode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Loading & Success
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successItem, setSuccessItem] = useState<any>(null);
  
  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

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
  }, []);

  useEffect(() => {
    if (mode === 'select') {
      loadItems();
    }
  }, [mode]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = items.filter(item =>
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredItems(filtered);
      setShowResults(true);
    } else {
      setFilteredItems(items.slice(0, 10));
      setShowResults(false);
    }
  }, [searchQuery, items]);

  const loadItems = async () => {
    try {
      const data = await inventoryApi.list();
      const itemsList = Array.isArray(data) ? data : [];
      setItems(itemsList);
      setFilteredItems(itemsList.slice(0, 10));
    } catch (e) {
      console.error('Failed to load items:', e);
    }
  };

  const handleGenerateBarcode = async () => {
    setIsGenerating(true);
    try {
      const res = await dispatchApi.generateBarcode('ITEM');
      setBarcode(res.barcode || res.barcode_value || res.data?.barcode);
    } catch (e: any) {
      console.error('Failed to generate barcode:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (mode === 'create') {
      if (!itemName || !itemCategory || !itemUnit || !itemQuantity) {
        return;
      }
    } else {
      if (!selectedItem) {
        return;
      }
    }
    
    if (!barcode) {
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = mode === 'create' ? {
        item_name: itemName,
        category: itemCategory,
        unit: itemUnit,
        quantity: parseFloat(itemQuantity),
        barcode: barcode,
        branch_id: user?.branch_id?.toString() || 'central',
      } : {
        item_id: selectedItem.id,
        quantity: 1,
        unit: selectedItem.unit,
        barcode: barcode,
        branch_id: user?.branch_id?.toString() || 'central',
      };

      const res = await dispatchApi.receiveItem(payload);
      setSuccessItem(res.data || { name: itemName || selectedItem?.name, barcode });
      setShowSuccess(true);
    } catch (e: any) {
      console.error('Failed to receive item:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedItem(null);
    setItemName('');
    setItemCategory('');
    setItemUnit('kg');
    setItemQuantity('');
    setBarcode('');
    setSearchQuery('');
    setShowSuccess(false);
    setSuccessItem(null);
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[
        styles.itemCard,
        selectedItem?.id === item.id && styles.itemCardSelected,
      ]}
      onPress={() => {
        setSelectedItem(item);
        setShowResults(false);
        Keyboard.dismiss();
      }}
      activeOpacity={0.7}
    >
      <View style={styles.itemIcon}>
        <MaterialCommunityIcons
          name="package-variant"
          size={24}
          color={selectedItem?.id === item.id ? colors.primary.DEFAULT : colors.text.tertiary}
        />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemMeta}>{item.category} • {item.unit}</Text>
      </View>
      {selectedItem?.id === item.id && (
        <MaterialCommunityIcons name="check-circle" size={24} color={colors.primary.DEFAULT} />
      )}
    </TouchableOpacity>
  );

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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Receive Items</Text>
            <Text style={styles.headerSubtitle}>Scan or generate barcodes</Text>
          </View>
        </View>

        {/* Mode Selector */}
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'select' && styles.modeBtnActive]}
            onPress={() => setMode('select')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="package-variant"
              size={20}
              color={mode === 'select' ? '#fff' : colors.text.secondary}
            />
            <Text style={[styles.modeText, mode === 'select' && styles.modeTextActive]}>
              Select Item
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'create' && styles.modeBtnActive]}
            onPress={() => setMode('create')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="plus-circle"
              size={20}
              color={mode === 'create' ? '#fff' : colors.text.secondary}
            />
            <Text style={[styles.modeText, mode === 'create' && styles.modeTextActive]}>
              Create New
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Select Mode */}
          {mode === 'select' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Search Items</Text>
              <View style={styles.searchContainer}>
                <MaterialCommunityIcons
                  name="magnify"
                  size={20}
                  color={colors.text.tertiary}
                  style={styles.searchIcon}
                />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search by name or category..."
                  style={styles.searchInput}
                  placeholderTextColor={colors.text.tertiary}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  onFocus={() => setShowResults(true)}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                    <MaterialCommunityIcons name="close-circle" size={20} color={colors.text.tertiary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Search Results */}
              {showResults && filteredItems.length > 0 && (
                <View style={styles.resultsContainer}>
                  <FlatList
                    data={filteredItems.slice(0, 8)}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                    scrollEnabled={false}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                  />
                </View>
              )}

              {/* Selected Item Display */}
              {selectedItem && !showResults && (
                <View style={styles.selectedContainer}>
                  <Text style={styles.selectedLabel}>Selected Item</Text>
                  <View style={styles.selectedCard}>
                    <MaterialCommunityIcons name="check-circle" size={32} color={colors.success.DEFAULT} />
                    <View style={styles.selectedContent}>
                      <Text style={styles.selectedName}>{selectedItem.name}</Text>
                      <Text style={styles.selectedMeta}>
                        {selectedItem.category} • {selectedItem.unit}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Create Mode */}
          {mode === 'create' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Item Details</Text>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Item Name *</Text>
                <TextInput
                  value={itemName}
                  onChangeText={setItemName}
                  placeholder="e.g., Fresh Tomatoes"
                  style={styles.input}
                  mode="outlined"
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary.DEFAULT}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Category *</Text>
                  <TextInput
                    value={itemCategory}
                    onChangeText={setItemCategory}
                    placeholder="Vegetables"
                    style={styles.input}
                    mode="outlined"
                    outlineColor={colors.border}
                    activeOutlineColor={colors.primary.DEFAULT}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Unit *</Text>
                  <TextInput
                    value={itemUnit}
                    onChangeText={setItemUnit}
                    placeholder="kg"
                    style={styles.input}
                    mode="outlined"
                    outlineColor={colors.border}
                    activeOutlineColor={colors.primary.DEFAULT}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Initial Quantity *</Text>
                <TextInput
                  value={itemQuantity}
                  onChangeText={setItemQuantity}
                  placeholder="0"
                  keyboardType="numeric"
                  style={styles.input}
                  mode="outlined"
                  outlineColor={colors.border}
                  activeOutlineColor={colors.primary.DEFAULT}
                />
              </View>
            </View>
          )}

          {/* Barcode Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Barcode</Text>
            {barcode ? (
              <View style={styles.barcodeDisplay}>
                <MaterialCommunityIcons name="barcode" size={48} color={colors.success.DEFAULT} />
                <Text style={styles.barcodeValue}>{barcode}</Text>
                <View style={styles.barcodeChip}>
                  <MaterialCommunityIcons name="check" size={14} color={colors.success.DEFAULT} />
                  <Text style={styles.barcodeChipText}>Generated</Text>
                </View>
              </View>
            ) : (
              <View style={styles.barcodeEmpty}>
                <MaterialCommunityIcons name="barcode-scan" size={48} color={colors.text.tertiary} />
                <Text style={styles.barcodeEmptyText}>No barcode assigned</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.generateBtn}
              onPress={handleGenerateBarcode}
              disabled={isGenerating}
              activeOpacity={0.7}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="auto-fix" size={20} color="#fff" />
                  <Text style={styles.generateBtnText}>Generate Barcode</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!barcode || (mode === 'select' && !selectedItem) || isSubmitting) && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!barcode || (mode === 'select' && !selectedItem) || isSubmitting}
            activeOpacity={0.7}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>Receive Item</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Success Modal */}
      <Portal>
        <Modal
          visible={showSuccess}
          onDismiss={() => setShowSuccess(false)}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalContent}>
            <View style={styles.successIcon}>
              <MaterialCommunityIcons name="check-circle" size={64} color={colors.success.DEFAULT} />
            </View>
            <Text style={styles.successTitle}>Item Received!</Text>
            <Text style={styles.successMessage}>
              {successItem?.name} has been added to inventory with barcode {successItem?.barcode}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnSecondary}
                onPress={() => {
                  resetForm();
                  setShowSuccess(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalBtnSecondaryText}>Receive Another</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnPrimary}
                onPress={() => {
                  setShowSuccess(false);
                  navigation.goBack();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalBtnPrimaryText}>Done</Text>
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
  modeSelector: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: '#fff',
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.muted.DEFAULT,
    gap: spacing.sm,
  },
  modeBtnActive: {
    backgroundColor: colors.primary.DEFAULT,
  },
  modeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  modeTextActive: {
    color: '#fff',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  },
  clearBtn: {
    padding: spacing.xs,
  },
  resultsContainer: {
    marginTop: spacing.md,
    backgroundColor: '#fff',
    borderRadius: 12,
    ...shadows.sm,
    overflow: 'hidden',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: '#fff',
  },
  itemCardSelected: {
    backgroundColor: colors.primary.DEFAULT + '10',
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.muted.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  itemMeta: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 56,
  },
  selectedContainer: {
    marginTop: spacing.lg,
  },
  selectedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.success.DEFAULT + '10',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.success.DEFAULT,
  },
  selectedContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  selectedName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  selectedMeta: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  formRow: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: '#fff',
  },
  barcodeDisplay: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.success.DEFAULT + '10',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.success.DEFAULT,
    marginBottom: spacing.md,
  },
  barcodeValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: spacing.md,
    letterSpacing: 2,
  },
  barcodeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.success.DEFAULT + '20',
    borderRadius: 16,
    marginTop: spacing.sm,
    gap: 4,
  },
  barcodeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success.DEFAULT,
  },
  barcodeEmpty: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.muted.DEFAULT,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginBottom: spacing.md,
  },
  barcodeEmptyText: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 12,
    gap: spacing.sm,
  },
  generateBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.lg,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.success.DEFAULT,
    borderRadius: 12,
    gap: spacing.sm,
  },
  submitBtnDisabled: {
    backgroundColor: colors.muted.DEFAULT,
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  modal: {
    backgroundColor: '#fff',
    marginHorizontal: spacing.xl,
    borderRadius: 16,
    padding: spacing.xl,
  },
  modalContent: {
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: 22,
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
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  modalBtnSecondary: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary.DEFAULT,
    alignItems: 'center',
  },
  modalBtnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.DEFAULT,
  },
  modalBtnPrimary: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.primary.DEFAULT,
    alignItems: 'center',
  },
  modalBtnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});

export default ReceivingBarcodeScreen;
