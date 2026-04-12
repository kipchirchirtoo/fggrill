/**
 * OTPEntryScreen
 *
 * Branch storekeeper enters the 6-digit code given by the driver.
 * On success → CountItemsScreen to count received items.
 *
 * Receives: { dispatchId, dispatchNum? }
 * Navigates to: CountItems with { dispatchId, dispatchNum }
 *
 * API: PUT /api/storekeeping/dispatch-notes/:id/confirm
 *      (we verify the OTP by attempting to confirm with the code)
 *
 * Note: The backend's confirm endpoint accepts the OTP as part of the
 * confirmation payload. We pass it and let the backend validate.
 */

import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import OTPInput from '../../components/common/OTPInput';
import apiClient from '../../api/client';

interface Props {
  route: { params: { dispatchId: string; dispatchNum?: string } };
  navigation: any;
}

const OTPEntryScreen: React.FC<Props> = ({ route, navigation }) => {
  const { dispatchId, dispatchNum } = route.params;
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOTPComplete = async (code: string) => {
    setLoading(true);
    setError('');
    try {
      /**
       * The storekeeping confirm endpoint validates the OTP.
       * We send the code along with a preliminary confirm to check validity.
       * PUT /api/storekeeping/dispatch-notes/:id/confirm
       * Body: { otp_code: code, verify_only: true }
       */
      const res = await apiClient.put(
        `/storekeeping/dispatch-notes/${dispatchId}/confirm`,
        { otp_code: code, verify_only: true }
      );

      if (res.data?.valid === false || res.data?.error) {
        setError('Invalid code. Please try again.');
        return;
      }

      // OTP accepted — proceed to count items
      navigation.navigate('CountItems', { dispatchId, dispatchNum });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Invalid code. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <MaterialCommunityIcons name="shield-lock" size={72} color={colors.primary.DEFAULT} />

        <Text style={styles.title}>Enter Delivery Code</Text>
        <Text style={styles.subtitle}>
          Ask the driver for the 6-digit code and enter it below
        </Text>

        {dispatchNum ? (
          <View style={styles.dispatchBadge}>
            <MaterialCommunityIcons name="truck-delivery" size={16} color={colors.primary.DEFAULT} />
            <Text style={styles.dispatchNum}>Dispatch: {dispatchNum}</Text>
          </View>
        ) : null}

        <OTPInput onComplete={handleOTPComplete} error={error} length={6} />

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size={20} color={colors.primary.DEFAULT} />
            <Text style={styles.loadingText}>Verifying code…</Text>
          </View>
        )}

        <Button mode="text" onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          Cancel
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: colors.text.primary, marginTop: spacing.lg, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.text.tertiary, marginTop: spacing.sm, marginBottom: spacing.lg, textAlign: 'center', lineHeight: 20 },
  dispatchBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary.DEFAULT + '12', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8, marginBottom: spacing.lg },
  dispatchNum: { fontSize: 13, fontWeight: '600', color: colors.primary.DEFAULT, marginLeft: spacing.sm },
  loadingRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  loadingText: { fontSize: 14, color: colors.text.tertiary, marginLeft: spacing.sm },
  cancelBtn: { marginTop: spacing.xl },
});

export default OTPEntryScreen;
