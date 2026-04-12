import React from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '../../theme';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  icon?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  confirmColor, icon, onConfirm, onCancel,
}) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={styles.overlay}>
      <View style={styles.modal}>
        {icon && (
          <MaterialCommunityIcons name={icon as any} size={48} color={confirmColor || colors.primary.DEFAULT} style={styles.icon} />
        )}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.buttons}>
          <Button mode="outlined" onPress={onCancel} style={styles.cancelBtn}>{cancelLabel}</Button>
          <Button
            mode="contained"
            onPress={onConfirm}
            style={[styles.confirmBtn, confirmColor ? { backgroundColor: confirmColor } : {}]}
          >
            {confirmLabel}
          </Button>
        </View>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  modal: { backgroundColor: colors.card, borderRadius: 16, padding: spacing.xl, width: '100%', ...shadows.lg },
  icon: { alignSelf: 'center', marginBottom: spacing.md },
  title: { fontSize: 18, fontWeight: '700', color: colors.text.primary, textAlign: 'center', marginBottom: spacing.sm },
  message: { fontSize: 14, color: colors.text.secondary, textAlign: 'center', lineHeight: 20, marginBottom: spacing.xl },
  buttons: { flexDirection: 'row', gap: spacing.md },
  cancelBtn: { flex: 1 },
  confirmBtn: { flex: 1, backgroundColor: colors.primary.DEFAULT },
});

export default ConfirmModal;
