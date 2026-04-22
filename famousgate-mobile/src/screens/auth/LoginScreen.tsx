/**
 * LoginScreen
 *
 * Entry point for all roles.
 * After login, RootNavigator automatically routes to the correct role navigator.
 *
 * API: POST /api/auth/login → { token, user }
 */

import React, { useState } from 'react';
import {
  View, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Alert,
} from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { useAuthStore } from '../../stores/auth.store';
import { authApi } from '../../api/auth.api';

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuthStore();

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      console.log('🔑 [LOGIN] Attempting login for:', trimmedEmail);
      const response = await authApi.login(trimmedEmail, password);
      
      console.log('🔑 [LOGIN] Raw response:', JSON.stringify(response, null, 2));

      // Handle different response formats
      // Format 1: { token, user }
      // Format 2: { data: { user, session: { access_token } } }
      // Format 3: { success: true, data: { user, session: { access_token } } }
      
      let data = response;
      if (response.data) {
        data = response.data;
      }
      
      const accessToken = 
        data.token || 
        data.access_token || 
        data.session?.access_token;
        
      const refreshToken = 
        data.refresh_token || 
        data.refreshToken || 
        data.session?.refresh_token || 
        accessToken;
        
      const user = data.user;

      console.log('🔑 [LOGIN] Extracted data:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        hasUser: !!user,
        userEmail: user?.email,
        userRole: user?.role,
      });

      if (!accessToken || !user) {
        console.error('❌ [LOGIN] Invalid response:', response);
        throw new Error('Invalid response from server. Please try again.');
      }

      console.log('🔑 [LOGIN] Calling auth store login...');
      await login({ access_token: accessToken, refresh_token: refreshToken, user });
      console.log('✅ [LOGIN] Login successful, navigation should update');
      // RootNavigator will automatically redirect based on user.role
    } catch (err: any) {
      console.error('❌ [LOGIN] Login error:', err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Login failed. Please check your credentials.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoBox}>
          <View style={styles.logoCircle}>
            <MaterialCommunityIcons name="office-building" size={52} color={colors.primary.foreground} />
          </View>
          <Text style={styles.appName}>FamousGate Hotels</Text>
          <Text style={styles.appSubtitle}>Staff Mobile App</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <TextInput
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            returnKeyType="next"
            left={<TextInput.Icon icon="email-outline" />}
            style={styles.input}
            disabled={loading}
          />

          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                onPress={() => setShowPassword(v => !v)}
              />
            }
            style={styles.input}
            disabled={loading}
          />

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.loginBtn}
            contentStyle={styles.loginBtnContent}
            labelStyle={styles.loginBtnLabel}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </View>

        {/* Footer */}
        <Text style={styles.hint}>
          Use your FamousGate Hotels staff credentials.{'\n'}
          Contact your manager if you need access.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  logoBox: { alignItems: 'center', marginBottom: spacing.xxl },
  logoCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.primary.DEFAULT,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.lg,
  },
  appName: { fontSize: 24, fontWeight: '700', color: colors.text.primary },
  appSubtitle: { fontSize: 14, color: colors.text.tertiary, marginTop: 4 },
  form: { width: '100%' },
  input: { marginBottom: spacing.md, backgroundColor: colors.card },
  loginBtn: { backgroundColor: colors.primary.DEFAULT, marginTop: spacing.sm },
  loginBtnContent: { paddingVertical: 6 },
  loginBtnLabel: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.xxl, lineHeight: 20 },
});

export default LoginScreen;
