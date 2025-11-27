'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Mail, Phone, Building2, Briefcase, Save, Camera, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { staffAPI } from '@/lib/api';

export default function ProfilePage() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    department: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: (user as any).phone_number || '',
        department: (user as any).department || '',
      });
    }
  }, [user]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await staffAPI.updateProfile({
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone_number: formData.phone,
        department: formData.department,
      });
      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-gray-600">View and update your profile information</p>
        </div>

        <Card className="p-6">
          {/* Profile Photo */}
          <div className="flex items-center gap-6 mb-6 pb-6 border-b">
            <div className="relative">
              <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center">
                <User className="h-12 w-12 text-indigo-600" />
              </div>
              <button className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg border">
                <Camera className="h-4 w-4 text-gray-600" />
              </button>
            </div>
            <div>
              <h2 className="text-xl font-semibold">{user?.firstName} {user?.lastName}</h2>
              <p className="text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    disabled={!isEditing}
                    className="flex-1 outline-none disabled:bg-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    disabled={!isEditing}
                    className="flex-1 outline-none disabled:bg-transparent"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="flex-1 outline-none bg-transparent text-gray-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  disabled={!isEditing}
                  placeholder="Enter phone number"
                  className="flex-1 outline-none disabled:bg-transparent"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              {isEditing ? (
                <>
                  <Button onClick={handleSave} disabled={isLoading}>
                    {isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isLoading}>Cancel</Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
