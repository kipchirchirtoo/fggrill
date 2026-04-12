import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, Button, TextInput, RadioButton, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { cashierApi, mpesaApi } from '../../api/cashier.api';

interface PaymentScreenProps {
  route: { params: { booking: any } };
  navigation: any;
}

const METHODS = [
  { value: 'cash', label: 'Cash', icon: 'cash' },
  { value: 'mpesa', label: 'M-Pesa', icon: 'cellphone' },
  { value: 'card', label: 'Card / POS', icon: 'credit-card' },
];

const PaymentScreen: React.FC<PaymentScreenProps> = ({ route, navigation }) => {
  const { booking } = route.params;
  const balance = booking.balance ?? booking.outstanding_amount ?? booking.total_amount ?? 0;
  const [method, setMethod] = useState<'cash' | 'mpesa' | 'card'>('cash');
  const [amount, setAmount] = useState(String(balance));
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [mpesaStatus, setMpesaStatus] = useState<'idle' | 'waiting' | 'success' | 'failed'>('idle');

  const handlePay = async () => {
    const payAmt = parseFloat(amount);
    if (!payAmt || payAmt <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; }
    if (payAmt > balance) { Alert.alert('Error', 'Amount exceeds balance due'); return; }

    if (method === 'mpesa') {
      if (!mpesaPhone || mpesaPhone.length < 10) { Alert.alert('Error', 'Enter a valid M-Pesa phone number'); return; }
      setLoading(true);
      setMpesaStatus('waiting');
      try {
        // POST /api/payments/mpesa/initiate
        const res = await mpesaApi.initiate({
          phone: mpesaPhone,
          amount: payAmt,
          booking_id: booking.id,
          reference: booking.booking_number || booking.id,
        });
        const checkoutId = res.CheckoutRequestID || res.checkout_request_id;
        // Poll for status
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          try {
            const status = await mpesaApi.checkStatus(checkoutId);
            if (status.ResultCode === '0' || status.status === 'completed') {
              clearInterval(poll);
              setMpesaStatus('success');
              Alert.alert('Payment Successful', `M-Pesa payment of KES ${payAmt.toLocaleString()} confirmed.`, [
                { text: 'OK', onPress: () => navigation.navigate('CashierTabs') },
              ]);
            } else if (status.ResultCode && status.ResultCode !== '0') {
              clearInterval(poll);
              setMpesaStatus('failed');
              Alert.alert('Payment Failed', status.ResultDesc || 'M-Pesa payment was not completed');
            }
          } catch { /* keep polling */ }
          if (attempts >= 12) { // 60 seconds
            clearInterval(poll);
            setMpesaStatus('failed');
            Alert.alert('Timeout', 'M-Pesa payment timed out. Please check with the customer.');
          }
        }, 5000);
      } catch (e: any) {
        setMpesaStatus('failed');
        Alert.alert('Error', e.response?.data?.message || 'Failed to initiate M-Pesa payment');
      } finally { setLoading(false); }
      return;
    }

    setLoading(true);
    try {
      // POST /api/cashier/pay
      await cashierApi.processPayment({
        booking_id: booking.id,
        amount: payAmt,
        payment_method: method,
      });
      Alert.alert('Payment Successful', `KES ${payAmt.toLocaleString()} received via ${method.toUpperCase()}`, [
        { text: 'OK', onPress: () => navigation.navigate('CashierTabs') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Payment failed');
    } finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.billCard}>
          <Card.Content>
            <View style={styles.billRow}>
              <View>
                <Text style={styles.bookingNum}>{booking.booking_number || booking.id?.slice(0, 8)}</Text>
                <Text style={styles.customer}>{booking.customer_name || booking.guest_name || 'Guest'}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: colors.warning.DEFAULT + '20' }]}>
                <Text style={[styles.statusText, { color: colors.warning.DEFAULT }]}>UNPAID</Text>
              </View>
            </View>
            <View style={styles.amountRows}>
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Total Amount</Text>
                <Text style={styles.amountValue}>KES {Number(booking.total_amount ?? 0).toLocaleString()}</Text>
              </View>
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Amount Paid</Text>
                <Text style={[styles.amountValue, { color: colors.success.DEFAULT }]}>
                  KES {Number(booking.amount_paid ?? 0).toLocaleString()}
                </Text>
              </View>
              <View style={[styles.amountRow, styles.balanceRow]}>
                <Text style={styles.balanceLabel}>Balance Due</Text>
                <Text style={styles.balanceValue}>KES {Number(balance).toLocaleString()}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Text style={styles.sectionTitle}>Payment Method</Text>
        <Card style={styles.methodCard}>
          <Card.Content>
            <RadioButton.Group onValueChange={v => setMethod(v as any)} value={method}>
              {METHODS.map(m => (
                <TouchableOpacity key={m.value} style={styles.methodRow} onPress={() => setMethod(m.value as any)}>
                  <MaterialCommunityIcons name={m.icon as any} size={24} color={method === m.value ? colors.primary.DEFAULT : colors.text.tertiary} />
                  <Text style={[styles.methodLabel, method === m.value && styles.methodActive]}>{m.label}</Text>
                  <RadioButton value={m.value} />
                </TouchableOpacity>
              ))}
            </RadioButton.Group>
          </Card.Content>
        </Card>

        {method === 'mpesa' && (
          <TextInput
            label="M-Pesa Phone Number"
            value={mpesaPhone}
            onChangeText={setMpesaPhone}
            keyboardType="phone-pad"
            mode="outlined"
            placeholder="e.g. 0712345678"
            style={styles.input}
            left={<TextInput.Icon icon="cellphone" />}
          />
        )}

        <Text style={styles.sectionTitle}>Amount</Text>
        <TextInput
          label="Payment Amount (KES)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          mode="outlined"
          style={styles.input}
          left={<TextInput.Affix text="KES" />}
        />
        <View style={styles.quickAmounts}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => setAmount(String(Math.floor(balance / 2)))}>
            <Text style={styles.quickBtnText}>Half</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => setAmount(String(balance))}>
            <Text style={styles.quickBtnText}>Full Balance</Text>
          </TouchableOpacity>
        </View>

        {mpesaStatus === 'waiting' && (
          <Card style={styles.mpesaWaiting}>
            <Card.Content>
              <View style={styles.mpesaRow}>
                <ActivityIndicator color={colors.success.DEFAULT} />
                <Text style={styles.mpesaText}>Waiting for M-Pesa confirmation…</Text>
              </View>
              <Text style={styles.mpesaHint}>Customer should check their phone for the STK push prompt</Text>
            </Card.Content>
          </Card>
        )}

        <Button
          mode="contained"
          onPress={handlePay}
          loading={loading}
          disabled={loading || mpesaStatus === 'waiting'}
          style={styles.payBtn}
          icon="check-circle"
        >
          {method === 'mpesa' ? 'Send M-Pesa Request' : `Confirm Payment — KES ${Number(amount || 0).toLocaleString()}`}
        </Button>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  billCard: { marginBottom: spacing.lg, ...shadows.md },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  bookingNum: { fontSize: 17, fontWeight: '700', color: colors.text.primary },
  customer: { fontSize: 14, color: colors.text.secondary, marginTop: 4 },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '700' },
  amountRows: {},
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  amountLabel: { fontSize: 14, color: colors.text.tertiary },
  amountValue: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  balanceRow: { paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm },
  balanceLabel: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  balanceValue: { fontSize: 20, fontWeight: '700', color: colors.danger.DEFAULT },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md },
  methodCard: { marginBottom: spacing.lg, ...shadows.sm },
  methodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  methodLabel: { flex: 1, fontSize: 15, color: colors.text.secondary, marginLeft: spacing.md },
  methodActive: { color: colors.primary.DEFAULT, fontWeight: '600' },
  input: { marginBottom: spacing.md, backgroundColor: colors.card },
  quickAmounts: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  quickBtn: { flex: 1, padding: spacing.md, backgroundColor: colors.input, borderRadius: 8, alignItems: 'center' },
  quickBtnText: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  mpesaWaiting: { marginBottom: spacing.lg, backgroundColor: colors.success.DEFAULT + '10', borderWidth: 1, borderColor: colors.success.DEFAULT },
  mpesaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  mpesaText: { fontSize: 14, fontWeight: '600', color: colors.success.DEFAULT, marginLeft: spacing.md },
  mpesaHint: { fontSize: 12, color: colors.text.tertiary },
  payBtn: { backgroundColor: colors.success.DEFAULT },
});

export default PaymentScreen;
