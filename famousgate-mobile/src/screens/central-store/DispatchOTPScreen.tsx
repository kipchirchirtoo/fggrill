/**
 * DispatchOTPScreen
 *
 * Shown after a dispatch is created & dispatched.
 * Receives: { dispatchId, driverOtp?, branchOtp?, expiresAt?, dispatchNumber? }
 *
 * Displays BOTH Driver OTP (D-XXXX) and Branch OTP (B-XXXX) for dual verification system.
 * Driver OTP marks delivery as "In Transit"
 * Branch OTP marks delivery as "Completed"
 *
 * Flow: CreateDispatch → DispatchOTPScreen → (share codes with driver and branch)
 *       DispatchHistory → DispatchOTPScreen → (re-share codes)
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Share, Alert, Clipboard, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { dispatchApi } from '../../api/dispatch.api';

interface Props {
  route: {
    params: {
      dispatchId: string;
      driverOtp?: string;
      branchOtp?: string;
      otp?: string; // Legacy support
      expiresAt?: string;
      dispatchNumber?: string;
    };
  };
  navigation: any;
}

const DispatchOTPScreen: React.FC<Props> = ({ route, navigation }) => {
  const { 
    dispatchId, 
    driverOtp: passedDriverOtp, 
    branchOtp: passedBranchOtp,
    otp: passedOtp, // Legacy support
    expiresAt: passedExpiry, 
    dispatchNumber 
  } = route.params;

  const [driverOtp, setDriverOtp] = useState(passedDriverOtp || passedOtp || '');
  const [branchOtp, setBranchOtp] = useState(passedBranchOtp || '');
  const [expiresAt, setExpiresAt] = useState(passedExpiry || '');
  const [dispatchNum, setDispatchNum] = useState(dispatchNumber || '');
  const [loading, setLoading] = useState(!passedDriverOtp && !passedOtp);
  
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
  }, []);

  useEffect(() => {
    if (passedDriverOtp || passedOtp) return; // already have it
    // Fetch dispatch to get OTPs
    const fetchDispatch = async () => {
      try {
        const all = await dispatchApi.list();
        const dispatch = Array.isArray(all) ? all.find((d: any) => d.id === dispatchId) : null;
        if (dispatch) {
          setDriverOtp(dispatch.driver_otp || dispatch.otp_code || dispatch.delivery_code || '');
          setBranchOtp(dispatch.branch_otp || '');
          setExpiresAt(dispatch.otp_expires_at || dispatch.expires_at || '');
          setDispatchNum(dispatch.dispatch_number || dispatch.reference_number || '');
        }
      } catch (e) {
        console.error('Failed to load dispatch OTPs:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDispatch();
  }, [dispatchId, passedDriverOtp, passedOtp]);

  const handleShareBoth = async () => {
    const expiry = expiresAt ? new Date(expiresAt).toLocaleString() : 'Check with storekeeper';
    try {
      await Share.share({
        message:
          `🏨 FamousGate Hotels — Delivery Codes\n\n` +
          `Dispatch: ${dispatchNum || dispatchId.slice(0, 8)}\n\n` +
          `🚚 DRIVER CODE: ${driverOtp}\n` +
          `(Driver enters this to mark "In Transit")\n\n` +
          `🏪 BRANCH CODE: ${branchOtp}\n` +
          `(Branch storekeeper enters this to complete delivery)\n\n` +
          `Expires: ${expiry}\n\n` +
          `Both codes are required for secure delivery verification.`,
      });
    } catch (e) {
      console.error('Share failed:', e);
    }
  };

  const handleShareDriver = async () => {
    const expiry = expiresAt ? new Date(expiresAt).toLocaleString() : 'Check with storekeeper';
    try {
      await Share.share({
        message:
          `🏨 FamousGate Hotels — Driver Delivery Code\n\n` +
          `Dispatch: ${dispatchNum || dispatchId.slice(0, 8)}\n` +
          `Driver Code: ${driverOtp}\n` +
          `Expires: ${expiry}\n\n` +
          `Enter this code when you start the delivery to mark it "In Transit".`,
      });
    } catch (e) {
      console.error('Share failed:', e);
    }
  };

  const handleShareBranch = async () => {
    const expiry = expiresAt ? new Date(expiresAt).toLocaleString() : 'Check with storekeeper';
    try {
      await Share.share({
        message:
          `🏨 FamousGate Hotels — Branch Delivery Code\n\n` +
          `Dispatch: ${dispatchNum || dispatchId.slice(0, 8)}\n` +
          `Branch Code: ${branchOtp}\n` +
          `Expires: ${expiry}\n\n` +
          `Enter this code when you receive the delivery to complete it.`,
      });
    } catch (e) {
      console.error('Share failed:', e);
    }
  };

  const handleCopyDriver = () => {
    Clipboard.setString(driverOtp);
    Alert.alert('Copied', 'Driver code copied to clipboard');
  };

  const handleCopyBranch = () => {
    Clipboard.setString(branchOtp);
    Alert.alert('Copied', 'Branch code copied to clipboard');
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
            <Text style={styles.headerTitle}>Delivery Codes</Text>
            <Text style={styles.headerSubtitle}>Share with driver and branch</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Success Icon */}
          <View style={styles.successBanner}>
            <View style={styles.successIconContainer}>
              <MaterialCommunityIcons name="shield-check" size={56} color={colors.success.DEFAULT} />
            </View>
            <Text style={styles.successTitle}>Dispatch Ready</Text>
            <Text style={styles.successSubtitle}>Two codes for secure delivery verification</Text>
          </View>

          {/* Driver OTP Card */}
          <View style={styles.otpCard}>
            <View style={styles.otpHeader}>
              <View style={styles.otpIconContainer}>
                <MaterialCommunityIcons name="truck-delivery" size={24} color={colors.primary.DEFAULT} />
              </View>
              <Text style={styles.otpLabel}>DRIVER CODE</Text>
            </View>
            <Text style={styles.otpCode}>{driverOtp || '——'}</Text>
            <Text style={styles.otpPurpose}>Driver enters this to mark "In Transit"</Text>
            <View style={styles.otpActions}>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={handleCopyDriver}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="content-copy" size={18} color={colors.primary.DEFAULT} />
                <Text style={styles.copyBtnText}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.shareBtn, { backgroundColor: colors.primary.DEFAULT }]}
                onPress={handleShareDriver}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="share-variant" size={18} color="#fff" />
                <Text style={styles.shareBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Branch OTP Card */}
          <View style={[styles.otpCard, { backgroundColor: colors.success.DEFAULT + '08' }]}>
            <View style={styles.otpHeader}>
              <View style={[styles.otpIconContainer, { backgroundColor: colors.success.DEFAULT + '15' }]}>
                <MaterialCommunityIcons name="store" size={24} color={colors.success.DEFAULT} />
              </View>
              <Text style={styles.otpLabel}>BRANCH CODE</Text>
            </View>
            <Text style={styles.otpCode}>{branchOtp || '——'}</Text>
            <Text style={styles.otpPurpose}>Branch storekeeper enters this to complete delivery</Text>
            <View style={styles.otpActions}>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={handleCopyBranch}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="content-copy" size={18} color={colors.success.DEFAULT} />
                <Text style={[styles.copyBtnText, { color: colors.success.DEFAULT }]}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.shareBtn, { backgroundColor: colors.success.DEFAULT }]}
                onPress={handleShareBranch}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="share-variant" size={18} color="#fff" />
                <Text style={styles.shareBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Expiry & Dispatch Info */}
          {(expiresAt || dispatchNum) && (
            <View style={styles.infoCard}>
              {dispatchNum && (
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="file-document" size={16} color={colors.text.tertiary} />
                  <Text style={styles.infoLabel}>Dispatch:</Text>
                  <Text style={styles.infoValue}>{dispatchNum}</Text>
                </View>
              )}
              {expiresAt && (
                <View style={styles.infoRow}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color={colors.text.tertiary} />
                  <Text style={styles.infoLabel}>Expires:</Text>
                  <Text style={styles.infoValue}>{new Date(expiresAt).toLocaleString()}</Text>
                </View>
              )}
            </View>
          )}

          {/* How it works */}
          <View style={styles.stepsCard}>
            <Text style={styles.stepsTitle}>How it works</Text>
            {[
              { icon: 'share-variant', text: 'Share Driver Code with the driver', color: colors.primary.DEFAULT },
              { icon: 'truck-delivery', text: 'Driver enters code to mark "In Transit"', color: colors.primary.DEFAULT },
              { icon: 'store', text: 'Driver delivers items to the branch', color: colors.text.secondary },
              { icon: 'shield-lock', text: 'Branch storekeeper enters Branch Code', color: colors.success.DEFAULT },
              { icon: 'clipboard-check', text: 'Branch uploads signed stock sheet', color: colors.success.DEFAULT },
              { icon: 'check-circle', text: 'Delivery marked as "Completed"', color: colors.success.DEFAULT },
            ].map((step, i) => (
              <View key={i} style={styles.step}>
                <View style={[styles.stepIcon, { backgroundColor: step.color + '15' }]}>
                  <MaterialCommunityIcons name={step.icon as any} size={16} color={step.color} />
                </View>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.shareBothBtn}
            onPress={handleShareBoth}
            disabled={!driverOtp || !branchOtp}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="share-variant" size={20} color="#fff" />
            <Text style={styles.shareBothBtnText}>Share Both Codes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => navigation.navigate('CSTabs')}
            activeOpacity={0.7}
          >
            <Text style={styles.doneBtnText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  loadingText: { fontSize: 14, color: colors.text.tertiary, marginTop: spacing.md },
  content: { flex: 1 },
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
  backBtn: { marginRight: spacing.md },
  headerContent: { flex: 1 },
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
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: 120 },
  successBanner: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success.DEFAULT + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  successSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  otpCard: {
    backgroundColor: colors.primary.DEFAULT + '08',
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  otpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  otpIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.DEFAULT + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  otpLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.tertiary,
    letterSpacing: 1.5,
  },
  otpCode: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text.primary,
    textAlign: 'center',
    letterSpacing: 6,
    marginVertical: spacing.md,
  },
  otpPurpose: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  otpActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  copyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: '#fff',
    borderRadius: 10,
    gap: spacing.xs,
  },
  copyBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary.DEFAULT,
  },
  shareBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 10,
    gap: spacing.xs,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginLeft: spacing.xs,
    minWidth: 70,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  stepsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.lg,
    ...shadows.sm,
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  stepText: {
    fontSize: 13,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 18,
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
  shareBothBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 12,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  shareBothBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.muted.DEFAULT,
    borderRadius: 12,
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
});

export default DispatchOTPScreen;
