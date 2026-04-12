/**
 * DispatchOTPScreen
 *
 * Shown after a dispatch is created & dispatched.
 * Receives: { dispatchId, otp?, expiresAt?, dispatchNumber? }
 *
 * If otp is passed directly (from CreateDispatch), shows it immediately.
 * If not, fetches the dispatch to get the OTP code.
 *
 * Flow: CreateDispatch → DispatchOTPScreen → (share code with driver)
 *       DispatchHistory → DispatchOTPScreen → (re-share code)
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Share, Alert } from 'react-native';
import { Text, Button, Card, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { dispatchApi } from '../../api/dispatch.api';

interface Props {
  route: {
    params: {
      dispatchId: string;
      otp?: string;
      expiresAt?: string;
      dispatchNumber?: string;
    };
  };
  navigation: any;
}

const DispatchOTPScreen: React.FC<Props> = ({ route, navigation }) => {
  const { dispatchId, otp: passedOtp, expiresAt: passedExpiry, dispatchNumber } = route.params;

  const [otp, setOtp] = useState(passedOtp || '');
  const [expiresAt, setExpiresAt] = useState(passedExpiry || '');
  const [dispatchNum, setDispatchNum] = useState(dispatchNumber || '');
  const [loading, setLoading] = useState(!passedOtp);

  useEffect(() => {
    if (passedOtp) return; // already have it
    // Fetch dispatch to get OTP
    const fetchDispatch = async () => {
      try {
        const all = await dispatchApi.list();
        const dispatch = Array.isArray(all) ? all.find((d: any) => d.id === dispatchId) : null;
        if (dispatch) {
          setOtp(dispatch.otp_code || dispatch.delivery_code || '');
          setExpiresAt(dispatch.otp_expires_at || dispatch.expires_at || '');
          setDispatchNum(dispatch.dispatch_number || dispatch.reference_number || '');
        }
      } catch (e) {
        console.error('Failed to load dispatch OTP:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDispatch();
  }, [dispatchId, passedOtp]);

  const handleShare = async () => {
    const expiry = expiresAt ? new Date(expiresAt).toLocaleString() : 'Check with storekeeper';
    try {
      await Share.share({
        message:
          `🏨 FamousGate Hotels — Delivery Code\n\n` +
          `Dispatch: ${dispatchNum || dispatchId.slice(0, 8)}\n` +
          `Code: ${otp}\n` +
          `Expires: ${expiry}\n\n` +
          `Give this code to the branch storekeeper upon delivery.`,
      });
    } catch (e) {
      console.error('Share failed:', e);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
        <Text style={styles.loadingText}>Loading delivery code…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <MaterialCommunityIcons name="shield-check" size={72} color={colors.success.DEFAULT} />

        <Text style={styles.title}>Delivery Code Ready</Text>
        <Text style={styles.subtitle}>Share this code with the driver to give to the branch</Text>

        {/* OTP Display */}
        <Card style={styles.otpCard}>
          <Card.Content>
            <Text style={styles.otpLabel}>6-DIGIT DELIVERY CODE</Text>
            <Text style={styles.otpCode}>{otp || '——'}</Text>
            {expiresAt ? (
              <View style={styles.expiryRow}>
                <MaterialCommunityIcons name="clock-outline" size={15} color={colors.text.tertiary} />
                <Text style={styles.expiryText}>
                  Expires: {new Date(expiresAt).toLocaleString()}
                </Text>
              </View>
            ) : null}
            {dispatchNum ? (
              <Text style={styles.dispatchRef}>Dispatch: {dispatchNum}</Text>
            ) : null}
          </Card.Content>
        </Card>

        {/* How it works */}
        <Card style={styles.stepsCard}>
          <Card.Content>
            <Text style={styles.stepsTitle}>How it works</Text>
            {[
              { icon: 'share-variant', text: 'Share this code with the driver' },
              { icon: 'truck-delivery', text: 'Driver delivers items to the branch' },
              { icon: 'shield-lock', text: 'Branch storekeeper enters this code' },
              { icon: 'clipboard-check', text: 'Branch counts and confirms receipt' },
            ].map((step, i) => (
              <View key={i} style={styles.step}>
                <View style={styles.stepIcon}>
                  <MaterialCommunityIcons name={step.icon as any} size={18} color={colors.primary.DEFAULT} />
                </View>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            ))}
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          icon="share-variant"
          onPress={handleShare}
          style={styles.shareBtn}
          disabled={!otp}
        >
          Share Code with Driver
        </Button>

        <Button
          mode="outlined"
          icon="history"
          onPress={() => navigation.navigate('CSTabs')}
          style={styles.historyBtn}
        >
          View Dispatch History
        </Button>

        <Button
          mode="text"
          onPress={() => navigation.navigate('CSTabs')}
          style={styles.doneBtn}
        >
          Back to Dashboard
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 14, color: colors.text.tertiary, marginTop: spacing.md },
  content: { flex: 1, padding: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: colors.text.primary, marginTop: spacing.lg, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.text.tertiary, marginTop: spacing.sm, textAlign: 'center', marginBottom: spacing.xl },
  otpCard: {
    width: '100%', marginBottom: spacing.lg,
    backgroundColor: colors.success.DEFAULT + '10',
    borderWidth: 2, borderColor: colors.success.DEFAULT,
    ...shadows.lg,
  },
  otpLabel: { fontSize: 11, fontWeight: '700', color: colors.text.tertiary, textAlign: 'center', letterSpacing: 1.5, marginBottom: spacing.sm },
  otpCode: { fontSize: 52, fontWeight: '800', color: colors.success.DEFAULT, textAlign: 'center', letterSpacing: 10 },
  expiryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  expiryText: { fontSize: 12, color: colors.text.tertiary, marginLeft: 4 },
  dispatchRef: { fontSize: 12, color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.xs },
  stepsCard: { width: '100%', marginBottom: spacing.xl, ...shadows.sm },
  stepsTitle: { fontSize: 14, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md },
  step: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  stepIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary.DEFAULT + '15', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  stepText: { fontSize: 13, color: colors.text.secondary, flex: 1 },
  shareBtn: { width: '100%', backgroundColor: colors.primary.DEFAULT, marginBottom: spacing.md },
  historyBtn: { width: '100%', marginBottom: spacing.sm },
  doneBtn: { width: '100%' },
});

export default DispatchOTPScreen;
