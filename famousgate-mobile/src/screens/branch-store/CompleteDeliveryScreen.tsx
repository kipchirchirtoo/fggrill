/**
 * CompleteDeliveryScreen
 *
 * Enhanced delivery completion screen with:
 * - Branch OTP (B-XXXX) entry
 * - Signed stock sheet document upload
 * - Delivery details display
 *
 * Receives: { dispatchId, dispatchNum?, items? }
 * 
 * Flow: ReceiveDelivery → CompleteDelivery (OTP + Upload) → Success
 *
 * API: POST /api/store/dispatches/:id/verify-branch-otp
 *      POST /api/store/dispatches/:id/upload-document
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image, TouchableOpacity, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { Text, TextInput, ActivityIndicator, Chip } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { dispatchApi } from '../../api/dispatch.api';

interface Props {
  route: {
    params: {
      dispatchId: string;
      dispatchNum?: string;
      items?: any[];
    };
  };
  navigation: any;
}

type Step = 'otp' | 'upload' | 'complete';

const CompleteDeliveryScreen: React.FC<Props> = ({ route, navigation }) => {
  const { dispatchId, dispatchNum, items: passedItems } = route.params;

  const [step, setStep] = useState<Step>('otp');
  const [branchOtp, setBranchOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [document, setDocument] = useState<any>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const [dispatch, setDispatch] = useState<any>(null);
  const [items, setItems] = useState<any[]>(passedItems || []);
  const [loading, setLoading] = useState(false);
  
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
    loadDispatchDetails();
  }, []);

  const loadDispatchDetails = async () => {
    setLoading(true);
    try {
      const data = await dispatchApi.getById(dispatchId);
      setDispatch(data);
      if (data.items && Array.isArray(data.items)) {
        setItems(data.items);
      }
    } catch (e) {
      console.error('Failed to load dispatch:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    // Validate OTP format (B-XXXX)
    const otpPattern = /^B-\d{4}$/;
    if (!otpPattern.test(branchOtp.toUpperCase())) {
      setOtpError('Invalid format. Branch code must be B-XXXX (e.g., B-1234)');
      return;
    }

    setVerifyingOtp(true);
    setOtpError('');
    try {
      await dispatchApi.verifyBranchOtp(dispatchId, branchOtp.toUpperCase());
      Alert.alert('Success', 'Branch OTP verified successfully');
      setStep('upload');
    } catch (e: any) {
      const message = e.response?.data?.message || e.response?.data?.error || 'Invalid or expired OTP';
      setOtpError(message);
      Alert.alert('Verification Failed', message);
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera roll access is required to upload documents');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      setDocument(result.assets[0]);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is required to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      setDocument(result.assets[0]);
    }
  };

  const handleUploadDocument = async () => {
    if (!document) {
      Alert.alert('Error', 'Please select or capture a document first');
      return;
    }

    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('document', {
        uri: document.uri,
        type: 'image/jpeg',
        name: `stock-sheet-${dispatchId}.jpg`,
      } as any);

      await dispatchApi.uploadDocument(dispatchId, formData);
      Alert.alert('Success', 'Stock sheet uploaded successfully', [
        {
          text: 'Done',
          onPress: () => {
            setStep('complete');
            setTimeout(() => navigation.navigate('BSTabs'), 1500);
          },
        },
      ]);
    } catch (e: any) {
      const message = e.response?.data?.message || e.response?.data?.error || 'Failed to upload document';
      Alert.alert('Upload Failed', message);
    } finally {
      setUploadingDoc(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
        <Text style={styles.loadingText}>Loading delivery details…</Text>
      </View>
    );
  }

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
            <Text style={styles.headerTitle}>Complete Delivery</Text>
            <Text style={styles.headerSubtitle}>Verify OTP and upload document</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Progress Indicator */}
          <View style={styles.progressRow}>
            <View style={[styles.progressStep, step !== 'otp' && styles.progressStepComplete]}>
              <View style={[styles.progressCircle, step !== 'otp' && styles.progressCircleComplete]}>
                <MaterialCommunityIcons
                  name={step !== 'otp' ? 'check' : 'numeric-1'}
                  size={20}
                  color={step !== 'otp' ? '#fff' : colors.primary.DEFAULT}
                />
              </View>
              <Text style={styles.progressText}>Verify OTP</Text>
            </View>
            <View style={[styles.progressLine, step !== 'otp' && styles.progressLineComplete]} />
            <View style={[styles.progressStep, step === 'complete' && styles.progressStepComplete]}>
              <View style={[styles.progressCircle, step === 'complete' && styles.progressCircleComplete]}>
                <MaterialCommunityIcons
                  name={step === 'complete' ? 'check' : 'numeric-2'}
                  size={20}
                  color={step === 'complete' ? '#fff' : colors.text.tertiary}
                />
              </View>
              <Text style={styles.progressText}>Upload Document</Text>
            </View>
          </View>

          {/* Dispatch Info Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIcon}>
                <MaterialCommunityIcons name="truck-delivery" size={28} color={colors.primary.DEFAULT} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.dispatchNum}>{dispatchNum || dispatchId.slice(0, 8)}</Text>
                <Text style={styles.dispatchInfo}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
              </View>
            </View>

            {items.length > 0 && (
              <View style={styles.itemsList}>
                <Text style={styles.itemsTitle}>Items in this delivery:</Text>
                {items.slice(0, 5).map((item: any, idx: number) => (
                  <View key={idx} style={styles.itemRow}>
                    <View style={styles.itemDot} />
                    <Text style={styles.itemText}>
                      {item.name || item.item_name} × {item.quantity}
                    </Text>
                  </View>
                ))}
                {items.length > 5 && (
                  <Text style={styles.moreItems}>+{items.length - 5} more items</Text>
                )}
              </View>
            )}
          </View>

          {/* Step 1: OTP Entry */}
          {step === 'otp' && (
            <View style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <View style={styles.stepIconContainer}>
                  <MaterialCommunityIcons name="shield-lock" size={28} color={colors.primary.DEFAULT} />
                </View>
                <Text style={styles.stepTitle}>Enter Branch Code</Text>
              </View>
              <Text style={styles.stepDescription}>
                Enter the Branch OTP (B-XXXX format) that was shared with you by the central store
              </Text>

              <TextInput
                label="Branch OTP"
                value={branchOtp}
                onChangeText={(text) => {
                  setBranchOtp(text.toUpperCase());
                  setOtpError('');
                }}
                mode="outlined"
                style={styles.input}
                placeholder="B-1234"
                autoCapitalize="characters"
                maxLength={6}
                error={!!otpError}
                left={<TextInput.Icon icon="shield-lock" />}
                outlineColor={colors.border}
                activeOutlineColor={colors.primary.DEFAULT}
              />
              {otpError ? <Text style={styles.errorText}>{otpError}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryBtn, (verifyingOtp || branchOtp.length < 6) && styles.primaryBtnDisabled]}
                onPress={handleVerifyOtp}
                disabled={verifyingOtp || branchOtp.length < 6}
                activeOpacity={0.7}
              >
                {verifyingOtp ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
                    <Text style={styles.primaryBtnText}>Verify Code</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2: Document Upload */}
          {step === 'upload' && (
            <View style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <View style={[styles.stepIconContainer, { backgroundColor: colors.success.DEFAULT + '15' }]}>
                  <MaterialCommunityIcons name="file-document" size={28} color={colors.success.DEFAULT} />
                </View>
                <Text style={styles.stepTitle}>Upload Stock Sheet</Text>
              </View>
              <Text style={styles.stepDescription}>
                Take a photo or select an image of the signed stock sheet as proof of delivery
              </Text>

              {document ? (
                <View style={styles.documentPreview}>
                  <Image source={{ uri: document.uri }} style={styles.previewImage} />
                  <View style={styles.selectedChip}>
                    <MaterialCommunityIcons name="check-circle" size={16} color={colors.success.DEFAULT} />
                    <Text style={styles.selectedChipText}>Document Selected</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeDocBtn}
                    onPress={() => setDocument(null)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="close" size={16} color={colors.danger.DEFAULT} />
                    <Text style={styles.removeDocText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.uploadOptions}>
                  <TouchableOpacity
                    style={styles.uploadBtn}
                    onPress={handleTakePhoto}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="camera" size={24} color={colors.primary.DEFAULT} />
                    <Text style={styles.uploadBtnText}>Take Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.uploadBtn}
                    onPress={handlePickImage}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="image" size={24} color={colors.primary.DEFAULT} />
                    <Text style={styles.uploadBtnText}>Choose from Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { backgroundColor: colors.success.DEFAULT },
                  (uploadingDoc || !document) && styles.primaryBtnDisabled,
                ]}
                onPress={handleUploadDocument}
                disabled={uploadingDoc || !document}
                activeOpacity={0.7}
              >
                {uploadingDoc ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="upload" size={20} color="#fff" />
                    <Text style={styles.primaryBtnText}>Upload & Complete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Step 3: Complete */}
          {step === 'complete' && (
            <View style={styles.successContainer}>
              <View style={styles.successIconContainer}>
                <MaterialCommunityIcons name="check-circle" size={72} color={colors.success.DEFAULT} />
              </View>
              <Text style={styles.successTitle}>Delivery Completed!</Text>
              <Text style={styles.successText}>
                The delivery has been marked as completed and the central store has been notified.
              </Text>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.success.DEFAULT }]}
                onPress={() => navigation.navigate('BSTabs')}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="home" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>Back to Dashboard</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: spacing.md,
  },
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
  scrollContent: { padding: spacing.lg, paddingBottom: 100 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  progressStep: {
    alignItems: 'center',
    flex: 1,
  },
  progressStepComplete: {
    opacity: 1,
  },
  progressCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.muted.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  progressCircleComplete: {
    backgroundColor: colors.success.DEFAULT,
  },
  progressText: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  progressLine: {
    height: 2,
    flex: 0.5,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.lg,
  },
  progressLineComplete: {
    backgroundColor: colors.success.DEFAULT,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary.DEFAULT + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  infoContent: { flex: 1 },
  dispatchNum: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  dispatchInfo: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  itemsList: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  itemDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text.tertiary,
    marginRight: spacing.sm,
  },
  itemText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  moreItems: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  stepCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: spacing.lg,
    ...shadows.md,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  stepIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary.DEFAULT + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  stepDescription: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  input: {
    marginBottom: spacing.sm,
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 12,
    color: colors.danger.DEFAULT,
    marginBottom: spacing.md,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 12,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  primaryBtnDisabled: {
    backgroundColor: colors.muted.DEFAULT,
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  documentPreview: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.success.DEFAULT + '20',
    borderRadius: 16,
    gap: spacing.xs,
  },
  selectedChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success.DEFAULT,
  },
  removeDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  removeDocText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger.DEFAULT,
  },
  uploadOptions: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.muted.DEFAULT,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    gap: spacing.sm,
  },
  uploadBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary.DEFAULT,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  successIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.success.DEFAULT + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  successText: {
    fontSize: 15,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default CompleteDeliveryScreen;
