'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Bell, Lock, Moon, Globe, Save } from 'lucide-react';
import { toast } from 'sonner';

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
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="h-5 w-5 text-indigo-600" />
            <h2 className="font-semibold">Notifications</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Push Notifications</p>
                <p className="text-sm text-gray-500">Receive notifications in the app</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifications}
                  onChange={(e) => setSettings({...settings, notifications: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Alerts</p>
                <p className="text-sm text-gray-500">Receive email notifications</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.emailAlerts}
                  onChange={(e) => setSettings({...settings, emailAlerts: e.target.checked})}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </Card>

        {/* Appearance */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Moon className="h-5 w-5 text-indigo-600" />
            <h2 className="font-semibold">Appearance</h2>
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
                onChange={(e) => setSettings({...settings, darkMode: e.target.checked})}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </Card>

        {/* Language */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="h-5 w-5 text-indigo-600" />
            <h2 className="font-semibold">Language</h2>
          </div>
          <select
            value={settings.language}
            onChange={(e) => setSettings({...settings, language: e.target.value})}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="en">English</option>
            <option value="sw">Swahili</option>
          </select>
        </Card>

        {/* Security */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="h-5 w-5 text-indigo-600" />
            <h2 className="font-semibold">Security</h2>
          </div>
          <Button variant="outline">Change Password</Button>
        </Card>

        <Button onClick={handleSave} className="w-full">
          <Save className="h-4 w-4 mr-2" /> Save Settings
        </Button>
      </div>
    </DashboardLayout>
  );
}
