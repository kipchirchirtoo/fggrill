import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, Portal, Switch, Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { authApi } from '../../api/auth.api';
import { NotificationService } from '../../services/notification.service';
import { StorageService, STORAGE_KEYS } from '../../services/storage.service';
import { borderRadius, colors, shadows, spacing } from '../../theme';
import { useAuthStore } from '../../stores/auth.store';

interface MobilePreferences {
  pushNotifications: boolean;
  biometricLogin: boolean;
  compactDashboard: boolean;
  autoRefresh: boolean;
  language: 'en' | 'sw';
}

const defaultPreferences: MobilePreferences = {
  pushNotifications: false,
  biometricLogin: false,
  compactDashboard: false,
  autoRefresh: true,
  language: 'en',
};

const SettingsScreen: React.FC = () => {
  const { user, setUser } = useAuthStore();
  const [preferences, setPreferences] = useState<MobilePreferences>(defaultPreferences);
  const [saving, setSaving] = useState(false);
  const [passwordDialogVisible, setPasswordDialogVisible] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadPreferences = async () => {
      const saved = await StorageService.get<MobilePreferences>(STORAGE_KEYS.USER_PREFERENCES);
      if (saved) {
        setPreferences({ ...defaultPreferences, ...saved });
      }
    };

    loadPreferences();
  }, []);

  const handlePreferenceChange = async <K extends keyof MobilePreferences>(key: K, value: MobilePreferences[K]) => {
    if (key === 'pushNotifications' && value) {
      const granted = await NotificationService.requestPermissions();
      if (!granted) {
        setErrorMessage('Notification permission was not granted on this device.');
        return;
      }
    }

    setErrorMessage('');
    setMessage('');
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const savePreferences = async () => {
    setSaving(true);
    setErrorMessage('');
    setMessage('');

    try {
      await StorageService.set(STORAGE_KEYS.USER_PREFERENCES, preferences);
      await StorageService.set(STORAGE_KEYS.BIOMETRIC_ENABLED, preferences.biometricLogin);
      await StorageService.set(STORAGE_KEYS.LANGUAGE, preferences.language);
      setMessage('Settings saved successfully.');
    } catch {
      setErrorMessage('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const resetPasswordForm = () => {
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const closePasswordDialog = () => {
    setPasswordDialogVisible(false);
    resetPasswordForm();
    setErrorMessage('');
  };

  const handlePasswordChange = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setErrorMessage('Please fill in all password fields.');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setErrorMessage('New password and confirmation do not match.');
      return;
    }

    setPasswordLoading(true);
    setErrorMessage('');
    setMessage('');

    try {
      await authApi.updatePassword(passwordForm.currentPassword, passwordForm.newPassword);
      if (user) {
        await setUser({ ...user, password_changed_at: new Date().toISOString() });
      }
      resetPasswordForm();
      setPasswordDialogVisible(false);
      setMessage('Password updated successfully.');
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || error?.message || 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="bell-outline" size={22} color={colors.primary.DEFAULT} />
              <Text style={styles.sectionTitle}>Notifications</Text>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Push Notifications</Text>
                <Text style={styles.settingDescription}>Get delivery, payment, and system alerts on your device.</Text>
              </View>
              <Switch value={preferences.pushNotifications} onValueChange={(value) => handlePreferenceChange('pushNotifications', value)} />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Auto Refresh</Text>
                <Text style={styles.settingDescription}>Keep dashboard numbers refreshed automatically.</Text>
              </View>
              <Switch value={preferences.autoRefresh} onValueChange={(value) => handlePreferenceChange('autoRefresh', value)} />
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="view-dashboard-outline" size={22} color={colors.primary.DEFAULT} />
              <Text style={styles.sectionTitle}>Dashboard</Text>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Compact Dashboard</Text>
                <Text style={styles.settingDescription}>Reduce spacing when you need more items visible at once.</Text>
              </View>
              <Switch value={preferences.compactDashboard} onValueChange={(value) => handlePreferenceChange('compactDashboard', value)} />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>Biometric Login</Text>
                <Text style={styles.settingDescription}>Prepare the app for fingerprint or face unlock on supported devices.</Text>
              </View>
              <Switch value={preferences.biometricLogin} onValueChange={(value) => handlePreferenceChange('biometricLogin', value)} />
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="translate" size={22} color={colors.primary.DEFAULT} />
              <Text style={styles.sectionTitle}>Language</Text>
            </View>

            <View style={styles.languageRow}>
              <Button
                mode={preferences.language === 'en' ? 'contained' : 'outlined'}
                onPress={() => handlePreferenceChange('language', 'en')}
                style={styles.languageButton}
              >
                English
              </Button>
              <Button
                mode={preferences.language === 'sw' ? 'contained' : 'outlined'}
                onPress={() => handlePreferenceChange('language', 'sw')}
                style={styles.languageButton}
              >
                Swahili
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="shield-lock-outline" size={22} color={colors.primary.DEFAULT} />
              <Text style={styles.sectionTitle}>Security</Text>
            </View>

            <Text style={styles.securityText}>
              Last password change: {user?.password_changed_at ? new Date(user.password_changed_at).toLocaleDateString() : 'Not available'}
            </Text>

            <Button mode="outlined" onPress={() => setPasswordDialogVisible(true)} style={styles.passwordButton}>
              Change Password
            </Button>
          </Card.Content>
        </Card>

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {message ? <Text style={styles.successText}>{message}</Text> : null}

        <Button mode="contained" onPress={savePreferences} loading={saving} disabled={saving} style={styles.saveButton}>
          Save Settings
        </Button>
      </ScrollView>

      <Portal>
        <Dialog visible={passwordDialogVisible} onDismiss={closePasswordDialog} style={styles.dialog}>
          <Dialog.Title>Change Password</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Current Password"
              mode="outlined"
              secureTextEntry
              value={passwordForm.currentPassword}
              onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, currentPassword: value }))}
              style={styles.dialogInput}
            />
            <TextInput
              label="New Password"
              mode="outlined"
              secureTextEntry
              value={passwordForm.newPassword}
              onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, newPassword: value }))}
              style={styles.dialogInput}
            />
            <TextInput
              label="Confirm Password"
              mode="outlined"
              secureTextEntry
              value={passwordForm.confirmPassword}
              onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, confirmPassword: value }))}
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closePasswordDialog}>Cancel</Button>
            <Button onPress={handlePasswordChange} loading={passwordLoading} disabled={passwordLoading}>
              Update
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
};

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background,
  },
  card: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.card,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  settingCopy: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  settingDescription: {
    fontSize: 13,
    color: colors.text.tertiary,
    marginTop: 4,
    lineHeight: 18,
  },
  languageRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  languageButton: {
    flex: 1,
    borderRadius: borderRadius.full,
  },
  securityText: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  passwordButton: {
    borderRadius: borderRadius.full,
  },
  saveButton: {
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  errorText: {
    color: colors.danger.DEFAULT,
    marginBottom: spacing.sm,
    fontSize: 13,
  },
  successText: {
    color: colors.success.DEFAULT,
    marginBottom: spacing.sm,
    fontSize: 13,
  },
  dialog: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
  },
  dialogInput: {
    marginBottom: spacing.md,
    backgroundColor: colors.card,
  },
});

export default SettingsScreen;
