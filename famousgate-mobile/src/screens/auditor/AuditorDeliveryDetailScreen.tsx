/**
 * AuditorDeliveryDetailScreen
 *
 * Detailed view of a delivery for auditor review.
 * Shows:
 * - Dispatch information
 * - Items list
 * - Uploaded documents with viewer
 * - Audit log history
 * - Approve/Flag actions
 *
 * Receives: { dispatchId, dispatchNum? }
 *
 * API: GET /api/auditor/deliveries/:id
 *      POST /api/auditor/deliveries/:id/review
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image, Modal, TouchableOpacity } from 'react-native';
import { Text, Button, Card, ActivityIndicator, Chip, TextInput, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';
import { dispatchApi } from '../../api/dispatch.api';

interface Props {
  route: {
    params: {
      dispatchId: string;
      dispatchNum?: string;
    };
  };
  navigation: any;
}

const AuditorDeliveryDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { dispatchId, dispatchNum } = route.params;

  const [dispatch, setDispatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagNotes, setFlagNotes] = useState('');

  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);

  useEffect(() => {
    loadDeliveryDetails();
  }, []);

  const loadDeliveryDetails = async () => {
    setLoading(true);
    try {
      const data = await dispatchApi.getAuditorDeliveryDetail(dispatchId);
      setDispatch(data);
    } catch (e) {
      console.error('Failed to load delivery details:', e);
      Alert.alert('Error', 'Failed to load delivery details');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = () => {
    Alert.alert(
      'Approve Delivery',
      'Are you sure you want to approve this delivery? This action will mark it as audited.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            setActionLoading(true);
            try {
              await dispatchApi.reviewDelivery(dispatchId, 'approve', '');
              Alert.alert('Success', 'Delivery approved successfully', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.message || 'Failed to approve delivery');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleFlag = async () => {
    if (!flagNotes.trim()) {
      Alert.alert('Error', 'Please provide a reason for flagging this delivery');
      return;
    }

    setActionLoading(true);
    try {
      await dispatchApi.reviewDelivery(dispatchId, 'flag', flagNotes);
      Alert.alert('Success', 'Delivery flagged successfully', [
        {
          text: 'OK',
          onPress: () => {
            setShowFlagModal(false);
            navigation.goBack();
          },
        },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to flag delivery');
    } finally {
      setActionLoading(false);
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

  if (!dispatch) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="alert-circle" size={60} color={colors.danger.DEFAULT} />
        <Text style={styles.errorText}>Delivery not found</Text>
        <Button mode="outlined" onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
          Go Back
        </Button>
      </View>
    );
  }

  const statusConfig = {
    completed: { color: colors.success.DEFAULT, icon: 'check-circle', label: 'Completed' },
    audited: { color: colors.info.DEFAULT, icon: 'shield-check', label: 'Audited' },
    flagged: { color: colors.danger.DEFAULT, icon: 'flag', label: 'Flagged' },
  }[dispatch.status] || { color: colors.text.tertiary, icon: 'help-circle', label: dispatch.status };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header Card */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.headerRow}>
              <View style={styles.flex}>
                <Text style={styles.dispatchNum}>{dispatchNum || dispatchId.slice(0, 8)}</Text>
                <Chip
                  icon={statusConfig.icon}
                  style={[styles.statusChip, { backgroundColor: statusConfig.color + '20' }]}
                  textStyle={[styles.statusText, { color: statusConfig.color }]}
                >
                  {statusConfig.label}
                </Chip>
              </View>
              <MaterialCommunityIcons name={statusConfig.icon as any} size={40} color={statusConfig.color} />
            </View>

            <Divider style={{ marginVertical: 12 }} />

            {/* Dispatch Info */}
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="store" size={18} color={colors.text.tertiary} />
                <Text style={styles.infoLabel}>Destination:</Text>
                <Text style={styles.infoValue}>{dispatch.destination_branch || '—'}</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="account" size={18} color={colors.text.tertiary} />
                <Text style={styles.infoLabel}>Driver:</Text>
                <Text style={styles.infoValue}>{dispatch.driver_name || '—'}</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="clock-outline" size={18} color={colors.text.tertiary} />
                <Text style={styles.infoLabel}>Completed:</Text>
                <Text style={styles.infoValue}>
                  {dispatch.completed_at ? new Date(dispatch.completed_at).toLocaleString() : '—'}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Items List */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Items ({dispatch.items?.length || 0})</Text>
            {dispatch.items && dispatch.items.length > 0 ? (
              dispatch.items.map((item: any, idx: number) => (
                <View key={idx} style={styles.itemRow}>
                  <MaterialCommunityIcons name="package-variant" size={20} color={colors.primary.DEFAULT} />
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name || item.item_name}</Text>
                    <Text style={styles.itemQuantity}>Quantity: {item.quantity}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No items</Text>
            )}
          </Card.Content>
        </Card>

        {/* Documents */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>
              Uploaded Documents ({dispatch.documents?.length || 0})
            </Text>
            {dispatch.documents && dispatch.documents.length > 0 ? (
              dispatch.documents.map((doc: any, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.documentCard}
                  onPress={() => setSelectedDocument(doc.document_url)}
                >
                  <MaterialCommunityIcons name="file-document" size={32} color={colors.primary.DEFAULT} />
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentName}>{doc.file_name || `Document ${idx + 1}`}</Text>
                    <Text style={styles.documentMeta}>
                      {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString() : ''}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="eye" size={20} color={colors.text.tertiary} />
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyText}>No documents uploaded</Text>
            )}
          </Card.Content>
        </Card>

        {/* Audit Log */}
        {dispatch.audit_log && dispatch.audit_log.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Audit Log</Text>
              {dispatch.audit_log.map((log: any, idx: number) => (
                <View key={idx} style={styles.logEntry}>
                  <View style={styles.logDot} />
                  <View style={styles.logContent}>
                    <Text style={styles.logAction}>{log.action}</Text>
                    <Text style={styles.logMeta}>
                      {log.performed_by_name || 'System'} •{' '}
                      {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                    </Text>
                    {log.notes && <Text style={styles.logNotes}>{log.notes}</Text>}
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Actions */}
        {dispatch.status === 'completed' && (
          <View style={styles.actionsContainer}>
            <Button
              mode="contained"
              icon="check-circle"
              onPress={handleApprove}
              loading={actionLoading}
              disabled={actionLoading}
              style={[styles.actionBtn, { backgroundColor: colors.success.DEFAULT }]}
            >
              Approve Delivery
            </Button>
            <Button
              mode="outlined"
              icon="flag"
              onPress={() => setShowFlagModal(true)}
              disabled={actionLoading}
              style={[styles.actionBtn, { borderColor: colors.danger.DEFAULT }]}
              labelStyle={{ color: colors.danger.DEFAULT }}
            >
              Flag Discrepancy
            </Button>
          </View>
        )}
      </ScrollView>

      {/* Flag Modal */}
      <Modal visible={showFlagModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Flag Discrepancy</Text>
            <Text style={styles.modalDescription}>
              Provide details about the issue found with this delivery
            </Text>
            <TextInput
              label="Reason for flagging"
              value={flagNotes}
              onChangeText={setFlagNotes}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => {
                  setShowFlagModal(false);
                  setFlagNotes('');
                }}
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleFlag}
                loading={actionLoading}
                disabled={actionLoading || !flagNotes.trim()}
                style={[{ flex: 1 }, { backgroundColor: colors.danger.DEFAULT }]}
              >
                Flag
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Document Viewer Modal */}
      <Modal visible={!!selectedDocument} transparent animationType="fade">
        <View style={styles.documentViewerOverlay}>
          <TouchableOpacity
            style={styles.closeDocumentBtn}
            onPress={() => setSelectedDocument(null)}
          >
            <MaterialCommunityIcons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          {selectedDocument && (
            <Image source={{ uri: selectedDocument }} style={styles.documentImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { fontSize: 14, color: colors.text.tertiary, marginTop: 12 },
  errorText: { fontSize: 16, color: colors.text.secondary, marginTop: 12 },
  scroll: { padding: 16, paddingBottom: 100 },
  card: { marginBottom: 16, ...shadows.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  flex: { flex: 1 },
  dispatchNum: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginBottom: 8 },
  statusChip: { alignSelf: 'flex-start' },
  statusText: { fontSize: 12, fontWeight: '600' },
  infoGrid: { marginTop: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoLabel: { fontSize: 14, color: colors.text.tertiary, marginLeft: 8, minWidth: 90 },
  infoValue: { fontSize: 14, color: colors.text.primary, fontWeight: '500', flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text.primary, marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  itemQuantity: { fontSize: 13, color: colors.text.tertiary, marginTop: 2 },
  emptyText: { fontSize: 14, color: colors.text.tertiary, fontStyle: 'italic' },
  documentCard: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: colors.muted.DEFAULT, borderRadius: 8, marginBottom: 8 },
  documentInfo: { flex: 1, marginLeft: 12 },
  documentName: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  documentMeta: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  logEntry: { flexDirection: 'row', marginBottom: 12 },
  logDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary.DEFAULT, marginTop: 6, marginRight: 12 },
  logContent: { flex: 1 },
  logAction: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  logMeta: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  logNotes: { fontSize: 13, color: colors.text.secondary, marginTop: 4, fontStyle: 'italic' },
  actionsContainer: { gap: 12, marginTop: 8 },
  actionBtn: { width: '100%' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: colors.card, borderRadius: 12, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginBottom: 8 },
  modalDescription: { fontSize: 14, color: colors.text.secondary, marginBottom: 16 },
  modalInput: { marginBottom: 16, backgroundColor: colors.background },
  modalActions: { flexDirection: 'row', gap: 12 },
  documentViewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  closeDocumentBtn: { position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 8 },
  documentImage: { width: '90%', height: '80%' },
});

export default AuditorDeliveryDetailScreen;
