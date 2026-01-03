'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { IOSButton } from '@/components/ui/ios-button';
import { toast } from 'sonner';
import { roomsAPI } from '@/lib/api';
import { Building2, DollarSign, Hash, Users } from 'lucide-react';

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  floor: number;
  status: string;
  price: number;
}

interface EditRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomUpdated: () => void;
  room: Room | null;
}

const ROOM_TYPES = [
  { id: 'standard', name: 'Standard Room' },
  { id: 'deluxe', name: 'Deluxe Room' },
  { id: 'suite', name: 'Suite' },
  { id: 'presidential', name: 'Presidential Suite' },
  { id: 'family', name: 'Family Room' },
  { id: 'executive', name: 'Executive Room' }
];

const ROOM_STATUSES = [
  { id: 'available', name: 'Available' },
  { id: 'occupied', name: 'Occupied' },
  { id: 'cleaning', name: 'Cleaning' },
  { id: 'maintenance', name: 'Maintenance' }
];

export function EditRoomModal({ isOpen, onClose, onRoomUpdated, room }: EditRoomModalProps) {
  const [formData, setFormData] = useState({
    room_number: '',
    room_type: 'Standard Room',
    floor: 1,
    status: 'available',
    price: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (room) {
      setFormData({
        room_number: room.room_number,
        room_type: room.room_type,
        floor: room.floor,
        status: room.status,
        price: room.price || 0
      });
    }
  }, [room]);

  const handleSubmit = async () => {
    if (!room) return;

    if (!formData.room_number.trim()) {
      toast.error('Room number is required');
      return;
    }

    if (formData.price <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData = {
        room_number: formData.room_number,
        room_type: formData.room_type,
        floor: formData.floor,
        status: formData.status,
        price_override: formData.price
      };

      const response = await roomsAPI.updateRoom(room.id, updateData);
      
      if (response.success) {
        toast.success('Room updated successfully');
        onRoomUpdated();
        onClose();
      } else {
        toast.error('Failed to update room');
      }
    } catch (error) {
      console.error('Update room error:', error);
      toast.error('Failed to update room');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogTitle className="text-xl font-bold text-gray-900 mb-6">
          Edit Room {room?.room_number}
        </DialogTitle>

        <div className="space-y-4">
          {/* Room Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Hash className="inline h-4 w-4 mr-1" />
              Room Number
            </label>
            <Input
              value={formData.room_number}
              onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
              placeholder="e.g., 101"
              className="h-11"
            />
          </div>

          {/* Room Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building2 className="inline h-4 w-4 mr-1" />
              Room Type
            </label>
            <select
              value={formData.room_type}
              onChange={(e) => setFormData({ ...formData, room_type: e.target.value })}
              className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {ROOM_TYPES.map((type) => (
                <option key={type.id} value={type.name}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>

          {/* Floor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building2 className="inline h-4 w-4 mr-1" />
              Floor
            </label>
            <Input
              type="number"
              value={formData.floor}
              onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) || 1 })}
              min="1"
              max="50"
              className="h-11"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {ROOM_STATUSES.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <DollarSign className="inline h-4 w-4 mr-1" />
              Rate per Night (KES)
            </label>
            <Input
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
              min="0"
              step="100"
              placeholder="5000"
              className="h-11"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-8">
          <IOSButton
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </IOSButton>
          <IOSButton
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSubmitting ? 'Updating...' : 'Update Room'}
          </IOSButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
