/**
 * BillDetailScreen
 *
 * Shows full bill details after scanning a receipt barcode or tapping from UnpaidBills.
 * Handles the real API response shape from GET /api/cashier/bill/:bookingId
 * Supports multiple bill types: restaurant, bar, hotel, conference, invoice, kyogong, unpaid_bill
 *
 * Receives: { booking: any } — raw API response
 * Navigates to: Payment with { booking }
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, Divider, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';

interface Props {
  route: { params: { booking: any } };
  navigation: any;
}

const BillDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { booking } = route.params;

  console.log('📱 [BillDetail] Full booking data:', JSON.stringify(booking, null, 2));

  // Detect bill type from response structure
  const billType = booking.type || 
    (booking.order ? (booking.order.service_category ? 'kyogong' : 'restaurant') : 
    (booking.booking ? 'hotel' : 
    (booking.invoice ? 'invoice' : 
    (booking.bill ? 'unpaid_bill' : 'unknown'))));

  console.log('📱 [BillDetail] Detected bill type:', billType);

  // Extract data based on bill type
  let bookingNum, customerName, roomNumber, checkIn, checkOut, lineItems, billStatus;
  
  if (billType === 'restaurant' || billType === 'bar' || billType === 'kyogong') {
    bookingNum = booking.order?.order_number || booking.bill_number || booking.id?.slice(0, 8);
    customerName = booking.order?.guest_name || 'Walk-in';
    roomNumber = booking.order?.room_number;
    lineItems = booking.order?.items || [];
    billStatus = booking.order?.status;
  } else if (billType === 'hotel') {
    bookingNum = booking.booking?.id?.slice(0, 8) || booking.bill_number;
    customerName = booking.booking?.guest_name || 'Guest';
    roomNumber = booking.booking?.room_number;
    checkIn = booking.booking?.check_in;
    checkOut = booking.booking?.check_out;
    lineItems = [];
    billStatus = booking.booking?.status;
  } else if (billType === 'conference') {
    bookingNum = booking.booking?.invoice_number || booking.bill_number;
    customerName = booking.booking?.company_name || booking.booking?.customer_name || 'Guest';
    checkIn = booking.booking?.start_date;
    checkOut = booking.booking?.end_date;
    lineItems = [];
    billStatus = booking.booking?.payment_status;
  } else if (billType === 'invoice') {
    bookingNum = booking.invoice?.invoice_number || booking.bill_number;
    customerName = booking.invoice?.customer_name || 'Customer';
    lineItems = booking.invoice?.items || [];
    billStatus = booking.invoice?.status;
  } else if (billType === 'unpaid_bill') {
    bookingNum = booking.bill?.bill_number || booking.bill_number;
    customerName = booking.bill?.customer_name || 'Customer';
    lineItems = booking.bill?.items || [];
    billStatus = booking.bill?.status;
  } else {
    // Fallback for unknown structure
    bookingNum = booking.booking_number || booking.bill_number || booking.reference || booking.id?.slice(0, 8);
    customerName = booking.customer_name || booking.guest_name || booking.name || 'Guest';
    roomNumber = booking.room_number || booking.room?.number;
    checkIn = booking.check_in || booking.check_in_date;
    checkOut = booking.check_out || booking.check_out_date;
    lineItems = booking.items || booking.line_items || booking.charges || [];
  }

  // Financial data - always in booking.financials
  const subtotal = Number(booking.financials?.subtotal || booking.financials?.sub_total || 0);
  const tax = Number(booking.financials?.tax || booking.financials?.tax_amount || booking.financials?.vat || 0);
  const totalAmount = Number(booking.financials?.total_amount || booking.financials?.total || booking.total_amount || 0);
  const amountPaid = Number(booking.financials?.amount_paid || booking.financials?.paid || booking.amount_paid || 0);
  const balance = Number(booking.financials?.balance ?? booking.balance ?? (totalAmount - amountPaid));
  const isPaid = balance <= 0 || booking.payment_status === 'paid' || billStatus === 'paid';

  console.log('📱 [BillDetail] Financial breakdown:', {
    subtotal,
    tax,
    totalAmount,
    amountPaid,
    balance,
    isPaid,
    payment_status: booking.payment_status,
    billStatus
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header card */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <View style={styles.headerRow}>
              <View style={styles.flex}>
                <Text style={styles.bookingNum}>{bookingNum}</Text>
                <Text style={styles.customerName}>{customerName}</Text>
                <Chip 
                  mode="outlined" 
                  style={styles.typeChip}
                  textStyle={styles.typeChipText}
                >
                  {billType.toUpperCase()}
                </Chip>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: isPaid ? colors.success.DEFAULT + '20' : colors.warning.DEFAULT + '20' }]}>
                <Text style={[styles.statusText, { color: isPaid ? colors.success.DEFAULT : colors.warning.DEFAULT }]}>
                  {isPaid ? 'PAID' : 'UNPAID'}
                </Text>
              </View>
            </View>

            {roomNumber && (
              <View style={styles.metaRow}>
                <MaterialCommunityIcons name="door" size={15} color={colors.text.tertiary} />
                <Text style={styles.metaText}>Room {roomNumber}</Text>
              </View>
            )}
            {checkIn && (
              <View style={styles.metaRow}>
                <MaterialCommunityIcons name="calendar-range" size={15} color={colors.text.tertiary} />
                <Text style={styles.metaText}>
                  {new Date(checkIn).toLocaleDateString()}
                  {checkOut ? ` → ${new Date(checkOut).toLocaleDateString()}` : ' (ongoing)'}
                </Text>
              </View>
            )}
            {billStatus && (
              <View style={styles.metaRow}>
                <MaterialCommunityIcons name="information" size={15} color={colors.text.tertiary} />
                <Text style={styles.metaText}>Status: {billStatus}</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Line items */}
        <Card style={styles.itemsCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Charges</Text>

            {lineItems.length === 0 ? (
              <Text style={styles.noItems}>No itemised charges available</Text>
            ) : (
              lineItems.map((item: any, idx: number) => {
                const desc = item.description || item.name || item.service || `Item ${idx + 1}`;
                const qty = item.qty || item.quantity || 1;
                const unitPrice = Number(item.unit_price || item.price || item.rate || 0);
                const total = Number(item.total || item.amount || unitPrice * qty);
                return (
                  <View key={idx}>
                    <View style={styles.lineItem}>
                      <View style={styles.flex}>
                        <Text style={styles.lineDesc}>{desc}</Text>
                        {qty > 1 && <Text style={styles.lineQty}>× {qty} @ KES {unitPrice.toLocaleString()}</Text>}
                      </View>
                      <Text style={styles.lineTotal}>KES {total.toLocaleString()}</Text>
                    </View>
                    {idx < lineItems.length - 1 && <Divider />}
                  </View>
                );
              })
            )}

            <Divider style={styles.divider} />

            {subtotal > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>KES {subtotal.toLocaleString()}</Text>
              </View>
            )}
            {tax > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax / VAT</Text>
                <Text style={styles.totalValue}>KES {tax.toLocaleString()}</Text>
              </View>
            )}

            <View style={[styles.totalRow, styles.grandRow]}>
              <Text style={styles.grandLabel}>Total</Text>
              <Text style={styles.grandValue}>KES {totalAmount.toLocaleString()}</Text>
            </View>

            {amountPaid > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Amount Paid</Text>
                <Text style={[styles.totalValue, { color: colors.success.DEFAULT }]}>
                  KES {amountPaid.toLocaleString()}
                </Text>
              </View>
            )}

            <View style={[styles.totalRow, styles.balanceRow]}>
              <Text style={styles.balanceLabel}>Balance Due</Text>
              <Text style={[styles.balanceValue, { color: isPaid ? colors.success.DEFAULT : colors.danger.DEFAULT }]}>
                KES {Math.max(0, balance).toLocaleString()}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Action */}
        {!isPaid ? (
          <Button
            mode="contained"
            icon="cash"
            onPress={() => navigation.navigate('Payment', { booking })}
            style={styles.payBtn}
            contentStyle={styles.payBtnContent}
          >
            Process Payment — KES {Math.max(0, balance).toLocaleString()}
          </Button>
        ) : (
          <Card style={styles.paidCard}>
            <Card.Content>
              <View style={styles.paidRow}>
                <MaterialCommunityIcons name="check-circle" size={24} color={colors.success.DEFAULT} />
                <Text style={styles.paidText}>This bill has been fully paid</Text>
              </View>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  headerCard: { marginBottom: spacing.lg, ...shadows.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  flex: { flex: 1 },
  bookingNum: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
  customerName: { fontSize: 14, color: colors.text.secondary, marginTop: 4, marginBottom: spacing.sm },
  typeChip: { alignSelf: 'flex-start', height: 24, backgroundColor: colors.primary.DEFAULT + '10', borderColor: colors.primary.DEFAULT },
  typeChipText: { fontSize: 10, fontWeight: '700', color: colors.primary.DEFAULT, marginVertical: 0 },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  metaText: { fontSize: 13, color: colors.text.tertiary, marginLeft: spacing.sm },
  itemsCard: { marginBottom: spacing.lg, ...shadows.sm },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md },
  noItems: { fontSize: 13, color: colors.text.tertiary, fontStyle: 'italic', marginBottom: spacing.md },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: spacing.sm },
  lineDesc: { fontSize: 14, color: colors.text.primary, flex: 1 },
  lineQty: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  lineTotal: { fontSize: 14, fontWeight: '600', color: colors.text.primary, marginLeft: spacing.md },
  divider: { marginVertical: spacing.md },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  totalLabel: { fontSize: 14, color: colors.text.tertiary },
  totalValue: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  grandRow: { paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm },
  grandLabel: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  grandValue: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  balanceRow: { paddingTop: spacing.sm, borderTopWidth: 2, borderTopColor: colors.border, marginTop: spacing.sm },
  balanceLabel: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  balanceValue: { fontSize: 22, fontWeight: '800' },
  payBtn: { backgroundColor: colors.success.DEFAULT },
  payBtnContent: { paddingVertical: 6 },
  paidCard: { backgroundColor: colors.success.DEFAULT + '10', borderWidth: 1, borderColor: colors.success.DEFAULT },
  paidRow: { flexDirection: 'row', alignItems: 'center' },
  paidText: { fontSize: 15, fontWeight: '600', color: colors.success.DEFAULT, marginLeft: spacing.md },
});

export default BillDetailScreen;
