import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, Card, ActivityIndicator } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { cashierApi } from '../../api/cashier.api';

const ScanReceiptScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleScan = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setScanning(false);
    setLoading(true);
    try {
      // GET /api/cashier/bill/:bookingId
      const bill = await cashierApi.getBill(data);
      navigation.navigate('BillDetail', { booking: bill });
    } catch (e: any) {
      Alert.alert(
        'Not Found',
        e.response?.data?.message || `No bill found for: ${data}`,
        [
          { text: 'Try Again', onPress: () => { setScanned(false); setScanning(true); } },
          { text: 'Cancel', onPress: () => setScanned(false) },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
        <Text style={styles.loadingText}>Looking up bill…</Text>
      </View>
    );
  }

  if (scanning) {
    if (!permission?.granted) {
      requestPermission();
      return <View style={styles.center}><ActivityIndicator color={colors.primary.DEFAULT} /></View>;
    }
    return (
      <View style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleScan}
          barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'] }}
        />
        <View style={styles.overlay}>
          <View style={styles.frame} />
          <Text style={styles.scanHint}>Align receipt barcode within the frame</Text>
        </View>
        <Button mode="contained" onPress={() => { setScanning(false); setScanned(false); }} style={styles.cancelBtn}>
          Cancel
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <MaterialCommunityIcons name="barcode-scan" size={100} color={colors.primary.DEFAULT} />
        <Text style={styles.title}>Scan Receipt Barcode</Text>
        <Text style={styles.subtitle}>
          Scan the barcode on the customer's receipt to view bill details and process payment
        </Text>

        <Card style={styles.stepsCard}>
          <Card.Content>
            {[
              { num: '1', text: 'Ask customer for their receipt' },
              { num: '2', text: 'Tap "Start Scanning" below' },
              { num: '3', text: 'Align barcode within the frame' },
              { num: '4', text: 'View bill and process payment' },
            ].map(step => (
              <View key={step.num} style={styles.step}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{step.num}</Text>
                </View>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            ))}
          </Card.Content>
        </Card>

        {!permission?.granted ? (
          <Button mode="contained" onPress={requestPermission} style={styles.scanBtn}>
            Grant Camera Permission
          </Button>
        ) : (
          <Button
            mode="contained"
            icon="barcode-scan"
            onPress={() => { setScanned(false); setScanning(true); }}
            style={styles.scanBtn}
            contentStyle={styles.scanBtnContent}
          >
            Start Scanning
          </Button>
        )}

        <Button mode="outlined" icon="cash-multiple" onPress={() => navigation.navigate('UnpaidBills')} style={styles.listBtn}>
          View Unpaid Bills
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 15, color: colors.text.tertiary, marginTop: spacing.md },
  content: { flex: 1, padding: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: colors.text.primary, marginTop: spacing.lg, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.text.tertiary, marginTop: spacing.sm, textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl },
  stepsCard: { width: '100%', marginBottom: spacing.xl },
  step: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary.DEFAULT, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  stepNumText: { fontSize: 13, fontWeight: '700', color: colors.primary.foreground },
  stepText: { fontSize: 14, color: colors.text.secondary, flex: 1 },
  scanBtn: { width: '100%', backgroundColor: colors.primary.DEFAULT, marginBottom: spacing.md },
  scanBtnContent: { paddingVertical: 6 },
  listBtn: { width: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  frame: { width: 260, height: 200, borderWidth: 3, borderColor: '#fff', borderRadius: 12 },
  scanHint: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: spacing.xl, textAlign: 'center', paddingHorizontal: spacing.xl },
  cancelBtn: { position: 'absolute', bottom: spacing.xl, left: spacing.lg, right: spacing.lg },
});

export default ScanReceiptScreen;
