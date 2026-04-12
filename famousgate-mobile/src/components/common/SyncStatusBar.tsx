import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useUIStore } from '../../stores/ui.store';
import { colors, spacing } from '../../theme';

const SyncStatusBar: React.FC = () => {
  const { isOnline, pendingSyncCount } = useUIStore();

  if (isOnline && pendingSyncCount === 0) return null;

  return (
    <View style={[styles.bar, !isOnline ? styles.offline : styles.pending]}>
      <MaterialCommunityIcons
        name={!isOnline ? 'wifi-off' : 'cloud-sync'}
        size={16}
        color={colors.primary.foreground}
      />
      <Text style={styles.text}>
        {!isOnline
          ? 'Offline — changes will sync when connected'
          : `${pendingSyncCount} changes pending sync`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  offline: { backgroundColor: colors.danger.DEFAULT },
  pending: { backgroundColor: colors.warning.DEFAULT },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary.foreground,
    marginLeft: spacing.sm,
  },
});

export default SyncStatusBar;
