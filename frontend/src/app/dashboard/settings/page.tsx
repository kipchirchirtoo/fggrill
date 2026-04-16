'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { Settings, Bell, Lock, Moon, Globe, Save, Sun, Key, Shield, Eye, EyeOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { userAPI } from '@/lib/api';

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [settings, setSettings] = useState({
    pushNotifications: false,
    desktopNotifications: true,
    notificationSounds: true,
    language: 'en',
    notificationCategories: {
      inventory: true,
      finance: true,
      housekeeping: true,
      bookings: true,
      staff: true,
      system: true,
    }
  });

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('userSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to parse saved settings');
      }
    }

    // Check notification permission status
    if ('Notification' in window) {
      setSettings(prev => ({
        ...prev,
        pushNotifications: Notification.permission === 'granted'
      }));
    }
  }, []);

  const handlePushNotificationToggle = async (enabled: boolean) => {
    if (enabled) {
      if (!('Notification' in window)) {
        toast.error('Push notifications not supported in this browser');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setSettings(prev => ({ ...prev, pushNotifications: true }));
        localStorage.setItem('userSettings', JSON.stringify({ ...settings, pushNotifications: true }));
        toast.success('Push notifications enabled');
        
        // Show test notification
        new Notification('FamousGates Hotels', {
          body: 'Notifications are now enabled!',
          icon: '/logo.png'
        });
      } else {
        toast.error('Push notification permission denied');
      }
    } else {
      setSettings(prev => ({ ...prev, pushNotifications: false }));
      localStorage.setItem('userSettings', JSON.stringify({ ...settings, pushNotifications: false }));
      toast.info('Push notifications disabled');
    }
  };

  const handleSettingChange = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('userSettings', JSON.stringify(newSettings));
  };

  const handleCategoryChange = (category: string, value: boolean) => {
    const newCategories = { ...settings.notificationCategories, [category]: value };
    const newSettings = { ...settings, notificationCategories: newCategories };
    setSettings(newSettings);
    localStorage.setItem('userSettings', JSON.stringify(newSettings));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Save settings to backend if needed
      localStorage.setItem('userSettings', JSON.stringify(settings));
      toast.success('Settings saved successfully');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    // Validate passwords
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await userAPI.updatePassword(passwordForm.currentPassword, passwordForm.newPassword);
      toast.success('Password updated successfully');
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast.error(error.message || 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your account preferences</p>
        </div>

        {/* Appearance */}
        <IOSCard className="p-6 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            {theme === 'dark' ? (
              <Moon className="h-5 w-5 text-[#3C3C43] dark:text-gray-300" />
            ) : (
              <Sun className="h-5 w-5 text-[#3C3C43]" />
            )}
            <h2 className="font-semibold font-sf-pro-display dark:text-white">Appearance</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium dark:text-white">Dark Mode</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {theme === 'dark' ? 'Currently using dark theme' : 'Switch to dark theme'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={theme === 'dark'}
                onChange={toggleTheme}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#FFFFFF] after:border-[#E5E5EA] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3C3C43] dark:peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </IOSCard>

        {/* Notifications */}
        <IOSCard className="p-6 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="h-5 w-5 text-[#3C3C43] dark:text-gray-300" />
            <h2 className="font-semibold font-sf-pro-display dark:text-white">Notifications</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium dark:text-white">Push Notifications</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Receive push notifications in the browser</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.pushNotifications}
                  onChange={(e) => handlePushNotificationToggle(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#FFFFFF] after:border-[#E5E5EA] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3C3C43] dark:peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium dark:text-white">Desktop Notifications</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Show notifications on desktop</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.desktopNotifications}
                  onChange={(e) => handleSettingChange('desktopNotifications', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#FFFFFF] after:border-[#E5E5EA] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3C3C43] dark:peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium dark:text-white">Notification Sounds</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Play sound for new notifications</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notificationSounds}
                  onChange={(e) => handleSettingChange('notificationSounds', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#FFFFFF] after:border-[#E5E5EA] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3C3C43] dark:peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="pt-2 border-t border-[rgba(60,60,67,0.12)] dark:border-gray-700">
              <p className="font-medium mb-2 dark:text-white">Notification Categories</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Choose which types of notifications you want to receive</p>
              <div className="space-y-2">
                {Object.entries(settings.notificationCategories).map(([category, enabled]) => (
                  <label key={category} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => handleCategoryChange(category, e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-[#3C3C43] focus:ring-[#3C3C43] dark:border-gray-600 dark:bg-gray-700"
                    />
                    <span className="text-sm capitalize dark:text-gray-300">{category}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </IOSCard>

        {/* Language */}
        <IOSCard className="p-6 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="h-5 w-5 text-[#3C3C43] dark:text-gray-300" />
            <h2 className="font-semibold font-sf-pro-display dark:text-white">Language</h2>
          </div>
          <select
            value={settings.language}
            onChange={(e) => handleSettingChange('language', e.target.value)}
            className="w-full border rounded-ios-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="en">English</option>
            <option value="sw">Swahili</option>
          </select>
        </IOSCard>

        {/* Security */}
        <IOSCard className="p-6 dark:bg-gray-800 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-5 w-5 text-[#3C3C43] dark:text-gray-300" />
            <h2 className="font-semibold font-sf-pro-display dark:text-white">Security</h2>
          </div>
          <div className="space-y-3">
            <IOSButton 
              variant="outline" 
              leftIcon={<Key />} 
              className="w-full dark:border-gray-600 dark:text-white"
              onClick={() => setShowPasswordModal(true)}
            >
              Change Password
            </IOSButton>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p>Last password change: {user?.password_changed_at ? new Date(user.password_changed_at).toLocaleDateString() : 'Never'}</p>
              <p className="mt-1">Two-factor authentication: Not enabled</p>
            </div>
          </div>
        </IOSCard>

        <IOSButton 
          onClick={handleSave} 
          className="w-full" 
          leftIcon={<Save />}
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save Settings'}
        </IOSButton>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold dark:text-white">Change Password</h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Current Password</label>
                <div className="relative">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 pr-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
                  >
                    {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">New Password</label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 pr-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Enter new password (min 6 characters)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
                  >
                    {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-300">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 pr-10 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
                  >
                    {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                }}
                className="flex-1 dark:border-gray-600 dark:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePasswordChange}
                disabled={isLoading}
                className="flex-1 bg-[#3C3C43] text-white hover:bg-[#2C2C2E] dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                {isLoading ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
