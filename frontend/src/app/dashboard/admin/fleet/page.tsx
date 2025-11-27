'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck, Plus, Calendar, Gauge, Wrench, Search } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Vehicle {
  id: number;
  vehicle_number: string;
  vehicle_type: string;
  capacity?: string;
  status: 'available' | 'in_use' | 'maintenance' | 'retired';
  last_service_date?: string;
  next_service_date?: string;
  current_mileage?: number;
  created_at: string;
}

export default function FleetPage() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_number: '',
    vehicle_type: '',
    capacity: '',
    current_mileage: 0,
    last_service_date: ''
  });

  useEffect(() => {
    fetchVehicles();
  }, [filterStatus]);

  const fetchVehicles = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = filterStatus !== 'all'
        ? `${API_URL}/api/fleet/vehicles?status=${filterStatus}`
        : `${API_URL}/api/fleet/vehicles`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setVehicles(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      toast.error('Failed to load vehicles');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/fleet/vehicles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success('Vehicle registered successfully');
        setIsModalOpen(false);
        setFormData({
          vehicle_number: '',
          vehicle_type: '',
          capacity: '',
          current_mileage: 0,
          last_service_date: ''
        });
        fetchVehicles();
      } else {
        toast.error('Failed to register vehicle');
      }
    } catch (error) {
      toast.error('Error registering vehicle');
    }
  };

  const filteredVehicles = vehicles.filter(vehicle =>
    vehicle.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.vehicle_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'in_use': return 'bg-blue-500';
      case 'maintenance': return 'bg-amber-500';
      case 'retired': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const stats = {
    total: vehicles.length,
    available: vehicles.filter(v => v.status === 'available').length,
    in_use: vehicles.filter(v => v.status === 'in_use').length,
    maintenance: vehicles.filter(v => v.status === 'maintenance').length
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Fleet Management</h1>
            <p className="text-gray-600 mt-1">Manage hotel vehicles and assignments</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Vehicle
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total Vehicles</div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Available</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{stats.available}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">In Use</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{stats.in_use}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Maintenance</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{stats.maintenance}</div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search vehicles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="in_use">In Use</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Vehicles Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <p>Loading vehicles...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVehicles.map((vehicle) => (
              <Card key={vehicle.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Truck className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{vehicle.vehicle_number}</h3>
                      <p className="text-sm text-gray-600">{vehicle.vehicle_type}</p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(vehicle.status)}>
                    {vehicle.status}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {vehicle.capacity && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Truck className="w-4 h-4" />
                      <span>Capacity: {vehicle.capacity}</span>
                    </div>
                  )}
                  {vehicle.current_mileage !== undefined && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Gauge className="w-4 h-4" />
                      <span>{vehicle.current_mileage.toLocaleString()} km</span>
                    </div>
                  )}
                  {vehicle.next_service_date && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Wrench className="w-4 h-4" />
                      <span>Next Service: {new Date(vehicle.next_service_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  {vehicle.last_service_date && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>Last Service: {new Date(vehicle.last_service_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t">
                  <Button variant="outline" size="sm" className="w-full">
                    View Details
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && filteredVehicles.length === 0 && (
          <div className="text-center py-12">
            <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No vehicles found</p>
          </div>
        )}

        {/* Create Vehicle Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Register New Vehicle</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateVehicle} className="space-y-4">
              <div>
                <Label htmlFor="vehicle_number">Vehicle Number *</Label>
                <Input
                  id="vehicle_number"
                  required
                  value={formData.vehicle_number}
                  onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                  placeholder="e.g., KCA 123X"
                />
              </div>
              <div>
                <Label htmlFor="vehicle_type">Vehicle Type *</Label>
                <Select
                  value={formData.vehicle_type}
                  onValueChange={(value) => setFormData({ ...formData, vehicle_type: value })}
                >
                  <SelectTrigger id="vehicle_type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Van">Van</SelectItem>
                    <SelectItem value="Truck">Truck</SelectItem>
                    <SelectItem value="Car">Car</SelectItem>
                    <SelectItem value="SUV">SUV</SelectItem>
                    <SelectItem value="Pickup">Pickup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  placeholder="e.g., 1000kg or 8 passengers"
                />
              </div>
              <div>
                <Label htmlFor="current_mileage">Current Mileage (km)</Label>
                <Input
                  id="current_mileage"
                  type="number"
                  min="0"
                  value={formData.current_mileage}
                  onChange={(e) => setFormData({ ...formData, current_mileage: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="last_service_date">Last Service Date</Label>
                <Input
                  id="last_service_date"
                  type="date"
                  value={formData.last_service_date}
                  onChange={(e) => setFormData({ ...formData, last_service_date: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Register Vehicle</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
