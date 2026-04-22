import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { borderRadius, colors, shadows, spacing } from '../../theme';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../stores/auth.store';

const ProfileScreen: React.FC = () => {
  const { user, setUser } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    address: '',
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    setForm({
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      email: user.email || '',
      phoneNumber: user.phone_number || '',
      address: user.address || '',
    });
  }, [user]);

  const initials = useMemo(() => {
    const names = [user?.first_name, user?.last_name].filter(Boolean);
    if (!names.length) return 'FG';
    return names.map((item) => item?.charAt(0).toUpperCase()).join('').slice(0, 2);
  }, [user?.first_name, user?.last_name]);

  const roleLabel = String(user?.role || 'staff').replace(/_/g, ' ');
  const branchLabel = user?.branch_name || user?.branch?.name || 'FamousGate Hotels';

  const handleCancel = () => {
    if (user) {
      setForm({
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        email: user.email || '',
        phoneNumber: user.phone_number || '',
        address: user.address || '',
      });
    }
    setErrorMessage('');
    setSuccessMessage('');
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setErrorMessage('First name, last name, and email are required.');
      setSuccessMessage('');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await authApi.updateDetails({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phoneNumber: form.phoneNumber.trim(),
        address: form.address.trim(),
      });

      const updatedUser = response.data || response;
      await setUser({
        ...user,
        ...updatedUser,
        first_name: updatedUser.first_name ?? form.firstName.trim(),
        last_name: updatedUser.last_name ?? form.lastName.trim(),
        email: updatedUser.email ?? form.email.trim().toLowerCase(),
        phone_number: updatedUser.phone_number ?? form.phoneNumber.trim(),
        address: updatedUser.address ?? form.address.trim(),
      });

      setSuccessMessage('Profile updated successfully.');
      setIsEditing(false);
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.message || error?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Card style={styles.heroCard}>
        <Card.Content style={styles.heroContent}>
          {user?.profile_photo ? (
            <Avatar.Image size={86} source={{ uri: user.profile_photo }} />
          ) : (
            <Avatar.Text size={86} label={initials} color={colors.primary.foreground} style={styles.avatarFallback} />
          )}

          <View style={styles.heroTextWrap}>
            <Text style={styles.name}>{user?.first_name} {user?.last_name}</Text>
            <Text style={styles.meta}>{roleLabel}</Text>
            <View style={styles.metaRow}>
              <MaterialCommunityIcons name="office-building" size={16} color={colors.text.tertiary} />
              <Text style={styles.meta}>{branchLabel}</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <View style={styles.row}>
            <TextInput
              label="First Name"
              mode="outlined"
              value={form.firstName}
              onChangeText={(value) => setForm((prev) => ({ ...prev, firstName: value }))}
              style={[styles.input, styles.halfInput]}
              disabled={!isEditing || saving}
            />
            <TextInput
              label="Last Name"
              mode="outlined"
              value={form.lastName}
              onChangeText={(value) => setForm((prev) => ({ ...prev, lastName: value }))}
              style={[styles.input, styles.halfInput]}
              disabled={!isEditing || saving}
            />
          </View>

          <TextInput
            label="Email Address"
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            value={form.email}
            onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))}
            style={styles.input}
            disabled={!isEditing || saving}
          />

          <TextInput
            label="Phone Number"
            mode="outlined"
            keyboardType="phone-pad"
            value={form.phoneNumber}
            onChangeText={(value) => setForm((prev) => ({ ...prev, phoneNumber: value }))}
            style={styles.input}
            disabled={!isEditing || saving}
          />

          <TextInput
            label="Address"
            mode="outlined"
            multiline
            value={form.address}
            onChangeText={(value) => setForm((prev) => ({ ...prev, address: value }))}
            style={styles.input}
            disabled={!isEditing || saving}
          />

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          {successMessage ? <Text style={styles.successText}>{successMessage}</Text> : null}

          <View style={styles.actionRow}>
            {isEditing ? (
              <>
                <Button mode="contained" onPress={handleSave} loading={saving} disabled={saving} style={styles.primaryButton}>
                  Save Changes
                </Button>
                <Button mode="outlined" onPress={handleCancel} disabled={saving} style={styles.secondaryButton}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button mode="contained" onPress={() => setIsEditing(true)} style={styles.primaryButton}>
                Edit Profile
              </Button>
            )}
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background,
  },
  heroCard: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.card,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  avatarFallback: {
    backgroundColor: colors.primary.DEFAULT,
  },
  heroTextWrap: {
    flex: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  },
  meta: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  card: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.card,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: colors.card,
  },
  halfInput: {
    flex: 1,
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
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  primaryButton: {
    borderRadius: borderRadius.full,
  },
  secondaryButton: {
    borderRadius: borderRadius.full,
  },
});

export default ProfileScreen;
