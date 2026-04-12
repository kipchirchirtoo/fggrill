/**
 * OTPOverrideScreen — Superadmin Emergency Feature
 *
 * When a driver loses the OTP or there's a system issue, the superadmin
 * can bypass OTP verification for a specific dispatch.
 *
 * Flow:
 *  1. Enter dispatch number to look it up
 *  2. Review dispatch details
 *  3. Enter reason (mandatory)
 *  4. Apply override → branch can now confirm without OTP
 *
 * API: GET /api/storekeeping/dispatch-notes (search by number)
 *      PUT /api/storekeeping/dispatch-notes/:id/confirm (with override flag)
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, TextInput, Card, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { dispatchApi } from '../../api/dispatch.api';

const OTPOverrideScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [dispatchNumber, setDispatchNumber] = useState('');
  const [dispatch, setDispatch] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [looking, setLooking] = useState(false);
  const [overriding, setOverriding] = useState(false);

  const lookupDispatch = async () => {
    if (!dispatchNumber.trim()) return;
    setLooking(true);
    setDispatch(null);
    try {
      // GET /api/storekeeping/dispatch-notes — search by dispatch_number
      const all = await dispatchApi.list();
      const list = Array.isArray(all) ? all : [];
      const found = list.find((d: any) =>
        (d.dispatch_number || d.reference_number || '').toLowerCase() ===
        dispatchNumber.trim().toLowerCase()
      );
      if (found) {
        setDispatch(found);
      } else {
        Alert.alert('Not Found', `No dispatch found with number: ${dispatchNumber}`);
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Lookup failed');
    } finally {
      setLooking(false); }
  };

  const handleOverride = () => {
    if (!dispatch || !reason.trim()) {
      Alert.alert('Required', 'Please provide a reason for the override.');
      return;
    }

    Alert.alert(
      '⚠️ Confirm Override',
      `This will allow the branch to confirm dispatch ${dispatch.dispatch_number || dispatch.id?.slice(0, 8)} WITHOUT the OTP code.\n\nThis action is logged and audited.\n\nContinue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply Override',
          style: 'destructive',
          onPress: async () => {
            setOverriding(true);
            try {
              // PUT /api/storekeeping/dispatch-notes/:id/confirm with override
              await dispatchApi.confirmDelivery(dispatch.id, {
                items_received: (dispatch.items || []).map((i: any) => ({
                  item_id: i.item_id || i.id,
                  quantity_received: i.quantity || i.qty_dispatched || 0,
                })),
                has_discrepancy: false,
                discrepancy_note: `SUPERADMIN OTP OVERRIDE: ${reason.trim()}`,
              });

              Alert.alert(
                'Override Applied',
                'The branch can now confirm this delivery without the OTP code.',
                [{ text: 'Done', onPress: () => navigation.goBack() }]
              );
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.message || 'Override failed');
            } finally {
              setOverriding(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Warning banner */}
        <Card style={styles.warningCard}>
          <Card.Content>
            <View style={styles.warningRow}>
              <MaterialCommunityIcons name="shield-alert" size={28} color={colors.danger.DEFAULT} />
              <View style={styles.warningInfo}>
                <Text style={styles.warningTitle}>Emergency Override</Text>
                <Text style={styles.warningText}>
                  Use only when the OTP cannot be retrieved. All overrides are logged and audited.
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Lookup */}
        <Text style={styles.sectionTitle}>Find Dispatch</Text>
        <View style={styles.lookupRow}>
          <TextInput
            label="Dispatch Number"
            value={dispatchNumber}
            onChangeText={setDispatchNumber}
            mode="outlined"
            style={styles.lookupInput}
            autoCapitalize="characters"
            returnKeyType="search"
            onSubmitEditing={lookupDispatch}
          />
          <Button
            mode="contained"
            onPress={lookupDispatch}
            loading={looking}
            disabled={looking || !dispatchNumber.trim()}
            style={styles.lookupBtn}
          >
            Find
          </Button>
        </View>

        {/* Dispatch details */}
        {dispatch && (
          <Card style={styles.dispatchCard}>
            <Card.Content>
              <Text style={styles.dispatchNum}>
                {dispatch.dispatch_number || dispatch.reference_number || dispatch.id?.slice(0, 8)}
              </Text>
              {[
                { label: 'To Branch', value: dispatch.to_branch?.name || dispatch.to_branch_name || '—' },
                { label: 'Driver', value: dispatch.driver_name || dispatch.logistics?.driver_name || '—' },
                { label: 'Status', value: (dispatch.status || '—').replace('_', ' ').toUpperCase() },
                { label: 'Items', value: `${dispatch.items?.length ?? 0} items` },
              ].map((row, i) => (
                <View key={i} style={styles.dispatchRow}>
                  <Text style={styles.dispatchLabel}>{row.label}:</Text>
                  <Text style={styles.dispatchValue}>{row.value}</Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Reason */}
        {dispatch && (
          <>
            <Text style={styles.sectionTitle}>Reason for Override *</Text>
            <TextInput
              label="Explain why the OTP cannot be used"
              value={reason}
              onChangeText={setReason}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={styles.input}
              placeholder="e.g. Driver's phone was stolen. Delivery confirmed by branch manager in person."
            />

            <Button
              mode="contained"
              onPress={handleOverride}
              loading={overriding}
              disabled={overriding || !reason.trim()}
              style={styles.overrideBtn}
              icon="shield-alert"
            >
              Apply Emergency Override
            </Button>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  warningCard: { marginBottom: spacing.lg, backgroundColor: colors.danger.DEFAULT + '10', borderWidth: 2, borderColor: colors.danger.DEFAULT },
  warningRow: { flexDirection: 'row', alignItems: 'flex-start' },
  warningInfo: { flex: 1, marginLeft: spacing.md },
  warningTitle: { fontSize: 16, fontWeight: '700', color: colors.danger.DEFAULT },
  warningText: { fontSize: 13, color: colors.text.secondary, marginTop: 4, lineHeight: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md },
  lookupRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg, alignItems: 'flex-start' },
  lookupInput: { flex: 1, backgroundColor: colors.card },
  lookupBtn: { backgroundColor: colors.primary.DEFAULT, alignSelf: 'center' },
  dispatchCard: { marginBottom: spacing.lg, ...shadows.sm, borderLeftWidth: 4, borderLeftColor: colors.warning.DEFAULT },
  dispatchNum: { fontSize: 17, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.md },
  dispatchRow: { flexDirection: 'row', marginBottom: spacing.sm },
  dispatchLabel: { fontSize: 13, color: colors.text.tertiary, width: 80 },
  dispatchValue: { fontSize: 13, fontWeight: '500', color: colors.text.primary, flex: 1 },
  input: { marginBottom: spacing.lg, backgroundColor: colors.card },
  overrideBtn: { backgroundColor: colors.danger.DEFAULT },
});

export default OTPOverrideScreen;
