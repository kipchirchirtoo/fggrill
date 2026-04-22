import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, spacing } from '../../theme';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  title?: string;
}

/**
 * QRCodeDisplay component
 * Note: For actual QR code generation, you would use a library like react-native-qrcode-svg
 * This is a placeholder that shows the value
 */
export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  size = 200,
  title,
}) => {
  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={[styles.qrPlaceholder, { width: size, height: size }]}>
        <Text style={styles.qrText}>QR: {value}</Text>
        <Text style={styles.qrHint}>Install react-native-qrcode-svg for actual QR codes</Text>
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  qrPlaceholder: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  qrText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  qrHint: {
    fontSize: 10,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  value: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: spacing.md,
    fontFamily: 'monospace',
  },
});
