'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { Settings, Bell, Lock, Moon, Globe, Save } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { notificationsAPI } from '@/lib/api';

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    notifications: true,
    emailAlerts: true,
    darkMode: false,
    language: 'en',
  });

  const handleSave = () => {
    toast.success('Settings saved successfully');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-gray-600">Manage your account preferences</p>
        </div>

        {/* Notifications */}
        <IOSCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="h-5 w-5 text-[#3C3C43]" />
            <h2 className="font-semibold font-sf-pro-display">Notifications</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Push Notifications</p>
                <p className="text-sm text-gray-500">Receive push notifications in the browser</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications}
                  onChange={async (e) => {
                    if (e.target.checked) {
                      // Request permission
                      if ('Notification' in window) {
                        const permission = await Notification.requestPermission();
                        if (permission === 'granted') {
                          setSettings({ ...settings, notifications: true });
                          toast.success('Push notifications enabled');
                        } else {
                          toast.error('Push notification permission denied');
                        }
                      } else {
                        toast.error('Push notifications not supported in this browser');
                      }
                    } else {
                      setSettings({ ...settings, notifications: false });
                      toast.info('Push notifications disabled');
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#FFFFFF] after:border-[#E5E5EA] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3C3C43]"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Desktop Notifications</p>
                <p className="text-sm text-gray-500">Show notifications on desktop</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailAlerts}
                  onChange={(e) => setSettings({ ...settings, emailAlerts: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#FFFFFF] after:border-[#E5E5EA] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3C3C43]"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Notification Sounds</p>
                <p className="text-sm text-gray-500">Play sound for new notifications</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.darkMode}
                  onChange={(e) => setSettings({ ...settings, darkMode: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#FFFFFF] after:border-[#E5E5EA] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3C3C43]"></div>
              </label>
            </div>
            <div className="pt-2 border-t border-[rgba(60,60,67,0.12)]">
              <p className="font-medium mb-2">Notification Categories</p>
              <p className="text-sm text-gray-500 mb-3">Choose which types of notifications you want to receive</p>
              <div className="space-y-2">
                {['Inventory', 'Finance', 'Housekeeping', 'Bookings', 'Staff', 'System'].map((category) => (
                  <label key={category} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-4 h-4 rounded border-gray-300 text-[#3C3C43] focus:ring-[#3C3C43]"
                    />
                    <span className="text-sm">{category}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </IOSCard>

        {/* Appearance */}
        <IOSCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Moon className="h-5 w-5 text-[#3C3C43]" />
            <h2 className="font-semibold font-sf-pro-display">Appearance</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Dark Mode</p>
              <p className="text-sm text-gray-500">Switch to dark theme</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.darkMode}
                onChange={(e) => setSettings({ ...settings, darkMode: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#FFFFFF] after:border-[#E5E5EA] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3C3C43]"></div>
            </label>
          </div>
        </IOSCard>

        {/* Language */}
        <IOSCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="h-5 w-5 text-[#3C3C43]" />
            <h2 className="font-semibold font-sf-pro-display">Language</h2>
          </div>
          <select
            value={settings.language}
            onChange={(e) => setSettings({ ...settings, language: e.target.value })}
            className="w-full border rounded-ios-lg px-3 py-2"
          >
            <option value="en">English</option>
            <option value="sw">Swahili</option>
          </select>
        </IOSCard>

        {/* Security */}
        <IOSCard className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="h-5 w-5 text-[#3C3C43]" />
            <h2 className="font-semibold font-sf-pro-display">Security</h2>
          </div>
          <IOSButton variant="outline">Change Password</IOSButton>
        </IOSCard>

        <IOSButton onClick={handleSave} className="w-full" leftIcon={<Save />}>Save Settings
        </IOSButton>
      </div>
    </DashboardLayout>
  );
}
