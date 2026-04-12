import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';

interface StatusBadgeProps {
  status: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  label: string;
  icon?: string;
  size?: 'small' | 'medium' | 'large';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, icon, size = 'medium' }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return colors.success.DEFAULT;
      case 'warning':
        return colors.warning.DEFAULT;
      case 'danger':
        return colors.danger.DEFAULT;
      case 'info':
        return colors.info.DEFAULT;
      case 'neutral':
      default:
        return colors.text.tertiary;
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { fontSize: 11, padding: 4, iconSize: 12 };
      case 'large':
        return { fontSize: 14, padding: 10, iconSize: 18 };
      case 'medium':
      default:
        return { fontSize: 12, padding: 6, iconSize: 14 };
    }
  };

  const statusColor = getStatusColor();
  const sizeStyles = getSizeStyles();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: `${statusColor}15`,
          paddingHorizontal: sizeStyles.padding,
          paddingVertical: sizeStyles.padding / 2,
        },
      ]}
    >
      {icon && (
        <MaterialCommunityIcons
          name={icon as any}
          size={sizeStyles.iconSize}
          color={statusColor}
          style={styles.icon}
        />
      )}
      <Text style={[styles.label, { color: statusColor, fontSize: sizeStyles.fontSize }]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: spacing.xs / 2,
  },
  label: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default StatusBadge;
