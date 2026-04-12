/**
 * BillDetailScreen
 *
 * Shows full bill details after scanning a receipt barcode or tapping from UnpaidBills.
 * Handles the real API response shape from GET /api/cashier/bill/:bookingId
 *
 * Receives: { booking: any } — raw API response
 * Navigates to: Payment with { booking }
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';

interface Props {
  route: { params: { booking: any } };
  navigation: any;
}

const BillDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { booking } = route.params;

  // Normalise field names — backend may return different shapes
  const bookingNum = booking.booking_number || booking.confirmation_number || booking.reference || booking.id?.slice(0, 8);
  const customerName = booking.customer_name || booking.guest_name || booking.name || 'Guest';
  const roomNumber = booking.room_number || booking.room?.number;
  const checkIn = booking.check_in || booking.check_in_date;
  const checkOut = booking.check_out || booking.check_out_date;
  const lineItems: any[] = booking.items || booking.line_items || booking.charges || [];
  const subtotal = Number(booking.subtotal || booking.sub_total || 0);
  const tax = Number(booking.tax || booking.tax_amount || booking.vat || 0);
  const totalAmount = Number(booking.total_amount || booking.total || booking.amount || 0);
  const amountPaid = Number(booking.amount_paid || booking.paid_amount || booking.paid || 0);
  const balance = Number(booking.balance ?? booking.outstanding_amount ?? (totalAmount - amountPaid));
  const isPaid = balance <= 0;

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
  customerName: { fontSize: 14, color: colors.text.secondary, marginTop: 4 },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  metaText: { fontSize: 13, color: colors.text.tertiary, marginLeft: spacing.sm },
  itemsCard: { marginBottom: spacing.lg, ...shadows.sm },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md },
  noItems: { fontSize: 13, color: colors.text.tertiary, fontStyle: 'italic', marginBottom: spacing.md },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: spacing.sm },
  lineDesc: { fontSize: 14, color: colors.text.primary },
  lineQty: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  lineTotal: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
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
