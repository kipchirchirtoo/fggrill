import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Avatar, Menu, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authApi } from '../../api/auth.api';
import { borderRadius, colors, shadows, spacing } from '../../theme';
import { useAuthStore } from '../../stores/auth.store';

interface DashboardHeaderProps {
  navigation: any;
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: string;
  accentColor?: string;
  badgeLabel?: string;
  badgeIcon?: string;
  badgeColor?: string;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  navigation,
  eyebrow,
  title,
  subtitle,
  icon,
  accentColor = colors.primary.DEFAULT,
  badgeLabel,
  badgeIcon,
  badgeColor = colors.accent.DEFAULT,
}) => {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  const [menuVisible, setMenuVisible] = useState(false);

  const initials = useMemo(() => {
    const fullName = [user?.first_name, user?.last_name].filter(Boolean);
    if (!fullName.length) return 'FG';
    return fullName.map((part) => part?.charAt(0).toUpperCase()).join('').slice(0, 2);
  }, [user?.first_name, user?.last_name]);

  const navigateTo = (screen: 'Profile' | 'Settings') => {
    setMenuVisible(false);
    const parent = navigation?.getParent?.();
    if (parent?.navigate) {
      parent.navigate(screen);
      return;
    }
    navigation?.navigate?.(screen);
  };

  const handleLogout = () => {
    setMenuVisible(false);
    Alert.alert('Log out', 'Do you want to end your session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          try {
            await authApi.logout();
          } catch {
          } finally {
            await logout();
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.topRow}>
        <View style={styles.contentRow}>
          <View style={[styles.iconWrap, { backgroundColor: `${accentColor}16` }]}>
            <MaterialCommunityIcons name={icon as any} size={26} color={accentColor} />
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>

        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <TouchableOpacity style={styles.avatarButton} activeOpacity={0.85} onPress={() => setMenuVisible(true)}>
              {user?.profile_photo ? (
                <Avatar.Image size={42} source={{ uri: user.profile_photo }} />
              ) : (
                <Avatar.Text size={42} label={initials} color={colors.primary.foreground} style={styles.avatarFallback} />
              )}
              <MaterialCommunityIcons name="chevron-down" size={18} color={colors.text.tertiary} />
            </TouchableOpacity>
          }
        >
          <Menu.Item leadingIcon="account-circle-outline" onPress={() => navigateTo('Profile')} title="Profile" />
          <Menu.Item leadingIcon="cog-outline" onPress={() => navigateTo('Settings')} title="Settings" />
          <Menu.Item leadingIcon="logout" onPress={handleLogout} title="Logout" />
        </Menu>
      </View>

      {badgeLabel ? (
        <View style={[styles.badge, { backgroundColor: `${badgeColor}14` }]}>
          {badgeIcon ? <MaterialCommunityIcons name={badgeIcon as any} size={16} color={badgeColor} /> : null}
          <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeLabel}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: spacing.md,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  textWrap: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 12,
    color: colors.text.tertiary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  avatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: borderRadius.full,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  avatarFallback: {
    backgroundColor: colors.primary.DEFAULT,
  },
  badge: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default DashboardHeader;
