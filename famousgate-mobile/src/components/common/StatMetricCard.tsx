import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { borderRadius, colors, shadows, spacing } from '../../theme';

interface StatMetricCardProps {
  icon: string;
  label: string;
  value: string | number;
  color?: string;
  caption?: string;
  alert?: boolean;
  onPress?: () => void;
}

const StatMetricCard: React.FC<StatMetricCardProps> = ({
  icon,
  label,
  value,
  color = colors.primary.DEFAULT,
  caption,
  alert = false,
  onPress,
}) => {
  const formattedValue = typeof value === 'number' ? value.toLocaleString() : value;

  return (
    <Card style={[styles.card, alert && { borderColor: color, borderWidth: 1.5 }]}>
      <TouchableOpacity activeOpacity={onPress ? 0.86 : 1} disabled={!onPress} onPress={onPress}>
        <Card.Content style={styles.content}>
          <View style={[styles.iconWrap, { backgroundColor: `${color}14` }]}>
            <MaterialCommunityIcons name={icon as any} size={24} color={color} />
          </View>

          <View style={styles.textBlock}>
            <Text style={styles.label}>{label}</Text>
            {caption ? <Text style={styles.caption}>{caption}</Text> : null}
          </View>

          <View style={styles.valueBlock}>
            <Text style={[styles.value, { color }]}>{formattedValue}</Text>
            {onPress ? <MaterialCommunityIcons name="chevron-right" size={18} color={colors.text.tertiary} /> : null}
          </View>
        </Card.Content>
      </TouchableOpacity>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  textBlock: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  caption: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  valueBlock: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 2,
  },
});

export default StatMetricCard;
