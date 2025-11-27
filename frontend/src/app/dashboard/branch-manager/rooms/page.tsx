'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bed, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { roomsAPI } from '@/lib/api';

export default function BranchManagerRoomsPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRooms();
  }, [user]);

  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      const res = await roomsAPI.getRooms(user?.branch_id);
      setRooms(res.rooms || res || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'occupied': return 'bg-red-100 text-red-800';
      case 'cleaning': return 'bg-yellow-100 text-yellow-800';
      case 'maintenance': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Room Management</h1>
              <p className="text-gray-600">View and manage room status</p>
            </div>
            <Button onClick={fetchRooms} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Room Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-green-50">
              <CheckCircle className="h-6 w-6 text-green-600 mb-2" />
              <p className="text-2xl font-bold">{rooms.filter(r => r.status === 'available').length}</p>
              <p className="text-sm text-green-700">Available</p>
            </Card>
            <Card className="p-4 bg-red-50">
              <XCircle className="h-6 w-6 text-red-600 mb-2" />
              <p className="text-2xl font-bold">{rooms.filter(r => r.status === 'occupied').length}</p>
              <p className="text-sm text-red-700">Occupied</p>
            </Card>
            <Card className="p-4 bg-yellow-50">
              <Clock className="h-6 w-6 text-yellow-600 mb-2" />
              <p className="text-2xl font-bold">{rooms.filter(r => r.status === 'cleaning').length}</p>
              <p className="text-sm text-yellow-700">Cleaning</p>
            </Card>
            <Card className="p-4">
              <Bed className="h-6 w-6 text-indigo-600 mb-2" />
              <p className="text-2xl font-bold">{rooms.length}</p>
              <p className="text-sm text-gray-600">Total Rooms</p>
            </Card>
          </div>

          {/* Room Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {rooms.map((room: any) => (
              <Card key={room.id} className="p-4 text-center cursor-pointer hover:shadow-md transition-shadow">
                <Bed className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="font-bold">{room.room_number}</p>
                <p className="text-xs text-gray-500">{room.room_type}</p>
                <Badge className={`mt-2 ${getStatusColor(room.status)}`}>
                  {room.status}
                </Badge>
              </Card>
            ))}
          </div>

          {rooms.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {isLoading ? 'Loading...' : 'No rooms found'}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
