'use client';

import { useState } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { Input } from '@/components/ui/input';
import { Settings, Building2, Mail, Phone, Globe, Save } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    hotelName: 'Famous Gate Hotel',
    email: 'famousgatesbmt@gmail.com',
    phone: '0706 782 828',
    website: 'www.famousgate.com',
    address: 'Bomet, Kenya',
    currency: 'KES',
    timezone: 'Africa/Nairobi',
  });

  const handleSave = () => {
    toast.success('Settings saved');
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Settings className="h-7 w-7" /> Settings</h1><p className="text-gray-500">System configuration</p></div>
            <IOSButton onClick={handleSave} leftIcon={<Save />}>Save Changes</IOSButton>
          </div>

          <IOSCard className="p-6">
            <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Hotel Information</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className="text-sm font-medium flex items-center gap-2"><Building2 className="h-4 w-4" /> Hotel Name</label><Input value={settings.hotelName} onChange={(e) => setSettings({ ...settings, hotelName: e.target.value })} /></div>
              <div><label className="text-sm font-medium flex items-center gap-2"><Mail className="h-4 w-4" /> Email</label><Input type="email" value={settings.email} onChange={(e) => setSettings({ ...settings, email: e.target.value })} /></div>
              <div><label className="text-sm font-medium flex items-center gap-2"><Phone className="h-4 w-4" /> Phone</label><Input value={settings.phone} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} /></div>
              <div><label className="text-sm font-medium flex items-center gap-2"><Globe className="h-4 w-4" /> Website</label><Input value={settings.website} onChange={(e) => setSettings({ ...settings, website: e.target.value })} /></div>
            </div>
          </IOSCard>

          <IOSCard className="p-6">
            <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Regional Settings</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Currency</label>
                <select value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className="w-full p-2 border rounded-ios-lg">
                  <option value="KES">KES - Kenyan Shilling</option>
                  <option value="USD">USD - US Dollar</option>
                </select>
              </div>
              <div><label className="text-sm font-medium">Timezone</label>
                <select value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} className="w-full p-2 border rounded-ios-lg">
                  <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
          </IOSCard>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
