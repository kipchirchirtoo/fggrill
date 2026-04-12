/**
 * DiscrepancyScreen
 *
 * Branch storekeeper reports a discrepancy in a delivery.
 * Shows which items have quantity differences.
 * Requires a written explanation. Photo evidence optional.
 *
 * Receives: { dispatchId, dispatchNum?, items: CountItem[] }
 * Navigates to: BSTabs (after submission)
 *
 * API: PUT /api/storekeeping/dispatch-notes/:id/confirm
 *      with has_discrepancy: true and discrepancy_note
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, TextInput, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, shadows } from '../../theme';
import { dispatchApi } from '../../api/dispatch.api';

interface CountItem {
  item_id?: string;
  inventory_item_id?: string;
  name: string;
  unit: string;
  qty_dispatched: number;
  qty_received: number;
}

interface Props {
  route: { params: { dispatchId: string; dispatchNum?: string; items: CountItem[] } };
  navigation: any;
}

const DiscrepancyScreen: React.FC<Props> = ({ route, navigation }) => {
  const { dispatchId, dispatchNum, items } = route.params;
  const [note, setNote] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const discrepantItems = items.filter(i => i.qty_received !== i.qty_dispatched);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to take evidence photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!note.trim()) {
      Alert.alert('Required', 'Please describe the discrepancy before submitting.');
      return;
    }

    setLoading(true);
    try {
      // PUT /api/storekeeping/dispatch-notes/:id/confirm
      await dispatchApi.confirmDelivery(dispatchId, {
        items_received: items.map(i => ({
          item_id: i.item_id || i.inventory_item_id || '',
          quantity_received: i.qty_received,
        })),
        has_discrepancy: true,
        discrepancy_note: note.trim(),
      });

      Alert.alert(
        'Discrepancy Reported',
        'The delivery has been confirmed with a discrepancy note. The central store and superadmin have been notified.',
        [{ text: 'Done', onPress: () => navigation.navigate('BSTabs') }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to submit discrepancy report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Alert banner */}
        <Card style={styles.alertCard}>
          <Card.Content>
            <View style={styles.alertRow}>
              <MaterialCommunityIcons name="alert-circle" size={26} color={colors.warning.DEFAULT} />
              <View style={styles.alertInfo}>
                <Text style={styles.alertTitle}>Discrepancy Detected</Text>
                <Text style={styles.alertSubtitle}>
                  {discrepantItems.length} item{discrepantItems.length !== 1 ? 's' : ''} have quantity differences
                  {dispatchNum ? ` in dispatch ${dispatchNum}` : ''}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Discrepant items */}
        {discrepantItems.map((item, idx) => {
          const diff = item.qty_received - item.qty_dispatched;
          return (
            <Card key={idx} style={styles.itemCard}>
              <Card.Content>
                <Text style={styles.itemName}>{item.name}</Text>
                <View style={styles.qtyRow}>
                  <View style={styles.qtyBox}>
                    <Text style={styles.qtyLabel}>Dispatched</Text>
                    <Text style={styles.qtyValue}>{item.qty_dispatched} {item.unit}</Text>
                  </View>
                  <MaterialCommunityIcons name="arrow-right" size={18} color={colors.text.tertiary} />
                  <View style={styles.qtyBox}>
                    <Text style={styles.qtyLabel}>Received</Text>
                    <Text style={[styles.qtyValue, { color: colors.warning.DEFAULT }]}>
                      {item.qty_received} {item.unit}
                    </Text>
                  </View>
                  <View style={styles.qtyBox}>
                    <Text style={styles.qtyLabel}>Difference</Text>
                    <Text style={[styles.qtyValue, { color: diff < 0 ? colors.danger.DEFAULT : colors.info.DEFAULT }]}>
                      {diff > 0 ? `+${diff}` : diff}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          );
        })}

        {/* Explanation */}
        <Text style={styles.sectionTitle}>Explanation *</Text>
        <TextInput
          label="Describe what happened (required)"
          value={note}
          onChangeText={setNote}
          mode="outlined"
          multiline
          numberOfLines={4}
          style={styles.input}
          placeholder="e.g. 3 boxes of rice were missing from the delivery. Driver confirmed only 7 boxes were loaded."
        />

        {/* Photo evidence */}
        <Text style={styles.sectionTitle}>Photo Evidence (Optional)</Text>
        <Button
          mode="outlined"
          icon={photoUri ? 'check-circle' : 'camera'}
          onPress={pickPhoto}
          style={[styles.photoBtn, photoUri && styles.photoBtnDone]}
        >
          {photoUri ? 'Photo Captured ✓' : 'Take Photo of Delivery'}
        </Button>

        {/* Submit */}
        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading || !note.trim()}
          style={styles.submitBtn}
          icon="send"
        >
          Submit Discrepancy Report
        </Button>

        <Text style={styles.disclaimer}>
          This report will be sent to the central store and superadmin for review.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  alertCard: { marginBottom: spacing.lg, backgroundColor: colors.warning.DEFAULT + '10', borderWidth: 2, borderColor: colors.warning.DEFAULT },
  alertRow: { flexDirection: 'row', alignItems: 'flex-start' },
  alertInfo: { flex: 1, marginLeft: spacing.md },
  alertTitle: { fontSize: 16, fontWeight: '700', color: colors.warning.DEFAULT },
  alertSubtitle: { fontSize: 13, color: colors.text.secondary, marginTop: 4 },
  itemCard: { marginBottom: spacing.md, ...shadows.sm, borderLeftWidth: 3, borderLeftColor: colors.warning.DEFAULT },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyBox: { flex: 1, alignItems: 'center' },
  qtyLabel: { fontSize: 10, color: colors.text.tertiary, marginBottom: 4, textTransform: 'uppercase' },
  qtyValue: { fontSize: 15, fontWeight: '700', color: colors.text.primary },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md, marginTop: spacing.lg },
  input: { marginBottom: spacing.md, backgroundColor: colors.card },
  photoBtn: { marginBottom: spacing.lg },
  photoBtnDone: { borderColor: colors.success.DEFAULT },
  submitBtn: { backgroundColor: colors.warning.DEFAULT },
  disclaimer: { fontSize: 12, color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.lg, lineHeight: 18 },
});

export default DiscrepancyScreen;
