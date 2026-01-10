'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, User, Mail, Phone, MapPin, Hash, Building,
  Briefcase, Star, MessageSquare, Save
} from 'lucide-react';
import { toast } from 'sonner';
import { guestAPI } from '@/lib/api';

interface GuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
  mode?: 'create' | 'edit';
}

export function GuestModal({ isOpen, onClose, initialData, mode = 'create' }: GuestModalProps): JSX.Element | null {
  const [guestData, setGuestData] = useState(initialData || {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    idNumber: '',
    nationality: '',
    address: '',
    company: '',
    vipStatus: false,
    notes: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setGuestData((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        first_name: guestData.firstName,
        last_name: guestData.lastName,
        email: guestData.email,
        phone_number: guestData.phone,
        id_number: guestData.idNumber,
        nationality: guestData.nationality,
        address: guestData.address,
        company: guestData.company,
        vip_status: guestData.vipStatus,
        notes: guestData.notes
      };
      if (mode === 'edit' && initialData?.id) {
        await guestAPI.updateGuest(initialData.id, payload);
      } else {
        await guestAPI.createGuest(payload);
      }
      toast.success('Guest ' + (mode === 'create' ? 'created' : 'updated') + ' successfully!');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save guest');
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {mode === 'create' ? 'Add New Guest' : 'Edit Guest'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="font-semibold font-sf-pro-display text-gray-900 flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                name="firstName"
                value={guestData.firstName}
                onChange={handleChange}
                placeholder="First Name"
                className="px-3 py-2 border border-gray-300 rounded-ios-lg"
              />
              <input
                type="text"
                name="lastName"
                value={guestData.lastName}
                onChange={handleChange}
                placeholder="Last Name"
                className="px-3 py-2 border border-gray-300 rounded-ios-lg"
              />
              <input
                type="email"
                name="email"
                value={guestData.email}
                onChange={handleChange}
                placeholder="Email"
                className="px-3 py-2 border border-gray-300 rounded-ios-lg"
              />
              <input
                type="tel"
                name="phone"
                value={guestData.phone}
                onChange={handleChange}
                placeholder="Phone"
                className="px-3 py-2 border border-gray-300 rounded-ios-lg"
              />
            </div>
          </div>

          {/* Additional Details */}
          <div className="space-y-4">
            <h3 className="font-semibold font-sf-pro-display text-gray-900 flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Additional Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                name="idNumber"
                value={guestData.idNumber}
                onChange={handleChange}
                placeholder="ID/Passport Number"
                className="px-3 py-2 border border-gray-300 rounded-ios-lg"
              />
              <input
                type="text"
                name="nationality"
                value={guestData.nationality}
                onChange={handleChange}
                placeholder="Nationality"
                className="px-3 py-2 border border-gray-300 rounded-ios-lg"
              />
              <input
                type="text"
                name="company"
                value={guestData.company}
                onChange={handleChange}
                placeholder="Company (if applicable)"
                className="px-3 py-2 border border-gray-300 rounded-ios-lg"
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="vipStatus"
                  checked={guestData.vipStatus}
                  onChange={handleChange}
                  className="h-4 w-4 text-indigo-600"
                />
                <label className="text-sm text-gray-700">VIP Guest</label>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-4">
            <h3 className="font-semibold font-sf-pro-display text-gray-900 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Address
            </h3>
            <textarea
              name="address"
              value={guestData.address}
              onChange={handleChange}
              placeholder="Full Address"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
            />
          </div>

          {/* Notes */}
          <div className="space-y-4">
            <h3 className="font-semibold font-sf-pro-display text-gray-900 flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Notes
            </h3>
            <textarea
              name="notes"
              value={guestData.notes}
              onChange={handleChange}
              placeholder="Additional Notes"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
            />
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-6 border-t">
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-indigo-600 text-white rounded-ios-lg hover:bg-indigo-700"
          >
            <Save className="inline h-4 w-4 mr-2" />
            {mode === 'create' ? 'Add Guest' : 'Update Guest'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
