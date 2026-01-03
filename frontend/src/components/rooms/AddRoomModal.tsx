'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Bed, Building2, DollarSign, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { Input } from '@/components/ui/input';
import { roomsAPI } from '@/lib/api';

interface AddRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomAdded: () => void;
  branchId: string | number;
}

interface RoomFormData {
  room_number: string;
  room_type_id: string;
  floor: number;
  base_price: number;
  max_occupancy: number;
  amenities: string[];
  description: string;
}

const ROOM_TYPES = [
  { id: '1', name: 'Standard Room', description: 'Basic accommodation' },
  { id: '2', name: 'Deluxe Room', description: 'Enhanced comfort' },
  { id: '3', name: 'Suite', description: 'Premium accommodation' },
  { id: '4', name: 'Executive Suite', description: 'Luxury accommodation' },
];

const AMENITIES = [
  'WiFi', 'Air Conditioning', 'TV', 'Mini Bar', 'Safe', 'Balcony', 
  'Ocean View', 'City View', 'Kitchenette', 'Jacuzzi', 'Work Desk'
];

export function AddRoomModal({ isOpen, onClose, onRoomAdded, branchId }: AddRoomModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<RoomFormData>({
    room_number: '',
    room_type_id: '1',
    floor: 1,
    base_price: 0,
    max_occupancy: 2,
    amenities: [],
    description: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.room_number.trim()) {
      toast.error('Room number is required');
      return;
    }

    if (formData.base_price <= 0) {
      toast.error('Base price must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    try {
      const roomData = {
        ...formData,
        branch_id: branchId,
        status: 'available'
      };

      const response = await roomsAPI.createRoom(roomData);
      
      if (response.success) {
        toast.success('Room added successfully');
        onRoomAdded();
        onClose();
        // Reset form
        setFormData({
          room_number: '',
          room_type_id: '1',
          floor: 1,
          base_price: 0,
          max_occupancy: 2,
          amenities: [],
          description: ''
        });
      } else {
        throw new Error(response.error || 'Failed to add room');
      }
    } catch (error: any) {
      console.error('Error adding room:', error);
      toast.error(error.message || 'Failed to add room');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAmenity = (amenity: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const selectedRoomType = ROOM_TYPES.find(type => type.id === formData.room_type_id);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto p-0">
        <div className="p-4">
          <DialogHeader className="pb-3">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-4 w-4" />
              Add New Room
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Information */}
          <IOSCard className="p-2">
            <h3 className="font-medium text-[#3C3C43] mb-2 flex items-center gap-1 text-sm">
              <Building2 className="h-3 w-3" />
              Basic Info
            </h3>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-[#3C3C43] mb-1">
                  Room Number *
                </label>
                <Input
                  value={formData.room_number}
                  onChange={(e) => setFormData({...formData, room_number: e.target.value})}
                  placeholder="e.g., 101, 201A"
                  className="text-sm h-8"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#3C3C43] mb-1">
                  Floor
                </label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={formData.floor}
                  onChange={(e) => setFormData({...formData, floor: parseInt(e.target.value) || 1})}
                  className="text-sm h-8"
                  required
                />
              </div>
            </div>

            <div className="mt-2">
              <label className="block text-xs font-medium text-[#3C3C43] mb-1">
                Room Type
              </label>
              <select
                value={formData.room_type_id}
                onChange={(e) => setFormData({...formData, room_type_id: e.target.value})}
                className="w-full px-2 py-1 border border-[#E5E5EA] rounded text-sm h-8"
              >
                {ROOM_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
          </IOSCard>

          {/* Pricing & Capacity */}
          <IOSCard className="p-2">
            <h3 className="font-medium text-[#3C3C43] mb-2 flex items-center gap-1 text-sm">
              <DollarSign className="h-3 w-3" />
              Price & Guests
            </h3>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-[#3C3C43] mb-1">
                  Price (KES) *
                </label>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={formData.base_price || ''}
                  onChange={(e) => setFormData({...formData, base_price: parseFloat(e.target.value) || 0})}
                  placeholder="Enter price per night"
                  className="text-sm h-8"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#3C3C43] mb-1">
                  Max Guests
                </label>
                <select
                  value={formData.max_occupancy}
                  onChange={(e) => setFormData({...formData, max_occupancy: parseInt(e.target.value)})}
                  className="w-full px-2 py-1 border border-[#E5E5EA] rounded text-sm h-8"
                >
                  {[1,2,3,4,5,6,7,8,9,10].map(num => (
                    <option key={num} value={num}>{num} guest{num > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          </IOSCard>

          {/* Amenities & Description */}
          <IOSCard className="p-2">
            <h3 className="font-medium text-[#3C3C43] mb-2 flex items-center gap-1 text-sm">
              <Bed className="h-3 w-3" />
              Amenities & Notes
            </h3>
            
            <div className="grid grid-cols-5 gap-1 mb-2">
              {AMENITIES.slice(0, 10).map((amenity) => (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => toggleAmenity(amenity)}
                  className={`p-1 rounded text-xs transition-all ${
                    formData.amenities.includes(amenity)
                      ? 'bg-[#3C3C43] text-white'
                      : 'bg-[#F2F2F7] text-[#3C3C43] hover:bg-[#E5E5EA]'
                  }`}
                >
                  {amenity.length > 8 ? amenity.substring(0, 6) + '..' : amenity}
                </button>
              ))}
            </div>
            
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Optional notes..."
              className="w-full px-2 py-1 border border-[#E5E5EA] rounded text-xs resize-none"
              rows={1}
            />
          </IOSCard>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <IOSButton
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-8 text-sm"
              disabled={isSubmitting}
            >
              Cancel
            </IOSButton>
            <IOSButton
              type="submit"
              className="flex-1 h-8 text-sm bg-[#3C3C43] hover:bg-[#000000] text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding...' : 'Add Room'}
            </IOSButton>
          </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
